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
        // GIF only supports 1-bit alpha. Anything below the cutoff becomes fully
        // transparent, which removes the semi-transparent fringe / white bleed.
        palette = quantize(rgba, colors, {
          format: 'rgba4444',
          oneBitAlpha: ALPHA_CUTOFF,
          clearAlpha: true,
          clearAlphaThreshold: ALPHA_CUTOFF
        });

        transparentIndex = palette.findIndex((color) => color[3] === 0);
        if (transparentIndex === -1) {
          if (palette.length < 256) {
            palette.push([0, 0, 0, 0]);
            transparentIndex = palette.length - 1;
          } else {
            palette[palette.length - 1] = [0, 0, 0, 0];
            transparentIndex = palette.length - 1;
          }
        }

        index = applyPalette(rgba, palette, 'rgba4444');
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
