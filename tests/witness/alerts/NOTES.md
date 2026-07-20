# `tests/witness/alerts/` — fixture notes (EP05-T3)

Per-fixture record of which rules each input witnesses, the one-sentence clinical picture, and —
for every numeric value used — the existing KB threshold it was chosen against. This is the
evidence trail for the "no new clinical claims, no new or retuned thresholds" gate and the input
to the T5 clinical-plausibility review.

None of these fixtures are published (see `tests/witness/README.md`); they exist only to make
`ALERT-001`, `-002`, `-003`, `-006`, `-007`, `-008`, `SCOPE-001`, `-002`, `-003` fire and to let
`tests/witness/alerts.test.mjs` assert the emitted `result.alerts` entry's `severity` and its
presence in `result.alerts` (never `result.interpretiveNotes`).

---

## `unstable-major-bleeding-severe-anemia.json`

**Witnesses:** `ALERT-001`, `ALERT-002`, `ALERT-003` (also incidentally witnesses `ALERT-004`,
already covered elsewhere — anemia + thrombocytopenia is not present here, but see below).

**Clinical picture:** A 7-year-old girl with an acute major gastrointestinal bleed causing
hemodynamic instability and a hemoglobin critically low at 6.5 g/dL, with a reticulocyte response
that has not yet ramped up (too early post-hemorrhage for compensatory reticulocytosis).

**Thresholds used, all pre-existing in the KB:**
- `symptoms.hemodynamicInstability: true` → boolean instability flag counted by
  `facts.anemia.js`'s `instability` (any of six symptom flags; no numeric cutoff exists or is
  needed — `ALERT-001`'s condition is `symptoms.instability === true`).
- `symptoms.activeMajorBleeding: true` → direct boolean match for `ALERT-002`'s condition
  (`symptoms.activeMajorBleeding === true`); no numeric threshold involved.
- `patient.ageMonths: 84`, `sexAtBirth: "female"` → selects the AAP2026_IDA "6 to <12 years" band
  from `modules/anemia/reference-ranges.json` (`hbLower: 11.2` for females, that exact band).
- `cbc.hemoglobin: 6.5` → below the band's `hbLower` (11.2) so `anemia.status` = `present`
  (per `facts.anemia.js` line computing `anemiaStatus`), **and** below the fixed `hb < 7` cutoff
  hard-coded in `facts.anemia.js` (`severeIdaHbCategory`), which is exactly `ALERT-003`'s
  condition (`anemia.severeIdaHbCategory === true`). No new cutoff — 7 g/dL is the existing
  literal in `facts.anemia.js`.
- `cbc.mcv: 82` chosen inside the same band's `mcvLower`/`mcvUpper` (78.3–87.7) → normocytic,
  consistent with acute (not chronic iron-deficiency) blood loss; not asserted by the test, kept
  in-range purely for internal coherence.
- `reticulocytes.response: "inappropriately-normal"` — an existing enum value already used in
  `examples/ida-toddler.json` and `examples/lead-capillary.json`; represents a marrow that has not
  yet mounted a reticulocytosis, physiologically appropriate in the first 1–3 days after acute
  hemorrhage.

**Why not split into 3 fixtures:** all three conditions are mutually compatible in a single
"unstable child, active bleeding, critically low hemoglobin" emergency-department presentation —
this is the canonical case these three alerts exist to catch together, and combining them keeps
the corpus minimal per the phase's scope-discipline instruction.

---

## `tma-schistocytes-thrombocytopenia.json`

**Witnesses:** `ALERT-006` (also incidentally witnesses `ALERT-004`, "anemia with another
cytopenia" — expected and clinically correct co-occurrence, not a new claim).

**Clinical picture:** A 4-year-old boy with schistocytes on smear, thrombocytopenia, oliguria,
and a hemolysis panel (elevated indirect bilirubin/LDH, low haptoglobin, DAT-negative) consistent
with a thrombotic microangiopathy (e.g., HUS-pattern) picture.

**Thresholds used, all pre-existing in the KB:**
- `smear: ["schistocytes"]` → direct boolean match, `smear.schistocytes === true`, one arm of
  `ALERT-006`'s condition.
- `cbc.platelets: 42`, `cbc.localRanges.plateletsLower: 150` → **identical values already used in
  `examples/marrow-red-flags.json`** (reused, not invented) to derive `cbc.thrombocytopenia` via
  the existing numeric-compare path in `facts.anemia.js` (`platelets < localRanges.plateletsLower`).
  This satisfies the other (any-of) arm of `ALERT-006`'s condition.
- `symptoms.oliguria: true` → maps to `symptoms.renalSymptoms` in `facts.anemia.js`
  (`oliguria === true || renalSymptoms === true`), an alternative satisfying arm of `ALERT-006`;
  included in addition to thrombocytopenia because renal involvement is part of the classic
  TMA/HUS clinical picture, not because it was needed to make the rule fire.
- `patient.ageMonths: 48`, `sexAtBirth: "male"` → "2 to <6 years" band, `hbLower: 11` (male).
- `cbc.hemoglobin: 7.8` < 11 → `anemia.status = present` (hemolytic anemia), consistent with the
  hemolysis panel.
- `labs.creatinineStatus: "high"` → existing categorical status value (`statusIs(...,'high')`),
  consistent with the renal injury seen in TMA; not itself required by `ALERT-006` but keeps the
  fixture internally coherent (oliguria + high creatinine = plausible AKI).

---

## `lead-45plus-alert.json`

**Witnesses:** `ALERT-007` (also incidentally witnesses the pre-existing `lead-exposure-associated-anemia`
candidate rules — expected co-occurrence, not asserted by this test).

**Clinical picture:** A 30-month-old boy with pica and excessive cow's-milk intake (classic lead
and iron-deficiency risk factors), microcytic anemia, and a confirmed venous blood lead level of
55 µg/dL.

**Thresholds used, all pre-existing in the KB:**
- `labs.bloodLeadLevel: 55` → above the `bll >= 45` cutoff hard-coded in `facts.anemia.js`
  (`lead45Plus`), which is exactly `ALERT-007`'s condition (`lead.level45Plus === true`). No new
  cutoff — 45 µg/dL is CDC2025_LEAD's existing highest action tier, already encoded.
- `labs.ferritin: 14` against the age-based ferritin threshold from `modules/anemia/ranges.js`
  (`ageMonths 6–144` → threshold `20`, "young or school-aged child" rationale) → 14 ≤ 20, so
  `ferritin.low = true`, consistent with the well-documented co-occurrence of lead exposure and
  iron deficiency (the candidate rule's own summary text says as much) — not a new clinical claim.
- `cbc.mcv: 68` below the "2 to <6 years" band's `mcvLower` (male: 74.1) → microcytic, consistent
  with the mixed lead/iron-deficiency picture.
- `smear: ["basophilic-stippling"]` — an existing enum smear finding already used in
  `examples/lead-capillary.json`, classically associated with lead toxicity.

---

## `lead-20to44-alert.json`

**Witnesses:** `ALERT-008`.

**Clinical picture:** A 2-year-old girl found to have a venous blood lead level of 30 µg/dL on
routine screening (a known pica risk factor is present), with an otherwise normal CBC — a
straightforward "elevated on screening, not yet symptomatic" presentation, deliberately kept
separate from any anemia claim.

**Thresholds used, all pre-existing in the KB:**
- `labs.bloodLeadLevel: 30` → inside the `bll >= 20 && bll < 45` band hard-coded in
  `facts.anemia.js` (`lead20to44`), exactly `ALERT-008`'s condition (`lead.level20to44 === true`).
  No new cutoffs — 20 and 45 µg/dL are CDC2025_LEAD's existing action-tier boundaries, already
  encoded in the fact derivation.
- `patient.ageMonths: 24`, `sexAtBirth: "female"` → falls in the "2 to <6 years" band (the band's
  `minMonths: 24` is inclusive), `hbLower: 11`.
- `cbc.hemoglobin: 11.6` > 11 → `anemia.status = absent`, deliberately kept normal so this fixture
  witnesses only the lead alert and does not layer an unexplained anemia claim onto it.
- `labs.ferritin: 25` against the same age-band ferritin threshold (`20`) → 25 > 20, so
  `ferritin.low = false`; consistent with the "no anemia, incidental lead finding" picture.

---

## `scope-neonatal-young-infant.json`

**Witnesses:** `SCOPE-001` (also incidentally witnesses `SCOPE-003`, since a built-in range genuinely
does not exist below 6 months — expected, not a separate claim).

**Clinical picture:** A 3-month-old infant — deliberately given no CBC/labs/history data, because
the point of this fixture is purely that the built-in reference intervals do not apply below 6
months, independent of any lab values.

**Thresholds used:**
- `patient.ageMonths: 3` < 6 → the `ageMonths < 6` cutoff hard-coded in `facts.anemia.js`
  (`neonatalOrYoungInfant`), exactly `SCOPE-001`'s condition
  (`scope.neonatalOrYoungInfant === true`). This mirrors the existing `AAP2026_IDA` scope note
  ("6 months to <18 years") in `modules/anemia/reference-ranges.json` — no new boundary.

---

## `scope-outside-pediatric-range.json`

**Witnesses:** `SCOPE-002` (also incidentally witnesses `SCOPE-003`, for the same structural reason
as above — no built-in band exists at or beyond 216 months).

**Clinical picture:** An 18-year-4-month-old (220 months) patient — again deliberately given no
CBC/labs, since the point is purely that the built-in intervals stop before 18 years.

**Thresholds used:**
- `patient.ageMonths: 220` ≥ 216 → the `ageMonths >= 216` cutoff hard-coded in `facts.anemia.js`
  (`outsidePediatricRange`), exactly `SCOPE-002`'s condition
  (`scope.outsidePediatricRange === true`). 216 months (18 years) is the existing
  `maxMonthsExclusive` boundary of the last band in `modules/anemia/reference-ranges.json` — no
  new boundary introduced.

---

## `scope-needs-local-ranges-age-unknown.json`

**Witnesses:** `SCOPE-003` only (deliberately isolated from `SCOPE-001`/`SCOPE-002` — see below).

**Clinical picture:** A patient whose age was never entered (age unknown at intake) and for whom
no local laboratory reference ranges were supplied — the "reference interval incomplete" scenario
the rule's own title describes, independent of being out-of-range on either side.

**Why age is `null` rather than <6 or ≥216:** `modules/anemia/ranges.js`'s `getEffectiveRanges()`
only returns non-finite `hbLower`/`mcvLower`/`mcvUpper` (triggering `scope.needsLocalRanges`) when
either (a) age is outside the built-in bands, or (b) age is unknown/`null` and no local ranges are
supplied. Cases (a) already double-witness `SCOPE-001`/`SCOPE-002` above (see their notes). To
give `SCOPE-003` its own clean, single-rule witness — so a downgrade of `SCOPE-003` specifically
cannot hide behind `SCOPE-001`/`SCOPE-002` also firing — this fixture uses `ageMonths: null`
(literally not supplied), which fails neither the `< 6` nor the `>= 216` comparisons (both
short-circuit false whenever `ageMonths === null` in `facts.anemia.js`) but still leaves
`getBuiltInRange()` unable to select a band, so `needsLocalRanges` is `true` on its own. No
numeric threshold is introduced by this fixture — it exercises the *absence* of the age input, not
a new cutoff.

---

## Overlap summary (for the T5 reviewer)

| Fixture | Rules witnessed |
|---|---|
| `unstable-major-bleeding-severe-anemia.json` | ALERT-001, ALERT-002, ALERT-003 (+ ALERT-004, pre-existing target elsewhere) |
| `tma-schistocytes-thrombocytopenia.json` | ALERT-006 (+ ALERT-004) |
| `lead-45plus-alert.json` | ALERT-007 |
| `lead-20to44-alert.json` | ALERT-008 |
| `scope-neonatal-young-infant.json` | SCOPE-001 (+ SCOPE-003) |
| `scope-outside-pediatric-range.json` | SCOPE-002 (+ SCOPE-003) |
| `scope-needs-local-ranges-age-unknown.json` | SCOPE-003 (isolated) |

All 9 target rules (`ALERT-001`, `-002`, `-003`, `-006`, `-007`, `-008`, `SCOPE-001`, `-002`,
`-003`) are witnessed by at least one fixture above, confirmed by
`node scripts/rule-coverage.mjs`.

## Known gap flagged for the orchestrator: `npm test`/`npm run check` do not run these fixtures' assertions yet

`package.json`'s `"test"` script is `node --test tests/*.test.mjs` — a **non-recursive** glob that
only matches `*.test.mjs` files directly under `tests/`, not `tests/witness/*.test.mjs`. This
repository's `scripts/rule-coverage.mjs` walks `tests/witness/` recursively on its own (independent
of the npm `test` script) and does correctly count these fixtures' activation witnesses — so
`node scripts/rule-coverage.mjs` and its `--min` ratchet see this corpus. But the actual
`severity`/`result.alerts`-vs-`interpretiveNotes` assertions in `tests/witness/alerts.test.mjs`
(and the parallel `tests/witness/branch-seam.test.mjs`) are **not** currently exercised by
`npm test` or `npm run check`, because that glob never resolves into the `tests/witness/`
subdirectory. This was confirmed directly: `node --test tests/*.test.mjs` runs exactly 145 subtests
with none of this file's 10 subtests among them; `node --test tests/witness/alerts.test.mjs` runs
this file's 10 subtests explicitly and they pass/fail correctly (verified against a real M55
mutation, see the phase task's negative-test requirement).

This repo's `package.json` is outside this task's file ownership (EP05-T3 owns only
`tests/witness/alerts/*.json`, `tests/witness/alerts.test.mjs`, and this NOTES.md), so the fix
(broadening the `test` script's glob, e.g. to also include `tests/witness/*.test.mjs`, or moving to
a recursive pattern) is left for the orchestrator or EP05-T6 ("wire the ratchet into CI") to apply.
Until that lands, these severity/type assertions are real and pass/fail correctly when run
directly (`node --test tests/witness/alerts.test.mjs`), but are not yet part of the automated
`npm run check` gate.
