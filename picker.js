const SETTINGS_KEY = "editorSettings";
const api = typeof browser !== "undefined" ? browser : chrome;

const pickBtn = document.getElementById("pick");
const fileInput = document.getElementById("file");
const status = document.getElementById("status");

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

pickBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  status.textContent = "Saving…";
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const { [SETTINGS_KEY]: settings = {} } = await api.storage.local.get([SETTINGS_KEY]);
    settings.bgImage = dataUrl;
    await api.storage.local.set({ [SETTINGS_KEY]: settings });
    status.textContent = "Saved — closing…";
    setTimeout(() => window.close(), 300);
  } catch (err) {
    console.error(err);
    status.textContent = "Failed to save image.";
  }
});

// Auto-open picker on first load for a one-click flow.
window.addEventListener("load", () => pickBtn.click());
