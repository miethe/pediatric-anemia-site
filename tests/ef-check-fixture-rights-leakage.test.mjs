// tests/ef-check-fixture-rights-leakage.test.mjs — P1-T7, multi-bundle-conversion-e1 Phase 1
// (Risk R-4 mitigation).
//
// Unit test for `scripts/evidence/check-fixture-rights-leakage.mjs` — the standing rights-leakage
// grep gate wired into `npm run validate`. Exercises the gate's PURE core
// (`checkFixtureFiles`/`findNonPlaceholderLabelValues`/`findHashRegistryLeaks`) against small,
// fully synthetic, in-memory fixture trees — never the real committed `tests/fixtures/rf-*`
// directories and never `git ls-files` — so this suite never depends on git-tracked state and
// never risks touching real fixture bytes.
//
// Proves the task's binding acceptance criteria:
//   1. A clean, correctly-redacted synthetic fixture passes (0 violations, 0 leaks).
//   2. A seeded mutation that restores a real restricted passage's plaintext into a `quote:` field
//      (undoing a redaction in place) is caught by the STRUCTURAL check, non-zero-equivalent
//      (non-empty violations list), naming the exact file/line — this is the direct analog of the
//      task's "temporarily seed one restricted passage's text into a fixture file, confirm the
//      gate exits non-zero" requirement, run here as an in-memory unit test rather than a manual
//      mutate-run-revert cycle against real fixtures (which was ALSO performed manually once,
//      out-of-band, against the real committed fixtures as this task's own proof step, then
//      reverted — see the phase progress note).
//   3. A seeded mutation that leaks the same real passage text into a non-`sources/` file (e.g. a
//      report or research brief) is caught by the HASH-REGISTRY LEAK SCAN instead.
//   4. The one legitimate false-positive risk this design explicitly avoids: a source card's
//      untouched `locator` field (or a short `threshold.value`) that happens to duplicate a
//      redacted passage's plaintext byte-for-byte does NOT trip the hash-registry leak scan
//      (`sources/` files are deliberately excluded from that specific check — see the gate's own
//      file banner).
//   5. Reverting a seeded mutation restores a clean pass — the gate is not stateful/one-shot.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  checkFixtureFiles,
  extractPlaceholderHashes,
  RightsLeakageError,
} from '../scripts/evidence/check-fixture-rights-leakage.mjs';
import { REDACTION_PREFIX, REDACTION_SUFFIX } from '../scripts/evidence/generate-rf-fixture.mjs';

const RESTRICTED_QUOTE = 'This is the exact restricted verbatim passage text that must never be committed in the clear.';
const SHORT_LOCATOR_EXCERPT = 'Short Heading Text';

function sha256Hex(str) {
  // Local re-implementation (its own `createHash` import) — kept separate from the gate's own
  // `sha256Hex` helper (which is not exported) so this test never silently passes due to sharing
  // a broken hash helper with the code under test.
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

function placeholder(text) {
  const hash = sha256Hex(text);
  return `${REDACTION_PREFIX}${hash}${REDACTION_SUFFIX}`;
}

/** Builds a small, structurally-complete synthetic fixture tree (as `{relPath, text}` entries) —
 * one source card (one restricted passage + one short untouched `locator`/`threshold.value` that
 * intentionally duplicates a DIFFERENT known passage's plaintext, proving item 4 above), an
 * extraction card, a claim ledger, a report, and a HASH-PROVENANCE.md whose §1 disposition table
 * matches. `overrides` lets a test replace one file's text wholesale to seed a mutation. */
function buildSyntheticFixture({ overrides = {} } = {}) {
  const relDir = 'tests/fixtures/rf-synthtest-001';

  const sourceCard = `---
schema_version: '0.1'
type: source_card
source_card_id: src_synth_00
extracted_points:
- evidence_id: ev_001
  locator: "${SHORT_LOCATOR_EXCERPT}"
  summary: "Synthetic paraphrase."
  quote: "${placeholder(RESTRICTED_QUOTE)}"
  pediatric_cds:
    threshold: {value: "${SHORT_LOCATOR_EXCERPT}", units_ucum: null, passage_locator: "${placeholder(SHORT_LOCATOR_EXCERPT)}"}
    classification: source_supported_fact
---
# Source Card: Synth

## Key evidence
- (ev_001) Synthetic paraphrase — locator: "${SHORT_LOCATOR_EXCERPT}" — quote: "${placeholder(RESTRICTED_QUOTE)}"
`;

  const extractionCard = `---
schema_version: '0.1'
type: extraction_card
extraction_id: ext_synth_001
text: "RF's own paraphrase, never a verbatim excerpt."
locator: "${SHORT_LOCATOR_EXCERPT}"
---
`;

  const report = `# Report Draft\n\nSynthetic report body. No verbatim excerpts here.\n`;

  const hashProvenance = `# Hash-Provenance Note — synthetic test fixture

## 1. Content-rights disposition (applies to every passage in this bundle)

| # | Source card | Title | Publisher | Evidence points (passages) | Disposition |
|---|---|---|---|---:|---|
| 00 | \`src_synth_00\` | Synthetic Title | Synthetic Publisher | 1 | restricted |

## 2. What was sanitized, and how

Synthetic note body.
`;

  const files = new Map([
    [`${relDir}/sources/src_synth_00.md`, sourceCard],
    [`${relDir}/extractions/ext_synth_001.yaml`, extractionCard],
    [`${relDir}/reports/report_draft.md`, report],
    [`${relDir}/HASH-PROVENANCE.md`, hashProvenance],
  ]);

  for (const [relPath, text] of Object.entries(overrides)) {
    files.set(`${relDir}/${relPath}`, text);
  }

  const fileEntries = [...files.entries()].map(([relPath, text]) => ({ relPath, text }));
  return { relDir, fileEntries };
}

function buildGlobalRegistry(fileEntries) {
  const hashes = new Set();
  for (const { relPath, text } of fileEntries) {
    if (relPath.endsWith('/HASH-PROVENANCE.md')) continue;
    for (const hash of extractPlaceholderHashes(text)) hashes.add(hash);
  }
  return hashes;
}

test('clean synthetic fixture: 0 structural violations, 0 hash-registry leaks', () => {
  const { relDir, fileEntries } = buildSyntheticFixture();
  const registry = buildGlobalRegistry(fileEntries);
  const result = checkFixtureFiles(relDir, fileEntries, registry);
  assert.equal(result.violations.length, 0);
  assert.equal(result.leaks.length, 0);
  assert.equal(result.placeholderCount > 0, true);
  assert.equal(result.warnings.length, 0);
});

test('seeded mutation 1: restoring real plaintext into a "quote:" field is caught by the structural check', () => {
  const clean = buildSyntheticFixture();
  const registry = buildGlobalRegistry(clean.fileEntries);

  const mutatedSourceCard = clean.fileEntries.find((e) => e.relPath.endsWith('src_synth_00.md')).text.replace(
    `quote: "${placeholder(RESTRICTED_QUOTE)}"`,
    `quote: "${RESTRICTED_QUOTE}"`,
  );
  const mutated = buildSyntheticFixture({ overrides: { 'sources/src_synth_00.md': mutatedSourceCard } });

  const result = checkFixtureFiles(mutated.relDir, mutated.fileEntries, registry);
  assert.equal(result.violations.length >= 1, true, 'expected at least one structural violation');
  const hit = result.violations.find((v) => v.label === 'quote');
  assert.ok(hit, 'expected a violation tagged with label "quote"');
  assert.match(hit.reason, /not the ADR-0002 redaction placeholder/);
  // The failure message must never print the restricted plaintext itself — only its hash.
  assert.equal(JSON.stringify(result).includes(RESTRICTED_QUOTE), false);
});

test('seeded mutation 2: leaking real plaintext into a non-source file (report) is caught by the hash-registry scan', () => {
  const clean = buildSyntheticFixture();
  const registry = buildGlobalRegistry(clean.fileEntries);

  const leakedReport = `# Report Draft\n\nSynthetic report body.\n\nnote: "${RESTRICTED_QUOTE}"\n`;
  const mutated = buildSyntheticFixture({ overrides: { 'reports/report_draft.md': leakedReport } });

  const result = checkFixtureFiles(mutated.relDir, mutated.fileEntries, registry);
  assert.equal(result.leaks.length, 1);
  assert.equal(result.leaks[0].relPath, `${mutated.relDir}/reports/report_draft.md`);
  assert.equal(result.leaks[0].hash, sha256Hex(RESTRICTED_QUOTE));
  assert.equal(JSON.stringify(result).includes(RESTRICTED_QUOTE), false);
});

test('legitimate untouched "locator"/"threshold.value" duplication of a short excerpt does NOT false-positive the leak scan', () => {
  // SHORT_LOCATOR_EXCERPT is deliberately both (a) the untouched `locator`/`threshold.value` text
  // on the source card, byte-for-byte, and (b) the plaintext behind its own `passage_locator`
  // placeholder's hash — the exact legitimate-duplication shape `generate-rf-fixture.mjs`'s
  // `assertKnownExcerptsRedacted` doc comment calls out. Because the hash-registry scan excludes
  // `sources/` files entirely, this must never be reported as a leak.
  const { relDir, fileEntries } = buildSyntheticFixture();
  const registry = buildGlobalRegistry(fileEntries);
  const result = checkFixtureFiles(relDir, fileEntries, registry);
  assert.equal(result.leaks.length, 0);
  assert.equal(registry.has(sha256Hex(SHORT_LOCATOR_EXCERPT)), true, 'sanity: the short excerpt really is in the registry');
});

test('reverting a seeded mutation restores a clean pass (gate is not stateful/one-shot)', () => {
  const clean = buildSyntheticFixture();
  const registry = buildGlobalRegistry(clean.fileEntries);

  const mutatedSourceCard = clean.fileEntries.find((e) => e.relPath.endsWith('src_synth_00.md')).text.replace(
    `quote: "${placeholder(RESTRICTED_QUOTE)}"`,
    `quote: "${RESTRICTED_QUOTE}"`,
  );
  const mutated = buildSyntheticFixture({ overrides: { 'sources/src_synth_00.md': mutatedSourceCard } });
  const dirtyResult = checkFixtureFiles(mutated.relDir, mutated.fileEntries, registry);
  assert.equal(dirtyResult.violations.length >= 1, true);

  // Revert: re-run against the original, unmutated fileEntries.
  const cleanResult = checkFixtureFiles(clean.relDir, clean.fileEntries, registry);
  assert.equal(cleanResult.violations.length, 0);
  assert.equal(cleanResult.leaks.length, 0);
});

test('empty fixture (zero files) fails closed with RightsLeakageError', () => {
  assert.throws(() => checkFixtureFiles('tests/fixtures/rf-empty', [], new Set()), RightsLeakageError);
});

test('fixture missing HASH-PROVENANCE.md fails closed with RightsLeakageError', () => {
  const { fileEntries } = buildSyntheticFixture();
  const withoutProvenance = fileEntries.filter((e) => !e.relPath.endsWith('HASH-PROVENANCE.md'));
  assert.throws(() => checkFixtureFiles('tests/fixtures/rf-synthtest-001', withoutProvenance, new Set()), RightsLeakageError);
});

test('zero network calls: this module never imports fetch/http/https', async () => {
  const src = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../scripts/evidence/check-fixture-rights-leakage.mjs', import.meta.url), 'utf8'));
  assert.equal(/\bfetch\(|require\(['"]https?['"]\)|from ['"]node:https?['"]/.test(src), false);
});
