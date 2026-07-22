// tests/evidence-rights-resilience.test.mjs — EPR2-T6 (R-P2 resilience, R-P4, FR-WP2-07).
//
// EP-R2 (EPR2-T1/T2/T3/T4) made `license`/`access_basis`/`terms`/`terms_snapshot` required fields
// on schemas/evidence.schema.json's $defs/source going forward. This task's own acceptance
// criterion (phase-r2-source-rights-metadata.md, SC-8): the four target_surfaces —
// src/evidence.js, src/engine.js, src/app.js, scripts/evidence/build-evidence-pack.mjs — must not
// throw on a legacy-shaped source record encountered mid-migration (missing `license` entirely, or
// one with no determined `status`), and absent rights fields must render as
// "rights position unassessed", never "unrestricted".
//
// src/app.js itself is DOM-dependent and is not unit-testable under plain Node (no browser
// automation dependency in this repo — see scripts/smoke-browser-unit-rejection.mjs's own header
// note); its consumer-resilience obligation is covered by this file's direct tests of
// src/evidence.js#sourceRightsPosition (the exact function src/app.js#renderEvidence calls) plus
// the static/dynamic `npm run smoke:browser` + `npm run check:imports` checks (R-P4), not a DOM
// unit test here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  EVIDENCE,
  RIGHTS_POSITION_UNASSESSED,
  sourceRightsPosition,
  sourceRightsPositionById,
} from '../src/evidence.js';
import { sourceRightsPositionForModule } from '../src/evidence/registry.js';
import { assess, assessPediatricAnemia } from '../src/engine.js';
import {
  buildEvidenceDocument,
  buildPassageRecords,
  countUnassessedRightsPositions,
} from '../scripts/evidence/build-evidence-pack.mjs';

const rules = JSON.parse(await readFile(new URL('../modules/anemia/rules.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(await readFile(new URL('../modules/anemia/candidates.json', import.meta.url), 'utf8'));
const example = JSON.parse(await readFile(new URL('../examples/ida-toddler.json', import.meta.url), 'utf8'));

// --- src/evidence.js#sourceRightsPosition / sourceRightsPositionById -------------------------------

test('sourceRightsPosition: RIGHTS_POSITION_UNASSESSED is the exact literal "rights position unassessed"', () => {
  assert.equal(RIGHTS_POSITION_UNASSESSED, 'rights position unassessed');
});

test('sourceRightsPosition: a nullish or non-object source degrades to unassessed, never throws', () => {
  for (const bad of [null, undefined, 'a string', 42, []]) {
    assert.doesNotThrow(() => sourceRightsPosition(bad), `sourceRightsPosition(${JSON.stringify(bad)}) must not throw`);
    assert.equal(sourceRightsPosition(bad), RIGHTS_POSITION_UNASSESSED);
  }
});

test('sourceRightsPosition: a legacy-shape source with no `license` key at all degrades to unassessed', () => {
  const legacy = { id: 'LEGACY_SRC', title: 'Legacy Source' };
  assert.doesNotThrow(() => sourceRightsPosition(legacy));
  assert.equal(sourceRightsPosition(legacy), RIGHTS_POSITION_UNASSESSED);
});

test('sourceRightsPosition: a `license` object present but missing `status` degrades to unassessed', () => {
  const legacy = { id: 'LEGACY_SRC', license: { rights_holder: 'Someone' } };
  assert.equal(sourceRightsPosition(legacy), RIGHTS_POSITION_UNASSESSED);
});

test('sourceRightsPosition: the explicit typed-unknown enum member `license.status: "unknown"` degrades to unassessed — never conflated with a determined status', () => {
  const source = { id: 'SRC', license: { status: 'unknown' } };
  assert.equal(sourceRightsPosition(source), RIGHTS_POSITION_UNASSESSED);
});

test('sourceRightsPosition: every determined license.status enum member passes through verbatim, not fabricated as "unrestricted"', () => {
  for (const status of ['copyrighted', 'open_license', 'public_domain', 'us_federal_government_work', 'mixed_or_third_party']) {
    const source = { id: 'SRC', license: { status } };
    assert.equal(sourceRightsPosition(source), status);
    assert.notEqual(sourceRightsPosition(source), 'unrestricted');
  }
});

test('sourceRightsPositionById: an unknown source id degrades to unassessed rather than throwing', () => {
  assert.doesNotThrow(() => sourceRightsPositionById('DOES_NOT_EXIST'));
  assert.equal(sourceRightsPositionById('DOES_NOT_EXIST'), RIGHTS_POSITION_UNASSESSED);
  assert.equal(sourceRightsPositionById(undefined), RIGHTS_POSITION_UNASSESSED);
});

test('sourceRightsPositionById: resolves the real shipped position for a determined anemia source (AAP2026_IDA, EPR2-T3)', () => {
  assert.equal(sourceRightsPositionById('AAP2026_IDA'), 'copyrighted');
  assert.equal(EVIDENCE.AAP2026_IDA.license.status, 'copyrighted', 'sanity: fixture assumption about the shipped KB');
});

test('sourceRightsPositionById: resolves the real shipped position for the government-work source (CDC2025_LEAD, EPR2-T4)', () => {
  assert.equal(sourceRightsPositionById('CDC2025_LEAD'), 'us_federal_government_work');
});

test('sourceRightsPositionById: a shipped source not yet determined (license.status: "unknown") reads as unassessed, never as unrestricted', () => {
  const undetermined = Object.values(EVIDENCE).find((source) => source.license?.status === 'unknown');
  assert.ok(undetermined, 'sanity: at least one shipped source must still be undetermined for this case to be meaningful');
  assert.equal(sourceRightsPositionById(undetermined.id), RIGHTS_POSITION_UNASSESSED);
});

// --- src/evidence/registry.js#sourceRightsPositionForModule -----------------------------------------

test('sourceRightsPositionForModule("anemia", ...) resolves identically to src/evidence.js#sourceRightsPositionById', () => {
  assert.equal(sourceRightsPositionForModule('anemia', 'AAP2026_IDA'), sourceRightsPositionById('AAP2026_IDA'));
  assert.equal(sourceRightsPositionForModule('anemia', 'DOES_NOT_EXIST'), RIGHTS_POSITION_UNASSESSED);
});

test('sourceRightsPositionForModule FAILS LOUDLY (throws) for any unregistered moduleId — never silently returns anemia data', () => {
  for (const badModuleId of ['lipid-panel', 'not-a-real-module', '', undefined, null]) {
    assert.throws(
      () => sourceRightsPositionForModule(badModuleId, 'AAP2026_IDA'),
      (error) => error.message.includes('unknown module') || error.message.includes(String(badModuleId)),
      `expected sourceRightsPositionForModule to throw for moduleId ${JSON.stringify(badModuleId)}, not silently resolve`,
    );
  }
});

// --- src/engine.js: assess() carries sourceRightsPosition through provenance.ruleAudit --------------

test('assess() resolves provenance.ruleAudit[].sourceRightsPosition through the moduleId-scoped registry, for every entry, without throwing', () => {
  const result = assessPediatricAnemia(example, rules, candidates);
  assert.ok(result.provenance.ruleAudit.length > 0, 'sanity: at least one rule must be audited');
  for (const entry of result.provenance.ruleAudit) {
    assert.ok(
      typeof entry.sourceRightsPosition === 'string' && entry.sourceRightsPosition.length > 0,
      `every ruleAudit entry must carry a non-empty sourceRightsPosition string, got ${JSON.stringify(entry.sourceRightsPosition)} for rule ${entry.ruleId}`,
    );
    assert.notEqual(entry.sourceRightsPosition, 'unrestricted');
  }
});

test('assess() throws rather than silently resolving rights positions against anemia data when given an unregistered moduleId', () => {
  assert.throws(() => assess(example, 'not-a-real-module', rules, candidates));
});

// --- scripts/evidence/build-evidence-pack.mjs: legacy-shape source survives regeneration ------------

function fakePack(sourceId) {
  return {
    runId: 'r',
    reviewDate: '2026-07-21',
    sources: [
      {
        kbSourceId: sourceId,
        sourceCardId: 's',
        surveillanceQuery: 'q',
        passages: [
          {
            evidenceId: 'ev_001',
            status: 'implementation-proposal',
            sourceLocator: { raw: 'sentinel', page: null, section: null, table: null, figure: null },
            summary: '',
            applicability: { age: null, sex: null, assay: null },
            evidenceGrade: null,
            supersedes: null,
          },
        ],
      },
    ],
  };
}

function fidelityIndex() {
  return { flagsFor: () => [], findingIdsFor: () => [] };
}

test('buildEvidenceDocument does not throw on a legacy-shape source missing license/access_basis/terms/terms_snapshot entirely', () => {
  const legacyDoc = {
    knowledgeBaseVersion: 'test',
    reviewedThrough: '2026-07-21',
    sources: [
      {
        id: 'LEGACY_SRC',
        title: 'A pre-EP-R2 source record',
        supports: ['a claim'],
        // deliberately no license / access_basis / terms / terms_snapshot — the exact
        // mid-migration shape this task exists to tolerate.
      },
    ],
  };
  const pack = fakePack('LEGACY_SRC');
  pack.sources[0].passages = []; // only the unconditional D-EP3-3 sentinel — see buildPassageRecords test below

  let nextDoc;
  assert.doesNotThrow(() => {
    nextDoc = buildEvidenceDocument(legacyDoc, pack, fidelityIndex());
  });
  const nextSource = nextDoc.sources.find((s) => s.id === 'LEGACY_SRC');
  assert.ok(nextSource, 'the legacy source must survive regeneration');
  assert.equal(nextSource.title, 'A pre-EP-R2 source record', 'non-passages fields must pass through unchanged');
  assert.equal(Object.hasOwn(nextSource, 'license'), false, 'a legacy source must not have license fabricated onto it');
  assert.ok(Array.isArray(nextSource.passages) && nextSource.passages.length === 1);
});

test('countUnassessedRightsPositions counts a legacy-shape source (no license at all) as unassessed', () => {
  const doc = { sources: [{ id: 'LEGACY_SRC' }] };
  assert.equal(countUnassessedRightsPositions(doc), 1);
});

test('countUnassessedRightsPositions does not count a source with a determined license.status', () => {
  const doc = { sources: [{ id: 'SRC', license: { status: 'copyrighted' } }] };
  assert.equal(countUnassessedRightsPositions(doc), 0);
});

test('countUnassessedRightsPositions against the real shipped evidence.json matches the number of still-undetermined sources', async () => {
  const evidenceData = JSON.parse(await readFile(new URL('../modules/anemia/evidence.json', import.meta.url), 'utf8'));
  const expected = evidenceData.sources.filter((s) => s.license?.status === 'unknown').length;
  assert.equal(countUnassessedRightsPositions(evidenceData), expected);
});

test('buildPassageRecords is exported and still produces the implementation-proposal sentinel for a legacy-shape source (sanity — R-P2 does not regress EP-3 behavior)', () => {
  const pack = fakePack('LEGACY_SRC');
  pack.sources[0].passages = []; // no located passages — only the unconditional D-EP3-3 sentinel
  const records = buildPassageRecords(pack.sources[0], pack, fidelityIndex());
  assert.equal(records.length, 1);
  assert.equal(records[0].id, 'LEGACY_SRC#implementation-proposal');
  assert.equal(records[0].status, 'implementation-proposal');
});
