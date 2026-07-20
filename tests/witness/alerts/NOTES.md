# `tests/witness/alerts/` — fixture notes (EP05-T3)

Per-fixture record of which rules each input witnesses, the one-sentence clinical picture, and —
for every **threshold-bearing value** (a number an actual rule condition compares against a KB or
code-literal cutoff) — the existing KB/code threshold it was chosen against and which side of it
the value sits on. This is the evidence trail for the "no new clinical claims, no new or retuned
thresholds" gate and the input to the T5 clinical-plausibility review.

**Not every number below is threshold-bearing.** Some CBC values (e.g. an MCV kept inside a band
purely for internal coherence, an RBC chosen only so Hb/MCV/RBC imply a physiologically sensible
MCHC) are ordinary observational values chosen for clinical coherence, not against a cutoff any
rule reads. Where that is the case it is stated explicitly rather than implied to have a threshold
it does not have.

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
- `cbc.rdw: 13.5` — kept below the same band's `rdwUpper` (13.9), consistent with an acute process
  (RDW has not had time to widen) and internally coherent with the "indices kept in range" framing
  of this fixture. (**Corrected in EP05-T5**: this value was previously `14.5`, which exceeds
  13.9 and contradicted that framing — see the T5 fix log below.) Not a new threshold; 13.9 is the
  existing band value.
- `cbc.rbc: 2.4` — not read by any rule (verified: no rule condition reads numeric `cbc.rbc`, only
  the derived `cbc.rbcRelativelyHigh` boolean), so this is not threshold-bearing. It is chosen so
  the implied MCHC (`hb*1000/(mcv*rbc)` = `6500/(82*2.4)` ≈ 33.0 g/dL) falls in the physiologically
  sensible 30–36 g/dL range, internally consistent with an acute normocytic blood-loss picture.
  (**Corrected in EP05-T5**: this value was previously `2.9`, which implied MCHC ≈ 27.3 — markedly
  hypochromic and inconsistent with the stated acute normocytic picture — see below.)
- `reticulocytes.response: "inappropriately-normal"` — an existing enum value already used in
  `examples/ida-toddler.json` and `examples/lead-capillary.json`; represents a marrow that has not
  yet mounted a reticulocytosis, physiologically appropriate in the first 1–3 days after acute
  hemorrhage.

**EP05-T5 fix log:** an adversarial cross-family review (gpt-5.6-sol) found this fixture's original
`rdw: 14.5` exceeded the band's own `rdwUpper: 13.9` while the fixture's narrative claimed indices
were kept in range, and separately found the original `rbc: 2.9` implied MCHC ≈ 27.3 g/dL — markedly
hypochromic, inconsistent with the stated acute, non-chronic-iron-deficiency picture. Both were
corrected above (rdw → 13.5, rbc → 2.4) rather than the narrative being changed, because the
narrative (acute blood loss, indices not yet chronically deranged) is the clinically intended
picture.

**Why not split into 3 fixtures:** all three conditions are mutually compatible in a single
"unstable child, active bleeding, critically low hemoglobin" emergency-department presentation —
this is the canonical case these three alerts exist to catch together, and combining them keeps
the corpus minimal per the phase's scope-discipline instruction.

---

## `tma-schistocytes-thrombocytopenia.json` and `tma-schistocytes-renal-symptoms.json`

**EP05-T5 restructure note:** a single combined fixture originally witnessed `ALERT-006`
(`schistocytes AND any(cbc.thrombocytopenia, symptoms.renalSymptoms, symptoms.neurologicSymptoms)`)
by setting BOTH `localFlags.thrombocytopenia: true` AND `symptoms.oliguria: true` — two satisfied
`any` arms at once, plus the `localFlags` override, which short-circuits the numeric
`platelets < localRanges.plateletsLower` derivation the notes claimed was exercised. An adversarial
review correctly flagged this: the platelet derivation could break completely (wrong comparison,
dropped `localRanges` lookup, deleted branch) and the alert assertion would stay green because the
renal arm was still silently carrying it. Per the review's fix instruction, this is now **two**
fixtures, one per isolated `any` arm, and `tests/witness/alerts.test.mjs` asserts the derived
`cbc.thrombocytopenia` fact directly in the platelet-only case so a broken derivation fails loudly.

---

## `tma-schistocytes-thrombocytopenia.json`

**Witnesses:** `ALERT-006`, via the `cbc.thrombocytopenia` arm ONLY (isolated).

**Clinical picture:** A 4-year-old boy with schistocytes on smear and a hemolysis panel (elevated
indirect bilirubin/LDH, low haptoglobin, DAT-negative) consistent with a thrombotic
microangiopathy (e.g., HUS-pattern) picture, with a platelet count numerically below a supplied
local lower limit.

**Thresholds used:**
- `smear: ["schistocytes"]` → direct boolean match, `smear.schistocytes === true`, one arm of
  `ALERT-006`'s condition.
- `cbc.platelets: 42`, `cbc.localRanges.plateletsLower: 150` → derives `cbc.thrombocytopenia` via
  the numeric-compare path in `facts.anemia.js` (`platelets < localRanges.plateletsLower`). This is
  the **only** way this fixture can satisfy `ALERT-006`'s `any` clause: there is no
  `localFlags.thrombocytopenia` override, no `symptoms.renalSymptoms`/`oliguria`, and no
  neurologic symptom. `150` is **not a KB-derived platelet threshold** — it is the same synthetic
  local-laboratory input already used in `examples/marrow-red-flags.json` (an example fixture, not
  a KB source), reused here rather than invented, to keep the corpus from introducing yet another
  arbitrary number. See the "Known limitation" callout in `tests/witness/corpus/NOTES.md` for the
  broader point about `localRanges`/`localFlags` values being synthetic test inputs, not KB
  thresholds.
- `patient.ageMonths: 48`, `sexAtBirth: "male"` → "2 to <6 years" band, `hbLower: 11` (male).
- `cbc.hemoglobin: 7.8` < 11 → `anemia.status = present` (hemolytic anemia), consistent with the
  hemolysis panel.
- `cbc.mcv: 80`, `cbc.rbc: 3.0` — `rbc` is not read by any rule (only the derived
  `cbc.rbcRelativelyHigh` boolean is); it is chosen only so the implied MCHC
  (`7800/(80*3.0)` ≈ 32.5 g/dL) is physiologically sensible, not markedly hypochromic or
  hyperchromic. (**Corrected in EP05-T5**: the prior combined fixture used `rbc: 2.6`, which
  implied MCHC ≈ 37.5 g/dL — above the physiologic ceiling.)

---

## `tma-schistocytes-renal-symptoms.json`

**Witnesses:** `ALERT-006`, via the `symptoms.renalSymptoms` arm ONLY (isolated).

**Clinical picture:** A 3-year-old girl with schistocytes on smear, oliguria, and a hemolysis
panel consistent with an early- or renal-predominant thrombotic microangiopathy presentation, with
a platelet count that is explicitly normal (no thrombocytopenia by either path).

**Thresholds used:**
- `smear: ["schistocytes"]` → direct boolean match, one arm of `ALERT-006`'s condition.
- `symptoms.oliguria: true` → maps to `symptoms.renalSymptoms` in `facts.anemia.js`
  (`oliguria === true || renalSymptoms === true`), the **only** satisfied arm of `ALERT-006`'s
  `any` clause here: `cbc.platelets: 250` is set well above any plausible lower limit, no
  `localRanges.plateletsLower` is supplied (so the numeric path cannot fire), and no
  `localFlags.thrombocytopenia` override is present — `cbc.thrombocytopenia` derives to `false`,
  asserted directly in `tests/witness/alerts.test.mjs`.
- `labs.creatinineStatus: "high"` → existing categorical status value (`statusIs(...,'high')`),
  consistent with the renal injury implied by oliguria; not itself required by `ALERT-006`.
- `patient.ageMonths: 36`, `sexAtBirth: "female"` → "2 to <6 years" band, `hbLower: 11`.
- `cbc.hemoglobin: 8.5` < 11 → anemia present, consistent with the hemolysis panel.
- `cbc.mcv: 82`, `cbc.rbc: 3.1` — `rbc` not read by any rule; chosen so implied MCHC
  (`8500/(82*3.1)` ≈ 33.4 g/dL) is physiologically sensible.

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
| `tma-schistocytes-thrombocytopenia.json` | ALERT-006, via the `cbc.thrombocytopenia` arm only (+ ALERT-004, since this fixture's `additionalCytopeniaCount` is 1) |
| `tma-schistocytes-renal-symptoms.json` | ALERT-006, via the `symptoms.renalSymptoms` arm only (ALERT-004 does NOT fire here — no cytopenia is present, by design, to keep this fixture an isolated-arm witness) |
| `lead-45plus-alert.json` | ALERT-007 |
| `lead-20to44-alert.json` | ALERT-008 |
| `scope-neonatal-young-infant.json` | SCOPE-001 (+ SCOPE-003) |
| `scope-outside-pediatric-range.json` | SCOPE-002 (+ SCOPE-003) |
| `scope-needs-local-ranges-age-unknown.json` | SCOPE-003 (isolated) |

All 9 target rules (`ALERT-001`, `-002`, `-003`, `-006`, `-007`, `-008`, `SCOPE-001`, `-002`,
`-003`) are witnessed by at least one fixture above, confirmed by
`node scripts/rule-coverage.mjs`.

## Wiring status: `npm test`/`npm run check` DO run these fixtures' assertions (resolved)

**Update (EP05-T5):** this section previously flagged that `package.json`'s `"test"` script
(`node --test tests/*.test.mjs`) did not discover `tests/witness/*.test.mjs`, so these assertions
were real but not part of the automated gate. **That has since been fixed by the orchestrator.**
`package.json`'s `"test"` script is now
`node --test tests/*.test.mjs tests/witness/*.test.mjs`, and `npm test`/`npm run check` run **204**
tests total, including every assertion in this file (`tests/witness/alerts.test.mjs`) and the
parallel `tests/witness/branch-seam.test.mjs`. Verified directly: `npm test` output reports
`# tests 204` / `# pass 204` with this file's subtests present by name in the run log. The M55
guard below is therefore now a real CI gate, not a standalone script that has to be remembered and
run manually.
