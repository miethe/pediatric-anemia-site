// tests/candidate-governance.test.mjs — FIX-C (reviewer re-review, EP3-T4) test coverage.
//
// Mirrors tests/rule-governance.test.mjs's sourcePassageId coverage for
// modules/anemia/candidates.json's 26 diagnostic patterns: schema validity, presence/shape of
// sourcePassageId, the determinism/re-runnability guarantee for
// scripts/evidence/backfill-candidate-governance.mjs, and that scripts/validate-kb.mjs validates
// the ACTUAL candidate pointer rather than "the cited source has some passage."

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { validateModule, validateCandidates, validateEvidenceDocument } from '../scripts/validate-kb.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'candidates.json');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'candidate.schema.json');
const BACKFILL_SCRIPT = path.join(REPO_ROOT, 'scripts', 'evidence', 'backfill-candidate-governance.mjs');

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

let candidates;
let schema;

test('candidates.json and candidate.schema.json load', async () => {
  candidates = await loadJson(CANDIDATES_PATH);
  schema = await loadJson(SCHEMA_PATH);
  assert.equal(Object.keys(candidates).length, 26, 'FIX-C governs a fixed 26-candidate KB');
});

test('all 26 candidates validate against the extended candidate.schema.json', () => {
  for (const [id, candidate] of Object.entries(candidates)) {
    const errors = validate(schema, candidate);
    assert.deepEqual(errors, [], `${id} should validate cleanly: ${JSON.stringify(errors)}`);
  }
});

test('sourcePassageId is present, non-null, and resolves to a source-supported or implementation-proposal shape on every candidate', () => {
  for (const [id, candidate] of Object.entries(candidates)) {
    assert.ok(typeof candidate.sourcePassageId === 'string' && candidate.sourcePassageId.length > 0, `${id}: sourcePassageId must be a non-empty string post-backfill`);
    assert.match(candidate.sourcePassageId, /^[A-Z0-9_]+#(ev_[0-9]{3}|implementation-proposal)$/);
  }
});

test('a candidate missing sourcePassageId is rejected by the schema', () => {
  const [firstId, firstCandidate] = Object.entries(candidates)[0];
  const broken = { ...firstCandidate };
  delete broken.sourcePassageId;
  const errors = validate(schema, broken);
  assert.ok(errors.length > 0, `omitting sourcePassageId on ${firstId} should fail validation`);
  assert.ok(errors.some((error) => error.path === '$.sourcePassageId'));
});

test('every candidate sourcePassageId currently falls back to the implementation-proposal sentinel (no reviewed mapping exists yet)', () => {
  for (const [id, candidate] of Object.entries(candidates)) {
    assert.ok(
      candidate.sourcePassageId.endsWith('#implementation-proposal'),
      `${id}: expected the honest implementation-proposal fallback (no candidate->passage review has happened) — got "${candidate.sourcePassageId}"`,
    );
  }
});

test('backfill-candidate-governance.mjs --check exits 0 against the committed candidates.json', () => {
  const result = spawnSync(process.execPath, [BACKFILL_SCRIPT, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, `--check should exit 0: stdout=${result.stdout} stderr=${result.stderr}`);
  assert.match(result.stdout, /matches regenerated output/);
});

test('validateModule validates the ACTUAL candidate sourcePassageId pointer, not just "the cited source has some passage"', async () => {
  const result = await validateModule('anemia', REPO_ROOT);
  assert.deepEqual(result.errors, [], `validateModule should report zero errors on the committed KB: ${JSON.stringify(result.errors)}`);
  assert.equal(result.candidatePassageStatusCounts['implementation-proposal'], 26);
  assert.equal(result.candidatePassageStatusCounts['source-supported'], 0);
  assert.equal(result.candidatePassageStatusCounts.quarantined, 0);
  assert.equal(result.candidatePassageStatusCounts.unresolved, 0);
});

// The following tests exercise validateCandidates (the pure function extracted from
// validateModule's candidate loop) directly against tampered in-memory candidates — no disk
// writes, no reliance on the committed KB happening to contain a bad record.
let evidenceContext;

test('build passageIndex/evidenceIds/sourcesWithPassages fixtures from the committed evidence.json', async () => {
  const evidenceSchema = await loadJson(path.join(REPO_ROOT, 'schemas', 'evidence.schema.json'));
  const evidenceData = await loadJson(path.join(REPO_ROOT, 'modules', 'anemia', 'evidence.json'));
  const { errors, passageIndex, sourcesWithPassages } = validateEvidenceDocument(evidenceData, 'anemia', evidenceSchema);
  assert.deepEqual(errors, []);
  evidenceContext = {
    candidateSchema: schema,
    evidenceIds: new Set(evidenceData.sources.map((s) => s.id)),
    sourcesWithPassages,
    passageIndex,
  };
});

test('validateCandidates catches a candidate sourcePassageId that does not resolve to any known passage', () => {
  const tampered = { ...candidates, 'iron-deficiency-anemia': { ...candidates['iron-deficiency-anemia'], sourcePassageId: 'NOT_A_REAL_SOURCE#implementation-proposal' } };
  const { errors, candidatePassageStatusCounts } = validateCandidates(tampered, 'anemia', evidenceContext);
  assert.ok(errors.some((e) => e.includes('iron-deficiency-anemia') && e.includes('does not resolve to a known passage')));
  assert.equal(candidatePassageStatusCounts.unresolved, 1);
});

test('validateCandidates catches a candidate sourcePassageId bound to a quarantined passage', () => {
  const quarantined = [...evidenceContext.passageIndex.values()].find((p) => p.status === 'quarantined');
  assert.ok(quarantined, 'fixture must contain at least one quarantined passage to bind against');
  const firstId = Object.keys(candidates)[0];
  const tampered = { ...candidates, [firstId]: { ...candidates[firstId], sourcePassageId: quarantined.id } };
  const { errors, candidatePassageStatusCounts } = validateCandidates(tampered, 'anemia', evidenceContext);
  assert.ok(errors.some((e) => e.includes(firstId) && e.includes('cannot be bound as source-supported grounding')));
  assert.equal(candidatePassageStatusCounts.quarantined, 1);
});

test('validateCandidates rejects a candidate missing sourcePassageId entirely', () => {
  const firstId = Object.keys(candidates)[0];
  const broken = { ...candidates[firstId] };
  delete broken.sourcePassageId;
  const tampered = { ...candidates, [firstId]: broken };
  const { errors, candidatePassageStatusCounts } = validateCandidates(tampered, 'anemia', evidenceContext);
  assert.ok(errors.some((e) => e.includes(firstId) && e.includes('missing sourcePassageId')));
  assert.equal(candidatePassageStatusCounts.unresolved, 1);
});

test('validateCandidates reports zero errors against the committed, unmodified candidates.json', () => {
  const { errors, candidatePassageStatusCounts } = validateCandidates(candidates, 'anemia', evidenceContext);
  assert.deepEqual(errors, []);
  assert.equal(candidatePassageStatusCounts['implementation-proposal'], 26);
});
