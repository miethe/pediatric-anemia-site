# Perplexity Pro — kidney_suite_v1 attachment manifest

Attach these exact files (repo-relative paths) to the Perplexity conversation **before** pasting
`prompt.md`. They tell Perplexity what the module already holds so it does not re-surface known
sources, and they carry the numerics targets it should hunt.

## Files to attach

| # | Repo-relative path | Why |
|---|---|---|
| 1 | `modules/kidney_suite_v1/evidence.json` | The 12 sources already in the RF-KID-001 bundle (the "do not re-surface" list). Source list + claim text + license fields. |
| 2 | `modules/kidney_suite_v1/candidates.json` | Current candidate patterns — **empty `{}`** (greenfield). Confirms nothing is drafted yet; all patterns are net-new. |
| 3 | `modules/kidney_suite_v1/authoring-decisions.yaml` | The 3 drafted-pending decisions (dual eGFR threshold coexistence; infant <1y eGFR scope-exit; nephrotic-proteinuria unit conflict). Shows the numeric conflicts already identified that need independently-retrievable grounding. |
| 4 | `docs/project_plans/expansion/05-three-module-evidence-run-design.md` | The run design; read **§3.3** (the kidney brief: net-new angles + numerics targets) and **§4** (provider roles + trust invariants). |

> If your provider UI cannot take a `.json`/`.yaml` upload, paste the file contents into the message
> instead, or paste the inlined excerpt below.

## Inlined current-coverage excerpt (paste if attachments are not supported)

**Module status:** `kidney_suite_v1` is an `unsigned-stub`, greenfield scaffold — `rules.json` empty
`[]`, `candidates.json` empty `{}`, `intended_output: ["not_yet_implemented"]`. It sits on ONE verified
rf bundle (RF-KID-001, `evidenceReviewedThrough: 2026-07-22`) with 12 sources and 3 drafted-pending
authoring decisions. Nothing is rule-bearing yet.

**Already-have sources (do NOT re-surface — prefer net-new / newer editions):**

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
