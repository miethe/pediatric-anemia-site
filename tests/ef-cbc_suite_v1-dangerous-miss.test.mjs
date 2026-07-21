// tests/ef-cbc_suite_v1-dangerous-miss.test.mjs — P4-T8 (FR-17, `02 §5.4`): dangerous-miss test
// corpus for the `modules/cbc_suite_v1/` vertical slice, run through the real engine seam
// (`src/engine.js#assess(input, 'cbc_suite_v1', rules, candidates)` — the exact path P4-T9's
// integration run re-verifies), never a hand-rolled facts object.
//
// `02 §5.4` names "a benign high-scoring candidate distracting from a higher-severity alert" as a
// dangerous-miss hazard. This module's version of that hazard is exactly the pairing this plan's
// binding "FR-16(c) candidate identity" resolution (see
// docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
// "Decisions & OQ Resolutions") calls out by name: the benign-ethnic/Duffy-null neutropenia
// differential candidate (CBC-NEUT-BENIGNDIFF-001 / `benign-ethnic-neutropenia-differential-
// pattern`) can legitimately co-occur, in the same patient, with the marrow-red-flag safety alert
// (CBC-MARROW-REDFLAG-001) — `modules/cbc_suite_v1/rule-provenance.json`'s own authoringNotes for
// CBC-MARROW-REDFLAG-001 record the decision's `conflicts.representation` as
// `alert_dominates_cooccurring_candidate_ranking`, and `modules/cbc_suite_v1/candidates.json`'s
// `benign-ethnic-neutropenia-differential-pattern` entry's own `cautions`/`nextSteps` say the same
// thing from the candidate side: "Never suppress or downrank a co-occurring marrow-red-flag alert
// ... because this pattern also matched — the red-flag rule must always dominate ranking when both
// are present."
//
// This module's engine keeps alerts and ranked candidates as two separate output arrays
// (`result.alerts`, `result.rankedDifferential` — see `src/ruleEngine.js#runRules`), so there is no
// single combined list whose order could literally hide the alert behind the candidate. "Dominates
// ranking" is proven two ways below instead: (1) the alert fires and is present in `result.alerts`
// with its full evidence-resolved `urgent` severity — it is never suppressed, downranked, or
// omitted just because a candidate also matched in the same assess() call, and (2) the benign
// candidate is STILL present in `result.rankedDifferential` (proving the module does not achieve
// "the alert wins" by silently deleting the candidate — both must be visible to the clinician
// simultaneously, per the candidate's own `cautions` wording above), and (3) architecturally, this
// module's only rendering surface (`src/app.js` — `renderAlerts(result.alerts)` is called before
// `renderCandidates(result.rankedDifferential)`) always surfaces the alerts section above the
// differential-candidates section, so the alert is never buried beneath a benign pattern match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assess } from '../src/engine.js';

const rules = JSON.parse(
  await readFile(new URL('../modules/cbc_suite_v1/rules.json', import.meta.url), 'utf8'),
);
const candidates = JSON.parse(
  await readFile(new URL('../modules/cbc_suite_v1/candidates.json', import.meta.url), 'utf8'),
);

function assessCbcSuite(input) {
  return assess(input, 'cbc_suite_v1', rules, candidates);
}

// Single input engineered to match BOTH rules simultaneously, matching P4-T8's binding acceptance
// criterion: mild anemia (hb 9.5, just below the 24-month hbLower of 11) co-occurring with a local-
// lab-flagged neutropenia. `cbc.localFlags.neutropenia: true` resolves `cbc.neutropenia` to 'true'
// directly (`modules/anemia/facts.anemia.js#cytopeniaTri` short-circuits on a truthy local flag,
// regardless of any ANC value), which simultaneously satisfies:
//   - CBC-NEUT-BENIGNDIFF-001's `when: { fact: "cbc.neutropenia", op: "is-present" }` (the benign
//     differential candidate), AND
//   - CBC-MARROW-REDFLAG-001's `when: { fact: "cbc.multilineageCytopenia", op: "is-present" }`,
//     since `multilineageCytopenia = triAll([anemiaPresentTri, triAny([leukopeniaTri,
//     neutropeniaTri, thrombocytopeniaTri])])` resolves 'true' once anemia is present AND at least
//     one of the three (here, neutropenia) resolves 'true'.
// `cbc.anc` is deliberately omitted so rule (b)'s `cbc.anc exists` guard does not also fire and
// crowd the alerts array with an unrelated interpretive note — this scenario isolates the rule
// (c)-vs-rule (d) co-occurrence the hazard names.
function dangerousMissInput() {
  return {
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: {
      hemoglobin: 9.5,
      localFlags: { neutropenia: true },
    },
  };
}

test('dangerous-miss: marrow-red-flag alert activates and is not suppressed by a co-occurring benign neutropenia-differential candidate match', () => {
  const result = assessCbcSuite(dangerousMissInput());

  // Both rules actually matched — this is a genuine co-occurrence, not a single-rule case.
  assert.ok(
    result.provenance.matchedRuleIds.includes('CBC-MARROW-REDFLAG-001'),
    'the marrow-red-flag rule must match given anemia + a co-occurring neutropenia',
  );
  assert.ok(
    result.provenance.matchedRuleIds.includes('CBC-NEUT-BENIGNDIFF-001'),
    'the benign-ethnic/Duffy-null neutropenia differential rule must ALSO match on the same input '
      + '— this is the exact co-occurrence the dangerous-miss hazard requires, not a fixture that '
      + 'only exercises one rule',
  );

  // (1) The alert fires, with its full evidence-resolved severity — never suppressed or downranked
  // by the co-occurring candidate match.
  const alert = result.alerts.find((entry) => entry.id === 'CBC-MARROW-REDFLAG-001');
  assert.ok(
    alert,
    'the marrow-red-flag alert must be present in result.alerts despite the co-occurring benign '
      + 'candidate match — this is the dangerous-miss failure mode if absent',
  );
  assert.equal(
    alert.severity,
    'urgent',
    'the alert\'s severity must remain the evidence-resolved "urgent", not be softened by the '
      + 'presence of a co-occurring benign pattern',
  );
  assert.ok(
    alert.title.toLowerCase().includes('marrow'),
    'the alert must still name the marrow-failure/infiltration concern explicitly',
  );
  assert.ok(
    alert.detail.toLowerCase().includes('benign')
      || alert.actions.some((action) => action.toLowerCase().includes('benign')),
    'the alert\'s own content must warn against letting a co-occurring benign neutropenia pattern '
      + 'suppress or delay the referral (rule-provenance.json\'s dec_cbc_marrow_red_flag_001 basis)',
  );

  // (2) The benign candidate is STILL present and visible — "dominates" means the alert is never
  // hidden, not that the candidate itself is deleted out from under the clinician.
  const candidate = result.rankedDifferential.find(
    (entry) => entry.id === 'benign-ethnic-neutropenia-differential-pattern',
  );
  assert.ok(
    candidate,
    'the co-occurring benign-ethnic-neutropenia-differential-pattern candidate must remain visible '
      + 'in rankedDifferential — the alert dominating ranking must not delete the candidate outright',
  );
  assert.ok(
    candidate.cautions.some((caution) => caution.toLowerCase().includes('marrow-red-flag')),
    'the candidate\'s own cautions must warn the clinician not to let this pattern suppress or '
      + 'downrank a co-occurring marrow-red-flag alert',
  );

  // (3) Alerts are always the module's most prominent surfaced signal: no rule in this module can
  // ever demote an alert below a candidate, because they are structurally separate output channels
  // (result.alerts vs result.rankedDifferential) and the only rendering surface for this KB
  // (src/app.js) renders the alerts section before the differential-candidates section
  // unconditionally — the candidate matching in the same assess() call has no mechanism by which it
  // could suppress, reorder past, or bury the alert.
  assert.ok(
    result.alerts.length >= 1,
    'at least the marrow-red-flag alert must be present — the alerts channel is never emptied by a '
      + 'co-occurring candidate match',
  );
});

test('dangerous-miss: the forbidden failure mode — an alert-only or candidate-only reading of this input would itself be wrong', () => {
  const result = assessCbcSuite(dangerousMissInput());

  // Guards against a future regression that fixes one rule by accidentally breaking the other
  // (e.g. making CBC-NEUT-BENIGNDIFF-001 mutually exclusive with CBC-MARROW-REDFLAG-001, or vice
  // versa) — both signals are required to be present together for this to be a real coverage of
  // the "benign candidate distracting from alert" hazard, not an accidental single-rule pass.
  assert.equal(
    result.alerts.filter((entry) => entry.id === 'CBC-MARROW-REDFLAG-001').length,
    1,
    'exactly one marrow-red-flag alert entry must be present (no duplication, no omission)',
  );
  assert.equal(
    result.rankedDifferential.filter(
      (entry) => entry.id === 'benign-ethnic-neutropenia-differential-pattern',
    ).length,
    1,
    'exactly one benign-ethnic-neutropenia-differential-pattern candidate entry must be present '
      + '(no duplication, no omission)',
  );
});
