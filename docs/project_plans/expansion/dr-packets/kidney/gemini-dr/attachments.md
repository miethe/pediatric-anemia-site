# Gemini Deep Research — kidney_suite_v1 attachment manifest

Attach these exact files (repo-relative paths) to the Gemini Deep Research conversation **before**
pasting `prompt.md`. They tell Gemini what we already hold (so it hunts for what's NEWER/ADJACENT) and
what the newest held source is (2025).

## Files to attach

| # | Repo-relative path | Why |
|---|---|---|
| 1 | `modules/kidney_suite_v1/evidence.json` | The 12 held sources with years and supersession status — the baseline Gemini must beat on recency. |
| 2 | `modules/kidney_suite_v1/candidates.json` | Current candidate patterns — **empty `{}`** (greenfield). |
| 3 | `modules/kidney_suite_v1/authoring-decisions.yaml` | The 3 drafted-pending decisions — context for what a newer guideline might change. |
| 4 | `docs/project_plans/expansion/05-three-module-evidence-run-design.md` | Run design; read **§3.3** (kidney brief) and **§6** (future-module idea capture — the adjacent-domain scouting Gemini leads). |

> If the UI cannot take `.json`/`.yaml` uploads, paste the file contents into the message, or paste
> the inlined excerpt below.

## Inlined current-coverage excerpt (paste if attachments are not supported)

**Module status:** `kidney_suite_v1` is an `unsigned-stub`, greenfield scaffold — `rules.json` `[]`,
`candidates.json` `{}`, `intended_output: ["not_yet_implemented"]`. One verified rf bundle (RF-KID-001,
`evidenceReviewedThrough: 2026-07-22`), 12 sources (newest = 2025), 3 drafted-pending authoring decisions.

**Adjacent-domain scouting targets (§6 asides — one-line idea captures only):** hepatic/LFT panel,
thyroid/TSH-FT4, electrolytes & acid-base, coagulation/PT-INR, inflammatory markers, newborn-screen
follow-up, lipid panel.

**Already-have sources (find NEWER/ADJACENT; do NOT re-list):**

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
