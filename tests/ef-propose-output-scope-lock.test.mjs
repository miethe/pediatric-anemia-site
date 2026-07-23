// tests/ef-propose-output-scope-lock.test.mjs — P3-T1 (multi-bundle-conversion-e1-finish, Phase 3
// -- Author 3x Non-Approving Decisions Files, FR-F11).
//
// Task acceptance criteria (phase-2-3-genericity-decisions-authoring.md, row P3-T1): a
// positive-allowlist test that a `propose` run for `anemia`/`kidney_suite_v1`/`growth_suite_v1`
// writes ONLY an allowed file set and NEVER `rules.json`/`rule-provenance.json`, plus SUBSTANCE
// checks (not merely existence) that `rule-proposals.json`'s wrapper `moduleId` equals the target
// module (never cbc's) with `proposals.length === 0`, that `candidates.json` is the bare empty
// object, and a cross-module-leak negative control proving zero occurrence of any
// `cbc_suite_v1`-owned identity string in the 3 modules' emitted files.
//
// HONESTY NOTE, load-bearing (read before editing this test) -- the REAL, empirically-verified
// behavior of `propose` against the 3 real fixtures + the P3-T2/T3/T4 decisions files just
// authored is NOT uniform across the 3 modules, and this test asserts that real behavior rather
// than a uniform assumed shape:
//
//   * `anemia` already has a pre-existing generated test corpus
//     (`tests/ef-anemia-backfill-integrity.test.mjs`, matching `computeTestCorpusHash`'s
//     `tests/ef-anemia-*.test.mjs` glob) from before this feature, so its `propose` run completes
//     end to end with `EXIT_OK` and writes the FULL file set `propose` is capable of emitting for
//     a module with zero hand-authored rule-body content: `pack-provenance.json`, `evidence.json`,
//     `evidence-assertions.json`, `candidates.json`, `rule-proposals.json`,
//     `release-manifest.unsigned.json`, `conversion-report.json`, `semantic-diff.json` -- 8 files,
//     never `rules.json`/`rule-provenance.json` (Phase 1's emission gate refuses, since every
//     decision in the new `authoring-decisions.yaml` is `status: drafted_pending_human_approval`,
//     never `approved_for_rule_draft`).
//
//   * `kidney_suite_v1` and `growth_suite_v1` have NO generated test corpus yet (Phase 4 creates
//     it) -- `computeTestCorpusHash` throws `UsageError` for each, exactly as this task's own
//     binding note describes ("a full `propose` for a non-cbc module currently throws
//     computeTestCorpusHash's UsageError ... AFTER writing the evidence-layer artifacts"). By the
//     time that throw fires, `propose.mjs`'s own `run()` has already written 5 files to `outDir`:
//     `pack-provenance.json`, `evidence.json`, `evidence-assertions.json`, `candidates.json`, and
//     `rule-proposals.json` (via `writeDraftPack`, called BEFORE `computeTestCorpusHash` in
//     `run()`'s body) -- `release-manifest.unsigned.json`/`conversion-report.json`/
//     `semantic-diff.json` are never reached and never written for these 2 modules today. This
//     test catches that throw and inspects the PARTIAL output directory rather than pretending the
//     run completes cleanly -- exactly this task's own binding instruction.
//
//   * `release-manifest.unsigned.json` is written unconditionally by `run()` whenever it reaches
//     that point (unlike `rules.json`/`rule-provenance.json`, which are conditional on the
//     emission gate) -- the phase-2-3 plan doc's own prose enumeration of the "allowed file set"
//     does not separately name it, and this test's ALLOWED_FILES superset below includes it so a
//     module whose test corpus already exists (`anemia`, today; `kidney_suite_v1`/
//     `growth_suite_v1` once Phase 4 lands their corpora) is not spuriously flagged for emitting a
//     file that carries no rule-body content at all.
//
//   * `unresolved.json` is named in the plan doc's allowed-file prose but is NEVER written into
//     `outDir` by `propose` for ANY module, including the fully-working `cbc_suite_v1` path
//     (verified against `tests/ef-converter-propose.test.mjs`'s own "emits all 7/9 files" list) --
//     it is a separately-committed, module-level artifact (`modules/<id>/unresolved.json`) read
//     only by `lib/multi-bundle-report.mjs`, never copied into a `propose` run's staged pack. This
//     test does not require its presence in `outDir` for any module; its absence is not itself an
//     FR-F11 violation.
//
// What stays true for ALL 3 modules, in both the full-success and the partial-throw case, and is
// this test's actual FR-F11 substance: `rules.json`/`rule-provenance.json` are NEVER written;
// `rule-proposals.json`'s wrapper `moduleId` is always the TARGET module's own id (never
// `cbc_suite_v1`'s) with `proposals.length === 0`; `candidates.json` is always the bare `{}`; and
// no `cbc_suite_v1`-owned decision/rule/candidate/provenance identity string leaks into either
// file.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runPropose } from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';
import { UsageError } from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The full set of files `propose` is capable of writing into `outDir` for a module with zero
// hand-authored rule-body content (i.e. every one of the 3 modules under test here) -- a superset
// covering both the full-success case (anemia, today) and the partial-throw case (kidney_suite_v1/
// growth_suite_v1, today). `rules.json`/`rule-provenance.json` are deliberately absent from this
// set -- their presence is checked as a hard, separate, unconditional failure below, never folded
// into "allowed".
const ALLOWED_FILES = new Set([
  'pack-provenance.json',
  'evidence.json',
  'evidence-assertions.json',
  'candidates.json',
  'rule-proposals.json',
  'release-manifest.unsigned.json',
  'conversion-report.json',
  'semantic-diff.json',
]);

const FORBIDDEN_FILES = ['rules.json', 'rule-provenance.json'];

// Real `cbc_suite_v1`-owned identity strings (rule-candidate-drafts.mjs) that must NEVER appear in
// any other module's `rule-proposals.json`/`candidates.json` -- the exact P2-T7 regression
// scenario this test is the negative control for.
const CBC_LEAK_NEEDLES = [
  'dec_cbc_young_infant_scope_abstention_001',
  'dec_cbc_local_range_precedence_001',
  'dec_cbc_benign_neutropenia_differential_pattern_001',
  'dec_cbc_marrow_red_flag_001',
  'CBC-NEUT-YOUNGINF-001',
  'CBC-NEUT-LOCALRANGE-001',
  'CBC-NEUT-BENIGNDIFF-001',
  'CBC-NEUT-MARROWFLAG-001',
  'benign-ethnic-neutropenia-differential-pattern',
  'rf_run_20260717_rf_cbc_001_pediatric_cds_establish',
  'bundle_20260718_intent_research_20260717_rf_cbc_001',
  // Broader, prefix-level nets per this task's own AC wording ("any dec_cbc_* id",
  // "CBC-NEUT-*/CBC-MARROW-REDFLAG-* id") -- catches a leaked id this test did not name above.
  'dec_cbc_',
  'CBC-NEUT-',
  'CBC-MARROW-REDFLAG-',
];

const CASES = [
  { moduleId: 'anemia', fixture: 'rf-ev-001', expectThrow: false },
  { moduleId: 'kidney_suite_v1', fixture: 'rf-kid-001', expectThrow: true },
  { moduleId: 'growth_suite_v1', fixture: 'rf-gro-002', expectThrow: true },
];

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

for (const { moduleId, fixture, expectThrow } of CASES) {
  test(`P3-T1: propose(${moduleId}) writes only the allowed file set, never rules.json/rule-provenance.json`, async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), `ef-propose-scope-lock-${moduleId}-`));
    try {
      const runOptions = {
        runDir: path.join(REPO_ROOT, 'tests', 'fixtures', fixture),
        module: path.join(REPO_ROOT, 'modules', moduleId, 'module.json'),
        decisions: path.join(REPO_ROOT, 'modules', moduleId, 'authoring-decisions.yaml'),
        out: outDir,
      };

      if (expectThrow) {
        // kidney_suite_v1/growth_suite_v1: the run halts partway through, at
        // `computeTestCorpusHash` (no `tests/ef-<moduleId>-*.test.mjs` corpus yet -- Phase 4). This
        // is the REAL, current behavior this task's own binding note names explicitly -- catch it,
        // do not pretend the run completes.
        await assert.rejects(
          () => runPropose(runOptions),
          (err) => {
            assert.ok(
              err instanceof UsageError,
              `expected propose(${moduleId}) to throw UsageError (missing test corpus), got ${err?.constructor?.name}: ${err?.message}`,
            );
            assert.match(
              err.message,
              new RegExp(`tests/ef-${moduleId}-.*\\.test\\.mjs`),
              'the UsageError must name the missing test-corpus glob for this exact module, ' +
                'confirming the throw is the documented computeTestCorpusHash gap, not some ' +
                'other, unrelated failure',
            );
            return true;
          },
        );
      } else {
        // anemia: a pre-existing test corpus already satisfies computeTestCorpusHash, so this run
        // completes cleanly end to end (EXIT_OK). Still asserted here as real, not assumed.
        const exitCode = await runPropose(runOptions);
        assert.equal(exitCode, 0, `propose(${moduleId}) was expected to complete (EXIT_OK)`);
      }

      // ---- Positive allowlist + hard forbidden-file check -----------------------------------
      // Applies identically whether the run completed or threw partway through -- this is the
      // FR-F11 scope lock itself, not conditioned on which case fired above.
      const filesWritten = await readdir(outDir);
      for (const forbidden of FORBIDDEN_FILES) {
        assert.ok(
          !filesWritten.includes(forbidden),
          `propose(${moduleId}) must NEVER write ${forbidden} -- found it in ${outDir}`,
        );
      }
      for (const file of filesWritten) {
        assert.ok(
          ALLOWED_FILES.has(file),
          `propose(${moduleId}) wrote an unexpected file ${file} not in the allowed set ` +
            `${JSON.stringify([...ALLOWED_FILES])}`,
        );
      }
      // `rule-proposals.json` and `candidates.json` must ALWAYS be present and empty for these 3
      // modules (never omitted) -- FR-F11's binding resolution -- regardless of the throw/success
      // split above, since both are written by `writeDraftPack` BEFORE the corpus-hash step.
      assert.ok(
        filesWritten.includes('rule-proposals.json'),
        `propose(${moduleId}) must always write rule-proposals.json (present-but-empty), even on ` +
          'a partial/thrown run',
      );
      assert.ok(
        filesWritten.includes('candidates.json'),
        `propose(${moduleId}) must always write candidates.json (present-but-empty), even on a ` +
          'partial/thrown run',
      );

      // ---- SUBSTANCE: rule-proposals.json wrapper moduleId + empty proposals ----------------
      const ruleProposalsPath = path.join(outDir, 'rule-proposals.json');
      const ruleProposalsDoc = await loadJson(ruleProposalsPath);
      assert.equal(
        ruleProposalsDoc.moduleId,
        moduleId,
        `rule-proposals.json's wrapper moduleId must equal the TARGET module's own id ` +
          `(${moduleId}), never cbc_suite_v1's or any other module's -- got ${ruleProposalsDoc.moduleId}`,
      );
      assert.ok(
        Array.isArray(ruleProposalsDoc.proposals),
        'rule-proposals.json.proposals must be an array',
      );
      assert.equal(
        ruleProposalsDoc.proposals.length,
        0,
        `${moduleId} has no hand-authored rule-body content in this pass -- proposals must be empty`,
      );

      // ---- SUBSTANCE: candidates.json is the bare empty object ------------------------------
      const candidatesPath = path.join(outDir, 'candidates.json');
      const candidatesDoc = await loadJson(candidatesPath);
      assert.equal(
        Object.keys(candidatesDoc).length,
        0,
        `${moduleId}'s candidates.json must be the bare empty object {} -- got keys ` +
          `${JSON.stringify(Object.keys(candidatesDoc))}`,
      );

      // ---- Cross-module-leak negative control -----------------------------------------------
      // The exact regression this task's AC names: a P2-T3-only (no P2-T7) genericity gap would
      // have let cbc_suite_v1's own RULE_PROPOSALS/CANDIDATES leak into another module's output
      // verbatim. Grep the raw serialized bytes of both files for every cbc-owned needle.
      const ruleProposalsRaw = await readFile(ruleProposalsPath, 'utf8');
      const candidatesRaw = await readFile(candidatesPath, 'utf8');
      for (const needle of CBC_LEAK_NEEDLES) {
        assert.ok(
          !ruleProposalsRaw.includes(needle),
          `${moduleId}'s rule-proposals.json must not contain cbc_suite_v1's own identity ` +
            `string ${JSON.stringify(needle)}`,
        );
        assert.ok(
          !candidatesRaw.includes(needle),
          `${moduleId}'s candidates.json must not contain cbc_suite_v1's own identity string ` +
            `${JSON.stringify(needle)}`,
        );
      }
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
}
