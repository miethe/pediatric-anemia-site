/**
 * EP6-T2 — boundary-value tests at every numeric threshold (FR-WP6-02).
 *
 * SCOPE CORRECTION (read this before extending the file): the phase plan's literal wording —
 * "every numeric threshold in modules/anemia/rules.json" — is nearly vacuous taken literally.
 * rules.json contains exactly THREE numeric leaf conditions across all 91 rules: two `gte`
 * comparisons on `marrow.congenitalSignalCount` at value 1 (rules IMF-001, IMF-DBA-001) and one
 * `lt` comparison on `hemolysis.markerCount` at value 2 (rule Q-NORMO-HIGH-001). The RULES-JSON-
 * SHAPE guard test below locks that count so a future rule addition that changes it is caught.
 *
 * The real numeric thresholds this suite targets live in DERIVATION, not in rules.json:
 *   - modules/anemia/facts.anemia.js — ~19 literal numeric comparisons (3 of them structural
 *     "is anything present" checks, not clinical thresholds — see the allowlist below).
 *   - modules/anemia/ranges.js — the ferritin threshold rule's age-band literals.
 *   - modules/anemia/reference-ranges.json — the age-band edges and the per-band/per-sex
 *     hb/mcv/rdw limits, read at runtime via `getEffectiveRanges()` rather than re-hardcoded here.
 *   - the EP-2 fail-closed unit-rejection boundary (src/units.js UnitRejectionError,
 *     src/ranges/registry.js RangeUnitMismatchError).
 *
 * Each threshold gets an at-boundary case (the literal threshold value itself) and a
 * one-unit-past-boundary case (one step, at the analyte's meaningful precision, across the line
 * that flips the observable result) — see the CASES table below. Where a threshold is reachable
 * through assessPediatricAnemia() (a rule fires, or a classification field changes), the case
 * asserts on that observable engine behavior. Where a threshold is only reachable via
 * deriveFacts() (three hb-severity/sTfR-index facts are computed but never referenced by any
 * rule in modules/anemia/rules.json or candidates.json today), the case says so in a comment and
 * asserts on the derived fact directly.
 *
 * Two coverage tripwires close the loop so this suite cannot silently rot as the KB grows:
 *   1. a rules.json shape guard (exactly 3 numeric leaf conditions, with their exact fact/op/value);
 *   2. a static-scan guard over facts.anemia.js/ranges.js (modeled on tests/witness/corpus.test.mjs's
 *      end-of-file coverage guard) that fails if a literal numeric comparison appears in either
 *      file that isn't accounted for by a CASES id or an explicit, reasoned allowlist entry.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { assessPediatricAnemia } from '../src/engine.js';
import { deriveFacts } from '../src/facts.js';
import { getEffectiveRanges, getFerritinThreshold } from '../modules/anemia/ranges.js';
import { UnitRejectionError } from '../src/units.js';
import { RangeUnitMismatchError } from '../src/ranges/registry.js';

const rules = JSON.parse(
  await readFile(new URL('../modules/anemia/rules.json', import.meta.url), 'utf8'),
);
const candidates = JSON.parse(
  await readFile(new URL('../modules/anemia/candidates.json', import.meta.url), 'utf8'),
);
const rangeData = JSON.parse(
  await readFile(new URL('../modules/anemia/reference-ranges.json', import.meta.url), 'utf8'),
);
const factsSource = await readFile(
  new URL('../modules/anemia/facts.anemia.js', import.meta.url),
  'utf8',
);
const rangesSource = await readFile(
  new URL('../modules/anemia/ranges.js', import.meta.url),
  'utf8',
);

function assess(input) {
  return assessPediatricAnemia(input, rules, candidates);
}

function fired(result, ruleId) {
  return result.provenance.matchedRuleIds.includes(ruleId);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, overrides) {
  if (!isPlainObject(overrides)) return overrides;
  const out = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    out[k] = isPlainObject(base?.[k]) && isPlainObject(v) ? deepMerge(base[k], v) : v;
  }
  return out;
}

/** A schema-valid, minimally-populated patient input; callers override just what they're testing. */
function baseInput(overrides = {}) {
  return deepMerge(
    {
      patient: {
        ageMonths: null,
        sexAtBirth: null,
        menstruating: false,
        recentTransfusion: false,
        highAltitude: false,
      },
      cbc: {},
      reticulocytes: {},
      symptoms: {},
      history: {},
      exam: {},
      labs: {},
      smear: [],
    },
    overrides,
  );
}

// -------------------------------------------------------------------------------------------
// Group 1 — modules/anemia/reference-ranges.json: per-band, per-sex hb/mcv/rdw limits.
//
// Read at runtime via getEffectiveRanges() (the same function the engine uses) rather than
// re-hardcoded here, so this table cannot silently drift from the KB. 4 bands x 2 sexes x 4
// analytes = 32 threshold points, each with an at- and a past-boundary case.
// -------------------------------------------------------------------------------------------

const SEXES = ['female', 'male'];
const CBC_PRECISION = 0.1; // hb (g/dL), mcv (fL), rdw (%) are all recorded to one decimal in the KB

const rangeCases = [];
for (const band of rangeData.ranges) {
  const ageProbe = band.minMonths + 1; // safely inside the band, away from its own edges
  for (const sex of SEXES) {
    const eff = getEffectiveRanges({ patient: { ageMonths: ageProbe, sexAtBirth: sex } });

    rangeCases.push({
      id: `RANGE-HB-${band.label}-${sex}`,
      source: `modules/anemia/reference-ranges.json band "${band.label}" ${sex}.hbLower=${eff.hbLower} (read at runtime via getEffectiveRanges)`,
      analyte: 'cbc.hemoglobin',
      threshold: eff.hbLower,
      direction: 'anemia.present iff hb < hbLower',
      at: eff.hbLower,
      past: round1(eff.hbLower - CBC_PRECISION),
      build: (hb) => baseInput({ patient: { ageMonths: ageProbe, sexAtBirth: sex }, cbc: { hemoglobin: hb } }),
      check: (result, phase) => assert.equal(
        result.classification.anemiaStatus,
        phase === 'at' ? 'absent' : 'present',
        `band "${band.label}" ${sex}: hb=${phase === 'at' ? eff.hbLower : round1(eff.hbLower - CBC_PRECISION)} vs hbLower=${eff.hbLower}`,
      ),
    });

    rangeCases.push({
      id: `RANGE-MCVLOW-${band.label}-${sex}`,
      source: `modules/anemia/reference-ranges.json band "${band.label}" ${sex}.mcvLower=${eff.mcvLower} (read at runtime via getEffectiveRanges)`,
      analyte: 'cbc.mcv',
      threshold: eff.mcvLower,
      direction: 'morphology.microcytic iff mcv < mcvLower',
      at: eff.mcvLower,
      past: round1(eff.mcvLower - CBC_PRECISION),
      build: (mcv) => baseInput({ patient: { ageMonths: ageProbe, sexAtBirth: sex }, cbc: { mcv } }),
      check: (result, phase) => assert.equal(
        result.classification.morphology,
        phase === 'at' ? 'normocytic' : 'microcytic',
        `band "${band.label}" ${sex}: mcv vs mcvLower=${eff.mcvLower}`,
      ),
    });

    rangeCases.push({
      id: `RANGE-MCVUP-${band.label}-${sex}`,
      source: `modules/anemia/reference-ranges.json band "${band.label}" ${sex}.mcvUpper=${eff.mcvUpper} (read at runtime via getEffectiveRanges)`,
      analyte: 'cbc.mcv',
      threshold: eff.mcvUpper,
      direction: 'morphology.macrocytic iff mcv > mcvUpper',
      at: eff.mcvUpper,
      past: round1(eff.mcvUpper + CBC_PRECISION),
      build: (mcv) => baseInput({ patient: { ageMonths: ageProbe, sexAtBirth: sex }, cbc: { mcv } }),
      check: (result, phase) => assert.equal(
        result.classification.morphology,
        phase === 'at' ? 'normocytic' : 'macrocytic',
        `band "${band.label}" ${sex}: mcv vs mcvUpper=${eff.mcvUpper}`,
      ),
    });

    rangeCases.push({
      id: `RANGE-RDWUP-${band.label}-${sex}`,
      source: `modules/anemia/reference-ranges.json band "${band.label}" ${sex}.rdwUpper=${eff.rdwUpper} (read at runtime via getEffectiveRanges)`,
      analyte: 'cbc.rdw',
      threshold: eff.rdwUpper,
      direction: 'morphology.rdwHigh iff rdw > rdwUpper',
      at: eff.rdwUpper,
      past: round1(eff.rdwUpper + CBC_PRECISION),
      build: (rdw) => baseInput({ patient: { ageMonths: ageProbe, sexAtBirth: sex }, cbc: { rdw } }),
      check: (result, phase) => assert.equal(
        result.classification.rdwHigh,
        phase === 'at' ? false : true,
        `band "${band.label}" ${sex}: rdw vs rdwUpper=${eff.rdwUpper}`,
      ),
    });
  }
}

// Age-band SELECTION edges (24, 72, 144 months) — proves the correct band's numbers take effect
// exactly at the edge, as distinct from the per-band VALUE tests above. Uses female rdwUpper
// because it takes a different value in every one of the 4 bands (15.4 / 14.5 / 13.9 / 14.6), so a
// single fixed rdw value straddling each pair of adjacent bands flips classification.rdwHigh.
// The outer edges (6 and 216, module.json's supportedAgeMonths) are covered separately below by
// the SCOPE-001/SCOPE-002 cases, since crossing them also changes whether assess() requires local
// ranges at all.
const ageEdgeCases = [24, 72, 144].map((edge) => {
  const before = getEffectiveRanges({ patient: { ageMonths: edge - 1, sexAtBirth: 'female' } });
  const after = getEffectiveRanges({ patient: { ageMonths: edge, sexAtBirth: 'female' } });
  const probeRdw = round1((before.rdwUpper + after.rdwUpper) / 2);
  return {
    id: `RANGE-AGEEDGE-${edge}`,
    source: `modules/anemia/reference-ranges.json band edge at ${edge} months (female rdwUpper ${before.rdwUpper} -> ${after.rdwUpper}, read at runtime)`,
    analyte: 'patient.ageMonths',
    threshold: edge,
    direction: 'age-band selection edge (probed via rdwHigh)',
    at: edge,
    past: edge - 1,
    build: (ageMonths) => baseInput({ patient: { ageMonths, sexAtBirth: 'female' }, cbc: { rdw: probeRdw } }),
    check: (result, phase) => {
      const threshold = phase === 'at' ? after.rdwUpper : before.rdwUpper;
      assert.equal(
        result.classification.rdwHigh,
        probeRdw > threshold,
        `age edge ${edge}: rdw=${probeRdw} vs rdwUpper=${threshold} (${phase})`,
      );
    },
  };
});

// -------------------------------------------------------------------------------------------
// Group 2 — module.json supportedAgeMonths (6, 216): the SCOPE-001/SCOPE-002 alert edges.
// Below 6 or at/above 216 months, assess() requires local hb/mcv ranges (docs/architecture.md
// §10 condition 2) or it refuses outright — so both cases supply them, matching the existing
// tests/witness/alerts/scope-neonatal-young-infant.json / scope-outside-pediatric-range.json
// fixture convention.
// -------------------------------------------------------------------------------------------

const scopeCases = [
  {
    id: 'SCOPE-EDGE-6',
    source: 'modules/anemia/module.json supportedAgeMonths.min=6, enforced in facts.anemia.js:70-71 (neonatalOrYoungInfant)',
    analyte: 'patient.ageMonths',
    threshold: 6,
    direction: 'scope.neonatalOrYoungInfant iff ageMonths < 6',
    at: 6,
    past: 5,
    build: (ageMonths) => baseInput({
      patient: { ageMonths, sexAtBirth: 'male' },
      cbc: { localRanges: { hbLower: 9, mcvLower: 70, mcvUpper: 85 } },
    }),
    check: (result, phase) => assert.equal(
      fired(result, 'SCOPE-001'),
      phase === 'past',
      `SCOPE-001 (neonatal/young-infant alert) at ageMonths boundary 6 (${phase})`,
    ),
  },
  {
    id: 'SCOPE-EDGE-216',
    source: 'modules/anemia/module.json supportedAgeMonths.max=216, enforced in facts.anemia.js:72-73 (outsidePediatricRange)',
    analyte: 'patient.ageMonths',
    threshold: 216,
    direction: 'scope.outsidePediatricRange iff ageMonths >= 216',
    at: 216,
    past: 215,
    build: (ageMonths) => baseInput({
      patient: { ageMonths, sexAtBirth: 'female' },
      cbc: { localRanges: { hbLower: 12, mcvLower: 80, mcvUpper: 100 } },
    }),
    check: (result, phase) => assert.equal(
      fired(result, 'SCOPE-002'),
      phase === 'at',
      `SCOPE-002 (outside-pediatric-range alert) at ageMonths boundary 216 (${phase})`,
    ),
  },
];

// -------------------------------------------------------------------------------------------
// Group 3 — modules/anemia/ranges.js ferritinThresholdRule: the age-band edges that change
// WHICH threshold value applies (20 vs 30 ng/mL), plus the threshold VALUE itself.
// -------------------------------------------------------------------------------------------

const ferritinCases = [
  {
    id: 'FERRITIN-VALUE',
    source: 'modules/anemia/ranges.js:67 young/school-age ferritin threshold value (read at runtime via getFerritinThreshold)',
    analyte: 'labs.ferritin',
    threshold: getFerritinThreshold(100, false).value,
    direction: 'ferritin.low iff ferritin <= threshold (facts.anemia.js:94-96, dynamic — not a literal comparison, so not in the static-scan tripwire below)',
    at: getFerritinThreshold(100, false).value,
    past: round1(getFerritinThreshold(100, false).value + 0.1),
    build: (ferritin) => baseInput({
      patient: { ageMonths: 100, sexAtBirth: 'female' },
      cbc: { hemoglobin: 15 }, // definitely non-anemic at any supported age/sex band (max hbLower is 12.4)
      labs: { ferritin },
    }),
    check: (result, phase) => assert.equal(
      fired(result, 'ID-004'),
      phase === 'at',
      `ID-004 (iron deficiency without anemia) at the ferritin threshold (${phase})`,
    ),
  },
  {
    id: 'FERRITIN-AGE-EDGE-144',
    source: 'modules/anemia/ranges.js:64,67 ferritin age-band edge at 144 months (threshold value itself changes 20 -> 30)',
    analyte: 'patient.ageMonths',
    threshold: 144,
    direction: 'ferritin threshold is 20 for [6,144), 30 for [144,216)',
    at: 144,
    past: 143,
    build: (ageMonths) => baseInput({
      patient: { ageMonths, sexAtBirth: 'female' },
      cbc: { hemoglobin: 15 },
      labs: { ferritin: 25 }, // between 20 and 30: low only on the >=144 (threshold 30) side
    }),
    check: (result, phase) => assert.equal(
      fired(result, 'ID-004'),
      phase === 'at',
      `ID-004 at the ferritin-rule age edge 144 (${phase}) — ferritin=25 is <=30 but not <=20`,
    ),
  },
  {
    id: 'FERRITIN-AGE-EDGE-216',
    source: 'modules/anemia/ranges.js:64 ferritin age-band upper edge at 216 months (threshold becomes null at/above it)',
    analyte: 'patient.ageMonths',
    threshold: 216,
    direction: 'ferritinThresholdRule returns null at/above 216 (falls through both age branches)',
    at: 216,
    past: 215,
    build: (ageMonths) => baseInput({
      patient: { ageMonths, sexAtBirth: 'female' },
      cbc: {
        hemoglobin: 15,
        ...(ageMonths >= 216
          ? { localRanges: { hbLower: 11, mcvLower: 70, mcvUpper: 95 } }
          : {}),
      },
      labs: { ferritin: 25 },
    }),
    check: (result, phase) => assert.equal(
      fired(result, 'ID-004'),
      phase === 'past',
      `ID-004 at the ferritin-rule age edge 216 (${phase}) — threshold is null at/above 216`,
    ),
  },
  {
    id: 'FERRITIN-AGE-EDGE-6',
    source: 'modules/anemia/ranges.js:67 ferritin age-band lower edge at 6 months (threshold is null below it)',
    analyte: 'patient.ageMonths',
    threshold: 6,
    direction: 'ferritinThresholdRule returns null below 6 months',
    at: 6,
    past: 5,
    build: (ageMonths) => baseInput({
      patient: { ageMonths, sexAtBirth: 'female' },
      cbc: {
        hemoglobin: 15,
        ...(ageMonths < 6
          ? { localRanges: { hbLower: 9, mcvLower: 70, mcvUpper: 85 } }
          : {}),
      },
      labs: { ferritin: 15 },
    }),
    check: (result, phase) => assert.equal(
      fired(result, 'ID-004'),
      phase === 'at',
      `ID-004 at the ferritin-rule age edge 6 (${phase}) — threshold is null below 6 months`,
    ),
  },
];

// -------------------------------------------------------------------------------------------
// Group 4 — modules/anemia/facts.anemia.js:100-104 sTfR/log10(ferritin) index thresholds.
// stfrIndexHigh/stfrIndexLow are reachable via ID-003/AINF-003; stfrIndexIntermediate is
// computed but never referenced by any rule, so it is tested via deriveFacts() directly.
// -------------------------------------------------------------------------------------------

function anemicInput(overrides) {
  return baseInput(deepMerge(
    { patient: { ageMonths: 100, sexAtBirth: 'female' }, cbc: { hemoglobin: 8 } }, // < band3 hbLower (11.2)
    overrides,
  ));
}

const stfrCases = [
  {
    id: 'STFR-HIGH',
    source: 'modules/anemia/facts.anemia.js:100 stfrFerritinIndex > 2 (iron.stfrIndexHigh)',
    analyte: 'labs.stfrFerritinIndex',
    threshold: 2,
    direction: 'iron.stfrIndexHigh iff stfrFerritinIndex > 2',
    at: 2,
    past: 2.1,
    build: (value) => anemicInput({ labs: { stfrFerritinIndex: value } }),
    check: (result, phase) => assert.equal(
      fired(result, 'ID-003'),
      phase === 'past',
      `ID-003 (iron deficiency anemia via sTfR index) at the >2 boundary (${phase})`,
    ),
  },
  {
    id: 'STFR-LOW',
    source: 'modules/anemia/facts.anemia.js:101 stfrFerritinIndex < 1 (iron.stfrIndexLow)',
    analyte: 'labs.stfrFerritinIndex',
    threshold: 1,
    direction: 'iron.stfrIndexLow iff stfrFerritinIndex < 1',
    at: 1,
    past: 0.9,
    build: (value) => anemicInput({ labs: { stfrFerritinIndex: value, crpStatus: 'elevated' } }),
    check: (result, phase) => assert.equal(
      fired(result, 'AINF-003'),
      phase === 'past',
      `AINF-003 (anemia of inflammation via sTfR index) at the <1 boundary (${phase})`,
    ),
  },
  {
    // Facts-only: stfrIndexIntermediate is computed in facts.anemia.js but never referenced by
    // any rule in rules.json/candidates.json today. Asserted directly on deriveFacts() output.
    id: 'STFR-INTERMEDIATE-LOWER',
    source: 'modules/anemia/facts.anemia.js:102-104 stfrFerritinIndex >= 1 (iron.stfrIndexIntermediate, facts-only)',
    analyte: 'labs.stfrFerritinIndex',
    threshold: 1,
    direction: 'iron.stfrIndexIntermediate iff 1 <= stfrFerritinIndex <= 2',
    at: 1,
    past: 0.9,
    mode: 'facts',
    build: (value) => anemicInput({ labs: { stfrFerritinIndex: value } }),
    check: (facts, phase) => assert.equal(
      facts.iron.stfrIndexIntermediate,
      phase === 'at',
      `iron.stfrIndexIntermediate at the >=1 boundary (${phase}) — reachable only via deriveFacts()`,
    ),
  },
  {
    id: 'STFR-INTERMEDIATE-UPPER',
    source: 'modules/anemia/facts.anemia.js:102-104 stfrFerritinIndex <= 2 (iron.stfrIndexIntermediate, facts-only)',
    analyte: 'labs.stfrFerritinIndex',
    threshold: 2,
    direction: 'iron.stfrIndexIntermediate iff 1 <= stfrFerritinIndex <= 2',
    at: 2,
    past: 2.1,
    mode: 'facts',
    build: (value) => anemicInput({ labs: { stfrFerritinIndex: value } }),
    check: (facts, phase) => assert.equal(
      facts.iron.stfrIndexIntermediate,
      phase === 'at',
      `iron.stfrIndexIntermediate at the <=2 boundary (${phase}) — reachable only via deriveFacts()`,
    ),
  },
];

// -------------------------------------------------------------------------------------------
// Group 5 — modules/anemia/facts.anemia.js:125 hemolysisMarkerCount >= 2 (hemolysis.pattern),
// the SAME boundary the rules.json Q-NORMO-HIGH-001 rule expresses as `hemolysis.markerCount
// lt 2`. One case exercises both HEM-001 (needs hemolysis.pattern) and Q-NORMO-HIGH-001 (needs
// markerCount < 2) from a single marker-count boundary, covering both the facts.anemia.js
// literal and one of the 3 rules.json numeric leaf conditions.
// -------------------------------------------------------------------------------------------

const hemolysisCases = [
  {
    id: 'HEMOLYSIS-PATTERN',
    source: 'modules/anemia/facts.anemia.js:125 hemolysisMarkerCount >= 2 AND modules/anemia/rules.json Q-NORMO-HIGH-001 (hemolysis.markerCount lt 2)',
    analyte: 'hemolysis marker count (indirectBilirubinStatus/ldhStatus/haptoglobinStatus)',
    threshold: 2,
    direction: 'hemolysis.pattern iff markerCount >= 2',
    at: 2,
    past: 1,
    build: (count) => anemicInput({
      cbc: { mcv: 85 }, // band3 normocytic (78.3-87.7 female)
      reticulocytes: { response: 'high' },
      labs: count >= 2
        ? { indirectBilirubinStatus: 'high', ldhStatus: 'high', haptoglobinStatus: 'normal' }
        : { indirectBilirubinStatus: 'high', ldhStatus: 'normal', haptoglobinStatus: 'normal' },
    }),
    check: (result, phase) => {
      assert.equal(
        fired(result, 'HEM-001'),
        phase === 'at',
        `HEM-001 (hemolysis pattern candidate) at markerCount boundary 2 (${phase})`,
      );
      assert.equal(
        fired(result, 'Q-NORMO-HIGH-001'),
        phase === 'past',
        `Q-NORMO-HIGH-001 (markerCount<2 question) at markerCount boundary 2 (${phase})`,
      );
    },
  },
];

// -------------------------------------------------------------------------------------------
// Group 6 — modules/anemia/facts.anemia.js:131-133 blood lead level thresholds (CDC action
// tiers). All three are reachable through single-condition rules (LEAD-001/ALERT-007/ALERT-008),
// so no anemia/age scaffolding is needed — patient.ageMonths stays null (a genuine missingness
// case, not the out-of-scope case: facts.anemia.js explicitly treats null age as "proceed").
// -------------------------------------------------------------------------------------------

const leadCases = [
  {
    id: 'LEAD-ATORABOVE',
    source: 'modules/anemia/facts.anemia.js:131 bll >= 3.5 (lead.atOrAboveReference)',
    analyte: 'labs.bloodLeadLevel',
    threshold: 3.5,
    direction: 'lead.atOrAboveReference iff bll >= 3.5',
    at: 3.5,
    past: 3.4,
    build: (bll) => baseInput({ labs: { bloodLeadLevel: bll } }),
    check: (result, phase) => assert.equal(
      fired(result, 'LEAD-001'),
      phase === 'at',
      `LEAD-001 (lead-exposure-associated anemia) at the >=3.5 boundary (${phase})`,
    ),
  },
  {
    id: 'LEAD-20-44-LOWER',
    source: 'modules/anemia/facts.anemia.js:132 bll >= 20 (lead.level20to44 lower edge)',
    analyte: 'labs.bloodLeadLevel',
    threshold: 20,
    direction: 'lead.level20to44 iff 20 <= bll < 45',
    at: 20,
    past: 19.9,
    build: (bll) => baseInput({ labs: { bloodLeadLevel: bll } }),
    check: (result, phase) => {
      assert.equal(
        fired(result, 'ALERT-008'),
        phase === 'at',
        `ALERT-008 (blood lead 20-44) at the >=20 boundary (${phase})`,
      );
      assert.equal(fired(result, 'ALERT-007'), false, 'ALERT-008 (45+) must not fire near the 20 boundary');
    },
  },
  {
    id: 'LEAD-45-TRANSITION',
    source: 'modules/anemia/facts.anemia.js:132-133 bll < 45 (lead.level20to44 upper edge) AND bll >= 45 (lead.level45Plus)',
    analyte: 'labs.bloodLeadLevel',
    threshold: 45,
    direction: 'lead.level45Plus iff bll >= 45; lead.level20to44 iff bll < 45',
    at: 45,
    past: 44.9,
    build: (bll) => baseInput({ labs: { bloodLeadLevel: bll } }),
    check: (result, phase) => {
      assert.equal(
        fired(result, 'ALERT-007'),
        phase === 'at',
        `ALERT-007 (blood lead >=45) at the 45 boundary (${phase})`,
      );
      assert.equal(
        fired(result, 'ALERT-008'),
        phase === 'past',
        `ALERT-008 (blood lead 20-44) at the 45 boundary (${phase})`,
      );
    },
  },
];

// -------------------------------------------------------------------------------------------
// Group 7 — modules/anemia/facts.anemia.js:231-233 hemoglobin severity bands. Facts-only:
// anemia.severeIdaHbCategory/moderateIdaHbCategory/mildIdaHbCategory are computed but never
// referenced by any rule (only anemia.severeIdaHbCategory feeds ALERT-003, which this suite does
// not need to re-derive — it needs the category boundaries themselves). Asserted via
// deriveFacts() directly.
// -------------------------------------------------------------------------------------------

const hbSeverityCases = [
  {
    id: 'HB-SEVERE-MODERATE',
    source: 'modules/anemia/facts.anemia.js:231-232 hb < 7 (severeIdaHbCategory) / hb >= 7 (moderateIdaHbCategory lower edge)',
    analyte: 'cbc.hemoglobin',
    threshold: 7,
    direction: 'severeIdaHbCategory iff hb < 7; moderateIdaHbCategory iff 7 <= hb < 9',
    at: 7,
    past: 6.9,
    mode: 'facts',
    build: (hb) => anemicInput({ cbc: { hemoglobin: hb } }),
    check: (facts, phase) => {
      assert.equal(facts.anemia.severeIdaHbCategory, phase === 'past', `severeIdaHbCategory at hb boundary 7 (${phase})`);
      assert.equal(facts.anemia.moderateIdaHbCategory, phase === 'at', `moderateIdaHbCategory at hb boundary 7 (${phase})`);
    },
  },
  {
    id: 'HB-MODERATE-MILD',
    source: 'modules/anemia/facts.anemia.js:232-233 hb < 9 (moderateIdaHbCategory upper edge) / hb >= 9 (mildIdaHbCategory)',
    analyte: 'cbc.hemoglobin',
    threshold: 9,
    direction: 'moderateIdaHbCategory iff 7 <= hb < 9; mildIdaHbCategory iff hb >= 9',
    at: 9,
    past: 8.9,
    mode: 'facts',
    build: (hb) => anemicInput({ cbc: { hemoglobin: hb } }),
    check: (facts, phase) => {
      assert.equal(facts.anemia.moderateIdaHbCategory, phase === 'past', `moderateIdaHbCategory at hb boundary 9 (${phase})`);
      assert.equal(facts.anemia.mildIdaHbCategory, phase === 'at', `mildIdaHbCategory at hb boundary 9 (${phase})`);
    },
  },
];

// -------------------------------------------------------------------------------------------
// Group 8 — modules/anemia/facts.anemia.js:264-265 marrow-failure age-compatibility windows.
// Adapted from the existing tests/witness/corpus/transient-erythroblastopenia-childhood.json and
// diamond-blackfan-infant.json fixtures (same clinical picture, only the boundary variable
// changes between the at/past builds).
// -------------------------------------------------------------------------------------------

const CYTOPENIA_LOCAL_RANGES = { wbcLower: 4.0, ancLower: 1.5, plateletsLower: 150 };

const ageCompatCases = [
  {
    id: 'TEC-AGE-LOWER',
    source: 'modules/anemia/facts.anemia.js:264 ageMonths >= 6 (marrow.ageCompatibleWithTec lower edge)',
    analyte: 'patient.ageMonths',
    threshold: 6,
    direction: 'marrow.ageCompatibleWithTec iff 6 <= ageMonths < 72',
    at: 6,
    past: 5,
    build: (ageMonths) => baseInput({
      patient: { ageMonths, sexAtBirth: 'female' },
      cbc: {
        hemoglobin: 9,
        mcv: 80,
        wbc: 8.5,
        anc: 3.2,
        platelets: 290,
        localRanges: ageMonths < 6
          ? { hbLower: 11, mcvLower: 75, mcvUpper: 87, ...CYTOPENIA_LOCAL_RANGES }
          : { ...CYTOPENIA_LOCAL_RANGES },
      },
      reticulocytes: { response: 'low' },
      history: { recentViralIllness: true },
      exam: { splenomegaly: false, hepatomegaly: false, lymphadenopathy: false },
    }),
    check: (result, phase) => assert.equal(
      fired(result, 'TEC-001'),
      phase === 'at',
      `TEC-001 (transient erythroblastopenia of childhood) at ageCompatibleWithTec lower edge 6 (${phase})`,
    ),
  },
  {
    id: 'TEC-AGE-UPPER',
    source: 'modules/anemia/facts.anemia.js:264 ageMonths < 72 (marrow.ageCompatibleWithTec upper edge)',
    analyte: 'patient.ageMonths',
    threshold: 72,
    direction: 'marrow.ageCompatibleWithTec iff 6 <= ageMonths < 72',
    at: 72,
    past: 71,
    build: (ageMonths) => baseInput({
      patient: { ageMonths, sexAtBirth: 'female' },
      cbc: {
        hemoglobin: 9, mcv: 80, wbc: 8.5, anc: 3.2, platelets: 290,
        localRanges: { ...CYTOPENIA_LOCAL_RANGES },
      },
      reticulocytes: { response: 'low' },
      history: { recentViralIllness: true },
      exam: { splenomegaly: false, hepatomegaly: false, lymphadenopathy: false },
    }),
    check: (result, phase) => assert.equal(
      fired(result, 'TEC-001'),
      phase === 'past',
      `TEC-001 (transient erythroblastopenia of childhood) at ageCompatibleWithTec upper edge 72 (${phase})`,
    ),
  },
  {
    id: 'DBA-AGE-UPPER',
    source: 'modules/anemia/facts.anemia.js:265 ageMonths < 12 (marrow.ageCompatibleWithDba)',
    analyte: 'patient.ageMonths',
    threshold: 12,
    direction: 'marrow.ageCompatibleWithDba iff ageMonths < 12',
    at: 12,
    past: 11,
    build: (ageMonths) => baseInput({
      patient: { ageMonths, sexAtBirth: 'female' },
      cbc: {
        hemoglobin: 8, mcv: 90, wbc: 8, anc: 3, platelets: 300,
        localRanges: { ...CYTOPENIA_LOCAL_RANGES },
      },
      reticulocytes: { response: 'low' },
      history: { thumbOrRadiusAnomaly: true },
    }),
    check: (result, phase) => assert.equal(
      fired(result, 'IMF-DBA-001'),
      phase === 'past',
      `IMF-DBA-001 (Diamond-Blackfan-type pathway) at ageCompatibleWithDba boundary 12 (${phase})`,
    ),
  },
];

// -------------------------------------------------------------------------------------------
// Group 9 — modules/anemia/rules.json marrow.congenitalSignalCount >= 1 (IMF-001, IMF-DBA-001 —
// same fact/op/value in both rules; tested once here via IMF-001, the simpler of the two).
// Adapted from tests/witness/corpus/fanconi-anemia-phenotype.json.
// -------------------------------------------------------------------------------------------

const congenitalSignalCases = [
  {
    id: 'CONGENITAL-SIGNAL-COUNT',
    source: 'modules/anemia/rules.json IMF-001 and IMF-DBA-001: marrow.congenitalSignalCount gte 1',
    analyte: 'marrow.congenitalSignalCount (count of 5 boolean history signals)',
    threshold: 1,
    direction: 'IMF-001 requires congenitalSignalCount >= 1',
    at: 1,
    past: 0,
    build: (count) => baseInput({
      patient: { ageMonths: 60, sexAtBirth: 'male' },
      cbc: { hemoglobin: 8, mcv: 84, localFlags: { thrombocytopenia: true } },
      reticulocytes: { response: 'low' },
      history: count >= 1 ? { abnormalSkinPigmentation: true } : {},
    }),
    check: (result, phase) => assert.equal(
      fired(result, 'IMF-001'),
      phase === 'at',
      `IMF-001 (inherited marrow failure) at congenitalSignalCount boundary 1 (${phase})`,
    ),
  },
];

// -------------------------------------------------------------------------------------------
// Run every table-driven case: an at-boundary call and a one-unit-past-boundary call, each
// checked against the case's own `check(output, phase)`.
// -------------------------------------------------------------------------------------------

const ALL_CASES = [
  ...rangeCases,
  ...ageEdgeCases,
  ...scopeCases,
  ...ferritinCases,
  ...stfrCases,
  ...hemolysisCases,
  ...leadCases,
  ...hbSeverityCases,
  ...ageCompatCases,
  ...congenitalSignalCases,
];

const CASE_IDS = new Set(ALL_CASES.map((c) => c.id));
assert.equal(CASE_IDS.size, ALL_CASES.length, 'CASES table has duplicate ids');

for (const c of ALL_CASES) {
  test(`${c.id}: ${c.analyte} ${c.direction} — at=${c.at}, past=${c.past} (${c.source})`, () => {
    const runPhase = (value) => {
      const input = c.build(value);
      return c.mode === 'facts' ? deriveFacts(input) : assess(input);
    };
    c.check(runPhase(c.at), 'at');
    c.check(runPhase(c.past), 'past');
  });
}

// -------------------------------------------------------------------------------------------
// Units accept/reject fail-closed boundary (EP-2). Categorical, not a numeric at/past pair, so
// covered by direct tests rather than the CASES table.
// -------------------------------------------------------------------------------------------

test('src/units.js UnitRejectionError: hemoglobinUnit canonical/synonym spellings are accepted', () => {
  const canonical = assess(baseInput({
    patient: { ageMonths: 24, sexAtBirth: 'female' },
    cbc: { hemoglobin: 9, hemoglobinUnit: 'g/dL' },
  }));
  assert.equal(canonical.classification.hemoglobin, 9);

  const synonym = assess(baseInput({
    patient: { ageMonths: 24, sexAtBirth: 'female' },
    cbc: { hemoglobin: 9, hemoglobinUnit: 'g/dl' },
  }));
  assert.equal(synonym.classification.hemoglobin, 9);
});

test('src/units.js UnitRejectionError: hemoglobinUnit confusables (g/L 10x-scale, mmol/L molar) are rejected', () => {
  assert.throws(
    () => assess(baseInput({
      patient: { ageMonths: 24, sexAtBirth: 'female' },
      cbc: { hemoglobin: 9, hemoglobinUnit: 'g/L' },
    })),
    UnitRejectionError,
    'g/L (10x hemoglobin scale confusable) must be rejected fail-closed, not silently divided',
  );

  assert.throws(
    () => assess(baseInput({
      patient: { ageMonths: 24, sexAtBirth: 'female' },
      cbc: { hemoglobin: 9, hemoglobinUnit: 'mmol/L' },
    })),
    UnitRejectionError,
    'mmol/L (molar, not mass concentration) must be rejected fail-closed',
  );
});

test('src/ranges/registry.js UnitRejectionError: cbc.localRanges.hbLowerUnit accept/reject boundary', () => {
  const accepted = getEffectiveRanges({
    patient: { ageMonths: 10, sexAtBirth: 'female' },
    cbc: { localRanges: { hbLower: 9, hbLowerUnit: 'g/dL' } },
  });
  assert.equal(accepted.hbLower, 9);

  assert.throws(
    () => getEffectiveRanges({
      patient: { ageMonths: 10, sexAtBirth: 'female' },
      cbc: { localRanges: { hbLower: 9, hbLowerUnit: 'g/L' } },
    }),
    UnitRejectionError,
    'a local hbLower supplied in the 10x-scale-confusable g/L must be rejected fail-closed',
  );
});

test('src/ranges/registry.js RangeUnitMismatchError: a request unit that mismatches the registered band unit is rejected', () => {
  // Bypasses src/units.js's own pre-validation (which assess()/deriveFacts() always cross first)
  // by calling getEffectiveRanges() directly, proving this is an independent, second fail-closed
  // layer rather than the same check reached twice.
  assert.throws(
    () => getEffectiveRanges({
      patient: { ageMonths: 10, sexAtBirth: 'female' },
      cbc: { hemoglobin: 11, hemoglobinUnit: 'g/L' },
    }),
    RangeUnitMismatchError,
  );
});

// -------------------------------------------------------------------------------------------
// Coverage tripwire 1 — rules.json shape guard. Locks the "exactly 3 numeric leaf conditions"
// scope-correction claim this file's docblock makes, so a future rule edit that adds/removes a
// numeric leaf condition breaks this test loudly instead of silently going uncovered.
// -------------------------------------------------------------------------------------------

const NUMERIC_OPS = new Set(['gt', 'gte', 'lt', 'lte']);

function collectNumericLeaves(condition, ruleId, out) {
  if (!condition) return;
  if (Array.isArray(condition.all)) {
    for (const child of condition.all) collectNumericLeaves(child, ruleId, out);
    return;
  }
  if (Array.isArray(condition.any)) {
    for (const child of condition.any) collectNumericLeaves(child, ruleId, out);
    return;
  }
  if (condition.not) {
    collectNumericLeaves(condition.not, ruleId, out);
    return;
  }
  if (NUMERIC_OPS.has(condition.op)) {
    out.push({ ruleId, fact: condition.fact, op: condition.op, value: condition.value });
  }
}

test('EP6-T2 scope-correction guard: rules.json contains exactly the 3 numeric leaf conditions this suite documents', () => {
  const found = [];
  for (const rule of rules) collectNumericLeaves(rule.when, rule.id, found);

  const expected = [
    { ruleId: 'IMF-001', fact: 'marrow.congenitalSignalCount', op: 'gte', value: 1 },
    { ruleId: 'IMF-DBA-001', fact: 'marrow.congenitalSignalCount', op: 'gte', value: 1 },
    { ruleId: 'Q-NORMO-HIGH-001', fact: 'hemolysis.markerCount', op: 'lt', value: 2 },
  ];

  assert.deepEqual(
    found,
    expected,
    `rules.json's numeric (gt/gte/lt/lte) leaf conditions changed from what this suite's docblock ` +
      `claims (expected ${JSON.stringify(expected)}, found ${JSON.stringify(found)}) — update the ` +
      'scope-correction note and CASES table accordingly',
  );
});

// -------------------------------------------------------------------------------------------
// Coverage tripwire 2 — static-scan guard over facts.anemia.js / ranges.js, modeled on
// tests/witness/corpus.test.mjs's end-of-file coverage guard. Scans for every literal numeric
// comparison (a `<`/`<=`/`>`/`>=` operator immediately followed by a numeric literal — this
// deliberately does NOT match comparisons against a variable/property, e.g. `hb < ranges.hbLower`
// or `ageMonths >= SUPPORTED_AGE_MONTHS_MIN`, since those are already KB-driven and covered by the
// range/scope cases above via getEffectiveRanges()/module.json, not by a source literal that could
// silently drift). Each literal comparison found, IN SOURCE ORDER, must match the next expected
// entry below — either a CASES id that exercises it, or an explicit, reasoned allow-entry for the
// handful that are structural (not clinical thresholds).
//
// Not caught by this scan, and not re-derived here, because it is a caller-supplied bound rather
// than a KB-owned threshold: facts.anemia.js's cytopeniaTri() does
// `countValue < Number(localLowerBound)`, comparing a lab count against whatever local reference
// limit the CALLER supplied — there is no KB literal to drift.
// -------------------------------------------------------------------------------------------

function scanLiteralComparisons(source) {
  const re = /(>=|<=|>|<)\s*(\d+(?:\.\d+)?)/g;
  const matches = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    const start = Math.max(0, m.index - 45);
    matches.push(source.slice(start, m.index + m[0].length).trim());
  }
  return matches;
}

const FACTS_ANEMIA_JS_EXPECTED = [
  { match: 'countPresent(values) > 0', allow: 'triAny(): structural "at least one value is present" check, not a clinical threshold' },
  { match: 'countPresent(values) > 0', allow: 'triNone(): structural "at least one value is present" check, not a clinical threshold' },
  { match: 'stfrFerritinIndex > 2', caseIds: ['STFR-HIGH'] },
  { match: 'stfrFerritinIndex < 1', caseIds: ['STFR-LOW'] },
  { match: 'stfrFerritinIndex >= 1', caseIds: ['STFR-INTERMEDIATE-LOWER'] },
  { match: 'stfrFerritinIndex <= 2', caseIds: ['STFR-INTERMEDIATE-UPPER'] },
  { match: 'hemolysisMarkerCount >= 2', caseIds: ['HEMOLYSIS-PATTERN'] },
  { match: 'bll >= 3.5', caseIds: ['LEAD-ATORABOVE'] },
  { match: 'bll >= 20', caseIds: ['LEAD-20-44-LOWER'] },
  { match: 'bll < 45', caseIds: ['LEAD-45-TRANSITION'] },
  { match: 'bll >= 45', caseIds: ['LEAD-45-TRANSITION'] },
  { match: 'smearValues.length > 0', allow: 'smear.provided: structural "was any smear finding entered" check, not a clinical threshold' },
  { match: 'hb < 7', caseIds: ['HB-SEVERE-MODERATE'] },
  { match: 'hb >= 7', caseIds: ['HB-SEVERE-MODERATE'] },
  { match: 'hb < 9', caseIds: ['HB-MODERATE-MILD'] },
  { match: 'hb >= 9', caseIds: ['HB-MODERATE-MILD'] },
  { match: 'ageMonths >= 6', caseIds: ['TEC-AGE-LOWER'] },
  { match: 'ageMonths < 72', caseIds: ['TEC-AGE-UPPER'] },
  { match: 'ageMonths < 12', caseIds: ['DBA-AGE-UPPER'] },
];

const RANGES_JS_EXPECTED = [
  { match: 'ageMonths >= 144', caseIds: ['FERRITIN-AGE-EDGE-144'] },
  { match: 'ageMonths < 216', caseIds: ['FERRITIN-AGE-EDGE-216'] },
  { match: 'ageMonths >= 6', caseIds: ['FERRITIN-AGE-EDGE-6'] },
  { match: 'ageMonths < 144', caseIds: ['FERRITIN-AGE-EDGE-144'] },
];

function assertCoverage(label, source, expectedList) {
  const found = scanLiteralComparisons(source);
  assert.equal(
    found.length,
    expectedList.length,
    `${label} now has ${found.length} literal numeric comparisons but this suite's tripwire table ` +
      `only accounts for ${expectedList.length} — a threshold was likely added, removed, or changed. ` +
      `Found: ${JSON.stringify(found)}`,
  );
  found.forEach((snippet, i) => {
    const expected = expectedList[i];
    assert.ok(
      snippet.includes(expected.match),
      `${label} comparison #${i} expected to contain "${expected.match}" but found "${snippet}"`,
    );
    if (expected.caseIds) {
      for (const caseId of expected.caseIds) {
        assert.ok(
          CASE_IDS.has(caseId),
          `${label} comparison "${expected.match}" claims coverage by case "${caseId}", which is not in CASES`,
        );
      }
    } else {
      assert.ok(
        typeof expected.allow === 'string' && expected.allow.length > 0,
        `${label} comparison "${expected.match}" has no CASES coverage and no written allow-reason`,
      );
    }
  });
}

test('EP6-T2 coverage tripwire: every literal numeric comparison in facts.anemia.js is covered by CASES or explicitly allowlisted', () => {
  assertCoverage('modules/anemia/facts.anemia.js', factsSource, FACTS_ANEMIA_JS_EXPECTED);
});

test('EP6-T2 coverage tripwire: every literal numeric comparison in ranges.js is covered by CASES or explicitly allowlisted', () => {
  assertCoverage('modules/anemia/ranges.js', rangesSource, RANGES_JS_EXPECTED);
});

// ==================================================================================================
// Group 6 — THRESHOLD-VALUE PINNING (added by the EP-6 orchestrator after the EP6-T3 mutation run).
//
// Why this group exists. The EP6-T3 mutation runner found 3 surviving mutants after every other
// EP-6 suite was in the victim set: RANGES-06/07/08, perturbing the ferritin threshold values
// 30 -> 31, 30 -> 31 and 20 -> 21 in modules/anemia/ranges.js. Those are precisely the values the
// phase plan names as ITS OWN example for FR-WP6-02 ("ferritin exactly at 20/30 ng/mL"), so a
// boundary suite that cannot detect them is not meeting its acceptance criterion.
//
// The root cause is a test-design trap worth naming: the Group 3 ferritin cases read their expected
// value at runtime via `getFerritinThreshold(...)` — from the very source under test. When the
// threshold moves, the expectation moves with it, so the case can verify the COMPARISON but is
// structurally blind to the VALUE. Reading thresholds from the KB at runtime is the right default
// for reference-range DATA (there the data is the spec, and hardcoding invites drift), but it is
// exactly wrong for the clinical value that is itself the claim under test.
//
// Pinning these literals is NOT "inventing a threshold" — the values already exist in the KB and
// carry an evidence citation (`source: 'AAP2026_IDA'`). Pinning them with that citation is what
// makes an unreviewed change to a published clinical threshold fail loudly instead of silently
// re-baselining every test that depends on it.
// ==================================================================================================

const PINNED_FERRITIN_THRESHOLDS = [
  {
    id: 'PIN-FERRITIN-MENSTRUATING',
    args: { ageMonths: 168, menstruating: true },
    value: 30,
    source: 'AAP2026_IDA',
    rationale: 'all menstruating patients',
  },
  {
    id: 'PIN-FERRITIN-ADOLESCENT',
    args: { ageMonths: 168, menstruating: false },
    value: 30,
    source: 'AAP2026_IDA',
    rationale: 'adolescent age band',
  },
  {
    id: 'PIN-FERRITIN-YOUNG-SCHOOL',
    args: { ageMonths: 100, menstruating: false },
    value: 20,
    source: 'AAP2026_IDA',
    rationale: 'young or school-aged child',
  },
];

for (const pinned of PINNED_FERRITIN_THRESHOLDS) {
  test(`EP6-T2 ${pinned.id}: ferritin threshold value is pinned to ${pinned.value} ng/mL (${pinned.rationale})`, () => {
    const actual = getFerritinThreshold(pinned.args.ageMonths, pinned.args.menstruating);
    assert.ok(actual, `${pinned.id}: expected a ferritin threshold rule to apply for ${JSON.stringify(pinned.args)}`);
    assert.equal(
      actual.value,
      pinned.value,
      `${pinned.id}: ferritin threshold is a published clinical value (${pinned.source}, "${pinned.rationale}"). `
      + `Expected ${pinned.value} ng/mL, got ${actual.value}. If this changed deliberately it requires `
      + `independent clinical review and an evidence update — not a test edit.`,
    );
    assert.equal(
      actual.source,
      pinned.source,
      `${pinned.id}: threshold must retain its evidence citation (expected ${pinned.source}, got ${actual.source})`,
    );
  });
}

test('EP6-T2 PIN-FERRITIN-OUT-OF-BAND: no ferritin threshold applies outside the supported non-menstruating age bands', () => {
  assert.equal(getFerritinThreshold(4, false), null, 'below the 6-month band edge no ferritin rule should apply');
  assert.equal(getFerritinThreshold(216, false), null, 'at/above the 216-month band edge no ferritin rule should apply');
});
