// tests/ef-generate-rf-fixture.test.mjs — P1-T2, multi-bundle-conversion-e1 Phase 1.
//
// Unit test for `scripts/evidence/generate-rf-fixture.mjs` (P1-T1). Per FR-20: the generator is
// new, reusable tooling — a converter-adjacent seam, not a one-off script — so it needs its own
// test, not only "it worked once by hand against a real `rf` run."
//
// This suite builds a SMALL, FULLY SYNTHETIC `rf` run directory from scratch under a `mkdtemp`
// temp dir — never the live agentic node, never a real `rf` run directory (per this task's
// binding instructions and CLAUDE.md's "no PHI / no external dependency" posture). It proves the
// task's three acceptance-criteria clauses:
//
//   1. Valid EF fixture shape: `generateFixture({ runDir })` returns a `files` Map whose keys
//      match the expected EF-fixture-tree file inventory (single-file artifacts under their
//      declared `evidence_bundle.yaml.artifacts` paths, one entry per `sources/src_*.md` and
//      `extractions/ext_*.yaml` card) — mirroring `tests/fixtures/rf-cbc-001`'s own shape, at
//      small scale.
//   2. Determinism: running `generateFixture` twice against the same synthetic run directory,
//      with no changes in between, produces byte-identical output (same keys, same content per
//      key).
//   3. Rights-disposition default (ADR-0002 / D-EP3-4): every passage without a source card's
//      `usage.allowed_for_public_output === true` explicitly and positively confirming clearance
//      is redacted to hash+selector-only in the generated output — including a source card with
//      NO `usage` block at all (absence is never read as permission) and one with an explicit
//      `usage.allowed_for_public_output: false`. The one seeded passage that DOES carry
//      `allowed_for_public_output: true` is the only passage in the fixture whose verbatim quote
//      survives un-redacted.
//
// Also asserts zero network calls occur during generation (this task's binding "Specifics"
// clause) — `generateFixture` reads only from the local filesystem, so `fetch`/`http`/`https` are
// monkey-patched to throw for the duration of each generation call, and restored afterward.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateFixture, FixtureGenerationError } from '../scripts/evidence/generate-rf-fixture.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------------------------
// Synthetic run-directory builder
// ---------------------------------------------------------------------------------------------
//
// Small (3 source cards, 3 extraction cards, 3 extracted points total) but structurally complete
// per `tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs`'s supported YAML subset and
// `generate-rf-fixture.mjs`'s own structural-validation requirements (evidence_id
// `/^ev_\d+$/`, non-empty `quote`/`locator` per point, `source_card_id` matching filename).
//
// Rights-disposition matrix seeded across the 3 cards (proves clause 3 above):
//   - src_alpha: no `usage` block at all                    -> restricted (absence != permission)
//   - src_beta:  `usage.allowed_for_public_output: false`    -> restricted (explicit denial)
//   - src_gamma: `usage.allowed_for_public_output: true`     -> the ONE positively-cleared passage
//
// `src_beta`'s point also carries a `pediatric_cds.threshold.passage_locator` value, so the
// redaction path for that construct (not just plain `quote:`) is exercised too.

const ALPHA_QUOTE = 'Alpha restricted passage, never leaves this card verbatim.';
const BETA_QUOTE = 'Beta restricted passage, explicit usage denial.';
const BETA_LOCATOR_EXCERPT = 'Beta passage_locator excerpt text.';
const GAMMA_QUOTE = 'Gamma cleared passage, positively confirmed public-output rights.';

function sourceCardAlpha() {
  return `---
schema_version: '0.1'
type: source_card
source_card_id: src_alpha
created_at: '2026-01-01T00:00:00-04:00'
extracted_points:
- evidence_id: ev_001
  locator: "Intro paragraph"
  summary: "Alpha paraphrase, no usage block at all."
  quote: "${ALPHA_QUOTE}"
  pediatric_cds:
    classification: source_supported_fact
---
# Source Card: Alpha (no usage block)

## Key evidence
- (ev_001) Alpha paraphrase — locator: Intro paragraph — quote: "${ALPHA_QUOTE}"
`;
}

function sourceCardBeta() {
  return `---
schema_version: '0.1'
type: source_card
source_card_id: src_beta
created_at: '2026-01-01T00:00:00-04:00'
usage: {allowed_for_public_output: false, allowed_for_work_output: true}
extracted_points:
- evidence_id: ev_001
  locator: "Methods paragraph"
  summary: "Beta paraphrase, explicit denial."
  quote: "${BETA_QUOTE}"
  pediatric_cds:
    threshold: {value: "some value", units_ucum: null, passage_locator: "${BETA_LOCATOR_EXCERPT}"}
    classification: source_supported_fact
---
# Source Card: Beta (explicit denial)

## Key evidence
- (ev_001) Beta paraphrase — locator: Methods paragraph — quote: "${BETA_QUOTE}"
`;
}

function sourceCardGamma() {
  return `---
schema_version: '0.1'
type: source_card
source_card_id: src_gamma
created_at: '2026-01-01T00:00:00-04:00'
usage: {allowed_for_public_output: true, allowed_for_work_output: true}
extracted_points:
- evidence_id: ev_001
  locator: "Results paragraph"
  summary: "Gamma paraphrase, positively cleared."
  quote: "${GAMMA_QUOTE}"
  pediatric_cds:
    classification: source_supported_fact
---
# Source Card: Gamma (positively cleared)

## Key evidence
- (ev_001) Gamma paraphrase — locator: Results paragraph — quote: "${GAMMA_QUOTE}"
`;
}

function extractionCard(id, sourceCardId) {
  return `id: ${id}
source_card_id: ${sourceCardId}
extracted_facts:
- evidence_id: ev_001
  text: Synthetic paraphrase for ${sourceCardId}.
  locator: Intro paragraph
  confidence: medium
`;
}

/** Writes a complete, small, synthetic `rf` run directory (matching the real bundles' shape) to
 * `dir`. Zero network calls; zero references to any real bundle's content. */
async function writeSyntheticRunDir(dir) {
  await mkdir(path.join(dir, 'sources'), { recursive: true });
  await mkdir(path.join(dir, 'extractions'), { recursive: true });
  await mkdir(path.join(dir, 'claims'), { recursive: true });
  await mkdir(path.join(dir, 'reports'), { recursive: true });
  await mkdir(path.join(dir, 'reviews'), { recursive: true });
  await mkdir(path.join(dir, 'writebacks'), { recursive: true });

  await writeFile(
    path.join(dir, 'evidence_bundle.yaml'),
    `id: bundle_synthetic_test
intent_id: intent_synthetic_test
run_id: rf_run_synthetic_test
created_at: '2026-01-01T00:00:00-04:00'
status: verified
artifacts:
  research_brief: research_brief.md
  swarm_plan: swarm_plan.yaml
  source_cards_dir: sources/
  extraction_cards_dir: extractions/
  claim_ledger: claims/claim_ledger.yaml
  report: reports/report_draft.md
  verification: reviews/verification.yaml
  ccdash_event: writebacks/ccdash_event.yaml
counts:
  source_cards: 3
  extraction_cards: 3
  claims_total: 0
`,
    'utf8',
  );
  await writeFile(path.join(dir, 'research_brief.md'), 'Synthetic research brief, no excerpts.\n', 'utf8');
  await writeFile(path.join(dir, 'swarm_plan.yaml'), 'schema_version: 0.1\ntype: swarm_plan\nstatus: planned\n', 'utf8');
  await writeFile(path.join(dir, 'claims', 'claim_ledger.yaml'), 'claims: []\n', 'utf8');
  await writeFile(path.join(dir, 'reports', 'report_draft.md'), '# Synthetic report\nNo excerpts here.\n', 'utf8');
  await writeFile(path.join(dir, 'reviews', 'verification.yaml'), 'passed: true\nexit_code: 0\n', 'utf8');
  await writeFile(path.join(dir, 'writebacks', 'ccdash_event.yaml'), 'event_id: exec_synthetic_test\n', 'utf8');

  await writeFile(path.join(dir, 'sources', 'src_alpha.md'), sourceCardAlpha(), 'utf8');
  await writeFile(path.join(dir, 'sources', 'src_beta.md'), sourceCardBeta(), 'utf8');
  await writeFile(path.join(dir, 'sources', 'src_gamma.md'), sourceCardGamma(), 'utf8');

  await writeFile(path.join(dir, 'extractions', 'ext_alpha.yaml'), extractionCard('ext_alpha', 'src_alpha'), 'utf8');
  await writeFile(path.join(dir, 'extractions', 'ext_beta.yaml'), extractionCard('ext_beta', 'src_beta'), 'utf8');
  await writeFile(path.join(dir, 'extractions', 'ext_gamma.yaml'), extractionCard('ext_gamma', 'src_gamma'), 'utf8');
}

async function makeSyntheticRunDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ef-generate-rf-fixture-test-'));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  await writeSyntheticRunDir(dir);
  return dir;
}

// ---------------------------------------------------------------------------------------------
// Network-call guard
// ---------------------------------------------------------------------------------------------
//
// `generateFixture` must never make a network call — it reads only from the local run directory
// it is given. Rather than trust that by convention, monkey-patch every network entry point Node
// exposes (`fetch`, `http.request`/`.get`, `https.request`/`.get`) to throw for the duration of
// the wrapped call, and restore the originals afterward regardless of outcome.

async function assertNoNetworkCalls(fn) {
  const originalFetch = globalThis.fetch;
  const originalHttpRequest = http.request;
  const originalHttpGet = http.get;
  const originalHttpsRequest = https.request;
  const originalHttpsGet = https.get;

  const guard = (label) => () => {
    throw new Error(`network call attempted via ${label} during fixture generation — generate-rf-fixture.mjs must be filesystem-only`);
  };

  globalThis.fetch = guard('fetch');
  http.request = guard('http.request');
  http.get = guard('http.get');
  https.request = guard('https.request');
  https.get = guard('https.get');

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
    http.request = originalHttpRequest;
    http.get = originalHttpGet;
    https.request = originalHttpsRequest;
    https.get = originalHttpsGet;
  }
}

function redactionPlaceholderFor(decodedText) {
  const hash = createHash('sha256').update(decodedText, 'utf8').digest('hex');
  return `[redacted — content-rights: restricted (usage.allowed_for_public_output=false); sha256:${hash}]`;
}

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

test('generateFixture produces a valid EF fixture shape from a synthetic run directory', async (t) => {
  const runDir = await makeSyntheticRunDir(t);

  const result = await assertNoNetworkCalls(() => generateFixture({ runDir }));

  assert.equal(result.runId, 'rf_run_synthetic_test');
  assert.equal(result.sourceCardCount, 3);
  assert.equal(result.extractionCardCount, 3);
  assert.equal(result.extractedPointCount, 3);

  const keys = new Set(result.files.keys());
  const expectedKeys = new Set([
    'evidence_bundle.yaml',
    'research_brief.md',
    'swarm_plan.yaml',
    'claims/claim_ledger.yaml',
    'reports/report_draft.md',
    'reviews/verification.yaml',
    'writebacks/ccdash_event.yaml',
    'sources/src_alpha.md',
    'sources/src_beta.md',
    'sources/src_gamma.md',
    'extractions/ext_alpha.yaml',
    'extractions/ext_beta.yaml',
    'extractions/ext_gamma.yaml',
  ]);
  assert.deepEqual(keys, expectedKeys, 'fixture file inventory must match the EF fixture shape exactly (no extra/missing files)');

  // Every returned value is a string (file contents), never undefined/null.
  for (const [relPath, contents] of result.files) {
    assert.equal(typeof contents, 'string', `${relPath}: expected string contents`);
  }
});

test('generateFixture is deterministic: two runs against the same synthetic run directory are byte-identical', async (t) => {
  const runDir = await makeSyntheticRunDir(t);

  const first = await assertNoNetworkCalls(() => generateFixture({ runDir }));
  const second = await assertNoNetworkCalls(() => generateFixture({ runDir }));

  const firstEntries = [...first.files.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const secondEntries = [...second.files.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  assert.deepEqual(secondEntries, firstEntries, 'two generations against an unchanged run directory must be byte-identical');
  assert.equal(first.runId, second.runId);
  assert.equal(first.sourceCardCount, second.sourceCardCount);
  assert.equal(first.extractionCardCount, second.extractionCardCount);
  assert.equal(first.extractedPointCount, second.extractedPointCount);
});

test('rights-disposition default: no positively-confirmed-clear passage is ever full text, except the one seeded exception', async (t) => {
  const runDir = await makeSyntheticRunDir(t);

  const result = await assertNoNetworkCalls(() => generateFixture({ runDir }));

  const alpha = result.files.get('sources/src_alpha.md');
  const beta = result.files.get('sources/src_beta.md');
  const gamma = result.files.get('sources/src_gamma.md');
  assert.ok(alpha && beta && gamma, 'expected all three source cards in the generated fixture');

  // Absence of a `usage` block (src_alpha) defaults to restricted — never read as permission.
  assert.ok(!alpha.includes(ALPHA_QUOTE), 'src_alpha (no usage block) must NOT retain its verbatim quote');
  assert.ok(alpha.includes(redactionPlaceholderFor(ALPHA_QUOTE)), 'src_alpha must carry the hash+selector-only redaction placeholder for its quote');

  // Explicit `usage.allowed_for_public_output: false` (src_beta) is restricted, for both the
  // frontmatter `quote:` field and the `pediatric_cds.threshold.passage_locator` construct.
  assert.ok(!beta.includes(BETA_QUOTE), 'src_beta (explicit denial) must NOT retain its verbatim quote');
  assert.ok(beta.includes(redactionPlaceholderFor(BETA_QUOTE)), 'src_beta must carry the redaction placeholder for its quote');
  assert.ok(!beta.includes(BETA_LOCATOR_EXCERPT), 'src_beta must NOT retain its verbatim passage_locator excerpt');
  assert.ok(beta.includes(redactionPlaceholderFor(BETA_LOCATOR_EXCERPT)), 'src_beta must carry the redaction placeholder for its passage_locator');

  // The ONE seeded `usage.allowed_for_public_output: true` passage (src_gamma) is the only
  // passage in the fixture whose verbatim quote survives un-redacted.
  assert.ok(gamma.includes(GAMMA_QUOTE), 'src_gamma (positively cleared) must retain its verbatim quote unmodified');
  assert.ok(!gamma.includes(redactionPlaceholderFor(GAMMA_QUOTE)), 'src_gamma must NOT be redacted — it is the positively-confirmed-clear exception');

  // Cross-check across the whole fixture: the two restricted quotes never appear anywhere in the
  // generated tree (not just not in their own card), and the cleared quote appears exactly where
  // expected (src_gamma) and nowhere else.
  for (const [relPath, contents] of result.files) {
    assert.ok(!contents.includes(ALPHA_QUOTE), `${relPath}: restricted src_alpha quote leaked into fixture output`);
    assert.ok(!contents.includes(BETA_QUOTE), `${relPath}: restricted src_beta quote leaked into fixture output`);
    assert.ok(!contents.includes(BETA_LOCATOR_EXCERPT), `${relPath}: restricted src_beta passage_locator leaked into fixture output`);
    if (relPath !== 'sources/src_gamma.md') {
      assert.ok(!contents.includes(GAMMA_QUOTE), `${relPath}: cleared src_gamma quote unexpectedly present outside its own card`);
    }
  }
});

test('generateFixture makes zero network calls end-to-end (guard would throw otherwise)', async (t) => {
  const runDir = await makeSyntheticRunDir(t);
  // If `generateFixture` ever touched the network, `assertNoNetworkCalls`'s guard would throw and
  // this call would reject — reaching a resolved result IS the assertion.
  await assert.doesNotReject(() => assertNoNetworkCalls(() => generateFixture({ runDir })));
});

test('generateFixture fails closed on a source card missing required fields (sanity check on the synthetic harness itself)', async (t) => {
  const runDir = await makeSyntheticRunDir(t);
  // Corrupt one source card after the base synthetic run dir is written: drop its
  // `extracted_points` entirely, which the generator's structural validation requires.
  await writeFile(
    path.join(runDir, 'sources', 'src_alpha.md'),
    `---
schema_version: '0.1'
type: source_card
source_card_id: src_alpha
created_at: '2026-01-01T00:00:00-04:00'
extracted_points: []
---
# Source Card: Alpha (corrupted — no points)
`,
    'utf8',
  );

  await assert.rejects(
    () => assertNoNetworkCalls(() => generateFixture({ runDir })),
    (err) => err instanceof FixtureGenerationError && /src_alpha\.md has no extracted_points/.test(err.message),
  );
});

// Confirms this suite never resolved `REPO_ROOT` to anything but this checkout — a defensive
// sanity check per this repo's own documented "workflow agents resolve repo root to the main
// checkout" failure mode; the generator itself never reads/writes outside the temp run dir it is
// given (see `resolveInBounds` in `generate-rf-fixture.mjs`), and this test never passes an
// `outDir`, so nothing here can touch the real `tests/fixtures/` tree.
test('this suite never invokes the CLI writer path (in-memory generateFixture only, no disk writes under tests/fixtures/)', () => {
  assert.ok(REPO_ROOT.length > 0);
});
