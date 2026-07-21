#!/usr/bin/env node
// EP6-T3 (wave0-safety-foundation, Phase EP-6, FR-WP6-03, OQ-4) -- hand-rolled mutation-testing
// runner: measures whether THIS REPO'S TEST SUITE actually kills seeded defects in the anemia
// knowledge base and its derivation logic. mutation score = killed / (total viable mutants).
//
// D-5 ZERO DEPENDENCIES: package.json declares no dependencies/devDependencies at all, so this is
// bespoke tooling against node:test/node:child_process/node:fs -- not Stryker, not any mutation-
// testing package. Every mutation operator, sandbox mechanism, and scoring rule below is hand-
// rolled specifically for this repo's rule DSL and D-5 constraint.
//
// DISTINCT FROM scripts/kb-diff.mjs (read that file's header first): kb-diff.mjs is a SEMANTIC
// DIFF CLASSIFIER -- given a base/head KB snapshot pair, it classifies the RISK TIER of a change
// that has already happened (block/review/clean), using SPIKE-005's M01-M83 seeded-mutation table
// as its own test corpus. This file is a MUTATION TESTING RUNNER -- it seeds NEW synthetic defects
// into a SANDBOXED copy of the KB/derivation code, one at a time, and asks a completely different
// question: "if this exact defect existed, would the existing node:test suite fail?" kb-diff.mjs
// never runs a test; this file never classifies a diff's safety tier. Score here is a property of
// the TEST SUITE (its kill rate), not of any real change to the KB.
//
// HARD ISOLATION (there are other agents concurrently running tests in this same worktree): this
// module NEVER writes to the real repo working tree except its own single output artifact,
// tests/mutation-baseline.json, produced only when invoked as a CLI (see the
// import.meta.url guard at the bottom). Every mutation is applied to a throwaway copy of the
// relevant subset of the repo under os.tmpdir(), and every victim-test subprocess runs with that
// sandbox directory as its cwd. Source files under this repo's working tree are only ever opened
// for READ (readFile) to build sandboxes and to diff against; they are never opened for write.
//
// NON-VIABILITY (the "equivalent mutant" problem): a mutant is excluded from the score's
// denominator ONLY when it is STRUCTURALLY provable to have no behavioral effect -- (a) the
// mutated content is byte-for-byte identical to the original (a hand-authored search/replace
// pattern that failed to match, or a JSON transform that was a no-op), or (b) the mutation targets
// a field that is provably never read by evaluateCondition()/runRules()/assess() (see
// CONTROL_INERT below, and the grep-verified justification in its comment). We deliberately do NOT
// try to prove semantic equivalence by diffing assess() output over our fixture corpus: our
// fixture corpus is finite and incomplete, so "no fixture happens to witness this rule" is NOT the
// same claim as "this mutation can never change behavior" -- conflating the two would silently
// exclude real gaps from the denominator and overstate the score. Every mutation whose content
// differs from the original, and that is not one of the two explicitly-tagged dead-config
// controls, is therefore counted as VIABLE and must be judged killed/survived by an actual test
// run, never assumed.

import { readFile, writeFile, mkdtemp, cp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RULES_PATH = path.join(REPO_ROOT, 'modules/anemia/rules.json');
const FACTS_PATH = path.join(REPO_ROOT, 'modules/anemia/facts.anemia.js');
const RANGES_PATH = path.join(REPO_ROOT, 'modules/anemia/ranges.js');
const MODULE_MANIFEST_PATH = path.join(REPO_ROOT, 'modules/anemia/module.json');
const BASELINE_PATH = path.join(REPO_ROOT, 'tests/mutation-baseline.json');

// Relative-to-repo-root entries copied into every sandbox. Deliberately excludes .git, dist, and
// node_modules (dist is a build output the victim tests never need and would only race with the
// other agents' concurrent `npm run build`; node_modules does not exist under D-5; .git is never
// needed by node:test). `docs` and `evidence-packs` were added after an unmutated-sandbox smoke
// run (see this file's git history) proved 2 of the VICTIM_TEST_FILES read outside the original
// subset: tests/candidate-governance.test.mjs's validateModule() reads
// evidence-packs/rf-ev-001/fidelity-findings.json, and tests/hazard-control-matrix.test.mjs reads
// docs/safety/hazard-control-matrix.json. An incomplete sandbox would have made EVERY mutant look
// "killed" for the wrong reason (the unmutated baseline itself fails) -- the single most dangerous
// false-positive this runner could produce, and exactly why the self-check below exists.
const SANDBOX_ENTRIES = ['src', 'modules', 'scripts', 'tests', 'schemas', 'examples', 'docs', 'evidence-packs', 'package.json'];

// Targeted victim-test subset (NOT the whole suite -- see the runtime-budget note in the task
// brief). Chosen to cover, between them, every layer a rules.json/facts.anemia.js/ranges.js defect
// could surface at: rule activation (corpus/alerts witnesses -- alerts.test.mjs specifically
// inspects `result.alerts` content/severity, not just matchedRuleIds, so it can see a dropped or
// downgraded alert output that a matchedRuleIds-only check would miss), end-to-end assess() shape
// (engine.test.mjs), known dangerous-miss clinical scenarios, the cross-cutting hazard-control
// matrix, the tri-state missingness invariant, rule-coverage accounting, and candidate-catalog
// governance. This is a deliberate subset, not an approximation of `npm test` -- see the mapping
// rationale recorded alongside VICTIM_TEST_FILES in the baseline artifact.
//
// EP6-T2/EP6-T1 INTEGRATION (added by the EP-6 orchestrator): the first measured baseline scored
// 431/457 with 26 survivors, and every one of those survivors was a *derived* numeric boundary in
// facts.anemia.js/ranges.js (stfr index 1/2, lead bands 3.5/20/45, hb severity 7/9, TEC/DBA age
// windows, ferritin thresholds). That was an artifact of concurrency, not a real gap: EP6-T1 and
// EP6-T3 were authored in parallel and blind to each other, so this list predated
// tests/boundary.test.mjs -- the suite purpose-built to pin exactly those boundaries. Leaving them
// out would have published a baseline that understated the safety net and left 26 "known gaps" on
// record that the phase had in fact already closed. property.test.mjs is seeded and deterministic,
// so it is a legitimate victim (a mutant that perturbs a boundary changes its generated corpus).
const VICTIM_TEST_FILES = [
  'tests/witness/corpus.test.mjs',
  'tests/witness/alerts.test.mjs',
  'tests/engine.test.mjs',
  'tests/dangerous-miss-scenarios.test.mjs',
  'tests/hazard-control-matrix.test.mjs',
  'tests/tristate-safety-invariant.test.mjs',
  'tests/rule-coverage.test.mjs',
  'tests/candidate-governance.test.mjs',
  'tests/boundary.test.mjs',
  'tests/property.test.mjs',
];

// ---------------------------------------------------------------------------------------------
// Condition-tree walkers over rules.json's `when` DSL (all/any/not/leaf -- see src/ruleEngine.js
// evaluateCondition()). Each walker yields {path} arrays of alternating string keys ('all'/'any'/
// 'not') and numeric indices, generic over arbitrary nesting depth so a future KB restructuring
// does not silently stop generating mutants for newly-nested conditions.
// ---------------------------------------------------------------------------------------------

function* walkLeaves(cond, condPath = []) {
  if (cond.not) { yield* walkLeaves(cond.not, [...condPath, 'not']); return; }
  if (Array.isArray(cond.all)) {
    for (let i = 0; i < cond.all.length; i += 1) yield* walkLeaves(cond.all[i], [...condPath, 'all', i]);
    return;
  }
  if (Array.isArray(cond.any)) {
    for (let i = 0; i < cond.any.length; i += 1) yield* walkLeaves(cond.any[i], [...condPath, 'any', i]);
    return;
  }
  yield { leaf: cond, condPath };
}

function* walkCombinators(cond, condPath = []) {
  if (cond.not) { yield* walkCombinators(cond.not, [...condPath, 'not']); return; }
  if (Array.isArray(cond.all)) {
    yield { kind: 'all', condPath, length: cond.all.length };
    for (let i = 0; i < cond.all.length; i += 1) yield* walkCombinators(cond.all[i], [...condPath, 'all', i]);
    return;
  }
  if (Array.isArray(cond.any)) {
    yield { kind: 'any', condPath, length: cond.any.length };
    for (let i = 0; i < cond.any.length; i += 1) yield* walkCombinators(cond.any[i], [...condPath, 'any', i]);
    return;
  }
}

function* walkNots(cond, condPath = []) {
  if (cond.not) {
    yield { condPath };
    yield* walkNots(cond.not, [...condPath, 'not']);
    return;
  }
  if (Array.isArray(cond.all)) {
    for (let i = 0; i < cond.all.length; i += 1) yield* walkNots(cond.all[i], [...condPath, 'all', i]);
    return;
  }
  if (Array.isArray(cond.any)) {
    for (let i = 0; i < cond.any.length; i += 1) yield* walkNots(cond.any[i], [...condPath, 'any', i]);
    return;
  }
}

/**
 * Applies `transform` to the node at `condPath` inside `rule.when` (rule must belong to an
 * already-cloned rules array). Takes the RULE, not the `when` tree, specifically so the
 * condPath === [] (root-level condition) case can reassign `rule.when` itself -- an earlier
 * version took `when` directly and returned the transformed root without ever writing it back,
 * silently no-op'ing every mutation whose leaf/combinator sat at the top of the tree (no wrapping
 * all/any/not). Caught by this file's own byte-identical viability check flagging ~130 mutants as
 * non-viable no-ops that were, in fact, never applied at all -- see the git history for this file.
 */
function transformAt(rule, condPath, transform) {
  if (condPath.length === 0) { rule.when = transform(rule.when); return rule; }
  let parent = rule.when;
  for (let i = 0; i < condPath.length - 1; i += 1) parent = parent[condPath[i]];
  const key = condPath[condPath.length - 1];
  parent[key] = transform(parent[key]);
  return rule;
}

function cloneRules(rules) {
  return JSON.parse(JSON.stringify(rules));
}

/** Stable normalized form used ONLY for the byte-identical viability check, never written out. */
function normalize(rulesArray) {
  return JSON.stringify(rulesArray, null, 2);
}

// ---------------------------------------------------------------------------------------------
// Mutant enumeration -- rules.json. Deterministic order: rule array index, then leaf/combinator
// discovery order within that rule's `when` tree (a stable depth-first walk), then a fixed
// per-operator suffix. Re-running against an unchanged rules.json always yields the same id list
// in the same order.
// ---------------------------------------------------------------------------------------------

const SEVERITY_DOWNGRADE = {
  emergency: 'urgent',
  urgent: 'important',
  important: 'informational',
  informational: 'urgent',
};

function enumerateRuleMutants(rules) {
  const mutants = [];

  rules.forEach((rule, ruleIndex) => {
    const pathKey = (condPath) => (condPath.length ? condPath.join('.') : 'root');

    for (const { leaf, condPath } of walkLeaves(rule.when)) {
      const op = leaf.op ?? 'eq';
      if (op === 'eq') {
        mutants.push({
          id: `M-${rule.id}-EQ_NEGATE-${pathKey(condPath)}`,
          kind: 'rules',
          ruleId: rule.id,
          operator: 'EQ_NEGATE',
          description: `${rule.id}: leaf op 'eq' -> 'neq' on fact "${leaf.fact}" (condition path ${pathKey(condPath)})`,
          apply: (clone) => transformAt(clone[ruleIndex], condPath, (node) => ({ ...node, op: 'neq' })) && clone,
        });
      }
      if (op === 'gte') {
        mutants.push({
          id: `M-${rule.id}-GTE_TO_LT-${pathKey(condPath)}`,
          kind: 'rules',
          ruleId: rule.id,
          operator: 'GTE_TO_LT',
          description: `${rule.id}: leaf op 'gte' -> 'lt' on fact "${leaf.fact}" (condition path ${pathKey(condPath)})`,
          apply: (clone) => transformAt(clone[ruleIndex], condPath, (node) => ({ ...node, op: 'lt' })) && clone,
        });
      }
      if (op === 'lt') {
        mutants.push({
          id: `M-${rule.id}-LT_TO_GTE-${pathKey(condPath)}`,
          kind: 'rules',
          ruleId: rule.id,
          operator: 'LT_TO_GTE',
          description: `${rule.id}: leaf op 'lt' -> 'gte' on fact "${leaf.fact}" (condition path ${pathKey(condPath)})`,
          apply: (clone) => transformAt(clone[ruleIndex], condPath, (node) => ({ ...node, op: 'gte' })) && clone,
        });
      }
      if (typeof leaf.value === 'number') {
        mutants.push({
          id: `M-${rule.id}-NUMERIC_PERTURB_PLUS-${pathKey(condPath)}`,
          kind: 'rules',
          ruleId: rule.id,
          operator: 'NUMERIC_PERTURB_PLUS',
          description: `${rule.id}: leaf value ${leaf.value} -> ${leaf.value + 1} on fact "${leaf.fact}" (condition path ${pathKey(condPath)})`,
          apply: (clone) => transformAt(clone[ruleIndex], condPath, (node) => ({ ...node, value: node.value + 1 })) && clone,
        });
        mutants.push({
          id: `M-${rule.id}-NUMERIC_PERTURB_MINUS-${pathKey(condPath)}`,
          kind: 'rules',
          ruleId: rule.id,
          operator: 'NUMERIC_PERTURB_MINUS',
          description: `${rule.id}: leaf value ${leaf.value} -> ${leaf.value - 1} on fact "${leaf.fact}" (condition path ${pathKey(condPath)})`,
          apply: (clone) => transformAt(clone[ruleIndex], condPath, (node) => ({ ...node, value: node.value - 1 })) && clone,
        });
      }
    }

    for (const combi of walkCombinators(rule.when)) {
      if (combi.kind === 'all' && combi.length >= 2) {
        mutants.push({
          id: `M-${rule.id}-DELETE_CONDITION_FROM_ALL-${pathKey(combi.condPath)}`,
          kind: 'rules',
          ruleId: rule.id,
          operator: 'DELETE_CONDITION_FROM_ALL',
          description: `${rule.id}: drop the first condition from the 'all' block at ${pathKey(combi.condPath)}`,
          apply: (clone) => transformAt(clone[ruleIndex], combi.condPath, (node) => ({ ...node, all: node.all.slice(1) })) && clone,
        });
      }
      mutants.push({
        id: `M-${rule.id}-FLIP_ALL_ANY-${pathKey(combi.condPath)}`,
        kind: 'rules',
        ruleId: rule.id,
        operator: 'FLIP_ALL_ANY',
        description: `${rule.id}: combinator '${combi.kind}' -> '${combi.kind === 'all' ? 'any' : 'all'}' at ${pathKey(combi.condPath)}`,
        apply: (clone) => transformAt(clone[ruleIndex], combi.condPath, (node) => {
          const items = node[combi.kind];
          const flippedKey = combi.kind === 'all' ? 'any' : 'all';
          const { [combi.kind]: _dropped, ...rest } = node;
          return { ...rest, [flippedKey]: items };
        }) && clone,
      });
    }

    for (const { condPath } of walkNots(rule.when)) {
      mutants.push({
        id: `M-${rule.id}-NOT_REMOVE-${pathKey(condPath)}`,
        kind: 'rules',
        ruleId: rule.id,
        operator: 'NOT_REMOVE',
        description: `${rule.id}: remove the 'not' wrapper at ${pathKey(condPath)} (negation dropped)`,
        apply: (clone) => transformAt(clone[ruleIndex], condPath, (node) => node.not) && clone,
      });
    }

    mutants.push({
      id: `M-${rule.id}-DROP_OUTPUT`,
      kind: 'rules',
      ruleId: rule.id,
      operator: 'DROP_OUTPUT',
      description: `${rule.id}: replace output with {} (rule still matches, but emits nothing)`,
      apply: (clone) => { clone[ruleIndex].output = {}; return clone; },
    });

    if (rule.output?.type === 'alert') {
      const from = rule.output.severity;
      const to = SEVERITY_DOWNGRADE[from] ?? 'informational';
      mutants.push({
        id: `M-${rule.id}-FLIP_ALERT_SEVERITY`,
        kind: 'rules',
        ruleId: rule.id,
        operator: 'FLIP_ALERT_SEVERITY',
        description: `${rule.id}: alert severity '${from}' -> '${to}'`,
        apply: (clone) => { clone[ruleIndex].output = { ...clone[ruleIndex].output, severity: to }; return clone; },
      });
    }
  });

  return mutants;
}

// ---------------------------------------------------------------------------------------------
// Mutant enumeration -- facts.anemia.js / ranges.js. Hand-authored, exact-substring search/replace
// pairs against the numeric comparison boundaries these two files actually contain (grepped and
// line-verified against this worktree's HEAD 2026-07-21 -- see the task's own read of these files).
// Every `search` string is asserted unique-and-present at plan-build time (buildMutantPlan below)
// so a future edit to either file fails loudly here instead of silently degrading the mutant count.
// ---------------------------------------------------------------------------------------------

const FACTS_TEXT_MUTANTS = [
  {
    id: 'FACTS-01', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'stfrIndexHigh boundary 2 -> 3 (stfrFerritinIndex > 2)',
    search: 'const stfrIndexHigh = stfrFerritinIndex !== null ? stfrFerritinIndex > 2 : null;',
    replace: 'const stfrIndexHigh = stfrFerritinIndex !== null ? stfrFerritinIndex > 3 : null;',
  },
  {
    id: 'FACTS-02', file: FACTS_PATH, operator: 'FACTS_OPERATOR_FLIP',
    description: "stfrIndexHigh operator 'gt' -> 'gte' (stfrFerritinIndex > 2)",
    search: 'const stfrIndexHigh = stfrFerritinIndex !== null ? stfrFerritinIndex > 2 : null;',
    replace: 'const stfrIndexHigh = stfrFerritinIndex !== null ? stfrFerritinIndex >= 2 : null;',
  },
  {
    id: 'FACTS-03', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'stfrIndexLow boundary 1 -> 2 (stfrFerritinIndex < 1)',
    search: 'const stfrIndexLow = stfrFerritinIndex !== null ? stfrFerritinIndex < 1 : null;',
    replace: 'const stfrIndexLow = stfrFerritinIndex !== null ? stfrFerritinIndex < 2 : null;',
  },
  {
    id: 'FACTS-04', file: FACTS_PATH, operator: 'FACTS_OPERATOR_FLIP',
    description: "stfrIndexLow operator 'lt' -> 'lte' (stfrFerritinIndex < 1)",
    search: 'const stfrIndexLow = stfrFerritinIndex !== null ? stfrFerritinIndex < 1 : null;',
    replace: 'const stfrIndexLow = stfrFerritinIndex !== null ? stfrFerritinIndex <= 1 : null;',
  },
  {
    id: 'FACTS-05', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'stfrIndexIntermediate lower bound 1 -> 2',
    search: '? stfrFerritinIndex >= 1 && stfrFerritinIndex <= 2',
    replace: '? stfrFerritinIndex >= 2 && stfrFerritinIndex <= 2',
  },
  {
    id: 'FACTS-06', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'stfrIndexIntermediate upper bound 2 -> 3',
    search: '? stfrFerritinIndex >= 1 && stfrFerritinIndex <= 2',
    replace: '? stfrFerritinIndex >= 1 && stfrFerritinIndex <= 3',
  },
  {
    id: 'FACTS-07', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'hemolysisPattern marker-count threshold 2 -> 3',
    search: 'const hemolysisPattern = hemolysisMarkerCount >= 2;',
    replace: 'const hemolysisPattern = hemolysisMarkerCount >= 3;',
  },
  {
    id: 'FACTS-08', file: FACTS_PATH, operator: 'FACTS_OPERATOR_FLIP',
    description: "hemolysisPattern operator 'gte' -> 'gt' on marker-count threshold 2",
    search: 'const hemolysisPattern = hemolysisMarkerCount >= 2;',
    replace: 'const hemolysisPattern = hemolysisMarkerCount > 2;',
  },
  {
    id: 'FACTS-09', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'leadAtOrAboveReference boundary 3.5 -> 4.5 ug/dL',
    search: 'const leadAtOrAboveReference = bll !== null && bll >= 3.5;',
    replace: 'const leadAtOrAboveReference = bll !== null && bll >= 4.5;',
  },
  {
    id: 'FACTS-10', file: FACTS_PATH, operator: 'FACTS_OPERATOR_FLIP',
    description: "leadAtOrAboveReference operator 'gte' -> 'gt' on boundary 3.5",
    search: 'const leadAtOrAboveReference = bll !== null && bll >= 3.5;',
    replace: 'const leadAtOrAboveReference = bll !== null && bll > 3.5;',
  },
  {
    id: 'FACTS-11', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'lead20to44 lower bound 20 -> 21',
    search: 'const lead20to44 = bll !== null && bll >= 20 && bll < 45;',
    replace: 'const lead20to44 = bll !== null && bll >= 21 && bll < 45;',
  },
  {
    id: 'FACTS-12', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'lead20to44 upper bound 45 -> 46',
    search: 'const lead20to44 = bll !== null && bll >= 20 && bll < 45;',
    replace: 'const lead20to44 = bll !== null && bll >= 20 && bll < 46;',
  },
  {
    id: 'FACTS-13', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'lead45Plus boundary 45 -> 46',
    search: 'const lead45Plus = bll !== null && bll >= 45;',
    replace: 'const lead45Plus = bll !== null && bll >= 46;',
  },
  {
    id: 'FACTS-14', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'severeIdaHbCategory boundary hb<7 -> hb<8',
    search: "const severeIdaHbCategory = anemiaStatus === 'present' && hb !== null && hb < 7;",
    replace: "const severeIdaHbCategory = anemiaStatus === 'present' && hb !== null && hb < 8;",
  },
  {
    id: 'FACTS-15', file: FACTS_PATH, operator: 'FACTS_OPERATOR_FLIP',
    description: "severeIdaHbCategory operator 'lt' -> 'lte' on hb<7",
    search: "const severeIdaHbCategory = anemiaStatus === 'present' && hb !== null && hb < 7;",
    replace: "const severeIdaHbCategory = anemiaStatus === 'present' && hb !== null && hb <= 7;",
  },
  {
    id: 'FACTS-16', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'hbModerateIdaCategory lower bound 7 -> 8',
    search: "const hbModerateIdaCategory = anemiaStatus === 'present' && hb !== null && hb >= 7 && hb < 9;",
    replace: "const hbModerateIdaCategory = anemiaStatus === 'present' && hb !== null && hb >= 8 && hb < 9;",
  },
  {
    id: 'FACTS-17', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'hbModerateIdaCategory upper bound 9 -> 10',
    search: "const hbModerateIdaCategory = anemiaStatus === 'present' && hb !== null && hb >= 7 && hb < 9;",
    replace: "const hbModerateIdaCategory = anemiaStatus === 'present' && hb !== null && hb >= 7 && hb < 10;",
  },
  {
    id: 'FACTS-18', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'hbMildIdaCategory boundary 9 -> 10',
    search: "const hbMildIdaCategory = anemiaStatus === 'present' && hb !== null && hb >= 9;",
    replace: "const hbMildIdaCategory = anemiaStatus === 'present' && hb !== null && hb >= 10;",
  },
  {
    id: 'FACTS-19', file: FACTS_PATH, operator: 'FACTS_OPERATOR_FLIP',
    description: "hbMildIdaCategory operator 'gte' -> 'gt' on hb>=9",
    search: "const hbMildIdaCategory = anemiaStatus === 'present' && hb !== null && hb >= 9;",
    replace: "const hbMildIdaCategory = anemiaStatus === 'present' && hb !== null && hb > 9;",
  },
  {
    id: 'FACTS-20', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'ageCompatibleWithTec lower bound 6 -> 7 months',
    search: 'const ageCompatibleWithTec = ageMonths !== null && ageMonths >= 6 && ageMonths < 72;',
    replace: 'const ageCompatibleWithTec = ageMonths !== null && ageMonths >= 7 && ageMonths < 72;',
  },
  {
    id: 'FACTS-21', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'ageCompatibleWithTec upper bound 72 -> 73 months',
    search: 'const ageCompatibleWithTec = ageMonths !== null && ageMonths >= 6 && ageMonths < 72;',
    replace: 'const ageCompatibleWithTec = ageMonths !== null && ageMonths >= 6 && ageMonths < 73;',
  },
  {
    id: 'FACTS-22', file: FACTS_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'ageCompatibleWithDba boundary 12 -> 13 months',
    search: 'const ageCompatibleWithDba = ageMonths !== null && ageMonths < 12;',
    replace: 'const ageCompatibleWithDba = ageMonths !== null && ageMonths < 13;',
  },
  {
    id: 'FACTS-23', file: FACTS_PATH, operator: 'FACTS_OPERATOR_FLIP',
    description: "ageCompatibleWithDba operator 'lt' -> 'lte' on ageMonths<12",
    search: 'const ageCompatibleWithDba = ageMonths !== null && ageMonths < 12;',
    replace: 'const ageCompatibleWithDba = ageMonths !== null && ageMonths <= 12;',
  },
];

const RANGES_TEXT_MUTANTS = [
  {
    id: 'RANGES-01', file: RANGES_PATH, operator: 'FACTS_BOOLEAN_NEGATE',
    description: "ferritinThresholdRule: negate the menstruating tri-state check ('true' -> 'false')",
    search: "if (toTri(menstruating) === 'true') {",
    replace: "if (toTri(menstruating) === 'false') {",
  },
  {
    id: 'RANGES-02', file: RANGES_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'ferritinThresholdRule adolescent band lower bound 144 -> 145 months',
    search: 'if (ageMonths >= 144 && ageMonths < 216) {',
    replace: 'if (ageMonths >= 145 && ageMonths < 216) {',
  },
  {
    id: 'RANGES-03', file: RANGES_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'ferritinThresholdRule adolescent band upper bound 216 -> 217 months',
    search: 'if (ageMonths >= 144 && ageMonths < 216) {',
    replace: 'if (ageMonths >= 144 && ageMonths < 217) {',
  },
  {
    id: 'RANGES-04', file: RANGES_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'ferritinThresholdRule young/school band lower bound 6 -> 7 months',
    search: 'if (ageMonths >= 6 && ageMonths < 144) {',
    replace: 'if (ageMonths >= 7 && ageMonths < 144) {',
  },
  {
    id: 'RANGES-05', file: RANGES_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'ferritinThresholdRule young/school band upper bound 144 -> 145 months',
    search: 'if (ageMonths >= 6 && ageMonths < 144) {',
    replace: 'if (ageMonths >= 6 && ageMonths < 145) {',
  },
  {
    id: 'RANGES-06', file: RANGES_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'ferritinThresholdRule menstruating threshold value 30 -> 31 ng/mL',
    search: "return { value: 30, source: 'AAP2026_IDA', rationale: 'all menstruating patients' };",
    replace: "return { value: 31, source: 'AAP2026_IDA', rationale: 'all menstruating patients' };",
  },
  {
    id: 'RANGES-07', file: RANGES_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'ferritinThresholdRule adolescent threshold value 30 -> 31 ng/mL',
    search: "return { value: 30, source: 'AAP2026_IDA', rationale: 'adolescent age band' };",
    replace: "return { value: 31, source: 'AAP2026_IDA', rationale: 'adolescent age band' };",
  },
  {
    id: 'RANGES-08', file: RANGES_PATH, operator: 'FACTS_NUMERIC_PERTURB',
    description: 'ferritinThresholdRule young/school threshold value 20 -> 21 ng/mL',
    search: "return { value: 20, source: 'AAP2026_IDA', rationale: 'young or school-aged child' };",
    replace: "return { value: 21, source: 'AAP2026_IDA', rationale: 'young or school-aged child' };",
  },
];

// ---------------------------------------------------------------------------------------------
// Anti-vacuity controls (ANTI-VACUITY section of the task brief): excluded from the main score,
// reported separately, and asserted by tests/mutation.test.mjs on every run. Neither is drawn from
// the generic enumeration above -- both are hand-picked so their expected classification can be
// justified structurally, not just observed.
// ---------------------------------------------------------------------------------------------

// CTRL-LETHAL: ALERT-001 ("Potentially unstable symptomatic anemia", severity emergency) is one of
// the 9 rules tests/witness/alerts.test.mjs exists specifically to hold to a higher bar than
// matchedRuleIds (see that file's own header) -- it asserts the actual `result.alerts` entry and
// its severity. Dropping ALERT-001's output leaves `matched: true` in the audit trail (runRules()
// still records the leaf as matched) but pushes no alert at all, which assertAlertWitnessed()
// (tests/witness/alerts.test.mjs) must catch. This MUST be killed, or the harness itself is not
// wired to the victim command correctly.
const CONTROL_LETHAL = {
  id: 'CTRL-LETHAL-ALERT-001-DROP_OUTPUT',
  kind: 'rules',
  ruleId: 'ALERT-001',
  operator: 'DROP_OUTPUT',
  control: 'lethal',
  description: "ALERT-001 ('Potentially unstable symptomatic anemia', emergency): output dropped to {} -- must be killed by tests/witness/alerts.test.mjs's explicit result.alerts assertion",
  apply: (clone) => {
    const rule = clone.find((r) => r.id === 'ALERT-001');
    if (!rule) throw new Error('CTRL-LETHAL: ALERT-001 not found in rules.json -- control mutant is stale');
    rule.output = {};
    return clone;
  },
};

// CTRL-INERT: `changeRationale` is free-text governance provenance (see docs/architecture.md §7
// and src/governance.js's own header on the 9 governance fields). grep-verified (2026-07-21):
// evaluateCondition()/runRules() (src/ruleEngine.js) never reference it, and assess()'s
// provenance.ruleAudit (src/engine.js) only attaches sourcePassageStatus/hasCredentialedClinical
// Approval/isActive, which src/governance.js computes from version/effectiveDate/owner/
// safetyClass/sourcePassageId/retireDate/clinicalApprovers/requiredTestCaseIds -- changeRationale
// is not among them. Editing it can never change assess() output, matchedRuleIds, alerts,
// candidates, or any test assertion in this repo. This MUST be classified non-viable (dead
// config), or the non-viability detector is not actually checking anything.
const CONTROL_INERT = {
  id: 'CTRL-INERT-SCOPE-001-CHANGE-RATIONALE',
  kind: 'rules',
  ruleId: 'SCOPE-001',
  operator: 'DEAD_CONFIG_EDIT',
  control: 'inert',
  deadConfig: true,
  description: "SCOPE-001: changeRationale free-text edited -- provably never read by evaluateCondition()/runRules()/assess() (src/ruleEngine.js, src/engine.js, src/governance.js), so must be classified non-viable",
  apply: (clone) => {
    const rule = clone.find((r) => r.id === 'SCOPE-001');
    if (!rule) throw new Error('CTRL-INERT: SCOPE-001 not found in rules.json -- control mutant is stale');
    rule.changeRationale = `${rule.changeRationale} [CTRL-INERT mutation marker -- must never affect assess() output]`;
    return clone;
  },
};

// ---------------------------------------------------------------------------------------------
// Plan assembly + viability classification (pure, in-memory, no I/O beyond the three KB reads).
// ---------------------------------------------------------------------------------------------

export async function buildMutantPlan() {
  const [rulesRaw, factsSource, rangesSource] = await Promise.all([
    readFile(RULES_PATH, 'utf8'),
    readFile(FACTS_PATH, 'utf8'),
    readFile(RANGES_PATH, 'utf8'),
  ]);
  const rules = JSON.parse(rulesRaw);
  const originalNormalized = normalize(rules);
  const sources = { [FACTS_PATH]: factsSource, [RANGES_PATH]: rangesSource };

  const ruleMutants = enumerateRuleMutants(rules).map((m) => ({ ...m, file: RULES_PATH }));
  const textMutants = [...FACTS_TEXT_MUTANTS, ...RANGES_TEXT_MUTANTS];
  const controls = [CONTROL_LETHAL, CONTROL_INERT].map((m) => ({ ...m, file: RULES_PATH }));

  // Fail loudly, at plan-build time, if a hand-authored search pattern is not exactly
  // once-present -- silently matching zero or multiple times would either produce a phantom
  // no-op mutant (mis-scored as non-viable for the wrong reason) or mutate the wrong occurrence.
  for (const m of textMutants) {
    const source = sources[m.file];
    const occurrences = source.split(m.search).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `mutation plan build failed: pattern for ${m.id} occurs ${occurrences} time(s) in `
        + `${path.relative(REPO_ROOT, m.file)} (expected exactly 1). Source drifted -- update the `
        + 'mutant definition in scripts/mutation-run.mjs.',
      );
    }
  }

  function classify(mutant) {
    if (mutant.kind === 'rules') {
      const mutated = mutant.apply(cloneRules(rules));
      const mutatedNormalized = normalize(mutated);
      if (mutant.deadConfig) {
        return { viable: false, reason: 'dead-config (see CONTROL_INERT justification comment)', content: mutatedNormalized };
      }
      if (mutatedNormalized === originalNormalized) {
        return { viable: false, reason: 'byte-identical after mutation (no-op transform)', content: mutatedNormalized };
      }
      return { viable: true, content: mutatedNormalized };
    }
    // text mutant (facts/ranges)
    const source = sources[mutant.file];
    const mutatedContent = source.replace(mutant.search, mutant.replace);
    if (mutatedContent === source) {
      return { viable: false, reason: 'byte-identical after mutation (pattern not found)', content: mutatedContent };
    }
    return { viable: true, content: mutatedContent };
  }

  const all = [...ruleMutants, ...textMutants, ...controls].map((m) => ({ ...m, ...classify(m) }));
  return { all, rules, rulesRaw, factsSource, rangesSource };
}

// Exported so tests/mutation.test.mjs can build the {absolutePath: pristineContent} map that
// runMutantsWithPool()/runViableMutant() needs to restore each sandbox file after every mutant,
// without duplicating this module's internal path constants.
export const REPO_PATHS = Object.freeze({ RULES_PATH, FACTS_PATH, RANGES_PATH });

/** At most 2 mutants per operator (sorted by id, stable), plus both controls -- see the module
 * header's non-viability section for why the smoke subset is a bounded structural selection
 * rather than a hand-typed id list: ids are derived from rules.json's actual content, never
 * guessed. */
export function selectSmokeSubset(plan) {
  const nonControl = plan.filter((m) => !m.control).sort((a, b) => a.id.localeCompare(b.id));
  const byOperator = new Map();
  for (const m of nonControl) {
    const bucket = byOperator.get(m.operator) ?? [];
    if (bucket.length < 2) {
      bucket.push(m);
      byOperator.set(m.operator, bucket);
    }
  }
  const controls = plan.filter((m) => m.control);
  return [...[...byOperator.values()].flat(), ...controls].sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------------------------
// Sandbox pool + victim-test execution.
// ---------------------------------------------------------------------------------------------

async function makeSandbox() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ep6-mutation-'));
  await Promise.all(SANDBOX_ENTRIES.map(async (entry) => {
    const src = path.join(REPO_ROOT, entry);
    const dest = path.join(dir, entry);
    await cp(src, dest, { recursive: true });
  }));
  return dir;
}

export async function createSandboxPool(size) {
  return Promise.all(Array.from({ length: size }, () => makeSandbox()));
}

export async function cleanupSandboxPool(pool) {
  await Promise.all(pool.map((dir) => rm(dir, { recursive: true, force: true })));
}

function sandboxRelativePath(absoluteRepoPath) {
  return path.relative(REPO_ROOT, absoluteRepoPath);
}

// When THIS module is itself invoked from inside `node --test` (exactly what
// tests/mutation.test.mjs does), the parent test runner sets NODE_TEST_CONTEXT=child-v8 in the
// process environment. execFile() inherits the parent's env by default, so the victim-command
// child would inherit that var too -- and Node's test runner treats its presence as "this is a
// recursive nested --test invocation" and SILENTLY SKIPS running any files at all, exiting 0 with
// empty output (`node:test run() is being called recursively within a test file. skipping running
// files.` on stderr). That makes every single mutant look "not killed" for a reason that has
// nothing to do with mutation or test quality -- caught only by manually diffing a standalone run
// against a run launched from inside tests/mutation.test.mjs (see this file's git history).
// Stripping the var from the child's env is what makes the victim command actually execute.
const VICTIM_COMMAND_ENV = { ...process.env };
delete VICTIM_COMMAND_ENV.NODE_TEST_CONTEXT;

async function runVictimCommand(sandboxDir) {
  try {
    await execFileAsync(process.execPath, ['--test', ...VICTIM_TEST_FILES], {
      cwd: sandboxDir, timeout: 30_000, env: VICTIM_COMMAND_ENV,
    });
    return { killed: false, exitCode: 0 };
  } catch (error) {
    return { killed: true, exitCode: error.code ?? 1, signal: error.signal ?? null };
  }
}

/** Runs a single already-classified-viable mutant inside `sandboxDir`, then restores the
 * sandbox's copy of the mutated file to pristine before returning, so the sandbox is always clean
 * for whichever mutant the pool assigns to it next. */
async function runViableMutant(mutant, sandboxDir, originalContentByFile) {
  const relPath = sandboxRelativePath(mutant.file);
  const sandboxFilePath = path.join(sandboxDir, relPath);
  await writeFile(sandboxFilePath, mutant.content, 'utf8');
  const result = await runVictimCommand(sandboxDir);
  await writeFile(sandboxFilePath, originalContentByFile[mutant.file], 'utf8');
  return result;
}

/** Runs every viable mutant in `mutants` across a bounded sandbox pool, returning a new array of
 * mutants annotated with {killed, exitCode}. Non-viable mutants pass through untouched (no
 * subprocess spawned for them at all). */
/**
 * Sandbox-fidelity self-check: runs the victim command against a freshly-built, UNMUTATED
 * sandbox and throws if it fails. Without this, an incomplete SANDBOX_ENTRIES list (missing a
 * file some victim test reads outside the copied subset) makes the pristine baseline itself
 * fail -- and every subsequent mutant would then be misreported as "killed" for a reason that has
 * nothing to do with the mutation. This is the single most dangerous failure mode this runner
 * could have (a mutation score of 100% that is actually measuring a broken sandbox, not test
 * quality), so it is checked before a single mutant runs rather than trusted.
 */
async function verifySandboxFidelity(sandboxDir) {
  const result = await runVictimCommand(sandboxDir);
  if (result.killed) {
    throw new Error(
      'mutation runner sandbox-fidelity self-check FAILED: the victim test command failed against '
      + `an UNMUTATED sandbox copy (${sandboxDir}). This means SANDBOX_ENTRIES is missing a file `
      + 'or directory one of VICTIM_TEST_FILES reads, so every mutant would be scored "killed" for '
      + 'the wrong reason. Fix SANDBOX_ENTRIES in scripts/mutation-run.mjs (re-run the failing test '
      + 'directly inside the sandbox dir to find the missing path) before trusting any score from '
      + 'this run.',
    );
  }
}

export async function runMutantsWithPool(mutants, poolSize, originalContentByFile) {
  const pool = await createSandboxPool(poolSize);
  try {
    await verifySandboxFidelity(pool[0]);
    const viable = mutants.filter((m) => m.viable);
    const results = new Map();
    let cursor = 0;
    async function worker(sandboxDir) {
      while (cursor < viable.length) {
        const mutant = viable[cursor];
        cursor += 1;
        const result = await runViableMutant(mutant, sandboxDir, originalContentByFile);
        results.set(mutant.id, result);
      }
    }
    await Promise.all(pool.map((dir) => worker(dir)));
    return mutants.map((m) => (results.has(m.id) ? { ...m, ...results.get(m.id) } : m));
  } finally {
    await cleanupSandboxPool(pool);
  }
}

// ---------------------------------------------------------------------------------------------
// Report assembly.
// ---------------------------------------------------------------------------------------------

function summarize(mutantsWithResults) {
  const nonControl = mutantsWithResults.filter((m) => !m.control);
  const viable = nonControl.filter((m) => m.viable);
  const nonViable = nonControl.filter((m) => !m.viable);
  const killed = viable.filter((m) => m.killed);
  const survived = viable.filter((m) => !m.killed);
  const score = viable.length > 0 ? killed.length / viable.length : null;

  const operatorInventory = {};
  for (const m of nonControl) {
    operatorInventory[m.operator] = (operatorInventory[m.operator] ?? 0) + 1;
  }

  return {
    total: nonControl.length,
    viableTotal: viable.length,
    nonViableTotal: nonViable.length,
    killedTotal: killed.length,
    survivedTotal: survived.length,
    score,
    operatorInventory,
    excluded: nonViable.map((m) => ({ id: m.id, file: sandboxRelativePath(m.file), operator: m.operator, ruleId: m.ruleId ?? null, reason: m.reason })),
    survivors: survived.map((m) => ({ id: m.id, file: sandboxRelativePath(m.file), ruleId: m.ruleId ?? null, operator: m.operator, description: m.description })),
  };
}

function summarizeControls(mutantsWithResults) {
  const lethal = mutantsWithResults.find((m) => m.control === 'lethal');
  const inert = mutantsWithResults.find((m) => m.control === 'inert');
  return {
    lethal: {
      id: lethal.id,
      description: lethal.description,
      expected: 'killed',
      viable: lethal.viable,
      killed: lethal.killed ?? null,
      pass: lethal.viable === true && lethal.killed === true,
    },
    inert: {
      id: inert.id,
      description: inert.description,
      expected: 'non-viable',
      viable: inert.viable,
      reason: inert.reason ?? null,
      pass: inert.viable === false,
    },
  };
}

export async function computeFullReport({ poolSize } = {}) {
  const { all, factsSource, rangesSource } = await buildMutantPlan();
  const originalContentByFile = { [RULES_PATH]: await readFile(RULES_PATH, 'utf8'), [FACTS_PATH]: factsSource, [RANGES_PATH]: rangesSource };
  const withResults = await runMutantsWithPool(all, poolSize ?? Math.max(1, Math.min(8, os.cpus().length - 2)), originalContentByFile);
  const smokeIds = new Set(selectSmokeSubset(all).map((m) => m.id));
  const manifest = JSON.parse(await readFile(MODULE_MANIFEST_PATH, 'utf8'));

  return {
    measuredAt: null, // stamped by main() -- Date.now() is unavailable inside this pure function by design
    kbVersion: manifest.knowledgeBaseVersion,
    // HONESTY BOUNDARY (EP-6, D-4). A score of 1.0 means "every mutant THIS RUNNER'S OPERATOR SET
    // generates is killed by the victim suite". It does NOT mean the engine is defect-free, the
    // knowledge base is clinically correct, or the rules are validated. The operator set is a
    // finite, hand-enumerated list (see operatorInventory) over rules.json / facts.anemia.js /
    // ranges.js; defect classes outside it are unmeasured by construction, and no mutation score
    // is evidence of clinical validity. This project's status remains: unvalidated research
    // prototype. Automated checks prove software behavior, never clinical safety.
    scopeNote: 'Mutation score = killed / viable mutants from this runner\'s finite hand-enumerated '
      + 'operator set over rules.json, facts.anemia.js and ranges.js. It measures TEST-SUITE KILL '
      + 'COVERAGE ONLY. It is not evidence of clinical validity, diagnostic performance, KB '
      + 'correctness, or regulatory status, and defect classes outside operatorInventory are '
      + 'unmeasured by construction.',
    victimTestCommand: `node --test ${VICTIM_TEST_FILES.join(' ')}`,
    victimTestFiles: VICTIM_TEST_FILES,
    ...summarize(withResults),
    controls: summarizeControls(withResults),
    smokeSubset: withResults
      .filter((m) => smokeIds.has(m.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((m) => ({
        id: m.id, file: sandboxRelativePath(m.file), operator: m.operator, ruleId: m.ruleId ?? null,
        control: m.control ?? null, viable: m.viable, killed: m.killed ?? null,
      })),
  };
}

// ---------------------------------------------------------------------------------------------
// CLI entrypoint -- the ONLY place this module writes to the real repo working tree, and it
// writes exactly one file: tests/mutation-baseline.json.
// ---------------------------------------------------------------------------------------------

async function main() {
  const startedAt = new Date().toISOString();
  console.log('EP6-T3 mutation run starting (full exhaustive plan)...');
  const report = await computeFullReport();
  report.measuredAt = startedAt;

  console.log(`Mutants: ${report.total} total, ${report.viableTotal} viable, ${report.nonViableTotal} excluded (non-viable)`);
  console.log(`Killed: ${report.killedTotal} / ${report.viableTotal} viable -> score = ${report.score}`);
  console.log(`Controls: lethal pass=${report.controls.lethal.pass}, inert pass=${report.controls.inert.pass}`);
  if (report.survivors.length > 0) {
    console.log(`\n${report.survivors.length} surviving mutant(s) -- gaps in the test suite's kill coverage:`);
    for (const s of report.survivors) console.log(`  - ${s.id} (${s.file}): ${s.description}`);
  }

  await writeFile(BASELINE_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`\nBaseline written to ${sandboxRelativePath(BASELINE_PATH)}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
