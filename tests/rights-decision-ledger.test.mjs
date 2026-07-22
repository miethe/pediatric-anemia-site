// tests/rights-decision-ledger.test.mjs — EPR4-T4 (FR-WP4-04, decisions-block D4/D6/D7).
//
// Proves the rights-decision ledger (rights/rights-ledger.json#rights_decisions):
//   1. ships EMPTY today (D6) — no code path in this feature writes a live entry.
//   2. validates BIDIRECTIONALLY once an entry exists: a dangling/non-existent rights_record_id
//      fails, a dangling/non-existent passageId fails, and a structurally malformed entry (missing
//      required field, automated attester, unrecognised credential, bad attestationRef, bad date)
//      fails too.
//   3. reuses scripts/evidence/lib/attested-passage-map.mjs's `validateAttestationEntries` — the
//      RG-9 seam — for the passage/attestation-shaped half, rather than a second, parallel
//      implementation: this suite proves that by seeding EXACTLY the failure shapes
//      tests/attestation-ledger-gate.test.mjs already proves that function rejects (unrecognised
//      credential, non-canonical attestationRef, non-calendar date, automated attester, dangling
//      passage id) and checking each one surfaces through `checkRightsDecisionLedgerCoverage`
//      unchanged — a shadow re-implementation would have its own (possibly weaker) rules and could
//      diverge from these.
//   4. the real, on-disk substrate passes the gate cleanly (an empty array trivially does), and the
//      gate is wired into `scripts/validate-rights.mjs`'s single exported `GATES` list.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isBindableAsSourceSupported } from '../src/evidence.js';
import { loadRightsContext, GATES } from '../scripts/validate-rights.mjs';
import { checkRightsDecisionLedgerCoverage } from '../scripts/rights/lib/rights-decision-ledger-gate.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relative) => JSON.parse(await readFile(path.join(REPO_ROOT, relative), 'utf8'));

// --- shared fixtures: a real bindable passage and a real rights_record from the committed substrate,
// so failure-mode tests are exercised against genuine data shapes, not invented ids. ------------------

async function realFixture() {
  const evidence = await readJson('modules/anemia/evidence.json');
  const rightsRecords = await readJson('rights/rights-records.json');
  let bindablePassage = null;
  let bindableSourceId = null;
  outer: for (const source of evidence.sources ?? []) {
    for (const passage of source.passages ?? []) {
      if (passage.status !== 'implementation-proposal' && isBindableAsSourceSupported(passage)) {
        bindablePassage = passage;
        bindableSourceId = source.id;
        break outer;
      }
    }
  }
  assert.ok(bindablePassage, 'need at least one real bindable passage or this suite is vacuous');
  const realRecord = rightsRecords.records.find((r) => r.rights_record_id === 'RR-AAP2026_IDA');
  assert.ok(realRecord, 'fixture assumption: RR-AAP2026_IDA must exist');
  return { bindablePassage, bindableSourceId, realRecordId: realRecord.rights_record_id };
}

function baseGoodEntry({ bindablePassage, realRecordId }) {
  return {
    rights_decision_id: 'RD-TEST-001',
    rights_record_id: realRecordId,
    passageId: bindablePassage.id,
    attestedBy: 'J. Okonkwo',
    credential: 'MD, pediatric hematology',
    attestedOn: '2026-07-21',
    attestationRef: 'docs/attestations/README.md',
  };
}

function runGate(entries, { bindablePassage, bindableSourceId }, rightsRecords) {
  const context = {
    rightsLedger: { entries: [], rights_decisions: entries },
    rightsRecords,
    evidencePassages: [{ moduleId: 'anemia', sourceId: bindableSourceId, passage: bindablePassage }],
  };
  return checkRightsDecisionLedgerCoverage(context);
}

// --- 1. the live ledger ships empty (D6) --------------------------------------------------------

test('the live rights-decision ledger ships EMPTY — no code path in this feature writes an entry', async () => {
  const ledger = await readJson('rights/rights-ledger.json');
  assert.ok(Array.isArray(ledger.rights_decisions), 'rights/rights-ledger.json must carry a rights_decisions array');
  assert.deepEqual(ledger.rights_decisions, [], 'the rights-decision ledger must ship empty (D6) — a live entry is a clinical/legal claim no agent may author');
});

test('the real substrate (empty rights_decisions) passes the gate with zero errors', async () => {
  const context = await loadRightsContext(REPO_ROOT, { argv: [], env: {} });
  const { errors } = checkRightsDecisionLedgerCoverage(context);
  assert.deepEqual(errors, []);
});

test('checkRightsDecisionLedgerCoverage is wired into scripts/validate-rights.mjs\'s single exported GATES list', () => {
  const entry = GATES.find((g) => g.id === 'rights-decision-ledger-coverage');
  assert.ok(entry, 'GATES must carry a "rights-decision-ledger-coverage" entry');
  assert.equal(entry.run, checkRightsDecisionLedgerCoverage, 'the registered gate must be the SAME function this file imports directly, not a re-implementation');
});

// --- 2a. bidirectional join: a non-existent rights_record_id fails --------------------------------

test('an entry pointing at a non-existent rights_record_id fails', async () => {
  const fixture = await realFixture();
  const rightsRecords = await readJson('rights/rights-records.json');
  const entry = { ...baseGoodEntry(fixture), rights_record_id: 'RR-DOES-NOT-EXIST' };
  const { errors } = runGate([entry], fixture, rightsRecords);
  assert.ok(errors.some((e) => /rights_record_id "RR-DOES-NOT-EXIST" does not resolve/.test(e)), `expected a non-resolving rights_record_id error, got:\n${errors.join('\n')}`);
});

// --- 2b. bidirectional join: a non-existent / dangling passage id fails --------------------------

test('an entry pointing at a non-existent evidence item (passageId) fails', async () => {
  const fixture = await realFixture();
  const rightsRecords = await readJson('rights/rights-records.json');
  const entry = { ...baseGoodEntry(fixture), passageId: 'AAP2026_IDA#ev_999' };
  const { errors } = runGate([entry], fixture, rightsRecords);
  assert.ok(errors.some((e) => /rights-decision-ledger-coverage:/.test(e) && /not a bindable source-supported passage/.test(e)), `expected a non-bindable/unknown passageId error, got:\n${errors.join('\n')}`);
});

// --- 2c. malformed back-references fail ------------------------------------------------------------

test('an entry missing rights_record_id fails as a malformed back-reference', async () => {
  const fixture = await realFixture();
  const rightsRecords = await readJson('rights/rights-records.json');
  const entry = { ...baseGoodEntry(fixture) };
  delete entry.rights_record_id;
  const { errors } = runGate([entry], fixture, rightsRecords);
  assert.ok(errors.some((e) => /missing\/empty required field "rights_record_id"/.test(e) && /malformed back-reference/.test(e)), `expected a malformed-back-reference error, got:\n${errors.join('\n')}`);
});

test('an entry with a non-string rights_record_id fails as malformed, not merely non-resolving', async () => {
  const fixture = await realFixture();
  const rightsRecords = await readJson('rights/rights-records.json');
  const entry = { ...baseGoodEntry(fixture), rights_record_id: 12345 };
  const { errors } = runGate([entry], fixture, rightsRecords);
  assert.ok(errors.some((e) => /malformed back-reference/.test(e)), `expected a malformed-back-reference error, got:\n${errors.join('\n')}`);
});

test('an entry missing rights_decision_id is still reported (by label) even though the idField itself is absent', async () => {
  const fixture = await realFixture();
  const rightsRecords = await readJson('rights/rights-records.json');
  const entry = { ...baseGoodEntry(fixture) };
  delete entry.rights_decision_id;
  const { errors } = runGate([entry], fixture, rightsRecords);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => /missing\/empty required field "rights_decision_id"/.test(e)), `expected validateAttestationEntries' own idField check to fire, got:\n${errors.join('\n')}`);
});

// --- 3. reuse, not duplication: the SAME RG-9 positive checks fire, unmodified -------------------

test('REUSE PROOF: an unrecognised credential is rejected via the SAME check attested-passage-map.mjs already enforces', async () => {
  const fixture = await realFixture();
  const rightsRecords = await readJson('rights/rights-records.json');
  const entry = { ...baseGoodEntry(fixture), credential: 'reviewer' };
  const { errors } = runGate([entry], fixture, rightsRecords);
  assert.ok(errors.some((e) => /does not name a recognised clinical/.test(e)), `expected the reused credential closed-list check to fire, got:\n${errors.join('\n')}`);
});

test('REUSE PROOF: an automated attester ("GPT-5 review agent") is rejected via the SAME tripwire', async () => {
  const fixture = await realFixture();
  const rightsRecords = await readJson('rights/rights-records.json');
  const entry = { ...baseGoodEntry(fixture), attestedBy: 'GPT-5 review agent' };
  const { errors } = runGate([entry], fixture, rightsRecords);
  assert.ok(errors.some((e) => /automated-identifier pattern/.test(e)), `expected the reused automated-identifier tripwire to fire, got:\n${errors.join('\n')}`);
});

test('REUSE PROOF: an attestationRef outside docs/attestations/ is rejected via the SAME containment check', async () => {
  const fixture = await realFixture();
  const rightsRecords = await readJson('rights/rights-records.json');
  const entry = { ...baseGoodEntry(fixture), attestationRef: 'README.md' };
  const { errors } = runGate([entry], fixture, rightsRecords);
  assert.ok(errors.some((e) => /outside docs\/attestations\//.test(e)), `expected the reused attestationRef containment check to fire, got:\n${errors.join('\n')}`);
});

test('REUSE PROOF: a shape-invalid calendar date ("2026-99-99") is rejected via the SAME round-trip check', async () => {
  const fixture = await realFixture();
  const rightsRecords = await readJson('rights/rights-records.json');
  const entry = { ...baseGoodEntry(fixture), attestedOn: '2026-99-99' };
  const { errors } = runGate([entry], fixture, rightsRecords);
  assert.ok(errors.some((e) => /must be a real ISO calendar date/.test(e)), `expected the reused calendar round-trip check to fire, got:\n${errors.join('\n')}`);
});

// --- 4. a genuinely well-formed FIXTURE entry passes both halves (the gate is not a ban) ----------

test('a well-formed FIXTURE entry (real record, real bindable passage, valid attestation shape) passes cleanly', async () => {
  const fixture = await realFixture();
  const rightsRecords = await readJson('rights/rights-records.json');
  const entry = baseGoodEntry(fixture);
  const { errors } = runGate([entry], fixture, rightsRecords);
  assert.deepEqual(errors, [], `a well-formed entry must not be rejected — the gate proves failure modes, not a blanket ban; got:\n${errors.join('\n')}`);
});

// --- 5. no second validator: the failure MESSAGES route through attested-passage-map.mjs's own text --

test('D4/reuse: this file imports validateAttestationEntries only through scripts/rights/lib/rights-decision-ledger-gate.mjs, never re-implements it', async () => {
  const source = await readFile(path.join(REPO_ROOT, 'scripts', 'rights', 'lib', 'rights-decision-ledger-gate.mjs'), 'utf8');
  assert.match(source, /from '\.\.\/\.\.\/evidence\/lib\/attested-passage-map\.mjs'/, 'the gate module must import from attested-passage-map.mjs, not reimplement its checks');
  assert.doesNotMatch(source, /RECOGNIZED_CLINICAL_CREDENTIALS\s*=/, 'the gate module must not redeclare the closed credential list — that would be a second, potentially-diverging implementation');
  assert.doesNotMatch(source, /AUTOMATED_IDENTIFIER_PATTERN\s*=/, 'the gate module must not redeclare the automated-identifier tripwire pattern');
});
