(function (global, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    Object.assign(global, factory());
  }
})(typeof self !== "undefined" ? self : this, function () {
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return Math.round(c * 255).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  function rgbToHue(hex) {
    const m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
    if (!m) return 0;
    const r = parseInt(m[1], 16) / 255;
    const g = parseInt(m[2], 16) / 255;
    const b = parseInt(m[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return 0;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return h;
  }

  function gradientStops(bgColor) {
    const h = rgbToHue(bgColor);
    return {
      start: hslToHex((h - 18 + 360) % 360, 90, 74),
      end: hslToHex((h + 28) % 360, 88, 58),
    };
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

  return { hslToHex, rgbToHue, gradientStops, drawCover };
});
