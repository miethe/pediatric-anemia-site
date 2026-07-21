// tests/attested-passage-map.test.mjs — reviewer re-review finding A test coverage.
//
// scripts/evidence/lib/attested-passage-map.mjs is the shared validator that turns
// REVIEWED_RULE_PASSAGE_MAP / REVIEWED_CANDIDATE_PASSAGE_MAP from "map membership alone mints a
// source-supported binding" into "membership requires a structured, non-automated, human
// attestation naming a passage that has actually survived the EP3-T5 fidelity audit." This file
// tests the validator directly against synthetic entries — it does not mutate the real (empty)
// maps in the backfill scripts, since those ship empty and asserting against a live entry would
// require inventing one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAttestationEntries } from '../scripts/evidence/lib/attested-passage-map.mjs';
import { passagesFor, isBindableAsSourceSupported } from '../src/evidence.js';

const deps = { passagesFor, isBindableAsSourceSupported };

// Real fixture ids from modules/anemia/evidence.json: one bindable (clean, source-supported,
// zero reviewFlags) passage and one quarantined (non-empty reviewFlags) passage.
const BINDABLE_PASSAGE_ID = 'WHO2024_HB#ev_002';
const QUARANTINED_PASSAGE_ID = 'AAP2026_IDA#ev_001';

function wellFormedEntry(overrides = {}) {
  return {
    ruleId: 'RULE-001',
    passageId: BINDABLE_PASSAGE_ID,
    attestedBy: 'Dr. Jane Reviewer',
    credential: 'MD, Pediatric Hematology',
    attestedOn: '2026-07-20',
    attestationRef: 'docs/attestations/README.md', // must EXIST (reviewer pass 5: an attestation may not be a bare string)
    ...overrides,
  };
}

test('a well-formed entry pointing at a bindable passage passes validation', () => {
  assert.doesNotThrow(() => validateAttestationEntries([wellFormedEntry()], 'ruleId', deps));
});

test('an entry missing a required field is rejected, naming the entry', () => {
  for (const field of ['passageId', 'attestedBy', 'credential', 'attestedOn', 'attestationRef']) {
    const broken = wellFormedEntry();
    delete broken[field];
    assert.throws(
      () => validateAttestationEntries([broken], 'ruleId', deps),
      (error) => error.message.includes('RULE-001') && error.message.includes(field),
      `omitting "${field}" should be rejected and name the entry + field`,
    );
  }
});

test('an entry missing the id field itself is rejected and labeled by index', () => {
  const broken = wellFormedEntry();
  delete broken.ruleId;
  assert.throws(
    () => validateAttestationEntries([broken], 'ruleId', deps),
    (error) => error.message.includes('entry #0') && error.message.includes('ruleId'),
  );
});

test('an entry attested by an automated/model/agent identifier is rejected', () => {
  const automatedIdentifiers = [
    'claude', 'Claude Sonnet 5', 'gpt-5.6-terra', 'gemini-3.5-flash', 'ARC council review',
    'council-review', 'rf-verification-pipeline', 'agent-042', 'model-self-attestation',
    'review-bot', 'automated-reviewer',
  ];
  for (const attestedBy of automatedIdentifiers) {
    assert.throws(
      () => validateAttestationEntries([wellFormedEntry({ attestedBy })], 'ruleId', deps),
      (error) => error.message.includes('automated-identifier') && error.message.includes(attestedBy),
      `attestedBy "${attestedBy}" should be rejected as an automated identifier`,
    );
  }
});

test('a well-formed entry naming a real human reviewer is NOT flagged as automated', () => {
  assert.doesNotThrow(() => validateAttestationEntries(
    [wellFormedEntry({ attestedBy: 'Dr. Jane Reviewer' })], 'ruleId', deps,
  ));
});

test('a well-formed entry pointing at a quarantined passage is rejected', () => {
  assert.throws(
    () => validateAttestationEntries([wellFormedEntry({ passageId: QUARANTINED_PASSAGE_ID })], 'ruleId', deps),
    (error) => error.message.includes(QUARANTINED_PASSAGE_ID) && error.message.includes('not a bindable'),
  );
});

test('a well-formed entry pointing at an unknown passage id is rejected', () => {
  assert.throws(
    () => validateAttestationEntries([wellFormedEntry({ passageId: 'NOT_A_REAL_SOURCE#ev_999' })], 'ruleId', deps),
    (error) => error.message.includes('NOT_A_REAL_SOURCE#ev_999') && error.message.includes('not a bindable'),
  );
});

test('multiple problems across multiple entries are all reported in one aggregated error', () => {
  const entries = [
    wellFormedEntry({ ruleId: 'RULE-A', attestedBy: 'claude' }),
    wellFormedEntry({ ruleId: 'RULE-B', passageId: QUARANTINED_PASSAGE_ID }),
  ];
  assert.throws(
    () => validateAttestationEntries(entries, 'ruleId', deps),
    (error) => error.message.includes('RULE-A') && error.message.includes('RULE-B'),
  );
});

test('an empty attestation list never throws (both real maps ship empty)', () => {
  assert.doesNotThrow(() => validateAttestationEntries([], 'ruleId', deps));
});
