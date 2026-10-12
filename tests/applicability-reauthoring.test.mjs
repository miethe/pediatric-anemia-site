// applicability-reauthoring.test.mjs — pins evidence-packs/applicability-reauthoring.json.
//
// Two RF `population` strings quoted third-party text past the D1 quoted-run body budget. Nick
// approved re-authoring them on 2026-10-06 (req_01M4A5P5YS3V4T0RX1NYJH3R23). The RF fixture mirrors
// stay byte-identical provenance; the re-authored text lives in one reviewable file and reaches the
// KB through scripts/evidence/vendor-rf-bundle.mjs (pack.json -> evidence.json) plus the committed
// evidence-assertions projections. This test proves every entry is (a) still anchored to its
// unchanged upstream string and (b) applied on every surface, so it can neither rot nor be bypassed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
const sha256 = (s) => `sha256:${createHash('sha256').update(s, 'utf8').digest('hex')}`;

const { entries } = readJson('evidence-packs/applicability-reauthoring.json');
const FIXTURE_BY_RUN = {
  rf_run_20260717_rf_ev_001_pediatric_cds_backfill: 'tests/fixtures/rf-ev-001',
  rf_run_20260717_rf_kid_001_pediatric_cds_evidence: 'tests/fixtures/rf-kid-001',
};

test('every re-authoring entry is anchored to an unchanged population string in its RF fixture mirror', () => {
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    const fixtureDir = FIXTURE_BY_RUN[entry.rfRunId];
    assert.ok(fixtureDir, `${entry.assertionId}: unknown rfRunId ${entry.rfRunId}`);
    const card = readFileSync(path.join(REPO_ROOT, fixtureDir, 'sources', `${entry.sourceCardId}.md`), 'utf8');
    const populations = [...card.matchAll(/^\s*population: (".*")\s*$/gm)].map((m) => JSON.parse(m[1]));
    assert.ok(populations.some((p) => sha256(p) === entry.originalSha256),
      `${entry.assertionId}: no population in ${entry.sourceCardId} hashes to ${entry.originalSha256}`);
  }
});

test('every re-authoring entry is applied to its evidence-assertions projection', () => {
  for (const entry of entries) {
    const doc = readJson(entry.assertionsFile);
    const assertion = doc.assertions.find((a) => a.assertionId === entry.assertionId);
    assert.ok(assertion, `${entry.assertionId} not found in ${entry.assertionsFile}`);
    assert.equal(assertion.applicability.ageRange, entry.reauthored);
  }
});

test('rf-ev-001 entries reach pack.json and modules/anemia/evidence.json', () => {
  const pack = readJson('evidence-packs/rf-ev-001/pack.json');
  const evidence = readJson('modules/anemia/evidence.json');
  for (const entry of entries.filter((e) => e.passageId)) {
    const [kbSourceId, evidenceId] = entry.passageId.split('#');
    const packPassage = pack.sources.find((s) => s.kbSourceId === kbSourceId)
      ?.passages.find((p) => p.evidenceId === evidenceId);
    assert.equal(packPassage?.applicability.age, entry.reauthored, `pack.json ${entry.passageId}`);
    const kbPassage = evidence.sources.find((s) => s.id === kbSourceId)
      ?.passages.find((p) => p.id === entry.passageId);
    assert.equal(kbPassage?.applicability.age, entry.reauthored, `evidence.json ${entry.passageId}`);
  }
});
