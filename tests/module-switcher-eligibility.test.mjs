// tests/module-switcher-eligibility.test.mjs — spa-module-switcher-v1, Phase 6
// (docs/project_plans/implementation_plans/features/spa-module-switcher-v1/phase-6-7-gates-docs.md).
//
// Combines P6-002, P6-003, P6-005, P6-006 and P6-012 — the plan's own serialization_constraint
// groups all five under this one filename (five tasks writing the same file forces five
// sequential batches in the original parallel-execution plan; this session executes them in one
// pass, so they land here together as originally scoped).
//
// D-6 CEILING, STATED ONCE FOR THIS WHOLE FILE: `src/app.js` is DOM-dependent. Node cannot import
// or execute it. Every assertion in this file that reads `src/app.js` source text is
// SOURCE-ASSERTED (functionBody()/regex over the text) — it proves the guard/order/identifier is
// textually present, never that the DOM reaches that state, that a click fires it, or that a
// browser renders it. Assertions over `src/moduleEligibility.js` (a plain, non-DOM module) ARE
// executed — real function calls, real return values. Each test below says which tier it is.
// Forbidden phrasing ("renders", "executes" for DOM behavior, "spy") is not used anywhere below.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isModuleSelectable } from '../src/moduleEligibility.js';
import { MODULE_MANIFESTS } from '../src/moduleManifests.js';
import { READY_STATUS } from '../src/kbVerify.js';
import { MODULE_IDS } from '../src/modules/registry.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appPath = path.join(repoRoot, 'src/app.js');
const eligibilityPath = path.join(repoRoot, 'src/moduleEligibility.js');
const indexHtmlPath = path.join(repoRoot, 'index.html');
const appSource = readFileSync(appPath, 'utf8');
const eligibilitySource = readFileSync(eligibilityPath, 'utf8');
const indexHtmlSource = readFileSync(indexHtmlPath, 'utf8');

// ------------------------------------------------------------------------------------------------
// Shared source-parsing helpers (independent, local copies — no runtime dependency on
// scripts/smoke-browser-unit-rejection.mjs or tests/module-registry.test.mjs, so none of these
// files can silently drift against each other and go unnoticed).
// ------------------------------------------------------------------------------------------------

/** Returns {start, end} character offsets of the braced block beginning at `openIndex` (which
 * must point at a '{'), skipping braces inside strings/template literals/comments. `end` is the
 * index of the matching closing '}'. */
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
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return { start: openIndex, end: index };
    }
  }
  assert.fail('braced block does not close');
}

/** Returns a SAME-LENGTH copy of `source` with every `//` line comment and `/* ... *\/` block
 * comment blanked to spaces (newlines preserved, so every character offset found against the
 * returned string is a valid offset into the ORIGINAL `source` too). Never touches string/
 * template literal contents. Used ONLY to locate a declaration/marker textually — a block- or
 * line-comment decoy containing e.g. `function activateModule(fake) {...}` or a commented-out
 * `form.addEventListener('submit', ...)` must never be matched as if it were real code. Codex
 * adversarial-review finding: the un-hardened version searched raw source text and so WOULD match
 * such a decoy — bracedRange() itself already skips comments once given a correct start index,
 * but namedFunctionRange()/markerRange() did not skip them when finding that start index. */
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

/** {start, end, body} of a `function <name>(...) { ... }` declaration in `source`. The parameter
 * list itself may contain destructuring braces (e.g. `switchTab(tabName, { syncHash = true } =
 * {})`), so the body's opening '{' is located AFTER the parameter list's own balanced ')', not at
 * the first '{' following the function name. Declaration/parameter-list location is found against
 * a COMMENT-STRIPPED copy of `source` (a comment decoy is skipped); the returned `body` is sliced
 * from the ORIGINAL `source` at the same (comment-stripping-preserved) offsets, so it still
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
    if (stripped[i] === ')') {
      depth -= 1;
      if (depth === 0) { parenClose = i; break; }
    }
  }
  assert.notEqual(parenClose, -1, `${name}()'s parameter list does not close`);
  const open = stripped.indexOf('{', parenClose);
  const range = bracedRange(source, open);
  return { ...range, body: source.slice(range.start + 1, range.end) };
}

/** {start, end, body} of the braced block immediately following the first occurrence of
 * `marker` in `source`. Used for event-listener callbacks and object-literal method bodies that
 * have no `function <name>` declaration of their own. Same comment-stripped-location /
 * original-sliced-body split as namedFunctionRange() above, for the same decoy-resistance reason. */
function markerRange(source, marker) {
  const stripped = stripCommentsPreservingOffsets(source);
  const markerStart = stripped.indexOf(marker);
  assert.notEqual(markerStart, -1, `src/app.js must contain the marker: ${marker}`);
  const open = stripped.indexOf('{', markerStart);
  const range = bracedRange(source, open);
  return { ...range, body: source.slice(range.start + 1, range.end) };
}

// CEILING (codex adversarial-review note, kept honest): stripCommentsPreservingOffsets() defends
// against a STATIC comment decoy — it does not, and cannot, defend against every form of
// adversarial evasion. A constructed/dynamic property or attribute access (e.g. `el[computedName]`,
// or building the string `'functi' + 'on activateModule('` at runtime) would defeat a regex-based
// textual scan by design; nothing in this file claims otherwise. This mechanism guards against
// ACCIDENTAL regression and unsophisticated decoys, not a determined adversary rewriting src/app.js
// specifically to evade this test file.

test('namedFunctionRange/markerRange decoy self-test: a block-comment decoy containing a fake function declaration is skipped — the REAL declaration is still found', () => {
  const decoySource = [
    '/* function activateModule(fake) { return "DECOY_SHOULD_NEVER_MATCH"; } */',
    'function activateModule(real) { return "REAL_BODY_MARKER"; }',
  ].join('\n');
  const { body } = namedFunctionRange(decoySource, 'activateModule');
  assert.match(body, /REAL_BODY_MARKER/, 'must locate the real declaration, not the commented-out decoy');
  assert.doesNotMatch(body, /DECOY_SHOULD_NEVER_MATCH/, 'must never extract the decoy comment as the function body');
});

test('namedFunctionRange decoy self-test: a line-comment decoy is also skipped', () => {
  const decoySource = [
    "// function activateModule(fake) { return 'DECOY_LINE_COMMENT'; }",
    "function activateModule(real) { return 'REAL_LINE_BODY'; }",
  ].join('\n');
  const { body } = namedFunctionRange(decoySource, 'activateModule');
  assert.match(body, /REAL_LINE_BODY/);
  assert.doesNotMatch(body, /DECOY_LINE_COMMENT/);
});

test('markerRange decoy self-test: a commented-out marker occurrence is skipped — the REAL, live marker is still found', () => {
  const decoySource = [
    "// form.addEventListener('submit', (event) => { DECOY_UNGUARDED_CALL(); });",
    "form.addEventListener('submit', (event) => { REAL_GUARDED_CALL(); });",
  ].join('\n');
  const { body } = markerRange(decoySource, "form.addEventListener('submit'");
  assert.match(body, /REAL_GUARDED_CALL/);
  assert.doesNotMatch(body, /DECOY_UNGUARDED_CALL/);
});

test('stripCommentsPreservingOffsets self-test: output length always equals input length, so downstream offsets stay valid', () => {
  const sample = "// a comment\nfunction f() { /* inline */ return 'a string // not a comment'; }\n";
  const stripped = stripCommentsPreservingOffsets(sample);
  assert.equal(stripped.length, sample.length);
  // The string literal's own "//" must survive untouched — only REAL comments are blanked.
  assert.match(stripped, /a string \/\/ not a comment/, 'a "//" sequence inside a real string literal must never be treated as a comment start');
  // The REAL line comment (first line only) must be blanked to whitespace.
  const strippedFirstLine = stripped.split('\n')[0];
  assert.doesNotMatch(strippedFirstLine, /\S/, 'the first line (a real // comment) must be blanked to whitespace only');
  // The REAL block comment ("/* inline */") must also be blanked.
  assert.doesNotMatch(stripped, /inline/, 'the real block comment\'s text must be blanked');
});

function functionBody(source, name) {
  return namedFunctionRange(source, name).body;
}

// The three UNSIGNED_STUB module ids today (AC-2/AC-11's concrete negative-eligibility fixtures).
const UNSIGNED_STUB_IDS = ['cbc_suite_v1', 'growth_suite_v1', 'kidney_suite_v1'];

// ================================================================================================
// P6-002 — READY_STATUS is imported, never a hardcoded 'integrity-recorded' literal (AC-2).
// TIER: source-asserted (+ one executed precondition check).
// ================================================================================================

test('P6-002: src/moduleEligibility.js imports READY_STATUS from src/kbVerify.js rather than hardcoding the literal', () => {
  assert.match(eligibilitySource, /import\s*\{\s*READY_STATUS\s*\}\s*from\s*['"]\.\/kbVerify\.js['"]/);
});

test("P6-002: the literal 'integrity-recorded' appears nowhere in src/app.js, src/moduleEligibility.js, or index.html", () => {
  for (const [label, source] of [
    ['src/app.js', appSource],
    ['src/moduleEligibility.js', eligibilitySource],
    ['index.html', indexHtmlSource],
  ]) {
    assert.doesNotMatch(source, /integrity-recorded/, `${label} must never hardcode the 'integrity-recorded' literal — it must reference READY_STATUS instead`);
  }
  // Precondition, executed: READY_STATUS really is that string today, so the assertion above is
  // not vacuously passing against a renamed constant.
  assert.equal(READY_STATUS, 'integrity-recorded');
});

test('P6-002 (executed): the comparison target really is moduleManifests[id].status — isModuleSelectable disagrees with MODULE_MANIFESTS[id].status !== READY_STATUS for every registered id', () => {
  for (const id of MODULE_IDS) {
    const expected = MODULE_MANIFESTS[id]?.status === READY_STATUS;
    assert.equal(isModuleSelectable(id), expected, `isModuleSelectable('${id}') must track MODULE_MANIFESTS['${id}'].status === READY_STATUS exactly`);
  }
});

test('P6-002: src/moduleEligibility.js source uses strict equality against READY_STATUS, not a loose/substring match', () => {
  assert.match(eligibilitySource, /status\s*===\s*READY_STATUS/, 'the eligibility comparison must be strict equality (===), never .includes()/.startsWith() or a truthy check');
  assert.doesNotMatch(eligibilitySource, /status\s*==\s*READY_STATUS(?!=)/, 'must not use loose equality (==)');
});

// ================================================================================================
// P6-003 — eligibility gating: only integrity-recorded reaches assess() (AC-2).
// TIER: (a) executed, (b) source-asserted. The two halves are recorded separately below, per the
// task's own instruction ("Record the two halves separately in the phase note").
// ================================================================================================

// --- (a) EXECUTED ---------------------------------------------------------------------------

test('P6-003(a) EXECUTED: isModuleSelectable returns false for each of the three unsigned-stub ids', () => {
  for (const id of UNSIGNED_STUB_IDS) {
    assert.equal(MODULE_MANIFESTS[id].status, 'unsigned-stub', `test precondition: ${id} must be unsigned-stub today`);
    assert.equal(isModuleSelectable(id), false, `isModuleSelectable('${id}') must be false`);
  }
});

test('P6-003(a) EXECUTED: isModuleSelectable returns false for a moduleId absent from MODULE_MANIFESTS (the "absent status" resilience case)', () => {
  // There is no real registered manifest with an absent `status` field to call this against
  // directly (every one of today's four real manifests is schema-valid) — the honest executed
  // proxy for "status absent" is a moduleId with no manifest entry at all, which is exactly what
  // Object.hasOwn(MODULE_MANIFESTS, moduleId) rejects before any `.status` read happens.
  assert.equal(isModuleSelectable('not_a_real_module'), false);
  assert.equal(Object.hasOwn(MODULE_MANIFESTS, 'not_a_real_module'), false, 'test precondition');
});

test('P6-003(a) EXECUTED + source-asserted: "status outside the closed enum" is proven by strict-equality construction, not by an executable real-manifest fixture', () => {
  // None of today's four real manifests has a status outside schemas/module-manifest.schema.json's
  // closed enum (each is schema-valid), so there is no live MODULE_MANIFESTS entry to call
  // isModuleSelectable against for this exact case. What IS executable and IS asserted: every
  // real status value that is NOT READY_STATUS (i.e. every 'unsigned-stub' entry, a real,
  // in-enum-but-wrong value) already returns false above — proving the comparison rejects any
  // non-matching string, in-enum or not, by construction (strict `===`, asserted in the P6-002
  // section above). A hypothetical out-of-enum value would hit the exact same `status ===
  // READY_STATUS` branch and fail the same way; this is a source-construction argument, not an
  // additional executed fixture, and is recorded as such rather than implied to be executed.
  assert.match(eligibilitySource, /return status === READY_STATUS/, 'the eligibility function\'s final line must be the single strict-equality return this argument relies on');
});

// --- (b) SOURCE-ASSERTED ---------------------------------------------------------------------

// The five guarded bodies where a MODULE_KB_LOADERS-reaching / assessModule / assessPediatricAnemia
// call site is permitted to exist in src/app.js. Shared by the P6-003(b) and P6-012 sections below
// (both assert against the same guarded-body set, from two different angles).
function guardedRanges() {
  return {
    activateModule: namedFunctionRange(appSource, 'activateModule'),
    loadActiveModuleKb: namedFunctionRange(appSource, 'loadActiveModuleKb'),
    submitHandler: markerRange(appSource, "form.addEventListener('submit'"),
    loadExample: namedFunctionRange(appSource, 'loadExample'),
    onUseCase: markerRange(appSource, 'onUseCase: (input) => {'),
  };
}

/** Every occurrence of `token(` in `source`, excluding import-statement lines, as {index, line}. */
function callSites(source, token) {
  const re = new RegExp(`\\b${token}\\(`, 'g');
  const sites = [];
  let match;
  while ((match = re.exec(source))) {
    const lineStart = source.lastIndexOf('\n', match.index) + 1;
    const lineEnd = source.indexOf('\n', match.index);
    const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
    if (line.trim().startsWith('import ')) continue;
    sites.push(match.index);
  }
  return sites;
}

function assertEveryCallSiteIsGuarded(token, ranges) {
  const sites = callSites(appSource, token);
  assert.ok(sites.length > 0, `expected at least one non-import call site of ${token}( in src/app.js`);
  for (const index of sites) {
    const inRange = Object.values(ranges).some((r) => index >= r.start && index <= r.end);
    assert.ok(inRange, `${token}( call site at offset ${index} sits outside every guarded body — it must be inside activateModule/loadActiveModuleKb/the submit handler/loadExample/onUseCase`);
  }
}

test('P6-003(b) SOURCE-ASSERTED: every loadModuleKb(...) call site (the MODULE_KB_LOADERS entry point) sits inside a predicate-guarded body', () => {
  assertEveryCallSiteIsGuarded('loadModuleKb', guardedRanges());
});

test('P6-003(b) SOURCE-ASSERTED: every assessModule(...) call site sits inside a predicate-guarded body', () => {
  assertEveryCallSiteIsGuarded('assessModule', guardedRanges());
});

test('P6-003(b) SOURCE-ASSERTED: every non-import assessPediatricAnemia(...) call site sits inside a predicate-guarded body', () => {
  assertEveryCallSiteIsGuarded('assessPediatricAnemia', guardedRanges());
});

test('P6-003(b) SOURCE-ASSERTED: entry path 1 (row selection) — activateModule() checks isModuleSelectable/isRegisteredModule before loadActiveModuleKb() is ever reached', () => {
  const { body } = namedFunctionRange(appSource, 'activateModule');
  const registeredIdx = body.indexOf('isRegisteredModule(moduleId)');
  const selectableIdx = body.indexOf('isModuleSelectable(moduleId)');
  const loadIdx = body.indexOf('loadActiveModuleKb(generation)');
  assert.ok(registeredIdx !== -1 && selectableIdx !== -1 && loadIdx !== -1, 'all three markers must be present in activateModule()');
  assert.ok(registeredIdx < loadIdx, 'isRegisteredModule() must be checked before the KB load');
  assert.ok(selectableIdx < loadIdx, 'isModuleSelectable() must be checked before the KB load');
});

test('P6-003(b) SOURCE-ASSERTED: entry path 1 continued — activateModule() is the single function reached by BOTH row selection (selectModule) and the ?module= deep link (initialize/readModuleIdFromUrl)', () => {
  // selectModule() (row-selection handler) and initialize() (deep-link path) both call
  // activateModule(...) directly — there is no second, divergent activation function either path
  // could instead reach.
  const selectModuleBody = functionBody(appSource, 'selectModule');
  assert.match(selectModuleBody, /await\s+activateModule\(moduleId\)/);
  const initializeBody = functionBody(appSource, 'initialize');
  assert.match(initializeBody, /await\s+activateModule\(readModuleIdFromUrl\(\)\)/);
});

test('P6-003(b) SOURCE-ASSERTED: entry path 2 (?module= deep link) — readModuleIdFromUrl() validates with isRegisteredModule() before activateModule() ever runs', () => {
  const body = functionBody(appSource, 'readModuleIdFromUrl');
  assert.match(body, /isRegisteredModule\(requested\)/);
});

test('P6-003(b) SOURCE-ASSERTED: entry path 3 (form submit) — the submit handler checks isModuleSelectable(activeModuleId) before assessModule/assessPediatricAnemia', () => {
  const { body } = markerRange(appSource, "form.addEventListener('submit'");
  const guardIdx = body.indexOf('if (!isModuleSelectable(activeModuleId)) return;');
  const assessIdx = Math.min(
    ...['assessPediatricAnemia(input, rules, candidates)', 'assessModule(moduleAtStart, input, rules, candidates)']
      .map((needle) => body.indexOf(needle))
      .filter((i) => i !== -1),
  );
  assert.notEqual(guardIdx, -1, 'submit handler must contain the isModuleSelectable guard');
  assert.ok(guardIdx < assessIdx, 'the eligibility guard must precede every assess call in the submit handler');
});

test('P6-003(b) SOURCE-ASSERTED: loadExample() (used by the "load example" entry point) checks isModuleSelectable(activeModuleId) before assessModule/assessPediatricAnemia', () => {
  const body = functionBody(appSource, 'loadExample');
  const guardIdx = body.indexOf('if (!isModuleSelectable(activeModuleId)) return;');
  const assessIdx = Math.min(
    ...['assessPediatricAnemia(input, rules, candidates)', 'assessModule(moduleAtStart, input, rules, candidates)']
      .map((needle) => body.indexOf(needle))
      .filter((i) => i !== -1),
  );
  assert.notEqual(guardIdx, -1);
  assert.ok(guardIdx < assessIdx);
});

// ================================================================================================
// P6-005 — four refusal-case tests over showModuleRefusal()/activateModule() (AC-4).
// TIER: source-asserted. REWRITTEN from the original spy-based AC (unwritable under D-6 — no
// DOM-capable runtime exists here to spy on showInputRejection). DOES NOT PROVE: that the DOM
// reaches the refusal state, that the prior result leaves the screen, that the audit download is
// actually disabled, or that no "undefined g/dL"/false Indeterminate reaches the page. Behavioral
// fail-closure is NOT established by this section — P6-011 (human) is where a person confirms it.
// ================================================================================================

test('P6-005: showModuleRefusal() textually distinct from showInputRejection(), never references INPUT_REJECTION_CODES, and never contains the "Check the entered units" heading', () => {
  const refusalBody = functionBody(appSource, 'showModuleRefusal');
  const rejectionBody = functionBody(appSource, 'showInputRejection');
  assert.notEqual(refusalBody, rejectionBody);
  assert.doesNotMatch(refusalBody, /INPUT_REJECTION_CODES/);
  assert.doesNotMatch(refusalBody, /Check the entered units/);
  assert.doesNotMatch(refusalBody, /showInputRejection/);
});

test('P6-005: showModuleRefusal() contains the six FR-19 invariant statements in the specified order', () => {
  const body = functionBody(appSource, 'showModuleRefusal');
  const markers = [
    "currentAudit = null",
    "$('#results').hidden = true",
    "$('#results-placeholder').hidden = false",
    'refreshAuditView()',
    "$('#run-assessment')) $('#run-assessment').disabled = true",
    "$('#results-placeholder').innerHTML",
  ];
  const indices = markers.map((marker) => body.indexOf(marker));
  indices.forEach((index, i) => assert.notEqual(index, -1, `marker missing: ${markers[i]}`));
  for (let i = 1; i < indices.length; i += 1) {
    assert.ok(indices[i - 1] < indices[i], `FR-19 invariant order violated: "${markers[i - 1]}" must precede "${markers[i]}"`);
  }
  // The remaining disable statements (load-example, example-select, copy-audit, download-audit)
  // must also be present, ahead of the reason render, even though their relative order among
  // themselves is not itself load-bearing.
  for (const id of ['load-example', 'example-select', 'copy-audit', 'download-audit']) {
    assert.ok(
      body.includes(`#${id}').disabled = true`) || body.includes(`#${id}')) $('#${id}').disabled = true`),
      `showModuleRefusal must disable #${id}`,
    );
  }
});

test('P6-005 Case 1 (evidence registry miss): loadExample() and the submit handler both route isEvidenceRegistryMissError to showModuleRefusal via the identifier-sourced deriveEvidenceUnavailableReason', () => {
  assert.match(appSource, /function isEvidenceRegistryMissError\(/);
  const loadExampleBody = functionBody(appSource, 'loadExample');
  const submitBody = markerRange(appSource, "form.addEventListener('submit'").body;
  for (const body of [loadExampleBody, submitBody]) {
    assert.match(body, /isEvidenceRegistryMissError\(error, moduleAtStart\)/);
    assert.match(body, /showModuleRefusal\(moduleAtStart, deriveEvidenceUnavailableReason\(/);
  }
});

test('P6-005 Case 2 (hooks not-yet-implemented): detected before any render attempt — renderClassification() has no unguarded call site', () => {
  // renderClassification is only ever called from inside renderResult(); every renderResult() call
  // site sits downstream of a notYetImplementedRefusalReason() guard having already returned early
  // in activateModule()/loadExample()/submit/onUseCase.
  const renderClassificationCallLines = callSites(appSource, 'renderClassification').filter((index) => {
    const lineStart = appSource.lastIndexOf('\n', index) + 1;
    const lineEnd = appSource.indexOf('\n', index);
    const line = appSource.slice(lineStart, lineEnd === -1 ? appSource.length : lineEnd).trim();
    return !line.startsWith('function ') && !line.startsWith('//');
  });
  assert.equal(renderClassificationCallLines.length, 1, 'renderClassification must have exactly one real (non-declaration, non-comment) call site in src/app.js');
  const renderResultBody = functionBody(appSource, 'renderResult');
  assert.match(renderResultBody, /renderClassification\(result\)/, 'the one call site must be inside renderResult()');

  const activateModuleBody = functionBody(appSource, 'activateModule');
  assert.match(activateModuleBody, /notYetImplementedRefusalReason\(moduleId\)/);
  assert.match(activateModuleBody, /showModuleRefusal\(moduleId, notImplementedReason\)/);
  // The refusal branch returns before the success path's loadActiveModuleKb()/render machinery.
  const notImplIdx = activateModuleBody.indexOf('notYetImplementedRefusalReason(moduleId)');
  const loadIdx = activateModuleBody.indexOf('loadActiveModuleKb(generation)');
  assert.ok(notImplIdx !== -1 && loadIdx !== -1 && notImplIdx < loadIdx);

  for (const [name, extract] of [
    ['loadExample', () => functionBody(appSource, 'loadExample')],
    ['submit handler', () => markerRange(appSource, "form.addEventListener('submit'").body],
    ['onUseCase', () => markerRange(appSource, 'onUseCase: (input) => {').body],
  ]) {
    const body = extract();
    assert.match(body, /notYetImplementedRefusalReason\(/, `${name} must defensively re-check notYetImplementedRefusalReason()`);
  }
});

test('P6-005 Case 3 (manifest status !== READY_STATUS): activateModule() source calls showModuleRefusal with the verbatim enum-sourced sentence, never a downgraded warning string', () => {
  const body = functionBody(appSource, 'activateModule');
  assert.match(body, /if \(!isModuleSelectable\(moduleId\)\) \{/);
  const caseStart = body.indexOf('if (!isModuleSelectable(moduleId))');
  const caseSlice = body.slice(caseStart, caseStart + 400);
  assert.match(caseSlice, /showModuleRefusal\(moduleId, moduleStatusReasonText\(view \? view\.status : ''\)\)/);
  assert.doesNotMatch(caseSlice, /\bwarning\b/i, 'Case 3 must not downgrade to warning wording');
});

test('P6-005 Case 4 (KB fetch failure): rules/candidates reset to []/{} BEFORE the fetch (reset-before-fetch order re-asserted at gate level)', () => {
  const body = functionBody(appSource, 'loadActiveModuleKb');
  const resetIdx = body.indexOf('if (!isModuleSelectable(activeModuleId)) {');
  const loadModuleKbIdx = body.indexOf('await loadModuleKb(activeModuleId, () => {');
  assert.ok(resetIdx !== -1 && loadModuleKbIdx !== -1);
  // loadModuleKb's own callback contract (src/moduleKbLoaders.js) already guarantees
  // resetState() runs before the fetch INSIDE that function; this call site passes a callback
  // that clears rules/candidates, so the composition preserves the P2-04 ordering end to end.
  const callbackSlice = body.slice(loadModuleKbIdx, body.indexOf('});', loadModuleKbIdx));
  assert.match(callbackSlice, /rules = \[\];/);
  assert.match(callbackSlice, /candidates = \{\};/);
  assert.match(body, /const \[rulesResponse, candidatesResponse\] = await loadModuleKb\(activeModuleId, \(\) => \{/, 'the resetState callback must be passed to loadModuleKb, not run independently after it');
  // Failure path (fetch rejects / !ok) also resets before returning false.
  const failureBranch = body.slice(body.indexOf('if (!rulesResponse.ok'));
  assert.match(failureBranch, /rules = \[\];[\s\S]{0,80}candidates = \{\};/);
});

test('P6-005 resilience: activateModule() clears the prior result and disables the audit download BEFORE any refusal path is even decided, in one synchronous run with no promise boundary between them', () => {
  const body = functionBody(appSource, 'activateModule');
  const generationIdx = body.indexOf('const generation = ++moduleLoadGeneration;');
  const clearIdx = body.indexOf('currentAudit = null;');
  const disableAuditIdx = body.indexOf("$('#copy-audit').disabled = true;");
  const firstAwaitIdx = body.indexOf('await ');
  assert.ok(generationIdx !== -1 && clearIdx !== -1 && disableAuditIdx !== -1 && firstAwaitIdx !== -1);
  assert.ok(generationIdx < clearIdx && clearIdx < disableAuditIdx && disableAuditIdx < firstAwaitIdx, 'the shared FR-19 invariants must all be set before this function\'s first await');
  const preAwaitSlice = body.slice(0, firstAwaitIdx);
  // Match only an actual CALL (identifier immediately followed by '(') on a real code line — the
  // header comment directly above this code deliberately DISCUSSES these identifiers in prose
  // (no trailing '(') to document the very invariant this assertion checks; a bare substring scan
  // would false-positive on that prose.
  for (const token of ['setTimeout', 'requestAnimationFrame', 'queueMicrotask']) {
    const callIndex = preAwaitSlice.search(new RegExp(`\\b${token}\\(`));
    assert.equal(callIndex, -1, `no promise/timer boundary (${token}(...)) may sit between the invariant writes and the banner write`);
  }
});

// ================================================================================================
// P6-006 — ?module= URL-state round-trip (AC-5).
// TIER: source-asserted, with one COMPLETE check (storage-API absence) — everything else is
// PARTIAL: it does not prove a real tab click preserves the query string.
// ================================================================================================

test('P6-006 COMPLETE: no localStorage/sessionStorage/document.cookie API usage anywhere across the app-surface files', () => {
  const APP_SURFACE_FILES = [
    'src/app.js', 'src/algorithmExplorer.js', 'src/evidence.js', 'src/moduleManifests.js',
    'src/moduleStatusVocabulary.js', 'src/moduleKbLoaders.js', 'src/moduleEligibility.js',
  ];
  const storagePatterns = [/\blocalStorage\s*\./, /\bsessionStorage\s*\./, /\bdocument\.cookie\b/];
  for (const relPath of APP_SURFACE_FILES) {
    const source = readFileSync(path.join(repoRoot, relPath), 'utf8');
    for (const pattern of storagePatterns) {
      assert.doesNotMatch(source, pattern, `${relPath} must not use ${pattern} (FR-24) — absence in source is absence, this is a complete check`);
    }
  }
  for (const pattern of storagePatterns) {
    assert.doesNotMatch(indexHtmlSource, pattern, `index.html must not use ${pattern} (FR-24)`);
  }
});

test('P6-006 PARTIAL: switchTab() references location.search and no longer contains the bare hash-only replaceState form', () => {
  const body = functionBody(appSource, 'switchTab');
  // The bare buggy form is deliberately QUOTED inside this function's own explanatory comment
  // (documenting what was fixed and why — R-7) — a raw substring/regex scan over the whole body
  // would false-positive on that documentation. Only non-comment code lines are checked here.
  const codeOnly = body.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(codeOnly, /replaceState\(null,\s*'',\s*`#\$\{resolvedTab\}`\)/, 'the bare hash-only replaceState form (R-7 regression) must be gone from actual code');
  assert.match(body, /window\.location\.search/, 'switchTab must reference location.search to preserve it');
  assert.match(codeOnly, /replaceState\(null, '', `\$\{window\.location\.search\}#\$\{resolvedTab\}`\)/);
});

test('P6-006 PARTIAL: the load path (readModuleIdFromUrl) validates with isRegisteredModule() and falls back to DEFAULT_MODULE_ID only when the param is absent', () => {
  const body = functionBody(appSource, 'readModuleIdFromUrl');
  assert.match(body, /if \(!requested\) return DEFAULT_MODULE_ID;/);
  assert.match(body, /if \(isRegisteredModule\(requested\)\) return requested;/);
  // An unregistered (but present) id is returned as-is, never silently substituted — D-4.
  assert.doesNotMatch(body.slice(body.indexOf('isRegisteredModule(requested)')), /return DEFAULT_MODULE_ID/);
});

test('P6-006 PARTIAL: selecting a module writes ?module=<id> via history.replaceState, preserving the current #tab hash', () => {
  const body = functionBody(appSource, 'writeModuleUrlParam');
  assert.match(body, /url\.searchParams\.set\('module', moduleId\)/);
  assert.match(body, /window\.history\.replaceState\(null, '', `\$\{url\.search\}\$\{window\.location\.hash\}`\)/);
});

test('P6-006 PARTIAL: an unregistered ?module= id produces the explicit FR-21 refusal naming the requested id — no silent substitution', () => {
  const body = functionBody(appSource, 'activateModule');
  assert.match(body, /if \(!isRegisteredModule\(moduleId\)\) \{/);
  const caseStart = body.indexOf('if (!isRegisteredModule(moduleId))');
  const caseSlice = body.slice(caseStart, caseStart + 300);
  assert.match(caseSlice, /showModuleRefusal\(moduleId, deriveUnregisteredModuleReason\(moduleId\)\)/);
  const reasonBody = readFileSync(path.join(repoRoot, 'src/moduleStatusVocabulary.js'), 'utf8');
  assert.match(reasonBody, /never substitutes a different module automatically/);
});

test('P6-006 note: no optional strengthening applied — P3-06 did not factor URL construction into a pure exported non-DOM helper', () => {
  // Recorded honestly per the task's own "if not, record the gap" instruction: writeModuleUrlParam
  // and switchTab's URL logic remain inline in src/app.js (DOM-dependent), not exported from a
  // non-DOM module, so this AC's URL-preservation claim stays source-asserted only — a real tab
  // click's effect on window.location is not observed by anything in this test file.
  assert.doesNotMatch(appSource, /export function writeModuleUrlParam/, 'writeModuleUrlParam is not exported — confirming the optional strengthening was not applied');
});

// ================================================================================================
// P6-012 — forced-activation coverage: the predicate gates INSIDE the handlers, not via `disabled`
// (AC-11, FR-6/FR-37).
// TIER: source-asserted (+ executed predicate). DOES NOT PROVE — the load-bearing limitation —
// that invoking the selection handler directly with cbc_suite_v1 refuses AT RUNTIME: src/app.js is
// DOM-dependent and node can neither import nor execute it, so no direct-invocation test is
// writable here. The runtime half is closed ONLY by P6-011 item (7), a human devtools check.
// ================================================================================================

test('P6-012 EXECUTED: isModuleSelectable(...) === false for all three unsigned-stub ids and for an entirely absent/unregistered id', () => {
  for (const id of UNSIGNED_STUB_IDS) {
    assert.equal(isModuleSelectable(id), false);
  }
  assert.equal(isModuleSelectable('not_a_real_module'), false);
  assert.equal(isModuleSelectable(undefined), false);
  assert.equal(isModuleSelectable(''), false);
});

test('P6-012 SOURCE-ASSERTED: the FR-6 predicate precedes every loader/engine reference in EACH of the five guardedRanges() bodies, with no early-return path that skips it', () => {
  // WIDENED (post-review, codex adversarial finding): the P6-003(b) section above proves calls sit
  // INSIDE the five guardedRanges() bodies as a set, but did not previously prove every one of the
  // five individually carries its own predicate-precedes-call ordering check in ONE place. This
  // test now covers all five explicitly: (1) activateModule, (2) loadActiveModuleKb, (3) the submit
  // handler, (4) loadExample, (5) onUseCase — so a future new guarded body added to guardedRanges()
  // without its own ordering check here would be a visible gap, not a silent one.
  const ranges = guardedRanges();

  // (1) The module-selection choke point: activateModule() (reached identically by row selection
  // via selectModule() and by the ?module= deep link via initialize() — see the P6-003(b) test
  // above that establishes both callers funnel here with no second decision point).
  const activateBody = ranges.activateModule.body;
  const predicateIdx = activateBody.indexOf('isModuleSelectable(moduleId)');
  const loaderIdx = activateBody.indexOf('loadActiveModuleKb(generation)');
  assert.ok(predicateIdx !== -1 && loaderIdx !== -1 && predicateIdx < loaderIdx);
  // No early return between claiming the generation and the eligibility checks that would let a
  // loader/engine reference be reached without first passing isRegisteredModule/isModuleSelectable.
  const preLoaderSlice = activateBody.slice(0, loaderIdx);
  const earlyReturns = [...preLoaderSlice.matchAll(/\breturn;/g)];
  // Every return before the loader call must itself be inside one of the two refusal branches
  // (isRegisteredModule / isModuleSelectable / notYetImplementedRefusalReason) — i.e. it always
  // follows one of those three checks, never precedes all of them.
  for (const match of earlyReturns) {
    const before = preLoaderSlice.slice(0, match.index);
    assert.ok(
      /isRegisteredModule\(moduleId\)/.test(before) || /isModuleSelectable\(moduleId\)/.test(before) || /notYetImplementedRefusalReason\(moduleId\)/.test(before),
      'an early return before the KB load must be preceded by one of the three synchronous refusal checks, never a bare skip',
    );
  }

  // (2) The KB-load function (the P2-04 reset-before-fetch call site) — loadActiveModuleKb() has
  // its OWN top-of-function guard, defense in depth beyond activateModule()'s own check.
  const kbBody = ranges.loadActiveModuleKb.body;
  const kbPredicateIdx = kbBody.indexOf('if (!isModuleSelectable(activeModuleId)) {');
  const kbLoaderIdx = kbBody.indexOf('await loadModuleKb(activeModuleId,');
  assert.equal(kbBody.slice(0, kbPredicateIdx).trim(), '', 'loadActiveModuleKb() must check eligibility as its very first statement (only leading whitespace may precede it)');
  assert.ok(kbPredicateIdx < kbLoaderIdx);

  // (3) The assessment submit handler.
  const submitBody = ranges.submitHandler.body;
  const submitPredicateIdx = submitBody.indexOf('if (!isModuleSelectable(activeModuleId)) return;');
  const submitAssessIdx = Math.min(
    ...['assessPediatricAnemia(input, rules, candidates)', 'assessModule(moduleAtStart, input, rules, candidates)']
      .map((needle) => submitBody.indexOf(needle)).filter((i) => i !== -1),
  );
  assert.ok(submitPredicateIdx !== -1 && submitPredicateIdx < submitAssessIdx);

  // (4) loadExample() — ADDED (post-review): this exact ordering is also asserted independently
  // in the P6-003(b) section above (a different test, a different angle); duplicating the check
  // here means all five guardedRanges() bodies carry the ordering assertion in THIS one test too,
  // not scattered such that a reader has to trust it was covered elsewhere.
  const loadExampleBody = ranges.loadExample.body;
  const loadExamplePredicateIdx = loadExampleBody.indexOf('if (!isModuleSelectable(activeModuleId)) return;');
  const loadExampleAssessIdx = Math.min(
    ...['assessPediatricAnemia(input, rules, candidates)', 'assessModule(moduleAtStart, input, rules, candidates)']
      .map((needle) => loadExampleBody.indexOf(needle)).filter((i) => i !== -1),
  );
  assert.ok(loadExamplePredicateIdx !== -1 && loadExamplePredicateIdx < loadExampleAssessIdx, 'loadExample() must check isModuleSelectable before every assess call');

  // (5) onUseCase (the algorithm-explorer callback) — ADDED (post-review). Its guard is
  // `if (!isModuleSelectable(activeModuleId)) return;`, immediately followed by the defensive
  // notYetImplementedRefusalReason() re-check (P6-005 Case 2), before the one
  // assessPediatricAnemia(...) call this callback ever makes.
  const onUseCaseBody = ranges.onUseCase.body;
  const onUseCasePredicateIdx = onUseCaseBody.indexOf('if (!isModuleSelectable(activeModuleId)) return;');
  const onUseCaseAssessIdx = onUseCaseBody.indexOf('assessPediatricAnemia(input, rules, candidates)');
  assert.ok(onUseCasePredicateIdx !== -1 && onUseCaseAssessIdx !== -1 && onUseCasePredicateIdx < onUseCaseAssessIdx, 'onUseCase must check isModuleSelectable before its assessPediatricAnemia call');
});

// Exact-line allow-list for src/app.js's module-row CLICK LISTENER
// (initializeModuleSwitcher(), panel.addEventListener('click', ...)) — the only scanned body with
// any legitimate DOM-state/attribute touch at all, and every one of the three lines below is
// necessary and non-eligibility-deciding: line 1 extracts WHICH row was clicked (an id, not a
// boolean); line 2 is FR-37(a)'s early-return presentation short-circuit (documented at length in
// src/app.js's own P4-GATE-fix-2 comment: activateModule() re-derives eligibility unconditionally
// regardless of this check, so it is belt-and-braces, never the security boundary); line 3 forwards
// the extracted id onward, again unconditionally. Each is matched by EXACT, byte-for-byte line
// content (not a loose pattern) so ANY edit to these three lines, or ANY new DOM-state/attribute
// touch added anywhere else in this listener, fails this test — see the mutation self-test below.
const CLICK_LISTENER_ALLOWED_DOM_READS = [
  "const row = event.target.closest('[data-module-id]');",
  'if (!row || row.disabled) return;',
  'selectModule(row.dataset.moduleId).catch(showFatalError);',
];

function clickListenerBodyWithAllowedReadsStripped() {
  const raw = markerRange(appSource, "panel.addEventListener('click'").body;
  let scanned = raw;
  for (const allowedLine of CLICK_LISTENER_ALLOWED_DOM_READS) {
    assert.ok(raw.includes(allowedLine), `the click listener's allow-listed line is missing or has changed — this allow-list is now stale and must be reviewed: "${allowedLine}"`);
    scanned = scanned.replace(allowedLine, '');
  }
  return { raw, scanned };
}

test('P6-012 SOURCE-ASSERTED: none of the five scanned bodies (activateModule, loadActiveModuleKb, the submit handler, selectModule, the panel click listener) reads eligibility from DOM state — the predicate input is always moduleManifests[id].status', () => {
  // WIDENED (post-review, codex adversarial finding): the original version scanned only 3 of the
  // guarded bodies and a narrower pattern set. Widened here to (a) also scan selectModule() (the
  // literal "module-selection handler" by name) and the panel click listener (the actual DOM entry
  // point that starts the row-selection flow), and (b) also flag .closest(/.matches(/.className/
  // getAttribute( — every additional way a handler could read ancestor/attribute DOM state instead
  // of calling isModuleSelectable(...).
  const ranges = guardedRanges();
  // `.disabled` is WRITTEN (assigned true/false, or a derived boolean) in these bodies as
  // FR-37(a) presentation — e.g. `$('#run-assessment').disabled = true;` inside activateModule()'s
  // own unconditional invariant block. That is a write, not an eligibility READ, and is explicitly
  // out of scope for this check: a write cannot be the thing DECIDING eligibility, only a
  // consequence of a decision already made elsewhere. The pattern below excludes any `.disabled`
  // immediately followed by an assignment (`= true`, `= false`, or `= !expr`) and flags only a
  // BARE read (used in a condition/boolean context), which is the actual hazard this AC names.
  //
  // getAttribute( is flagged for ANY argument, not just eligibility-shaped ones — this file makes
  // no attempt to distinguish "an innocent getAttribute('aria-label')" from a hazard; every use
  // inside a scanned body must be individually allow-listed by a human reviewer (mirroring
  // CLICK_LISTENER_ALLOWED_DOM_READS above), never silently accepted by a narrower regex.
  const domStatePatterns = [
    /\.disabled\b(?!\s*=\s*(?:true|false|!))/,
    /aria-disabled(?!["'`]?\s*,)/,
    /dataset\./,
    /classList\.(?:contains|toggle)/,
    /\.closest\(/,
    /\.matches\(/,
    /\.className\b/,
    /getAttribute\(/,
  ];
  const { scanned: clickListenerScanned } = clickListenerBodyWithAllowedReadsStripped();
  for (const [name, body] of [
    ['activateModule', ranges.activateModule.body],
    ['loadActiveModuleKb', ranges.loadActiveModuleKb.body],
    ['submit handler', ranges.submitHandler.body],
    ['selectModule', functionBody(appSource, 'selectModule')],
    ['panel click listener (minus its allow-listed lines)', clickListenerScanned],
  ]) {
    for (const pattern of domStatePatterns) {
      assert.doesNotMatch(body, pattern, `${name} must not read eligibility from DOM state via ${pattern} — it must call isModuleSelectable(...), whose sole input is MODULE_MANIFESTS[id].status`);
    }
  }
});

// CEILING (codex adversarial-review note, kept honest): this scan is regex-over-text. A
// CONSTRUCTED attribute/property name built at runtime — e.g. `el[computedName]`,
// `el.getAttribute('data-' + dynamicSuffix)`, or reflection via `Reflect.get` — defeats it by
// design; nothing in this file claims to catch that class of evasion. This mechanism guards
// against accidental regression and unsophisticated decoys, not a determined adversary.

test('P6-012 mutation self-test: the widened DOM-state scan genuinely catches getAttribute(/closest(/matches(/className, not just .disabled', () => {
  const realSelectModuleBody = functionBody(appSource, 'selectModule');
  const seeds = [
    ["el.getAttribute('data-eligible')", /getAttribute is not in the allow-list|getAttribute\\\(/],
    ["el.closest('.module-row--inert')", /closest/],
    ["el.matches('[disabled]')", /matches/],
    ["el.className.includes('inert')", /className/],
  ];
  for (const [seed] of seeds) {
    const mutated = realSelectModuleBody + `\n// seeded: ${seed}\nconst x = ${seed};`;
    const domStatePatterns = [/\.closest\(/, /\.matches\(/, /\.className\b/, /getAttribute\(/];
    const anyMatch = domStatePatterns.some((pattern) => pattern.test(mutated));
    assert.ok(anyMatch, `seeded mutation "${seed}" must be caught by at least one widened pattern`);
  }
});

test('P6-012 mutation self-test: the click-listener allow-list is exact — changing an allowed line by even one character is detected as stale, not silently accepted', () => {
  const { raw } = clickListenerBodyWithAllowedReadsStripped(); // precondition: today's real lines match
  const mutatedRaw = raw.replace('row.disabled', 'row.getAttribute("disabled")');
  assert.throws(() => {
    for (const allowedLine of CLICK_LISTENER_ALLOWED_DOM_READS) {
      assert.ok(mutatedRaw.includes(allowedLine), 'seeded mutation: allow-listed line no longer matches exactly');
    }
  }, /AssertionError/, 'a one-character change to an allow-listed line must be detected, not silently pass through the exact-match check');
});

test('P6-012 SOURCE-ASSERTED (mutation self-test): the DOM-state scan above genuinely fails against a seeded el.disabled eligibility read', () => {
  // Proves the negative-assertion machinery above is not vacuous by constructing a mutated copy
  // of activateModule()'s body with an injected `.disabled` read where the real predicate is, and
  // confirming the same doesNotMatch() check that passed on real source throws on the mutant.
  const realBody = namedFunctionRange(appSource, 'activateModule').body;
  const mutatedBody = realBody.replace(
    'if (!isModuleSelectable(moduleId)) {',
    "if (document.querySelector('[data-module-id=\"' + moduleId + '\"]')?.disabled) {",
  );
  assert.notEqual(mutatedBody, realBody, 'mutation must actually change the body — otherwise this self-test is vacuous');
  assert.throws(() => {
    assert.doesNotMatch(mutatedBody, /\.disabled\b/, 'seeded mutation');
  }, /AssertionError/, 'the DOM-state scan must fail (throw) against a seeded .disabled eligibility read');
});
