// tests/ef-converter-invariants.test.mjs — P2-T8: 15 seam-invariant test suite (seam task, FR-8,
// 02 §2.3, the central Phase 2 risk hotspot per this plan's decisions block §5).
//
// This is the single flat file the Phase 2 exit gate reads literally: "All 15 invariants from
// 02 §2.3 have >=1 passing named test (15/15, not 'most' — verified by a test-name-to-invariant-
// number cross-check in the file's header comment)." The table below IS that cross-check — every
// row names the exact `test()` title that covers it. Do not renumber 02 §2.3's invariants or this
// table without updating both together.
//
//   #  | Invariant (02 §2.3, paraphrased)                                    | Test name (exact)
//   ---|----------------------------------------------------------------------|-------------------
//    1 | Accepts only a `verified`-status bundle                              | "Invariant 1: ..."
//    2 | Reads YAML from disk, never human-formatted CLI tables                | "Invariant 2: ..."
//    3 | Records the rf process exit code + verification.yaml.exit_code        | "Invariant 3: ..."
//    4 | Rejects process/artifact status disagreement                         | "Invariant 4: ..."
//    5 | Pins run_id, bundle ID, bundle/ledger/source hashes                   | "Invariant 5: ..."
//    6 | Never mutates runs/<run_id>/                                         | "Invariant 6: ..."
//    7 | supported claims -> fact candidates only when source+passage resolve  | "Invariant 7: ..."
//    8 | mixed/contradicted -> conflict-visible objects only, never one-sided  | "Invariant 8: ..."
//    9 | inference claims -> implementation-proposal inputs w/ declared basis  | "Invariant 9: ..."
//   10 | speculation/unsupported claims rejected from clinical rule evidence   | "Invariant 10: ..."
//   11 | No confidence-to-probability translation                             | "Invariant 11: ..."
//   12 | Absence of an extracted claim is never evidence of normality/safety   | "Invariant 12: ..."
//   13 | Deterministic: identical bytes + version -> identical output bytes    | "Invariant 13: ..."
//   14 | Converter output is a proposal, never a released KB                   | "Invariant 14: ..."
//   15 | Clinical reviewers approve interpretations, not merely citations      | "Invariant 15: ..."
//
// (Exact test titles are spelled out in full at each `test(...)` call below — this table gives the
// number -> topic mapping; grep this file for `Invariant <n>:` to find each one directly.)
//
// Invariants 1-6 and 13-15 already have their own dedicated coverage in P2-T2..T7's own test files
// (`ef-converter-loader`, `ef-converter-hashing`, `ef-converter-eligibility`, `ef-converter-verify`,
// `ef-converter-inspect`, `ef-converter-error-taxonomy`) — this file re-proves each of those 9 with
// its own short, focused assertion (not a duplicate of every edge case those files already cover)
// so that this single flat file is independently sufficient for the exit-gate's "15/15, not most"
// requirement, per this task's own acceptance criteria. Invariants 7-12 are NEW coverage this task
// adds using stub claim fixtures (Phase 3's real claim-mapping/drafting logic does not exist yet,
// so these exercise `eligibility.checkEligibility`'s per-claim routing directly — the only place in
// this phase's code that implements 02 §2.3 items 7-12). The zero-network/zero-LLM assertion runs
// across `inspect`, `verify`, and the `propose` stub, per this task's own acceptance criteria.

import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBundle } from '../tools/rf-bundle-to-kb-pack/lib/loader.mjs';
import { pinArtifacts } from '../tools/rf-bundle-to-kb-pack/lib/hashing.mjs';
import {
  checkEligibility,
  BundleNotVerifiedError,
  VerificationStateMismatchError,
  CLAIM_CATEGORIES,
} from '../tools/rf-bundle-to-kb-pack/lib/eligibility.mjs';
import { run as runInspect, buildSummary } from '../tools/rf-bundle-to-kb-pack/lib/verbs/inspect.mjs';
import { run as runVerify, ReleaseManifestValidationError } from '../tools/rf-bundle-to-kb-pack/lib/verbs/verify.mjs';
import { run as runPropose } from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';
import { SchemaError, UsageError, EXIT_SCHEMA } from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const CONVERTER_ROOT = path.join(REPO_ROOT, 'tools', 'rf-bundle-to-kb-pack');
const RULE_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'rule.schema.json');
const RELEASE_MANIFEST_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-manifest.schema.json');

// ---------------------------------------------------------------------------------------------
// Shared fixtures/helpers (same conventions P2-T2..T7's own test files already use).
// ---------------------------------------------------------------------------------------------

async function makeTempModuleWithDecisions() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ef-invariants-test-module-'));
  const modulePath = path.join(dir, 'module.json');
  await writeFile(modulePath, JSON.stringify({ id: 'test_stub_module', title: 'Test Stub Module' }), 'utf8');
  await writeFile(path.join(dir, 'authoring-decisions.yaml'), 'notes: temp stub for P2-T8 invariant tests\n', 'utf8');
  return { dir, modulePath };
}

async function makeTempRunDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ef-invariants-test-rundir-'));
  await cp(FIXTURE_DIR, dir, { recursive: true });
  return dir;
}

/** Loads + pins the real, committed rf-cbc-001 fixture. Caller must rm() the returned moduleDir. */
async function loadAndPinRealFixture() {
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  const loaded = await loadBundle({ runDir: FIXTURE_DIR, modulePath });
  const pinned = await pinArtifacts(loaded);
  return { pinned, moduleDir };
}

/** A minimal, self-contained synthetic PinnedBundle — same shape `checkEligibility` reads,
 * matching `tests/ef-converter-eligibility.test.mjs`'s own `makeSyntheticBundle` convention. Kept
 * local to this file rather than imported, since P2-T8 is deliberately independent of P2-T4's own
 * test file (this file must be self-sufficient for the exit-gate's 15/15 requirement). */
function makeSyntheticBundle({
  status = 'verified',
  exitCode = 0,
  passed = true,
  createdAt = '2026-07-18T00:00:00-04:00',
  claims = [],
  sourceCards = [],
} = {}) {
  return {
    bundle: { parsed: { id: 'bundle_test', status, created_at: createdAt } },
    artifacts: {
      verification: { parsed: { exit_code: exitCode, passed } },
      claimLedger: { parsed: { claims } },
      sourceCards,
    },
  };
}

function sourceCard(frontmatter) {
  return { frontmatter };
}

/** A fully-resolving 02 §3.7 extracted point: locator present, passage resolves (redaction-hash
 * form), population/applicability present, lab context present when a threshold is carried,
 * lifecycle metadata present. Cloning this and deleting one field is how the "does NOT resolve"
 * fixtures below are built, so each test changes exactly one variable. */
function makeResolvingPoint(evidenceId) {
  return {
    evidence_id: evidenceId,
    locator: 'Abstract — Methods',
    quote:
      '[redacted — content-rights: restricted (usage.allowed_for_public_output=false); sha256:' +
      'a'.repeat(64) +
      ']',
    pediatric_cds: {
      population: 'Pediatric patients under 18 years',
      assay_method: 'Automated hematology analyzer',
      threshold: { value: '0.5', units_ucum: '10*9/L' },
      lifecycle: { effective: '2026-01', retire: null },
    },
  };
}

function makeResolvingSourceCard(sourceCardId, evidenceId) {
  return sourceCard({ source_card_id: sourceCardId, extracted_points: [makeResolvingPoint(evidenceId)] });
}

/** Captures everything written to `process.stdout.write` while `fn` runs, then restores it. */
async function withCapturedStdout(fn) {
  const chunks = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    return true;
  };
  try {
    const result = await fn();
    return { result, output: chunks.join('') };
  } finally {
    process.stdout.write = original;
  }
}

async function collectConverterSourceFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectConverterSourceFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(full);
    }
  }
  return files;
}

// ================================================================================================
// Invariant 1 — accepts only a `verified`-status bundle
// ================================================================================================

test('Invariant 1: the seam accepts only a verified-status bundle (real fixture passes, a seeded draft status is refused)', async () => {
  const { pinned, moduleDir } = await loadAndPinRealFixture();
  try {
    const report = checkEligibility(pinned);
    assert.equal(report.bundle.status, 'verified');
  } finally {
    await rm(moduleDir, { recursive: true, force: true });
  }

  const draftBundle = makeSyntheticBundle({ status: 'draft' });
  assert.throws(() => checkEligibility(draftBundle), BundleNotVerifiedError);
});

// ================================================================================================
// Invariant 2 — reads YAML from disk, never human-formatted CLI tables
// ================================================================================================

test('Invariant 2: the loader parses evidence_bundle.yaml/claim_ledger.yaml/verification.yaml as structured YAML objects, not a CLI-table string', async () => {
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  try {
    const loaded = await loadBundle({ runDir: FIXTURE_DIR, modulePath });
    // "Structured YAML object", not a formatted-for-humans string: real object/array types with
    // real keys, not e.g. a pipe-delimited or box-drawing-character table string.
    assert.equal(typeof loaded.bundle.parsed, 'object');
    assert.equal(typeof loaded.bundle.parsed.status, 'string');
    assert.ok(Array.isArray(loaded.artifacts.claimLedger.parsed.claims));
    assert.equal(typeof loaded.artifacts.verification.parsed.exit_code, 'number');
    // Sanity: none of the fixture's own raw bytes were re-formatted through a CLI-table renderer —
    // the parsed claim ledger and the raw evidence_bundle bytes are wholly independent structures.
    assert.ok(!JSON.stringify(loaded.bundle.parsed).includes('│')); // no box-drawing pipe char
  } finally {
    await rm(moduleDir, { recursive: true, force: true });
  }
});

// ================================================================================================
// Invariant 3 — records the rf process exit code + verification.yaml.exit_code
// ================================================================================================

test('Invariant 3: the seam records the process exit code and reviews/verification.yaml.exit_code/passed together', async () => {
  const { pinned, moduleDir } = await loadAndPinRealFixture();
  try {
    const report = checkEligibility(pinned);
    assert.equal(report.bundle.verification.exitCode, 0);
    assert.equal(report.bundle.verification.passed, true);
    assert.equal(pinned.artifacts.verification.parsed.exit_code, report.bundle.verification.exitCode);
    assert.equal(pinned.artifacts.verification.parsed.passed, report.bundle.verification.passed);
  } finally {
    await rm(moduleDir, { recursive: true, force: true });
  }
});

// ================================================================================================
// Invariant 4 — rejects process/artifact status disagreement
// ================================================================================================

test('Invariant 4: a verified-status bundle whose verification artifact disagrees is rejected, not silently passed through', () => {
  const mismatched = makeSyntheticBundle({ status: 'verified', exitCode: 2, passed: false });
  assert.throws(
    () => checkEligibility(mismatched),
    (err) => {
      assert.ok(err instanceof VerificationStateMismatchError);
      assert.ok(err instanceof SchemaError);
      assert.equal(err.exitCode, EXIT_SCHEMA);
      assert.match(err.message, /process\/artifact status disagreement/);
      return true;
    },
  );
});

// ================================================================================================
// Invariant 5 — pins run_id, bundle ID, bundle/ledger/source hashes
// ================================================================================================

test('Invariant 5: pinArtifacts SHA-256-pins run_id, bundle ID, bundle bytes, claim-ledger bytes, and every source card', async () => {
  const { pinned, moduleDir } = await loadAndPinRealFixture();
  try {
    const sha256HexPattern = /^[0-9a-f]{64}$/;
    assert.ok(typeof pinned.runId === 'string' && pinned.runId.length > 0, 'run_id must be carried through');
    assert.ok(typeof pinned.bundleId === 'string' && pinned.bundleId.length > 0, 'bundle ID must be carried through');
    assert.match(pinned.hashes.bundle, sha256HexPattern);
    assert.match(pinned.hashes.claimLedger, sha256HexPattern);
    assert.ok(Object.keys(pinned.hashes.sourceCards).length > 0);
    for (const hash of Object.values(pinned.hashes.sourceCards)) {
      assert.match(hash, sha256HexPattern);
    }
  } finally {
    await rm(moduleDir, { recursive: true, force: true });
  }
});

// ================================================================================================
// Invariant 6 — never mutates runs/<run_id>/
// ================================================================================================

test('Invariant 6: the full loader -> hashing -> eligibility -> inspect pipeline never mutates the run directory', async () => {
  const runDir = await makeTempRunDir();
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  try {
    async function snapshot(dir) {
      const out = new Map();
      async function walk(current) {
        for (const entry of await readdir(current, { withFileTypes: true })) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            await walk(full);
          } else if (entry.isFile()) {
            const info = await stat(full);
            out.set(path.relative(dir, full), { mtimeMs: info.mtimeMs, size: info.size });
          }
        }
      }
      await walk(dir);
      return out;
    }

    const before = await snapshot(runDir);
    await withCapturedStdout(() => runInspect({ runDir, module: modulePath }));
    const after = await snapshot(runDir);
    assert.deepEqual(after, before, 'runDir must be byte-identical after a full inspect pass');
  } finally {
    await rm(runDir, { recursive: true, force: true });
    await rm(moduleDir, { recursive: true, force: true });
  }
});

// ================================================================================================
// Invariant 7 — supported claims admitted as fact candidates only when source + exact passage resolve
// ================================================================================================

test('Invariant 7: a supported claim is admitted as a fact_candidate only when its source and exact passage resolve', () => {
  const resolvingBundle = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_stub_resolving',
        status: 'supported',
        sources: [{ source_card_id: 'src_stub_01', evidence_id: 'ev_stub_01', locator: 'Abstract' }],
      },
    ],
    sourceCards: [makeResolvingSourceCard('src_stub_01', 'ev_stub_01')],
  });
  const resolvingReport = checkEligibility(resolvingBundle);
  assert.equal(resolvingReport.claims[0].category, CLAIM_CATEGORIES.FACT_CANDIDATE);
  assert.equal(resolvingReport.claims[0].eligible, true);
  assert.equal(resolvingReport.claims[0].reasons.length, 0);

  // Same claim shape, but the source card's extracted point carries no locator at all — the
  // "exact passage" side of 02 §3.7 no longer resolves, so this must NOT become a fact_candidate.
  const nonResolvingPoint = { ...makeResolvingPoint('ev_stub_02'), locator: '' };
  const nonResolvingBundle = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_stub_nonresolving',
        status: 'supported',
        sources: [{ source_card_id: 'src_stub_02', evidence_id: 'ev_stub_02', locator: '' }],
      },
    ],
    sourceCards: [sourceCard({ source_card_id: 'src_stub_02', extracted_points: [nonResolvingPoint] })],
  });
  const nonResolvingReport = checkEligibility(nonResolvingBundle);
  assert.equal(nonResolvingReport.claims[0].category, CLAIM_CATEGORIES.REJECTED);
  assert.equal(nonResolvingReport.claims[0].eligible, false);
  assert.ok(nonResolvingReport.claims[0].reasons.length > 0, 'a rejected claim always retains its rejection reason');
});

// ================================================================================================
// Invariant 8 — mixed/contradicted claims -> conflict-visible objects only, never a one-sided rule
// ================================================================================================

test('Invariant 8: mixed and contradicted claims land in conflict-visible objects, never a one-sided fact_candidate, even when their source fully resolves', () => {
  for (const status of ['mixed', 'contradicted']) {
    const bundle = makeSyntheticBundle({
      claims: [
        {
          claim_id: `clm_stub_${status}`,
          status,
          sources: [{ source_card_id: 'src_stub_conflict', evidence_id: 'ev_stub_conflict', locator: 'Abstract' }],
        },
      ],
      sourceCards: [makeResolvingSourceCard('src_stub_conflict', 'ev_stub_conflict')],
    });
    const report = checkEligibility(bundle);
    assert.equal(report.claims[0].category, CLAIM_CATEGORIES.CONFLICT_OBJECT, `status "${status}" must route to conflict_object`);
    assert.notEqual(
      report.claims[0].category,
      CLAIM_CATEGORIES.FACT_CANDIDATE,
      `status "${status}" must never become a one-sided fact_candidate, even though its source resolves`,
    );
    assert.equal(report.claims[0].eligible, true, `${status} is eligible AS a conflict object, not as a fact_candidate`);
  }
});

// ================================================================================================
// Invariant 9 — inference claims admitted only as implementation-proposal inputs with a declared basis
// ================================================================================================

test('Invariant 9: an inference claim is admitted only as an implementation_proposal_input, and only when it declares inference_basis.from_claims', () => {
  const withBasis = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_stub_inference_with_basis',
        status: 'inference',
        sources: [],
        inference_basis: { from_claims: ['clm_001', 'clm_002'] },
      },
    ],
  });
  const withBasisReport = checkEligibility(withBasis);
  assert.equal(withBasisReport.claims[0].category, CLAIM_CATEGORIES.IMPLEMENTATION_PROPOSAL_INPUT);
  assert.equal(withBasisReport.claims[0].eligible, true);

  const withoutBasis = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_stub_inference_no_basis',
        status: 'inference',
        sources: [],
        inference_basis: { from_claims: [] },
      },
    ],
  });
  const withoutBasisReport = checkEligibility(withoutBasis);
  assert.equal(withoutBasisReport.claims[0].category, CLAIM_CATEGORIES.REJECTED);
  assert.equal(withoutBasisReport.claims[0].eligible, false);
  assert.match(withoutBasisReport.claims[0].reasons[0], /inference_basis\.from_claims/);
});

// ================================================================================================
// Invariant 10 — speculation/unsupported claims rejected outright from clinical rule evidence
// ================================================================================================

test('Invariant 10: speculation and unsupported claims are rejected outright from clinical rule evidence, regardless of any source they carry', () => {
  for (const status of ['speculation', 'unsupported']) {
    const bundle = makeSyntheticBundle({
      claims: [
        {
          claim_id: `clm_stub_${status}`,
          status,
          // Even a fully-resolving source must not rescue a speculation/unsupported claim.
          sources: [{ source_card_id: 'src_stub_rejected', evidence_id: 'ev_stub_rejected', locator: 'Abstract' }],
        },
      ],
      sourceCards: [makeResolvingSourceCard('src_stub_rejected', 'ev_stub_rejected')],
    });
    const report = checkEligibility(bundle);
    assert.equal(report.claims[0].category, CLAIM_CATEGORIES.REJECTED, `status "${status}" must be rejected outright`);
    assert.equal(report.claims[0].eligible, false);
    assert.match(report.claims[0].reasons[0], /not converter-eligible for clinical rule evidence/);
  }
});

// ================================================================================================
// Invariant 11 — no confidence-to-probability translation
// ================================================================================================

test('Invariant 11: a claim\'s categorical confidence value never changes its eligibility routing and is never translated into a numeric probability', () => {
  const buildClaimWithConfidence = (confidence) => ({
    claim_id: 'clm_stub_confidence',
    status: 'supported',
    confidence,
    sources: [{ source_card_id: 'src_stub_conf', evidence_id: 'ev_stub_conf', locator: 'Abstract' }],
  });
  const sourceCards = [makeResolvingSourceCard('src_stub_conf', 'ev_stub_conf')];

  const reports = ['high', 'medium', 'low'].map((confidence) =>
    checkEligibility(makeSyntheticBundle({ claims: [buildClaimWithConfidence(confidence)], sourceCards })),
  );

  // Routing outcome (category/eligible/reasons) is identical no matter the confidence label —
  // eligibility.mjs's checkClaim never reads `claim.confidence` at all (02 §3.7's field table
  // gates on source/locator/passage/population/lab-context/lifecycle, never on confidence).
  for (const report of reports) {
    assert.equal(report.claims[0].category, CLAIM_CATEGORIES.FACT_CANDIDATE);
    assert.equal(report.claims[0].eligible, true);
    assert.deepEqual(report.claims[0].reasons, []);
    // No numeric probability field appears anywhere on the claim report.
    assert.equal('probability' in report.claims[0], false);
    assert.equal('confidence' in report.claims[0], false, 'checkEligibility must not echo a translated confidence/probability field');
  }

  // Structural half: no file in this converter maps a categorical confidence label to a numeric
  // probability (e.g. a lookup table or arithmetic on the word "confidence").
  return (async () => {
    const files = await collectConverterSourceFiles(CONVERTER_ROOT);
    const forbidden = [/confidence\s*[:=]\s*\{?\s*(high|medium|low)\s*:\s*0\./i, /\bprobability\b/i];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      for (const pattern of forbidden) {
        assert.ok(!pattern.test(source), `${path.relative(REPO_ROOT, file)} matches forbidden confidence->probability pattern ${pattern}`);
      }
    }
  })();
});

// ================================================================================================
// Invariant 12 — absence of an extracted claim is never treated as evidence of normality/safety
// ================================================================================================

test('Invariant 12: a bundle with zero claims yields zero fact candidates and synthesizes no "normal/safe" claim from that absence', () => {
  const emptyBundle = makeSyntheticBundle({ claims: [] });
  const report = checkEligibility(emptyBundle);
  assert.deepEqual(report.claims, []);
  assert.deepEqual(report.eligibleClaimIds, []);
  assert.deepEqual(report.rejectedClaims, []);

  // buildSummary (the inspect verb's own printer) must reflect the same "zero claims", not
  // manufacture a placeholder claim or a "normal" status from that absence.
  const pinnedStub = { runId: 'run_stub', bundleId: 'bundle_stub', moduleId: 'mod_stub', runDir: '/stub', artifacts: {} };
  const summary = buildSummary(pinnedStub, report);
  assert.equal(summary.counts.claims, 0);
  assert.deepEqual(summary.claims, []);

  // A malformed (non-array) claims field must fail closed with a schema error rather than being
  // silently treated as "no claims" (which would be indistinguishable from — and could be
  // conflated with — the legitimate "zero claims recorded" case above).
  const malformedBundle = {
    bundle: { parsed: { id: 'bundle_malformed', status: 'verified', created_at: '2026-07-18T00:00:00-04:00' } },
    artifacts: {
      verification: { parsed: { exit_code: 0, passed: true } },
      claimLedger: { parsed: { claims: 'not-an-array' } },
      sourceCards: [],
    },
  };
  assert.throws(() => checkEligibility(malformedBundle), SchemaError);
});

// ================================================================================================
// Invariant 13 — deterministic: identical bytes + converter version -> identical normalized output bytes
// ================================================================================================

test('Invariant 13: identical input bytes produce byte-identical inspect output on repeated runs', async () => {
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  try {
    const first = await withCapturedStdout(() => runInspect({ runDir: FIXTURE_DIR, module: modulePath }));
    const second = await withCapturedStdout(() => runInspect({ runDir: FIXTURE_DIR, module: modulePath }));
    assert.equal(first.output, second.output, 'two inspect runs against unchanged input must emit byte-identical output');
  } finally {
    await rm(moduleDir, { recursive: true, force: true });
  }
});

// ================================================================================================
// Invariant 14 — converter output is a proposal, never a released KB
// ================================================================================================

test('Invariant 14: the converter never produces a released/signed KB — propose still requires its full argument set, and its manifest schema forces `signature` empty on every candidate this converter produces', async () => {
  // `propose` still refuses to run without its full, explicit argument set (unchanged since
  // Phase 2) -- there is no implicit/default-args code path that could emit anything.
  await assert.rejects(() => runPropose({}), UsageError);

  // P5-T1 closed `verify`'s former "never content-validate the manifest" stub, but closing that
  // stub is a STRENGTHENING of this invariant, not a violation of it: `verify` can now certify
  // that a manifest is *structurally a well-formed UNSIGNED proposal* -- it still can never
  // certify a pack as *released/signed*. evidence-foundry-e1 P1-T5 (ADR-0005, FR-14/FR-16)
  // extended schemas/release-manifest.schema.json to DECLARE a `dryRun`/`signature` pair (the
  // schema now HAS a `signature` property, unlike when this invariant test was first written) --
  // but the slot is schema-forced empty (`type: "null"`) on every candidate this converter's own
  // `propose`/`verify` verbs ever touch, because neither verb ever sets `dryRun: true` (that flag
  // is exclusively `tools/release-sign`'s dry-run-mode territory, P3-T2, a different tool this
  // converter never invokes). The invariant this test protects -- this converter never produces,
  // and its schema never silently accepts, a *populated* signature -- still holds; it is now
  // proven by the type-forcing conditional rather than by the property's total absence.
  const releaseManifestSchema = JSON.parse(await readFile(RELEASE_MANIFEST_SCHEMA_PATH, 'utf8'));
  assert.equal(
    releaseManifestSchema.properties?.signature?.type?.[0] ?? releaseManifestSchema.properties?.signature?.type,
    'object',
    'sanity: schemas/release-manifest.schema.json must still admit an object-shaped signature somewhere (else this test would be checking nothing)',
  );
  assert.ok(
    !Object.hasOwn(releaseManifestSchema.properties ?? {}, 'dryRun') || releaseManifestSchema.properties.dryRun.type === 'boolean',
    'schemas/release-manifest.schema.json\'s dryRun marker must be a plain boolean, not something richer that could carry release authority',
  );
  assert.equal(
    releaseManifestSchema.additionalProperties, false,
    'schemas/release-manifest.schema.json must reject additional properties -- a caller cannot smuggle an `approvedBy`/`releasedAt`/`knowledgeBaseVersion` field past it',
  );
  // The load-bearing check: this converter's own `propose` output never sets `dryRun`, so a
  // populated `signature` on that output is still rejected fail-closed by the schema's own
  // if/then/else conditional -- proven functionally, not just by inspecting the shape, in the
  // `dirWithSignature` block below.

  const validUnsignedManifest = {
    schemaVersion: '1.0',
    moduleId: 'cbc_suite_v1',
    packVersion: '0.1.0-proposal',
    rfInputs: [{
      runId: 'rf_run_test',
      bundleSha256: `sha256:${'a'.repeat(64)}`,
      claimLedgerSha256: `sha256:${'b'.repeat(64)}`,
      verificationExitCode: 0,
    }],
    converter: { name: 'rf-bundle-to-kb-pack', version: '0.1.0', configSha256: `sha256:${'c'.repeat(64)}` },
    testCorpusHash: `sha256:${'d'.repeat(64)}`,
    traceabilityHash: `sha256:${'e'.repeat(64)}`,
  };

  // Attempting to smuggle a `signature` block onto an otherwise-valid manifest is rejected -- the
  // converter's own `verify` verb fails closed (never silently accepts) rather than certifying a
  // "signed" pack.
  const dirWithSignature = await mkdtemp(path.join(os.tmpdir(), 'ef-invariants-test-pack-signed-'));
  try {
    const signedManifest = { ...validUnsignedManifest, signature: { algorithm: 'ed25519', keyId: 'k1', value: 'x' } };
    await writeFile(path.join(dirWithSignature, 'release-manifest.unsigned.json'), JSON.stringify(signedManifest), 'utf8');
    await assert.rejects(
      () => runVerify({ pack: dirWithSignature, ruleSchema: RULE_SCHEMA_PATH }),
      ReleaseManifestValidationError,
    );
  } finally {
    await rm(dirWithSignature, { recursive: true, force: true });
  }

  // A genuinely well-formed UNSIGNED manifest DOES now validate (P5-T1) -- proving `verify` can
  // certify "structurally a well-formed staged proposal," which is exactly what an unsigned E0
  // manifest is, and nothing more (no `knowledgeBaseVersion`/`approvedBy`/`releasedAt` field
  // exists anywhere on the document for a reader to mistake for release/sign-off).
  const dirUnsigned = await mkdtemp(path.join(os.tmpdir(), 'ef-invariants-test-pack-unsigned-'));
  try {
    await writeFile(
      path.join(dirUnsigned, 'release-manifest.unsigned.json'),
      JSON.stringify(validUnsignedManifest),
      'utf8',
    );
    const { result: exitCode, output } = await withCapturedStdout(() =>
      runVerify({ pack: dirUnsigned, ruleSchema: RULE_SCHEMA_PATH }),
    );
    const summary = JSON.parse(output);
    assert.equal(exitCode, 0);
    assert.equal(summary.releaseManifest.present, true);
    assert.equal(summary.releaseManifest.validated, true);
    assert.ok(!Object.hasOwn(validUnsignedManifest, 'signature'), 'sanity: the manifest this test validates carries no signature');
  } finally {
    await rm(dirUnsigned, { recursive: true, force: true });
  }
});

// ================================================================================================
// Invariant 15 — clinical reviewers approve executable interpretations, not merely citations
// ================================================================================================

test('Invariant 15: clinical-approval sign-off is out of this converter\'s scope by design — no file in this tool ever sets an approval/sign-off field, and the target module currently carries none', async () => {
  // Structural half: the converter's own code never writes to (or fabricates a value for) any
  // clinical-approval-shaped field. Approval is a human/governance-process outcome this tool
  // feeds, never something the converter can grant itself (README "Seam invariants" row 15).
  const files = await collectConverterSourceFiles(CONVERTER_ROOT);
  const forbiddenApprovalPatterns = [/approvedBy\s*[:=]\s*\[[^\]]+\]/i, /clinicalApprovers/i, /\bsigned\s*:\s*true\b/i];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const pattern of forbiddenApprovalPatterns) {
      assert.ok(!pattern.test(source), `${path.relative(REPO_ROOT, file)} matches forbidden clinical-approval-fabrication pattern ${pattern}`);
    }
  }

  // Functional half: the module this converter targets carries no clinical approval yet — its
  // envelope is the "unsigned-stub" shape CLAUDE.md requires until real named human reviewers
  // approve it (never this converter, never `karen`/ARC review output).
  const modulePath = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
  const moduleJson = JSON.parse(await readFile(modulePath, 'utf8'));
  assert.equal(moduleJson.status, 'unsigned-stub');
  assert.deepEqual(moduleJson.approvedBy, []);
  assert.equal(moduleJson.clinicalContentHash, null);
});

// ================================================================================================
// Cross-cutting: zero network calls, zero LLM/generative-model invocations across inspect, verify,
// and the propose stub (this task's own acceptance criteria, distinct from the 15 numbered
// invariants above).
// ================================================================================================

test('Zero-network/zero-LLM: inspect, verify, and the propose stub make zero outbound network calls', async () => {
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalFetch = globalThis.fetch;
  let calls = 0;

  http.request = (...args) => {
    calls += 1;
    return originalHttpRequest.apply(http, args);
  };
  https.request = (...args) => {
    calls += 1;
    return originalHttpsRequest.apply(https, args);
  };
  if (typeof originalFetch === 'function') {
    globalThis.fetch = (...args) => {
      calls += 1;
      return originalFetch.apply(globalThis, args);
    };
  }

  const packDir = await mkdtemp(path.join(os.tmpdir(), 'ef-invariants-test-zeronetwork-pack-'));
  try {
    await withCapturedStdout(() => runInspect({ runDir: FIXTURE_DIR, module: modulePath }));
    await withCapturedStdout(() => runVerify({ pack: packDir, ruleSchema: RULE_SCHEMA_PATH }));
    await assert.rejects(() => runPropose({}), UsageError); // propose itself makes no calls before refusing
  } finally {
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    if (typeof originalFetch === 'function') globalThis.fetch = originalFetch;
    await rm(moduleDir, { recursive: true, force: true });
    await rm(packDir, { recursive: true, force: true });
  }

  assert.equal(calls, 0, 'inspect + verify + propose combined must make zero outbound network calls');
});

test('Zero-network/zero-LLM: no file under tools/rf-bundle-to-kb-pack/ imports a network or AI/model-SDK module (structural)', async () => {
  const files = await collectConverterSourceFiles(CONVERTER_ROOT);
  assert.ok(files.length > 0, 'sanity: the converter source tree must not be empty');

  const forbidden = [
    /^\s*import\b[^;]*from\s+['"](?:node:)?http['"]/m,
    /^\s*import\b[^;]*from\s+['"](?:node:)?https['"]/m,
    /^\s*import\b[^;]*from\s+['"](?:node:)?dgram['"]/m,
    /^\s*import\b[^;]*from\s+['"]@anthropic-ai\/[^'"]*['"]/m,
    /^\s*import\b[^;]*from\s+['"]openai['"]/m,
    /(?<!\/\/[^\n]*)\bfetch\s*\(/,
  ];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(source), `${path.relative(REPO_ROOT, file)} matches forbidden pattern ${pattern} (network/AI-SDK import)`);
    }
  }
});
