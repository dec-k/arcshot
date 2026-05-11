const PADDING_PX = 96;
const SETTINGS_KEY = "editorSettings";

const stage = document.getElementById("stage");
const img = document.getElementById("screenshot");
const bgColor = document.getElementById("bg-color");
const downloadBtn = document.getElementById("download");

async function init() {
  const { lastCapture, [SETTINGS_KEY]: settings } = await browser.storage.local.get([
    "lastCapture",
    SETTINGS_KEY,
  ]);

  if (settings?.bgColor) bgColor.value = settings.bgColor;
  applyBackground();

  if (lastCapture?.dataUrl) {
    img.src = lastCapture.dataUrl;
  }
}

function applyBackground() {
  stage.style.background = bgColor.value;
}

async function saveSettings() {
  await browser.storage.local.set({ [SETTINGS_KEY]: { bgColor: bgColor.value } });
}

bgColor.addEventListener("input", () => {
  applyBackground();
  saveSettings();
});

downloadBtn.addEventListener("click", async () => {
  if (!img.complete || !img.naturalWidth) return;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth + PADDING_PX * 2;
  canvas.height = img.naturalHeight + PADDING_PX * 2;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bgColor.value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, PADDING_PX, PADDING_PX);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
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
