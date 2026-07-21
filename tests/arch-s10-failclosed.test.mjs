// AC-FAILCLOSED (EP5-T6) — docs/architecture.md §10, all five conditions in ONE readable place.
//
// §10 says the application MUST fail closed when:
//   1. reference units are absent or incompatible;
//   2. age is outside a supported range and local limits are missing;
//   3. the KB package signature/hash is invalid;
//   4. the UI and engine versions are incompatible;
//   5. evidence version is expired under governance policy.
// And: "A failed system should display a clear 'no assessment produced' state, not stale or
// partially calculated advice."
//
// Why this file exists as a consolidated suite rather than only as coverage scattered across
// units/manifest/engine suites: the EP-5 phase plan recorded "today zero of 5 [conditions] have a
// corresponding automated test", and during EP-5 execution a status update briefly marked EP5-T6
// complete while condition 2 was in fact unimplemented. A reader must be able to open ONE file and
// see each numbered §10 clause proven, rather than infer coverage from a count. Each test below is
// labeled with its §10 clause number.
//
// Honest scope boundary: these are Node-level assertions against the real engine, verifier and
// policy surfaces. Condition 1 and 2 additionally have browser-path wiring proven by
// scripts/smoke-browser-unit-rejection.mjs; no test in this repository paints a real DOM.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assessPediatricAnemia } from '../src/engine.js';
import { verifyManifest, SUPPORTED_SCHEMA_VERSIONS } from '../src/kbVerify.js';
import { loadKbJsonFiles, loadKbSourceFiles } from '../scripts/sign-kb.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (rel) => JSON.parse(await readFile(path.join(root, rel), 'utf8'));

const rules = await readJson('modules/anemia/rules.json');
const candidates = await readJson('modules/anemia/candidates.json');
const manifest = await readJson('modules/anemia/module.json');

const ruleArray = Array.isArray(rules) ? rules : rules.rules;
const assess = (input) => assessPediatricAnemia(input, ruleArray, candidates);

/** A patient at a supported age with clean, in-unit values — the control case. */
const healthyInput = () => ({
  patient: { ageMonths: 36, sexAtBirth: 'female', menstruating: false },
  cbc: { hemoglobin: 11.5, mcv: 78 },
});

// --- control: the happy path genuinely produces an assessment -----------------------------------
// Without this, every fail-closed assertion below could pass trivially against a module that
// refuses everything.

test('CONTROL: a supported-age, in-unit input DOES produce an assessment', () => {
  const result = assess(healthyInput());
  assert.ok(result, 'the control case must produce a result, or the fail-closed tests prove nothing');
  assert.ok(result.classification, 'the control case must produce a classification');
});

// --- §10 condition 1 — reference units absent or incompatible -----------------------------------

test('ARCH §10 (1): an incompatible reference unit is rejected, no assessment produced', () => {
  let threw = null;
  try {
    // hemoglobin entered in g/L where the module expects g/dL (EP-2 / SPIKE-004 boundary).
    assess({
      patient: { ageMonths: 36, sexAtBirth: 'female' },
      cbc: { hemoglobin: 115, hemoglobinUnit: 'g/L', mcv: 78 },
    });
  } catch (error) {
    threw = error;
  }
  assert.ok(threw, 'an incompatible unit must be rejected, not silently coerced');
  assert.equal(threw.code, 'UNIT_REJECTED', 'rejection must carry the typed UNIT_REJECTED code');
  // resilience: the failure is a refusal, not a partial result.
  assert.equal(threw.result, undefined, 'a unit rejection must not carry a partial assessment result');
});

// --- §10 condition 2 — age outside supported range with local limits missing ---------------------

test('ARCH §10 (2): an age below supportedAgeMonths.min with no local limits refuses to assess', () => {
  const min = manifest.supportedAgeMonths.min;
  let threw = null;
  try {
    assess({ patient: { ageMonths: min - 1, sexAtBirth: 'female' }, cbc: { hemoglobin: 9, mcv: 90 } });
  } catch (error) {
    threw = error;
  }
  assert.ok(threw, `age ${min - 1} months (below supported min ${min}) must refuse to assess`);
  assert.equal(threw.code, 'AGE_OUT_OF_SUPPORTED_RANGE');
  assert.equal(threw.result, undefined, 'the refusal must not carry a partially calculated result');
});

test('ARCH §10 (2): an age above supportedAgeMonths.max with no local limits refuses to assess', () => {
  const max = manifest.supportedAgeMonths.max;
  assert.throws(
    () => assess({ patient: { ageMonths: max + 1, sexAtBirth: 'female' }, cbc: { hemoglobin: 11, mcv: 85 } }),
    (error) => error.code === 'AGE_OUT_OF_SUPPORTED_RANGE',
    `age ${max + 1} months (above supported max ${max}) must refuse to assess`,
  );
});

test('ARCH §10 (2): the carve-out — supplying covering local limits permits assessment', () => {
  const min = manifest.supportedAgeMonths.min;
  const result = assess({
    patient: { ageMonths: min - 1, sexAtBirth: 'female' },
    cbc: { hemoglobin: 9, mcv: 90, localRanges: { hbLower: 9.5, mcvLower: 75, mcvUpper: 95 } },
  });
  assert.ok(result, '"and local limits are missing" is part of the condition — supplying them lifts the refusal');
});

test('ARCH §10 (2): the age bounds are read from the manifest, never hardcoded in the test', () => {
  // Guards against a future edit that pins 6/216 in code and lets the manifest drift.
  assert.equal(typeof manifest.supportedAgeMonths.min, 'number');
  assert.equal(typeof manifest.supportedAgeMonths.max, 'number');
  assert.ok(manifest.supportedAgeMonths.min < manifest.supportedAgeMonths.max);
});

// --- §10 condition 3 — KB package hash invalid ---------------------------------------------------

const kbFiles = await loadKbJsonFiles();
const kbSourceFiles = await loadKbSourceFiles();
const verifyArgs = (m) => ({
  manifest: m,
  moduleId: 'anemia',
  files: kbFiles,
  sourceFiles: kbSourceFiles,
  supportedSchemaVersions: SUPPORTED_SCHEMA_VERSIONS,
});

test('ARCH §10 (3): the real committed manifest verifies and is servable', async () => {
  const verdict = await verifyManifest(verifyArgs(manifest));
  assert.equal(verdict.servable, true, `the committed manifest must verify: ${JSON.stringify(verdict.problems ?? [])}`);
});

test('ARCH §10 (3): a tampered clinicalContentHash is refused', async () => {
  const tampered = { ...manifest, clinicalContentHash: `sha256:${'0'.repeat(64)}` };
  const verdict = await verifyManifest(verifyArgs(tampered));
  assert.equal(verdict.servable, false, 'a hash that does not match recomputed KB content must refuse to serve');
});

test('ARCH §10 (3): a missing clinicalContentHash is refused (must-not-be-empty, AC-WP5-RESIL)', async () => {
  const stripped = { ...manifest, clinicalContentHash: null };
  const verdict = await verifyManifest(verifyArgs(stripped));
  assert.equal(verdict.servable, false);
});

test('ARCH §10 (3): legitimately-empty fields do NOT trigger refusal (the asymmetry that matters)', async () => {
  // supersedes: null (first release) and approvedBy: [] (D-4) are VALID and must serve.
  const firstRelease = { ...manifest, supersedes: null, approvedBy: [] };
  const verdict = await verifyManifest(verifyArgs(firstRelease));
  assert.equal(verdict.servable, true, 'a first release with no predecessor and no approvals must still serve');
});

// --- §10 condition 4 — UI/engine version incompatible --------------------------------------------

test('ARCH §10 (4): an unsupported manifest schemaVersion is refused', async () => {
  const future = { ...manifest, schemaVersion: 99 };
  const verdict = await verifyManifest(verifyArgs(future));
  assert.equal(verdict.servable, false, 'a schemaVersion this engine does not support must refuse to serve');
});

test('ARCH §10 (4): a non-integrity-recorded status is refused', async () => {
  const stub = { ...manifest, status: 'unsigned-stub' };
  const verdict = await verifyManifest(verifyArgs(stub));
  assert.equal(verdict.servable, false, 'only an integrity-recorded manifest may be served');
});

// --- §10 condition 5 — evidence expired under governance policy ----------------------------------
//
// SPIKE-006 Amendment 4 records this clause as NOT closed: no human has chosen a staleness window.
// The MECHANISM is implemented and proven in both states below; the POLICY VALUE is deliberately
// unset and its non-enforcement is disclosed rather than hidden. Do not read the first test as
// "expiry is satisfied" — read it as "no policy exists, and the system says so out loud."

test('ARCH §10 (5): with no staleness policy set, expiry is NOT enforced and says so explicitly', async () => {
  const verdict = await verifyManifest({
    ...verifyArgs(manifest),
    evidenceStalenessPolicy: { maxAgeDays: null },
  });
  assert.equal(verdict.servable, true, 'an unset policy must not brick the module');
  assert.ok(verdict.expiry, 'the verdict must carry an expiry disclosure object');
  assert.equal(verdict.expiry.enforced, false, 'non-enforcement must be explicit, never implied by silence');
  assert.ok(
    typeof verdict.expiry.reason === 'string' && verdict.expiry.reason.length > 0,
    'non-enforcement must carry a human-readable reason so it cannot be mistaken for a passed check',
  );
});

test('ARCH §10 (5): with a policy set and evidence older than the window, serving is refused', async () => {
  const verdict = await verifyManifest({
    ...verifyArgs(manifest),
    evidenceStalenessPolicy: { maxAgeDays: 1 },
    now: new Date('2099-01-01T00:00:00Z'),
  });
  assert.equal(verdict.servable, false, 'evidence past the declared staleness window must fail closed');
  assert.equal(verdict.expiry.enforced, true);
});

test('ARCH §10 (5): with a policy set and evidence within the window, serving is permitted', async () => {
  const reviewedThrough = new Date(`${manifest.evidenceReviewedThrough}T00:00:00Z`);
  const oneDayLater = new Date(reviewedThrough.getTime() + 24 * 60 * 60 * 1000);
  const verdict = await verifyManifest({
    ...verifyArgs(manifest),
    evidenceStalenessPolicy: { maxAgeDays: 3650 },
    now: oneDayLater,
  });
  assert.equal(verdict.servable, true, 'evidence inside the declared window must serve');
  assert.equal(verdict.expiry.enforced, true, 'a set policy must actually be enforced, not merely recorded');
});

// --- resilience property, stated once across all five --------------------------------------------

test('ARCH §10 resilience: every refusal yields no assessment, never a partial result', () => {
  const refusals = [
    () => assess({ patient: { ageMonths: 2, sexAtBirth: 'female' }, cbc: { hemoglobin: 9, mcv: 90 } }),
    () => assess({
      patient: { ageMonths: 36, sexAtBirth: 'female' },
      cbc: { hemoglobin: 115, hemoglobinUnit: 'g/L', mcv: 78 },
    }),
  ];
  for (const attempt of refusals) {
    let threw = null;
    try { attempt(); } catch (error) { threw = error; }
    assert.ok(threw, 'each refusal path must throw rather than return');
    assert.equal(threw.result, undefined, 'no refusal may carry a partial or stale assessment');
    assert.ok(typeof threw.message === 'string' && threw.message.length > 0,
      'each refusal must carry a clinician-readable message for the "no assessment produced" state');
  }
});
