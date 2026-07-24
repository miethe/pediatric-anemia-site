# Attachments manifest — ChatGPT Deep Research / growth_suite_v1

Attach these exact repo files so the provider sees current coverage and does not re-derive it. Paths are
repo-relative to the worktree root.

## Files to attach

| # | Repo-relative path | Why attach it |
|---|---|---|
| 1 | `modules/growth_suite_v1/evidence.json` | The 11 sources we already hold — extract *new* patterns, not these. |
| 2 | `modules/growth_suite_v1/candidates.json` | Current candidates (empty `{}` — every pattern is net-new). |
| 3 | `modules/growth_suite_v1/authoring-decisions.yaml` | The 3 drafted decisions = coverage + conflicts already tracked (don't re-extract them). |
| 4 | `docs/project_plans/expansion/05-three-module-evidence-run-design.md` | §3.2 growth brief (angles + numerics targets); §4 trust contract; §1.3 the numerics problem. |

> If the UI cannot accept `.json`/`.yaml`, paste the inline excerpt below (the load-bearing "already
> covered" list). The full files add exact claim text, conflict representations, and locators.

---

## Inline excerpt — current coverage / already-have sources

**Module status:** `growth_suite_v1` is `unsigned-stub`; `rules.json` = `[]`, `candidates.json` = `{}`.
One verified rf bundle behind it (**RF-GRO-002**, reviewed through 2026-07-21). `authoring-decisions.yaml`
holds **3 decisions, all `drafted_pending_human_approval`** — these are ALREADY COVERED, do not re-extract:

1. `dec_growth_faltering_indicator_base_conflict_001` — 1.0 z-score faltering trigger; weight-for-age vs
   weight-for-height base is an unresolved conflict (preserve, never auto-resolve).
2. `dec_growth_chart_dependent_threshold_binding_001` — every threshold is growth-standard-dependent; bind
   chart identity to every threshold.
3. `dec_growth_preterm_vlbw_scope_branch_001` — preterm/VLBW → distinct INTERGROWTH-21st / corrected-age
   branch; no term WHO/CDC cutoff validated for preterm.

**Already-have sources (extract NEW patterns; only reuse these for a newer edition / successor / the
primary numeric table behind one):**

| id | Title | Org / journal | Year | DOI / URL |
|---|---|---|---|---|
| AFP2023_GROWTH_FALTERING_REVIEW | Growth Faltering and Failure to Thrive in Children | AAFP — Am Fam Physician 107(6):597-603 | 2023 | aafp.org/pubs/afp/issues/2023/0600/growth-faltering-failure-to-thrive.html |
| ANM2024_FALTERING_GROWTH_UPDATE | Update on Faltering Growth and Catch-Up Growth | Karger — Ann Nutr Metab 80(S1):18-28 | 2024 | 10.1159/000540930 |
| ASPEN2015_MALNUTRITION_INDICATORS | AND/ASPEN pediatric malnutrition indicators consensus | Nutr Clin Pract 30(1):147-61 | 2015 | 10.1177/0884533614557642 |
| CDC2010_WHO_CDC_CHART_USE_REC | Use of WHO & CDC Growth Charts, 0-59 months, US | CDC / MMWR RR 59(RR-9) | 2010 | PMID 20829749 (US public domain) |
| JPEDS2024_INTERGROWTH21_COGNITIVE_RISK | Cognitive-risk at 2y, extremely preterm, INTERGROWTH-21st | J Pediatr (Elsevier) | 2024 | 10.1016/j.jpeds.2024.114239 |
| NICE2017_NG75_FALTERING_GROWTH | Faltering growth (NICE NG75) | NICE | 2017 | nice.org.uk/guidance/ng75/chapter/recommendations |
| NUTRIENTS2026_PRETERM_ESPGHAN | Faltering growth & undernutrition at discharge, very preterm (ESPGHAN) | Nutrients (MDPI, OA) 18(2):286 | 2026 | 10.3390/nu18020286 |
| PEDS2025_GRADUAL_TRANSITION_CHART | Gradual WHO→CDC transition charts | AAP — Pediatrics 156(3):e2025070697 | 2025 | 10.1542/peds.2025-070697 |
| WHO2006_LHFA_STANDARD | WHO Standards: Length/height-for-age | WHO | 2006 | who.int/tools/child-growth-standards/standards/length-height-for-age |
| WHO2006_WFL_WFH_STANDARD | WHO Standards: Weight-for-length/height | WHO | 2006 | who.int/tools/child-growth-standards/standards/weight-for-length-height |
| WHO2007_BMI_5_19Y_REFERENCE | WHO 5-19y growth reference (BMI-for-age) | Bull WHO 85(9):660-667 | 2007 | 10.2471/BLT.07.043497 |

**Numerics we do NOT yet hold as bound numbers** (extract these if you can anchor them to a retrievable
table): AND/ASPEN mild/moderate/severe z-score bands; AFP Figure 1 severity cut-offs; the raw
WHO/CDC/INTERGROWTH percentile/z-score tables; CDC extended BMI-for-age (severe obesity); AAP obesity /
BP percentile tables where they intersect growth.
