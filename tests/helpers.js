import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const LIB_JS = fs.readFileSync(path.join(ROOT, "lib.js"), "utf8");
const EDITOR_JS = fs.readFileSync(path.join(ROOT, "editor.js"), "utf8");
const EDITOR_HTML = fs.readFileSync(path.join(ROOT, "editor.html"), "utf8");

// 1x1 transparent PNG, useful as a dummy capture data URL.
export const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

export function makeBrowserMock({ settings = null, captureDataUrl = TINY_PNG } = {}) {
  const stored = settings ? { editorSettings: { ...settings } } : {};
  const api = {
    storage: {
      local: {
        get: vi.fn(async (keys) => {
          const out = {};
          const list = Array.isArray(keys) ? keys : [keys];
          for (const k of list) if (k in stored) out[k] = stored[k];
          return out;
        }),
        set: vi.fn(async (obj) => {
          Object.assign(stored, obj);
        }),
      },
    },
    tabs: {
      captureVisibleTab: vi.fn(async () => captureDataUrl),
    },
    windows: {
      create: vi.fn(async () => ({ id: 1 })),
    },
    runtime: {
      getURL: vi.fn((p) => `moz-extension://test/${p}`),
    },
  };
  api.__stored = stored;
  return api;
}

function makeFakeCtx() {
  return {
    fillStyle: null,
    shadowColor: null,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
  };
}

function installCanvasStub(window) {
  window.HTMLCanvasElement.prototype.getContext = vi.fn(() => makeFakeCtx());
  window.HTMLCanvasElement.prototype.toBlob = function (cb, type = "image/png") {
    const blob = new window.Blob(["fake-png-bytes"], { type });
    setTimeout(() => cb(blob), 0);
  };
}

function installClipboardStub(window) {
  const writeMock = vi.fn(async () => undefined);
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { write: writeMock, writeText: vi.fn(async () => undefined) },
  });
  window.ClipboardItem = function ClipboardItem(data) {
    this.types = Object.keys(data);
    this.data = data;
  };
  return writeMock;
}

function installUrlStub(window) {
  window.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  window.URL.revokeObjectURL = vi.fn();
}

// jsdom never fires `load` on <img>. Patch HTMLImageElement so any src assignment
// synchronously gives the image dimensions + fires onload on the next tick.
export function installImageLoadStub(window, { width = 800, height = 600 } = {}) {
  const proto = window.HTMLImageElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "src") ?? {
    get() { return this.getAttribute("src"); },
    set(v) { this.setAttribute("src", v); },
    configurable: true,
  };
  Object.defineProperty(proto, "src", {
    configurable: true,
    get: desc.get,
    set(v) {
      desc.set.call(this, v);
      Object.defineProperty(this, "naturalWidth", { configurable: true, value: width });
      Object.defineProperty(this, "naturalHeight", { configurable: true, value: height });
      Object.defineProperty(this, "complete", { configurable: true, value: true });
      setTimeout(() => {
        if (typeof this.onload === "function") this.onload(new window.Event("load"));
      }, 0);
    },
  });
}

// Pretend the loaded screenshot has real dimensions so renderToBlob proceeds.
export function fakeImageReady(window, { width = 800, height = 600 } = {}) {
  const img = window.document.getElementById("screenshot");
  Object.defineProperty(img, "complete", { configurable: true, value: true });
  Object.defineProperty(img, "naturalWidth", { configurable: true, value: width });
  Object.defineProperty(img, "naturalHeight", { configurable: true, value: height });
  return img;
}

// Bootstraps a jsdom window with editor.html + the scripts evaluated.
export async function bootEditor({ browserMock } = {}) {
  const api = browserMock ?? makeBrowserMock();

  // Strip the <script> tags — we eval them after stubbing globals so init() sees the mocks.
  const html = EDITOR_HTML
    .replace(/<script src="lib\.js"><\/script>\s*/g, "")
    .replace(/<script src="editor\.js"><\/script>\s*/g, "");

  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "moz-extension://test/editor.html",
  });
  const { window } = dom;

  window.browser = api;
  installCanvasStub(window);
  installImageLoadStub(window);
  const clipboardWrite = installClipboardStub(window);
  installUrlStub(window);

  window.eval(LIB_JS);
  window.eval(EDITOR_JS);

  // Allow init()'s microtasks (storage.get + captureVisibleTab) to resolve.
  await flush();
  await flush();

  return { dom, window, browserMock: api, clipboardWrite };
}

export function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
