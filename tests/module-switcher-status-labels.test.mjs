// tests/module-switcher-status-labels.test.mjs — spa-module-switcher-v1, Phase 6
// (docs/project_plans/implementation_plans/features/spa-module-switcher-v1/phase-6-7-gates-docs.md).
//
// Combines P6-004, P6-007 and P6-008 — the plan's own serialization_constraint groups all three
// under this one filename.
//
// D-6 CEILING, STATED ONCE: `src/app.js`/`index.html` are DOM-dependent; nothing here observes a
// browser paint them. Assertions over these two files are SOURCE-ASSERTED (regex/functionBody()
// over text) unless explicitly marked "COMPLETE" (a whole-file-scan claim that genuinely is fully
// established by source absence/presence, per the plan's own vocabulary). Assertions over
// `src/moduleStatusVocabulary.js` and `schemas/module-manifest.schema.json` ARE executed (real
// imports, real function calls). No test name uses "renders"/"executes" for DOM behavior.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MODULE_STATUS_SENTENCES, getStatusSentence, UNKNOWN_STATUS_SENTINEL,
} from '../src/moduleStatusVocabulary.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');
const indexHtmlSource = readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const stylesCss = readFileSync(path.join(repoRoot, 'styles.css'), 'utf8');
const siteOverridesCss = readFileSync(path.join(repoRoot, 'site-overrides.css'), 'utf8');
const schemaPath = path.join(repoRoot, 'schemas', 'module-manifest.schema.json');

// ------------------------------------------------------------------------------------------------
// Shared functionBody() helper — independent local copy (see tests/module-switcher-eligibility
// .test.mjs's matching header comment for why this is intentionally not a shared import).
// ------------------------------------------------------------------------------------------------

function bracedRange(source, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) { if (char === '\n') lineComment = false; continue; }
    if (blockComment) { if (char === '*' && next === '/') { blockComment = false; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (char === '\'' || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') { depth -= 1; if (depth === 0) return { start: openIndex, end: index }; }
  }
  assert.fail('braced block does not close');
}

/** Returns a SAME-LENGTH copy of `source` with every `//` line comment and `/* ... *\/` block
 * comment blanked to spaces (newlines preserved) — see tests/module-switcher-eligibility.test.mjs's
 * matching function for the full rationale (codex adversarial-review finding: an un-hardened
 * regex search over raw source text would match a comment decoy containing e.g. a fake `function
 * <name>(` declaration). Never touches string/template literal contents. */
function stripCommentsPreservingOffsets(source) {
  let out = '';
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (char === '\n') { lineComment = false; out += '\n'; } else { out += ' '; }
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; out += '  '; i += 1; continue; }
      out += char === '\n' ? '\n' : ' ';
      continue;
    }
    if (quote) {
      out += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; out += '  '; i += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; out += '  '; i += 1; continue; }
    if (char === '\'' || char === '"' || char === '`') { quote = char; out += char; continue; }
    out += char;
  }
  return out;
}

/** Declaration/parameter-list location is found against a comment-stripped copy of `source` (a
 * comment decoy is skipped); the returned `body` is sliced from the ORIGINAL `source`, so it still
 * contains real comments for any caller that wants them. */
function namedFunctionRange(source, name) {
  const stripped = stripCommentsPreservingOffsets(source);
  const declaration = new RegExp(`function\\s+${name}\\s*\\(`).exec(stripped);
  assert.ok(declaration, `src/app.js must declare ${name}()`);
  const parenOpen = stripped.indexOf('(', declaration.index);
  let depth = 0;
  let parenClose = -1;
  for (let i = parenOpen; i < stripped.length; i += 1) {
    if (stripped[i] === '(') depth += 1;
    if (stripped[i] === ')') { depth -= 1; if (depth === 0) { parenClose = i; break; } }
  }
  assert.notEqual(parenClose, -1, `${name}()'s parameter list does not close`);
  const open = stripped.indexOf('{', parenClose);
  const range = bracedRange(source, open);
  return { ...range, body: source.slice(range.start + 1, range.end) };
}

function functionBody(source, name) {
  return namedFunctionRange(source, name).body;
}

// CEILING (codex adversarial-review note, kept honest): stripCommentsPreservingOffsets() defends
// against a STATIC comment decoy, not against a constructed/dynamic property or attribute access
// built at runtime (e.g. `el[computedName]`) — that would defeat any regex-based textual scan by
// design. This mechanism guards against accidental regression and unsophisticated decoys, not a
// determined adversary rewriting src/app.js specifically to evade this test file.

test('namedFunctionRange decoy self-test: a block-comment decoy containing a fake function declaration is skipped — the REAL declaration is still found', () => {
  const decoySource = [
    '/* function getManifestView(fake) { return "DECOY_SHOULD_NEVER_MATCH"; } */',
    'function getManifestView(real) { return "REAL_BODY_MARKER"; }',
  ].join('\n');
  const { body } = namedFunctionRange(decoySource, 'getManifestView');
  assert.match(body, /REAL_BODY_MARKER/, 'must locate the real declaration, not the commented-out decoy');
  assert.doesNotMatch(body, /DECOY_SHOULD_NEVER_MATCH/, 'must never extract the decoy comment as the function body');
});

// ================================================================================================
// P6-004 — doc-truth surface pin over the vocabulary (AC-3).
//
// P1-04 (tests/module-status-vocabulary.test.mjs) already pins the VOCABULARY MODULE's internal
// consistency and its byte-match against PRD §6.1.B-1. This section is the SURFACE pin: that
// src/app.js and index.html actually USE those exported identifiers rather than inlining their
// own copies, plus the FR-11 resolved-colour check and the R-1 group-header pin, neither of which
// P1-04 covers.
// ================================================================================================

test('P6-004 (executed): every closed-enum status value has exactly one canonical sentence, derived from the schema file — not hand-copied here', () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const enumValues = schema.properties.status.enum;
  assert.deepEqual([...Object.keys(MODULE_STATUS_SENTENCES)].sort(), [...enumValues].sort());
});

test('P6-004 (executed): every real registered module\'s manifest status resolves to a real sentence, never the unknown sentinel', () => {
  // CORRECTED (post-review): this test iterates schemas/module-manifest.schema.json's status
  // ENUM, not MODULE_IDS or any real module's manifest — src/moduleManifests.js/MODULE_IDS are not
  // imported here at all. That is a stronger claim than "every registered module's status has a
  // sentence" (it also covers enum values no module currently uses), and the previous wording of
  // this comment overclaimed the opposite — it implied MODULE_IDS was iterated when it never was.
  // The prior test above already independently establishes MODULE_STATUS_SENTENCES' keys equal
  // the schema enum exactly; this test's own load-bearing claim is that getStatusSentence() itself
  // never returns the refusal sentinel for any real, schema-valid status string.
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  for (const status of schema.properties.status.enum) {
    assert.notEqual(getStatusSentence(status), UNKNOWN_STATUS_SENTINEL, `${status} is a real closed-enum value`);
  }
});

test('P6-004 resilience (executed): a status value with no vocabulary entry returns the refusal sentinel — never a friendlier fallback, and this is a genuine build-time invariant, not just a runtime check', () => {
  assert.equal(getStatusSentence('not-a-real-status'), UNKNOWN_STATUS_SENTINEL);
  assert.equal(typeof UNKNOWN_STATUS_SENTINEL, 'symbol', 'a Symbol can never accidentally render as clinician-facing text, unlike a string sentinel would');
});

test('P6-004 SOURCE-ASSERTED: PANEL_HEADER, HONESTY_BOUNDARY_DISCLOSURE and EVIDENCE_STALENESS_DISCLOSURE are imported into src/app.js and referenced by identifier, never inlined', () => {
  assert.match(appSource, /import\s*\{[\s\S]*?\bPANEL_HEADER\b[\s\S]*?\}\s*from\s*['"]\.\/moduleStatusVocabulary\.js['"]/);
  assert.match(appSource, /import\s*\{[\s\S]*?\bHONESTY_BOUNDARY_DISCLOSURE\b[\s\S]*?\}\s*from\s*['"]\.\/moduleStatusVocabulary\.js['"]/);
  assert.match(appSource, /import\s*\{[\s\S]*?\bEVIDENCE_STALENESS_DISCLOSURE\b[\s\S]*?\}\s*from\s*['"]\.\/moduleStatusVocabulary\.js['"]/);
  const bannerBody = functionBody(appSource, 'renderModuleStatusBanner');
  assert.match(bannerBody, /HONESTY_BOUNDARY_DISCLOSURE/, 'FR-13 must be referenced by identifier inside the banner renderer');
  assert.match(bannerBody, /EVIDENCE_STALENESS_DISCLOSURE/, 'FR-34 must be referenced by identifier inside the banner renderer');
});

test('P6-004 COMPLETE: no clinician-facing status sentence text is written inline in index.html or src/app.js', () => {
  // Distinguishing substrings from each of the four canonical sentences plus the two disclosures —
  // if any of these literal fragments appears verbatim in either file, it was typed inline instead
  // of referenced by identifier.
  const literalFragments = [
    'content hashes recorded only',
    'no content hash recorded; not servable',
    'replaced by a later module release; retained for audit only',
    'withdrawn; retained for audit only',
    'These modules are not peers. Read each row.',
    'no content digest was recomputed, no schema was validated',
    'Evidence-staleness expiry is not enforced',
  ];
  for (const fragment of literalFragments) {
    assert.doesNotMatch(appSource, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `src/app.js must not inline: "${fragment}"`);
    assert.doesNotMatch(indexHtmlSource, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `index.html must not inline: "${fragment}"`);
  }
});

test('P6-004 (R-1 group headers): index.html carries both structural group-header labels verbatim', () => {
  // These are structural navigation labels (grouping, not clinician-facing status text), so they
  // are legitimately static markup rather than vocabulary-file exports — pinned here per the
  // task's explicit instruction "so the structural grouping cannot silently become a footnote."
  assert.match(indexHtmlSource, /<h3 class="module-switcher-group-label">Selectable<\/h3>/);
  assert.match(indexHtmlSource, /<h3 class="module-switcher-group-label">Not selectable — read the reason<\/h3>/);
});

// --- FR-11 addendum: resolved-COLOUR-VALUE no-green-state check (D-6 corollary) -----------------
//
// A name-only check (does a token merely CALLED --stub-warn or similar look suspicious) is
// explicitly forbidden by the AC. This resolves every custom property reachable from a
// module-row/status-chip/module-status(-banner) selector to its literal colour value and rejects
// any colour whose hue sits in the green band at meaningful saturation — independent of what the
// property or class happens to be named.

/** Minimal, dependency-free CSS rule extractor: walks brace-depth, recurses into @media blocks,
 * skips /* *\/ comments, returns a flat list of {selector, body} for every non-@ rule. */
function extractCssRules(css) {
  const rules = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
  let i = 0;
  while (i < stripped.length) {
    const open = stripped.indexOf('{', i);
    if (open === -1) break;
    const selector = stripped.slice(i, open).trim();
    const range = bracedRange(stripped, open);
    const body = css.slice(range.start + 1, range.end);
    if (selector.startsWith('@media')) {
      rules.push(...extractCssRules(body));
    } else if (selector && !selector.startsWith('@')) {
      for (const oneSelector of selector.split(',').map((s) => s.trim())) {
        rules.push({ selector: oneSelector, body });
      }
    }
    i = range.end + 1;
  }
  return rules;
}

/** Merges every `:root { --name: value; }` declaration from `cssFiles`, in order — a later file's
 * value wins for a shared property name, mirroring index.html's own <link> load order. */
function buildCustomPropertyTable(cssFiles) {
  const table = new Map();
  for (const css of cssFiles) {
    for (const rule of extractCssRules(css)) {
      if (rule.selector !== ':root') continue;
      for (const match of rule.body.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
        table.set(match[1], match[2].trim());
      }
    }
  }
  return table;
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHsl(r, g, b) {
  const rn = r / 255; const gn = g / 255; const bn = b / 255;
  const max = Math.max(rn, gn, bn); const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
  else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
  else h = 60 * ((rn - gn) / delta + 4);
  if (h < 0) h += 360;
  return { h, s, l };
}

const NAMED_SAFE_COLORS = new Set(['white', 'black', 'transparent', 'none', 'inherit', 'currentcolor', 'initial', 'unset']);

// (a) post-review widening (codex adversarial finding): a small, explicit named-green list. Not
// exhaustive over all 148 CSS named colours — a deliberate, documented scope limit (see the
// CEILING comment below) — but covers every named green a stylesheet author would plausibly reach
// for, so a bare `color: forestgreen;` can no longer slip past a check that only ever looked for
// hex/rgb/var().
const NAMED_GREEN_COLORS = new Set([
  'green', 'seagreen', 'mediumseagreen', 'forestgreen', 'limegreen', 'lime', 'springgreen',
  'olivedrab', 'darkgreen', 'darkseagreen', 'lightgreen', 'palegreen', 'yellowgreen', 'lawngreen',
  'chartreuse', 'greenyellow', 'mediumspringgreen', 'lightseagreen', 'darkolivegreen',
]);

// Only these CSS properties can carry a colour this check cares about — scoping to them (rather
// than scanning a whole declaration block's raw text indiscriminately) is what makes the (b)
// fail-closed-on-unresolved rule below safe: `border-radius: var(--radius)` or
// `box-shadow: var(--shadow)` (a composite offset+blur+colour value, not a bare colour) must never
// be misread as "an unresolved colour" just because they also happen to use var().
const COLOR_BEARING_PROPERTIES = new Set([
  'color', 'background', 'background-color', 'border', 'border-color', 'border-left', 'border-top',
  'border-right', 'border-bottom', 'outline', 'outline-color', 'box-shadow', 'fill', 'stroke',
  'text-decoration-color',
]);

/** Splits a declaration block into [{prop, value}], filtered to COLOR_BEARING_PROPERTIES only. */
function extractColorBearingDeclarations(body) {
  const declarations = [];
  for (const match of body.matchAll(/([a-zA-Z-]+)\s*:\s*([^;]+);?/g)) {
    const prop = match[1].trim().toLowerCase();
    if (COLOR_BEARING_PROPERTIES.has(prop)) declarations.push({ prop, value: match[2].trim() });
  }
  return declarations;
}

const UNRESOLVED_VAR_SENTINEL = ' UNRESOLVED-VAR ';

/** Substitutes every `var(--name[, fallback])` in `text` with its looked-up value from
 * `customProps`, recursively (a custom property may itself reference another). An UNDEFINED
 * custom property name is substituted with a sentinel that downstream scanning treats as an
 * explicit unresolved-fail, per (b) — it is never silently dropped. */
function resolveVarsInText(text, customProps, depth = 0) {
  if (depth > 6) return text;
  return text.replace(/var\(\s*--([a-zA-Z0-9-]+)\s*(?:,([^)]*))?\)/g, (_wholeMatch, varName) => {
    if (customProps.has(varName)) return resolveVarsInText(customProps.get(varName), customProps, depth + 1);
    return UNRESOLVED_VAR_SENTINEL;
  });
}

/** Extracts every literal colour token from a color-bearing declaration's VALUE (after resolving
 * var() references): hex, rgb()/rgba() and hsl()/hsla() in BOTH comma-form (`rgb(1, 2, 3)`) and
 * space-form (`rgb(1 2 3 / 50%)`) — (a) — plus the small named-green list above. `color-mix(...)`
 * and `currentColor` are EXPLICITLY unresolved-fail (b): both are context/parent-dependent at
 * paint time, so no static hue can be computed for them, and treating "cannot compute" as "pass"
 * would be exactly the silent-gap this hardening exists to close. Returns {resolved, unresolved} —
 * `unresolved` must be empty for the declaration to be considered checked (the caller enforces
 * fail-closed, not this function). */
function extractResolvedColors(rawValue, customProps) {
  const resolved = [];
  const unresolved = [];
  const text = resolveVarsInText(rawValue, customProps);
  if (text.includes(UNRESOLVED_VAR_SENTINEL)) unresolved.push(`unresolved var() in: ${rawValue}`);
  if (/color-mix\(/i.test(text)) unresolved.push(`color-mix(...) is context-dependent and cannot be statically resolved: ${text}`);
  if (/\bcurrentColor\b/i.test(text)) unresolved.push(`currentColor is context-dependent and cannot be statically resolved: ${text}`);
  const tokenRe = new RegExp(
    `(#[0-9a-fA-F]{3,8})\\b`
    + `|hsla?\\(([^)]+)\\)`
    + `|rgba?\\(([^)]+)\\)`
    + `|\\b(${[...NAMED_GREEN_COLORS].join('|')})\\b`
    // NAMED_SAFE_COLORS as an explicit, consulted allow-list (not a silent fall-through): a bare
    // safe keyword (white/black/transparent/none/inherit/currentcolor/initial/unset) is
    // recognized and deliberately SKIPPED — never pushed to `resolved` (nothing to hue-check) and
    // never pushed to `unresolved` (it is not an unknown value, it is a known-non-green one).
    + `|\\b(${[...NAMED_SAFE_COLORS].join('|')})\\b`,
    'gi',
  );
  let match;
  while ((match = tokenRe.exec(text))) {
    if (match[1]) {
      resolved.push({ token: match[1], hex: match[1] });
    } else if (match[2]) {
      resolved.push({ token: match[0], hex: hslTextToHex(match[2]) });
    } else if (match[3]) {
      resolved.push({ token: match[0], hex: colorComponentsTextToHex(match[3]) });
    } else if (match[4]) {
      resolved.push({ token: match[4], hex: NAMED_GREEN_HEX[match[4].toLowerCase()] });
    }
    // match[5] (a NAMED_SAFE_COLORS hit) is deliberately not handled here — see the comment above.
  }
  return { resolved, unresolved };
}

/** Parses BOTH `1, 2, 3[, a]` and `1 2 3[ / a]` forms (space-form was previously silently
 * mis-parsed as a single NaN component — a real false-negative the codex review found: a
 * space-form `rgb(...)` carrying a real green would have produced garbage NaN-hex and silently
 * passed). */
function colorComponentsTextToHex(componentsText) {
  const withoutAlpha = componentsText.split('/')[0];
  const parts = withoutAlpha.trim().split(/\s*,\s*|\s+/).filter(Boolean).slice(0, 3).map((p) => parseFloat(p));
  const [r, g, b] = parts;
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v || 0))).toString(16).padStart(2, '0')).join('')}`;
}

function hslTextToHex(componentsText) {
  const withoutAlpha = componentsText.split('/')[0];
  const parts = withoutAlpha.trim().split(/\s*,\s*|\s+/).filter(Boolean).slice(0, 3);
  const h = parseFloat(parts[0]) || 0;
  const s = (parseFloat(parts[1]) || 0) / 100;
  const l = (parseFloat(parts[2]) || 0) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

// Approximate reference hexes for the named-green list — only used to prove the isGreenish()
// predicate agrees these are green (a self-test below); the AUTHORITATIVE check for a named colour
// occurring in real CSS is the keyword match itself (an occurrence is a fail unconditionally),
// not a round-trip through this table.
const NAMED_GREEN_HEX = {
  green: '#008000', seagreen: '#2e8b57', mediumseagreen: '#3cb371', forestgreen: '#228b22',
  limegreen: '#32cd32', lime: '#00ff00', springgreen: '#00ff7f', olivedrab: '#6b8e23',
  darkgreen: '#006400', darkseagreen: '#8fbc8f', lightgreen: '#90ee90', palegreen: '#98fb98',
  yellowgreen: '#9acd32', lawngreen: '#7cfc00', chartreuse: '#7fff00', greenyellow: '#adff2f',
  mediumspringgreen: '#00fa9a', lightseagreen: '#20b2aa', darkolivegreen: '#556b2f',
};

/** The FR-11 predicate itself: true iff `hex` sits in the green hue band at meaningful saturation
 * and non-extreme lightness. Calibrated against two known examples: #2e7d32 (the AC's own seeded
 * example, hue~123°/S~46%) and this codebase's real --success #176a4b (hue~158°/S~64%) both fall
 * inside; the codebase's real --warning #8a5a00 (hue~39°) and --info/--brand blues (hue~208°/190°)
 * both fall outside. */
function isGreenish(hex) {
  const [r, g, b] = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  return h >= 70 && h <= 170 && s >= 0.20 && l >= 0.10 && l <= 0.90;
}

// (d) post-review widening (codex adversarial finding): the selector filter used to be a
// hardcoded `/module-row|status-chip|module-status/` guess. It is now DERIVED from the classes
// the switcher/banner markup actually applies — every literal `module-`/`status-`-prefixed class
// name found in src/app.js (both static `class="..."` template strings and `classList.
// add/toggle/contains('...')` calls) and index.html's static markup — so a class the markup
// applies but this file's author didn't happen to think of is still in scope, not silently
// excluded by a stale regex guess.
function extractAppliedClassNames(sources) {
  const classNames = new Set();
  for (const source of sources) {
    for (const match of source.matchAll(/class(?:Name)?="([^"]*)"/g)) {
      for (const cls of match[1].split(/\s+/)) {
        if (/^(module|status)-/.test(cls)) classNames.add(cls);
      }
    }
    for (const match of source.matchAll(/classList\.(?:add|toggle|contains)\('([a-zA-Z0-9-]+)'/g)) {
      if (/^(module|status)-/.test(match[1])) classNames.add(match[1]);
    }
    for (const match of source.matchAll(/['"`](module-[a-zA-Z0-9-]+|status-[a-zA-Z0-9-]+)['"`]/g)) {
      classNames.add(match[1]);
    }
  }
  return classNames;
}

function selectorReferencesAnyClass(selector, classNames) {
  const selectorClasses = [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
  return selectorClasses.some((cls) => classNames.has(cls));
}

function assertNoGreenState(css, customProps, appliedClassNames) {
  const rules = extractCssRules(css).filter((r) => selectorReferencesAnyClass(r.selector, appliedClassNames));
  assert.ok(rules.length > 0, 'expected at least one rule matching an applied module-/status- class — the scan would be vacuous otherwise');
  for (const rule of rules) {
    for (const { prop, value } of extractColorBearingDeclarations(rule.body)) {
      const { resolved, unresolved } = extractResolvedColors(value, customProps);
      // (b) FAIL-CLOSED: an unresolved colour is a failure, not a silently-discarded maybe.
      assert.equal(unresolved.length, 0, `FR-11 violation: selector "${rule.selector}" property "${prop}" has an unresolved colour value that cannot be statically proven non-green: ${unresolved.join('; ')}`);
      for (const { token, hex } of resolved) {
        assert.ok(!isGreenish(hex), `FR-11 violation: selector "${rule.selector}" property "${prop}" resolves ${token} to ${hex}, which falls in the green hue band at meaningful saturation`);
      }
    }
  }
}

// CEILING (codex adversarial-review note, kept honest): this is a curated, documented-scope check,
// not exhaustive CSS colour parsing. It recognizes hex / rgb() / rgba() / hsl() / hsla() (both
// comma- and space-form) / var() / a curated ~19-name green keyword list / color-mix()/
// currentColor (explicit fail) — it does NOT recognize the other ~130 CSS named colours (none of
// which are green, so their absence from the pass-list is not a green-hiding gap, only an
// incompleteness for colours this check was never going to flag anyway), nor `hwb()`/`lab()`/
// `lch()`/`oklch()` colour functions, none of which appear anywhere in this codebase's stylesheets
// today. A future stylesheet using one of those forms would need this list extended.

test('P6-004 FR-11 (real check): every module-/status--applied-class selector (derived from the actual markup, not a hardcoded guess) resolves to zero green-band colours in every color-bearing property, checked on literal VALUES not token names', () => {
  const customProps = buildCustomPropertyTable([stylesCss, siteOverridesCss]);
  // Confirm this test actually exercises the site-overrides.css override that makes a name-only
  // check unsafe: site-overrides.css redefines --success to a REAL green, proving the merge below
  // is not vacuously using styles.css's own (also-green) --success value by coincidence.
  assert.notEqual(customProps.get('success'), undefined);
  assert.ok(isGreenish(customProps.get('success')), 'test precondition: --success must itself resolve green, or this whole check proves nothing');
  const appliedClassNames = extractAppliedClassNames([appSource, indexHtmlSource]);
  assert.ok(appliedClassNames.size >= 15, `expected the derived class list to be substantial (found ${appliedClassNames.size}) — a near-empty result would mean the derivation itself is broken, making this test vacuous`);
  assert.ok(appliedClassNames.has('module-row'), 'derived class list sanity check');
  assert.ok(appliedClassNames.has('status-chip'), 'derived class list sanity check');
  // (c) post-review widening: scan BOTH stylesheets index.html loads, not styles.css alone —
  // site-overrides.css could in principle also declare rules for these classes directly (it does
  // not today, confirmed empty by a separate grep at authoring time, but the scan itself no longer
  // depends on that staying true).
  assertNoGreenState(stylesCss, customProps, appliedClassNames);
  assertNoGreenState(siteOverridesCss, customProps, appliedClassNames);
});

test('P6-004 FR-11 (mutation self-test): the no-green-state check genuinely fails against a seeded green token reachable from a module-row selector, even when the token is named innocuously', () => {
  // The AC's own example: a token NAMED "--stub-warn" (sounds like the existing amber warning
  // palette) whose VALUE is a real green (#2e7d32) must fail — proving this is a value check, not
  // a name check, which a name-only implementation would miss entirely.
  const seededCss = `:root { --stub-warn: #2e7d32; }\n.module-row-seeded-mutant { color: var(--stub-warn); }`;
  const customProps = buildCustomPropertyTable([seededCss]);
  assert.throws(() => {
    assertNoGreenState(seededCss, customProps, new Set(['module-row-seeded-mutant']));
  }, /FR-11 violation/, 'a green value behind an innocuously-named token must still be caught');
});

test('P6-004 FR-11 (mutation self-test, direct literal): a raw green hex literal (not behind a var()) on a status-chip selector also fails', () => {
  const seededCss = `.status-chip-seeded-mutant { background: #2e7d32; }`;
  assert.throws(() => {
    assertNoGreenState(seededCss, new Map(), new Set(['status-chip-seeded-mutant']));
  }, /FR-11 violation/);
});

test('P6-004 FR-11 (mutation self-test): space-form rgb()/hsl(), named-green keywords, color-mix() and currentColor are all caught (post-review widening)', () => {
  const cases = [
    { css: '.module-row-seed-a { color: rgb(46 125 50); }', label: 'space-form rgb() carrying a real green' },
    { css: '.module-row-seed-b { color: hsl(123deg 46% 34%); }', label: 'space-form hsl() carrying a real green' },
    { css: '.module-row-seed-c { color: hsl(123, 46%, 34%); }', label: 'comma-form hsl() carrying a real green' },
    { css: '.module-row-seed-d { background: forestgreen; }', label: 'bare named-green keyword' },
    { css: '.module-row-seed-e { color: color-mix(in srgb, green, blue); }', label: 'color-mix() — explicit unresolved-fail' },
    { css: '.module-row-seed-f { color: currentColor; }', label: 'currentColor — explicit unresolved-fail' },
    { css: '.module-row-seed-g { color: var(--totally-undefined-property); }', label: 'a var() referencing an undefined custom property — explicit unresolved-fail' },
  ];
  for (const { css, label } of cases) {
    const selector = /\.([\w-]+)/.exec(css)[1];
    assert.throws(() => {
      assertNoGreenState(css, new Map(), new Set([selector]));
    }, /FR-11 violation/, label);
  }
});

test('P6-004 FR-11: the space-form colour parser produces the SAME hex as the comma-form parser for equivalent input (regression guard for the previous silent NaN-mis-parse bug)', () => {
  assert.equal(colorComponentsTextToHex('46, 125, 50'), colorComponentsTextToHex('46 125 50'));
  assert.equal(colorComponentsTextToHex('46 125 50 / 50%'), colorComponentsTextToHex('46, 125, 50'));
  assert.equal(hslTextToHex('123, 46%, 34%'), hslTextToHex('123deg 46% 34%'), 'a "deg" hue-unit suffix must parse identically to a bare number (parseFloat stops at the first non-numeric character)');
});

// ================================================================================================
// P6-007 — module-scoped degradation & module-derived copy (AC-6, AC-7).
// TIER: source-asserted, with one COMPLETE check (the index.html 91/26 nav-count fallback scan).
// DOES NOT PROVE what any tab renders under a scaffold module, that the explorer never executes
// (only that its invocation sits behind a branch), or what document.title actually says.
// ================================================================================================

test('P6-007 AC-6 COMPLETE: the #nav-rule-count / #nav-pattern-count elements carry no hardcoded 91/26 fallback value', () => {
  // Scoped precisely to the two nav-count elements rather than a blind whole-file digit scan — a
  // raw "91"/"26" substring scan would false-positive on unrelated legitimate content elsewhere in
  // this file (e.g. "91 inspectable rules" marketing copy under the anemia-only, non-generalized
  // #algorithm tab per R-8, and "26" as a substring of every "2026-xx-xx" date in the document).
  // The scoped element-content check below is nonetheless a COMPLETE check of its own precise
  // claim: absence of any digit inside these two specific elements is absence.
  const ruleCountMatch = /<span id="nav-rule-count">([^<]*)<\/span>/.exec(indexHtmlSource);
  const patternCountMatch = /<span id="nav-pattern-count">([^<]*)<\/span>/.exec(indexHtmlSource);
  assert.ok(ruleCountMatch, '#nav-rule-count element must exist');
  assert.ok(patternCountMatch, '#nav-pattern-count element must exist');
  assert.equal(ruleCountMatch[1], '', '#nav-rule-count must carry no static fallback digits');
  assert.equal(patternCountMatch[1], '', '#nav-pattern-count must carry no static fallback digits');
});

test('P6-007 AC-6: nav counts are set from the loaded module\'s own rules/candidates array lengths', () => {
  const body = functionBody(appSource, 'updateNavCounts');
  assert.match(body, /String\(rules\.length\)/);
  assert.match(body, /String\(Object\.keys\(candidates\)\.length\)/);
});

test('P6-007 AC-6: #algorithm degrades via a moduleId-conditioned branch (moduleSupportsAlgorithmExplorer), with an identifier-sourced unavailable reason', () => {
  const predicateBody = functionBody(appSource, 'moduleSupportsAlgorithmExplorer');
  assert.match(predicateBody, /isModuleSelectable\(moduleId\)\s*&&\s*moduleId === DEFAULT_MODULE_ID/);
  const availabilityBody = functionBody(appSource, 'updateAlgorithmTabAvailability');
  assert.match(availabilityBody, /moduleSupportsAlgorithmExplorer\(activeModuleId\)/);
  assert.match(availabilityBody, /deriveAlgorithmUnavailableReason\(/);
});

test('P6-007 AC-6: #evidence degrades via a moduleId-conditioned branch (moduleHasEvidenceView), with an identifier-sourced unavailable reason — never an empty-but-present source list', () => {
  const predicateBody = functionBody(appSource, 'moduleHasEvidenceView');
  assert.match(predicateBody, /moduleId === DEFAULT_MODULE_ID/);
  const evidenceBody = functionBody(appSource, 'renderEvidence');
  assert.match(evidenceBody, /!moduleHasEvidenceView\(activeModuleId\)/);
  assert.match(evidenceBody, /deriveEvidenceViewUnavailableReason\(/);
  // The unavailable branch clears the container rather than leaving stale entries.
  const unavailableBranch = evidenceBody.slice(0, evidenceBody.indexOf('if (unavailable) unavailable.hidden = true;'));
  assert.match(unavailableBranch, /container\.innerHTML = '';/);
});

test('P6-007 AC-6: #rules source declares an explicit empty state (identifier-sourced) when rules.length === 0, never a blank panel', () => {
  const body = functionBody(appSource, 'renderRules');
  assert.match(body, /if \(rules\.length === 0\)/);
  const emptyBranch = body.slice(0, body.indexOf('const normalized'));
  assert.match(emptyBranch, /RULES_EMPTY_STATE/, 'must reference the vocabulary constant by identifier');
  // The rejected alternative phrasings are deliberately QUOTED in this branch's own explanatory
  // comment (documenting why they were rejected) — check only the actual rendered strings
  // (RULES_EMPTY_STATE's own value, and any OTHER string literal assigned in this branch), not the
  // comment prose discussing them.
  const codeOnly = emptyBranch.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(codeOnly, /not yet loaded|not yet available/i, 'must not use alternative phrasing implying a loading failure or a release pipeline');
});

test('P6-007 AC-6: the examples picker is emptied AND disabled (never anemia cases under another label) for a module with no example cases', () => {
  const predicateBody = functionBody(appSource, 'moduleHasExampleCases');
  assert.match(predicateBody, /isModuleSelectable\(moduleId\)\s*&&\s*moduleId === DEFAULT_MODULE_ID/);
  const updateBody = functionBody(appSource, 'updateExampleOptionsForActiveModule');
  assert.match(updateBody, /moduleHasExampleCases\(activeModuleId\)/);
  const notEligibleBranch = updateBody.slice(updateBody.indexOf('} else {'));
  assert.match(notEligibleBranch, /select\.innerHTML = '';/, 'must clear all options, never leave anemia cases listed');
  // "disabled" for the picker/button is asserted separately in updateAssessmentEnablement() and
  // showModuleRefusal() (P6-005) — this function owns only the option-list content, per its own
  // header comment; re-confirm that ownership boundary is documented, not silently assumed.
  assert.match(appSource, /This function owns ONLY the option-list content/);
});

test('P6-007 AC-7: manifest.title drives all eight named index.html copy sites via updateModuleDerivedPageCopy(), referenced by identifier', () => {
  const body = functionBody(appSource, 'updateModuleDerivedPageCopy');
  const sites = [
    'document.title',
    "#page-description",
    '#brand-link',
    '#brand-title',
    '#assessment-title',
    '#output-preview-primary',
    '#algorithm-heading-title',
    '#footer-brand-title',
    '#footer-kb-reviewed',
  ];
  for (const site of sites) assert.match(body, new RegExp(site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `updateModuleDerivedPageCopy must touch ${site}`);
  // All eight are driven from `title`/`view.title`, sourced from getManifestView — never a
  // hardcoded anemia literal re-assignment.
  assert.doesNotMatch(body, /Pediatric Anemia/);
});

test('P6-007 AC-7 (F11): document.title carries the ACTIVE module\'s own knowledgeBaseVersion, never the statically-imported anemia constant', () => {
  const body = functionBody(appSource, 'updateModuleDerivedPageCopy');
  assert.match(body, /document\.title = `\$\{title\} Decision Support — KB \$\{kbVersion\}`/);
  assert.match(body, /const kbVersion = view\?\.knowledgeBaseVersion \?\? 'unspecified';/);
  // The old anemia-only constant is discussed BY NAME in this fix's own explanatory comment
  // (documenting what it used to say and why that was wrong) — a raw whole-file scan would
  // false-positive on that documentation. Check only actual code (import statements / expressions),
  // never comment prose.
  const codeOnlyAppSource = appSource.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(codeOnlyAppSource, /KNOWLEDGE_BASE_VERSION/, 'src/app.js must not import/reference the statically-imported anemia-only KNOWLEDGE_BASE_VERSION constant in actual code');
});

test('P6-007 AC-7 resilience: source declares that a missing manifest.title falls back to the moduleId verbatim, never a generic "Assessment"', () => {
  const body = functionBody(appSource, 'updateModuleDerivedPageCopy');
  assert.match(body, /const title = \(view && view\.title\) \|\| activeModuleId;/);
  assert.doesNotMatch(body, /'Assessment'/);
});

test('P6-007 AC-6/AC-7 boundary: git diff on src/algorithmExplorer.js is empty vs. main — the anemia-shaped explorer is untouched, never generalized', () => {
  let diff;
  try {
    diff = execFileSync('git', ['diff', 'main', '--', 'src/algorithmExplorer.js'], { cwd: repoRoot, encoding: 'utf8' });
  } catch (error) {
    // A repo state where 'main' is unreachable (e.g. a shallow clone with no local main ref) must
    // not be silently read as "no diff" — surface it instead of passing vacuously.
    assert.fail(`could not diff src/algorithmExplorer.js against main: ${error.message}`);
  }
  assert.equal(diff, '', 'src/algorithmExplorer.js must be byte-identical to main — R-8 non-goal, this feature must never touch anemiaWalkthrough or any facts.* accessor');
});

// ================================================================================================
// P6-008 — allow-list: the renderer may read/emit ONLY id, title, status, knowledgeBaseVersion,
// evidenceReviewedThrough, approvedBy.length (AC-8). TIER: source-asserted.
//
// PRIMARY (allow-list) over getManifestView() — the SOLE function in src/app.js that reads
// `manifest.<field>` off the raw MODULE_MANIFESTS[moduleId] object (confirmed below: every other
// renderer consumes only the already-narrowed `view` object this function returns). Comment citing
// scripts/sign-kb.mjs:58-73's anemia hardcode (moduleDir = path.join(root, 'modules', 'anemia'),
// called per-module with no moduleId argument by build-static.mjs) as the reason
// manifest.clinicalContentHash can never be surfaced honestly today, so this allow-list cannot be
// relaxed to include it without first fixing that hardcode (DF-SMS-01).
// ================================================================================================

const ALLOWED_MANIFEST_FIELDS = ['id', 'title', 'status', 'knowledgeBaseVersion', 'evidenceReviewedThrough'];

function assertAllowListedManifestReads(source, label) {
  const { body } = namedFunctionRange(source, 'getManifestView');
  // Every `manifest.<field>` read must be one of the allow-listed fields, or `manifest.approvedBy`
  // ONLY as the argument to deriveApprovedByClause(...) (FR-9's sanctioned derivation — the raw
  // array is read but never rendered/exposed directly; only its length matters downstream).
  const fieldReads = [...body.matchAll(/manifest\.(\w+)/g)].map((m) => m[1]);
  for (const field of fieldReads) {
    const isAllowed = ALLOWED_MANIFEST_FIELDS.includes(field);
    const isApprovedByIntoDerivation = field === 'approvedBy' && body.includes('deriveApprovedByClause(manifest.approvedBy)');
    assert.ok(isAllowed || isApprovedByIntoDerivation, `${label}: manifest.${field} is not in the allow-list (id/title/status/knowledgeBaseVersion/evidenceReviewedThrough, or approvedBy solely into deriveApprovedByClause)`);
  }
  // BRACKET/TEMPLATE property access (post-review, codex adversarial finding): `manifest.<field>`
  // dot-notation is not the only way to read a property — `manifest['clinicalContentHash']`,
  // `manifest[dynamicVar]`, or `` manifest[`${x}`] `` would all bypass the dot-notation regex
  // above while reading the exact same data. ANY `manifest[...]` bracket access fails UNLESS its
  // key is a literal string matching an allow-listed field name (never `approvedBy` in bracket
  // form — the one sanctioned approvedBy read must stay dot-notation, matching the real source).
  for (const match of body.matchAll(/manifest\??\.?\[([^\]]*)\]/g)) {
    const keyExpr = match[1].trim();
    const literalMatch = /^(['"`])([a-zA-Z0-9_]+)\1$/.exec(keyExpr);
    assert.ok(literalMatch, `${label}: manifest[${keyExpr}] uses a non-literal or template-interpolated key — bracket access must use a plain allow-listed string literal, or not exist at all`);
    assert.ok(ALLOWED_MANIFEST_FIELDS.includes(literalMatch[2]), `${label}: manifest[${JSON.stringify(literalMatch[2])}] is not in the allow-list (bracket access to approvedBy is never sanctioned — dot-notation only)`);
  }
  // No destructuring of the manifest object.
  assert.doesNotMatch(body, /const\s*\{[^}]*\}\s*=\s*manifest\b/, `${label}: no destructuring of the manifest object`);
  // No bulk-serialization / spread / enumeration constructs.
  assert.doesNotMatch(body, /JSON\.stringify\(\s*manifest\s*\)/, `${label}: must not JSON.stringify(manifest)`);
  assert.doesNotMatch(body, /\{\s*\.\.\.manifest\s*\}/, `${label}: must not spread manifest`);
  assert.doesNotMatch(body, /Object\.entries\(\s*manifest\s*\)/, `${label}: must not Object.entries(manifest)`);
  assert.doesNotMatch(body, /Object\.keys\(\s*manifest\s*\)/, `${label}: must not Object.keys(manifest)`);
  // No assignment of the manifest object itself (or an un-narrowed subset) into a dataset/
  // innerHTML/textContent sink.
  assert.doesNotMatch(body, /dataset\.\w+\s*=\s*manifest\b/, `${label}: must not assign manifest into a dataset property`);
  assert.doesNotMatch(body, /innerHTML\s*=\s*manifest\b/, `${label}: must not assign manifest into innerHTML`);
  assert.doesNotMatch(body, /textContent\s*=\s*manifest\b/, `${label}: must not assign manifest into textContent`);
}

function assertGetManifestViewIsTheSoleManifestReader(source, label) {
  const { start, end } = namedFunctionRange(source, 'getManifestView');
  // WIDENED (post-review, codex adversarial finding): the original check scanned only the literal
  // substring `MODULE_MANIFESTS[`, which a second reader could evade entirely by ALIASING the map
  // to another identifier (`const m = MODULE_MANIFESTS; m[id].clinicalContentHash`) or reading a
  // field directly off it with dot notation (`MODULE_MANIFESTS.anemia.clinicalContentHash`) —
  // neither contains the literal text `MODULE_MANIFESTS[`. This now scans every occurrence of the
  // bare identifier `MODULE_MANIFESTS` (comment-stripped, so a comment merely discussing the name
  // — as this file's own header comment does — is correctly excluded) and requires each one to be
  // either the import statement or inside getManifestView()'s own body; nothing else may reference
  // the identifier at all, aliased or not.
  const stripped = stripCommentsPreservingOffsets(source);
  // `\?v=[^'"]*` optionally matches the build's cache-busting stamp — dist/src/app.js's import
  // specifiers are rewritten to `./moduleManifests.js?v=<hash>` by scripts/build-static.mjs, so
  // this must match both the dev and dist/ forms.
  const importLineMatch = /import\s*\{\s*MODULE_MANIFESTS\s*\}\s*from\s*['"]\.\/moduleManifests\.js(?:\?v=[^'"]*)?['"]\s*;/.exec(stripped);
  assert.ok(importLineMatch, `${label}: expected the exact MODULE_MANIFESTS import statement`);
  const importStart = importLineMatch.index;
  const importEnd = importStart + importLineMatch[0].length;
  const readSites = [...stripped.matchAll(/\bMODULE_MANIFESTS\b/g)].map((m) => m.index);
  for (const index of readSites) {
    const isImportSite = index >= importStart && index < importEnd;
    const isInsideGetManifestView = index >= start && index <= end;
    assert.ok(
      isImportSite || isInsideGetManifestView,
      `${label}: MODULE_MANIFESTS is referenced outside getManifestView() (and outside the import) at offset ${index} — this could be an alias, a dot-notation direct field read, or a second reader; the allow-list only guards getManifestView()`,
    );
  }
}

test('P6-008 PRIMARY: src/app.js — getManifestView() reads/emits ONLY the six allow-listed manifest fields, no bulk-serialization, no dataset/innerHTML/textContent manifest assignment', () => {
  assertAllowListedManifestReads(appSource, 'src/app.js');
});

test('P6-008 PRIMARY: src/app.js — getManifestView() is the SOLE reader of MODULE_MANIFESTS[...] in the whole file', () => {
  assertGetManifestViewIsTheSoleManifestReader(appSource, 'src/app.js');
});

test('P6-008 (mutation self-test): the allow-list check genuinely fails against a seeded manifest.clinicalContentHash read', () => {
  const mutated = appSource.replace(
    'evidenceReviewedThrough: manifest.evidenceReviewedThrough,',
    'evidenceReviewedThrough: manifest.evidenceReviewedThrough,\n    clinicalContentHash: manifest.clinicalContentHash,',
  );
  assert.notEqual(mutated, appSource, 'mutation must actually change the source');
  assert.throws(() => assertAllowListedManifestReads(mutated, 'mutant'), /clinicalContentHash is not in the allow-list/);
});

test('P6-008 (mutation self-test): the allow-list check genuinely fails against a seeded JSON.stringify(manifest)', () => {
  const mutated = appSource.replace(
    "if (!manifest) return null;",
    "if (!manifest) return null;\n  console.log(JSON.stringify(manifest));",
  );
  assert.throws(() => assertAllowListedManifestReads(mutated, 'mutant'), /must not JSON\.stringify\(manifest\)/);
});

test('P6-008 (mutation self-test): the allow-list check genuinely fails against a seeded sha256: fragment inside the scanned function body', () => {
  // Runs the SECONDARY token-scan layer (below) against a mutated getManifestView body carrying a
  // literal sha256: fragment, proving that layer is not vacuous either.
  const mutated = appSource.replace(
    "if (!manifest) return null;",
    "if (!manifest) return null;\n  // sha256:deadbeef",
  );
  const { body } = namedFunctionRange(mutated, 'getManifestView');
  assert.throws(() => {
    assert.doesNotMatch(body, /sha256:/, 'seeded mutation');
  }, /AssertionError/);
});

test('P6-008 (mutation self-test): the allow-list check genuinely fails against a seeded BRACKET-notation manifest read that dot-notation scanning alone would miss', () => {
  // Three bypass shapes, all seeded against the real getManifestView(): a literal-string bracket
  // read of a NON-allow-listed field; a dynamic (identifier) key, which can never be statically
  // verified safe no matter what it resolves to; and a bracket read of 'approvedBy' specifically
  // (sanctioned only in dot-notation form, per the allow-list's own rule).
  const mutations = [
    {
      label: 'literal non-allow-listed bracket key',
      code: "manifest['clinicalContentHash']",
      expectedError: /is not in the allow-list/,
    },
    {
      label: 'dynamic (identifier) bracket key',
      code: 'manifest[someDynamicKey]',
      expectedError: /non-literal or template-interpolated key/,
    },
    {
      label: 'bracket-form approvedBy (dot-notation only is sanctioned)',
      code: "manifest['approvedBy']",
      expectedError: /is not in the allow-list/,
    },
  ];
  for (const { label, code, expectedError } of mutations) {
    const mutated = appSource.replace(
      'evidenceReviewedThrough: manifest.evidenceReviewedThrough,',
      `evidenceReviewedThrough: manifest.evidenceReviewedThrough,\n    _seeded: ${code},`,
    );
    assert.notEqual(mutated, appSource, `${label}: mutation must actually change the source`);
    assert.throws(() => assertAllowListedManifestReads(mutated, 'mutant'), expectedError, `${label}: bracket-access bypass must be caught`);
  }
});

test('P6-008 (mutation self-test): the sole-reader check genuinely fails against a seeded MODULE_MANIFESTS alias and a seeded dot-notation direct field read', () => {
  const seededAppSource = appSource.replace(
    "const $ = (selector, root = document) => root.querySelector(selector);",
    "const __seededAlias = MODULE_MANIFESTS;\nconst $ = (selector, root = document) => root.querySelector(selector);",
  );
  assert.notEqual(seededAppSource, appSource);
  assert.throws(() => assertGetManifestViewIsTheSoleManifestReader(seededAppSource, 'mutant'), /MODULE_MANIFESTS is referenced outside getManifestView/, 'a bare-identifier alias assignment must be caught');

  const dotAccessAppSource = appSource.replace(
    "const $ = (selector, root = document) => root.querySelector(selector);",
    "const __seededDirect = MODULE_MANIFESTS.anemia;\nconst $ = (selector, root = document) => root.querySelector(selector);",
  );
  assert.throws(() => assertGetManifestViewIsTheSoleManifestReader(dotAccessAppSource, 'mutant'), /MODULE_MANIFESTS is referenced outside getManifestView/, 'a dot-notation direct field read outside getManifestView must be caught');
});

// --- SECONDARY: weaker token-scan layer, with exact negating-phrase carve-outs -------------------

const EXACT_NEGATING_PHRASES = [
  'no credentialed clinician has reviewed or approved this module',
  'not clinically reviewed',
  'no schema was validated',
  'not clinically validated',
  'not validated',
  // DOM element id, not prose — `#module-status-approved-by` names the FR-9 clause's DISPLAY
  // element (see src/app.js's own header comment above its use: "manifest's actual approvedBy
  // content" is what it renders, never a claim of approval on its own). Carved out by id, not by
  // a looser "approved-by" substring rule, so a real prose claim adjacent to this id still fails.
  'module-status-approved-by',
];

/** Several of the canonical sentences in src/moduleStatusVocabulary.js are authored as multi-line
 * JS string concatenations (`'...this ' + 'module...'`) — collapsing the quote/`+`/quote joins
 * back together lets the exact-phrase carve-outs below match the sentence as a CLINICIAN WOULD
 * READ IT (one continuous sentence), rather than requiring a separate literal variant per source
 * line-wrap, which would be a maintenance trap every time a string got re-wrapped. */
function normalizeStringConcatenation(source) {
  return source.replace(/(['"`])\s*\n\s*\+\s*\1/g, '');
}

function stripNegatingPhrases(text) {
  let stripped = normalizeStringConcatenation(text);
  for (const phrase of EXACT_NEGATING_PHRASES) {
    stripped = stripped.split(phrase).join(' '.repeat(phrase.length));
  }
  return stripped;
}

function assertNoProhibitedTokens(source, label) {
  const scanned = stripNegatingPhrases(source);
  assert.doesNotMatch(scanned, /sha256:/, `${label}: must not surface sha256:`);
  assert.doesNotMatch(scanned, /hashes\.recomputed/, `${label}: must not surface hashes.recomputed`);
  assert.doesNotMatch(scanned, /integrity verified/i, `${label}: must not claim "integrity verified"`);
  assert.doesNotMatch(scanned, /content unmodified/i, `${label}: must not claim "content unmodified"`);
  assert.doesNotMatch(scanned, /\bapproved\b/i, `${label}: bare "approved" found outside the negating FR-9 phrase`);
  assert.doesNotMatch(scanned, /clinically reviewed\b/i, `${label}: "clinically reviewed" found outside a negating phrase`);
  assert.doesNotMatch(scanned, /\breleased\b/i, `${label}: bare "released" found`);
  assert.doesNotMatch(scanned, /\bvalidated\b/i, `${label}: bare "validated" found outside a negating phrase`);
}

test('P6-008 SECONDARY (token scan): src/app.js carries no prohibited hash/approval/validation token outside its negating phrases', () => {
  assertNoProhibitedTokens(appSource, 'src/app.js');
});

test('P6-008 SECONDARY (token scan): src/moduleStatusVocabulary.js carries no prohibited token outside its negating phrases', () => {
  const vocabSource = readFileSync(path.join(repoRoot, 'src/moduleStatusVocabulary.js'), 'utf8');
  assertNoProhibitedTokens(vocabSource, 'src/moduleStatusVocabulary.js');
});

test('P6-008 SECONDARY (token scan): styles.css module-switcher/status-chip/module-status block carries no green/success CSS class name', () => {
  const blockStart = stylesCss.indexOf('.module-switcher {');
  assert.notEqual(blockStart, -1);
  const block = stylesCss.slice(blockStart, blockStart + 4000);
  assert.doesNotMatch(block, /\.success\b|\.approved\b|\.verified\b|status-(?:ok|good|passing)/i);
});

test('P6-008 SECONDARY (token scan, negating carve-outs are EXACT, not substring-loose): the real sanctioned FR-9 clause passes while a bare "approved" nearby would not', () => {
  const sanctioned = "approvedBy is empty: no credentialed clinician has reviewed or approved this module.";
  assert.doesNotThrow(() => assertNoProhibitedTokens(sanctioned, 'sanctioned clause'));
  const bareApproved = "this module has been approved for clinical use.";
  assert.throws(() => assertNoProhibitedTokens(bareApproved, 'bare approved'), /bare "approved"/);
});

test('P6-008(c) dist/ half — CORRECTED TARGET: dist/src/app.js (never the vacuous dist/index.html) gets the same allow-list and token-scan assertions', () => {
  const distAppPath = path.join(repoRoot, 'dist', 'src', 'app.js');
  assert.ok(existsSyncOrFail(distAppPath), 'dist/src/app.js must exist — run npm run build first');
  const distAppSource = readFileSync(distAppPath, 'utf8');
  assertAllowListedManifestReads(distAppSource, 'dist/src/app.js');
  assertGetManifestViewIsTheSoleManifestReader(distAppSource, 'dist/src/app.js');
  assertNoProhibitedTokens(distAppSource, 'dist/src/app.js');
});

function existsSyncOrFail(p) {
  try {
    readFileSync(p, 'utf8');
    return true;
  } catch {
    return false;
  }
}
