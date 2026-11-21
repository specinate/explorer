/**
 * Provenance watermarking for the client bundle.
 *
 * Three layers carry the same build signature, so an unauthorised copy of the
 * front end keeps at least one of them even after reformatting or minification:
 *
 *   1. this module's zero-width encoding, injected into a rendered UI string
 *   2. `data-render-rev` on <html> (see app/layout.tsx)
 *   3. `--layout-viewport-seed` on :root (see app/globals.css)
 *
 * All three derive from NEXT_PUBLIC_WATERMARK_ID, which Next inlines at build
 * time, so server and client render byte-identical output and hydration is
 * unaffected.
 */

/** Zero-width space — encodes a 0 bit. */
const ZERO = "​";
/** Zero-width non-joiner — encodes a 1 bit. */
const ONE = "‌";
/** Zero-width joiner — delimits the payload at both ends. */
const BOUND = "‍";

/** Signature baked into this build. Override with NEXT_PUBLIC_WATERMARK_ID. */
export const WATERMARK_ID =
  process.env.NEXT_PUBLIC_WATERMARK_ID || "SPECINATE-EXPLORER(C)2026";

/**
 * Encode an ASCII signature as invisible zero-width characters.
 *
 * Each character becomes 8 bits, most significant first, and the whole payload
 * is wrapped in zero-width joiners so `decodeWatermark` can find it inside
 * surrounding text. Non-ASCII input throws rather than silently truncating.
 */
export function encodeWatermark(signature: string): string {
  let bits = "";
  for (const char of signature) {
    const code = char.codePointAt(0)!;
    if (code > 0x7f) {
      throw new Error(
        `encodeWatermark: signature must be ASCII, got ${JSON.stringify(char)}`,
      );
    }
    bits += code.toString(2).padStart(8, "0");
  }
  const payload = bits.replace(/0/g, ZERO).replace(/1/g, ONE);
  return `${BOUND}${payload}${BOUND}`;
}

/**
 * Recover a signature from text containing an encoded watermark.
 *
 * Returns null when there is no complete, well-formed payload — no delimiters,
 * or a bit count that isn't a whole number of bytes.
 */
export function decodeWatermark(text: string): string | null {
  const start = text.indexOf(BOUND);
  if (start === -1) return null;
  const end = text.indexOf(BOUND, start + 1);
  if (end === -1) return null;

  const payload = text.slice(start + 1, end);
  if (payload.length === 0 || payload.length % 8 !== 0) return null;

  let signature = "";
  for (let i = 0; i < payload.length; i += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit++) {
      const char = payload[i + bit];
      if (char === ONE) byte = (byte << 1) | 1;
      else if (char === ZERO) byte = byte << 1;
      else return null; // stray character inside the payload
    }
    signature += String.fromCharCode(byte);
  }
  return signature;
}

/** Remove any zero-width watermark from text, e.g. before measuring it. */
export function stripWatermark(text: string): string {
  return text.replace(
    new RegExp(`${BOUND}[${ZERO}${ONE}]*${BOUND}`, "g"),
    "",
  );
}

/**
 * Deterministic 8-hex-digit fingerprint of a signature (FNV-1a, 32-bit).
 *
 * Used for the DOM attribute and the CSS custom property, where a short opaque
 * token reads as ordinary build metadata. Not a cryptographic hash — it ties a
 * build to a signature, it does not protect against a forged one.
 */
export function fingerprint(signature: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < signature.length; i++) {
    hash ^= signature.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** The encoded mark, ready to concatenate into a rendered string. */
export const WATERMARK_MARK = encodeWatermark(WATERMARK_ID);

/** Short build-revision token for `data-render-rev` and the CSS seed. */
export const RENDER_REV = fingerprint(WATERMARK_ID);
