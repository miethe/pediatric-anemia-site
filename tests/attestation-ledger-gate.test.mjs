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
  hasRecognizedCredential,
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
    attestationRef: 'docs/attestations/README.md',
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
    attestationRef: 'docs/attestations/README.md',
  }];
  const errors = gate([{ id: 'SCOPE-001', evidence: [bindable[0].sourceId], sourcePassageId: bindable[0].id }], index, attestations);
  assert.ok(errors.some((e) => /no matching attestation/.test(e)),
    `expected a no-matching-attestation error, got: ${JSON.stringify(errors)}`);
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

// --- reviewer gate, FOURTH pass -------------------------------------------------------------
// Two ways the gate still failed open, both found by the reviewer and both mine:
//   (a) the validator matched ledger ids without ever validating the ledger ENTRY SHAPE, so
//       `{ruleId, passageId}` with no attester, or one attested by "GPT-5 review agent", authorized
//       a binding. Checking equality against an unvalidated record is not an attestation gate.
//   (b) the cross-source check skipped entities whose `evidence` array was empty — i.e. it failed
//       open on exactly the case with the least provenance.

test('a ledger entry with no attester authorises NOTHING', async () => {
  const index = await passageIndex();
  const passage = firstBindable(index);
  const errors = gate(
    [{ id: 'SCOPE-001', evidence: [passage.sourceId], sourcePassageId: passage.id }],
    index,
    [{ ruleId: 'SCOPE-001', passageId: passage.id }], // shape-invalid: no attestedBy/credential/date/ref
  );
  assert.ok(errors.length > 0, 'a malformed ledger entry must not authorise a source-supported binding');
  assert.ok(errors.some((e) => /ledger is invalid|no matching attestation/.test(e)));
});

test('a ledger entry attested by an automated identifier authorises NOTHING', async () => {
  const index = await passageIndex();
  const passage = firstBindable(index);
  const errors = gate(
    [{ id: 'SCOPE-001', evidence: [passage.sourceId], sourcePassageId: passage.id }],
    index,
    [{
      ruleId: 'SCOPE-001', passageId: passage.id,
      attestedBy: 'GPT-5 review agent', credential: 'automated', attestedOn: '2026-07-21',
      attestationRef: 'docs/attestations/README.md',
    }],
  );
  assert.ok(errors.length > 0, 'a model/agent attester must not authorise a clinical grounding claim');
});

test('cross-source enforcement FAILS CLOSED when the entity cites no sources at all', async () => {
  const index = await passageIndex();
  const passage = firstBindable(index);
  const attestations = [{
    ruleId: 'C-1', passageId: passage.id, attestedBy: 'J. Okonkwo',
    credential: 'MD', attestedOn: '2026-07-21', attestationRef: 'docs/attestations/README.md',
  }];
  const errors = gate([{ id: 'C-1', evidence: [], sourcePassageId: passage.id }], index, attestations);
  assert.ok(errors.some((e) => /cites no evidence sources/.test(e)),
    'an entity citing nothing must not be groundable by any passage — the previous guard skipped '
    + 'exactly the case with the least provenance');
});

// --- reviewer gate, FIFTH pass ---------------------------------------------------------------
// The deny-list was defeated with `attestedBy: "OpenAI o3"`. A deny-list of model names is
// unbounded and permanently incomplete, so describing it as "requires a human identifier" was an
// over-claim. The gate now leans on POSITIVE checks (a recognised clinical credential; an
// attestation artifact that exists on disk; an ISO date) and keeps the deny-list only as a cheap
// tripwire. It still cannot verify humanity, and the docs now say so.

const bindableFixture = async () => {
  const index = await passageIndex();
  const passage = firstBindable(index);
  return { index, passage, base: {
    ruleId: 'SCOPE-001', passageId: passage.id, attestedOn: '2026-07-21',
    attestationRef: 'docs/attestations/README.md',
  } };
};

test('the fifth-pass evasion "OpenAI o3" no longer authorises a binding', async () => {
  const { index, passage, base } = await bindableFixture();
  const errors = gate(
    [{ id: 'SCOPE-001', evidence: [passage.sourceId], sourcePassageId: passage.id }],
    index, [{ ...base, attestedBy: 'OpenAI o3', credential: 'MD' }],
  );
  assert.ok(errors.length > 0, 'the exact identifier that defeated the previous deny-list must be rejected');
});

test('positive checks: unrecognised credential, missing artifact, artifact outside the dir, and bad date are each rejected', async () => {
  const { index, passage, base } = await bindableFixture();
  const entity = [{ id: 'SCOPE-001', evidence: [passage.sourceId], sourcePassageId: passage.id }];
  const cases = {
    'unrecognised credential': { ...base, attestedBy: 'J. Okonkwo', credential: 'reviewer' },
    'nonexistent artifact': { ...base, attestedBy: 'J. Okonkwo', credential: 'MD', attestationRef: 'docs/attestations/nope.md' },
    'artifact outside docs/attestations': { ...base, attestedBy: 'J. Okonkwo', credential: 'MD', attestationRef: 'README.md' },
    'non-ISO date': { ...base, attestedBy: 'J. Okonkwo', credential: 'MD', attestedOn: 'July 2026' },
  };
  for (const [label, entry] of Object.entries(cases)) {
    assert.ok(gate(entity, index, [entry]).length > 0, `${label} must be rejected`);
  }
});

test('a fully genuine attestation is still accepted (the gate is not a ban)', async () => {
  const { index, passage, base } = await bindableFixture();
  assert.deepEqual(
    gate([{ id: 'SCOPE-001', evidence: [passage.sourceId], sourcePassageId: passage.id }], index,
      [{ ...base, attestedBy: 'J. Okonkwo', credential: 'MD, pediatric hematology' }]),
    [],
  );
});

test('hasRecognizedCredential accepts real credentials and rejects vague ones', () => {
  for (const c of ['MD', 'DO', 'MBBS', 'PharmD', 'MD, pediatric hematology', 'RN', 'PA-C']) {
    assert.ok(hasRecognizedCredential(c), `${c} should be recognised`);
  }
  for (const c of ['reviewer', 'approver', 'expert', '', null, undefined, 'senior clinician']) {
    assert.ok(!hasRecognizedCredential(c), `${JSON.stringify(c)} should not be recognised`);
  }
});

// --- reviewer gate, SIXTH pass ---------------------------------------------------------------
// `startsWith("docs/attestations/")` is a PREFIX test, not containment: both
// "docs/attestations/../../README.md" and "docs/attestations/." satisfied it and authorised a
// binding. And the ISO-date regex checked shape, not calendar validity, so "2026-99-99" passed.
// Both are the same underlying mistake — validating the string rather than the thing it denotes.

test('attestationRef path traversal and directory references are rejected (containment, not prefix)', async () => {
  const { index, passage, base } = await bindableFixture();
  const entity = [{ id: 'SCOPE-001', evidence: [passage.sourceId], sourcePassageId: passage.id }];
  for (const ref of [
    'docs/attestations/../../README.md',
    'docs/attestations/..',
    'docs/attestations/.',
    'docs/attestations/../../package.json',
  ]) {
    const errors = gate(entity, index, [{ ...base, attestedBy: 'J. Okonkwo', credential: 'MD', attestationRef: ref }]);
    assert.ok(errors.length > 0, `attestationRef "${ref}" must be rejected`);
  }
});

test('attestedOn must be a real calendar date, not merely ISO-shaped', async () => {
  const { index, passage, base } = await bindableFixture();
  const entity = [{ id: 'SCOPE-001', evidence: [passage.sourceId], sourcePassageId: passage.id }];
  for (const date of ['2026-99-99', '2026-02-30', '2026-13-01', '0000-00-00']) {
    const errors = gate(entity, index, [{ ...base, attestedBy: 'J. Okonkwo', credential: 'MD', attestedOn: date }]);
    assert.ok(errors.length > 0, `attestedOn "${date}" must be rejected`);
  }
  // and a real date still passes
  assert.deepEqual(
    gate(entity, index, [{ ...base, attestedBy: 'J. Okonkwo', credential: 'MD', attestedOn: '2026-02-28' }]),
    [],
  );
});
