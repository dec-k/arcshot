const APP_SETTINGS_KEY = "appSettings";
const DEFAULTS = { bgSize: "standard" };
const api = typeof browser !== "undefined" ? browser : chrome;

const status = document.getElementById("status");
const radios = document.querySelectorAll('input[name="bgSize"]');

async function load() {
  const { [APP_SETTINGS_KEY]: stored } = await api.storage.local.get([APP_SETTINGS_KEY]);
  const settings = { ...DEFAULTS, ...(stored || {}) };
  for (const radio of radios) {
    radio.checked = radio.value === settings.bgSize;
  }
}

async function save(bgSize) {
  const { [APP_SETTINGS_KEY]: stored } = await api.storage.local.get([APP_SETTINGS_KEY]);
  const next = { ...DEFAULTS, ...(stored || {}), bgSize };
  await api.storage.local.set({ [APP_SETTINGS_KEY]: next });
  showStatus("Saved.", 1200);
}

function showStatus(msg, ms = 0) {
  status.textContent = msg;
  status.hidden = false;
  if (ms) setTimeout(() => { status.hidden = true; }, ms);
}

for (const radio of radios) {
  radio.addEventListener("change", () => {
    if (radio.checked) save(radio.value);
  });
}

load();
