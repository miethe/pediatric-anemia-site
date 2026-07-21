#!/usr/bin/env node
// Browser-only unit-rejection smoke check (EP2-T7 / R-P4).
//
// This repository deliberately has no browser automation dependency.  The app entry point is
// DOM-dependent, so Node cannot execute it as a browser would.  This check therefore makes the
// strongest honest assertions available with the zero-dependency stack:
//
//   (a) inspect the two browser target surfaces to prove the recoverable rejection UI is present,
//       is distinct from the fatal-error UI, is wired to both app.js assessment paths, and that
//       the app -> algorithmExplorer -> engine links resolve in both dev and dist/ layouts; and
//   (b) dynamically load the exact built non-DOM assessment graph the SPA imports, prove a valid
//       assessment succeeds, then submit a wrong-unit input and check its typed rejection.
//
// It does not claim to paint or inspect a real browser DOM.  See the explicit boundary output at
// the end of this script.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(repoRoot, 'dist');
const appPath = path.join(repoRoot, 'src/app.js');
const explorerPath = path.join(repoRoot, 'src/algorithmExplorer.js');

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

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }

  assert.fail(`${name}() body does not close`);
}

function eventHandlerBody(source, eventName) {
  const marker = `form.addEventListener('${eventName}'`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `src/app.js must register the ${eventName} handler`);

  const open = source.indexOf('{', start);
  assert.notEqual(open, -1, `${eventName} handler must have a body`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  assert.fail(`${eventName} handler body does not close`);
}

function assertRelativeModuleResolves(relSource, specifier) {
  const devTarget = path.resolve(path.dirname(path.join(repoRoot, relSource)), specifier);
  const distTarget = path.resolve(path.dirname(path.join(distRoot, relSource)), specifier);
  assert.ok(existsSync(devTarget), `${relSource}: ${specifier} must resolve under the dev layout`);
  assert.ok(
    existsSync(distTarget),
    `${relSource}: ${specifier} must resolve under the dist/ layout — run npm run build first`,
  );
}

function collectJavaScript(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScript(target);
    return target.endsWith('.js') ? [target] : [];
  });
}

console.log('== smoke:browser: static SPA rejection wiring ==');
assert.ok(existsSync(appPath), 'src/app.js must exist');
assert.ok(existsSync(explorerPath), 'src/algorithmExplorer.js must exist');
const appSource = readFileSync(appPath, 'utf8');
const explorerSource = readFileSync(explorerPath, 'utf8');

// These imports form the browser assessment route.  Checking them here, in addition to the
// broader import harness, pins both R-P4 target surfaces to this smoke check.
assert.match(appSource, /import\s+\{\s*assessPediatricAnemia\s*\}\s+from\s+['"]\.\/engine\.js['"]/);
assert.match(appSource, /import\s+\{\s*initializeAlgorithmExplorer\s*\}\s+from\s+['"]\.\/algorithmExplorer\.js['"]/);
assert.match(explorerSource, /import\s+\{\s*assessPediatricAnemia\s*\}\s+from\s+['"]\.\/engine\.js['"]/);
assertRelativeModuleResolves('src/app.js', './engine.js');
assertRelativeModuleResolves('src/app.js', './algorithmExplorer.js');
assertRelativeModuleResolves('src/algorithmExplorer.js', './engine.js');

for (const file of [
  ...collectJavaScript(path.join(distRoot, 'src')),
  ...collectJavaScript(path.join(distRoot, 'modules')),
]) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(
    source,
    /\b(?:from|import)\s*\(?\s*['"]\.\.?\/[^'"?]+\.(?:js|json)['"]/,
    `${path.relative(distRoot, file)} must not retain an unstamped relative JS/JSON import`,
  );
  assert.doesNotMatch(
    source,
    /fetch\(\s*['"`]\.\.?\/[^'"`?]+\.json['"`]/,
    `${path.relative(distRoot, file)} must not retain an unstamped relative JSON fetch`,
  );
}

const rejectionBody = functionBody(appSource, 'showInputRejection');
const fatalBody = functionBody(appSource, 'showFatalError');
assert.notEqual(rejectionBody, fatalBody, 'showInputRejection() must remain distinct from showFatalError()');
assert.match(rejectionBody, /currentAudit\s*=\s*null/);
assert.match(rejectionBody, /\$\('#results'\)\.hidden\s*=\s*true/);
assert.match(rejectionBody, /\$\('#results-placeholder'\)\.hidden\s*=\s*false/);
assert.match(rejectionBody, /escapeHtml\(error\.message\)/);
// EP5-T6 refactored per-field rendering out of showInputRejection() into formatRejectionDetail(),
// so the two rejection kinds (UNIT_REJECTED and AGE_OUT_OF_SUPPORTED_RANGE) share one renderer.
// The substantive requirement is unchanged and is asserted through the delegation chain rather
// than relaxed: the rejection path must still render a per-field expected unit.
assert.match(rejectionBody, /formatRejectionDetail\(/, 'showInputRejection() must delegate per-field rendering');
const rejectionDetailBody = functionBody(appSource, 'formatRejectionDetail');
assert.match(rejectionDetailBody, /detail\.expectedUnit/, 'the per-field rejection renderer must still surface the expected unit');
// ARCH §10 condition 2 in browser mode: an out-of-supported-range age must present a clear
// "no assessment produced" state, not a partial result.
assert.match(rejectionBody, /AGE_OUT_OF_SUPPORTED_RANGE/, 'the rejection UI must handle the age-scope refusal');
assert.match(rejectionBody, /No assessment produced/, 'the age-scope refusal must render an explicit no-assessment-produced state');
assert.doesNotMatch(rejectionBody, /form\.reset\s*\(/, 'the rejection UI must not clear clinician-entered form values');
assert.match(fatalBody, /Application error/);
assert.match(rejectionBody, /Check the entered units/);

const loadExampleBody = functionBody(appSource, 'loadExample');
assert.match(loadExampleBody, /assessPediatricAnemia\(input, rules, candidates\)/);
// EP5-T6 generalized the two rejection codes into a shared INPUT_REJECTION_CODES set, so the
// dispatch is set-membership rather than a literal ===. Both codes must still be covered, and the
// set itself is asserted below, so this is a follow-the-refactor change, not a relaxation.
assert.match(loadExampleBody, /INPUT_REJECTION_CODES\.has\(error\.code\)/);
assert.match(loadExampleBody, /showInputRejection\(error\)/);

const submitBody = eventHandlerBody(appSource, 'submit');
assert.match(submitBody, /const\s+input\s*=\s*buildInput\(\)/);
assert.match(submitBody, /assessPediatricAnemia\(input, rules, candidates\)/);
assert.match(submitBody, /INPUT_REJECTION_CODES\.has\(error\.code\)/);
// The set must genuinely contain both rejection codes; without this the membership assertions above
// would be satisfied by a set that dropped UNIT_REJECTED entirely.
assert.match(appSource, /INPUT_REJECTION_CODES\s*=\s*new Set\(\[[^\]]*'UNIT_REJECTED'[^\]]*\]\)/);
assert.match(appSource, /INPUT_REJECTION_CODES\s*=\s*new Set\(\[[^\]]*'AGE_OUT_OF_SUPPORTED_RANGE'[^\]]*\]\)/);
assert.match(submitBody, /showInputRejection\(error\)/);
assert.doesNotMatch(submitBody, /form\.reset\s*\(/, 'the submit rejection path must retain clinician-entered input');

const assumptionsBody = functionBody(appSource, 'renderUnitAssumptions');
assert.match(assumptionsBody, /result\.provenance\?\.unitsAssumed/);
assert.match(assumptionsBody, /Array\.isArray\(fields\)/);
assert.match(assumptionsBody, /fields\.length\s*===\s*0/);
assert.match(assumptionsBody, /role="note"/);
assert.match(assumptionsBody, /Documented default units applied/);
assert.match(assumptionsBody, /fields\.map/);
assert.match(assumptionsBody, /escapeHtml\(fieldName\)/);
assert.doesNotMatch(assumptionsBody, /error|reject/i, 'assumed-unit guidance must not be presented as a rejection or error');
const renderResultBody = functionBody(appSource, 'renderResult');
assert.match(renderResultBody, /renderUnitAssumptions\(result\)/);
console.log('OK: src/app.js exposes a distinct, non-resetting rejection UI from both assessment paths, renders a neutral per-field default-unit notice, and remains linked to the same engine under dev and dist/.');

console.log('\n== smoke:browser: built SPA assessment graph under Node ==');
const buildInfo = JSON.parse(readFileSync(path.join(distRoot, 'build-info.json'), 'utf8'));
const builtEngineUrl = pathToFileURL(path.join(distRoot, 'src/engine.js'));
const builtUnitsUrl = pathToFileURL(path.join(distRoot, 'src/units.js'));
builtEngineUrl.searchParams.set('v', buildInfo.assetStamp);
builtUnitsUrl.searchParams.set('v', buildInfo.assetStamp);
const { assessPediatricAnemia } = await import(builtEngineUrl.href);
const { UnitRejectionError } = await import(builtUnitsUrl.href);
const input = JSON.parse(readFileSync(path.join(distRoot, 'examples/ida-toddler.json'), 'utf8'));
const rules = JSON.parse(readFileSync(path.join(distRoot, 'modules/anemia/rules.json'), 'utf8'));
const candidates = JSON.parse(readFileSync(path.join(distRoot, 'modules/anemia/candidates.json'), 'utf8'));

const validAssessment = assessPediatricAnemia(input, rules, candidates);
assert.equal(validAssessment.classification.anemiaStatus, 'present');
assert.ok(validAssessment.provenance.evaluatedRuleCount > 0);
console.log(`OK: built dist engine completed a valid assessment with ${validAssessment.provenance.evaluatedRuleCount} rules evaluated.`);

const originalHemoglobin = input.cbc.hemoglobin;
input.cbc.hemoglobinUnit = 'g/L'; // known incompatible scale; never convert this numeric value

let rejection;
let assessmentReturned = false;
try {
  assessPediatricAnemia(input, rules, candidates);
  assessmentReturned = true;
} catch (error) {
  rejection = error;
}

assert.equal(assessmentReturned, false, 'a wrong unit must not produce a converted assessment');
assert.ok(rejection instanceof UnitRejectionError, 'the SPA assessment path must produce a typed UnitRejectionError');
assert.equal(rejection.code, 'UNIT_REJECTED');
assert.match(rejection.message, /unit mismatch|unrecognized unit/i, 'the rejection must be human-readable');
const hemoglobinDetail = rejection.details.find((detail) => detail.field === 'cbc.hemoglobin');
assert.deepEqual(hemoglobinDetail, {
  field: 'cbc.hemoglobin',
  providedUnit: 'g/L',
  expectedUnit: 'g/dL',
  reason: 'incompatible',
});
assert.equal(input.cbc.hemoglobin, originalHemoglobin, 'the rejected input value must not be converted or mutated');
console.log(`OK: caught ${rejection.code} for ${hemoglobinDetail.field}: entered ${hemoglobinDetail.providedUnit}; expected ${hemoglobinDetail.expectedUnit}.`);

console.log('\nBROWSER-MODE BOUNDARY: this check proves static SPA wiring, dev/dist module resolution, and valid/rejected assessments through the built dist module graph under Node. It does not execute DOM-dependent app.js/algorithmExplorer.js in a browser, render the rejection HTML, or verify visual/accessibility behavior; no browser automation dependency is available in this zero-dependency repository.');
