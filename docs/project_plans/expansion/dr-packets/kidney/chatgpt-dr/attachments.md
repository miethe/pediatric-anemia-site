# ChatGPT Deep Research — kidney_suite_v1 attachment manifest

Attach these exact files (repo-relative paths) to the ChatGPT Deep Research conversation **before**
pasting `prompt.md`. They give ChatGPT the numbers we already hold (so its extraction can cite them)
and the conflicts already identified (so it extends rather than restates).

## Files to attach

| # | Repo-relative path | Why |
|---|---|---|
| 1 | `modules/kidney_suite_v1/evidence.json` | The 12 sources + their claim text (many carry the actual numeric thresholds ChatGPT can extract and cite). |
| 2 | `modules/kidney_suite_v1/candidates.json` | Current candidate patterns — **empty `{}`** (greenfield). Confirms every pattern ChatGPT produces is net-new. |
| 3 | `modules/kidney_suite_v1/authoring-decisions.yaml` | The 3 drafted-pending decisions and their `prohibited_effects` — the extraction must EXTEND these, and must preserve (not reconcile) the conflicts they name. |
| 4 | `docs/project_plans/expansion/05-three-module-evidence-run-design.md` | Run design; read **§3.3** (kidney brief: angles + numerics targets) and **§4** (roles + trust invariants). ChatGPT DR = "structured extraction." |

> If the UI cannot take `.json`/`.yaml` uploads, paste the file contents into the message, or paste
> the inlined excerpt below.

## Inlined current-coverage excerpt (paste if attachments are not supported)

**Module status:** `kidney_suite_v1` is an `unsigned-stub`, greenfield scaffold — `rules.json` `[]`,
`candidates.json` `{}`, `intended_output: ["not_yet_implemented"]`. One verified rf bundle (RF-KID-001,
`evidenceReviewedThrough: 2026-07-22`), 12 sources, 3 drafted-pending authoring decisions.

**The 3 drafted decisions (extend beyond, preserve their conflicts):**
1. `dec_kidney_egfr_dual_threshold_coexistence_001` — KDIGO <90 mL/min/1.73 m² screening flag (>2y) and <60 for >3 months referral cutoff must COEXIST, never be collapsed.
2. `dec_kidney_infant_under_1y_egfr_scope_exit_001` — CKiD U25 validated ages 1–25; return "no validated eGFR threshold" for <1y, never extrapolate.
3. `dec_kidney_nephrotic_proteinuria_unit_conflict_001` — pediatric nephrotic spot UPCR >2 mg/mg (~226 mg/mmol) vs adult 350 mg/mmol; preserve both, never average.

**Already-have sources (cite when a number comes from them; prefer net-new patterns):**

1. CKiD U25 GFR equations — Pierce CB et al., *Kidney Int* 99(4):948-956, 2021 — doi:10.1016/j.kint.2020.10.047
2. Race, SCr, cystatin C & GFR (CKiD) — Ng DK et al., *AJKD*, 2021 — doi:10.1053/j.ajkd.2021.10.013
3. AAP pediatric HTN guideline — Flynn JT et al., *Pediatrics* 140(3):e20171904, 2017 — doi:10.1542/peds.2017-1904
4. KDIGO 2024 CKD guideline — *Kidney Int* 105(4S), 2024 — doi:10.1016/j.kint.2023.10.018
5. Cystatin-C eGFR utility (peds) — Ibrahim RB et al., *J Appl Lab Med* 9(4):803-808, 2024 — doi:10.1093/jalm/jfae034
6. eGFR equations, peds transplant — Sukboonthong P et al., *Pediatr Nephrol*, 2025 — doi:10.1007/s00467-025-06942-8
7. Hematuria & proteinuria in children — Viteri B, Reid-Adam J, *Pediatr Rev* 39(12):573-587, 2018 — doi:10.1542/pir.2017-0300
8. Proteinuria in children — Leung AKC et al., *Am Fam Physician* 95(4):248-254, 2017 (no DOI)
9. Proteinuria & hematuria, ambulatory — Imam AA, Saadeh SA, *Pediatr Clin North Am* 69(6):1037-1049, 2022 — doi:10.1016/j.pcl.2022.07.002 (**paywalled**)
10. eGFR at normal/near-normal/discordant GFR — Schwaderer AL et al., *Pediatr Nephrol* 38(12):4051-4059, 2023 — doi:10.1007/s00467-023-06045-2
11. Spot P/C ratio diagnostic utility — Kaminska J et al., *Crit Rev Clin Lab Sci* 57(5):345-364, 2020 — doi:10.1080/10408363.2020.1723487 (**paywalled**)
12. Cystatin C vs creatinine eGFR, peds transplant — Pizzo H et al., *Pediatr Nephrol* 39(7):2177-2186, 2024 — doi:10.1007/s00467-024-06316-6
