const BASE_PADDING_PX = 128;
const BG_SIZE_SCALE = { thin: 0.5, standard: 1, large: 1.5 };
const CORNER_RADIUS = 32;
const BORDER_WIDTH = 12;
const BORDER_COLOR = "rgba(255, 255, 255, 0.35)";
const SETTINGS_KEY = "editorSettings";
const APP_SETTINGS_KEY = "appSettings";
const api = typeof browser !== "undefined" ? browser : chrome;

const stage = document.getElementById("stage");
const img = document.getElementById("screenshot");
const swatch = document.getElementById("swatch");
const hue = document.getElementById("hue");
const modeToggle = document.getElementById("mode-toggle");
const modeGradientBtn = document.getElementById("mode-gradient");
const modeImageBtn = document.getElementById("mode-image");
const settingsBtn = document.getElementById("settings-btn");
const copyBtn = document.getElementById("copy");
const downloadBtn = document.getElementById("download");
const status = document.getElementById("status");

let bgColor = "#ff8a7a";
let bgImageDataUrl = null;
let bgImageEl = null;
let bgSize = "standard";
let bgMode = "gradient";

function paddingPx() {
  return Math.round(BASE_PADDING_PX * (BG_SIZE_SCALE[bgSize] ?? 1));
}

function applyBgSizeToPreview() {
  const scale = BG_SIZE_SCALE[bgSize] ?? 1;
  stage.style.padding = `${Math.round(18 * scale)}px`;
}

function effectiveMode() {
  return bgImageDataUrl && bgMode === "image" ? "image" : "gradient";
}

async function init() {
  const { [SETTINGS_KEY]: settings, [APP_SETTINGS_KEY]: appSettings } =
    await api.storage.local.get([SETTINGS_KEY, APP_SETTINGS_KEY]);

  if (appSettings?.bgSize && BG_SIZE_SCALE[appSettings.bgSize]) {
    bgSize = appSettings.bgSize;
  }
  applyBgSizeToPreview();

  if (settings?.bgColor) {
    bgColor = settings.bgColor;
    hue.value = Math.round(rgbToHue(bgColor));
  } else {
    bgColor = hslToHex(Number(hue.value), 85, 65);
  }
  if (settings?.bgMode === "image" || settings?.bgMode === "gradient") {
    bgMode = settings.bgMode;
  }
  if (appSettings?.bgImage) {
    try {
      await setBgImage(appSettings.bgImage);
    } catch (err) {
      console.error("Failed to load saved background image", err);
    }
  }
  renderModeToggle();
  applyBackground();

  try {
    const dataUrl = await api.tabs.captureVisibleTab(undefined, { format: "png" });
    img.src = dataUrl;
  } catch (err) {
    console.error("Capture failed", err);
    showStatus("Couldn't capture this tab.");
  }
}

function gradientStops() {
  const h = rgbToHue(bgColor);
  return {
    start: hslToHex((h - 18 + 360) % 360, 90, 74),
    end: hslToHex((h + 28) % 360, 88, 58),
  };
}

function applyBackground() {
  swatch.style.background = bgColor;
  if (effectiveMode() === "image") {
    stage.style.backgroundColor = "";
    stage.style.backgroundImage = `url("${bgImageDataUrl}")`;
  } else {
    const { start, end } = gradientStops();
    stage.style.backgroundColor = bgColor;
    stage.style.backgroundImage = `linear-gradient(135deg, ${start}, ${end})`;
  }
}

function renderModeToggle() {
  const hasImage = !!bgImageDataUrl;
  modeToggle.hidden = !hasImage;
  const active = effectiveMode();
  modeGradientBtn.classList.toggle("active", active === "gradient");
  modeImageBtn.classList.toggle("active", active === "image");
  modeGradientBtn.setAttribute("aria-selected", String(active === "gradient"));
  modeImageBtn.setAttribute("aria-selected", String(active === "image"));
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

async function saveSettings() {
  await api.storage.local.set({
    [SETTINGS_KEY]: { bgColor, bgMode },
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

  const pad = paddingPx();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth + pad * 2;
  canvas.height = img.naturalHeight + pad * 2;

  const ctx = canvas.getContext("2d");
  if (effectiveMode() === "image" && bgImageEl) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawCover(ctx, bgImageEl, 0, 0, canvas.width, canvas.height);
  } else {
    const { start, end } = gradientStops();
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, start);
    grad.addColorStop(1, end);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const x = pad;
  const y = pad;
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

function setMode(mode) {
  if (mode !== "gradient" && mode !== "image") return;
  if (mode === "image" && !bgImageDataUrl) return;
  bgMode = mode;
  renderModeToggle();
  applyBackground();
  saveSettings();
}

modeGradientBtn.addEventListener("click", () => setMode("gradient"));
modeImageBtn.addEventListener("click", () => setMode("image"));

settingsBtn.addEventListener("click", () => {
  if (api.runtime?.openOptionsPage) {
    api.runtime.openOptionsPage();
    window.close();
  }
});

api.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  const next = changes[APP_SETTINGS_KEY]?.newValue;
  if (!next) return;
  if (next.bgSize && BG_SIZE_SCALE[next.bgSize] && next.bgSize !== bgSize) {
    bgSize = next.bgSize;
    applyBgSizeToPreview();
  }
  if (next.bgImage !== undefined && next.bgImage !== bgImageDataUrl) {
    if (next.bgImage) {
      try {
        await setBgImage(next.bgImage);
      } catch (err) {
        console.error("Failed to load updated background image", err);
      }
    } else {
      bgImageDataUrl = null;
      bgImageEl = null;
    }
    renderModeToggle();
    applyBackground();
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
