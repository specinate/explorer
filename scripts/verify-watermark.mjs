#!/usr/bin/env node
/**
 * Verifies the three provenance watermark layers in a production build.
 *
 *   pnpm build && node scripts/verify-watermark.mjs
 *
 * Exits non-zero if any layer is missing, so it can gate a release in CI.
 * Layers and their rationale are documented in app/lib/watermark.ts.
 */

import fs from "node:fs";
import path from "node:path";

const ZERO = "​";
const ONE = "‌";
const BOUND = "‍";
const PAYLOAD = new RegExp(BOUND + "[" + ZERO + ONE + "]+" + BOUND);

const ROOT = process.cwd();
const NEXT = path.join(ROOT, ".next");

/** Expected signature — keep in step with NEXT_PUBLIC_WATERMARK_ID. */
const EXPECTED = process.env.NEXT_PUBLIC_WATERMARK_ID || "SPECINATE-EXPLORER(C)2026";

function fingerprint(signature) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < signature.length; i++) {
    hash ^= signature.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function decodeWatermark(text) {
  const match = text.match(PAYLOAD);
  if (!match) return null;
  const payload = match[0].slice(1, -1);
  if (payload.length % 8 !== 0) return null;
  let signature = "";
  for (let i = 0; i < payload.length; i += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit++) {
      byte = (byte << 1) | (payload[i + bit] === ONE ? 1 : 0);
    }
    signature += String.fromCharCode(byte);
  }
  return signature;
}

/** All files under `dir` whose name ends with `ext`. */
function walk(dir, ext, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, found);
    else if (entry.name.endsWith(ext)) found.push(full);
  }
  return found;
}

const rel = (f) => path.relative(ROOT, f);
const results = [];
function check(layer, ok, detail) {
  results.push({ layer, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${layer}\n        ${detail}`);
}

if (!fs.existsSync(NEXT)) {
  console.error("No .next directory — run `pnpm build` first.");
  process.exit(1);
}

const REV = fingerprint(EXPECTED);
console.log(`Signature : ${JSON.stringify(EXPECTED)}`);
console.log(`Render rev: ${REV}\n`);

// Layer 1a — zero-width mark in the prerendered HTML.
const htmlFiles = walk(path.join(NEXT, "server", "app"), ".html");
const decoded = htmlFiles
  .map((f) => ({ file: f, sig: decodeWatermark(fs.readFileSync(f, "utf8")) }))
  .filter((r) => r.sig !== null);
const matching = decoded.filter((r) => r.sig === EXPECTED);
check(
  "Layer 1  zero-width mark in prerendered HTML",
  matching.length > 0,
  matching.length > 0
    ? `decoded ${JSON.stringify(matching[0].sig)} from ${rel(matching[0].file)}` +
        (matching.length > 1 ? ` (+${matching.length - 1} more)` : "")
    : decoded.length > 0
      ? `found a payload but it decoded to ${JSON.stringify(decoded[0].sig)}`
      : `no payload in ${htmlFiles.length} prerendered page(s)`,
);

// Layer 1b — signature recoverable from the client bundle. The encoder runs at
// runtime, so the chunk carries the signature literal rather than the payload.
const chunks = walk(path.join(NEXT, "static", "chunks"), ".js");
const carrying = chunks.filter((f) => fs.readFileSync(f, "utf8").includes(EXPECTED));
check(
  "Layer 1  signature literal in client JS chunks",
  carrying.length > 0,
  carrying.length > 0
    ? `${carrying.length} of ${chunks.length} chunk(s): ${carrying.map(rel).join(", ")}`
    : `absent from all ${chunks.length} chunk(s)`,
);

// Layer 2 — benign DOM attribute on <html>.
const attr = `data-render-rev="${REV}"`;
const withAttr = htmlFiles.filter((f) => fs.readFileSync(f, "utf8").includes(attr));
check(
  "Layer 2  data-render-rev on <html>",
  withAttr.length > 0,
  withAttr.length > 0
    ? `${attr} in ${withAttr.length} of ${htmlFiles.length} page(s)`
    : `${attr} not found in any prerendered page`,
);

// Layer 3 — CSS custom property surviving minification.
const cssFiles = walk(path.join(NEXT, "static"), ".css");
const seed = `--layout-viewport-seed:`;
let seedHit = null;
for (const f of cssFiles) {
  const m = fs.readFileSync(f, "utf8").match(/--layout-viewport-seed:\s*(#[0-9a-fA-F]+)/);
  if (m) {
    seedHit = { file: f, value: m[1] };
    break;
  }
}
check(
  "Layer 3  --layout-viewport-seed in compiled CSS",
  seedHit !== null && seedHit.value.toLowerCase() === `#${REV}`,
  seedHit
    ? `${seed}${seedHit.value} in ${rel(seedHit.file)}` +
        (seedHit.value.toLowerCase() === `#${REV}` ? "" : ` — expected #${REV}`)
    : `not found in ${cssFiles.length} stylesheet(s)`,
);

// Source maps must stay off, or the watermark sits next to readable sources.
const maps = walk(path.join(NEXT, "static"), ".js.map");
check(
  "Bonus    no browser source maps emitted",
  maps.length === 0,
  maps.length === 0 ? "none in .next/static" : `${maps.length} map(s) found, e.g. ${rel(maps[0])}`,
);

const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0
    ? `\nAll ${results.length} checks passed.`
    : `\n${failed.length} of ${results.length} checks FAILED.`,
);
process.exit(failed.length === 0 ? 0 : 1);
