// EP6-T5 — DISCLOSED-GAP PINS on the dangerous-miss adversarial review findings register.
//
// =============================================================================================
// READ THIS BEFORE TOUCHING ANYTHING BELOW.
//
// Every test in this file asserts what the engine DOES TODAY, including where that behavior is
// WRONG and CLINICALLY DANGEROUS. These are pins on a disclosed gap, not approval of the
// behavior, and not a specification of what the engine should do. The source of truth for why
// each behavior is dangerous is `.claude/findings/wave0-ep6-validation-corpus-findings.md`
// (EP6T5-001 through EP6T5-019) — read a finding's full writeup there before touching its pin.
//
// The repository guardrail is explicit: no AI-published rule/KB changes. The defects pinned here
// are filed for independent clinical review and cannot be repaired inside this phase or by an AI
// session — doing so here would be the exact governance violation the program exists to prevent.
//
// A FAILURE in this file is NOT necessarily a regression. It may mean someone fixed the
// underlying defect (with the required clinical review + signed release). If a test here fails
// because the engine now does the SAFER thing:
//   1. Do NOT revert the fix.
//   2. Update this pin to match the new (safer) behavior.
//   3. Update the corresponding finding's disposition in
//      `.claude/findings/wave0-ep6-validation-corpus-findings.md` to reflect that it was closed,
//      by whom, and under what review.
// A future reader who mistakes a passing test here for "this behavior is correct" has
// misunderstood the file. A future reader who "fixes" a failure here by reverting someone else's
// genuine safety fix has done real harm.
// =============================================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assessPediatricAnemia } from '../src/engine.js';

const rules = JSON.parse(await readFile(new URL('../modules/anemia/rules.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(await readFile(new URL('../modules/anemia/candidates.json', import.meta.url), 'utf8'));

function assess(patientInput) {
  return assessPediatricAnemia(patientInput, rules, candidates);
}

// Recursively collects every `fact` leaf value referenced anywhere in the rule DSL tree
// (nested inside arbitrary all/any/not compositions), for EP6T5-001's structural assertion.
function collectFactValues(node, out = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) collectFactValues(item, out);
    return out;
  }
  if (node && typeof node === 'object') {
    if (typeof node.fact === 'string') out.add(node.fact);
    for (const value of Object.values(node)) collectFactValues(value, out);
  }
  return out;
}

// =============================================================================================
// EP6T5-001 — CRITICAL — raw cbc.wbc / cbc.anc / cbc.platelets counts are never interpreted.
// Why dangerous: a 4-year-old with Hb 9.5, WBC 1.1, ANC 0.18, platelets 14, and fever — textbook
// febrile neutropenia + pancytopenia, an emergency — currently produces ZERO alerts and an empty
// differential, because cytopeniaTri() (modules/anemia/facts.anemia.js) returns 'unknown' unless
// the caller separately supplies cbc.localRanges.*Lower or ticks cbc.localFlags.*, and no question
// rule ever prompts for either. Clinical question: may a pediatric anemia CDS accept raw
// WBC/ANC/platelet counts it holds no reference interval for, or must it carry built-in age-banded
// bounds, or fail closed?
// =============================================================================================

test('EP6T5-001 DISCLOSED GAP: raw WBC/ANC/platelet counts are currently inert — pancytopenia + fever with no local ranges/flags produces zero alerts and an empty differential', () => {
  const result = assess({
    patient: { ageMonths: 48, sexAtBirth: 'male' },
    cbc: { hemoglobin: 9.5, mcv: 85, wbc: 1.1, anc: 0.18, platelets: 14 },
    symptoms: { fever: true },
  });
  assert.deepEqual(result.alerts, [], 'DANGEROUS: febrile neutropenia + pancytopenia currently raises no alert');
  assert.deepEqual(result.rankedDifferential, [], 'DANGEROUS: no candidate is entered from raw counts alone');
});

test('EP6T5-001 CONTROL (proves the pin above is not vacuous): the SAME counts plus cbc.localFlags for leukopenia/neutropenia/thrombocytopenia DO fire the emergency/urgent alerts', () => {
  const result = assess({
    patient: { ageMonths: 48, sexAtBirth: 'male' },
    cbc: {
      hemoglobin: 9.5,
      mcv: 85,
      wbc: 1.1,
      anc: 0.18,
      platelets: 14,
      localFlags: { leukopenia: true, neutropenia: true, thrombocytopenia: true },
    },
    symptoms: { fever: true },
  });
  const alertIds = result.alerts.map((alert) => alert.id);
  assert.ok(alertIds.includes('ALERT-009'), 'control: emergency febrile-neutropenia alert must fire once flags are supplied');
  assert.ok(alertIds.includes('ALERT-004'), 'control: urgent alert must fire once flags are supplied');
  const emergency = result.alerts.find((alert) => alert.id === 'ALERT-009');
  assert.equal(emergency.severity, 'emergency');
});

test('EP6T5-001 STRUCTURAL: cbc.wbc, cbc.anc, and cbc.platelets are referenced by 0 of the 91 rules in rules.json', () => {
  const factValues = collectFactValues(rules);
  assert.equal(factValues.has('cbc.wbc'), false, 'DANGEROUS: no rule anywhere consults the raw WBC count');
  assert.equal(factValues.has('cbc.anc'), false, 'DANGEROUS: no rule anywhere consults the raw ANC count');
  assert.equal(factValues.has('cbc.platelets'), false, 'DANGEROUS: no rule anywhere consults the raw platelet count');
});

// =============================================================================================
// EP6T5-003 — CRITICAL — a malformed local range is accepted as the anemia threshold.
// Why dangerous: modules/anemia/ranges.js's pick() does Number(raw) and checks only
// Number.isFinite(); Number([]) === 0 and Number(true) === 1. A 4-year-old with Hb 5.0 g/dL (a
// transfusion-threshold emergency) is reported as "No anemia by the supplied threshold" if
// cbc.localRanges.hbLower is malformed as [] or true — a single malformed field converts a severe
// emergency into an explicit reassurance and suppresses ALERT-003.
// =============================================================================================

test('EP6T5-003 DISCLOSED GAP: currently a malformed cbc.localRanges.hbLower of [] coerces to 0 and reports "no anemia" for Hb 5.0 g/dL', () => {
  const result = assess({
    patient: { ageMonths: 48, sexAtBirth: 'male' },
    cbc: { hemoglobin: 5, mcv: 80, localRanges: { hbLower: [] } },
  });
  assert.equal(result.classification.anemiaStatus, 'absent', 'DANGEROUS: Hb 5.0 g/dL reported as no anemia');
  assert.equal(result.classification.hemoglobinLowerLimit, 0, 'DANGEROUS: Number([]) coerced to 0 as the threshold');
  assert.deepEqual(result.alerts, [], 'DANGEROUS: ALERT-003 (severe anemia) is suppressed');
  assert.ok(
    result.interpretiveNotes.some((note) => note.id === 'NOTE-001'),
    'DANGEROUS: NOTE-001 ("No anemia by the supplied threshold") is affirmatively emitted',
  );
});

test('EP6T5-003 DISCLOSED GAP: currently a malformed cbc.localRanges.hbLower of true coerces to 1, same false reassurance for Hb 5.0 g/dL', () => {
  const result = assess({
    patient: { ageMonths: 48, sexAtBirth: 'male' },
    cbc: { hemoglobin: 5, mcv: 80, localRanges: { hbLower: true } },
  });
  assert.equal(result.classification.anemiaStatus, 'absent', 'DANGEROUS: Hb 5.0 g/dL reported as no anemia');
  assert.equal(result.classification.hemoglobinLowerLimit, 1, 'DANGEROUS: Number(true) coerced to 1 as the threshold');
  assert.deepEqual(result.alerts, []);
  assert.ok(result.interpretiveNotes.some((note) => note.id === 'NOTE-001'));
});

test('EP6T5-003 CONTROL (proves the pin is not vacuous): a non-numeric string like "abc" falls back correctly to the built-in threshold and ALERT-003 fires', () => {
  const result = assess({
    patient: { ageMonths: 48, sexAtBirth: 'male' },
    cbc: { hemoglobin: 5, mcv: 80, localRanges: { hbLower: 'abc' } },
  });
  assert.equal(result.classification.anemiaStatus, 'present', 'control: a string that fails Number.isFinite falls back correctly');
  assert.equal(result.classification.hemoglobinLowerLimit, 11, 'control: falls back to the built-in threshold');
  assert.ok(result.alerts.some((alert) => alert.id === 'ALERT-003'), 'control: severe-anemia alert fires when the fallback works');
});

// =============================================================================================
// EP6T5-004 — CRITICAL — the severe-anemia alert is suppressed when sexAtBirth is absent.
// Why dangerous: ALERT-003 keys on a resolved hbLower, which requires both an age band AND a sex
// key. A hemoglobin of 3.0 g/dL is critical on its face and needs no demographic to say so, yet
// omitting sexAtBirth (which is optional in both the SPA and the schema) degrades the most severe
// numeric red flag in the tool to an "important"-severity completeness notice. Clinical question:
// what absolute hemoglobin value should alert irrespective of age/sex, and should it be age-banded?
// =============================================================================================

test('EP6T5-004 DISCLOSED GAP: currently Hb 3.0 g/dL with sexAtBirth omitted does NOT raise ALERT-003 — it degrades to an indeterminate completeness notice', () => {
  const result = assess({
    patient: { ageMonths: 60 },
    cbc: { hemoglobin: 3.0, mcv: 70 },
  });
  const alertIds = result.alerts.map((alert) => alert.id);
  assert.ok(!alertIds.includes('ALERT-003'), 'DANGEROUS: the severe-anemia alert does not fire for Hb 3.0 g/dL without sexAtBirth');
  assert.ok(alertIds.includes('SCOPE-003'), 'the only signal is a completeness/scope notice, not a clinical alert');
  assert.equal(result.classification.anemiaStatus, 'indeterminate', 'DANGEROUS: a Hb of 3.0 g/dL classifies as indeterminate, not present');
});

test('EP6T5-004 CONTROL (proves the pin is not vacuous): the SAME hemoglobin with sexAtBirth supplied resolves the threshold and fires ALERT-003', () => {
  const result = assess({
    patient: { ageMonths: 60, sexAtBirth: 'male' },
    cbc: { hemoglobin: 3.0, mcv: 70 },
  });
  assert.equal(result.classification.anemiaStatus, 'present');
  assert.ok(result.alerts.some((alert) => alert.id === 'ALERT-003'), 'control: ALERT-003 fires once sexAtBirth is supplied');
});

// =============================================================================================
// EP6T5-005 — CRITICAL — a classic acute-leukemia presentation returns a completely empty
// assessment. Why dangerous: a 5-year-old with Hb 7.5, WBC 45, platelets 30, hepatosplenomegaly,
// lymphadenopathy, unexplained bruising, and petechiae — combined with EP6T5-001 (WBC/platelets
// invisible) — has no reticulocyte-independent path into any candidate or alert. Even supplying a
// low reticulocyte response only reaches an unranked "not-excluded"-class candidate with NO alert.
// Clinical question: should hepatosplenomegaly/lymphadenopathy/petechiae with anemia raise an
// alert, not merely a candidate?
// =============================================================================================

test('EP6T5-005 DISCLOSED GAP: currently a classic acute-leukemia presentation (hepatosplenomegaly + lymphadenopathy + bruising + petechiae + WBC 45 + platelets 30) produces zero alerts AND an empty differential', () => {
  const result = assess({
    patient: { ageMonths: 60, sexAtBirth: 'male' },
    cbc: { hemoglobin: 7.5, mcv: 85, wbc: 45, platelets: 30 },
    exam: {
      splenomegaly: true,
      hepatomegaly: true,
      lymphadenopathy: true,
      unexplainedBruising: true,
      petechiae: true,
    },
  });
  assert.deepEqual(result.alerts, [], 'DANGEROUS: this presentation raises no alert at all');
  assert.deepEqual(result.rankedDifferential, [], 'DANGEROUS: this presentation enters no candidate at all');
});

test('EP6T5-005 DISCLOSED GAP: currently even WITH a low reticulocyte response, the same presentation still raises zero alerts (only an unalarmed candidate appears)', () => {
  const result = assess({
    patient: { ageMonths: 60, sexAtBirth: 'male' },
    cbc: { hemoglobin: 7.5, mcv: 85, wbc: 45, platelets: 30 },
    exam: {
      splenomegaly: true,
      hepatomegaly: true,
      lymphadenopathy: true,
      unexplainedBruising: true,
      petechiae: true,
    },
    reticulocytes: { response: 'low' },
  });
  assert.deepEqual(result.alerts, [], 'DANGEROUS: still no alert even with retic low supplied');
  assert.deepEqual(
    result.rankedDifferential.map((candidate) => candidate.id),
    ['marrow-failure-infiltration'],
    'the only signal is a single candidate entry, with no accompanying alert',
  );
});

// =============================================================================================
// EP6T5-006 — HIGH — POST /api/v1/assess (and direct assess() callers) perform no numeric
// plausibility gating on hemoglobin; the failure mode is inverted relative to safety. Why
// dangerous: the careful caller who correctly declares hemoglobinUnit: 'g/L' is protected (the
// engine throws), but the careless caller who omits the unit is NOT — Hb 62 (a g/L value, ~6.2
// g/dL in the wrong unit, or simply an implausible g/dL reading) is silently read as 62 g/dL and
// reported as "no anemia." g/L is the single most-cited confusable unit in the KB's own
// units.json.
// =============================================================================================

test('EP6T5-006 DISCLOSED GAP: currently an unlabelled Hb of 62 (plausible only as g/L, physiologically absurd as g/dL) is accepted at face value and reported as "no anemia"', () => {
  const result = assess({
    patient: { ageMonths: 60, sexAtBirth: 'male' },
    cbc: { hemoglobin: 62, mcv: 70 },
  });
  assert.equal(result.classification.anemiaStatus, 'absent', 'DANGEROUS: an implausible unlabelled Hb of 62 is reported as no anemia');
  assert.ok(result.interpretiveNotes.some((note) => note.id === 'NOTE-001'), 'DANGEROUS: the reassuring NOTE-001 is emitted');
});

test('EP6T5-006 CONTROL (proves the failure mode is inverted, not vacuous): the SAME value with hemoglobinUnit explicitly declared as "g/L" correctly throws UnitRejectionError, protecting only the careful caller', () => {
  assert.throws(
    () => assess({
      patient: { ageMonths: 60, sexAtBirth: 'male' },
      cbc: { hemoglobin: 62, mcv: 70, hemoglobinUnit: 'g/L' },
    }),
    (error) => {
      assert.equal(error.name, 'UnitRejectionError', 'control: declaring the wrong unit fails closed via the typed unit-rejection error');
      assert.equal(error.code, 'UNIT_REJECTED');
      return true;
    },
  );
});

// =============================================================================================
// EP6T5-007 — HIGH — not(... is-present) treats *unassessed* as *assessed-and-absent*. Why
// dangerous: TEC-001's exclusion is not(any(exam.splenomegaly is-present, exam.hepatomegaly
// is-present, exam.lymphadenopathy is-present, smear.blasts eq true)); is-present is false for
// 'unknown', so an exam that was simply never performed satisfies the "no organomegaly" exclusion
// exactly as if it had been performed and was negative. This is the single distinction that
// matters most between benign transient erythroblastopenia and leukemia in a 3-year-old with Hb
// 6.5. The same construct exists in IRIDA-001, Q-MICRO-003, Q-MICRO-005, Q-NORMO-HIGH-002,
// Q-NORMO-LOW-001 (not re-pinned individually here — see the findings register).
// =============================================================================================

test('EP6T5-007 DISCLOSED GAP: currently an UNPERFORMED exam (never documented, not "negative") satisfies TEC-001\'s "no organomegaly" exclusion identically to a genuinely negative exam, yielding the benign diagnosis alone', () => {
  const result = assess({
    patient: { ageMonths: 36, sexAtBirth: 'male' },
    cbc: {
      hemoglobin: 6.5,
      mcv: 80,
      localFlags: { leukopenia: false, neutropenia: false, thrombocytopenia: false },
    },
    reticulocytes: { response: 'low' },
    history: { recentViralIllness: true },
  });
  assert.deepEqual(
    result.rankedDifferential.map((candidate) => candidate.id),
    ['transient-erythroblastopenia'],
    'DANGEROUS: an exam that was never performed resolves to the sole benign candidate, exactly as a negative exam would',
  );
});

test('EP6T5-007 CONTROL (proves the pin is not vacuous): supplying an actually-positive exam.splenomegaly flips the differential to marrow-failure-infiltration', () => {
  const result = assess({
    patient: { ageMonths: 36, sexAtBirth: 'male' },
    cbc: {
      hemoglobin: 6.5,
      mcv: 80,
      localFlags: { leukopenia: false, neutropenia: false, thrombocytopenia: false },
    },
    reticulocytes: { response: 'low' },
    history: { recentViralIllness: true },
    exam: { splenomegaly: true },
  });
  assert.deepEqual(
    result.rankedDifferential.map((candidate) => candidate.id),
    ['marrow-failure-infiltration'],
    'control: a genuinely positive exam finding changes the differential entirely',
  );
});

test('EP6T5-007 DISCLOSED GAP: currently no limitation string discloses that the benign-only differential above rested on an UNASSESSED exam (narrow check: generic "examination" boilerplate does NOT count as disclosure)', () => {
  const result = assess({
    patient: { ageMonths: 36, sexAtBirth: 'male' },
    cbc: {
      hemoglobin: 6.5,
      mcv: 80,
      localFlags: { leukopenia: false, neutropenia: false, thrombocytopenia: false },
    },
    reticulocytes: { response: 'low' },
    history: { recentViralIllness: true },
  });
  // Deliberately narrow: CORE_LIMITATIONS always contains the standing boilerplate "...substitute
  // for examination and specialist judgment." — that generic disclaimer is NOT a disclosure that
  // THIS specific output's exclusion relied on an exam that was never performed. The orchestrator
  // that authored the findings register initially mis-matched on the word "examination" inside
  // that boilerplate and had to self-correct (see the findings doc's Corrections section) — this
  // regex intentionally targets only real disclosure language, not the word "exam"/"examination".
  const discloses = result.limitations.some((limitation) => /unassessed|not assessed|were not evaluated/i.test(limitation));
  assert.equal(discloses, false, 'DANGEROUS: no limitation specifically names the unassessed exam fields the exclusion relied on');
});

// =============================================================================================
// EP6T5-008 — HIGH — malformed input makes the engine MORE confident: out-of-enum
// reticulocyte responses and a string (rather than array) smear value silently delete the
// compensating safety questions. Why dangerous: in both cases the malformed value produces a
// result strictly WORSE than omitting the field entirely — omission at least keeps the safety-net
// question alive.
// =============================================================================================

test('EP6T5-008 DISCLOSED GAP: currently reticulocytes.response "unknown" correctly keeps the missing-retic safety question Q-004 alive', () => {
  const result = assess({
    patient: { ageMonths: 48, sexAtBirth: 'male' },
    cbc: { hemoglobin: 6.5, mcv: 82 },
    reticulocytes: { response: 'unknown' },
  });
  assert.ok(result.nextQuestions.some((question) => question.id === 'Q-004'), 'the explicit "unknown" value keeps Q-004 alive (this direction is correct)');
});

test('EP6T5-008 DISCLOSED GAP: currently an out-of-enum reticulocytes.response value ("decreased", not a real enum member) is treated as KNOWN and silently deletes the Q-004 safety question', () => {
  const result = assess({
    patient: { ageMonths: 48, sexAtBirth: 'male' },
    cbc: { hemoglobin: 6.5, mcv: 82 },
    reticulocytes: { response: 'decreased' },
  });
  assert.deepEqual(result.nextQuestions, [], 'DANGEROUS: an out-of-enum string silently removes the missing-retic prompt, worse than omitting the field');
});

test('EP6T5-008 DISCLOSED GAP: currently a numeric reticulocytes.response (0.5, wrong field shape) is ALSO treated as known and deletes the Q-004 safety question', () => {
  const result = assess({
    patient: { ageMonths: 48, sexAtBirth: 'male' },
    cbc: { hemoglobin: 6.5, mcv: 82 },
    reticulocytes: { response: 0.5 },
  });
  assert.deepEqual(result.nextQuestions, [], 'DANGEROUS: a numeric value in the wrong field shape also silently removes the missing-retic prompt');
});

const EP6T5_008_SMEAR_BASE = {
  patient: { ageMonths: 48, sexAtBirth: 'male' },
  cbc: { hemoglobin: 6.5, mcv: 82 },
  reticulocytes: { response: 'high' },
  labs: { indirectBilirubinStatus: 'elevated', ldhStatus: 'elevated' },
};

test('EP6T5-008 CONTROL: a correctly-shaped smear array ["schistocytes"] enters the microangiopathic-hemolysis candidate', () => {
  const result = assess({ ...EP6T5_008_SMEAR_BASE, smear: ['schistocytes'] });
  assert.ok(
    result.rankedDifferential.some((candidate) => candidate.id === 'microangiopathic-hemolysis'),
    'control: the correctly-shaped array reaches the MAHA candidate',
  );
});

test('EP6T5-008 DISCLOSED GAP: currently a STRING smear value ("schistocytes" instead of ["schistocytes"]) silently loses the microangiopathic-hemolysis candidate — Array.prototype methods are not called on a string, but .length still reads truthy', () => {
  const result = assess({ ...EP6T5_008_SMEAR_BASE, smear: 'schistocytes' });
  assert.ok(
    !result.rankedDifferential.some((candidate) => candidate.id === 'microangiopathic-hemolysis'),
    'DANGEROUS: a scalar string smear value never matches includes(), so the MAHA candidate never enters, silently',
  );
});

test('EP6T5-008 DISCLOSED GAP: currently smear:[] (genuinely empty) keeps the Q-SMEAR-001 safety question alive, while the malformed string case above does NOT — the malformed value is silently worse than an honest empty array', () => {
  const emptyArrayResult = assess({ ...EP6T5_008_SMEAR_BASE, smear: [] });
  const stringResult = assess({ ...EP6T5_008_SMEAR_BASE, smear: 'schistocytes' });
  assert.ok(
    emptyArrayResult.nextQuestions.some((question) => question.id === 'Q-SMEAR-001'),
    'an honestly empty smear array keeps the smear safety-net question alive',
  );
  assert.ok(
    !stringResult.nextQuestions.some((question) => question.id === 'Q-SMEAR-001'),
    'DANGEROUS: a malformed scalar smear value has `.length > 0`, so `provided` reads true and the safety-net question silently disappears',
  );
});

// =============================================================================================
// EP6T5-017 — LOW — supportedAgeMonths.max: 216 is exclusive in code but reads inclusive,
// including in its own refusal message. Why dangerous (scope-honesty, not a clinical miss): age
// 215 is accepted; age 216 is refused with a message that says "...supported age range (6-216
// months)" — a message that states 216 is inside the range while simultaneously refusing it. This
// pin exists to catch anyone "fixing" the wording without checking whether the boundary itself
// should move.
// =============================================================================================

test('EP6T5-017 DISCLOSED GAP: currently age 215 months is accepted (inside the supported range)', () => {
  const result = assess({
    patient: { ageMonths: 215, sexAtBirth: 'male' },
    cbc: { hemoglobin: 12, mcv: 80 },
  });
  assert.equal(result.classification.anemiaStatus, 'present');
});

test('EP6T5-017 DISCLOSED GAP: currently age 216 months is REFUSED, and the refusal message text self-contradictorily states the range as "6-216 months" (inclusive-reading) while excluding 216', () => {
  assert.throws(
    () => assess({
      patient: { ageMonths: 216, sexAtBirth: 'male' },
      cbc: { hemoglobin: 12, mcv: 80 },
    }),
    (error) => {
      assert.equal(error.name, 'AgeOutOfSupportedRangeError');
      assert.match(error.message, /6-216/, 'DANGEROUS/self-contradictory: the refusal message names "6-216" as the range');
      // Pin the contradiction explicitly: 216 reads as if it were inside "6-216" yet is refused.
      assert.match(error.message, /outside this module's supported age range/i, 'the same message frames 216 as OUTSIDE the range it just named as "6-216"');
      return true;
    },
  );
});
