// tests/ef-wp1-eligibility.test.mjs — P2-T2: EF-WP1 fail-closed test (FR-16, phase-1-2-vendoring-
// batch-orchestration.md row P2-T2).
//
// Task acceptance criteria (that file's P2-T2 row):
//   "Seeded fixture fails closed, non-zero exit, names the missing card; zero files written under
//   build/kb-pack/ for the rejected bundle."
//
// P2-T1 (tests/ef-converter-eligibility.test.mjs) already unit-tests the EF-WP1 structural
// pre-flight (`checkEligibility`'s stage 0, `MissingPediatricCdsExtensionError`) against
// hand-built in-memory `PinnedBundle` objects. This file is deliberately different: it exercises
// the SAME gate end to end, through the real, on-disk `rf`-bundle-shaped fixture tree this
// converter actually reads (`loader.mjs` -> `hashing.mjs` -> `eligibility.mjs` -> `propose.mjs`,
// and — one layer further out — `cli.mjs`'s own process-level exit-code dispatch), against a
// committed synthetic fixture (`tests/fixtures/ef-wp1-missing-extension/`) whose one seeded
// defect is a source card missing the required `pediatric_cds` evidence-card extension block.
// This proves the "before any propose output is written" / "zero files under build/kb-pack/"
// half of this task's AC, which a pure in-memory unit test cannot: `checkEligibility` never
// touches the filesystem, so proving "zero output" for it structurally (as P2-T1's suite already
// does) is not the same claim as proving the real `propose` verb — which DOES call `mkdir`/
// `writeFile` once eligibility passes — never reaches that point for a rejected bundle.
//
// Ownership note (multi-bundle-conversion-e1, P2-T2): this file and its fixture directory
// (`tests/fixtures/ef-wp1-missing-extension/`) are this task's only owned artifacts. It does not
// modify `tools/rf-bundle-to-kb-pack/lib/batch.mjs` or `cli.mjs` (P2-T3's concurrently-owned
// files) — it only *imports* `cli.mjs`'s already-existing `main` export, read-only, the same way
// `tests/ef-converter-error-taxonomy.test.mjs` already does for `dispatchVerb`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBundle } from '../tools/rf-bundle-to-kb-pack/lib/loader.mjs';
import { pinArtifacts } from '../tools/rf-bundle-to-kb-pack/lib/hashing.mjs';
import { checkEligibility, MissingPediatricCdsExtensionError } from '../tools/rf-bundle-to-kb-pack/lib/eligibility.mjs';
import { run as runPropose } from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';
import { main as cliMain } from '../tools/rf-bundle-to-kb-pack/cli.mjs';
import { SchemaError, EXIT_SCHEMA } from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-wp1-missing-extension');

// `propose` requires a real module + its own committed `authoring-decisions.yaml` — `cbc_suite_v1`
// is the only module that currently carries one (Phase 1 exit gate). `checkEligibility`'s stage 0
// (this task's own subject) runs over the FIXTURE's own source cards regardless of which module is
// supplied here — see `eligibility.mjs`'s `checkEligibility`, which calls
// `checkPediatricCdsExtensionPresence(pinnedBundle.artifacts.sourceCards)` before anything else —
// so this module choice is purely a mechanical requirement to reach `propose`'s pipeline at all,
// never a dependency of the behavior under test.
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');

const GOOD_CARD_ID = 'src_ef_wp1_good_001';
const MISSING_EXT_CARD_ID = 'src_ef_wp1_missing_ext_001';

/**
 * A fresh, never-created `--out` directory nested under the real (gitignored) `build/kb-pack/`
 * root — never `os.tmpdir()` — so this file's "zero files written under build/kb-pack/" assertions
 * are checked against the exact directory tree this task's own AC names, not a stand-in.
 * Uniquely suffixed per call so parallel test-file runs (and repeated runs of this same file)
 * never collide with each other or with any other test's own `build/kb-pack/<module>/...` output.
 */
function freshKbPackOutDir(label) {
  return path.join(REPO_ROOT, 'build', 'kb-pack', `_ef-wp1-eligibility-test-${label}-${crypto.randomBytes(6).toString('hex')}`);
}

/** Asserts `dir` does not exist at all — not merely "exists but empty" — the strongest available
 * proof that "no partial pack directory [was] created" (this task's own AC wording). */
async function assertDirNeverCreated(dir) {
  await assert.rejects(
    () => stat(dir),
    (err) => {
      assert.equal(err.code, 'ENOENT', `expected ${dir} to never have been created, got ${err.code ?? err.message}`);
      return true;
    },
  );
}

/** Captures everything written to `process.stderr.write` while `fn` runs, then restores it —
 * same convention `tests/ef-converter-error-taxonomy.test.mjs` documents for its own
 * `withSilencedStderr` helper, but capturing rather than discarding since this file's CLI-level
 * test needs to assert stderr actually names the missing card. */
async function withCapturedStderr(fn) {
  const chunks = [];
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    return true;
  };
  try {
    const result = await fn();
    return { result, stderr: chunks.join('') };
  } finally {
    process.stderr.write = original;
  }
}

// =================================================================================================
// 0. Fixture sanity: the committed fixture has exactly the shape this suite assumes (regression
//    guard for the fixture itself, independent of any assertion about the gate's behavior).
// =================================================================================================

test('EF-WP1 fixture sanity: exactly 2 source cards, one good and one seeded missing pediatric_cds', async () => {
  const loaded = await loadBundle({ runDir: FIXTURE_DIR, modulePath: REAL_MODULE_PATH });
  assert.equal(loaded.artifacts.sourceCards.length, 2);

  const ids = loaded.artifacts.sourceCards.map((card) => card.frontmatter.source_card_id).sort();
  assert.deepEqual(ids, [GOOD_CARD_ID, MISSING_EXT_CARD_ID].sort());

  const goodCard = loaded.artifacts.sourceCards.find((c) => c.frontmatter.source_card_id === GOOD_CARD_ID);
  const badCard = loaded.artifacts.sourceCards.find((c) => c.frontmatter.source_card_id === MISSING_EXT_CARD_ID);

  assert.ok(
    goodCard.frontmatter.extracted_points.every((p) => p?.pediatric_cds && typeof p.pediatric_cds === 'object'),
    'the "good" card must carry pediatric_cds on every extracted point (control case)',
  );
  assert.ok(
    badCard.frontmatter.extracted_points.every((p) => p?.pediatric_cds === undefined),
    'the seeded "bad" card must carry NO pediatric_cds on any extracted point (the seeded defect)',
  );
  assert.equal(loaded.bundle.parsed.status, 'verified', 'fixture bundle status must be verified (isolates the failure to EF-WP1, not bundle-status reconciliation)');
});

// =================================================================================================
// 1. checkEligibility (in-memory, via the real loader/hashing pipeline over the real fixture tree)
// =================================================================================================

test('EF-WP1: checkEligibility rejects the real fixture, naming only the missing-extension card', async () => {
  const loaded = await loadBundle({ runDir: FIXTURE_DIR, modulePath: REAL_MODULE_PATH });
  const pinned = await pinArtifacts(loaded);

  assert.throws(
    () => checkEligibility(pinned),
    (err) => {
      assert.ok(err instanceof MissingPediatricCdsExtensionError, `expected MissingPediatricCdsExtensionError, got ${err.constructor.name}`);
      assert.ok(err instanceof SchemaError);
      assert.equal(err.exitCode, EXIT_SCHEMA);
      assert.notEqual(err.exitCode, 0, 'AC: non-zero exit');
      assert.deepEqual(err.cardIds, [MISSING_EXT_CARD_ID], 'AC: error names the missing card (and only it)');
      assert.match(err.message, new RegExp(MISSING_EXT_CARD_ID));
      assert.doesNotMatch(err.message, new RegExp(GOOD_CARD_ID), 'the good card must never be named as missing');
      return true;
    },
  );
});

// =================================================================================================
// 2. propose (real verb, real fixture, real module) — the "before any propose output is written"
//    half of this task's AC: propose calls checkEligibility() before its first mkdir/writeFile of
//    any kind (see lib/verbs/propose.mjs), so a rejection here is structural proof of zero output.
// =================================================================================================

test('EF-WP1: propose rejects the seeded fixture, naming the missing card, before creating --out at all', async () => {
  const outDir = freshKbPackOutDir('propose');
  await assertDirNeverCreated(outDir); // sanity: this path is genuinely fresh before we even start

  try {
    await assert.rejects(
      () => runPropose({
        runDir: FIXTURE_DIR,
        module: REAL_MODULE_PATH,
        decisions: REAL_DECISIONS_PATH,
        out: outDir,
      }),
      (err) => {
        assert.ok(err instanceof MissingPediatricCdsExtensionError, `expected MissingPediatricCdsExtensionError, got ${err.constructor.name}`);
        assert.equal(err.exitCode, EXIT_SCHEMA);
        assert.notEqual(err.exitCode, 0, 'AC: non-zero exit');
        assert.deepEqual(err.cardIds, [MISSING_EXT_CARD_ID]);
        assert.match(err.message, new RegExp(MISSING_EXT_CARD_ID), 'AC: error names the missing card');
        return true;
      },
    );

    // AC: "zero files written under build/kb-pack/ for the rejected bundle (no partial pack
    // directory created)" — the directory itself must not exist at all, which is exactly what
    // propose.mjs's ordering (checkEligibility() runs before its first mkdir(outDir)) guarantees.
    await assertDirNeverCreated(outDir);
  } finally {
    // Best-effort cleanup in case of an unexpected regression that DID write something.
    await rm(outDir, { recursive: true, force: true });
  }
});

test('EF-WP1: propose against the seeded fixture writes NOTHING readable at --out (readdir sees no directory at all)', async () => {
  const outDir = freshKbPackOutDir('propose-readdir');
  try {
    await assert.rejects(() => runPropose({
      runDir: FIXTURE_DIR,
      module: REAL_MODULE_PATH,
      decisions: REAL_DECISIONS_PATH,
      out: outDir,
    }), MissingPediatricCdsExtensionError);

    await assert.rejects(
      () => readdir(outDir),
      (err) => {
        assert.equal(err.code, 'ENOENT');
        return true;
      },
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// 3. cli.mjs's process-level dispatch — the literal "non-zero exit" half of this task's AC, one
//    layer further out than the thrown-error assertions above (P2-T3's `batch.mjs`/its own
//    `cli.mjs` `batch` verb are NOT touched or exercised here — this only imports cli.mjs's
//    already-existing `main` export, read-only, exactly as tests/ef-converter-error-taxonomy.test.mjs
//    already does for `dispatchVerb`).
// =================================================================================================

test('EF-WP1: `node cli.mjs propose` against the seeded fixture exits non-zero and stderr names the missing card', async () => {
  const outDir = freshKbPackOutDir('cli');
  await assertDirNeverCreated(outDir);

  try {
    const { result: exitCode, stderr } = await withCapturedStderr(() =>
      cliMain([
        'propose',
        '--run-dir', FIXTURE_DIR,
        '--module', REAL_MODULE_PATH,
        '--decisions', REAL_DECISIONS_PATH,
        '--out', outDir,
      ]),
    );

    assert.equal(exitCode, EXIT_SCHEMA);
    assert.notEqual(exitCode, 0, 'AC: non-zero exit');
    assert.match(stderr, new RegExp(MISSING_EXT_CARD_ID), 'AC: (stderr) error names the missing card');
    assert.doesNotMatch(stderr, new RegExp(GOOD_CARD_ID));

    await assertDirNeverCreated(outDir);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// 4. Multiple missing cards, end to end through the real verb — proves the "before any propose
//    output is written" guarantee is not incidental to there being exactly one bad card, and that
//    naming is not truncated to "the first" when more than one card is at fault (mirrors P2-T1's
//    own in-memory multi-card coverage, but end to end through loader -> hashing -> eligibility ->
//    propose against a real, temporary on-disk fixture tree this test builds by copying the
//    committed fixture and adding one more seeded-bad card).
// =================================================================================================

test('EF-WP1: propose names ALL missing-extension cards when more than one is at fault, still writing nothing', async () => {
  const tempRunDir = await mkdtemp(path.join(os.tmpdir(), 'ef-wp1-multi-bad-'));
  const outDir = freshKbPackOutDir('multi-bad');
  try {
    await import('node:fs/promises').then(({ cp }) => cp(FIXTURE_DIR, tempRunDir, { recursive: true }));

    // Add a second seeded-bad card (copy of the first, renamed with a new source_card_id) so the
    // temp fixture now has TWO cards missing the extension, alongside the one good card.
    const { readFile, writeFile } = await import('node:fs/promises');
    const secondBadCardPath = path.join(tempRunDir, 'sources', 'src_ef_wp1_missing_ext_002.md');
    const originalBadCardRaw = await readFile(
      path.join(tempRunDir, 'sources', 'src_ef_wp1_missing_ext_001.md'),
      'utf8',
    );
    await writeFile(
      secondBadCardPath,
      originalBadCardRaw.replace('src_ef_wp1_missing_ext_001', 'src_ef_wp1_missing_ext_002'),
      'utf8',
    );
    // Keep evidence_bundle.yaml's counts honest for this temp copy (not load-bearing for the
    // eligibility gate itself, but avoids silently shipping a self-contradictory fixture).
    const bundleYamlPath = path.join(tempRunDir, 'evidence_bundle.yaml');
    const bundleYamlRaw = await readFile(bundleYamlPath, 'utf8');
    await writeFile(bundleYamlPath, bundleYamlRaw.replace('source_cards: 2', 'source_cards: 3'), 'utf8');

    await assertDirNeverCreated(outDir);

    await assert.rejects(
      () => runPropose({
        runDir: tempRunDir,
        module: REAL_MODULE_PATH,
        decisions: REAL_DECISIONS_PATH,
        out: outDir,
      }),
      (err) => {
        assert.ok(err instanceof MissingPediatricCdsExtensionError);
        assert.deepEqual(
          [...err.cardIds].sort(),
          ['src_ef_wp1_missing_ext_001', 'src_ef_wp1_missing_ext_002'].sort(),
          'AC: every offending card is named, never just the first',
        );
        assert.match(err.message, /src_ef_wp1_missing_ext_001/);
        assert.match(err.message, /src_ef_wp1_missing_ext_002/);
        assert.doesNotMatch(err.message, new RegExp(GOOD_CARD_ID));
        return true;
      },
    );

    await assertDirNeverCreated(outDir);
  } finally {
    await rm(outDir, { recursive: true, force: true });
    await rm(tempRunDir, { recursive: true, force: true });
  }
});
