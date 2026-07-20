// tests/evidence-fidelity-flags.test.mjs — EP3-T5 audit-remediation test coverage.
//
// Guards the mechanism the fidelity-audit remediation added on top of EP-3's passage records:
// the bidirectional evidence.json <-> fidelity-findings.json cross-check, the single shared
// bindability predicate (src/evidence.js#isBindableAsSourceSupported), and the withholding of the
// EP3T5-F01 near-verbatim spans at vendor time. None of this authors or edits clinical prose — it
// only ever suppresses a claim (reviewFlags) or withholds already-restricted text.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { validateFidelityFindings } from '../scripts/validate-kb.mjs';
import { isBindableAsSourceSupported } from '../src/evidence.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'evidence.json');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'evidence.schema.json');
const FINDINGS_PATH = path.join(REPO_ROOT, 'evidence-packs', 'rf-ev-001', 'fidelity-findings.json');
const EVIDENCE_PACKS_DIR = path.join(REPO_ROOT, 'evidence-packs');
const WITHHOLDING_FLAG = 'near-verbatim-span-pending-rights';

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function listFilesRecursive(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFilesRecursive(full)));
    else files.push(full);
  }
  return files;
}

let evidenceDoc;
let schema;
let findings;
let allPassages;
let withheldPassages;

test('fixtures load', async () => {
  evidenceDoc = await loadJson(EVIDENCE_PATH);
  schema = await loadJson(SCHEMA_PATH);
  findings = await loadJson(FINDINGS_PATH);
  allPassages = evidenceDoc.sources.flatMap((source) => source.passages);
  withheldPassages = allPassages.filter((p) => p.passageFidelity === 'withheld');
  assert.ok(findings.findings.length > 0, 'fidelity-findings.json must carry at least one finding');
});

test('every reviewFindingIds entry resolves to a real finding, and every finding.passageIds entry resolves to a real passage (both directions)', () => {
  const errors = validateFidelityFindings(evidenceDoc, findings, 'anemia');
  assert.deepEqual(errors, [], `fidelity cross-check errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('validateFidelityFindings catches a phantom finding id on a passage', () => {
  const tampered = JSON.parse(JSON.stringify(evidenceDoc));
  tampered.sources[0].passages[0].reviewFindingIds = ['EP3T5-F99-DOES-NOT-EXIST'];
  const errors = validateFidelityFindings(tampered, findings, 'anemia');
  assert.ok(errors.some((e) => e.includes('EP3T5-F99-DOES-NOT-EXIST')),
    'a phantom finding id on a passage must be reported');
});

test('validateFidelityFindings catches a passage carrying reviewFlags not named by any finding (hand-editing drift)', () => {
  const tampered = JSON.parse(JSON.stringify(evidenceDoc));
  const clean = tampered.sources.flatMap((s) => s.passages).find((p) => p.reviewFlags.length === 0 && p.status === 'source-supported');
  assert.ok(clean, 'fixture must contain at least one clean source-supported passage to tamper with');
  clean.reviewFlags = ['omits-source-numerics'];
  const errors = validateFidelityFindings(tampered, findings, 'anemia');
  assert.ok(errors.some((e) => e.includes(clean.id) && e.includes('hand-editing drift')),
    `expected a hand-editing-drift error naming ${clean.id}`);
});

test('a flagged passage fails isBindableAsSourceSupported; a clean one passes', () => {
  const flagged = allPassages.find((p) => p.reviewFlags.length > 0 && p.status === 'source-supported');
  const clean = allPassages.find((p) => p.reviewFlags.length === 0 && p.status === 'source-supported');
  assert.ok(flagged, 'fixture must contain at least one flagged source-supported passage');
  assert.ok(clean, 'fixture must contain at least one clean source-supported passage');
  assert.equal(isBindableAsSourceSupported(flagged), false, `flagged passage ${flagged.id} must not be bindable`);
  assert.equal(isBindableAsSourceSupported(clean), true, `clean passage ${clean.id} must be bindable`);
});

test('isBindableAsSourceSupported degrades to false (never throws) on a legacy-shape or proposal-sentinel passage', () => {
  assert.equal(isBindableAsSourceSupported(null), false);
  assert.equal(isBindableAsSourceSupported(undefined), false);
  assert.equal(isBindableAsSourceSupported({ status: 'source-supported' }), true, 'missing reviewFlags degrades to "no flags", not "unbindable" -- but status alone is not enough to fabricate a bind decision beyond that');
  assert.equal(isBindableAsSourceSupported({ status: 'implementation-proposal', reviewFlags: [] }), false,
    'a sentinel is never itself "source-supported grounding"');
});

test('every near-verbatim-span-pending-rights record has passageFidelity "withheld" and exactPassage equal to the placeholder', () => {
  const expectedWithheldIds = new Set(
    findings.findings.filter((f) => f.flag === WITHHOLDING_FLAG).flatMap((f) => f.passageIds),
  );
  assert.ok(expectedWithheldIds.size > 0, 'expected at least one near-verbatim-span-pending-rights finding');

  const byId = new Map(allPassages.map((p) => [p.id, p]));
  for (const passageId of expectedWithheldIds) {
    const passage = byId.get(passageId);
    assert.ok(passage, `expected withheld passage "${passageId}" to exist in evidence.json`);
    assert.equal(passage.passageFidelity, 'withheld', `passage ${passageId} must be passageFidelity "withheld"`);
    assert.equal(passage.exactPassage, findings.withholdPlaceholder,
      `passage ${passageId}: exactPassage must equal the withhold placeholder exactly`);
    assert.ok(passage.reviewFlags.includes(WITHHOLDING_FLAG),
      `passage ${passageId} must carry the ${WITHHOLDING_FLAG} flag`);
  }

  // And the converse: nothing is withheld that the findings file didn't ask for.
  for (const passage of withheldPassages) {
    assert.ok(expectedWithheldIds.has(passage.id), `passage ${passage.id} is withheld but not named by any ${WITHHOLDING_FLAG} finding`);
  }
});

test('none of the withheld records\' original RF summary text appears anywhere under evidence-packs/ or in modules/anemia/evidence.json (skipped when RF bundle absent)', async () => {
  const RF_SOURCES_DIR = '/Users/miethe/dev/homelab/development/research-foundry/runs/rf_run_20260717_rf_ev_001_pediatric_cds_backfill/sources';
  const cards = [
    'src_20260718_rfev001_00.md', 'src_20260718_rfev001_01.md', 'src_20260718_rfev001_02.md',
    'src_20260718_rfev001_03.md', 'src_20260718_rfev001_04.md', 'src_20260718_rfev001_05.md',
  ];

  // Map every RF card's evidence_id -> kbSourceId via the same mapping build-evidence-pack.mjs
  // uses. Kept as a small local literal (not imported) so this test independently re-derives the
  // expectation rather than trusting the vendor script's own internal map.
  const CARD_TO_KB_ID = {
    src_20260718_rfev001_00: 'AAP2026_IDA',
    src_20260718_rfev001_01: 'WHO2024_HB',
    src_20260718_rfev001_02: 'BLOOD2022_PED_ANEMIA',
    src_20260718_rfev001_03: 'CDC2025_LEAD',
    src_20260718_rfev001_04: 'FDA2026_CDS',
    src_20260718_rfev001_05: 'BSH2020_G6PD',
  };

  const withheldIds = new Set(
    findings.findings.filter((f) => f.flag === WITHHOLDING_FLAG).flatMap((f) => f.passageIds),
  );

  const originalSummaries = [];
  for (const filename of cards) {
    const cardId = filename.replace(/\.md$/, '');
    const kbSourceId = CARD_TO_KB_ID[cardId];
    const filePath = path.join(RF_SOURCES_DIR, filename);
    let text;
    try {
      text = readFileSync(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EACCES') return; // RF mirror not on this host
      throw error;
    }
    for (const match of text.matchAll(/evidence_id:\s*(ev_\d{3})\n\s*locator:[^\n]*\n\s*summary:\s*"((?:\\.|[^"\\])*)"/g)) {
      const [, evidenceId, rawSummary] = match;
      const passageId = `${kbSourceId}#${evidenceId}`;
      if (!withheldIds.has(passageId)) continue;
      const summary = rawSummary.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      originalSummaries.push({ passageId, summary });
    }
  }

  if (originalSummaries.length === 0) return; // RF mirror not available on this host
  assert.equal(originalSummaries.length, withheldIds.size,
    `expected to recover the original summary for all ${withheldIds.size} withheld passages, got ${originalSummaries.length}`);

  const filesToScan = [EVIDENCE_PATH, ...(await listFilesRecursive(EVIDENCE_PACKS_DIR))];
  const contents = await Promise.all(filesToScan.map((f) => readFile(f, 'utf8')));

  for (const { passageId, summary } of originalSummaries) {
    for (let i = 0; i < filesToScan.length; i++) {
      assert.ok(!contents[i].includes(summary),
        `withheld passage ${passageId}'s original RF summary text leaked into ${path.relative(REPO_ROOT, filesToScan[i])}`);
    }
  }
});

test('determinism: build-evidence-pack.mjs --check exits 0 (also exercised in evidence-passages.test.mjs)', async () => {
  const { spawnSync } = await import('node:child_process');
  const BUILD_SCRIPT = path.join(REPO_ROOT, 'scripts', 'evidence', 'build-evidence-pack.mjs');
  const result = spawnSync(process.execPath, [BUILD_SCRIPT, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0,
    `build-evidence-pack --check exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
});

test('every passage validates against the schema with reviewFlags/reviewFindingIds present', () => {
  for (const passage of allPassages) {
    const errors = validate(schema.$defs.passage, passage, { rootSchema: schema });
    assert.deepEqual(errors, [], `passage ${passage.id} failed schema:\n${JSON.stringify(errors, null, 2)}`);
    assert.ok(Array.isArray(passage.reviewFlags), `passage ${passage.id} must carry a reviewFlags array`);
    assert.ok(Array.isArray(passage.reviewFindingIds), `passage ${passage.id} must carry a reviewFindingIds array`);
  }
});
