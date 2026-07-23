#!/usr/bin/env node
// scripts/check-app-imports.mjs
//
// Permanent runtime app-surface smoke check (P7-T2,
// docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md).
//
// `npm run check` never executes browser JS, so a broken relative import/fetch specifier in
// src/app.js or src/algorithmExplorer.js — exactly the class of bug the module-boundary shim
// strategy in this refactor could introduce — is invisible to the technical gate. This script
// closes that gap in two passes:
//
//   (a) Static specifier resolution: parse every `import ... from '...'` and `fetch('...')`
//       specifier in src/app.js and src/algorithmExplorer.js, resolve each relative path
//       against BOTH the src-rooted dev layout and the built dist/ layout, and exit non-zero
//       on any unresolvable target. `import` specifiers resolve relative to the importing
//       file's own directory (ES module semantics); `fetch()` specifiers resolve relative to
//       the document base URI — index.html lives at the repo/dist root, so fetch specifiers
//       are root-relative, not module-relative. Any `?v=<hash>` cache-busting stamp is
//       stripped before resolution.
//
//   (b) Dynamic module-graph load: `await import()`s the non-DOM module graph under live Node
//       — src/engine.js, src/facts.js, src/modules/registry.js, modules/anemia/index.js,
//       modules/anemia/ranges.js at minimum — proving it actually loads end-to-end, including
//       the `with { type: 'json' }` import-attribute path modules/anemia/ranges.js depends on
//       (the browser JSON-module feature the shim strategy relies on: Chrome/Edge 123+,
//       Safari 17.2+, Firefox 138+). This is NOT a headless-browser test — DOM-dependent files
//       (app.js, algorithmExplorer.js) are intentionally excluded from this pass; real
//       browser-runtime execution stays out of scope for P0 (see DEF-8).
//
// Usage: node scripts/check-app-imports.mjs
// Exit code: 0 if every check passes; 1 if any static specifier is unresolvable or any dynamic
// import throws.

import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');

// src/evidence.js is included here as of DEF-1 (evidence dual-source unification): it stopped
// being a self-contained JS object literal and became a loader that imports
// modules/anemia/evidence.json via `with { type: 'json' }`. That introduced exactly the class of
// relative-specifier bug pass (a) exists to catch — the dev and dist/ layouts must BOTH resolve
// it — and neither pass covered it before, because pass (a) only parses the files listed here
// (it does not walk the import graph transitively).
// src/moduleManifests.js and src/moduleStatusVocabulary.js registered here as of P1-03
// (spa-module-switcher-v1, phase-0-2-foundation.md): pass (a) does not walk the import graph
// transitively, so a file not listed here goes entirely unchecked even if something else imports
// it. Both are frozen, side-effect-free data modules with zero fetch()/DOM/dynamic-import
// surface, but src/moduleManifests.js's four `with { type: 'json' }` import specifiers still need
// the same dev+dist resolution proof every other app-surface file gets.
// src/moduleKbLoaders.js and src/moduleEligibility.js registered here as of P2-01/P2-03
// (spa-module-switcher-v1, phase-0-2-foundation.md — same non-transitive-walk reason as above).
// src/moduleKbLoaders.js is the one that matters most for pass (a): its 8 literal `fetch()`
// specifiers are exactly the R-4 hazard this script's per-file dev+dist existence check exists to
// catch (spike-leg-sq3-failure-surface.md §6) — a template-built specifier here would silently
// lose that verification.
const APP_SURFACE_FILES = [
  'src/app.js',
  'src/algorithmExplorer.js',
  'src/evidence.js',
  'src/moduleManifests.js',
  'src/moduleStatusVocabulary.js',
  'src/moduleKbLoaders.js',
  'src/moduleEligibility.js',
];

const DYNAMIC_IMPORT_TARGETS = [
  'src/engine.js',
  'src/facts.js',
  'src/modules/registry.js',
  'modules/anemia/index.js',
  'modules/anemia/ranges.js',
  // DEF-1: proves src/evidence.js's JSON import-attribute path actually loads end-to-end,
  // the same guarantee modules/anemia/ranges.js already gets for reference-ranges.json.
  'src/evidence.js',
];

let failures = 0;

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function stripQuery(specifier) {
  const qIndex = specifier.indexOf('?');
  return qIndex === -1 ? specifier : specifier.slice(0, qIndex);
}

/** Extract every static `import ... from '<specifier>'` specifier from source text. */
function extractImportSpecifiers(source) {
  const specifiers = [];
  const importRe = /import\s+(?:[\w*\s{},]+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRe.exec(source))) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

/**
 * Extract every `fetch('<specifier>')` / `fetch(`<specifier>`)` argument from source text.
 * Returns `{ raw, isDynamic }`; `isDynamic` is true for template literals containing an
 * interpolation (e.g. `` `./examples/${selected}.json` ``), which cannot be fully resolved
 * statically — only their static directory prefix is checked.
 */
function extractFetchSpecifiers(source) {
  const specifiers = [];
  const fetchRe = /fetch\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let match;
  while ((match = fetchRe.exec(source))) {
    const raw = match[2];
    specifiers.push({ raw, isDynamic: raw.includes('${') });
  }
  return specifiers;
}

function checkImportSpecifier(sourceFile, specifier) {
  if (!specifier.startsWith('.')) return; // no bare/package specifiers expected on this surface
  const clean = stripQuery(specifier);
  const devSourceFile = path.join(repoRoot, sourceFile);
  const devTarget = path.resolve(path.dirname(devSourceFile), clean);
  const distSourceFile = path.join(distRoot, sourceFile);
  const distTarget = path.resolve(path.dirname(distSourceFile), clean);

  if (!existsSync(devTarget)) {
    fail(`${sourceFile}: import '${specifier}' does not resolve under dev layout (${path.relative(repoRoot, devTarget)})`);
  }
  if (!existsSync(distTarget)) {
    fail(`${sourceFile}: import '${specifier}' does not resolve under dist/ layout (${path.relative(repoRoot, distTarget)}) — run npm run build first`);
  }
}

function checkFetchSpecifier(sourceFile, raw, isDynamic) {
  if (!raw.startsWith('.')) return; // only relative, root-based fetch specifiers are in scope
  const clean = stripQuery(raw);

  if (isDynamic) {
    const prefix = clean.slice(0, clean.indexOf('${'));
    const dir = prefix.endsWith('/') ? prefix.slice(0, -1) : path.dirname(prefix);
    const devDir = path.resolve(repoRoot, dir);
    const distDir = path.resolve(distRoot, dir);
    if (!existsSync(devDir) || !statSync(devDir).isDirectory()) {
      fail(`${sourceFile}: dynamic fetch '${raw}' — static prefix directory missing under dev layout (${dir})`);
    }
    if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
      fail(`${sourceFile}: dynamic fetch '${raw}' — static prefix directory missing under dist/ layout (${dir})`);
    }
    return;
  }

  // fetch() specifiers resolve relative to the document base URI (index.html lives at the
  // repo/dist root), NOT relative to the importing module's own file location.
  const devTarget = path.resolve(repoRoot, clean);
  const distTarget = path.resolve(distRoot, clean);
  if (!existsSync(devTarget)) {
    fail(`${sourceFile}: fetch('${raw}') does not resolve under dev layout (${path.relative(repoRoot, devTarget)})`);
  }
  if (!existsSync(distTarget)) {
    fail(`${sourceFile}: fetch('${raw}') does not resolve under dist/ layout (${path.relative(repoRoot, distTarget)}) — run npm run build first`);
  }
}

console.log('== check-app-imports: (a) static import/fetch specifier resolution ==');
for (const relFile of APP_SURFACE_FILES) {
  const absFile = path.join(repoRoot, relFile);
  if (!existsSync(absFile)) {
    fail(`${relFile}: file does not exist`);
    continue;
  }
  const source = readFileSync(absFile, 'utf8');

  for (const specifier of extractImportSpecifiers(source)) {
    checkImportSpecifier(relFile, specifier);
  }
  for (const { raw, isDynamic } of extractFetchSpecifiers(source)) {
    checkFetchSpecifier(relFile, raw, isDynamic);
  }
}

if (failures === 0) {
  console.log(`OK: all static import/fetch specifiers in ${APP_SURFACE_FILES.join(', ')} resolve under both dev and dist/ layouts.`);
} else {
  console.error(`${failures} static specifier resolution failure(s) so far — see FAIL lines above.`);
}

console.log('\n== check-app-imports: (b) dynamic module-graph load under Node ==');
for (const relModule of DYNAMIC_IMPORT_TARGETS) {
  const absModule = path.join(repoRoot, relModule);
  if (!existsSync(absModule)) {
    fail(`${relModule}: file does not exist, cannot import`);
    continue;
  }
  try {
    // eslint-disable-next-line no-await-in-loop
    await import(pathToFileURL(absModule).href);
    console.log(`OK: ${relModule} loaded`);
  } catch (error) {
    fail(`${relModule} failed to load under Node: ${error && error.stack ? error.stack : error}`);
  }
}

if (failures > 0) {
  console.error(`\ncheck-app-imports: ${failures} failure(s) total.`);
  process.exit(1);
}

console.log('\ncheck-app-imports: all checks passed.');
