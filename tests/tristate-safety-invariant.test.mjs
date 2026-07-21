/**
 * EP1-T6 tri-state safety invariant.
 *
 * This proves, for every Tri-valued fact path referenced by the live anemia rules, that:
 * - the migration surface is still 45 fact paths across 49 rules and is discovered from
 *   deriveFacts({}), rather than copied into a hand-maintained path list;
 * - every Tri leaf uses an explicit Tri operator;
 * - `is-absent` never appears anywhere beneath a `not`, where later restructuring could make
 *   unknown satisfy an effective branch; and
 * - every activated Tri rule is probed with every non-empty subset of its referenced Tri facts
 *   changed jointly to unknown, where it may not emit an executable adverse differential
 *   contribution (a matched candidate with negative points/score).
 *
 * This does not prove clinical validity, threshold correctness, upstream aggregate correctness,
 * missing-question coverage, or the out-of-scope statusIs()/hemolysis missingness semantics. The
 * current engine is additive-only: it has no rule-out output type or clearing tag, so this test
 * cannot infer exclusion semantics from clinical prose. In particular, it does not prove the
 * deferred NCR-1/NCR-2 tightening for TEC-001/IRIDA-001: their behavior-preserving
 * `not: { is-present }` gates intentionally remain capable of matching an unknown fact until
 * council-reviewed follow-up work requires confirmed absence.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { deriveFacts } from '../src/facts.js';
import { toTri } from '../src/facts/tristate.js';
import { evaluateCondition, runRules } from '../src/ruleEngine.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_PATH = path.join(ROOT, 'modules', 'anemia', 'rules.json');
const TRI_VALUES = new Set(['true', 'false', 'unknown']);
const TRI_OPERATORS = new Set(['is-present', 'is-absent', 'is-unknown', 'is-not-assessed']);
const MAX_EXHAUSTIVE_TRI_PATHS = 12;
const rules = JSON.parse(await readFile(RULES_PATH, 'utf8'));

function getPath(object, factPath) {
  return String(factPath)
    .split('.')
    .reduce((value, key) => (value === null || value === undefined ? undefined : value[key]), object);
}

function setPath(object, factPath, value) {
  const keys = String(factPath).split('.');
  let current = object;
  for (const key of keys.slice(0, -1)) {
    if (!current[key] || typeof current[key] !== 'object') current[key] = {};
    current = current[key];
  }
  current[keys.at(-1)] = value;
  return object;
}

function collectLeaves(condition, context, leaves = []) {
  if (Array.isArray(condition?.all)) {
    condition.all.forEach((child, index) => collectLeaves(
      child,
      { ...context, location: `${context.location}.all[${index}]` },
      leaves,
    ));
    return leaves;
  }
  if (Array.isArray(condition?.any)) {
    condition.any.forEach((child, index) => collectLeaves(
      child,
      { ...context, location: `${context.location}.any[${index}]` },
      leaves,
    ));
    return leaves;
  }
  if (condition?.not) {
    collectLeaves(
      condition.not,
      {
        ...context,
        notDepth: context.notDepth + 1,
        location: `${context.location}.not`,
      },
      leaves,
    );
    return leaves;
  }
  if (typeof condition?.fact === 'string') leaves.push({ ...context, leaf: condition });
  return leaves;
}

function ruleLeaves(rule) {
  return collectLeaves(rule.when, { rule, notDepth: 0, location: 'when' });
}

function nonEmptySubsets(values) {
  const subsets = [];
  for (let mask = 1; mask < 2 ** values.length; mask += 1) {
    subsets.push(values.filter((_, index) => mask & (2 ** index)));
  }
  return subsets;
}

async function collectJsonFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectJsonFiles(entryPath));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(entryPath);
  }
  return files.sort();
}

async function activationWitnessesFor(targetRules) {
  const files = [
    ...await collectJsonFiles(path.join(ROOT, 'examples')),
    ...await collectJsonFiles(path.join(ROOT, 'tests', 'witness')),
  ].sort();
  const witnesses = new Map();

  for (const file of files) {
    const input = JSON.parse(await readFile(file, 'utf8'));
    const facts = deriveFacts(input);
    for (const rule of targetRules) {
      if (!witnesses.has(rule.id) && evaluateCondition(rule.when, facts)) {
        witnesses.set(rule.id, { facts, file });
      }
    }
  }
  return witnesses;
}

function analyzeTriSafety(targetRules, witnesses, { pinLiveScope = false } = {}) {
  const emptyFacts = deriveFacts({});
  const allLeaves = targetRules.flatMap(ruleLeaves);
  const referencedPaths = new Set(allLeaves.map(({ leaf }) => leaf.fact));
  const triPaths = new Set(
    [...referencedPaths].filter((factPath) => TRI_VALUES.has(getPath(emptyFacts, factPath))),
  );
  const triLeaves = allLeaves.filter(({ leaf }) => triPaths.has(leaf.fact));
  const triRules = targetRules.filter((rule) => ruleLeaves(rule).some(({ leaf }) => triPaths.has(leaf.fact)));
  const violations = [];
  let unknownLeafProbeCount = 0;

  if (pinLiveScope && triPaths.size !== 45) {
    violations.push(`Tri migration scope changed: expected 45 referenced paths, found ${triPaths.size}`);
  }
  if (pinLiveScope && triRules.length !== 49) {
    violations.push(`Tri migration scope changed: expected 49 rules, found ${triRules.length}`);
  }

  for (const { rule, leaf, notDepth, location } of triLeaves) {
    if (!TRI_OPERATORS.has(leaf.op)) {
      violations.push(`${rule.id} ${location}: Tri fact ${leaf.fact} uses non-Tri operator ${leaf.op}`);
    }
    if (notDepth > 0 && leaf.op === 'is-absent') {
      violations.push(
        `${rule.id} ${location}: Tri fact ${leaf.fact} uses is-absent beneath not`,
      );
    }

    unknownLeafProbeCount += 1;
    const unknownOnlyFacts = setPath({}, leaf.fact, 'unknown');
    const leafMatched = evaluateCondition(leaf, unknownOnlyFacts);
    if ((leaf.op === 'is-present' || leaf.op === 'is-absent') && leafMatched) {
      violations.push(`${rule.id} ${location}: ${leaf.op} matched unknown ${leaf.fact}`);
    }

    const effectiveLiteral = notDepth % 2 === 1 ? { not: leaf } : leaf;
    const effectiveLiteralMatched = evaluateCondition(effectiveLiteral, unknownOnlyFacts);
    const witness = witnesses.get(rule.id);
    if (
      effectiveLiteralMatched
      && witness
      && rule.output?.type === 'candidate'
      && Number(rule.output.points) < 0
    ) {
      const witnessFacts = setPath(structuredClone(witness.facts), leaf.fact, 'unknown');
      const result = runRules(witnessFacts, [rule]);
      const ruleMatched = result.audit.some((entry) => entry.ruleId === rule.id && entry.matched);
      if (ruleMatched) {
        violations.push(
          `${rule.id} ${location}: unknown ${leaf.fact} satisfies an effective literal in a matched negative-point candidate rule`,
        );
      }
    }
  }

  const missingWitnesses = triRules.filter((rule) => !witnesses.has(rule.id)).map((rule) => rule.id);
  if (missingWitnesses.length > 0) {
    violations.push(`Tri rules without activation witnesses: ${missingWitnesses.join(', ')}`);
  }

  let behavioralProbeCount = 0;
  for (const rule of triRules) {
    const witness = witnesses.get(rule.id);
    if (!witness) continue;
    const referencedTriPaths = [...new Set(
      ruleLeaves(rule).map(({ leaf }) => leaf.fact).filter((factPath) => triPaths.has(factPath)),
    )].sort();
    if (referencedTriPaths.length > MAX_EXHAUSTIVE_TRI_PATHS) {
      violations.push(
        `${rule.id}: ${referencedTriPaths.length} Tri paths exceed the exhaustive-probe maximum of ${MAX_EXHAUSTIVE_TRI_PATHS}`,
      );
      continue;
    }
    for (const factPathSubset of nonEmptySubsets(referencedTriPaths)) {
      behavioralProbeCount += 1;
      const facts = structuredClone(witness.facts);
      for (const factPath of factPathSubset) setPath(facts, factPath, 'unknown');
      const result = runRules(facts, [rule]);
      const matched = result.audit.some((entry) => entry.ruleId === rule.id && entry.matched);
      const adverseCandidates = result.candidates.filter((candidate) => candidate.score < 0);
      if (
        matched
        && rule.output?.type === 'candidate'
        && Number(rule.output.points) < 0
        && adverseCandidates.length > 0
      ) {
        const unknownLabel = factPathSubset.length === 1
          ? factPathSubset[0]
          : `subset [${factPathSubset.join(', ')}]`;
        violations.push(
          `${rule.id}: unknown ${unknownLabel} emitted adverse candidate score ${adverseCandidates[0].score}`,
        );
      }
    }
  }

  return {
    behavioralProbeCount,
    triLeaves,
    triPaths,
    triRules,
    unknownLeafProbeCount,
    violations,
  };
}

test('Tri rule surface obeys the structural and behavioral safety invariant', async () => {
  const emptyFacts = deriveFacts({});
  const referencedPaths = new Set(rules.flatMap(ruleLeaves).map(({ leaf }) => leaf.fact));
  const runtimeTriPaths = new Set(
    [...referencedPaths].filter((factPath) => TRI_VALUES.has(getPath(emptyFacts, factPath))),
  );
  const operatorTriPaths = new Set(
    rules
      .flatMap(ruleLeaves)
      .filter(({ leaf }) => TRI_OPERATORS.has(leaf.op))
      .map(({ leaf }) => leaf.fact),
  );

  assert.deepEqual(
    [...operatorTriPaths].sort(),
    [...runtimeTriPaths].sort(),
    'runtime-derived Tri paths and explicit-Tri-operator paths must stay in lockstep',
  );

  const witnesses = await activationWitnessesFor(rules);
  const analysis = analyzeTriSafety(rules, witnesses, { pinLiveScope: true });
  assert.ok(analysis.unknownLeafProbeCount > 0, 'operator arm must execute at least one unknown leaf probe');
  assert.equal(
    analysis.unknownLeafProbeCount,
    analysis.triLeaves.length,
    'operator arm must evaluate every Tri leaf with an unknown-only fact set',
  );
  assert.ok(analysis.behavioralProbeCount > 0, 'behavioral arm must execute at least one unknown probe');
  assert.deepEqual(analysis.violations, []);
});

test('unknown is neither present nor absent, and all absence spellings normalize to unknown', () => {
  assert.equal(evaluateCondition({ fact: 'value', op: 'is-present' }, { value: 'unknown' }), false);
  assert.equal(evaluateCondition({ fact: 'value', op: 'is-absent' }, { value: 'unknown' }), false);

  for (const value of [undefined, null, '']) {
    assert.equal(toTri(value), 'unknown');
  }
});

test('negative control proves structural and behavioral detectors fail on an unsafe rule', () => {
  const unsafeRule = {
    id: 'SYNTHETIC-UNSAFE-CLEARING',
    // D-4 (reviewer gate, fifth pass): the runtime guard now requires an EXPLICIT empty
    // clinicalApprovers[] on every evaluated rule — absence is no longer evaluable, because an
    // absent field is not the same statement as "nobody has approved this".
    clinicalApprovers: [],
    when: { not: { fact: 'history.pica', op: 'is-absent' } },
    output: {
      type: 'candidate',
      candidateId: 'synthetic-cleared-differential',
      level: 'possible',
      points: -1,
      support: ['Synthetic negative control only.'],
    },
  };
  const witnesses = new Map([
    [unsafeRule.id, { facts: deriveFacts({ history: { pica: 'true' } }), file: 'synthetic' }],
  ]);
  const analysis = analyzeTriSafety([unsafeRule], witnesses);

  assert.ok(
    analysis.violations.some((violation) => /is-absent beneath not/.test(violation)),
    `structural detector did not catch the negative control: ${analysis.violations.join('; ')}`,
  );
  assert.ok(
    analysis.violations.some((violation) => /satisfies an effective literal in a matched negative-point candidate rule/.test(violation)),
    `effective-literal detector did not catch the negative control: ${analysis.violations.join('; ')}`,
  );
  assert.ok(
    analysis.violations.some((violation) => /unknown history\.pica emitted adverse candidate score -1/.test(violation)),
    `behavioral detector did not catch the negative control: ${analysis.violations.join('; ')}`,
  );
});

test('compound negative control catches adverse behavior that requires multiple unknown facts', () => {
  const unsafeCompoundRule = {
    clinicalApprovers: [], // see the note on unsafeRule above
    id: 'SYNTHETIC-UNSAFE-COMPOUND-CLEARING',
    when: {
      any: [
        {
          all: [
            { fact: 'history.pica', op: 'is-present' },
            { fact: 'history.leadExposureRisk', op: 'is-present' },
          ],
        },
        {
          all: [
            { not: { fact: 'history.pica', op: 'is-present' } },
            { not: { fact: 'history.leadExposureRisk', op: 'is-present' } },
          ],
        },
      ],
    },
    output: {
      type: 'candidate',
      candidateId: 'synthetic-compound-cleared-differential',
      level: 'possible',
      points: -1,
      support: ['Synthetic compound negative control only.'],
    },
  };
  const witnessFacts = deriveFacts({
    history: { pica: 'true', leadExposureRisk: 'true' },
  });
  assert.equal(
    evaluateCondition(unsafeCompoundRule.when, witnessFacts),
    true,
    'compound control witness must activate with both facts present',
  );

  for (const factPath of ['history.pica', 'history.leadExposureRisk']) {
    const singletonUnknownFacts = setPath(structuredClone(witnessFacts), factPath, 'unknown');
    assert.equal(
      evaluateCondition(unsafeCompoundRule.when, singletonUnknownFacts),
      false,
      `compound control must not activate when only ${factPath} is unknown`,
    );
  }

  const bothUnknownFacts = structuredClone(witnessFacts);
  setPath(bothUnknownFacts, 'history.pica', 'unknown');
  setPath(bothUnknownFacts, 'history.leadExposureRisk', 'unknown');
  const bothUnknownResult = runRules(bothUnknownFacts, [unsafeCompoundRule]);
  assert.equal(bothUnknownResult.audit[0]?.matched, true);
  assert.equal(bothUnknownResult.candidates[0]?.score, -1);

  const witnesses = new Map([
    [unsafeCompoundRule.id, { facts: witnessFacts, file: 'synthetic-compound' }],
  ]);
  const analysis = analyzeTriSafety([unsafeCompoundRule], witnesses);
  assert.equal(analysis.behavioralProbeCount, 3, 'two Tri paths require three non-empty subset probes');
  assert.ok(
    analysis.violations.some((violation) => (
      /unknown subset \[history\.leadExposureRisk, history\.pica\] emitted adverse candidate score -1/.test(violation)
    )),
    `compound behavioral detector did not catch the joint-unknown case: ${analysis.violations.join('; ')}`,
  );
});
