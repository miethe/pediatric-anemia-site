// tests/evidence-resilience.test.mjs — EP3-T6 (AC-WP3-RESIL).
//
// Guards the R-P2 resilience invariant: a legacy-shape evidence record (a source with no
// `passages[]` at all, or a passage missing `sourceLocator`/`exactPassage`) encountered
// mid-migration must degrade to "locator pending" and never throw in the render path, while the
// `applicability` asymmetry (unrestricted only on the implementation-proposal sentinel, a hard
// validation failure everywhere else) is enforced by schemas/evidence.schema.json.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import {
  passagesFor,
  passageById,
  passageLocatorText,
  passageExactText,
  passageApplicability,
} from '../src/evidence.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'evidence.schema.json');

let schema;

test('evidence schema loads', async () => {
  schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
  assert.ok(schema.$defs.passage, 'schema must define $defs/passage');
});

// A minimal, otherwise-valid passage record used as a base for the negative-case tests below —
// deliberately not a fixture drawn from modules/anemia/evidence.json, since these tests exercise
// hand-authored legacy shapes that the shipped, fully-migrated KB never actually contains today.
function basePassage(overrides = {}) {
  return {
    id: 'FAKE_SRC#ev_001',
    sourceId: 'FAKE_SRC',
    status: 'source-supported',
    sourceLocator: { raw: 'p. 1', page: '1', section: null, table: null, figure: null },
    exactPassage: 'Something located.',
    passageFidelity: 'paraphrase',
    evidenceGrade: 'source-supported-fact',
    applicability: { age: null, sex: null, assay: null },
    reviewDate: '2026-07-18',
    supersedes: null,
    surveillanceQuery: 'q',
    provenance: { runId: 'r', sourceCardId: 's', evidenceId: 'ev_001' },
    ...overrides,
  };
}

test('passagesFor/passageById degrade to []/null on an unknown source or passage id (no throw)', () => {
  assert.deepEqual(passagesFor('DOES_NOT_EXIST'), []);
  assert.equal(passageById('DOES_NOT_EXIST#ev_001'), null);
  assert.equal(passageById(undefined), null);
});

test('a legacy source with no passages[] renders "locator pending" via the accessors, without throwing', () => {
  const passages = passagesFor('DOES_NOT_EXIST');
  assert.deepEqual(passages, []);
  // The render path always looks up a specific passage before formatting it; an empty passages[]
  // array means that lookup finds nothing, and the formatter must still not throw.
  assert.equal(passageLocatorText(passages[0]), 'locator pending');
  assert.equal(passageExactText(passages[0]), 'locator pending');
});

test('a passage missing sourceLocator entirely degrades to "locator pending" rather than crashing', () => {
  const legacy = basePassage();
  delete legacy.sourceLocator;
  assert.doesNotThrow(() => passageLocatorText(legacy));
  assert.equal(passageLocatorText(legacy), 'locator pending');
});

test('a passage with sourceLocator but an empty raw degrades to "locator pending"', () => {
  const legacy = basePassage({ sourceLocator: { raw: '', page: null, section: null, table: null, figure: null } });
  assert.equal(passageLocatorText(legacy), 'locator pending');
});

test('a passage missing exactPassage entirely degrades to "locator pending" rather than crashing', () => {
  const legacy = basePassage();
  delete legacy.exactPassage;
  assert.doesNotThrow(() => passageExactText(legacy));
  assert.equal(passageExactText(legacy), 'locator pending');
});

test('the implementation-proposal sentinel\'s intentional empty exactPassage also reads as "locator pending"', () => {
  const sentinel = basePassage({ status: 'implementation-proposal', exactPassage: '' });
  assert.equal(passageExactText(sentinel), 'locator pending');
});

test('passageApplicability: absent applicability reads as unrestricted only on an implementation-proposal record', () => {
  const proposal = basePassage({ status: 'implementation-proposal', exactPassage: '' });
  delete proposal.applicability;
  assert.deepEqual(passageApplicability(proposal), { age: null, sex: null, assay: null });

  const sourceSupported = basePassage();
  delete sourceSupported.applicability;
  assert.equal(passageApplicability(sourceSupported), null, 'absent applicability on a source-supported record must not be fabricated as unrestricted');
});

test('AC-WP3-RESIL: absent applicability fails schema validation on a source-supported record but is tolerated on an implementation-proposal record', () => {
  const sourceSupported = basePassage();
  delete sourceSupported.applicability;
  const sourceSupportedErrors = validate(schema.$defs.passage, sourceSupported, { rootSchema: schema });
  assert.notEqual(sourceSupportedErrors.length, 0,
    'a source-supported record with no applicability must fail validation (unrestricted-by-default clinical applicability is a safety defect)');

  const proposal = basePassage({ status: 'implementation-proposal', exactPassage: '' });
  delete proposal.applicability;
  const proposalErrors = validate(schema.$defs.passage, proposal, { rootSchema: schema });
  assert.deepEqual(proposalErrors, [],
    `an implementation-proposal record with no applicability must validate (absence reads as unrestricted), got errors:\n${JSON.stringify(proposalErrors, null, 2)}`);
});

test('passageApplicability returns the record\'s own applicability object when present, unmodified', () => {
  const passage = basePassage({ applicability: { age: '6-24 mo', sex: null, assay: 'CBC' } });
  assert.deepEqual(passageApplicability(passage), { age: '6-24 mo', sex: null, assay: 'CBC' });
});
