// EP6-T3 (wave0-safety-foundation, Phase EP-6, FR-WP6-03, OQ-4) -- gate test for
// scripts/mutation-run.mjs's hand-rolled mutation-testing runner.
//
// D-5 ZERO DEPENDENCIES: package.json declares no dependencies/devDependencies at all. Everything
// this file exercises is bespoke tooling against node:test/node:child_process/node:fs -- not
// Stryker or any published mutation-testing package.
//
// DISTINCT FROM tests/kb-diff.test.mjs (read scripts/kb-diff.mjs's header, and this file's sibling
// scripts/mutation-run.mjs's header, before touching either): kb-diff.mjs/kb-diff.test.mjs prove a
// SEMANTIC DIFF CLASSIFIER correctly tiers the risk of a KB change that already happened. This
// file proves a MUTATION TESTING RUNNER correctly measures whether the existing node:test suite
// would catch a NEW seeded defect if one existed. Different question, different artifact, same KB.
//
// RUNTIME BUDGET: this file must complete in well under 60 seconds (it runs inside `npm test`).
// It therefore does NOT re-run scripts/mutation-run.mjs's full ~490-mutant exhaustive plan --
// that is `node scripts/mutation-run.mjs`'s job, run manually, and its measured output lives in
// tests/mutation-baseline.json (OQ-4: "baseline is recorded from a real measurement run,
// not asserted" -- see that file's own header comment in scripts/mutation-run.mjs for how it was
// produced). Instead this file re-runs, for REAL, exactly the bounded "smoke subset" of mutant ids
// scripts/mutation-run.mjs recorded into the baseline artifact at measurement time (a deterministic
// structural selection -- see selectSmokeSubset()'s own comment for why the ids are derived from
// rules.json's actual content rather than hand-typed), and:
//   1. Confirms the two anti-vacuity controls (CTRL-LETHAL / CTRL-INERT) still classify correctly
//      on a real subprocess run, not merely by trusting the cached JSON -- this is what actually
//      proves the harness can detect a kill and can detect a genuine non-viable/dead-config edit,
//      every time this file runs, not just once at measurement time.
//   2. Gates: the smoke subset's CURRENT kill score must not regress below its RECORDED baseline
//      score, and every individual mutant killed at baseline time must still be killed now -- named
//      by id on failure, so a regression points at the exact defect class that stopped being caught.
// A full-suite regression is a job for a periodic `node scripts/mutation-run.mjs` re-run + a new
// baseline commit, not for this file.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import os from 'node:os';

import {
  buildMutantPlan,
  selectSmokeSubset,
  runMutantsWithPool,
  REPO_PATHS,
} from '../scripts/mutation-run.mjs';

const BASELINE_URL = new URL('./mutation-baseline.json', import.meta.url);

async function loadBaseline() {
  return JSON.parse(await readFile(BASELINE_URL, 'utf8'));
}

test('EP6-T3 OQ-4: baseline artifact is a real measured run, not an asserted number', async () => {
  const baseline = await loadBaseline();

  assert.equal(typeof baseline.measuredAt, 'string', 'baseline must record when it was measured');
  assert.ok(!Number.isNaN(Date.parse(baseline.measuredAt)), 'measuredAt must be a real timestamp');
  assert.equal(typeof baseline.score, 'number');
  assert.ok(baseline.score >= 0 && baseline.score <= 1, `score ${baseline.score} out of [0,1] range`);
  assert.equal(
    baseline.killedTotal + baseline.survivedTotal, baseline.viableTotal,
    'killed + survived must reconcile to the viable total',
  );
  assert.equal(
    baseline.viableTotal + baseline.nonViableTotal, baseline.total,
    'viable + non-viable must reconcile to the total mutant count',
  );
  assert.ok(baseline.total > 400, `expected several hundred enumerated mutants, got ${baseline.total} -- did enumeration break?`);
  assert.ok(Array.isArray(baseline.survivors));
  assert.equal(baseline.survivedTotal, baseline.survivors.length);
  assert.ok(Array.isArray(baseline.smokeSubset) && baseline.smokeSubset.length > 0);

  // The recorded baseline itself must show a passing anti-vacuity self-check -- if it doesn't, the
  // baseline was measured with a broken harness and must not be trusted or gated against.
  assert.ok(baseline.controls.lethal.pass, 'recorded baseline: CTRL-LETHAL must have been killed');
  assert.ok(baseline.controls.inert.pass, 'recorded baseline: CTRL-INERT must have been classified non-viable');
});

test('EP6-T3 OQ-4 gate: smoke-subset re-run does not regress below the recorded baseline', async (t) => {
  const baseline = await loadBaseline();
  const plan = await buildMutantPlan();
  const originalContentByFile = {
    [REPO_PATHS.RULES_PATH]: plan.rulesRaw,
    [REPO_PATHS.FACTS_PATH]: plan.factsSource,
    [REPO_PATHS.RANGES_PATH]: plan.rangesSource,
  };

  const smokeSubset = selectSmokeSubset(plan.all);
  assert.ok(smokeSubset.length > 0, 'selectSmokeSubset() returned nothing -- did the KB or operator set change shape?');

  const poolSize = Math.max(2, Math.min(4, os.cpus().length));
  const results = await runMutantsWithPool(smokeSubset, poolSize, originalContentByFile);
  const currentById = new Map(results.map((m) => [m.id, m]));

  // --- Anti-vacuity self-check (real subprocess run, every time this file runs) ---
  await t.test('CTRL-LETHAL is actually killed by a real run', () => {
    const lethal = results.find((m) => m.control === 'lethal');
    assert.ok(lethal, 'CTRL-LETHAL mutant missing from the plan');
    assert.equal(lethal.viable, true, 'CTRL-LETHAL must classify as viable');
    assert.equal(
      lethal.killed, true,
      'CTRL-LETHAL (ALERT-001 output dropped) SURVIVED a real run -- the mutation harness itself '
      + 'is not correctly wired to the victim command (tests/witness/alerts.test.mjs should have '
      + "caught the missing emergency alert), not just a KB gap. Fix the harness before trusting "
      + 'any other result in this file.',
    );
  });

  await t.test('CTRL-INERT is actually classified non-viable by a real run', () => {
    const inert = results.find((m) => m.control === 'inert');
    assert.ok(inert, 'CTRL-INERT mutant missing from the plan');
    assert.equal(
      inert.viable, false,
      'CTRL-INERT (changeRationale dead-config edit) was classified VIABLE -- the non-viability '
      + 'detector is not actually checking anything, which would silently pollute every future '
      + 'mutation score denominator with edits that can never fail a test.',
    );
  });

  // --- Named-regression gate: every mutant killed at baseline time must still be killed ---
  await t.test('no individual smoke-subset mutant regressed from killed to survived', () => {
    const regressions = [];
    for (const bm of baseline.smokeSubset) {
      if (bm.control || !bm.viable || !bm.killed) continue;
      const cm = currentById.get(bm.id);
      if (!cm) continue; // stale id (KB content changed since baseline) -- covered by the staleness test below
      if (!cm.viable || !cm.killed) {
        regressions.push(`${bm.id} (${bm.description ?? cm.description}) was killed at baseline (${baseline.measuredAt}) but now ${!cm.viable ? 'is non-viable' : 'SURVIVES'}`);
      }
    }
    assert.deepEqual(regressions, [], `mutation-kill regression(s):\n${regressions.join('\n')}`);
  });

  await t.test('every baseline smoke-subset id still exists in the current plan (KB has not silently drifted)', () => {
    const missing = baseline.smokeSubset.filter((bm) => !currentById.has(bm.id)).map((bm) => bm.id);
    assert.deepEqual(missing, [], `smoke-subset mutant id(s) no longer produced by the current plan: ${missing.join(', ')} -- rules.json/facts.anemia.js/ranges.js changed shape; re-run node scripts/mutation-run.mjs to record a fresh baseline`);
  });

  // --- Score-level gate (current, not per-mutant, gives one clear pass/fail summary) ---
  const currentViable = results.filter((m) => !m.control && m.viable);
  const currentKilled = currentViable.filter((m) => m.killed);
  const currentScore = currentViable.length > 0 ? currentKilled.length / currentViable.length : 1;

  const baselineViable = baseline.smokeSubset.filter((m) => !m.control && m.viable);
  const baselineKilled = baselineViable.filter((m) => m.killed);
  const baselineScore = baselineViable.length > 0 ? baselineKilled.length / baselineViable.length : 1;

  assert.ok(
    currentScore >= baselineScore - 1e-9,
    `mutation smoke-subset score regressed: current ${currentScore} (${currentKilled.length}/${currentViable.length}) `
    + `< recorded baseline ${baselineScore} (${baselineKilled.length}/${baselineViable.length}, measured ${baseline.measuredAt})`,
  );
});
