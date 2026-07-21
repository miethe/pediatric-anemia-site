// src/lib/jcs.mjs — RFC 8785 (JSON Canonicalization Scheme) canonicalizer.
//
// Hand-implemented because this repo ships zero runtime dependencies (package.json has no
// `dependencies` block at all) — pulling in a JCS library for two hash preimages would change
// the repo's supply-chain posture for a handful of lines of code.
//
// Lives under src/, not scripts/lib/: scripts/sign-kb.mjs (the signer) and src/kbVerify.js (the
// verifier) must derive byte-identical digests, and src/kbVerify.js has to be importable by
// src/app.js once EP5-T5 wires it in (per this task's own spec). build-static.mjs only copies
// ['assets', 'src', 'data', 'examples', 'modules'] into dist/ — scripts/ is not one of them — so
// anything reachable from the browser build must resolve under src/ (or modules/). Putting the
// canonicalizer here lets scripts/sign-kb.mjs reach it too (a Node script can import from src/
// freely; the constraint only runs one direction), which keeps exactly one implementation shared
// by both signer and verifier rather than two that could silently drift apart.
//
// Implements exactly the JCS rules this codebase's two digest preimages need:
//   - object keys sorted by UTF-16 code unit sequence (JS's default string `<` comparison)
//   - arrays serialized in their existing order (JCS never reorders arrays)
//   - numbers serialized via the ECMAScript Number-to-String algorithm — `String(number)` in JS
//     already implements exactly that algorithm, since V8's engine behavior IS the ECMA-262 spec
//   - strings escaped per the JSON/JCS minimum: `"`, `\`, and control characters U+0000-U+001F
//     only; every other character (including non-ASCII and astral code points) passes through
//     unescaped, matching JCS's "do not escape more than the minimum" rule
//   - no insignificant whitespace anywhere in the output

/** Canonicalizes a JSON-value-shaped input into its JCS string form. */
export function canonicalize(value) {
  return serializeValue(value);
}

function serializeValue(value) {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'number') return serializeNumber(value);
  if (type === 'string') return serializeString(value);
  if (Array.isArray(value)) return serializeArray(value);
  if (type === 'object') return serializeObject(value);
  throw new TypeError(`jcs.canonicalize: unsupported value type "${type}"`);
}

function serializeNumber(value) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`jcs.canonicalize: non-finite number is not a valid JSON value (${value})`);
  }
  // ECMAScript's Number::toString(-0) is "0" — JCS requires negative zero to render the same way.
  return Object.is(value, -0) ? '0' : String(value);
}

const CONTROL_CHAR_SHORTHAND = { 0x08: '\\b', 0x09: '\\t', 0x0a: '\\n', 0x0c: '\\f', 0x0d: '\\r' };

function serializeString(value) {
  let out = '"';
  // Iterate by code point (not UTF-16 code unit) so a surrogate pair for an astral character is
  // never split — codePointAt(0) on such a pair yields the astral code point (>= 0x10000),
  // which always fails the `< 0x20` control-character check below and passes through unescaped,
  // exactly as JCS requires.
  for (const char of value) {
    if (char === '"') { out += '\\"'; continue; }
    if (char === '\\') { out += '\\\\'; continue; }
    const codePoint = char.codePointAt(0);
    if (codePoint < 0x20) {
      out += CONTROL_CHAR_SHORTHAND[codePoint] ?? `\\u${codePoint.toString(16).padStart(4, '0')}`;
      continue;
    }
    out += char;
  }
  return `${out}"`;
}

function serializeArray(value) {
  return `[${value.map(serializeValue).join(',')}]`;
}

function serializeObject(value) {
  // JCS 3.2.3: object member names are sorted by comparing their UTF-16 code unit sequences,
  // which is exactly JS's default `Array.prototype.sort()` string comparison.
  const keys = Object.keys(value).sort();
  const parts = keys.map((key) => `${serializeString(key)}:${serializeValue(value[key])}`);
  return `{${parts.join(',')}}`;
}
