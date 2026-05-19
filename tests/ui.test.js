// @vitest-environment node
import { describe, it, expect } from "vitest";
import { bootEditor } from "./helpers.js";

describe("editor UI", () => {
  it("renders every core component", async () => {
    const { window } = await bootEditor();
    const { document } = window;

    expect(document.querySelector(".card")).not.toBeNull();
    expect(document.getElementById("copy")).not.toBeNull();
    expect(document.getElementById("download")).not.toBeNull();
    expect(document.getElementById("stage")).not.toBeNull();
    expect(document.getElementById("screenshot")).not.toBeNull();
    expect(document.getElementById("swatch")).not.toBeNull();
    expect(document.getElementById("hue")).not.toBeNull();
    expect(document.getElementById("image-btn")).not.toBeNull();
    expect(document.getElementById("clear-image")).not.toBeNull();
    expect(document.getElementById("status")).not.toBeNull();
  });

  it("labels and types the action buttons correctly", async () => {
    const { window } = await bootEditor();
    const { document } = window;

    const copy = document.getElementById("copy");
    const download = document.getElementById("download");
    expect(copy.textContent.trim()).toBe("Copy");
    expect(download.textContent.trim()).toBe("Download PNG");
    expect(copy.getAttribute("type")).toBe("button");
    expect(download.getAttribute("type")).toBe("button");
    expect(download.classList.contains("primary")).toBe(true);
  });

  it("configures the hue slider with the expected range", async () => {
    const { window } = await bootEditor();
    const hue = window.document.getElementById("hue");
    expect(hue.getAttribute("type")).toBe("range");
    expect(hue.getAttribute("min")).toBe("0");
    expect(hue.getAttribute("max")).toBe("360");
  });

  it("paints the swatch and stage with a gradient after init", async () => {
    const { window } = await bootEditor();
    const swatch = window.document.getElementById("swatch");
    const stage = window.document.getElementById("stage");

    expect(swatch.style.background).not.toBe("");
    expect(stage.style.backgroundImage).toMatch(/^linear-gradient\(/);
    expect(stage.style.backgroundColor).not.toBe("");
  });

  it("hides the clear-image button when no background image is set", async () => {
    const { window } = await bootEditor();
    const clearBtn = window.document.getElementById("clear-image");
    expect(clearBtn.hidden).toBe(true);
  });

  it("hides the status row by default", async () => {
    const { window } = await bootEditor();
    expect(window.document.getElementById("status").hidden).toBe(true);
  });

  it("assigns the captured screenshot data URL to the <img> src", async () => {
    const { window, browserMock } = await bootEditor();
    expect(browserMock.tabs.captureVisibleTab).toHaveBeenCalledOnce();
    const img = window.document.getElementById("screenshot");
    expect(img.getAttribute("src")).toMatch(/^data:image\/png/);
  });
});
