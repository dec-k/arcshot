const APP_SETTINGS_KEY = "appSettings";
const DEFAULTS = { bgSize: "standard", bgImage: null };
const api = typeof browser !== "undefined" ? browser : chrome;
const COMMAND_LABELS = {
  _execute_action: "Open Arcshot",
  copy_screenshot: "Copy screen with Arcshot",
  download_screenshot: "Download screen with Arcshot",
};
const isFirefox = /Firefox\//.test(navigator.userAgent);

const status = document.getElementById("status");
const radios = document.querySelectorAll('input[name="bgSize"]');
const fileInput = document.getElementById("bg-image-file");
const chooseBtn = document.getElementById("bg-image-choose");
const clearBtn = document.getElementById("bg-image-clear");
const previewWrap = document.getElementById("bg-image-preview");
const previewImg = document.getElementById("bg-image-thumb");
const dropZone = document.getElementById("bg-image-drop");
const shortcutList = document.getElementById("shortcut-list");
const openShortcutsBtn = document.getElementById("open-shortcuts");
const shortcutHint = document.getElementById("shortcut-hint");

let current = { ...DEFAULTS };

async function load() {
  const { [APP_SETTINGS_KEY]: stored } = await api.storage.local.get([APP_SETTINGS_KEY]);
  current = { ...DEFAULTS, ...(stored || {}) };
  for (const radio of radios) {
    radio.checked = radio.value === current.bgSize;
  }
  renderBgImage();
}

function renderBgImage() {
  if (current.bgImage) {
    previewImg.src = current.bgImage;
    previewWrap.hidden = false;
    clearBtn.hidden = false;
  } else {
    previewImg.removeAttribute("src");
    previewWrap.hidden = true;
    clearBtn.hidden = true;
  }
}

async function persist(patch) {
  current = { ...current, ...patch };
  await api.storage.local.set({ [APP_SETTINGS_KEY]: current });
  showStatus("Saved.", 1200);
}

function showStatus(msg, ms = 0) {
  status.textContent = msg;
  status.hidden = false;
  if (ms) setTimeout(() => { status.hidden = true; }, ms);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    showStatus("Please choose an image file.", 2000);
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    await persist({ bgImage: dataUrl });
    renderBgImage();
  } catch (err) {
    console.error("Failed to read image", err);
    showStatus("Couldn't load that image.", 2000);
  }
}

for (const radio of radios) {
  radio.addEventListener("change", () => {
    if (radio.checked) persist({ bgSize: radio.value });
  });
}

chooseBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
  fileInput.value = "";
});

clearBtn.addEventListener("click", async () => {
  await persist({ bgImage: null });
  renderBgImage();
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drop-active");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drop-active"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drop-active");
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

async function loadShortcuts() {
  shortcutList.replaceChildren();
  if (!api.commands?.getAll) {
    const li = document.createElement("li");
    li.className = "shortcut-row";
    li.textContent = "Shortcuts aren't supported in this browser.";
    shortcutList.appendChild(li);
    openShortcutsBtn.hidden = true;
    return;
  }

  const commands = await api.commands.getAll();
  const ordered = Object.keys(COMMAND_LABELS)
    .map((name) => commands.find((c) => c.name === name))
    .filter(Boolean);
  const rest = commands.filter((c) => !COMMAND_LABELS[c.name]);
  for (const cmd of [...ordered, ...rest]) {
    const row = document.createElement("li");
    row.className = "shortcut-row";

    const name = document.createElement("span");
    name.className = "shortcut-name";
    name.textContent = COMMAND_LABELS[cmd.name] ?? cmd.description ?? cmd.name;

    const key = document.createElement("kbd");
    key.className = "shortcut-key";
    if (cmd.shortcut) {
      key.textContent = cmd.shortcut;
    } else {
      key.textContent = "Not set";
      key.classList.add("shortcut-key--unset");
    }

    row.appendChild(name);
    row.appendChild(key);
    shortcutList.appendChild(row);
  }
}

openShortcutsBtn.addEventListener("click", async () => {
  if (isFirefox) {
    shortcutHint.textContent =
      'Open about:addons in a new tab, click the gear icon, then choose "Manage Extension Shortcuts".';
    shortcutHint.hidden = false;
    return;
  }
  try {
    await api.tabs.create({ url: "chrome://extensions/shortcuts" });
  } catch (err) {
    console.error("Couldn't open shortcuts page", err);
    shortcutHint.textContent = "Open chrome://extensions/shortcuts in a new tab to customize.";
    shortcutHint.hidden = false;
  }
});

window.addEventListener("focus", () => {
  loadShortcuts();
});

load();
loadShortcuts();
