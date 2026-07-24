# Attachments manifest — Gemini Deep Research / growth_suite_v1

Attach these exact repo files so Gemini knows what we already hold (recency check) and does not re-surface
it as if new. Paths are repo-relative to the worktree root.

## Files to attach

| # | Repo-relative path | Why attach it |
|---|---|---|
| 1 | `modules/growth_suite_v1/evidence.json` | The 11 held sources — run the supersession check against these. |
| 2 | `modules/growth_suite_v1/candidates.json` | Current candidates (empty `{}`). |
| 3 | `modules/growth_suite_v1/authoring-decisions.yaml` | The 3 drafted decisions = coverage already tracked. |
| 4 | `docs/project_plans/expansion/05-three-module-evidence-run-design.md` | §3.2 growth brief; §4 trust contract; §6 future-module idea-capture surface (the "asides"). |

> If the UI cannot accept `.json`/`.yaml`, paste the inline excerpt below (the load-bearing "already held +
> review-through date" list). The full files add review-by dates and supersession-status fields.

---

## Inline excerpt — current coverage / already-have sources

**Module status:** `growth_suite_v1` is `unsigned-stub`; `rules.json` = `[]`, `candidates.json` = `{}`.
One verified rf bundle (**RF-GRO-002**), **evidence reviewed through 2026-07-21** — treat that as the
recency baseline: tell us what changed *after* it. `authoring-decisions.yaml` holds **3 decisions, all
`drafted_pending_human_approval`** (faltering indicator-base conflict; chart-dependent threshold binding;
preterm/VLBW branch).

**Already-have sources (run supersession check; every one is currently `supersessionStatus:
not_superseded` in our records — confirm or overturn that):**

| id | Title | Org / journal | Year | DOI / URL |
|---|---|---|---|---|
| AFP2023_GROWTH_FALTERING_REVIEW | Growth Faltering and Failure to Thrive in Children | AAFP — Am Fam Physician 107(6) | 2023 | aafp.org/pubs/afp/issues/2023/0600/growth-faltering-failure-to-thrive.html |
| ANM2024_FALTERING_GROWTH_UPDATE | Update on Faltering Growth and Catch-Up Growth | Karger — Ann Nutr Metab 80(S1) | 2024 | 10.1159/000540930 |
| ASPEN2015_MALNUTRITION_INDICATORS | AND/ASPEN pediatric malnutrition indicators consensus | Nutr Clin Pract 30(1) | 2015 | 10.1177/0884533614557642 |
| CDC2010_WHO_CDC_CHART_USE_REC | Use of WHO & CDC Growth Charts, 0-59 months, US | CDC / MMWR RR 59(RR-9) | 2010 | PMID 20829749 (US public domain) |
| JPEDS2024_INTERGROWTH21_COGNITIVE_RISK | Cognitive-risk at 2y, extremely preterm, INTERGROWTH-21st | J Pediatr (Elsevier) | 2024 | 10.1016/j.jpeds.2024.114239 |
| NICE2017_NG75_FALTERING_GROWTH | Faltering growth (NICE NG75) | NICE | 2017 | nice.org.uk/guidance/ng75/chapter/recommendations |
| NUTRIENTS2026_PRETERM_ESPGHAN | Faltering growth & undernutrition at discharge, very preterm (ESPGHAN) | Nutrients (MDPI, OA) 18(2) | 2026 | 10.3390/nu18020286 |
| PEDS2025_GRADUAL_TRANSITION_CHART | Gradual WHO→CDC transition charts | AAP — Pediatrics 156(3) | 2025 | 10.1542/peds.2025-070697 |
| WHO2006_LHFA_STANDARD | WHO Standards: Length/height-for-age | WHO | 2006 | who.int/tools/child-growth-standards/standards/length-height-for-age |
| WHO2006_WFL_WFH_STANDARD | WHO Standards: Weight-for-length/height | WHO | 2006 | who.int/tools/child-growth-standards/standards/weight-for-length-height |
| WHO2007_BMI_5_19Y_REFERENCE | WHO 5-19y growth reference (BMI-for-age) | Bull WHO 85(9) | 2007 | 10.2471/BLT.07.043497 |

**Recency angles most likely to have moved:** AAP 2023 childhood obesity CPG; CDC 2022 extended
BMI-for-age percentiles (severe obesity); any post-2017 NICE NG75 review; INTERGROWTH-21st tool updates.
Flag anything newer than our 2026-07-21 review-through date.
