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

test('a flagged (quarantined) passage fails isBindableAsSourceSupported; a clean source-supported one passes', () => {
  // Reviewer-gate fix-2: a passage with non-empty reviewFlags is stamped status "quarantined" by
  // scripts/evidence/build-evidence-pack.mjs, never "source-supported" — so the fixture no longer
  // contains a flagged record claiming source-supported at all; that self-contradiction is exactly
  // what fix-2 removed.
  const quarantined = allPassages.find((p) => p.reviewFlags.length > 0 && p.status === 'quarantined');
  const clean = allPassages.find((p) => p.reviewFlags.length === 0 && p.status === 'source-supported');
  assert.ok(quarantined, 'fixture must contain at least one quarantined passage');
  assert.ok(clean, 'fixture must contain at least one clean source-supported passage');
  assert.equal(isBindableAsSourceSupported(quarantined), false, `quarantined passage ${quarantined.id} must not be bindable`);
  assert.equal(isBindableAsSourceSupported(clean), true, `clean passage ${clean.id} must be bindable`);
});

test('no passage is simultaneously status "source-supported" and carrying a non-empty reviewFlags (the fix-2 invariant)', () => {
  for (const passage of allPassages) {
    if (passage.status === 'source-supported') {
      assert.equal(passage.reviewFlags.length, 0, `${passage.id}: a source-supported record must never carry reviewFlags`);
    }
    if (passage.reviewFlags.length > 0) {
      assert.equal(passage.status, 'quarantined', `${passage.id}: any flagged record must be quarantined, not source-supported or implementation-proposal`);
    }
  }
});

test('schema REJECTS a quarantined record with empty reviewFlags (the biconditional\'s missing half, reviewer re-review finding B)', () => {
  // Before this fix, schemas/evidence.schema.json only enforced "non-empty reviewFlags => status
  // quarantined" — not the converse. {status: "quarantined", reviewFlags: []} validated cleanly,
  // so a record could claim the defect status while carrying none of the flags that justify it.
  const clean = allPassages.find((p) => p.status === 'source-supported' && p.reviewFlags.length === 0);
  assert.ok(clean, 'fixture must contain a clean source-supported passage to mutate');
  const tampered = { ...clean, status: 'quarantined', reviewFlags: [] };
  const errors = validate(schema.$defs.passage, tampered, { rootSchema: schema });
  assert.ok(errors.length > 0, 'a quarantined passage with empty reviewFlags must be rejected by the schema');
});

test('isBindableAsSourceSupported fails CLOSED (never throws) on a legacy-shape, malformed, or proposal-sentinel passage', () => {
  // Reviewer-gate fix-3: the earlier version of this test was misnamed — it asserted `true` for
  // `{status: 'source-supported'}` with no `reviewFlags` key at all, i.e. it asserted the OPPOSITE
  // of "degrades to false." An un-audited record must not be bindable just because it also isn't
  // flagged; the fidelity audit having actually run is itself part of the claim. This test now
  // asserts the real fail-closed behavior and adds a genuinely negative case for a malformed
  // (non-array) `reviewFlags`.
  assert.equal(isBindableAsSourceSupported(null), false);
  assert.equal(isBindableAsSourceSupported(undefined), false);
  assert.equal(isBindableAsSourceSupported({ status: 'source-supported' }), false,
    'a record missing reviewFlags entirely must NOT be bindable — absence of the audit is not evidence of a clean audit');
  assert.equal(isBindableAsSourceSupported({ status: 'source-supported', reviewFlags: null }), false,
    'a null reviewFlags must fail closed, not be coerced to "empty"');
  assert.equal(isBindableAsSourceSupported({ status: 'source-supported', reviewFlags: 'none' }), false,
    'a non-array reviewFlags must fail closed, not be coerced to "empty"');
  assert.equal(isBindableAsSourceSupported({ status: 'implementation-proposal', reviewFlags: [] }), false,
    'a sentinel is never itself "source-supported grounding"');
  assert.equal(isBindableAsSourceSupported({ status: 'quarantined', reviewFlags: [] }), false,
    'quarantined status alone disqualifies a passage, independent of reviewFlags');
  assert.equal(isBindableAsSourceSupported({ status: 'source-supported', reviewFlags: [] }), true,
    'the predicate must still report true for a genuinely clean, explicitly-audited record, or it would be vacuous');
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
