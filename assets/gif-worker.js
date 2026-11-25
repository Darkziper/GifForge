import { GIFEncoder, quantize, applyPalette } from '../vendor/gifenc.esm.js';

const ALPHA_CUTOFF = 200;

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
