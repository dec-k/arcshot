// @vitest-environment node
import { describe, it, expect } from "vitest";
import { bootEditor, fakeImageReady, flush, makeBrowserMock } from "./helpers.js";

describe("gradient change", () => {
  it("recomputes the stage gradient when the hue slider moves", async () => {
    const { window, browserMock } = await bootEditor();
    const stage = window.document.getElementById("stage");
    const hue = window.document.getElementById("hue");
    const swatch = window.document.getElementById("swatch");

    const before = stage.style.backgroundImage;
    const swatchBefore = swatch.style.background;

    hue.value = "200";
    hue.dispatchEvent(new window.Event("input", { bubbles: true }));
    await flush();

    expect(stage.style.backgroundImage).toMatch(/^linear-gradient\(135deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/i);
    expect(stage.style.backgroundImage).not.toBe(before);
    expect(swatch.style.background).not.toBe(swatchBefore);

    // Settings are persisted so the gradient survives reopening the popup.
    expect(browserMock.storage.local.set).toHaveBeenCalled();
    const lastCall = browserMock.storage.local.set.mock.calls.at(-1)[0];
    expect(lastCall.editorSettings.bgColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("restores a previously saved hue from storage on load", async () => {
    const { window } = await bootEditor({
      browserMock: makeBrowserMockWith({ bgColor: "#00ff00" }),
    });
    const hue = window.document.getElementById("hue");
    // 120 == pure green
    expect(Number(hue.value)).toBe(120);
  });
});

describe("background image change", () => {
  it("switches the stage to use the dropped image and reveals clear button", async () => {
    const { window, browserMock } = await bootEditor();
    const stage = window.document.getElementById("stage");
    const clearBtn = window.document.getElementById("clear-image");

    const imageDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";
    const file = new window.File(["x"], "bg.png", { type: "image/png" });

    // jsdom's FileReader returns the literal text, not a base64 data URL, so stub it.
    stubFileReader(window, imageDataUrl);

    const dt = makeDataTransfer(window, [file]);
    stage.dispatchEvent(makeDropEvent(window, dt));
    await flush();
    await flush();

    expect(stage.style.backgroundImage).toContain(imageDataUrl);
    expect(clearBtn.hidden).toBe(false);
    expect(browserMock.storage.local.set).toHaveBeenCalled();
  });

  it("clears the background image and falls back to gradient when × is clicked", async () => {
    // Start with a saved bg image so we can clear it.
    const browserMock = makeBrowserMockWith({
      bgColor: "#ff8a7a",
      bgImage: "data:image/png;base64,AAA",
    });
    const window = await bootWithImageReady(browserMock);

    const stage = window.document.getElementById("stage");
    const clearBtn = window.document.getElementById("clear-image");

    expect(clearBtn.hidden).toBe(false);
    expect(stage.style.backgroundImage).toContain("data:image/png");

    clearBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
    await flush();
    await flush();

    expect(clearBtn.hidden).toBe(true);
    expect(stage.style.backgroundImage).toMatch(/^linear-gradient\(/);
  });
});

describe("copy to clipboard", () => {
  it("renders the framed PNG and writes it to the clipboard", async () => {
    const { window, clipboardWrite } = await bootEditor();
    fakeImageReady(window);

    const copyBtn = window.document.getElementById("copy");
    copyBtn.dispatchEvent(new window.Event("click", { bubbles: true }));

    // toBlob defers via setTimeout, plus a microtask for await.
    await flush();
    await flush();
    await flush();

    expect(clipboardWrite).toHaveBeenCalledOnce();
    const items = clipboardWrite.mock.calls[0][0];
    expect(Array.isArray(items)).toBe(true);
    expect(items[0].types).toContain("image/png");
    expect(copyBtn.textContent).toBe("Copied!");
    expect(copyBtn.disabled).toBe(true);
  });

});

describe("download", () => {
  it("creates an anchor with a PNG download attribute and clicks it", async () => {
    const { window } = await bootEditor();
    fakeImageReady(window);

    const originalCreate = window.document.createElement.bind(window.document);
    const anchorClicks = [];
    let capturedAnchor;
    window.document.createElement = function (tag) {
      const el = originalCreate(tag);
      if (tag === "a") {
        capturedAnchor = el;
        el.click = () => anchorClicks.push({ href: el.href, download: el.download });
      }
      return el;
    };

    const downloadBtn = window.document.getElementById("download");
    downloadBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
    await flush();
    await flush();
    await flush();

    expect(anchorClicks).toHaveLength(1);
    expect(anchorClicks[0].download).toMatch(/^screenshot-.*\.png$/);
    expect(anchorClicks[0].href).toBe("blob:mock-url");
    expect(window.URL.createObjectURL).toHaveBeenCalledOnce();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledOnce();
    expect(capturedAnchor.isConnected).toBe(false);
  });
});

// ---- helpers local to this file ----

function makeBrowserMockWith(settings) {
  return makeBrowserMock({ settings });
}

async function bootWithImageReady(browserMock) {
  const { window } = await bootEditor({ browserMock });
  await flush();
  return window;
}

function makeDataTransfer(window, files) {
  return {
    files,
    items: files.map((f) => ({ kind: "file", type: f.type, getAsFile: () => f })),
    types: ["Files"],
  };
}

function makeDropEvent(window, dataTransfer) {
  const e = new window.Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(e, "dataTransfer", { value: dataTransfer });
  return e;
}

function stubFileReader(window, returnDataUrl) {
  class StubReader {
    readAsDataURL(_file) {
      setTimeout(() => {
        this.result = returnDataUrl;
        if (typeof this.onload === "function") this.onload({ target: this });
      }, 0);
    }
  }
  window.FileReader = StubReader;
}

