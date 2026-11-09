#!/usr/bin/env node
/**
 * Lightweight SVG -> PNG exporter for Voicela artwork.
 * Uses @resvg/resvg-js when available; otherwise reports that the
 * SVG should be used as-is (never breaks the build).
 *
 * Usage: node scripts/render-png.js <input.svg> [scale=1.5]
 * Outputs <input>.png next to the source file.
 */
const fs = require("fs");
const path = require("path");

let Resvg;
try {
  ({ Resvg } = require("@resvg/resvg-js"));
} catch {
  console.log("render-png: no SVG rasterizer available; delivering SVG only");
  process.exit(0);
}

const input = process.argv[2];
const scale = Number.parseFloat(process.argv[3] || "1.5");

if (!input) {
  console.error("usage: node scripts/render-png.js <input.svg> [scale]");
  process.exit(1);
}

const src = fs.readFileSync(input, "utf8");
const widthMatch = src.match(/<svg[^>]*width="(\d+(?:\.\d+)?)"/);
if (!widthMatch) {
  console.error(`render-png: no width on ${input}`);
  process.exit(1);
}
const width = Number.parseFloat(widthMatch[1]);
const outWidth = Math.round(width * scale);

const renderer = new Resvg(src, {
  fitTo: { mode: "width", value: outWidth },
  font: {
    loadSystemFonts: true,
    defaultFontFamily: "Segoe UI, ui-sans-serif, system-ui, sans-serif",
  },
});

const png = renderer.render().asPng();
const out = input.replace(/\.svg$/i, ".png");
fs.writeFileSync(out, png);
console.log(`render-png: ${path.basename(out)} (${outWidth}px, ${Buffer.byteLength(png)} bytes)`);
