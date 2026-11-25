import { GIFEncoder, quantize, applyPalette } from '../vendor/gifenc.esm.js';

const ALPHA_CUTOFF = 128;

self.onmessage = (event) => {
  const { frames, width, height, delay, loop, colors, transparent } = event.data;

  try {
    const gif = GIFEncoder();
    const total = frames.length;

    for (let i = 0; i < total; i++) {
      const rgba = new Uint8ClampedArray(frames[i].buffer);
      let palette;
      let index;
      let transparentIndex = -1;

      if (transparent) {
        // GIF only supports 1-bit alpha. Snap alpha first, then quantize RGB at
        // higher precision to avoid rgba4444 color artifacts on some frames.
        const snapped = new Uint8ClampedArray(rgba);
        let hasTransparency = false;

        // Defringe semi-transparent edge pixels that will become opaque, so light
        // matte halos don't bleed into the GIF. Use a nearest-opaque BFS so even
        // large semi-transparent fringes get a clean color.
        const totalPx = width * height;
        const visited = new Uint8Array(totalPx);
        const queue = new Int32Array(totalPx);
        let qh = 0, qt = 0;
        const srcR = new Uint8ClampedArray(totalPx);
        const srcG = new Uint8ClampedArray(totalPx);
        const srcB = new Uint8ClampedArray(totalPx);

        for (let i = 0, p = 0; i < totalPx; i++, p += 4) {
          if (snapped[p + 3] === 255) {
            visited[i] = 1;
            srcR[i] = snapped[p];
            srcG[i] = snapped[p + 1];
            srcB[i] = snapped[p + 2];
            queue[qt++] = i;
          }
        }

        const dxs = [-1, 0, 1, -1, 1, -1, 0, 1];
        const dys = [-1, -1, -1, 0, 0, 1, 1, 1];
        while (qh < qt) {
          const idx = queue[qh++];
          const x = idx % width;
          const y = (idx / width) | 0;
          const r = srcR[idx], g = srcG[idx], b = srcB[idx];
          for (let d = 0; d < 8; d++) {
            const nx = x + dxs[d];
            const ny = y + dys[d];
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const nIdx = ny * width + nx;
            if (visited[nIdx]) continue;
            const np = nIdx * 4;
            const na = snapped[np + 3];
            if (na < ALPHA_CUTOFF || na === 255) continue;
            visited[nIdx] = 1;
            srcR[nIdx] = r;
            srcG[nIdx] = g;
            srcB[nIdx] = b;
            snapped[np] = r;
            snapped[np + 1] = g;
            snapped[np + 2] = b;
            queue[qt++] = nIdx;
          }
        }

        for (let p = 0; p < snapped.length; p += 4) {
          if (snapped[p + 3] < ALPHA_CUTOFF) {
            snapped[p] = 0;
            snapped[p + 1] = 0;
            snapped[p + 2] = 0;
            snapped[p + 3] = 0;
            hasTransparency = true;
          } else {
            snapped[p + 3] = 255;
          }
        }

        palette = quantize(snapped, Math.max(2, hasTransparency ? colors - 1 : colors), { format: 'rgb565' });
        if (hasTransparency) {
          if (palette.length < 256) {
            palette.push([0, 0, 0]);
            transparentIndex = palette.length - 1;
          } else {
            palette[palette.length - 1] = [0, 0, 0];
            transparentIndex = palette.length - 1;
          }
        }

        index = applyPalette(snapped, palette, 'rgb565');
        if (hasTransparency) {
          for (let p = 0, j = 0; p < snapped.length; p += 4, j++) {
            if (snapped[p + 3] === 0) index[j] = transparentIndex;
            else if (index[j] === transparentIndex) {
              // Avoid making opaque pixels transparent when they map to the reserved slot.
              let best = -1;
              let bestDist = Infinity;
              const r = snapped[p], g = snapped[p + 1], b = snapped[p + 2];
              for (let k = 0; k < palette.length; k++) {
                if (k === transparentIndex) continue;
                const pc = palette[k];
                const dr = r - pc[0], dg = g - pc[1], db = b - pc[2];
                const d = dr * dr + dg * dg + db * db;
                if (d < bestDist) { bestDist = d; best = k; if (d === 0) break; }
              }
              if (best >= 0) index[j] = best;
            }
          }
        }
      } else {
        palette = quantize(rgba, colors, { format: 'rgb565' });
        index = applyPalette(rgba, palette, 'rgb565');
      }

      gif.writeFrame(index, width, height, {
        palette,
        delay,
        repeat: loop,
        transparent: transparentIndex >= 0,
        transparentIndex: Math.max(0, transparentIndex),
        dispose: transparent ? 2 : 1
      });

      self.postMessage({ type: 'progress', progress: (i + 1) / total });
    }

    gif.finish();
    const bytes = gif.bytes();
    self.postMessage({ type: 'done', buffer: bytes.buffer }, [bytes.buffer]);
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error && error.message ? error.message : String(error)
    });
  }
};
