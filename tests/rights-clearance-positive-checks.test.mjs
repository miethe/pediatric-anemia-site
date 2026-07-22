// tests/rights-clearance-positive-checks.test.mjs — EPR4-T5 (FR-WP4-05, FR-WP4-06, D6).
//
// FR-WP4-05: "Any future `counsel_approved` / clearance entry must pass the same *positive* checks
// as RG-14/16/17 — closed credential list, realpath-canonical `attestationRef` under
// `docs/attestations/`, calendar-valid date — reusing `attested-passage-map.mjs`. This WP ships the
// check; it ships no entry."
//
// RG-14/16/17 (see .claude/findings/wave0-ep3-ep4-evidence-governance-findings.md) name the three
// POSITIVE checks `validateAttestationEntries` (scripts/evidence/lib/attested-passage-map.mjs) already
// enforces: RG-14 a closed clinical-credential list, RG-16 realpath-canonical containment of
// `attestationRef` under `docs/attestations/` (rejecting lexical traversal AND a symlinked
// intermediate directory), RG-17 a calendar-valid (not merely ISO-shaped) `attestedOn`. EPR4-T4
// already reuses this SAME function, unmodified, for the rights-decision ledger
// (rights/rights-ledger.json#rights_decisions — see scripts/rights/lib/rights-decision-ledger-gate.mjs
// and tests/rights-decision-ledger.test.mjs).
//
// This file's OWN job, distinct from EPR4-T4's: prove the property FR-WP4-05 actually asks for — that
// `validateAttestationEntries` is GENERIC over which future entity carries the attestation shape, not
// special-cased to `rights_decision_id`/`ruleId`/`candidateId`. A hypothetical future `counsel_approved`
// clearance record (no such record exists anywhere in this repo's schemas or data today; D6 forbids one
// structurally) would, whenever a rights owner eventually builds a write path for it, be validated
// through this exact same seam with a `clearance_id`-shaped idField — no new/bespoke validator required,
// and none is written here. Every fixture entry below lives ONLY in this test's own in-memory objects;
// none is added to any committed data file.
//
// Ships the check (by proving the ALREADY-SHIPPED, reused check is exercisable for this future shape);
// ships NO entry. `tests/attestation-ledger-gate.test.mjs` — the file that first proved RG-14/16/17 —
// is not read, imported, or modified by this file.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isBindableAsSourceSupported } from '../src/evidence.js';
import { validateAttestationEntries } from '../scripts/evidence/lib/attested-passage-map.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relative) => JSON.parse(await readFile(path.join(REPO_ROOT, relative), 'utf8'));

// A real bindable passage from the committed KB, so failure-mode tests exercise a genuine data shape
// rather than an invented id (matching tests/rights-decision-ledger.test.mjs's own fixture pattern).
async function bindablePassageFixture() {
  const evidence = await readJson('modules/anemia/evidence.json');
  for (const source of evidence.sources ?? []) {
    for (const passage of source.passages ?? []) {
      if (passage.status !== 'implementation-proposal' && isBindableAsSourceSupported(passage)) {
        return { passage, sourceId: source.id };
      }
    }
  }
  throw new Error('need at least one real bindable passage or this suite is vacuous');
}

function passagesForFactory({ passage, sourceId }) {
  return (id) => (id === sourceId ? [passage] : []);
}

// A well-formed FUTURE clearance-entry fixture, shaped like FR-WP4-05 describes: the same five
// attestation fields `validateAttestationEntries` already requires, keyed by a `clearance_id` idField
// that names no field in any committed schema — illustrative of "whatever a future rights-clearance
// write path calls its identifier", not a claim that this field name is itself spec'd anywhere.
function baseGoodClearanceEntry({ passage }) {
  return {
    clearance_id: 'CLR-TEST-001',
    passageId: passage.id,
    attestedBy: 'J. Okonkwo',
    credential: 'MD, pediatric hematology',
    attestedOn: '2026-07-21',
    attestationRef: 'docs/attestations/README.md',
  };
}

function validate(entries, fixture) {
  validateAttestationEntries(
    entries,
    'clearance_id',
    { passagesFor: passagesForFactory(fixture), isBindableAsSourceSupported },
    'test-fixture#future-clearance-entries',
  );
}

// --- 1. a well-formed fixture entry passes cleanly (the check is not a blanket ban) ---------------

test('FR-WP4-05: a well-formed FUTURE clearance-entry fixture passes the reused RG-9/RG-14/16/17 checks', async () => {
  const fixture = await bindablePassageFixture();
  assert.doesNotThrow(() => validate([baseGoodClearanceEntry(fixture)], fixture));
});

// --- 2. RG-14: closed credential list ---------------------------------------------------------------

test('RG-14: a well-formed clearance entry with an unrecognised credential is rejected', async () => {
  const fixture = await bindablePassageFixture();
  const entry = { ...baseGoodClearanceEntry(fixture), credential: 'senior reviewer' };
  assert.throws(
    () => validate([entry], fixture),
    /does not name a recognised clinical/,
    'the closed credential list must reject a vague/unrecognised credential',
  );
});

// --- 3. RG-16: realpath-canonical attestationRef containment ----------------------------------------

test('RG-16: an attestationRef outside docs/attestations/ is rejected', async () => {
  const fixture = await bindablePassageFixture();
  const entry = { ...baseGoodClearanceEntry(fixture), attestationRef: 'README.md' };
  assert.throws(
    () => validate([entry], fixture),
    /outside docs\/attestations\//,
    'a clearance attestationRef must be contained under docs/attestations/',
  );
});

test('RG-16: an attestationRef using lexical path traversal to escape docs/attestations/ is rejected', async () => {
  const fixture = await bindablePassageFixture();
  const entry = { ...baseGoodClearanceEntry(fixture), attestationRef: 'docs/attestations/../../README.md' };
  assert.throws(
    () => validate([entry], fixture),
    /outside docs\/attestations\//,
    'canonical (realpath) containment, not a lexical prefix test, must reject the traversal',
  );
});

test('RG-16: a nonexistent attestationRef under docs/attestations/ is rejected (must be a committed, reviewable file)', async () => {
  const fixture = await bindablePassageFixture();
  const entry = { ...baseGoodClearanceEntry(fixture), attestationRef: 'docs/attestations/does-not-exist.md' };
  // A path that resolves nowhere fails realpath containment before reaching the "must exist on disk"
  // branch — `attested-passage-map.mjs` reports this via the same "outside docs/attestations/"
  // containment message (a non-existent target has no canonical realpath to prove containment with).
  // Either message is a rejection; the point of this test is that it IS rejected, not which of the
  // module's two adjacent messages fires.
  assert.throws(
    () => validate([entry], fixture),
    /outside docs\/attestations\/|does not exist on disk/,
    'a bare string with no backing committed artifact must not authorise a clearance',
  );
});

// --- 4. RG-17: calendar-valid (not merely ISO-shaped) attestedOn ------------------------------------

test('RG-17: a shape-valid but calendrically invalid attestedOn is rejected', async () => {
  const fixture = await bindablePassageFixture();
  const entry = { ...baseGoodClearanceEntry(fixture), attestedOn: '2026-99-99' };
  assert.throws(
    () => validate([entry], fixture),
    /must be a real ISO calendar date/,
    'attestedOn must round-trip through Date as a genuine calendar date',
  );
});

test('RG-17: an out-of-range calendar date (2026-02-30, no such day) is rejected', async () => {
  const fixture = await bindablePassageFixture();
  const entry = { ...baseGoodClearanceEntry(fixture), attestedOn: '2026-02-30' };
  assert.throws(() => validate([entry], fixture), /must be a real ISO calendar date/);
});

// --- 5. the deny-list tripwire also fires for a clearance entry (belt-and-braces, not the point) ----

test('an automated attester identifier is rejected for a clearance entry too', async () => {
  const fixture = await bindablePassageFixture();
  const entry = { ...baseGoodClearanceEntry(fixture), attestedBy: 'GPT-5 review agent' };
  assert.throws(() => validate([entry], fixture), /automated-identifier pattern/);
});

// --- 6. no bespoke second validator ------------------------------------------------------------------

test('this file imports validateAttestationEntries and adds no bespoke credential/path/date logic of its own', async () => {
  const source = await readFile(path.join(REPO_ROOT, 'tests', 'rights-clearance-positive-checks.test.mjs'), 'utf8');
  assert.match(source, /from '\.\.\/scripts\/evidence\/lib\/attested-passage-map\.mjs'/);
  assert.doesNotMatch(source, /RECOGNIZED_CLINICAL_CREDENTIALS\s*=/, 'must not redeclare the closed credential list');
  assert.doesNotMatch(source, /ATTESTATION_ARTIFACT_DIR\s*=\s*['"]/, 'must not redeclare the attestations directory constant');
});

// === NEGATIVE CRITERION (D6): the live ledger(s) are empty; no agent-authored clearance exists =====

test('D6: rights/rights-ledger.json#rights_decisions ships EMPTY — this task writes no live entry', async () => {
  const ledger = await readJson('rights/rights-ledger.json');
  assert.ok(Array.isArray(ledger.rights_decisions), 'rights/rights-ledger.json must carry a rights_decisions array');
  assert.deepEqual(ledger.rights_decisions, [], 'the rights-decision ledger must stay empty — a live entry is a clinical/legal claim no agent may author');
});

// Recursively walks a JSON value, calling `visit(keyPath, key, value)` for every object property.
function walk(value, keyPath, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${keyPath}[${index}]`, visit));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      visit(keyPath, key, child);
      walk(child, `${keyPath}.${key}`, visit);
    }
  }
}

const FORBIDDEN_ARRAY_KEYS = new Set(['clinicalApprovers', 'approvedBy', 'reviewed_by']);
const FORBIDDEN_NULLABLE_KEYS = new Set(['human_reviewer', 'counsel_reviewer', 'clinical_reviewer']);

test('D6 sweep: no rights/ data file carries an agent-authored clearance, approval, or reviewer value', async () => {
  const rightsDir = path.join(REPO_ROOT, 'rights');
  const files = (await readdir(rightsDir)).filter((f) => f.endsWith('.json'));
  assert.ok(files.length > 0, 'rights/ must contain at least one JSON file or this sweep is vacuous');

  const problems = [];
  for (const file of files) {
    const relative = path.join('rights', file);
    const data = await readJson(relative);

    walk(data, relative, (keyPath, key, value) => {
      if (FORBIDDEN_ARRAY_KEYS.has(key)) {
        if (Array.isArray(value) && value.length > 0) {
          problems.push(`${keyPath}.${key} is a non-empty array (${JSON.stringify(value)}) — must stay empty (D6)`);
        }
      }
      if (FORBIDDEN_NULLABLE_KEYS.has(key)) {
        if (value !== null && value !== undefined) {
          problems.push(`${keyPath}.${key} is non-null (${JSON.stringify(value)}) — must stay null (D6)`);
        }
      }
      if (typeof value === 'string') {
        if (value === 'counsel_approved') {
          problems.push(`${keyPath}.${key} === "counsel_approved" — no agent-writable path may assign this value (D6)`);
        }
        if (/^CLEARED_/.test(value)) {
          problems.push(`${keyPath}.${key} === ${JSON.stringify(value)} — a CLEARED_* status must never be agent-authored (D6)`);
        }
      }
    });
  }

  assert.deepEqual(problems, [], `D6 violation(s) found in committed rights/ data:\n  - ${problems.join('\n  - ')}`);
});

test('tests/attestation-ledger-gate.test.mjs still exists and still passes its own assertions unmodified by this task', async () => {
  // This task must not edit that file (D6/EP-R4 constraint) — enforced by review/process, not by a
  // self-referential text scan of this file (which would also match this comment). What IS checkable
  // at runtime: the file is still present, non-empty, and asserts the same empty-ledger invariant it
  // always has (`npm test` running it unmodified alongside this file is the actual "still passes"
  // proof; this assertion is a cheap sanity check that it was not deleted or emptied out).
  const content = await readFile(path.join(REPO_ROOT, 'tests', 'attestation-ledger-gate.test.mjs'), 'utf8');
  assert.ok(content.length > 0, 'tests/attestation-ledger-gate.test.mjs must still exist and be non-empty');
  assert.match(content, /rules attestations must be empty/, 'the file must still carry its original empty-ledger assertion');
});
