// src/lib/digest.mjs — SHA-256 over raw bytes via the WebCrypto API (`globalThis.crypto.subtle`).
//
// `crypto.subtle` has been an unflagged Node global since Node 19 and is the same API every
// evergreen browser exposes, so this file needs no `node:crypto` import — it loads unchanged
// under scripts/sign-kb.mjs / src/kbVerify.js (Node) and under the browser build of
// src/kbVerify.js (once EP5-T5 wires it in), for the same reason src/lib/jcs.mjs lives under
// src/ rather than scripts/lib/ (see that file's header). This repo's package.json requires
// Node >=20, so the global is guaranteed present.

/** SHA-256 of `bytes` (any BufferSource — Uint8Array/Buffer/ArrayBuffer), returned as lowercase hex. */
export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

/** SHA-256 of a string's UTF-8 bytes, returned as lowercase hex. */
export async function sha256HexOfUtf8String(text) {
  return sha256Hex(new TextEncoder().encode(text));
}

function bytesToHex(bytes) {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}
