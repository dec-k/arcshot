browser.action.onClicked.addListener(async (tab) => {
  const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  await browser.storage.local.set({ lastCapture: { dataUrl, capturedAt: Date.now() } });
  await browser.tabs.create({ url: browser.runtime.getURL("editor.html") });
});
