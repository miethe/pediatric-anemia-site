validator: codex/gpt-5.6-terra

# Phase 4 (Vertical Slice + Test Corpus) — AC validation

Source of AC list: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md`
(Phase 4 task rows P4-T1..P4-T9 + "Phase 4 Quality Gates" checklist) and
`.claude/progress/evidence-foundry-buildout/phase-4-progress.md` `success_criteria` block. Note: the
phase-4-progress.md frontmatter still carries a stale rule-(c) description ("iron-deficiency-anemia
candidate pattern"); per the phase-3-5 manifest's binding re-scope and this phase's own task summaries,
the authoritative rule (c) is the benign-ethnic/Duffy-null neutropenia differential candidate pattern
(`CBC-NEUT-BENIGNDIFF-001`) — validated against that identity below.

Driven via `codex exec -m gpt-5.6-terra --sandbox read-only`. Codex's sandboxed `npm test` run reported
986 pass / 48 fail, attributing the failures to sandbox EPERM. Per the routing instruction, this was
cross-checked with a direct unsandboxed `npm test` run in this worktree: **1034/1034 pass, 0 fail** —
confirming the 48 failures were sandbox artifacts, not real regressions. P4-T9's checklist line and the
summary count below are corrected accordingly (Codex's own line is preserved with a correction note).
All other Codex findings were independently spot-checked (rule IDs/count, candidate label, severity value,
iron-grep scope, module.json status, `npm run validate` output) and confirmed accurate.

## Checklist

- [x] P4-T1: Rule (a) young-infant/age-under-6-months scope-abstention (CBC-NEUT-YOUNGINF-001) committed and passes schemas/rule.schema.json — MET: modules/cbc_suite_v1/rules.json (rule present); `npm run validate` exits 0.
- [x] P4-T1: The age-6-months boundary resolves to a real evidence-assertions.json entry (not invented) — MET: modules/cbc_suite_v1/rule-provenance.json references evas_cbc_young_infant_anc_001/002, both present in evidence-assertions.json.
- [x] P4-T1: npm run validate passes for cbc_suite_v1 — MET: output reports cbc_suite_v1 (4 rules, 1 candidate, 19 evidence-assertions), zero schema errors.
- [x] P4-T2: Rule (b) local-lab-range-precedence-over-universal-threshold (CBC-NEUT-LOCALRANGE-001) committed and schema-valid — MET: present in rules.json (output.type "note"); validate exits 0.
- [x] P4-T2: A test proves rule (b) abstains (does not silently apply a universal cutoff) when the local-profile fact is absent — MET: tests/ef-cbc_suite_v1-missingness.test.mjs asserts CBC-NEUT-LOCALRANGE-001 fires, CBC-NEUT-BENIGNDIFF-001 does not, and rankedDifferential is empty for a numerically-low ANC with no local profile.
- [x] P4-T3: Rule (c) + its candidate (benign-ethnic/Duffy-null neutropenia differential pattern, CBC-NEUT-BENIGNDIFF-001) committed and schema-valid — MET: present in rules.json and candidates.json; validate exits 0.
- [x] P4-T3: Candidate label contains "pattern" — MET: candidates.json label = "Benign ethnic/Duffy-null neutropenia differential pattern".
- [x] P4-T3: Rule (c) emits output.type "candidate" referencing the committed candidate ID — MET: rules.json CBC-NEUT-BENIGNDIFF-001 output.type is "candidate", candidateId "benign-ethnic-neutropenia-differential-pattern".
- [x] P4-T3: No iron-deficiency candidate or rule exists anywhere in modules/cbc_suite_v1/ — MET: `grep -ril iron modules/cbc_suite_v1/` hits only rule-provenance.json and authoring-decisions.yaml prose explaining the re-scope decision — zero iron content in rules.json/candidates.json themselves.
- [x] P4-T4: Rule (d) marrow-red-flag safety rule (CBC-MARROW-REDFLAG-001) committed and schema-valid — MET: present in rules.json (output.type "alert"); validate exits 0.
- [x] P4-T4: output.severity is "emergency" or "urgent" per the resolved evidence, never a generic default — MET: rules.json CBC-MARROW-REDFLAG-001 output.severity = "urgent" (spot-checked directly, not just accepted from Codex).
- [x] P4-T4: Evidence resolves to the exact 02 §5.4 "multilineage cytopenia and marrow failure/infiltration" hazard wording in rule-provenance.json's basis — MET: rule-provenance.json's CBC-MARROW-REDFLAG-001 entry cites dec_cbc_marrow_red_flag_001 and evidenceAssertionIds evas_cbc_marrow_malignancy_risk_001/002 tied to this named hazard.
- [x] P4-T5: All 4 test files contain a passing case for rule (a) — MET: positive/negative/boundary/missingness test files each contain a CBC-NEUT-YOUNGINF-001 case; full suite green.
- [x] P4-T5: The boundary case for rule (a) specifically exercises the >=/> operator at the 6-month edge — MET: ef-cbc_suite_v1-boundary.test.mjs tests exactly-6-months (in-scope) vs. 5.9-months (out-of-scope, alert fires).
- [x] P4-T6: All 4 test files contain a passing case for rule (b) — MET: present in all 4 files; full suite green.
- [x] P4-T6: The missingness case for rule (b) specifically asserts no universal-threshold fallback occurs — MET: ef-cbc_suite_v1-missingness.test.mjs asserts a numerically low ANC (0.3) with no local profile fires the interpretive note and produces zero ranked differential, rather than applying a universal cutoff.
- [x] P4-T7: All 4 test files contain a passing case for rule (c) — MET: present in all 4 files; full suite green.
- [x] P4-T7: The boundary case for rule (c) specifically exercises the cbc.neutropenia true/false edge — MET: ef-cbc_suite_v1-boundary.test.mjs exercises the true/false state transition (ANC below vs. at local lower limit), not a rule-owned numeric threshold.
- [x] P4-T7: The missingness case for rule (c) asserts an unknown neutropenia state does not fire the candidate — MET: ef-cbc_suite_v1-missingness.test.mjs (absent ANC, no local flag) asserts CBC-NEUT-BENIGNDIFF-001 does not match and the candidate does not appear in rankedDifferential.
- [x] P4-T8: All 4 standard test files contain a passing case for rule (d) — MET: present in all 4 files; full suite green.
- [x] P4-T8: The dangerous-miss test constructs an input matching both rule (c) and rule (d) simultaneously and asserts the alert is present and surfaced, not suppressed by the co-occurring candidate — MET: tests/ef-cbc_suite_v1-dangerous-miss.test.mjs (mild anemia hb 9.5 + localFlags.neutropenia:true) asserts CBC-MARROW-REDFLAG-001 (severity urgent) is present/undiminished and the benign-ethnic-neutropenia-differential-pattern candidate remains visible, not suppressing the alert.
- [x] P4-T9: npm test is green including all 5 new ef-cbc_suite_v1-*.test.mjs files — MET (corrected): Codex's sandboxed run reported 986 pass/48 fail and attributed this to sandbox EPERM; a direct unsandboxed `npm test` run in this worktree confirms **1034/1034 pass, 0 fail**, including all 5 ef-cbc_suite_v1-*.test.mjs files. The sandbox failure was spurious, per the routing instruction's expected failure mode.
- [x] P4-T9: assess(..., 'cbc_suite_v1', ...) produces non-crashing, correctly-ranked output for every generated test input — MET: all 22 ef-cbc_suite_v1-*.test.mjs cases (run through the real assess() seam) pass, confirmed by both Codex's focused run and the full unsandboxed suite.
- [x] P4-T9: Integration owner sign-off recorded — MET: .claude/progress/evidence-foundry-buildout/phase-4-progress.md marks P4-T9 status "completed" with recorded validation evidence (npm test 1034/1034, npm run validate clean).
- [x] QualityGate: Exactly the 4 named rules are migrated — no additional rules — MET: modules/cbc_suite_v1/rules.json contains exactly 4 rules: CBC-NEUT-YOUNGINF-001, CBC-NEUT-LOCALRANGE-001, CBC-MARROW-REDFLAG-001, CBC-NEUT-BENIGNDIFF-001 (spot-checked directly).
- [x] QualityGate: Each rule has a complete positive/negative/boundary(where numeric)/missingness test set — MET: all 4 rules have cases in all 4 flat test files (22 cases total across positive/negative/boundary/missingness).
- [x] QualityGate: The marrow-red-flag rule has ≥1 passing dangerous-miss test proving alert dominance over a co-occurring benign candidate — MET: tests/ef-cbc_suite_v1-dangerous-miss.test.mjs.
- [x] QualityGate: modules/cbc_suite_v1/rules.json validates against schemas/rule.schema.json with zero errors — MET: `npm run validate` reports zero schema errors for cbc_suite_v1.
- [x] QualityGate: Zero invented thresholds — every numeric literal resolves to an evidence-assertions.json entry — MET: all 4 rule-provenance.json entries' evidenceAssertionIds resolve to real, committed evidence-assertions.json entries.
- [x] QualityGate: module.json status remains "unsigned-stub" (migration, not release) — MET: modules/cbc_suite_v1/module.json "status": "unsigned-stub" (spot-checked directly).

## Summary

**30/30 MET** (corrected from Codex's initial 29/30 after the P4-T9 sandbox-EPERM cross-check per
routing instructions; unsandboxed `npm test` = 1034/1034 pass, 0 fail).
