# Attachments manifest — Perplexity / growth_suite_v1

Attach these exact repo files to the Perplexity query so the provider sees what we already hold and does
not re-surface it. All paths are repo-relative to the worktree root
(`/.../pediatric-anemia-site/` or the active worktree checkout).

## Files to attach

| # | Repo-relative path | Why attach it |
|---|---|---|
| 1 | `modules/growth_suite_v1/evidence.json` | The 11 sources we already hold — do not re-find these. |
| 2 | `modules/growth_suite_v1/candidates.json` | Current candidate patterns (empty `{}` today — everything is net-new). |
| 3 | `modules/growth_suite_v1/authoring-decisions.yaml` | The 3 drafted decisions that show current coverage / the conflicts already tracked. |
| 4 | `docs/project_plans/expansion/05-three-module-evidence-run-design.md` | §3.2 is the growth brief (net-new angles + numerics targets); §4 is the trust contract. |

> If your provider UI cannot accept `.json`/`.yaml`, paste the inline excerpt below instead; it is the
> load-bearing part (the "don't re-find these" list). The full files add locators and conflict notes.

---

## Inline excerpt — current coverage / already-have sources

**Module status:** `growth_suite_v1` is `unsigned-stub` — `rules.json` empty `[]`, `candidates.json` empty
`{}`. It sits on one verified rf bundle (**RF-GRO-002**,
`bundle_20260718_intent_research_20260717_rf_gro_002`, reviewed through 2026-07-21). `authoring-decisions.yaml`
holds **3 decisions, all `drafted_pending_human_approval`** (non-approving scaffold):

1. `dec_growth_faltering_indicator_base_conflict_001` — the 1.0 z-score faltering trigger is convergent in
   magnitude but the anthropometric base (weight-for-age vs weight-for-height) is an unresolved conflict.
2. `dec_growth_chart_dependent_threshold_binding_001` — every z-score/percentile threshold is
   growth-standard-dependent; chart identity must bind to every threshold.
3. `dec_growth_preterm_vlbw_scope_branch_001` — preterm/VLBW needs a distinct INTERGROWTH-21st /
   corrected-age branch; no term WHO/CDC cutoff is validated for preterm.

**Already-have sources (do NOT re-surface unless newer edition / successor / the primary numeric table
behind one):**

| id | Title | Org / journal | Year | DOI / URL |
|---|---|---|---|---|
| AFP2023_GROWTH_FALTERING_REVIEW | Growth Faltering and Failure to Thrive in Children | AAFP — Am Fam Physician 107(6):597-603 | 2023 | aafp.org/pubs/afp/issues/2023/0600/growth-faltering-failure-to-thrive.html (no DOI) |
| ANM2024_FALTERING_GROWTH_UPDATE | Update on Diagnosis & Management of Faltering Growth and Catch-Up Growth | Karger — Ann Nutr Metab 80(S1):18-28 | 2024 | 10.1159/000540930 |
| ASPEN2015_MALNUTRITION_INDICATORS | AND/ASPEN pediatric malnutrition (undernutrition) indicators consensus | Nutr Clin Pract 30(1):147-61 | 2015 | 10.1177/0884533614557642 |
| CDC2010_WHO_CDC_CHART_USE_REC | Use of WHO and CDC Growth Charts for Children 0-59 Months in the US | CDC / MMWR RR 59(RR-9):1-15 | 2010 | PMID 20829749 (US public domain) |
| JPEDS2024_INTERGROWTH21_COGNITIVE_RISK | Cognitive-impairment risk at 2y in extremely preterm using INTERGROWTH-21st | J Pediatr (Elsevier) | 2024 | 10.1016/j.jpeds.2024.114239 |
| NICE2017_NG75_FALTERING_GROWTH | Faltering growth: recognition and management (NICE NG75) | NICE | 2017 | nice.org.uk/guidance/ng75/chapter/recommendations |
| NUTRIENTS2026_PRETERM_ESPGHAN | Growth faltering & undernutrition at discharge in very preterm (ESPGHAN defs) | Nutrients (MDPI, open access) 18(2):286 | 2026 | 10.3390/nu18020286 |
| PEDS2025_GRADUAL_TRANSITION_CHART | New growth charts: gradual WHO→CDC transition | AAP — Pediatrics 156(3):e2025070697 | 2025 | 10.1542/peds.2025-070697 |
| WHO2006_LHFA_STANDARD | WHO Child Growth Standards: Length/height-for-age | WHO | 2006 | who.int/tools/child-growth-standards/standards/length-height-for-age |
| WHO2006_WFL_WFH_STANDARD | WHO Child Growth Standards: Weight-for-length/height | WHO | 2006 | who.int/tools/child-growth-standards/standards/weight-for-length-height |
| WHO2007_BMI_5_19Y_REFERENCE | WHO growth reference for school-aged children & adolescents (5-19y BMI) | Bull WHO 85(9):660-667 | 2007 | 10.2471/BLT.07.043497 |

**Known numerics gaps in what we hold** (these are exactly what to fill): the AND/ASPEN mild/moderate/severe
z-score band table (lives in tables not captured verbatim), AFP Figure 1 severity cut-offs (image, not
text), and the raw WHO/CDC/INTERGROWTH numeric percentile/z-score *tables* themselves (we hold the
descriptive standards pages, not the number tables).
