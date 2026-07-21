// tests/attestation-ledger-gate.test.mjs — reviewer gate, third pass (2026-07-21).
//
// The attestation gate originally lived only inside the backfill scripts, which made it
// GENERATOR-SIDE ONLY. The reviewer defeated it in one step: hand-edit modules/anemia/rules.json to
// point a rule at a clean `source-supported` passage, and `npm run validate` exited 0 while
// reporting "1 source-supported". The generator was never involved, so its gate never ran.
//
// The lesson generalises past this one field: a guarantee enforced only where data is PRODUCED is
// not a guarantee about the data that is COMMITTED. These tests exercise the validator-side gate
// against hand-constructed data, which is the shape the exploit actually took.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isBindableAsSourceSupported } from '../src/evidence.js';
import {
  loadAttestationLedger,
  validateBindingsAgainstLedger,
  AUTOMATED_IDENTIFIER_PATTERN,
} from '../scripts/evidence/lib/attested-passage-map.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

async function passageIndex() {
  const evidence = await readJson(path.join(REPO_ROOT, 'modules', 'anemia', 'evidence.json'));
  const index = new Map();
  for (const source of evidence.sources) {
    for (const passage of source.passages ?? []) index.set(passage.id, passage);
  }
  return index;
}

const firstBindable = (index) => [...index.values()]
  .find((p) => p.status !== 'implementation-proposal' && isBindableAsSourceSupported(p));

const gate = (entities, index, attestations = []) => validateBindingsAgainstLedger({
  moduleId: 'anemia', entities, idField: 'ruleId', attestations,
  passageIndex: index, isBindableAsSourceSupported,
});

test('the committed attestation ledger is empty — no human has attested any binding', async () => {
  const ledger = loadAttestationLedger();
  assert.deepEqual(ledger.rules, [], 'rules attestations must be empty; a non-empty ledger is a clinical claim');
  assert.deepEqual(ledger.candidates, []);
});

test('THE EXPLOIT: a hand-edited source-supported binding is rejected when unattested', async () => {
  const index = await passageIndex();
  const passage = firstBindable(index);
  assert.ok(passage, 'need at least one bindable passage or this test is vacuous');

  const errors = gate([{ id: 'SCOPE-001', evidence: [passage.sourceId], sourcePassageId: passage.id }], index);
  assert.equal(errors.length, 1, 'an unattested source-supported binding must be rejected');
  assert.match(errors[0], /no matching attestation/);
});

test('a source-supported binding IS accepted when a matching ledger attestation exists', async () => {
  const index = await passageIndex();
  const passage = firstBindable(index);
  const attestations = [{
    ruleId: 'SCOPE-001',
    passageId: passage.id,
    attestedBy: 'J. Okonkwo',
    credential: 'MD, pediatric hematology',
    attestedOn: '2026-07-21',
    attestationRef: 'docs/attestations/example.md',
  }];
  assert.deepEqual(
    gate([{ id: 'SCOPE-001', evidence: [passage.sourceId], sourcePassageId: passage.id }], index, attestations),
    [],
    'the gate must be satisfiable by a genuine attestation, or it is not a gate but a ban',
  );
});

test('an attestation for a DIFFERENT passage does not authorise this binding', async () => {
  const index = await passageIndex();
  const bindable = [...index.values()].filter((p) => p.status !== 'implementation-proposal' && isBindableAsSourceSupported(p));
  assert.ok(bindable.length >= 2, 'need two bindable passages');
  const attestations = [{
    ruleId: 'SCOPE-001',
    passageId: bindable[1].id,
    attestedBy: 'J. Okonkwo',
    credential: 'MD',
    attestedOn: '2026-07-21',
    attestationRef: 'docs/attestations/example.md',
  }];
  const errors = gate([{ id: 'SCOPE-001', evidence: [bindable[0].sourceId], sourcePassageId: bindable[0].id }], index, attestations);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /no matching attestation/);
});

test('CROSS-SOURCE: a rule cannot be grounded by a passage from a source it does not cite', async () => {
  const index = await passageIndex();
  const passage = firstBindable(index);
  const otherSource = passage.sourceId === 'WHO2024_HB' ? 'CDC2025_LEAD' : 'WHO2024_HB';

  const errors = gate([{ id: 'SCOPE-001', evidence: [otherSource], sourcePassageId: passage.id }], index);
  assert.ok(errors.some((e) => /does not cite/.test(e)),
    'a passage from an uncited source must be rejected — citing WHO while grounding to a different '
    + 'guideline is a false provenance trail');
});

test('an implementation-proposal sentinel needs no attestation (the honest fallback stays cheap)', async () => {
  const index = await passageIndex();
  const sentinel = [...index.values()].find((p) => p.status === 'implementation-proposal');
  assert.deepEqual(
    gate([{ id: 'SCOPE-001', evidence: [sentinel.sourceId], sourcePassageId: sentinel.id }], index),
    [],
    'the conservative fallback must never require attestation, or the fail-safe path becomes the '
    + 'expensive one and pressure builds to over-claim instead',
  );
});

test('every shipped rule and candidate passes the ledger gate today', async () => {
  const index = await passageIndex();
  const rules = await readJson(path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json'));
  const candidates = await readJson(path.join(REPO_ROOT, 'modules', 'anemia', 'candidates.json'));
  const ledger = loadAttestationLedger();

  assert.deepEqual(gate(rules, index, ledger.rules), []);
  assert.deepEqual(
    validateBindingsAgainstLedger({
      moduleId: 'anemia',
      entities: Object.entries(candidates).map(([id, c]) => ({ ...c, id })),
      idField: 'candidateId',
      attestations: ledger.candidates,
      passageIndex: index,
      isBindableAsSourceSupported,
    }),
    [],
  );
});

test('the automated-identifier pattern rejects the identifiers that would actually be tried', async () => {
  for (const name of ['claude-opus', 'GPT-5', 'arc-run-2026', 'council-review', 'rf-verifier', 'ci-pipeline', 'automated-review']) {
    assert.match(name, AUTOMATED_IDENTIFIER_PATTERN, `${name} must be rejected as an attester`);
  }
  for (const name of ['J. Okonkwo', 'A. Haddad', 'M. Lindqvist']) {
    assert.doesNotMatch(name, AUTOMATED_IDENTIFIER_PATTERN, `${name} is a plausible human name and must be allowed`);
  }
});
