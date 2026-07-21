/**
 * EP6-T1 / FR-WP6-01 — hand-rolled, seeded, deterministic property-based tests.
 *
 * D-5 (zero dependencies): `package.json` carries no `dependencies`/`devDependencies` at all, so a
 * property library (fast-check et al.) is not available and will not be added. This file hand-rolls
 * a tiny mulberry32 PRNG instead and drives everything through it — same contract as a real
 * property library (seeded, reproducible, shrink-free-but-replayable), zero supply-chain cost.
 *
 * Seed contract: every generated case is a pure function of `SEED` (below) plus the case index
 * within its property. The committed default is the fixed constant `SEED`; set
 * `PROPERTY_SEED=<int>` in the environment to override for local reproduction of a reported
 * failure. Every assertion message embeds the *effective* seed and the case index, so a failure
 * reported from CI can be replayed byte-for-byte locally.
 *
 * Generators build inputs from the knowledge base, never from invented clinical numbers: numeric
 * fields are jittered around real values already present in `tests/witness/**`/`examples/*.json`
 * fixtures or snapped to real band bounds pulled straight out of `modules/anemia/reference-ranges.json`
 * and `modules/anemia/ranges.js#getFerritinThreshold`; enum/status fields are drawn from the closed
 * vocabularies literally declared in `schemas/patient-input.schema.json`; boolean-map (history/
 * symptoms/exam) field names are the union of keys actually used across the witness/example corpus,
 * never a hand-invented name. Unit-mismatch probes reuse the exact `confusables[].unit` strings
 * already declared in `modules/anemia/units.json` — not new "wrong unit" spellings.
 *
 * EP1-T6 cross-reference: `tests/tristate-safety-invariant.test.mjs` proves the "unknown may never
 * behave like confirmed-absent" narrowing invariant EXHAUSTIVELY, but only for a single rule's own
 * referenced Tri paths and only up to that file's `MAX_EXHAUSTIVE_TRI_PATHS = 12` cap. Property P4
 * below is this file's complement to that proof: randomized, whole-rule-set subsets of the tri fact
 * paths (not bounded to one rule, not bounded to 12), sampled across many witnesses.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assessPediatricAnemia } from '../src/engine.js';
import { deriveFacts } from '../src/facts.js';
import { runRules } from '../src/ruleEngine.js';
import { UnitRejectionError } from '../src/units.js';
import { AgeOutOfSupportedRangeError } from '../modules/anemia/facts.anemia.js';
import { getFerritinThreshold } from '../modules/anemia/ranges.js';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ------------------------------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — see docblock above for the reproducibility contract.
// ------------------------------------------------------------------------------------------------

const SEED = 20260721;
const envSeed = Number(process.env.PROPERTY_SEED);
const seed = Number.isFinite(envSeed) ? envSeed : SEED;

function mulberry32(rawSeed) {
  let a = rawSeed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Independent, named streams so one property's case count can change without perturbing another
// property's sequence (still 100% deterministic given the same top-level `seed`).
const STREAM = {
  P1: 1,
  P2: 2,
  P3_GENERAL: 3,
  P3_UNIT: 4,
  P3_AGE: 5,
  P4: 6,
  SHARED: 7,
};

function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

function randInt(rng, minInclusive, maxInclusive) {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

function shuffle(rng, array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function getPath(object, dotPath) {
  return dotPath
    .split('.')
    .reduce((value, key) => (value === null || value === undefined ? undefined : value[key]), object);
}

function setPath(object, dotPath, value) {
  const keys = dotPath.split('.');
  let cursor = object;
  for (const key of keys.slice(0, -1)) {
    if (cursor[key] === null || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys.at(-1)] = value;
  return object;
}

// ------------------------------------------------------------------------------------------------
// Knowledge base + fixture corpus loading (all read once at module load, mirrors the style of
// tests/tristate-safety-invariant.test.mjs and tests/assessment-output-schema.test.mjs).
// ------------------------------------------------------------------------------------------------

const rules = JSON.parse(await readFile(path.join(ROOT, 'modules', 'anemia', 'rules.json'), 'utf8'));
const candidates = JSON.parse(await readFile(path.join(ROOT, 'modules', 'anemia', 'candidates.json'), 'utf8'));
const referenceRangeData = JSON.parse(
  await readFile(path.join(ROOT, 'modules', 'anemia', 'reference-ranges.json'), 'utf8'),
);
const moduleManifest = JSON.parse(await readFile(path.join(ROOT, 'modules', 'anemia', 'module.json'), 'utf8'));
const outputSchema = JSON.parse(
  await readFile(path.join(ROOT, 'schemas', 'assessment-output.schema.json'), 'utf8'),
);

const SUPPORTED_AGE_MONTHS_MIN = moduleManifest.supportedAgeMonths.min;
const SUPPORTED_AGE_MONTHS_MAX = moduleManifest.supportedAgeMonths.max;
const rangeBands = referenceRangeData.ranges;

function bandFor(ageMonths) {
  if (!Number.isFinite(ageMonths)) return null;
  return rangeBands.find((band) => ageMonths >= band.minMonths && ageMonths < band.maxMonthsExclusive) ?? null;
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

const corpusFiles = [
  ...await collectJsonFiles(path.join(ROOT, 'examples')),
  ...await collectJsonFiles(path.join(ROOT, 'tests', 'witness')),
].sort();

const corpus = (await Promise.all(
  corpusFiles.map(async (file) => ({ file, input: JSON.parse(await readFile(file, 'utf8')) })),
)).filter((entry) => entry.input && typeof entry.input === 'object' && !Array.isArray(entry.input));

assert.ok(corpus.length > 10, `expected a substantial witness/example corpus, found ${corpus.length}`);

function unionKeys(section) {
  const keys = new Set();
  for (const entry of corpus) {
    const value = entry.input[section];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const key of Object.keys(value)) keys.add(key);
    }
  }
  return [...keys].sort();
}

const historyKeys = unionKeys('history');
const symptomsKeys = unionKeys('symptoms');
const examKeys = unionKeys('exam');

// ------------------------------------------------------------------------------------------------
// Closed vocabularies — copied verbatim from schemas/patient-input.schema.json's own enums. These
// are structural KB vocabulary, not clinical thresholds: no rule cutoff is invented here.
// ------------------------------------------------------------------------------------------------

const ENUM_FIELD_POOLS = {
  'patient.sexAtBirth': ['female', 'male', 'unspecified', null],
  'cbc.rbcInterpretation': ['unknown', 'high-for-age', 'normal', 'low'],
  'reticulocytes.response': ['unknown', 'low', 'inappropriately-normal', 'appropriate', 'high'],
  'labs.ferritinStatus': ['unknown', 'normal', 'high'],
  'labs.crpStatus': ['unknown', 'normal', 'elevated'],
  'labs.tsatStatus': ['unknown', 'low', 'normal', 'high'],
  'labs.tibcStatus': ['unknown', 'low', 'normal', 'high'],
  'labs.ironStatus': ['unknown', 'low', 'normal', 'high'],
  'labs.indirectBilirubinStatus': ['unknown', 'normal', 'high'],
  'labs.ldhStatus': ['unknown', 'normal', 'high'],
  'labs.haptoglobinStatus': ['unknown', 'normal', 'low'],
  'labs.datStatus': ['unknown', 'negative', 'positive'],
  'labs.hbA2Status': ['unknown', 'normal', 'elevated'],
  'labs.g6pdStatus': ['unknown', 'normal', 'deficient'],
  'labs.b12Status': ['unknown', 'low', 'normal'],
  'labs.folateStatus': ['unknown', 'low', 'normal'],
  'labs.copperStatus': ['unknown', 'low', 'normal'],
  'labs.creatinineStatus': ['unknown', 'normal', 'high'],
  'labs.tshStatus': ['unknown', 'normal', 'high'],
  'labs.liverTestsStatus': ['unknown', 'normal', 'abnormal'],
  'labs.leadSpecimen': ['unknown', 'capillary', 'venous'],
};

const BOOLEAN_LAB_FIELDS = [
  'labs.hbBartNewbornScreen',
  'labs.alphaGlobinTestingPositive',
  'labs.betaGlobinTestingPositive',
  'labs.sicklingHemoglobinDetected',
  'labs.g6pdTestDuringAcuteHemolysis',
  'labs.g6pdTestSoonAfterTransfusion',
];

const SMEAR_VALUES = [
  'target-cells', 'spherocytes', 'schistocytes', 'bite-or-blister-cells', 'sickle-cells',
  'basophilic-stippling', 'hypersegmented-neutrophils', 'blasts', 'teardrops', 'nucleated-rbc',
  'elliptocytes',
];

const TRI_REPRESENTATIONS = [true, false, 'true', 'false', 'unknown'];

function setTriField(container, key, rng) {
  if (rng() < 0.15) {
    delete container[key];
    return;
  }
  container[key] = pick(rng, TRI_REPRESENTATIONS);
}

function jitterNumericField(rng, container, field, anchor, pct) {
  if (Number.isFinite(anchor) && rng() < 0.2) {
    container[field] = Math.max(0.1, round1(anchor + (rng() - 0.5) * 2 * Math.max(Math.abs(anchor) * pct, 0.5)));
    return;
  }
  const current = container[field];
  if (typeof current === 'number' && Number.isFinite(current)) {
    container[field] = Math.max(0.1, round1(current * (1 + (rng() - 0.5) * 2 * pct)));
  }
}

/**
 * Build a schema-shaped, KB-grounded candidate patient input by cloning a real witness/example
 * fixture and jittering it: numeric fields move around either their own real observed value or a
 * real band/threshold anchor; enum fields are resampled from the schema's own closed vocabulary;
 * boolean-map fields are resampled only on KB-known field names (`historyKeys`/`symptomsKeys`/
 * `examKeys`, harvested from the corpus itself — never invented).
 */
function generateCandidateInput(rng) {
  const base = pick(rng, corpus);
  const input = structuredClone(base.input);
  input.patient = input.patient ?? {};
  input.cbc = input.cbc ?? {};
  input.labs = input.labs ?? {};
  input.reticulocytes = input.reticulocytes ?? {};
  input.history = input.history ?? {};
  input.symptoms = input.symptoms ?? {};
  input.exam = input.exam ?? {};
  input.smear = Array.isArray(input.smear) ? input.smear : [];

  if (rng() < 0.6) {
    const band = pick(rng, rangeBands);
    input.patient.ageMonths = randInt(rng, band.minMonths, band.maxMonthsExclusive - 1);
  } else if (rng() >= 0.9) {
    // Deliberate, occasional excursion outside the module's declared scope (module.json's own
    // supportedAgeMonths bounds) — the engine must still behave (refuse cleanly), see P1/P2/P3.
    input.patient.ageMonths = rng() < 0.5
      ? randInt(rng, 0, SUPPORTED_AGE_MONTHS_MIN - 1)
      : randInt(rng, SUPPORTED_AGE_MONTHS_MAX, SUPPORTED_AGE_MONTHS_MAX + 60);
  }
  if (rng() < 0.3) input.patient.menstruating = rng() < 0.5;
  if (rng() < 0.2) input.patient.recentTransfusion = rng() < 0.3;
  if (rng() < 0.2) input.patient.highAltitude = rng() < 0.3;

  for (const [dotPath, pool] of Object.entries(ENUM_FIELD_POOLS)) {
    if (rng() < 0.3) setPath(input, dotPath, pick(rng, pool));
  }
  for (const dotPath of BOOLEAN_LAB_FIELDS) {
    if (rng() < 0.15) setPath(input, dotPath, rng() < 0.5);
  }
  if (rng() < 0.3) input.smear = SMEAR_VALUES.filter(() => rng() < 0.25);

  input.cbc.localFlags = input.cbc.localFlags ?? {};
  for (const flag of ['leukopenia', 'neutropenia', 'thrombocytopenia', 'thrombocytosis']) {
    if (rng() < 0.15) input.cbc.localFlags[flag] = rng() < 0.5;
  }

  const band = bandFor(input.patient.ageMonths);
  const sex = input.patient.sexAtBirth === 'male' ? 'male' : 'female';
  jitterNumericField(rng, input.cbc, 'hemoglobin', band ? band[sex].hbLower : null, 0.15);
  const mcvAnchor = band ? (rng() < 0.5 ? band[sex].mcvLower : band[sex].mcvUpper) : null;
  jitterNumericField(rng, input.cbc, 'mcv', mcvAnchor, 0.15);
  jitterNumericField(rng, input.cbc, 'rdw', band ? band[sex].rdwUpper : null, 0.15);
  jitterNumericField(rng, input.cbc, 'rbc', null, 0.15);
  jitterNumericField(rng, input.cbc, 'wbc', null, 0.15);
  jitterNumericField(rng, input.cbc, 'anc', null, 0.15);
  jitterNumericField(rng, input.cbc, 'platelets', null, 0.15);
  const ferritinThreshold = getFerritinThreshold(input.patient.ageMonths, input.patient.menstruating);
  jitterNumericField(rng, input.labs, 'ferritin', ferritinThreshold?.value ?? null, 0.2);
  jitterNumericField(rng, input.labs, 'bloodLeadLevel', null, 0.2);
  jitterNumericField(rng, input.labs, 'stfrFerritinIndex', null, 0.2);

  for (const key of historyKeys) if (rng() < 0.25) setTriField(input.history, key, rng);
  for (const key of symptomsKeys) if (rng() < 0.25) setTriField(input.symptoms, key, rng);
  for (const key of examKeys) if (rng() < 0.25) setTriField(input.exam, key, rng);

  return input;
}

function scrub(output) {
  if (!output || typeof output !== 'object') return output;
  return { ...output, meta: { ...output.meta, generatedAt: 'x' } };
}

function runAssess(input) {
  try {
    return { ok: true, value: assessPediatricAnemia(input, rules, candidates) };
  } catch (error) {
    return { ok: false, error };
  }
}

function describeInput(input) {
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function assertSameOutcome(first, outcome, label, input) {
  assert.equal(
    first.ok,
    outcome.ok,
    `${label}: one run succeeded and the other threw for input ${describeInput(input)}`,
  );
  if (first.ok) {
    assert.deepEqual(
      scrub(first.value),
      scrub(outcome.value),
      `${label}: outputs differ for identical input ${describeInput(input)}`,
    );
    return;
  }
  assert.equal(first.error.name, outcome.error.name, `${label}: error class differs for identical input`);
  assert.equal(first.error.message, outcome.error.message, `${label}: error message differs for identical input`);
}

// ==================================================================================================
// P1 — Determinism.
// ==================================================================================================

test('P1 determinism: identical input yields deep-equal output (same object, and a deep clone)', () => {
  const rng = mulberry32(seed + STREAM.P1);
  const CASES = 250;
  for (let i = 0; i < CASES; i += 1) {
    const input = generateCandidateInput(rng);
    const first = runAssess(input);
    const second = runAssess(input);
    const third = runAssess(structuredClone(input));

    assertSameOutcome(first, second, `[seed=${seed} case=${i}] determinism (same-object rerun)`, input);
    assertSameOutcome(first, third, `[seed=${seed} case=${i}] determinism (deep-clone rerun)`, input);
  }
});

// ==================================================================================================
// P2 — Input immutability.
// ==================================================================================================

test('P2 input immutability: assessPediatricAnemia never mutates the caller\'s input object', () => {
  const rng = mulberry32(seed + STREAM.P2);
  const CASES = 250;
  for (let i = 0; i < CASES; i += 1) {
    const input = generateCandidateInput(rng);
    const before = structuredClone(input);
    try {
      assessPediatricAnemia(input, rules, candidates);
    } catch {
      // A typed fail-closed rejection must still leave the caller's input untouched — fall through
      // to the same immutability assertion regardless of outcome.
    }
    assert.deepEqual(
      input,
      before,
      `[seed=${seed} case=${i}] assess() mutated the caller's input object for ${describeInput(before)}`,
    );
  }
});

// ==================================================================================================
// P3 — Fail-closed typing.
// ==================================================================================================

const TOP_LEVEL_GARBAGE_VALUES = [
  null, undefined, 0, 1, -1, NaN, Infinity, -Infinity, '', 'garbage', [], {}, [1, 2, 3], true, false,
  [{}], { random: 'shape' }, 'unknown', [null, undefined],
];

const LEAF_GARBAGE_VALUES = [
  null, undefined, NaN, Infinity, -Infinity, -1, 999999, '', 'not-a-real-clinical-value', [], {},
  [1, 2, 3], true, false, 0, { nested: { garbage: true } }, 'unknown',
];

function collectLeafPaths(value, prefix, into) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) into.push(prefix);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    collectLeafPaths(child, prefix ? `${prefix}.${key}` : key, into);
  }
}

function corruptFixture(rng, baseInput) {
  const input = structuredClone(baseInput);
  const leafPaths = [];
  collectLeafPaths(input, '', leafPaths);
  if (leafPaths.length === 0) return input;
  const mutationCount = randInt(rng, 1, Math.min(5, leafPaths.length));
  for (const targetPath of shuffle(rng, leafPaths).slice(0, mutationCount)) {
    setPath(input, targetPath, pick(rng, LEAF_GARBAGE_VALUES));
  }
  return input;
}

test('P3 arbitrary/corrupted inputs never throw a bare TypeError/RangeError/ReferenceError — only a valid output or a typed domain error', () => {
  const rng = mulberry32(seed + STREAM.P3_GENERAL);
  const CASES = 300;
  const untypedCrashes = [];
  for (let i = 0; i < CASES; i += 1) {
    const input = rng() < 0.25
      ? pick(rng, TOP_LEVEL_GARBAGE_VALUES)
      : corruptFixture(rng, pick(rng, corpus).input);
    const outcome = runAssess(input);
    if (outcome.ok) {
      assert.ok(
        outcome.value && typeof outcome.value === 'object' && Object.hasOwn(outcome.value, 'provenance'),
        `[seed=${seed} case=${i}] success path returned a malformed value for ${describeInput(input)}`,
      );
      continue;
    }
    const isTypedDomainError = outcome.error instanceof UnitRejectionError
      || outcome.error instanceof AgeOutOfSupportedRangeError;
    if (!isTypedDomainError) {
      untypedCrashes.push({ index: i, input, error: outcome.error });
    }
    // Assert (rather than silently record-and-continue) so an honest engine bug fails this test
    // instead of being papered over — see the run instructions' "never weaken an assertion" rule.
    assert.ok(
      isTypedDomainError,
      `[seed=${seed} case=${i}] UNTYPED CRASH on input ${describeInput(input)}: `
      + `${outcome.error?.constructor?.name ?? typeof outcome.error}: ${outcome.error?.message}`,
    );
  }
  assert.equal(untypedCrashes.length, 0, `${untypedCrashes.length} untyped crash(es) found (seed=${seed})`);
});

const CONFUSABLE_UNIT_PROBES = [
  // Every `confusableUnit` below is copied verbatim from modules/anemia/units.json's own
  // `confusables[].unit` list for that analyte — a real, KB-declared incompatible spelling, not an
  // invented one.
  { container: 'cbc', measurementField: 'hemoglobin', unitField: 'hemoglobinUnit', confusableUnit: 'g/L', fallbackValue: 10 },
  { container: 'cbc', measurementField: 'mcv', unitField: 'mcvUnit', confusableUnit: 'um3', fallbackValue: 80 },
  { container: 'labs', measurementField: 'ferritin', unitField: 'ferritinUnit', confusableUnit: 'ng/L', fallbackValue: 20 },
  { container: 'labs', measurementField: 'bloodLeadLevel', unitField: 'bloodLeadLevelUnit', confusableUnit: 'µmol/L', fallbackValue: 10 },
];

test('P3 deliberate KB-listed confusable units throw UnitRejectionError (never an untyped crash, never a silent accept)', () => {
  const rng = mulberry32(seed + STREAM.P3_UNIT);
  const CASES = 80;
  for (let i = 0; i < CASES; i += 1) {
    const probe = pick(rng, CONFUSABLE_UNIT_PROBES);
    const input = structuredClone(pick(rng, corpus).input);
    input[probe.container] = input[probe.container] ?? {};
    const container = input[probe.container];
    container[probe.measurementField] = Number.isFinite(container[probe.measurementField])
      ? container[probe.measurementField]
      : probe.fallbackValue;
    container[probe.unitField] = probe.confusableUnit;

    const outcome = runAssess(input);
    assert.equal(
      outcome.ok,
      false,
      `[seed=${seed} case=${i}] expected ${probe.container}.${probe.measurementField}Unit=${probe.confusableUnit} to be rejected, but assess() succeeded`,
    );
    assert.ok(
      outcome.error instanceof UnitRejectionError,
      `[seed=${seed} case=${i}] expected UnitRejectionError for ${probe.measurementField}=${probe.confusableUnit}, `
      + `got ${outcome.error?.constructor?.name}: ${outcome.error?.message}`,
    );
  }
});

test('P3 deliberate out-of-supported-scope ages with no local ranges throw AgeOutOfSupportedRangeError', () => {
  const rng = mulberry32(seed + STREAM.P3_AGE);
  const CASES = 40;
  for (let i = 0; i < CASES; i += 1) {
    const ageMonths = rng() < 0.5
      ? randInt(rng, 0, SUPPORTED_AGE_MONTHS_MIN - 1)
      : randInt(rng, SUPPORTED_AGE_MONTHS_MAX, SUPPORTED_AGE_MONTHS_MAX + 60);
    const input = {
      patient: { ageMonths, sexAtBirth: pick(rng, ['female', 'male']) },
      cbc: { localRanges: {} },
    };
    const outcome = runAssess(input);
    assert.equal(
      outcome.ok,
      false,
      `[seed=${seed} case=${i}] expected ageMonths=${ageMonths} (outside module.json supportedAgeMonths `
      + `${SUPPORTED_AGE_MONTHS_MIN}-${SUPPORTED_AGE_MONTHS_MAX}, no local ranges) to be refused`,
    );
    assert.ok(
      outcome.error instanceof AgeOutOfSupportedRangeError,
      `[seed=${seed} case=${i}] expected AgeOutOfSupportedRangeError for ageMonths=${ageMonths}, `
      + `got ${outcome.error?.constructor?.name}: ${outcome.error?.message}`,
    );
  }
});

// ==================================================================================================
// P4 — Generalized EP1-T6 unknown-narrowing invariant (see tests/tristate-safety-invariant.test.mjs).
// ==================================================================================================

// Mirrors tests/tristate-safety-invariant.test.mjs's own cap. That file exhaustively proves the
// invariant for a SINGLE rule's own referenced Tri paths, up to this many. This property is the
// complement: randomized subsets drawn from the FULL set of Tri paths referenced anywhere in the
// live rule set, deliberately sized past this cap (asserted below), where exhaustive enumeration
// would be combinatorially infeasible.
const MAX_EXHAUSTIVE_TRI_PATHS = 12;
const TRI_VALUES = new Set(['true', 'false', 'unknown']);
const TRI_OPERATORS = new Set(['is-present', 'is-absent', 'is-unknown', 'is-not-assessed']);

function collectFactLeaves(condition, leaves = []) {
  if (Array.isArray(condition?.all)) {
    condition.all.forEach((child) => collectFactLeaves(child, leaves));
    return leaves;
  }
  if (Array.isArray(condition?.any)) {
    condition.any.forEach((child) => collectFactLeaves(child, leaves));
    return leaves;
  }
  if (condition?.not) {
    collectFactLeaves(condition.not, leaves);
    return leaves;
  }
  if (typeof condition?.fact === 'string') leaves.push(condition);
  return leaves;
}

const triFactPaths = [...new Set(
  rules
    .flatMap((rule) => collectFactLeaves(rule.when))
    .filter((leaf) => TRI_OPERATORS.has(leaf.op))
    .map((leaf) => leaf.fact),
)].sort();

assert.ok(triFactPaths.length > MAX_EXHAUSTIVE_TRI_PATHS, 'expected the live rule set to reference more Tri paths than the exhaustive-probe cap');

const ruleById = new Map(rules.map((rule) => [rule.id, rule]));

test(`P4 generalized narrowing invariant: randomized whole-rule-set subsets of Tri paths (including subsets larger than MAX_EXHAUSTIVE_TRI_PATHS=${MAX_EXHAUSTIVE_TRI_PATHS}) never let unknown behave like confirmed-absent`, () => {
  const rng = mulberry32(seed + STREAM.P4);
  const CASES = 300;
  let probedBeyondCap = 0;
  let probedCases = 0;

  for (let i = 0; i < CASES; i += 1) {
    const base = pick(rng, corpus);
    let facts;
    try {
      facts = deriveFacts(structuredClone(base.input));
    } catch {
      continue; // a fixture that itself fails unit validation contributes nothing to probe here
    }

    const presentTriPaths = triFactPaths.filter((factPath) => TRI_VALUES.has(getPath(facts, factPath)));
    if (presentTriPaths.length === 0) continue;

    const subsetSize = 1 + Math.floor(rng() * presentTriPaths.length);
    if (subsetSize > MAX_EXHAUSTIVE_TRI_PATHS) probedBeyondCap += 1;
    const subset = shuffle(rng, presentTriPaths).slice(0, subsetSize);

    const mutatedFacts = structuredClone(facts);
    for (const factPath of subset) setPath(mutatedFacts, factPath, 'unknown');

    const result = runRules(mutatedFacts, rules, candidates);
    probedCases += 1;
    const scoreById = new Map(result.candidates.map((candidate) => [candidate.id, candidate.score]));

    for (const entry of result.audit) {
      if (!entry.matched) continue;
      const rule = ruleById.get(entry.ruleId);
      if (rule?.output?.type !== 'candidate' || !(Number(rule.output.points) < 0)) continue;
      const score = scoreById.get(rule.output.candidateId);
      assert.ok(
        !(score < 0),
        `[seed=${seed} case=${i}] EP1-T6 narrowing invariant violated on ${base.file}: degrading `
        + `[${subset.join(', ')}] to unknown let negative-point rule ${rule.id} (points ${rule.output.points}) `
        + `contribute to candidate ${rule.output.candidateId} with score ${score}`,
      );
    }
  }

  assert.ok(probedCases > 0, `expected at least one probed case (seed=${seed})`);
  assert.ok(
    probedBeyondCap > 0,
    `expected at least one randomly-sized subset larger than MAX_EXHAUSTIVE_TRI_PATHS=${MAX_EXHAUSTIVE_TRI_PATHS} (seed=${seed}); `
    + 'widen CASES or the subset-size distribution if this starts failing',
  );
});

// ==================================================================================================
// Shared corpus for P5/P6 — generated once so both properties see the same underlying runs.
// ==================================================================================================

function buildSharedCorpus() {
  const rng = mulberry32(seed + STREAM.SHARED);
  const CASES = 300;
  const successes = [];
  for (let i = 0; i < CASES; i += 1) {
    const input = generateCandidateInput(rng);
    const outcome = runAssess(input);
    if (outcome.ok) {
      successes.push({ index: i, input, output: outcome.value });
      continue;
    }
    if (!(outcome.error instanceof UnitRejectionError || outcome.error instanceof AgeOutOfSupportedRangeError)) {
      throw new Error(
        `[seed=${seed} case=${i}] shared-corpus generation hit an untyped error for ${describeInput(input)}: `
        + `${outcome.error?.constructor?.name}: ${outcome.error?.message}`,
      );
    }
  }
  return { successes, totalCases: CASES };
}

const sharedCorpus = buildSharedCorpus();

// ==================================================================================================
// P5 — Output schema conformance.
// ==================================================================================================

test('P5 every successful generated assessment validates against schemas/assessment-output.schema.json', () => {
  assert.ok(sharedCorpus.successes.length > 0, `expected at least one successful generated assessment (seed=${seed})`);
  for (const { index, output } of sharedCorpus.successes) {
    const errors = validate(outputSchema, output);
    assert.deepEqual(
      errors,
      [],
      `[seed=${seed} case=${index}] generated output failed schema validation: ${JSON.stringify(errors)}`,
    );
  }
});

// ==================================================================================================
// P6 — Anti-vacuity.
// ==================================================================================================

test('P6 anti-vacuity: the generators actually activate a healthy diversity of rules and fire real alerts (not just inert inputs)', () => {
  const matchedRuleIds = new Set();
  let alertCount = 0;
  let rankedDifferentialCount = 0;

  for (const { output } of sharedCorpus.successes) {
    for (const id of output.provenance.matchedRuleIds) matchedRuleIds.add(id);
    alertCount += output.alerts.length;
    if (output.rankedDifferential.length > 0) rankedDifferentialCount += 1;
  }

  assert.ok(
    sharedCorpus.successes.length >= 100,
    `too few successful generated cases (${sharedCorpus.successes.length}/${sharedCorpus.totalCases}) to `
    + `call this corpus non-vacuous (seed=${seed})`,
  );
  // Floor rationale (EP6-T1 orchestrator hardening): the committed seed actually activates 89 of
  // 91 rules. A floor of 15 would let a 5x coverage regression pass silently and quietly hollow out
  // every other property in this file, since P1–P5 all draw from `sharedCorpus`. 60 keeps ample
  // headroom for seed-to-seed variance while still failing loudly on a real generator regression.
  const MIN_DISTINCT_RULES_ACTIVATED = 60;
  assert.ok(
    matchedRuleIds.size >= MIN_DISTINCT_RULES_ACTIVATED,
    `generated corpus only activated ${matchedRuleIds.size} distinct rule ids out of ${rules.length} `
    + `(floor ${MIN_DISTINCT_RULES_ACTIVATED}) — the generators are too inert to trust the other `
    + `properties' coverage (seed=${seed})`,
  );
  assert.ok(alertCount > 0, `generated corpus never triggered a single alert — generators are too inert (seed=${seed})`);
  assert.ok(
    rankedDifferentialCount > 0,
    `generated corpus never produced a ranked differential — generators are too inert (seed=${seed})`,
  );
});
