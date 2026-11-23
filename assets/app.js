const MAX_FRAMES = 300;
const MAX_SIDE = 4096;
const PREVIEW_MAX = 680;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const el = {
  fileInput: $('#fileInput'),
  dropzone: $('#dropzone'),
  browseBtn: $('#browseBtn'),
  dropLoading: $('#dropLoading'),
  frames: $('#frames'),
  emptyFrames: $('#emptyFrames'),
  frameCount: $('#frameCount'),
  reverseBtn: $('#reverseBtn'),
  clearBtn: $('#clearBtn'),
  previewCanvas: $('#previewCanvas'),
  previewStage: $('#previewStage'),
  previewEmpty: $('#previewEmpty'),
  previewMeta: $('#previewMeta'),
  playBtn: $('#playBtn'),
  scrub: $('#scrub'),
  frameLabel: $('#frameLabel'),
  delay: $('#delay'),
  delayVal: $('#delayVal'),
  fpsPresets: $('#fpsPresets'),
  loop: $('#loop'),
  maxWidth: $('#maxWidth'),
  quality: $('#quality'),
  bgSwatches: $('#bgSwatches'),
  customBg: $('#customBg'),
  customDot: $('#customDot'),
  makeBtn: $('#makeBtn'),
  progressWrap: $('#progressWrap'),
  progressBar: $('#progressBar'),
  progressText: $('#progressText'),
  progressPct: $('#progressPct'),
  resultBox: $('#resultBox'),
  resultImg: $('#resultImg'),
  resultSize: $('#resultSize'),
  downloadBtn: $('#downloadBtn'),
  sizeMeta: $('#sizeMeta'),
  toast: $('#toast')
};

const state = {
  frames: [],
  delay: 100,
  loop: 0,
  maxWidth: 0,
  colors: 256,
  bg: 'transparent',
  current: 0,
  playing: false,
  encoding: false,
  resultUrl: null,
  jobId: 0
};

let uid = 0;
let dragId = null;
let toastTimer = 0;
let animId = 0;
let lastTick = 0;

/* ---------- Small helpers ---------- */

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) reject(new Error('Empty image'));
      else resolve(img);
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

function frameAt(index) {
  return state.frames[clamp(index, 0, Math.max(0, state.frames.length - 1))];
}

function toast(message, isError = false) {
  window.clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.toggle('error', isError);
  el.toast.classList.add('show');
  toastTimer = window.setTimeout(() => el.toast.classList.remove('show'), 3400);
}

function setProgress(fraction, label) {
  const pct = Math.round(clamp(fraction, 0, 1) * 100);
  el.progressBar.style.width = `${pct}%`;
  el.progressPct.textContent = `${pct}%`;
  el.progressText.textContent = label;
}

function showDropLoading(show) {
  el.dropLoading.hidden = !show;
}

function markDirty() {
  el.resultBox.hidden = true;
}

/* ---------- Output size ---------- */

function computeOutput() {
  if (!state.frames.length) return null;
  const maxW = Math.max(...state.frames.map((frame) => frame.width));
  const maxH = Math.max(...state.frames.map((frame) => frame.height));
  let scale = state.maxWidth > 0 ? Math.min(1, state.maxWidth / maxW) : 1;
  scale = Math.min(scale, MAX_SIDE / maxW, MAX_SIDE / maxH);

  return {
    width: Math.max(1, Math.round(maxW * scale)),
    height: Math.max(1, Math.round(maxH * scale)),
    scale
  };
}

function updateMeta() {
  const out = computeOutput();
  if (!out) {
    el.previewMeta.textContent = '—';
    el.sizeMeta.textContent = '—';
    return;
  }
  const fps = 1000 / state.delay;
  el.previewMeta.textContent = `${out.width} × ${out.height} · ${fps.toFixed(fps >= 10 ? 0 : 1)} fps`;
  el.sizeMeta.textContent = `${out.width} × ${out.height}`;
}

function updateDelayUI() {
  const fps = 1000 / state.delay;
  el.delay.value = String(state.delay);
  el.delayVal.textContent = `${state.delay} ms · ${fps.toFixed(fps >= 10 ? 0 : 1)} fps`;
  $$('.chip', el.fpsPresets).forEach((chip) => {
    chip.classList.toggle('active', Math.abs(fps - Number(chip.dataset.fps)) < 0.8);
  });
}

function setDelay(ms) {
  state.delay = clamp(Math.round(ms), 20, 600);
  updateDelayUI();
  updateMeta();
  markDirty();
}

/* ---------- Frames ---------- */

function renderFrames() {
  el.frameCount.textContent = String(state.frames.length);
  el.emptyFrames.hidden = state.frames.length > 0;
  el.reverseBtn.disabled = state.frames.length < 2;
  el.clearBtn.disabled = state.frames.length === 0;
  el.frameCount.hidden = state.frames.length === 0;

  el.frames.innerHTML = '';

  state.frames.forEach((frame, index) => {
    const card = document.createElement('div');
    card.className = 'frame-card';
    card.draggable = true;
    card.dataset.id = String(frame.id);

    const thumb = document.createElement('div');
    thumb.className = 'frame-thumb';

    const img = document.createElement('img');
    img.src = frame.url;
    img.alt = frame.name;
    img.draggable = false;
    img.loading = 'lazy';

    const idx = document.createElement('span');
    idx.className = 'frame-idx';
    idx.textContent = String(index + 1).padStart(2, '0');

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'frame-remove';
    remove.dataset.remove = 'true';
    remove.title = `Remove ${frame.name}`;
    remove.setAttribute('aria-label', `Remove ${frame.name}`);
    remove.textContent = '×';

    thumb.append(img, idx, remove);

    const info = document.createElement('div');
    info.className = 'frame-info';

    const name = document.createElement('span');
    name.className = 'frame-name';
    name.textContent = frame.name;
    name.title = `${frame.name} · ${frame.width}×${frame.height}`;

    const moves = document.createElement('div');
    moves.className = 'frame-moves';

    const left = document.createElement('button');
    left.type = 'button';
    left.className = 'move-btn';
    left.dataset.move = '-1';
    left.textContent = '‹';
    left.title = 'Move earlier';
    left.setAttribute('aria-label', `Move ${frame.name} earlier`);
    left.disabled = index === 0;

    const right = document.createElement('button');
    right.type = 'button';
    right.className = 'move-btn';
    right.dataset.move = '1';
    right.textContent = '›';
    right.title = 'Move later';
    right.setAttribute('aria-label', `Move ${frame.name} later`);
    right.disabled = index === state.frames.length - 1;

    moves.append(left, right);
    info.append(name, moves);
    card.append(thumb, info);
    el.frames.appendChild(card);
  });

  el.makeBtn.disabled = state.frames.length === 0 || state.encoding;
  el.playBtn.disabled = state.frames.length < 2;
  el.scrub.disabled = state.frames.length < 2;
}

function moveFrame(id, direction) {
  const index = state.frames.findIndex((frame) => String(frame.id) === String(id));
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.frames.length) return;

  const currentId = state.frames[state.current] ? state.frames[state.current].id : null;
  [state.frames[index], state.frames[target]] = [state.frames[target], state.frames[index]];
  if (currentId !== null) {
    state.current = Math.max(0, state.frames.findIndex((frame) => frame.id === currentId));
  }
  renderFrames();
  updateMeta();
  drawPreview();
  markDirty();
}

function removeFrame(id) {
  const index = state.frames.findIndex((frame) => String(frame.id) === String(id));
  if (index < 0) return;

  const [removed] = state.frames.splice(index, 1);
  if (removed.revoke) URL.revokeObjectURL(removed.url);

  if (state.current >= state.frames.length) {
    state.current = Math.max(0, state.frames.length - 1);
  }

  afterFramesChanged();
}

function afterFramesChanged() {
  state.current = clamp(state.current, 0, Math.max(0, state.frames.length - 1));
  renderFrames();
  updateMeta();
  updateScrub();
  drawPreview();
  markDirty();

  if (state.frames.length >= 2 && !state.encoding) {
    startAnimation();
  } else {
    stopAnimation();
    updatePlayButton();
  }
}

async function handleFiles(fileList) {
  if (state.encoding) {
    toast('Wait for the current GIF to finish encoding.', true);
    return;
  }

  const files = Array.from(fileList).filter((file) => (
    (file.type && file.type.startsWith('image/')) ||
    /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)
  ));

  if (!files.length) {
    toast('Please drop image files (PNG, JPG, WebP, GIF).', true);
    return;
  }

  const room = MAX_FRAMES - state.frames.length;
  if (room <= 0) {
    toast(`Frame limit reached — ${MAX_FRAMES} max.`, true);
    return;
  }

  const accepted = files.slice(0, room);
  if (accepted.length < files.length) {
    toast(`Only ${room} more frame${room === 1 ? '' : 's'} could be added.`, true);
  }

  showDropLoading(true);
  const loaded = [];

  for (const file of accepted) {
    if (file.size > 40 * 1024 * 1024) {
      toast(`${file.name} is too large and was skipped.`, true);
      continue;
    }

    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      loaded.push({
        id: ++uid,
        name: file.name,
        url,
        img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        revoke: true
      });
    } catch (error) {
      URL.revokeObjectURL(url);
      toast(`Couldn't load ${file.name}.`, true);
    }
  }

  showDropLoading(false);
  if (!loaded.length) return;

  loaded.sort((a, b) => naturalCompare(a.name, b.name));
  state.frames.push(...loaded);
  afterFramesChanged();
  toast(`${loaded.length} frame${loaded.length === 1 ? '' : 's'} added.`);
}

/* ---------- Preview ---------- */

function updateScrub() {
  const total = state.frames.length;
  el.scrub.max = String(Math.max(0, total - 1));
  el.scrub.value = String(clamp(state.current, 0, Math.max(0, total - 1)));
  el.frameLabel.textContent = `${total ? state.current + 1 : 0} / ${total}`;
}

function drawPreview() {
  const out = computeOutput();
  if (!out || !state.frames.length) {
    el.previewCanvas.classList.add('hidden');
    el.previewEmpty.hidden = false;
    updateScrub();
    return;
  }

  el.previewCanvas.classList.remove('hidden');
  el.previewEmpty.hidden = true;

  const previewScale = Math.min(1, PREVIEW_MAX / Math.max(out.width, out.height));
  const canvasW = Math.max(1, Math.round(out.width * previewScale));
  const canvasH = Math.max(1, Math.round(out.height * previewScale));

  if (el.previewCanvas.width !== canvasW) el.previewCanvas.width = canvasW;
  if (el.previewCanvas.height !== canvasH) el.previewCanvas.height = canvasH;

  const ctx = el.previewCanvas.getContext('2d');
  ctx.clearRect(0, 0, canvasW, canvasH);

  if (state.bg !== 'transparent') {
    ctx.fillStyle = state.bg;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  const frame = frameAt(state.current);
  if (!frame) return;

  const scale = Math.min(canvasW / frame.width, canvasH / frame.height);
  const width = frame.width * scale;
  const height = frame.height * scale;
  ctx.drawImage(frame.img, (canvasW - width) / 2, (canvasH - height) / 2, width, height);
  updateScrub();
}

function updatePlayButton() {
  el.playBtn.classList.toggle('paused', !state.playing);
  el.playBtn.setAttribute('aria-label', state.playing ? 'Pause preview' : 'Play preview');
}

function stopAnimation() {
  if (animId) cancelAnimationFrame(animId);
  animId = 0;
  state.playing = false;
}

function startAnimation() {
  stopAnimation();
  if (state.frames.length < 2) {
    updatePlayButton();
    drawPreview();
    return;
  }

  state.playing = true;
  lastTick = performance.now();
  updatePlayButton();

  const tick = (now) => {
    if (!state.playing) return;
    const elapsed = now - lastTick;
    if (elapsed >= state.delay) {
      const steps = Math.max(1, Math.floor(elapsed / state.delay));
      state.current = (state.current + steps) % state.frames.length;
      lastTick += steps * state.delay;
      drawPreview();
    }
    animId = requestAnimationFrame(tick);
  };

  animId = requestAnimationFrame(tick);
}

function togglePlay() {
  if (state.frames.length < 2) return;
  if (state.playing) {
    stopAnimation();
    updatePlayButton();
  } else {
    startAnimation();
  }
}

/* ---------- Background ---------- */

function setBackground(color, activeElement) {
  state.bg = color;
  $$('.swatch', el.bgSwatches).forEach((swatch) => swatch.classList.toggle('active', swatch === activeElement));
  el.previewStage.classList.toggle('solid', color !== 'transparent');
  if (color === 'transparent') {
    el.previewStage.style.backgroundColor = '';
  } else {
    el.previewStage.style.backgroundColor = color;
  }
  drawPreview();
  markDirty();
}

/* ---------- GIF encoding ---------- */

function drawEncodeFrame(ctx, canvasW, canvasH, frame, scale) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  if (state.bg !== 'transparent') {
    ctx.fillStyle = state.bg;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  const width = Math.max(1, Math.round(frame.width * scale));
  const height = Math.max(1, Math.round(frame.height * scale));
  const x = Math.round((canvasW - width) / 2);
  const y = Math.round((canvasH - height) / 2);
  ctx.drawImage(frame.img, x, y, width, height);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function finishEncoding() {
  state.encoding = false;
  el.makeBtn.disabled = state.frames.length === 0;
  if (state.frames.length >= 2) startAnimation();
}

function failEncoding(error) {
  state.encoding = false;
  el.makeBtn.disabled = state.frames.length === 0;
  el.progressWrap.hidden = true;
  console.error(error);
  toast(`Could not create the GIF: ${error.message || error}`, true);
  if (state.frames.length >= 2) startAnimation();
}

async function createGif() {
  if (state.encoding || !state.frames.length) return;

  const out = computeOutput();
  if (!out) return;

  state.encoding = true;
  state.jobId += 1;
  const jobId = state.jobId;

  el.makeBtn.disabled = true;
  el.progressWrap.hidden = false;
  el.resultBox.hidden = true;
  setProgress(0.01, 'Preparing frames…');
  stopAnimation();
  updatePlayButton();

  try {
    const canvas = document.createElement('canvas');
    canvas.width = out.width;
    canvas.height = out.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const frames = [];
    for (let i = 0; i < state.frames.length; i++) {
      drawEncodeFrame(ctx, out.width, out.height, state.frames[i], out.scale);
      const data = ctx.getImageData(0, 0, out.width, out.height).data;
      frames.push({ buffer: data.buffer });

      if (i % 4 === 0 || i === state.frames.length - 1) {
        setProgress(0.03 + ((i + 1) / state.frames.length) * 0.12, 'Preparing frames…');
        await nextFrame();
      }
    }

    setProgress(0.16, 'Encoding GIF…');

    const worker = new Worker('assets/gif-worker.js', { type: 'module' });

    worker.onmessage = (event) => {
      if (jobId !== state.jobId) {
        worker.terminate();
        return;
      }

      const message = event.data;
      if (message.type === 'progress') {
        const progress = 0.16 + message.progress * 0.84;
        setProgress(progress, `Encoding GIF… ${Math.round(message.progress * 100)}%`);
      } else if (message.type === 'done') {
        const blob = new Blob([message.buffer], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);

        if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
        state.resultUrl = url;

        el.resultImg.src = url;
        el.downloadBtn.href = url;
        el.downloadBtn.download = `gifforge-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.gif`;
        el.resultSize.textContent = `${formatBytes(blob.size)} · ${out.width}×${out.height}`;
        el.resultBox.hidden = false;
        setProgress(1, 'GIF ready!');

        worker.terminate();
        finishEncoding();
        toast(`GIF created — ${formatBytes(blob.size)}.`);

        window.setTimeout(() => {
          if (jobId === state.jobId && !state.encoding) el.progressWrap.hidden = true;
        }, 1100);

        el.resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (message.type === 'error') {
        worker.terminate();
        failEncoding(new Error(message.message));
      }
    };

    worker.onerror = (event) => {
      worker.terminate();
      failEncoding(new Error(event.message || 'The encoding worker failed to start.'));
    };

    const payload = {
      frames,
      width: out.width,
      height: out.height,
      delay: state.delay,
      loop: state.loop,
      colors: state.colors,
      transparent: state.bg === 'transparent'
    };

    worker.postMessage(payload, frames.map((frame) => frame.buffer));
  } catch (error) {
    failEncoding(error);
  }
}

/* ---------- Events ---------- */

el.fileInput.addEventListener('change', () => {
  if (el.fileInput.files && el.fileInput.files.length) {
    handleFiles(el.fileInput.files);
  }
  el.fileInput.value = '';
});

el.browseBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  el.fileInput.click();
});

el.dropzone.addEventListener('click', (event) => {
  if (event.target.closest('button') || event.target.closest('input')) return;
  el.fileInput.click();
});

el.dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    el.fileInput.click();
  }
});

let dragDepth = 0;

el.dropzone.addEventListener('dragenter', (event) => {
  event.preventDefault();
  dragDepth += 1;
  el.dropzone.classList.add('dragging');
});

el.dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
});

el.dropzone.addEventListener('dragleave', (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) el.dropzone.classList.remove('dragging');
});

el.dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  el.dropzone.classList.remove('dragging');
  if (event.dataTransfer && event.dataTransfer.files.length) {
    handleFiles(event.dataTransfer.files);
  }
});

el.frames.addEventListener('dragover', (event) => {
  if (dragId) return;
  if (event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files')) {
    event.preventDefault();
  }
});

el.frames.addEventListener('drop', (event) => {
  if (dragId) return;
  if (event.dataTransfer && event.dataTransfer.files.length) {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  }
});

el.frames.addEventListener('click', (event) => {
  const card = event.target.closest('.frame-card');
  if (!card) return;

  if (event.target.closest('[data-remove]')) {
    removeFrame(card.dataset.id);
    return;
  }

  const move = event.target.closest('[data-move]');
  if (move) {
    moveFrame(card.dataset.id, Number(move.dataset.move));
  }
});

el.frames.addEventListener('dragstart', (event) => {
  const card = event.target.closest('.frame-card');
  if (!card) return;
  dragId = card.dataset.id;
  card.classList.add('dragging');
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    try {
      event.dataTransfer.setData('text/plain', dragId);
    } catch (error) {
      /* some browsers restrict data on dragstart */
    }
  }
});

el.frames.addEventListener('dragover', (event) => {
  if (!dragId) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

  const dragging = el.frames.querySelector('.frame-card.dragging');
  if (!dragging) return;

  const target = document.elementFromPoint(event.clientX, event.clientY);
  const card = target && target.closest ? target.closest('.frame-card') : null;
  if (!card || card === dragging) return;

  const rect = card.getBoundingClientRect();
  const before = event.clientX < rect.left + rect.width / 2;
  el.frames.insertBefore(dragging, before ? card : card.nextSibling);
});

function commitOrder() {
  if (!dragId) return;

  const currentId = state.frames[state.current] ? state.frames[state.current].id : null;
  const byId = new Map(state.frames.map((frame) => [String(frame.id), frame]));
  const ordered = $$('.frame-card', el.frames)
    .map((card) => byId.get(card.dataset.id))
    .filter(Boolean);

  if (ordered.length === state.frames.length) {
    state.frames = ordered;
    if (currentId !== null) {
      state.current = Math.max(0, state.frames.findIndex((frame) => frame.id === currentId));
    }
  }

  dragId = null;
  const dragging = el.frames.querySelector('.dragging');
  if (dragging) dragging.classList.remove('dragging');

  renderFrames();
  updateMeta();
  drawPreview();
  markDirty();
}

el.frames.addEventListener('drop', (event) => {
  if (!dragId) return;
  event.preventDefault();
  commitOrder();
});

el.frames.addEventListener('dragend', () => {
  if (dragId) commitOrder();
});

el.reverseBtn.addEventListener('click', () => {
  state.frames.reverse();
  state.current = state.frames.length ? state.frames.length - 1 - state.current : 0;
  renderFrames();
  updateMeta();
  drawPreview();
  markDirty();
  toast('Frame order reversed.');
});

el.clearBtn.addEventListener('click', () => {
  if (!state.frames.length) return;
  if (!window.confirm('Remove all frames? This cannot be undone.')) return;

  state.frames.forEach((frame) => {
    if (frame.revoke) URL.revokeObjectURL(frame.url);
  });
  state.frames = [];
  state.current = 0;
  stopAnimation();
  afterFramesChanged();
});

el.playBtn.addEventListener('click', togglePlay);

el.scrub.addEventListener('input', () => {
  state.current = clamp(Number(el.scrub.value), 0, Math.max(0, state.frames.length - 1));
  if (state.playing) {
    stopAnimation();
    updatePlayButton();
  }
  drawPreview();
});

el.delay.addEventListener('input', () => {
  setDelay(Number(el.delay.value));
});

el.fpsPresets.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  setDelay(Math.round(1000 / Number(chip.dataset.fps)));
});

el.loop.addEventListener('change', () => {
  state.loop = Number(el.loop.value);
  markDirty();
});

el.maxWidth.addEventListener('change', () => {
  state.maxWidth = Number(el.maxWidth.value);
  updateMeta();
  drawPreview();
  markDirty();
});

el.quality.addEventListener('change', () => {
  state.colors = Number(el.quality.value);
  markDirty();
});

el.bgSwatches.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-bg]');
  if (!button) return;
  setBackground(button.dataset.bg, button);
});

el.customBg.addEventListener('input', () => {
  el.customDot.style.background = el.customBg.value;
  setBackground(el.customBg.value, el.customBg.closest('.swatch'));
});

el.makeBtn.addEventListener('click', createGif);

/* ---------- Boot ---------- */

updateDelayUI();
updateMeta();
drawPreview();
updatePlayButton();

window.addEventListener('beforeunload', () => {
  state.frames.forEach((frame) => {
    if (frame.revoke) URL.revokeObjectURL(frame.url);
  });
});
