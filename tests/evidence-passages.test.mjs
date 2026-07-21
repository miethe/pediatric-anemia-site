// tests/evidence-passages.test.mjs — EP-3 test coverage.
//
// Guards the invariants EP-3 asked for: schema fidelity of every passage record, per-source
// counts, the D-EP3-4 paraphrase-only rule, the D-EP3-3 sentinel-per-source rule, and the
// determinism guarantee (AC EP3-T2) that `build-evidence-pack.mjs --check` re-derives the exact
// bytes committed under `modules/anemia/evidence.json`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'evidence.json');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'evidence.schema.json');
const PACK_PATH = path.join(REPO_ROOT, 'evidence-packs', 'rf-ev-001', 'pack.json');
const BUILD_SCRIPT = path.join(REPO_ROOT, 'scripts', 'evidence', 'build-evidence-pack.mjs');

// The design record pins these exact per-source LOCATED counts (docs/project_plans/
// implementation_plans/infrastructure/wave0-safety-foundation-v1/ep3-passage-design.md,
// Source-card→KB-source mapping table). 35 located (source-supported OR quarantined,
// reviewer-gate fix-2) + 6 proposal sentinels = 41.
//
// Reviewer-gate fix-2 split the 35 located passages into 13 clean "source-supported" and 22
// "quarantined" (a passage a fidelity audit flagged as defective, per
// scripts/evidence/build-evidence-pack.mjs's status-derivation rule) — the two together must still
// equal the design record's per-source located counts, but the split between them is a fact about
// the EP3-T5 audit's findings, not something this design table pins.
const EXPECTED_POINTS_PER_SOURCE = {
  AAP2026_IDA: 7,
  WHO2024_HB: 6,
  BLOOD2022_PED_ANEMIA: 5,
  CDC2025_LEAD: 5,
  FDA2026_CDS: 5,
  BSH2020_G6PD: 7,
};
const EXPECTED_LOCATED = Object.values(EXPECTED_POINTS_PER_SOURCE).reduce((a, b) => a + b, 0); // 35
const EXPECTED_TOTAL = EXPECTED_LOCATED + Object.keys(EXPECTED_POINTS_PER_SOURCE).length; // 41
const EXPECTED_SOURCE_SUPPORTED = 13;
const EXPECTED_QUARANTINED = 22;

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

let evidenceDoc;
let schema;
let pack;

test('evidence.json fixtures load', async () => {
  evidenceDoc = await loadJson(EVIDENCE_PATH);
  schema = await loadJson(SCHEMA_PATH);
  pack = await loadJson(PACK_PATH);
  assert.ok(evidenceDoc.sources.length > 0, 'evidence.json must have at least one source');
});

test('every source has at least one passage and the expected count of located (source-supported + quarantined) passages', () => {
  const totals = { total: 0, supported: 0, quarantined: 0, proposal: 0 };
  const covered = new Set();
  for (const source of evidenceDoc.sources) {
    assert.ok(Array.isArray(source.passages) && source.passages.length > 0,
      `source ${source.id} must carry at least one passage record`);
    covered.add(source.id);
    const supported = source.passages.filter((p) => p.status === 'source-supported').length;
    const quarantined = source.passages.filter((p) => p.status === 'quarantined').length;
    const proposal = source.passages.filter((p) => p.status === 'implementation-proposal').length;
    assert.equal(proposal, 1, `source ${source.id} must have exactly one implementation-proposal sentinel`);
    assert.equal(supported + quarantined, EXPECTED_POINTS_PER_SOURCE[source.id],
      `source ${source.id}: expected ${EXPECTED_POINTS_PER_SOURCE[source.id]} located (source-supported + quarantined) passages, got ${supported + quarantined}`);
    totals.total += source.passages.length;
    totals.supported += supported;
    totals.quarantined += quarantined;
    totals.proposal += proposal;
  }
  for (const kbId of Object.keys(EXPECTED_POINTS_PER_SOURCE)) {
    assert.ok(covered.has(kbId), `expected KB source ${kbId} covered by a source record`);
  }
  assert.equal(totals.total, EXPECTED_TOTAL, `expected ${EXPECTED_TOTAL} total passage records, got ${totals.total}`);
  assert.equal(totals.supported + totals.quarantined, EXPECTED_LOCATED,
    `expected ${EXPECTED_LOCATED} located passages, got ${totals.supported + totals.quarantined}`);
  assert.equal(totals.supported, EXPECTED_SOURCE_SUPPORTED,
    `expected ${EXPECTED_SOURCE_SUPPORTED} source-supported passages, got ${totals.supported}`);
  assert.equal(totals.quarantined, EXPECTED_QUARANTINED,
    `expected ${EXPECTED_QUARANTINED} quarantined passages, got ${totals.quarantined}`);
  assert.equal(totals.proposal, Object.keys(EXPECTED_POINTS_PER_SOURCE).length,
    `expected ${Object.keys(EXPECTED_POINTS_PER_SOURCE).length} sentinels, got ${totals.proposal}`);
});

test('evidence.json validates against schemas/evidence.schema.json', () => {
  const errors = validate(schema, evidenceDoc);
  assert.deepEqual(errors, [], `schema errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('every passage record validates against the passage subschema', () => {
  for (const source of evidenceDoc.sources) {
    for (const passage of source.passages) {
      const errors = validate(schema.$defs.passage, passage, { rootSchema: schema });
      assert.deepEqual(errors, [],
        `passage ${passage.id} failed schema:\n${JSON.stringify(errors, null, 2)}`);
      assert.equal(passage.sourceId, source.id,
        `passage ${passage.id} sourceId "${passage.sourceId}" must equal parent source id "${source.id}"`);
    }
  }
});

test('EP3-T1 invariant: an empty exactPassage with status source-supported is rejected', () => {
  const bad = {
    id: 'WHO2024_HB#ev_001',
    sourceId: 'WHO2024_HB',
    status: 'source-supported',
    sourceLocator: { raw: 'irrelevant', page: null, section: null, table: null, figure: null },
    exactPassage: '',
    passageFidelity: 'paraphrase',
    reviewFlags: [],
    reviewFindingIds: [],
    evidenceGrade: 'source-supported-fact',
    applicability: { age: null, sex: null, assay: null },
    reviewDate: '2026-07-18',
    supersedes: null,
    surveillanceQuery: 'q',
    provenance: { runId: 'r', sourceCardId: 's', evidenceId: 'ev_001' },
  };
  const errors = validate(schema.$defs.passage, bad, { rootSchema: schema });
  assert.notEqual(errors.length, 0, 'schema must reject empty exactPassage on a source-supported record');
});

test('EP3-T1 invariant: the same record with status implementation-proposal is accepted', () => {
  const ok = {
    id: 'WHO2024_HB#implementation-proposal',
    sourceId: 'WHO2024_HB',
    status: 'implementation-proposal',
    sourceLocator: { raw: 'sentinel', page: null, section: null, table: null, figure: null },
    exactPassage: '',
    passageFidelity: 'paraphrase',
    reviewFlags: [],
    reviewFindingIds: [],
    evidenceGrade: null,
    applicability: { age: null, sex: null, assay: null },
    reviewDate: '2026-07-18',
    supersedes: null,
    surveillanceQuery: 'q',
    provenance: { runId: 'r', sourceCardId: 's', evidenceId: 'implementation-proposal' },
    // EPR3-T2 (FR-WP3-01/02/03): the three axis fields are REQUIRED on every passage record.
    // Structurally-legal fixture values on a synthetic sentinel — not a classification of any
    // real source content (the KB backfill is EPR3-T5's).
    evidence_item_type: 'bibliographic_metadata',
    judgment_basis: 'unassessed',
    judgment_basis_attestation: null,
    rights_component_class: 'bibliographic_metadata',
  };
  const errors = validate(schema.$defs.passage, ok, { rootSchema: schema });
  assert.deepEqual(errors, [], `sentinel with empty passage must validate, got errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('D-EP3-4: the vendored pack carries no `quote` field on any extracted point', () => {
  // The pack is the boundary the build step reads from. If a `quote` field leaked into the pack,
  // it could reach a passage record on a future refactor. This fails loudly if the vendor step
  // ever regresses.
  for (const source of pack.sources) {
    for (const passage of source.passages) {
      assert.ok(!Object.hasOwn(passage, 'quote'),
        `pack passage ${source.kbSourceId}#${passage.evidenceId} must not carry a "quote" field`);
    }
  }
});

test('D-EP3-4/EP3-T5: every passage is paraphrase or withheld (never verbatim) until REG-002 clears', () => {
  for (const source of evidenceDoc.sources) {
    for (const passage of source.passages) {
      assert.ok(passage.passageFidelity === 'paraphrase' || passage.passageFidelity === 'withheld',
        `passage ${passage.id}: every record must be "paraphrase" or "withheld" until REG-002 clears (D-EP3-4), got "${passage.passageFidelity}"`);
    }
  }
});

test('D-EP3-4: no passage.exactPassage equals a verbatim RF quote (skipped when RF bundle absent)', () => {
  // Read the raw RF source-card markdown to collect every `quote:` value the RF cards actually
  // hold, then assert no minted passage's `exactPassage` matches one of them. This is the
  // structural guard against a regression that would silently reintroduce verbatim reuse — the
  // worst failure mode of this task, and one the schema alone can't catch (it does not know
  // what the source-card quotes were). Skipped when the RF mirror is not on this host; the
  // passageFidelity check above still holds the paraphrase-only line structurally.
  const RF_SOURCES_DIR = '/Users/miethe/dev/homelab/development/research-foundry/runs/rf_run_20260717_rf_ev_001_pediatric_cds_backfill/sources';
  const cards = [
    'src_20260718_rfev001_00.md', 'src_20260718_rfev001_01.md', 'src_20260718_rfev001_02.md',
    'src_20260718_rfev001_03.md', 'src_20260718_rfev001_04.md', 'src_20260718_rfev001_05.md',
  ];
  const quotes = new Set();
  for (const filename of cards) {
    const filePath = path.join(RF_SOURCES_DIR, filename);
    let text;
    try {
      text = readFileSync(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EACCES') return;
      throw error;
    }
    for (const match of text.matchAll(/^\s*quote:\s*"((?:\\.|[^"\\])*)"\s*$/gm)) {
      const raw = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      if (raw.length > 0) quotes.add(raw);
    }
  }
  if (quotes.size === 0) return; // RF mirror not available on this host

  assert.ok(quotes.size >= 30, `expected at least 30 RF quotes to compare against, collected ${quotes.size}`);
  for (const source of evidenceDoc.sources) {
    for (const passage of source.passages) {
      if (passage.exactPassage === '') continue;
      assert.ok(!quotes.has(passage.exactPassage),
        `passage ${passage.id}: exactPassage equals a verbatim RF quote — must be the paraphrase (RF summary), never the quote`);
    }
  }
});

test('every located (source-supported or quarantined) passage traces to an ev_NNN evidence id in the pack', () => {
  const packByKb = new Map(pack.sources.map((s) => [s.kbSourceId, s]));
  for (const source of evidenceDoc.sources) {
    const packSource = packByKb.get(source.id);
    assert.ok(packSource, `pack must contain KB source "${source.id}"`);
    const packEvidenceIds = new Set(packSource.passages.map((p) => p.evidenceId));
    for (const passage of source.passages) {
      if (passage.status === 'implementation-proposal') continue;
      assert.ok(/#ev_\d{3}$/.test(passage.id),
        `passage ${passage.id}: a located (${passage.status}) record must use the "<sourceId>#ev_NNN" id pattern`);
      const evId = passage.provenance.evidenceId;
      assert.ok(packEvidenceIds.has(evId),
        `passage ${passage.id}: provenance.evidenceId "${evId}" is not present in the pack for source "${source.id}"`);
    }
  }
});

test('determinism: build-evidence-pack.mjs --check exits 0 against the committed evidence.json', () => {
  const result = spawnSync(process.execPath, [BUILD_SCRIPT, '--check'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0,
    `build-evidence-pack --check exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
});
