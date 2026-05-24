const api = typeof browser !== "undefined" ? browser : chrome;
const PENDING_KEY = "pendingAction";

api.commands.onCommand.addListener(handleCommand);

async function handleCommand(command) {
  let action;
  if (command === "copy_screenshot") action = "copy";
  else if (command === "download_screenshot") action = "download";
  else return;

  await api.storage.local.set({ [PENDING_KEY]: { action, ts: Date.now() } });

  if (!api.action?.openPopup) {
    await api.storage.local.remove(PENDING_KEY);
    return;
  }

  try {
    await api.action.openPopup();
  } catch (err) {
    await api.storage.local.remove(PENDING_KEY);
    console.error("Arcshot: failed to open popup for hotkey", err);
  }
}
