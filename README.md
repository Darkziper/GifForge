# GifForge — GIF Maker

**Webpage:** https://darkziper.github.io/GifForge/

A free GIF maker for image frames. It runs entirely in the browser (no uploads, no server, no build step) and is hosted on GitHub Pages.

![Performance](https://img.shields.io/badge/performance-lightweight-ff5c8a) ![Privacy](https://img.shields.io/badge/privacy-protected-5cc8ff) ![Processing](https://img.shields.io/badge/processing-client--side-a78bfa)

---

## The website

**`index.html`** is the GIF maker. Drop in **as many images as you want** — 2 frames or 300 — and they all become one animated `.gif`. Reorder them, set the timing, and download.

> It is not a one-image converter. Every image you add becomes a frame of the same animation, in the order you choose.

### Features

- Batch upload: drag in a whole folder/selection of images at once, or pick them with the file browser
- Up to **300 frames** per GIF, all merged into a single animation
- Accepts PNG, JPG, WebP, GIF, and BMP — mixes fine in one project
- Files are naturally sorted by name (`frame2.png` before `frame10.png`), so numbered sequences land in the right order
- Thumbnail grid with drag-to-reorder, arrow nudge buttons, remove, and reverse
- Live animated preview with play/pause and frame scrubbing
- Frame delay / FPS presets (30, 24, 15, 10 fps)
- Loop count, max width, color count (256 → 32), and background color
- **Transparent GIF output** — semi-transparent pixels are binarized at alpha ≥ 200, which removes the fuzzy edge noise and white bleed that GIF encoders produce from soft PNG alpha
- Encoding runs in a Web Worker, so the UI stays responsive
- Everything is local: images never leave the browser

### Website files

| Path | Purpose |
|------|---------|
| `index.html` | The GIF maker page |
| `assets/style.css` | Dark UI theme and responsive layout |
| `assets/app.js` | Upload, reordering, preview, settings, encoding orchestration |
| `assets/gif-worker.js` | Web Worker that quantizes frames and writes the GIF |
| `vendor/gifenc.esm.js` | [gifenc](https://github.com/mattdesl/gifenc) encoder (MIT), vendored for GitHub Pages |
| `gif-guide.html` | Step-by-step CLI guide linked from the site |

### Notes on GIF transparency

GIF supports only **1-bit transparency** — a pixel is either fully visible or fully invisible. The worker thresholds the source alpha at 200/255, so:

- Solid sprite pixels stay opaque
- Anti-aliased fringes become transparent instead of turning into white or noisy halos
- No semi-transparent dithering noise is left behind

If you want a solid backdrop instead, pick Black, White, Dark, or a custom color under **Background**. This is often the cleanest option for sprites that were originally drawn against a solid color.

---

## License / credits

- GIF encoding on the website: [gifenc](https://github.com/mattdesl/gifenc) (MIT) — vendored into `vendor/`
- GIF encoding / optimization CLI: [gifski](https://gif.ski/) (AGPL-3.0)
- Web fonts: [Inter](https://fonts.google.com/specimen/Inter) and [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) (SIL Open Font License).
- GIF encoding library used during development and testing: [gif.js](https://github.com/jnordberg/gif.js) (MIT)
- Browser testing: [Playwright](https://playwright.dev/) (MIT)
