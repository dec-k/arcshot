const PADDING_PX = 128;
const CORNER_RADIUS = 16;
const BORDER_WIDTH = 1;
const BORDER_COLOR = "rgba(255, 255, 255, 0.6)";
const SETTINGS_KEY = "editorSettings";
const api = typeof browser !== "undefined" ? browser : chrome;

const stage = document.getElementById("stage");
const img = document.getElementById("screenshot");
const swatch = document.getElementById("swatch");
const hue = document.getElementById("hue");
const imageBtn = document.getElementById("image-btn");
const clearImageBtn = document.getElementById("clear-image");
const copyBtn = document.getElementById("copy");
const downloadBtn = document.getElementById("download");
const status = document.getElementById("status");

let bgColor = "#ff8a7a";
let bgImageDataUrl = null;
let bgImageEl = null;

async function init() {
  const { [SETTINGS_KEY]: settings } = await api.storage.local.get([SETTINGS_KEY]);

  if (settings?.bgColor) {
    bgColor = settings.bgColor;
    hue.value = Math.round(rgbToHue(bgColor));
  } else {
    bgColor = hslToHex(Number(hue.value), 85, 65);
  }
  if (settings?.bgImage) {
    try {
      await setBgImage(settings.bgImage);
    } catch (err) {
      console.error("Failed to load saved background image", err);
    }
  }
  applyBackground();

  try {
    const dataUrl = await api.tabs.captureVisibleTab(undefined, { format: "png" });
    img.src = dataUrl;
  } catch (err) {
    console.error("Capture failed", err);
    showStatus("Couldn't capture this tab.");
  }
}

function applyBackground() {
  swatch.style.background = bgColor;
  if (bgImageDataUrl) {
    stage.style.backgroundColor = "";
    stage.style.backgroundImage = `url("${bgImageDataUrl}")`;
  } else {
    stage.style.backgroundColor = bgColor;
    stage.style.backgroundImage = "none";
  }
  clearImageBtn.hidden = !bgImageDataUrl;
}

async function setBgImage(dataUrl) {
  bgImageEl = await loadImage(dataUrl);
  bgImageDataUrl = dataUrl;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Image failed to load"));
    el.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function saveSettings() {
  await api.storage.local.set({
    [SETTINGS_KEY]: { bgColor, bgImage: bgImageDataUrl },
  });
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function rgbToHue(hex) {
  const m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  if (!m) return 0;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

function drawCover(ctx, image, dx, dy, dw, dh) {
  const imgRatio = image.naturalWidth / image.naturalHeight;
  const dstRatio = dw / dh;
  let sx, sy, sw, sh;
  if (imgRatio > dstRatio) {
    sh = image.naturalHeight;
    sw = sh * dstRatio;
    sx = (image.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = image.naturalWidth;
    sh = sw / dstRatio;
    sx = 0;
    sy = (image.naturalHeight - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
}

async function renderToBlob() {
  if (!img.complete || !img.naturalWidth) return null;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth + PADDING_PX * 2;
  canvas.height = img.naturalHeight + PADDING_PX * 2;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (bgImageEl) {
    drawCover(ctx, bgImageEl, 0, 0, canvas.width, canvas.height);
  }

  const x = PADDING_PX;
  const y = PADDING_PX;
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, CORNER_RADIUS);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, CORNER_RADIUS);
  ctx.clip();
  ctx.drawImage(img, x, y);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + BORDER_WIDTH / 2, y + BORDER_WIDTH / 2, w - BORDER_WIDTH, h - BORDER_WIDTH, CORNER_RADIUS);
  ctx.strokeStyle = BORDER_COLOR;
  ctx.lineWidth = BORDER_WIDTH;
  ctx.stroke();
  ctx.restore();

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function flashButton(btn, text, ms = 1200) {
  const original = btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, ms);
}

function showStatus(msg, ms = 0) {
  status.textContent = msg;
  status.hidden = false;
  if (ms) setTimeout(() => { status.hidden = true; }, ms);
}

hue.addEventListener("input", () => {
  bgColor = hslToHex(Number(hue.value), 85, 65);
  applyBackground();
  saveSettings();
});

imageBtn.addEventListener("click", async () => {
  // Native file pickers close extension popups, so open the picker in a
  // detached extension window that survives the OS file dialog.
  try {
    await api.windows.create({
      url: api.runtime.getURL("picker.html"),
      type: "popup",
      width: 420,
      height: 240,
    });
    window.close();
  } catch (err) {
    console.error("Couldn't open picker window", err);
    showStatus("Couldn't open image picker.");
  }
});

clearImageBtn.addEventListener("click", async () => {
  bgImageDataUrl = null;
  bgImageEl = null;
  applyBackground();
  await saveSettings();
});

// Drag-and-drop onto the preview as an inline alternative to the picker.
stage.addEventListener("dragover", (e) => {
  e.preventDefault();
  stage.classList.add("drop-active");
});
stage.addEventListener("dragleave", () => stage.classList.remove("drop-active"));
stage.addEventListener("drop", async (e) => {
  e.preventDefault();
  stage.classList.remove("drop-active");
  const file = e.dataTransfer?.files?.[0];
  if (!file || !file.type.startsWith("image/")) return;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    await setBgImage(dataUrl);
    applyBackground();
    await saveSettings();
  } catch (err) {
    console.error("Failed to set background image", err);
  }
});

copyBtn.addEventListener("click", async () => {
  const blob = await renderToBlob();
  if (!blob) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    flashButton(copyBtn, "Copied!");
  } catch (err) {
    console.error("Clipboard write failed", err);
    flashButton(copyBtn, "Copy failed");
  }
});

downloadBtn.addEventListener("click", async () => {
  const blob = await renderToBlob();
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

init();
