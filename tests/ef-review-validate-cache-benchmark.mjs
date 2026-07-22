#!/usr/bin/env node
// tests/ef-review-validate-cache-benchmark.mjs — Clinical Review Workflow v1, Phase 2, P2-T4
// (FR-9/10, R5, OQ-6, F3): repeatable, cross-process cache-cold vs. cache-warm wall-time
// microbenchmark over the committed, REAL 5-record `cbc_suite_v1` set.
//
// STANDALONE SCRIPT, NOT a node:test suite. This file is deliberately named
// `ef-review-validate-cache-benchmark.mjs` (no `.test.mjs` suffix) so it is NEVER matched by
// `npm test`'s `tests/*.test.mjs` / `tests/witness/*.test.mjs` discovery globs (F10 --
// `package.json`'s `scripts.test` is unchanged by this file) and never runs as part of the
// automated `npm run check` gate. Run it manually:
//
//   node tests/ef-review-validate-cache-benchmark.mjs
//
// WHAT THIS MEASURES (this task's own acceptance criterion): "cache-cold vs. cache-warm wall-time
// ACROSS TWO SEPARATE node invocations sharing the persistent cache dir" -- i.e. the real-world
// cross-process warmth `validate-cache.mjs` exists to provide (F3), not an in-process
// microbenchmark (which could never observe cross-process persistence at all).
//
// METHODOLOGY: for each of REPEATED_RUNS (3) top-level repetitions, this script runs
// SAMPLES_PER_RUN (4) independent trials. Each trial:
//   1. creates a BRAND-NEW, EMPTY persistent cache directory (`mkdtemp`, never the real OS
//      default -- see `REVIEW_RECORD_CACHE_DIR`, the same test seam `validate-cache.mjs` itself
//      documents and every other cache test in this repo uses);
//   2. spawns `node tools/review-record/cli.mjs validate --module cbc_suite_v1 --root <repo>` as a
//      genuinely SEPARATE OS process (`spawnSync`) pointed at that cache dir -- this is the COLD
//      sample (the cache starts empty; this call populates it; expected cache marker: hits=0,
//      misses=5, matching this task's own "committed 5-record cbc_suite_v1 set");
//   3. spawns validate AGAIN, as a SECOND, wholly separate `node` process, against the SAME cache
//      dir -- this is the WARM sample (every one of the 5 records should now be a hit).
// A trial's cold and warm timings are two genuinely different OS processes sharing one on-disk
// persistent cache file -- exactly the F3/R5 guarantee under test, and exactly what a real
// clinician-tooling operator experiences running `validate` twice in a row from a shell.
//
// Both COLD and WARM samples within one repetition are averaged over SAMPLES_PER_RUN independent
// trials (each its own fresh cache dir, its own pair of processes) purely to suppress OS-level
// process-spawn/scheduling jitter -- a single one-shot wall-clock sample of a tiny 5-record module
// is small enough (well under Node's own ~50-150ms process-startup cost) that comparing single
// samples directly would be noisy on a loaded machine. Averaging does not change WHAT is measured
// (still two genuinely separate node invocations per trial); it only makes the comparison
// repeatable, matching this task's own "repeatable microbenchmark" and "measurably faster ACROSS 3
// repeated runs" language.
//
// This script's pass/fail bar (this task's own acceptance criterion) is: cache-warm must be
// measurably faster than cache-cold on a MAJORITY of the 3 top-level repeated runs (not
// necessarily every individual trial within a run -- individual-trial noise is real and expected;
// see the per-trial table this script prints, which shows the full, honest picture, not just the
// pass/fail verdict). `process.exitCode` is set non-zero if that bar is not met, so this script can
// also be wired into a manual regression check without extra parsing.
//
// Uses the REAL, committed `modules/cbc_suite_v1/reviews/` (never a throwaway fixture) -- so this
// benchmark's numbers reflect the tool's actual real-world per-record check cost (schema shape, D-4
// roster resolution, Ed25519 signature verification, chain-link fact) over this repo's own real
// content, read-only throughout (validate never writes to `modules/`, `governance/`, or `schemas/`;
// its only write target is the isolated, per-trial `REVIEW_RECORD_CACHE_DIR`, torn down after every
// trial). `validate`'s own known terminal, structurally-non-qualifying FR-6 outcome on this real set
// (see `tests/ef-review-workflow.test.mjs`'s own drift-guard test) is irrelevant here -- the
// `validate-cache: hits=... misses=...` marker line (`lib/verbs/validate.mjs`) is printed
// UNCONDITIONALLY, on both a passing and a failing invocation, so this benchmark's pass/fail bar is
// entirely independent of `validate`'s own exit code.
//
// Structural performance measurement only -- never a clinical-validity, safety, or regulatory-
// performance claim; matches this whole tool's standing honesty boundary.

import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(REPO_ROOT, 'tools', 'review-record', 'cli.mjs');
const MODULE_ID = 'cbc_suite_v1';
const EXPECTED_RECORD_COUNT = 5; // the committed cbc_suite_v1 set this task's AC names

const REPEATED_RUNS = 3;
const SAMPLES_PER_RUN = 8;

const CACHE_MARKER_RE = /validate-cache: hits=(\d+) misses=(\d+) of (\d+) scoped/;

/**
 * Spawns the real `cli.mjs validate` entry point as a genuinely separate `node` process against
 * `cacheDir`, and returns its wall-clock elapsed time plus the parsed cache hit/miss marker.
 *
 * @param {string} cacheDir
 * @returns {{ elapsedMs: number, status: number|null, hits: number|null, misses: number|null, scoped: number|null }}
 */
function runValidateOnce(cacheDir) {
  const start = performance.now();
  const result = spawnSync(
    process.execPath,
    [CLI_PATH, 'validate', '--module', MODULE_ID, '--root', REPO_ROOT],
    { encoding: 'utf8', env: { ...process.env, REVIEW_RECORD_CACHE_DIR: cacheDir } },
  );
  const elapsedMs = performance.now() - start;
  if (result.error) {
    throw new Error(`spawnSync itself failed: ${result.error}`);
  }
  const marker = result.stdout.match(CACHE_MARKER_RE);
  if (!marker) {
    throw new Error(
      `expected a validate-cache marker line in stdout, got:\n${result.stdout}\n${result.stderr}`,
    );
  }
  return {
    elapsedMs,
    status: result.status,
    hits: Number(marker[1]),
    misses: Number(marker[2]),
    scoped: Number(marker[3]),
  };
}

/**
 * Runs one COLD + WARM trial pair against a brand-new, isolated cache directory. Returns both
 * samples' elapsed times, having already sanity-checked their hit/miss shape.
 *
 * @returns {Promise<{ coldMs: number, warmMs: number }>}
 */
async function runOneTrial() {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'ef-review-cache-benchmark-'));
  try {
    const cold = runValidateOnce(cacheDir);
    if (cold.hits !== 0 || cold.misses !== EXPECTED_RECORD_COUNT || cold.scoped !== EXPECTED_RECORD_COUNT) {
      throw new Error(
        `expected a COLD trial to show hits=0 misses=${EXPECTED_RECORD_COUNT} scoped=` +
          `${EXPECTED_RECORD_COUNT}, got hits=${cold.hits} misses=${cold.misses} scoped=${cold.scoped}`,
      );
    }

    const warm = runValidateOnce(cacheDir);
    if (warm.hits !== EXPECTED_RECORD_COUNT || warm.misses !== 0 || warm.scoped !== EXPECTED_RECORD_COUNT) {
      throw new Error(
        `expected a WARM trial to show hits=${EXPECTED_RECORD_COUNT} misses=0 scoped=` +
          `${EXPECTED_RECORD_COUNT}, got hits=${warm.hits} misses=${warm.misses} scoped=${warm.scoped}`,
      );
    }

    return { coldMs: cold.elapsedMs, warmMs: warm.elapsedMs };
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
}

function average(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** @param {number[]} values @returns {number} */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Runs SAMPLES_PER_RUN PAIRED (cold, warm) trials and reduces them to per-run statistics. The
 * PAIRED-DIFFERENCE median (`cold_i - warm_i` for each trial `i`, then the median of those
 * differences) is this script's primary "warm faster?" signal -- a paired design controls for
 * slower/faster stretches of overall machine load across the run (both samples of a pair are
 * measured back-to-back against the SAME cache dir), and the median (rather than a mean of raw
 * times) is robust to the occasional single-process-spawn outlier that plain wall-clock timing of
 * short-lived child processes is prone to.
 *
 * @param {number} index
 * @returns {Promise<{ index: number, coldAvgMs: number, warmAvgMs: number, medianDiffMs: number, warmFasterTrialCount: number, coldSamples: number[], warmSamples: number[] }>}
 */
async function runOneRepetition(index) {
  const coldSamples = [];
  const warmSamples = [];
  const pairedDiffs = [];
  let warmFasterTrialCount = 0;
  for (let i = 0; i < SAMPLES_PER_RUN; i += 1) {
    // Intentionally sequential: overlapping concurrent child processes would corrupt each other's
    // wall-clock timing (CPU contention), and each trial's own cold/warm pair must observe the SAME
    // cache dir in COLD-then-WARM order.
    // eslint-disable-next-line no-await-in-loop
    const { coldMs, warmMs } = await runOneTrial();
    coldSamples.push(coldMs);
    warmSamples.push(warmMs);
    pairedDiffs.push(coldMs - warmMs);
    if (warmMs < coldMs) warmFasterTrialCount += 1;
  }
  return {
    index,
    coldAvgMs: average(coldSamples),
    warmAvgMs: average(warmSamples),
    medianDiffMs: median(pairedDiffs),
    warmFasterTrialCount,
    coldSamples,
    warmSamples,
  };
}

async function main() {
  console.log(
    `Cross-process cache-cold vs. cache-warm microbenchmark -- validate --module ${MODULE_ID}\n` +
      `${REPEATED_RUNS} repeated runs x ${SAMPLES_PER_RUN} PAIRED trials/run, each trial = two ` +
      'SEPARATE node processes sharing one fresh persistent cache dir (F3/R5).\n',
  );

  // One throwaway warm-up invocation before any timed sample -- primes this machine's OS-level
  // file-page cache for cli.mjs and every lib/*.mjs module it loads, so the FIRST real timed trial
  // is not unfairly penalized relative to every later one purely by being first in process order
  // (a confound unrelated to this task's own persistent-cache mechanism under test).
  const warmupDir = await mkdtemp(path.join(tmpdir(), 'ef-review-cache-benchmark-warmup-'));
  try {
    runValidateOnce(warmupDir);
  } finally {
    await rm(warmupDir, { recursive: true, force: true });
  }

  const repetitions = [];
  for (let i = 1; i <= REPEATED_RUNS; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- repetitions run sequentially for the same reason
    // trials within a repetition do (see runOneRepetition).
    repetitions.push(await runOneRepetition(i));
  }

  console.log(
    'run  cold-avg(ms)  warm-avg(ms)  median-paired-diff(ms)  warm-faster  trials-warm-faster  speedup',
  );
  let runsWhereWarmWasFaster = 0;
  for (const rep of repetitions) {
    // A run's primary verdict is the PAIRED-DIFFERENCE MEDIAN (see runOneRepetition) -- positive
    // means warm was faster on the "typical" (median) trial of this run.
    const warmFaster = rep.medianDiffMs > 0;
    if (warmFaster) runsWhereWarmWasFaster += 1;
    const speedup = rep.warmAvgMs > 0 ? (rep.coldAvgMs / rep.warmAvgMs).toFixed(2) : 'n/a';
    console.log(
      `${String(rep.index).padEnd(4)} ${rep.coldAvgMs.toFixed(1).padStart(12)}  ` +
        `${rep.warmAvgMs.toFixed(1).padStart(12)}  ${rep.medianDiffMs.toFixed(1).padStart(23)}  ` +
        `${String(warmFaster).padStart(11)}  ${`${rep.warmFasterTrialCount}/${SAMPLES_PER_RUN}`.padStart(18)}  ${speedup}x`,
    );
    console.log(`     cold-samples(ms): ${rep.coldSamples.map((v) => v.toFixed(0)).join(', ')}`);
    console.log(`     warm-samples(ms): ${rep.warmSamples.map((v) => v.toFixed(0)).join(', ')}`);
  }

  console.log(`\nwarm faster than cold (by paired-diff median) on ${runsWhereWarmWasFaster}/${REPEATED_RUNS} repeated runs`);

  if (runsWhereWarmWasFaster <= REPEATED_RUNS / 2) {
    console.error(
      '\nFAIL: cache-warm was not measurably faster than cache-cold on a majority of the repeated ' +
        'runs (R5/F3 regression signal -- the persistent per-record cache may not be providing a ' +
        'real cross-process speedup; re-run on a quieter machine before treating this as a genuine ' +
        'regression, since process-spawn wall-clock timing is inherently environment-sensitive).',
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    '\nPASS: cache-warm was measurably faster than cache-cold across a majority of the repeated runs.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
