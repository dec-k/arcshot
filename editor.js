const PADDING_PX = 96;
const SETTINGS_KEY = "editorSettings";

const stage = document.getElementById("stage");
const img = document.getElementById("screenshot");
const bgColor = document.getElementById("bg-color");
const bgImageInput = document.getElementById("bg-image");
const imageBtn = document.getElementById("image-btn");
const clearImageBtn = document.getElementById("clear-image");
const copyBtn = document.getElementById("copy");
const downloadBtn = document.getElementById("download");

let bgImageDataUrl = null;
let bgImageEl = null;

async function init() {
  const { lastCapture, [SETTINGS_KEY]: settings } = await browser.storage.local.get([
    "lastCapture",
    SETTINGS_KEY,
  ]);

  if (settings?.bgColor) bgColor.value = settings.bgColor;
  if (settings?.bgImage) {
    try {
      await setBgImage(settings.bgImage);
    } catch (err) {
      console.error("Failed to load saved background image", err);
    }
  }
  applyBackground();

  if (lastCapture?.dataUrl) {
    img.src = lastCapture.dataUrl;
  }
}

function applyBackground() {
  stage.style.backgroundColor = bgColor.value;
  stage.style.backgroundImage = bgImageDataUrl ? `url("${bgImageDataUrl}")` : "";
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
  await browser.storage.local.set({
    [SETTINGS_KEY]: {
      bgColor: bgColor.value,
      bgImage: bgImageDataUrl,
    },
  });
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
  ctx.fillStyle = bgColor.value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (bgImageEl) {
    drawCover(ctx, bgImageEl, 0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, PADDING_PX, PADDING_PX);

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

bgColor.addEventListener("input", () => {
  applyBackground();
  saveSettings();
});

imageBtn.addEventListener("click", () => bgImageInput.click());

bgImageInput.addEventListener("change", async () => {
  const file = bgImageInput.files?.[0];
  bgImageInput.value = "";
  if (!file) return;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    await setBgImage(dataUrl);
    applyBackground();
    await saveSettings();
  } catch (err) {
    console.error("Failed to set background image", err);
    flashButton(imageBtn, "Image failed");
  }
});

clearImageBtn.addEventListener("click", async () => {
  bgImageDataUrl = null;
  bgImageEl = null;
  applyBackground();
  await saveSettings();
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
