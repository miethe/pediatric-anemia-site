import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_IDS, DEFAULT_MODULE_ID, loadModuleCode } from '../src/modules/registry.js';

// SPIKE-002 Q5 / platform-foundation-p0-v1.md Sequencing Note 5: this file shipped assertions
// 1, 3, 4, and 5 in Phase 5. Assertion 2 (manifest shape) had a hard dependency on
// modules/<id>/module.json, which did not exist until Phase 6 — P6-T3 adds it below now that
// module.json has landed.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('assertion 1: registry completeness — MODULE_IDS non-empty, unique, includes DEFAULT_MODULE_ID', () => {
  assert.ok(MODULE_IDS.length > 0, 'MODULE_IDS must not be empty');
  assert.equal(new Set(MODULE_IDS).size, MODULE_IDS.length, 'MODULE_IDS must contain no duplicate ids');
  assert.ok(MODULE_IDS.includes(DEFAULT_MODULE_ID), 'MODULE_IDS must include DEFAULT_MODULE_ID');

  // P6-010 (Tripwire A — spa-module-switcher-v1, phase-6-7-gates-docs.md): this comment used to
  // say "today there is exactly one registered module" and instructed updating/deleting this
  // assertion "the day a second module registers." FOUR modules are registered today
  // (anemia, cbc_suite_v1, growth_suite_v1, kidney_suite_v1) — that trigger actually FIRED at
  // commit 263120b (the E1 multi-bundle conversion) and sat UNACTIONED until this correction.
  // This is pre-existing debt this feature's P6-010 gate task closed by fixing the comment's
  // factual claim — it is NOT something the spa-module-switcher-v1 feature caused. The separate,
  // *different* trigger this feature DOES fire — "a client-selectable moduleId surface actually
  // ships" — is tracked and decided at src/modules/registry.js:39-50 (Tripwire B), not here.
  // DEFAULT_MODULE_ID is still correctly 'anemia': registering more modules alone was never the
  // real trigger for revisiting this constant (see src/modules/registry.js's own header comment).
  assert.equal(MODULE_IDS.length, 4, 'four modules are registered today — correct the count above if this drifts');
  assert.equal(DEFAULT_MODULE_ID, 'anemia');
});

test('assertion 2: manifest shape — modules/<id>/module.json exists, parses, and manifest.id === id', async () => {
  for (const moduleId of MODULE_IDS) {
    const filePath = path.join(root, 'modules', moduleId, 'module.json');
    const raw = await readFile(filePath, 'utf8');
    let manifest;
    assert.doesNotThrow(() => {
      manifest = JSON.parse(raw);
    }, `modules/${moduleId}/module.json must parse as JSON`);
    assert.equal(manifest.id, moduleId, `modules/${moduleId}/module.json id must equal directory id`);
  }
});

test('assertion 3: per-module KB files exist and parse for every registered module', async () => {
  for (const moduleId of MODULE_IDS) {
    const moduleDir = path.join(root, 'modules', moduleId);
    for (const filename of ['rules.json', 'candidates.json', 'evidence.json', 'reference-ranges.json']) {
      const filePath = path.join(moduleDir, filename);
      const raw = await readFile(filePath, 'utf8');
      assert.doesNotThrow(() => JSON.parse(raw), `${moduleId}/${filename} must parse as JSON`);
    }
  }
});

test('assertion 4: loadModuleCode resolves module code exporting deriveFacts', async () => {
  const moduleCode = await loadModuleCode('anemia');
  assert.equal(typeof moduleCode.deriveFacts, 'function', 'loaded module code must export a deriveFacts function');
});

// Assertion 5: tests/engine.test.mjs's existing assertions keep running unmodified. This file
// is purely additive and tests/engine.test.mjs is untouched by this phase; both are
// auto-discovered by the `node --test tests/*.test.mjs` glob (package.json "test" script), so
// no duplication is needed here to satisfy that requirement.

// ================================================================================================
// P6-001 (spa-module-switcher-v1, phase-6-7-gates-docs.md, AC-1) — module inventory & grouping.
//
// TIER: source-asserted only. `src/app.js` is DOM-dependent and node cannot import or execute
// it, so nothing below observes four rows actually paint, that the grouping is visually legible,
// or that the panel header is visible on screen — P6-011 (human) is the only thing that
// establishes any of that. Every test in this section is named "…source declares…", never
// "…renders…", per the D-6 forbidden-phrasing rule.
// ================================================================================================

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');

/** Same brace-matching functionBody() extraction as scripts/smoke-browser-unit-rejection.mjs, kept
 * as a local, independent copy (not imported) so this test file has no runtime dependency on that
 * script's own internals drifting. */
function functionBody(source, name) {
  const declaration = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(declaration, `src/app.js must declare ${name}()`);
  const open = source.indexOf('{', declaration.index);
  assert.notEqual(open, -1, `${name}() must have a body`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = open; index < source.length; index += 1) {
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
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  assert.fail(`${name}() body does not close`);
}

test('P6-001: src/app.js source declares the module row set from MODULE_IDS, not a hardcoded count', () => {
  const rowsBody = functionBody(appSource, 'renderModuleSwitcherRows');
  assert.match(rowsBody, /for\s*\(\s*const\s+moduleId\s+of\s+MODULE_IDS\s*\)/, 'the row set must iterate MODULE_IDS, not a hardcoded literal count');
  assert.match(appSource, /import\s*\{[^}]*\bMODULE_IDS\b[^}]*\}\s*from\s*['"]\.\/modules\/registry\.js['"]/, 'MODULE_IDS must be imported from the single registry source of truth');
  // A hardcoded "4" standing in for MODULE_IDS.length anywhere in this function would silently
  // stop covering a fifth registered module — assert the literal iteration count never appears.
  assert.doesNotMatch(rowsBody, /\.slice\(0,\s*4\)|MODULE_IDS\[0\]|MODULE_IDS\[1\]|MODULE_IDS\[2\]|MODULE_IDS\[3\]/, 'must not hand-index MODULE_IDS instead of iterating it');
});

test('P6-001: src/app.js source declares display fields sourced from the frozen src/moduleManifests.js map', () => {
  assert.match(appSource, /import\s*\{\s*MODULE_MANIFESTS\s*\}\s*from\s*['"]\.\/moduleManifests\.js['"]/);
  const viewBody = functionBody(appSource, 'getManifestView');
  assert.match(viewBody, /MODULE_MANIFESTS\[moduleId\]/, 'row/banner display fields must be read from MODULE_MANIFESTS, never re-declared inline');
});

test('P6-001: src/app.js source computes group membership exactly once, from the FR-4 predicate (isModuleSelectable)', () => {
  const rowsBody = functionBody(appSource, 'renderModuleSwitcherRows');
  const matches = [...rowsBody.matchAll(/isModuleSelectable\(/g)];
  assert.equal(matches.length, 1, 'renderModuleSwitcherRows must call isModuleSelectable exactly once per iteration — a second, divergent check would risk the two groups disagreeing');
  assert.match(rowsBody, /\(isModuleSelectable\(moduleId\)\s*\?\s*selectableIds\s*:\s*notSelectableIds\)\.push\(moduleId\)/, 'group membership must be a single ternary push, computed once per id');
});

test('P6-001: src/app.js source references the verbatim panel header by identifier, never inline', () => {
  assert.match(appSource, /import\s*\{[\s\S]*?\bPANEL_HEADER\b[\s\S]*?\}\s*from\s*['"]\.\/moduleStatusVocabulary\.js['"]/);
  const switcherBody = functionBody(appSource, 'renderModuleSwitcher');
  assert.match(switcherBody, /header\.textContent\s*=\s*PANEL_HEADER/);
  assert.doesNotMatch(appSource, /These modules are not peers\. Read each row\./, 'the panel header text must never be inlined literally in src/app.js — only referenced by identifier');
});

test('P6-001 AC-1 resilience (a): src/app.js source guards every OPTIONAL row field so a missing one omits its line rather than rendering undefined/empty artifacts', () => {
  const rowBody = functionBody(appSource, 'moduleRowMarkup');
  // Each optional display line is gated by its own truthy check before being concatenated into
  // the row markup — never unconditionally interpolated (which would print "undefined" for a
  // manifest missing that optional field).
  assert.match(rowBody, /subtitle\s*\?\s*`<span class="module-row-subtitle">/, 'the optional subtitle line must be conditionally rendered');
  assert.match(rowBody, /engineLabel\s*\?\s*`<span class="module-row-engine-label">/, 'the optional engine-label line must be conditionally rendered');
  assert.match(rowBody, /countsLine\s*\?\s*`<span class="module-row-counts">/, 'the optional counts line must be conditionally rendered');
  assert.match(rowBody, /limitationText\s*\?\s*`<span class="module-row-limitation">/, 'the optional limitation line must be conditionally rendered');
  // Required title has an explicit moduleId-verbatim fallback (view.title || moduleId), never a
  // bare `undefined` reaching the template.
  assert.match(rowBody, /view\.title/);
  const viewBody = functionBody(appSource, 'getManifestView');
  assert.match(viewBody, /title:\s*manifest\.title\s*\|\|\s*moduleId/, 'a missing manifest.title must fall back to the moduleId itself, never undefined');
});

test('P6-001 AC-1 resilience (b): src/app.js source keeps a MODULE_IDS entry absent from the manifest map in the not-selectable group with an FR-17-shaped reason, never dropped', () => {
  const rowBody = functionBody(appSource, 'moduleRowMarkup');
  assert.match(rowBody, /if\s*\(\s*!view\s*\)\s*\{/, 'moduleRowMarkup must explicitly branch when getManifestView() returns null (no registered manifest)');
  // The no-manifest branch must still return row markup (never null/undefined/an early bail that
  // drops the id entirely) and must carry a reason string, not a bare/blank fallback.
  const noManifestBranch = rowBody.slice(rowBody.indexOf('if (!view)'), rowBody.indexOf('if (!view)') + 700);
  assert.match(noManifestBranch, /No published manifest is registered for module/, 'the no-manifest branch must render an explicit FR-17-shaped reason');
  assert.match(noManifestBranch, /return\s*`<button/, 'the no-manifest branch must still return row markup, not drop the id');
  // isModuleSelectable() itself is fail-closed for an id absent from MODULE_MANIFESTS (see
  // src/moduleEligibility.js's Object.hasOwn guard, executed and asserted in
  // tests/module-eligibility.test.mjs) — so this id is correctly routed to notSelectableIds by
  // the same single predicate renderModuleSwitcherRows already uses, not a second check here.
});

// ================================================================================================
// P6-010(a) (spa-module-switcher-v1, phase-6-7-gates-docs.md, AC-10) — confirm, do not re-decide,
// that scripts/check-app-imports.mjs's static-analysis surface already covers the four new files
// and that all 8 MODULE_KB_LOADERS specifiers resolve dev+dist. `npm run check:imports` already
// enforces this at gate level; this test asserts the same claim so a regression here fails `npm
// test` directly rather than only failing a separate script run later in the same `npm run check`
// pipeline.
// ================================================================================================

test('P6-010(a): scripts/check-app-imports.mjs APP_SURFACE_FILES includes all four new module-switcher app-surface files', () => {
  const checkImportsSource = readFileSync(path.join(repoRoot, 'scripts/check-app-imports.mjs'), 'utf8');
  const arrayMatch = /const APP_SURFACE_FILES = \[([\s\S]*?)\];/.exec(checkImportsSource);
  assert.ok(arrayMatch, 'APP_SURFACE_FILES array literal must be present');
  const listed = [...arrayMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const required of ['src/moduleManifests.js', 'src/moduleStatusVocabulary.js', 'src/moduleKbLoaders.js', 'src/moduleEligibility.js']) {
    assert.ok(listed.includes(required), `APP_SURFACE_FILES must list ${required}`);
  }
});

test('P6-010(a): all 8 MODULE_KB_LOADERS fetch specifiers resolve under both the dev and dist/ layouts', () => {
  const loaderSource = readFileSync(path.join(repoRoot, 'src/moduleKbLoaders.js'), 'utf8');
  const mapMatch = /export const MODULE_KB_LOADERS = Object\.freeze\(\{([\s\S]*?)\n\}\);/.exec(loaderSource);
  assert.ok(mapMatch, 'MODULE_KB_LOADERS object literal must be present');
  const specifiers = [...mapMatch[1].matchAll(/fetch\('(\.\/[^']+)'\)/g)].map((m) => m[1]);
  assert.equal(specifiers.length, 8, 'expected exactly 8 literal fetch() specifiers — 2 per registered module (rules.json + candidates.json)');
  for (const specifier of specifiers) {
    const devTarget = path.resolve(repoRoot, specifier);
    const distTarget = path.resolve(repoRoot, 'dist', specifier);
    assert.ok(existsSync(devTarget), `${specifier} must resolve under the dev layout`);
    assert.ok(existsSync(distTarget), `${specifier} must resolve under the dist/ layout — run npm run build first`);
  }
});
