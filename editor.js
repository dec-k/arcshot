const PADDING_PX = 128;
const CORNER_RADIUS = 32;
const BORDER_WIDTH = 12;
const BORDER_COLOR = "rgba(255, 255, 255, 0.35)";
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
    const { start, end } = gradientStops(bgColor);
    stage.style.backgroundColor = bgColor;
    stage.style.backgroundImage = `linear-gradient(135deg, ${start}, ${end})`;
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

async function renderToBlob() {
  if (!img.complete || !img.naturalWidth) return null;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth + PADDING_PX * 2;
  canvas.height = img.naturalHeight + PADDING_PX * 2;

  const ctx = canvas.getContext("2d");
  if (bgImageEl) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawCover(ctx, bgImageEl, 0, 0, canvas.width, canvas.height);
  } else {
    const { start, end } = gradientStops(bgColor);
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, start);
    grad.addColorStop(1, end);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const x = PADDING_PX;
  const y = PADDING_PX;
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const ox = x - BORDER_WIDTH;
  const oy = y - BORDER_WIDTH;
  const ow = w + BORDER_WIDTH * 2;
  const oh = h + BORDER_WIDTH * 2;
  const outerRadius = CORNER_RADIUS + BORDER_WIDTH;

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
  ctx.roundRect(ox, oy, ow, oh, outerRadius);
  ctx.roundRect(x, y, w, h, CORNER_RADIUS);
  ctx.fillStyle = BORDER_COLOR;
  ctx.fill("evenodd");
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
