---
title: "Evidence Foundry runtime on Research Foundry"
description: "Buildable integration design for using rf as the evidence-to-verified-claim control plane behind pediatric CDS module production."
audience: [clinical-informatics, clinical-governance, platform-engineering, validation, product]
tags: [pediatric-cds, evidence-foundry, research-foundry, governance, knowledge-base]
created: 2026-07-17
updated: 2026-07-17
status: proposed
---

# Evidence Foundry runtime, powered by Research Foundry (`rf`)

## Document control

| Item | Decision |
|---|---|
| Purpose | Define how the pediatric CDS Evidence Foundry reuses `rf` instead of creating a parallel evidence pipeline. |
| Primary seam | `rf` verified evidence bundle and claim ledger in; reviewed, tested, signed CDS KB release out. |
| First module | Pediatric CBC Suite, extending the current pediatric anemia prototype. |
| Clinical posture | HCP-facing, deterministic, transparent, abstention-capable, and non-autonomous. |
| Runtime posture | No generative model in patient-specific inference or release authorization. |
| Source of truth before the seam | `runs/<run_id>/` YAML owned by `rf`. |
| Source of truth after the seam | Versioned CDS authoring records and an immutable signed KB package. |
| Current `rf` posture | File-backed, deterministic offline spine; live discovery adapters are optional and currently 0/6 installed. |
| Current CDS posture | 91 JSON rules, 26 candidate patterns, 6 evidence records, and 10 engine tests. |
| Decision status | Architecture recommendation; clinical thresholds and release criteria still require governance approval. |

## Normative language

- **MUST** is a release-blocking requirement.
- **MUST NOT** is a prohibited behavior.
- **SHOULD** is the recommended default; deviation requires recorded rationale.
- **MAY** is optional and cannot be assumed by downstream components.
- “Source-supported fact” means an `rf` claim with resolved source/passage lineage and an allowed evidentiary status.
- “Implementation proposal” means a design or safety choice derived from evidence but not asserted verbatim by a source.
- “Release-ready” means all evidence, clinical, technical, validation, and signature gates applicable to the release class have passed.
- “Module” means a governed clinical content package, not merely a UI page or calculator.
- “KB pack” means the canonical build input that compiles into `data/evidence.json`, `data/rules.json`, `data/candidates.json`, tests, and release metadata.

## Inputs read for this design

- `Pediatric_CDS_Module_Research_Foundry_Prompt.md`: the module-production job and its ten quality domains.
- `pediatric-cds-expansion-dr.md`: Evidence Foundry operating model, platform architecture, validation roadmap, and example schemas.
- `Pediatric_CDS_Commercialization_Strategy.md`: Evidence Foundry Runtime and Wave 0–4 sequencing.
- `Pediatric_Anemia_CDS_Current_App_Specification.md`: current 91-rule/26-pattern/6-source deterministic prototype.
- `docs/architecture.md`: signed KB, evidence registry, rule authoring, FHIR, and fail-closed production posture.
- `data/rules.json`, `data/evidence.json`, `data/candidates.json`, and `schemas/rule.schema.json`: actual bridge targets.
- Reachable `rf` skill, CLI help, schemas, implementation, and operator-adapter contract: actual upstream control-plane behavior.

## 1. Thesis and fit

Research Foundry is the right substrate because the difficult evidence-operations work already matches its strengths: a durable run folder, source and extraction cards, a claim ledger, contradiction/inference status, deterministic verification, governance exit codes, council review, bundle lineage, and auditable writeback. Evidence Foundry should therefore be a clinical compilation and release layer over `rf`, not a second crawler, source store, claim tracker, or research orchestrator. This preserves one evidence lineage while keeping patient-safety concerns in the CDS domain: typed clinical facts, missingness, local laboratory profiles, executable logic, clinical review, test generation, retrospective validation, and signed deployment.

> **Division of labor:** `rf` owns **evidence → verified claim**; the pediatric CDS platform owns **verified claim → executable rule → validated, signed release**.

### 1.1 Architectural decision

```text
authoritative literature and local policy
                |
                v
rf run: source cards -> extraction cards -> claim ledger -> verify -> council -> bundle
                |
                |  immutable handoff: run id + bundle hash + claim/passage lineage
                v
CDS authoring: evidence projections -> candidate drafts -> clinician decisions -> rule DSL
                |
                v
compiler + tests -> retrospective/silent validation -> dual approval -> signed KB manifest
                |
                v
deterministic patient assessment runtime (no LLM)
```

### 1.2 Consequences

- Do not build a second literature-discovery service in this repository.
- Do not copy `rf` claims into free-form clinical notes and lose run lineage.
- Do not teach `rf` to execute patient-specific CDS.
- Do not make FHIR, LOINC, UCUM, rule compilation, or signed KB release responsibilities of core `rf`.
- Add only evidence-domain extensions to `rf`: pediatric extraction validation, review annotations, and surveillance metadata.
- Put the converter and every executable clinical artifact in the CDS platform repository.
- Treat `rf` bundles as immutable upstream inputs; corrections produce a new/reverified bundle, never an in-place downstream rewrite.
- Treat the converter output as a proposal until independent clinical reviewers approve each executable interpretation.
- Keep facts, recommendations, conflicts, inferences, and implementation choices distinguishable end to end.

### 1.3 System boundaries

| Boundary | `rf` control plane | Evidence Foundry/CDS platform |
|---|---|---|
| Research intent | Owns capture, triage, plan, IntentTree node. | Supplies module variables, intended use, exclusions, and clinical questions. |
| Discovery | Owns source-card ingestion and optional external workflow orchestration. | Supplies search protocol requirements and approved seed sources. |
| Evidence | Owns source/extraction cards and claims. | Defines pediatric evidence-card extension and eligibility policy. |
| Conflict | Represents mixed/contradicted claims and council concerns. | Decides safe executable representation or abstention/local configuration. |
| Rule proposal | May hold recommendation/inference claims. | Owns candidate rules, typed inputs, missingness, outputs, and DSL. |
| Clinical review | Council is methodological/adversarial evidence review. | Owns named, credentialed dual clinical approval and laboratory review. |
| Interoperability | No FHIR/rule-pack emitter. | Owns FHIR, CDS Hooks, SMART, LOINC, SNOMED CT, and UCUM mappings. |
| Verification | Verifies material claims and policy. | Verifies schemas, logic, coverage, boundaries, mutations, and deterministic behavior. |
| Validation | Provides research evidence; does not validate a clinical runtime. | Owns retrospective, silent-mode, human-factors, and interventional validation. |
| Release | Bundles research artifacts. | Produces content hash, signatures, compatibility, approvals, rollback, and registry entry. |
| Surveillance | Can plan/re-run research and write back. | Owns change impact, expiry, semantic diff, revalidation, and deployed-release status. |

## 2. Stage-by-stage mapping

### 2.1 Research Foundry Prompt sections

| Evidence Foundry responsibility | `rf` stage/verb | Reuse as-is | Extend in `rf` | Net-new in CDS platform; explicit seam |
|---|---|---|---|---|
| Prompt variables and intended use | `capture`, `triage`, `plan` | Raw idea, intent, I-BOM, IntentTree node, research brief, run profile, lineage. | Add a validated `pediatric_cds_module` intent attachment or tagged brief block; keep generic intent intact. | Own canonical module manifest, release class, HCP users, population, setting, exclusions, non-goals, and integration targets. Pass a frozen snapshot into capture/plan. |
| §1 search policy | `plan`, `ingest`, optional Claude workflow | Freshness, discovery angles, source cards, source type/rank, access date, locators, limitations, usage rights notes. | Add screening ledger, exact query log, inclusion/exclusion reason, update/correction/retraction/supersession checks, and five-year exception reason as validated fields. | Define clinical source-eligibility policy and require its pass result before claims can seed rules. No discovery engine is added to CDS. |
| §2 evidence extraction | `ingest`, `extract`, `claim-map` | Source metadata, extracted points/facts, evidence IDs, locators, quotes, cautions, confidence, claim status, source relation. | Add pediatric applicability, study design, population, assay, unit, threshold portability, diagnostic-accuracy, dangerous exceptions, review date, and surveillance query fields. | Project qualified evidence into `data/evidence.json` plus a richer authoring registry; reject incomplete implementable claims at the converter seam. |
| §3 clinical pathway | `claim-map`, `synthesize`, `verify`, `council` | Supported/recommendation/inference claims, conflicts, unresolved questions, evidence report. | Add optional structured `clinical_pathway_claim` labels; do not encode executable branching in `rf`. | Own ontology, branch order, urgency gates, minimum safe dataset, abstention, referral triggers, treatment boundary, and executable pathway graph. |
| §4 adaptive questionnaire | Claims can support question utility | Evidence for question relevance and terminology; inference status for proposed ordering. | No generic `rf` questionnaire emitter. Optionally validate evidence tags such as `supports_question_id`. | Own tri-state semantics, stable question IDs, enableWhen, data source/timestamp, information-value research protocol, FHIR Questionnaire, and clinician wording. |
| §5 machine-executable rules | `claim-map`, `verify`, `bundle` stops at verified claims | Claim IDs, exact evidence links, inference labels, contradictions, verification result, immutable bundle identity. | Add machine-readable claim roles such as threshold, qualifier, exclusion, output-language basis; never add patient execution. | Own `rf-bundle-to-kb-pack`, candidate rule drafts, rule DSL, compiler, `schemas/rule.schema.json` evolution, fact registry, calculated-fact library, and output rendering. |
| §6 validation and human factors | `verify`, `council`, telemetry | Evidence verification checks, unsupported list, review-required state, council record, reproducible run trace. | Add evidence-review checklist attachments and reviewer role metadata; do not claim runtime validation. | Own unit/schema/boundary/property/mutation/conflict/unreachable/semantic-diff tests; retrospective, silent, human-factors, rollout, metrics, and rollback evidence. |
| §7 regulatory/privacy/security/quality | `guard check`, `verify`, `writeback` | Sensitivity and key/writeback governance, source usage restrictions, audit telemetry, policy blocks. | Add content-rights reuse disposition and clinical evidence handling profile where generic governance lacks it. | Own intended-use/regulatory determination, HIPAA deployment controls, threat model, QMS records, IEC/ISO applicability, SBOM, signed builds, and clinical risk management. |
| §8 product/business value | Same run or a separately tagged `rf` run | Source-grounded market/workflow claims; inference/speculation labels. | None required for clinical MVP; separation by claim role is sufficient. | Keep hypotheses out of executable rule packs. Product scoring and commercial decisions live in portfolio planning, not patient runtime. |
| §9 deliverables | `bundle`, `writeback` | Research brief, swarm plan, source cards, extraction cards, claim ledger, report, verification, lineage, counts, writebacks. | Add pediatric evidence appendix export only if useful across products; avoid FHIR/rule coupling. | Own pathway, questionnaire, rule pack, FHIR mappings, test corpus, validation plans/results, traceability matrix, approval packet, and release manifest. |
| §10 quality gates | `verify`, `council` plus CDS CI | Unsupported-claim and inference-label checks; claim/source resolution; contradiction/inference status; human-review routing. | Strengthen exact-passage, retraction/supersession, source-recency, and clinical-card completeness checks. | Enforce local-range behavior, missingness, non-probabilistic points, no LLM decision path, dual approval, executable tests, signatures, and release compatibility. |

### 2.2 Operating-model chain

| Operating-model stage | `rf` coverage | Handoff artifact | CDS responsibility | Exit condition |
|---|---|---|---|---|
| Research question | `capture` → `triage` → `plan` | `run.yaml`, `research_brief.md`, `swarm_plan.yaml` | Freeze module scope and clinical questions in module manifest. | Clinical lead and evidence methodologist approve question/scope before discovery. |
| Literature discovery | `ingest` × N; optional Path-B Claude workflow | `sources/src_*.md`, optional `source_candidates.yaml` | Provide approved source classes and screening criteria; no parallel crawler. | Search log complete; required authoritative sources searched; exclusions recorded. |
| Evidence extraction | `extract` | `extractions/ext_*.yaml` plus source-card exact points | Define pediatric extraction profile and completeness policy. | All implementable claims have exact locator/passage or are ineligible for rule drafting. |
| Conflict adjudication | `claim-map`, deterministic report, `verify`, `council` | `claim_ledger.yaml`, contradiction log, council review | Choose conflict-visible UI, local profile, abstention, or no-rule outcome. | No conflict silently collapsed into one universal recommendation. |
| Candidate rule drafting | No executable stage in `rf` | Verified claim subset and bundle metadata | Converter emits proposal objects, never release rules directly. | Every proposal states source fact vs implementation decision and claim IDs. |
| Clinician review | `rf council` is supporting review only | `council_review.yaml` | Two independent clinician reviews plus adjudication; lab medicine for method/range rules. | Required named approvals complete; conflicts and dangerous misses addressed. |
| Machine-readable encoding | Not an `rf` responsibility | Pinned `evidence_bundle.yaml` + ledger + source cards | Compile approved proposal into canonical JSON DSL and FHIR artifacts. | Schema valid, typed facts resolved, units/missingness explicit, no embedded code. |
| Automated testing | `rf verify` tests research traceability only | `verification.yaml`, `run_trace.jsonl` | Generate and curate positive, negative, boundary, missingness, conflict, and dangerous-miss tests. | Rule activation and safety coverage targets pass; mutations are caught. |
| Retrospective validation | May research protocol; no clinical execution | Evidence bundle remains upstream provenance | Run version-pinned engine over multisite data and adjudicated cases. | Prespecified safety/utility/subgroup gate passes; otherwise revise or stop. |
| Signed release | `rf bundle` is not a CDS release | Verified bundle ID/hash and review artifacts | Assemble immutable KB, bind clinical/validation approvals, sign manifest, publish registry entry. | Signature verifies; content hash matches; engine compatibility and expiry valid. |
| Surveillance/update | New capture/plan or re-run; catalog/writeback | New run/bundle, supersession evidence, audit trail | Impact analysis from changed claim to affected rules/tests/releases; revalidation and rollback. | No deployment until diff, review, tests, and release gate appropriate to change class pass. |

### 2.3 The seam, stated as invariants

1. The seam accepts only an `rf` bundle whose `status` is `verified`.
2. The seam reads YAML from disk; it never relies on human-formatted CLI tables.
3. The seam records the `rf` process exit code and `reviews/verification.yaml.exit_code`.
4. The seam rejects any disagreement between process and artifact status.
5. The seam pins `run_id`, bundle ID, bundle SHA-256, claim-ledger SHA-256, and source-card hashes.
6. The seam never mutates `runs/<run_id>/`.
7. The seam admits `supported` claims as fact candidates only when their sources and exact passages resolve.
8. The seam admits `mixed` or `contradicted` claims only to conflict-visible authoring objects, never directly to one-sided rules.
9. The seam admits `inference` claims only as implementation-proposal inputs with `inference_basis.from_claims`.
10. The seam rejects `speculation` and `unsupported` claims from clinical rule evidence.
11. The seam does not translate claim confidence into patient probability.
12. The seam never interprets absence of an extracted claim as evidence of normality or safety.
13. The converter is deterministic: identical bytes and converter version produce identical normalized output bytes.
14. Converter output is an authoring proposal, not a released KB.
15. Clinical reviewers approve executable interpretations, not merely citations.

## 3. Per-module `rf` run template

### 3.1 Run identity and profile

| Setting | Required choice | Rationale |
|---|---|---|
| CWD | `/Users/miethe/dev/homelab/development/research-foundry` | `rf` is workspace-discovery and CWD-sensitive. |
| CLI | `/Users/miethe/.local/bin/rf` | Verified installed entry point. |
| Sensitivity | `public` for public literature and non-PHI module specs | Prevents accidental mixing of patient/site-sensitive data with content research. Use a separate higher-tier run for confidential local policy. |
| Depth | `deep` | A module requires broad evidence, conflicts, exceptions, and implementation qualifiers. |
| Audience | `technical` | The report feeds clinical informatics, rule authors, QA, and governance. |
| Freshness | `1825` days | Encodes five-year priority. Foundational older sources are hand-ingested with an explicit exception reason. |
| Cost ceiling | `5` USD planning ceiling | Makes live extras bounded; the deterministic spine remains offline. Adjust only through approved run policy. |
| Project | stable module slug | Correlates runs and downstream provenance; example `pediatric-cbc-suite`. |
| Synthesis | `--deterministic --draft` | Offline, reproducible baseline; generative synthesis is not required for verified handoff. |
| Verification | `--fail-on-unsupported` | Material unsupported claims block handoff. |
| Council | roles `methodologist,skeptic`, vote `consensus`, local | Provides adversarial evidence review without pretending to be clinical signoff. |
| Writeback | `meatywiki,skillmeat,ccdash` after gates | Records rationale, reusable workflow candidate, and telemetry. IntentTree/ARC may degrade to local stubs offline. |

### 3.2 Module variable envelope

The CDS repository owns a versioned module manifest and serializes this envelope into the capture text and research brief:

```yaml
schema_version: "1.0"
module_id: cbc_suite_v1
module_topic: Pediatric CBC Suite
intended_hcp_users:
  - general_pediatrician
  - family_physician
  - pediatric_advanced_practice_clinician
  - pediatric_hematologist
patient_population:
  age_min_months: 6
  age_max_months_exclusive: 216
  settings:
    - stable_outpatient_primary_care
    - urgent_care_followup
    - specialty_referral_preparation
intended_output:
  - reviewable_pattern
  - safety_caution
  - missing_information_question
  - confirmatory_next_step_option
  - referral_readiness
  - longitudinal_followup_state
explicit_exclusions:
  - neonate_or_age_under_6_months
  - hemodynamic_instability
  - active_major_bleeding
  - transfusion_decision
  - febrile_neutropenia_management
  - suspected_blast_crisis
  - acute_pancytopenia_requiring_emergency_evaluation
jurisdictions:
  - US
integration_targets:
  - web
  - api
  - smart_on_fhir
  - cds_hooks
evidence_policy:
  recent_window_days: 1825
  older_source_rule: foundational_not_superseded_with_reason
  exact_passage_required_for_implementable_claim: true
```

### 3.3 Exact CLI recipe

Run the following from the Research Foundry repository. Placeholders in angle brackets are outputs from the prior command, not invented IDs.

```bash
cd /Users/miethe/dev/homelab/development/research-foundry
RF_BIN=/Users/miethe/.local/bin/rf
export NO_COLOR=1
export TERM=dumb

$RF_BIN capture \
  "Pediatric CDS module research: Pediatric CBC Suite (cbc_suite_v1). Intended HCPs: general pediatricians, family physicians, pediatric APPs, and pediatric hematologists. Population: stable outpatient patients age 6 months to under 18 years. Outputs: reviewable CBC patterns, safety cautions, missing-information questions, confirmatory next-step options, referral readiness, and longitudinal follow-up state. Exclude neonates/young infants, instability, active major bleeding, transfusion decisions, febrile neutropenia management, suspected blast crisis, and acute pancytopenia requiring emergency evaluation. Jurisdiction: US. Integration targets: web, API, SMART-on-FHIR, and CDS Hooks. Apply the complete pediatric CDS module evidence policy and preserve source-fact versus implementation-proposal status." \
  --from evidence-foundry \
  --sensitivity public \
  --tag pediatric-cds \
  --tag cbc-suite \
  --tag module-cbc-suite-v1 \
  --urgency high \
  --title "Evidence Foundry: Pediatric CBC Suite v1"

$RF_BIN triage <raw_idea_path_from_capture> \
  --create-intent \
  --create-ibom \
  --create-tree-node

$RF_BIN plan <intent_id_from_triage> \
  --depth deep \
  --audience technical \
  --max-cost 5 \
  --freshness 1825 \
  --project pediatric-cbc-suite
```

After `plan`, capture `run=<RUN>` from the plain key/value line, then verify it by reading `runs/<RUN>/run.yaml`. Do not parse the decorated “planned run” line.

```bash
RUN=<run_id_from_plan>

$RF_BIN guard check \
  --profile personal \
  --run "$RUN" \
  --sensitivity public
```

The evidence lead then ingests each approved source. `--no-fetch` is preferred for a locally archived, normalized text/Markdown rendition; `--fetch` may be used for a known URL when network retrieval is intentionally enabled. A locator-only/degraded card is not sufficient for an implementable clinical claim.

```bash
$RF_BIN ingest /approved-sources/aap-cbc-guidance.md \
  --run "$RUN" \
  --source-type official_doc \
  --sensitivity public \
  --title "AAP pediatric CBC guidance" \
  --no-fetch

$RF_BIN ingest /approved-sources/pediatric-anemia-review.md \
  --run "$RUN" \
  --source-type paper \
  --sensitivity public \
  --title "Anemia in the pediatric patient" \
  --no-fetch

$RF_BIN ingest /approved-sources/cdc-lead-guidance.md \
  --run "$RUN" \
  --source-type official_doc \
  --sensitivity public \
  --title "CDC recommended actions based on blood lead level" \
  --no-fetch
```

Repeat `ingest` for each society guideline, government guidance, systematic review, diagnostic-accuracy study, consensus statement, and foundational source admitted by screening.

### 3.4 Discovery lane choices

| Lane | Command/workflow | When used | Current limitation |
|---|---|---|---|
| E0 deterministic seed lane | Repeat `rf ingest` over approved local source renditions. | First module and offline reproducibility. | Source acquisition/screening is human-seeded; PDFs without extracted text can degrade to locator-only cards. |
| Native `rf swarm run` | `$RF_BIN swarm run "$RUN" --adapters gpt_researcher,paperqa2 --profile personal --execute` | Only after those adapters are installed/configured and governance approves. | Today 0/6 live adapters are installed, so this is not the module-1 discovery path. |
| Claude Path-B workflow | `.claude/workflows/rf-run-execute.js` invoked by the Claude workflow runner with its documented args object. | E1 real web discovery with per-angle scouts and deterministic `rf` tail. | It is not an `rf` CLI verb; current workflow has hard-coded RF/repo/TMP/stamp paths that must be parameterized before production scheduling. |
| LAN API scaffold | `POST http://10.42.10.76:7432/api/runs` with owner Bearer token. | Shared run registration and reads. | Scaffolds capture→triage→plan only; it does not drive discovery or the deterministic spine. |

Do not substitute a fictional `rf research`, `rf discover`, or `--json` command. No `rf` command supports `--json`; structured truth is on-disk YAML.

### 3.5 Deterministic spine, review, and bundle

```bash
$RF_BIN extract "$RUN" \
  --model-profile rf_extract_cheap

$RF_BIN claim-map "$RUN"

$RF_BIN synthesize "$RUN" \
  --deterministic \
  --draft

$RF_BIN verify "$RUN" \
  --fail-on-unsupported
VERIFY_EXIT=$?

if [ "$VERIFY_EXIT" -ne 0 ]; then
  # The orchestrator records reviews/verification.yaml and routes by code.
  exit "$VERIFY_EXIT"
fi
```

The orchestrator branches on `VERIFY_EXIT` and reads `runs/$RUN/reviews/verification.yaml` in all cases. It does not continue blindly through a nonzero code.

```bash
$RF_BIN council "$RUN" \
  --roles methodologist,skeptic \
  --vote consensus \
  --via local
COUNCIL_EXIT=$?

if [ "$COUNCIL_EXIT" -ne 0 ]; then
  # Exit 7 is a human-review pause, not an adapter failure.
  exit "$COUNCIL_EXIT"
fi

$RF_BIN bundle "$RUN" \
  --verify

$RF_BIN writeback "$RUN" \
  --targets meatywiki,skillmeat,ccdash \
  --require-review
```

`--require-review` may return exit 7; that is a pause for human review, not an adapter crash. Writeback is not the CDS release action.

### 3.6 Required pediatric evidence-card extension

The generic `rf` schemas use `additionalProperties: true`, so E0 can carry an extension without breaking core validation. E1 SHOULD add an explicit `pediatric_cds` schema block and validator so incomplete cards fail before conversion.

```yaml
pediatric_cds:
  schema_version: "1.0"
  module_id: cbc_suite_v1
  evidence_role: threshold
  source_status:
    update_checked_at: "2026-07-17"
    correction_checked: true
    retraction_checked: true
    withdrawal_checked: true
    supersession_checked: true
    superseded_by: null
    foundational_exception_reason: null
  study:
    design: guideline
    population: pediatric patients
    setting: outpatient_and_specialty
    sample_size: null
    inclusion: []
    exclusion: []
    comparator: null
    outcome: null
    evidence_grade: null
  applicability:
    age_min_months: 6
    age_max_months_exclusive: 216
    sex_or_physiology: age_and_sex_partitioned_where_source_specifies
    gestational: not_applicable
    ancestry_or_population: source_specific
    comorbidities: []
    jurisdictions: [US]
  laboratory:
    test: hemoglobin
    specimen: whole_blood
    method: source_or_local_method
    analyzer: local_profile_required_if_method_dependent
    unit: "g/dL"
    ucum: "g/dL"
    reference_interval: source_specific_or_local
    timing: encounter
    preanalytic_requirements: []
  implementable_statement:
    kind: threshold
    value_or_formula: null
    portability: local_lab_dependent
    assertion_kind: source_supported_fact
    exact_passage_required: true
  diagnostic_accuracy:
    sensitivity: null
    specificity: null
    likelihood_ratio_positive: null
    likelihood_ratio_negative: null
    predictive_value_positive: null
    predictive_value_negative: null
    confidence_interval: null
    prevalence: null
  safety:
    contraindications: []
    confounders: []
    false_positive_contexts: []
    false_negative_contexts: []
    dangerous_exceptions: []
  conflict:
    conflicts_with_claim_ids: []
    conflict_summary: null
    safe_representation: local_configuration
  lifecycle:
    review_by: "2027-01-17"
    surveillance_query: "pediatric CBC reference interval guideline update"
    owner_role: evidence_methodologist
```

### 3.7 Fields required before a claim is converter-eligible

| Field | Rule |
|---|---|
| `source_card_id` | MUST resolve to a source card in this bundle/run. |
| `evidence_id` | MUST resolve to an extracted point/passage in that source. |
| `locator` | MUST identify page/section/table/figure/paragraph; `para/0` from degraded content is insufficient for a threshold. |
| exact passage | MUST be present and within permitted quotation/reuse terms, or an immutable passage reference MUST resolve. |
| source status | Update, correction, retraction, withdrawal, and supersession checks MUST be recorded. |
| recency | Sources older than five years MUST state foundational, not-superseded rationale. |
| population/applicability | Age, setting, physiology, comorbidity, and jurisdiction qualifiers MUST not be dropped. |
| laboratory context | Test, specimen, method/analyzer applicability, units, reference interval, and timing MUST be explicit when relevant. |
| threshold portability | MUST be `universal`, `local_lab_dependent`, or `implementation_proposed`. |
| conflicts | Contradicting claims and safe representation MUST be visible. |
| claim status | MUST be `supported`, `mixed`, `contradicted`, or `inference`; only `supported` can become fact evidence automatically. |
| lifecycle | Review date and surveillance query MUST be present for implementable clinical content. |

### 3.8 CBC research angles for the Path-B run

1. Scope, age partitions, local pediatric reference intervals, analyzer/method effects, and unit normalization.
2. Anemia definition, morphology, RDW, and reticulocyte response.
3. Iron deficiency, ferritin in inflammation, Ret-He, iron studies, and nonresponse.
4. Alpha/beta thalassemia and hemoglobinopathy triage without ancestry stereotyping.
5. Hemolysis, DAT, smear findings, membrane/enzyme disorders, and transfusion confounding.
6. Neutropenia, leukocytosis/lymphocytosis, eosinophilia, and infection-related CBC patterns.
7. Thrombocytopenia/thrombocytosis and combined cytopenia patterns.
8. Pancytopenia, blasts, marrow failure/infiltration, and dangerous-miss safety exits.
9. Lead, nutritional, renal, inflammatory, endocrine, medication, and mixed etiologies.
10. Adaptive questions, referral readiness, longitudinal follow-up, and minimum safe dataset.
11. Clinical validation, subgroup/analyzer/site analysis, and human factors.
12. Regulatory classification, content rights, FHIR/terminology, privacy/security, and quality-system implications.

### 3.9 CBC run acceptance before handoff

- `run.yaml` matches the approved CBC module manifest snapshot.
- All required angles have sources or a documented evidence gap.
- Search and screening records are complete enough to reproduce selection.
- `claim_ledger.yaml` exists and has no unsupported material claims.
- `verification.yaml.passed` is true and `exit_code` is 0.
- Council output is approve/consensus or all concerns have a recorded resolution.
- Every threshold claim has an exact passage and portability classification.
- Every dangerous exception has a candidate safety representation or explicit no-rule decision.
- All mixed/contradicted claims remain mixed/contradicted at the handoff.
- `evidence_bundle.yaml.status` is `verified`.
- Bundle lineage resolves to the run, intent, source cards, ledger, report, and verification record.
- The bundle and all referenced artifacts are hashed before converter execution.

## 4. The handoff contract: `rf` bundle to CDS KB pack

### 4.1 Contract name and ownership

The bridge is a deterministic converter named **`rf-bundle-to-kb-pack`**.

| Attribute | Decision |
|---|---|
| Repository | This pediatric CDS repository, not Research Foundry. |
| Proposed path | `tools/rf-bundle-to-kb-pack/`. |
| Runtime | Node.js ESM, matching the current project; use a pinned YAML parser and JSON Schema validator. |
| Input authority | Read-only `rf` run directory plus approved CDS module manifest and authoring decisions. |
| Output authority | Staged `kb-pack` proposal; never writes directly to production registry. |
| Determinism | Stable sorting, normalized newlines, canonical JSON serialization, content hashes, no network, no LLM. |
| Failure posture | Fail closed on unresolved refs, ambiguous units, missing exact passage, bad status, schema failure, or hash drift. |
| Release authority | None; only the clinical governance/release service can approve and sign. |

### 4.2 Why the converter belongs downstream

- It knows the pediatric clinical DSL, typed fact registry, output vocabulary, local profile model, and runtime compatibility.
- It knows `schemas/rule.schema.json` and the actual limitations of the current rule engine.
- It creates FHIR and terminology projections, which are not generic research concerns.
- It creates executable tests and traceability to runtime output.
- Keeping it out of `rf` prevents a general research control plane from accumulating product-specific clinical semantics.
- A future non-pediatric product can build its own compiler over the same `rf` bundle contract.

### 4.3 Inputs

```text
required
  runs/<RUN>/evidence_bundle.yaml
  runs/<RUN>/claims/claim_ledger.yaml
  runs/<RUN>/reviews/verification.yaml
  runs/<RUN>/sources/src_*.md
  runs/<RUN>/extractions/ext_*.yaml
  modules/<module_id>/module.yaml
  modules/<module_id>/authoring-decisions.yaml

conditional
  runs/<RUN>/reviews/council_review.yaml
  runs/<RUN>/claims/contradiction_log.yaml
  runs/<RUN>/claims/inference_log.yaml
  terminology/loinc-map.json
  terminology/ucum-map.json
  terminology/snomed-map.json
  profiles/local-lab/*.json
  validation/adjudication/*.json
```

The converter MUST resolve artifact paths from `evidence_bundle.yaml.artifacts`; hard-coded assumptions are fallback validation only.

### 4.4 Outputs

```text
build/kb-pack/<module_id>/<pack_version>/
  pack-provenance.json
  evidence.json
  evidence-assertions.json
  candidates.json
  rule-proposals.json
  rules.json
  rule-provenance.json
  questions.json
  terminology.json
  fhir/
    Questionnaire.json
    PlanDefinition.json
    ActivityDefinition-*.json
    cds-hooks-service.json
  tests/
    positive.json
    negative.json
    boundary.json
    missingness.json
    conflict.json
    dangerous-miss.json
    traceability.json
  validation-plan.json
  unresolved.json
  semantic-diff.json
  release-manifest.unsigned.json
  conversion-report.json
```

Only after approval does the release assembly step merge the module projection into repository/runtime artifacts:

```text
data/evidence.json
data/candidates.json
data/rules.json
data/rule-provenance.json        # new
data/evidence-assertions.json    # new
data/questions.json              # new when questionnaire decouples from rules
validation/cases/<module_id>/*.json
releases/<knowledgeBaseVersion>/manifest.json
```

### 4.5 Converter interface

The following is a proposed platform CLI, not an existing `rf` command:

```bash
node tools/rf-bundle-to-kb-pack/cli.mjs inspect \
  --run-dir /Users/miethe/dev/homelab/development/research-foundry/runs/<RUN> \
  --module modules/cbc_suite_v1/module.yaml

node tools/rf-bundle-to-kb-pack/cli.mjs propose \
  --run-dir /Users/miethe/dev/homelab/development/research-foundry/runs/<RUN> \
  --module modules/cbc_suite_v1/module.yaml \
  --decisions modules/cbc_suite_v1/authoring-decisions.yaml \
  --out build/kb-pack/cbc_suite_v1/0.1.0-proposal

node tools/rf-bundle-to-kb-pack/cli.mjs verify \
  --pack build/kb-pack/cbc_suite_v1/0.1.0-proposal \
  --rule-schema schemas/rule.schema.json
```

`propose` can emit rule skeletons only where an approved authoring decision exists. It MUST NOT infer clinical Boolean logic from prose on its own.

### 4.6 Converter phases

| Phase | Operation | Failure condition |
|---|---|---|
| 1. Pin | Resolve run and artifacts; calculate SHA-256 for every input. | Missing artifact, path escape, changed bytes, or bundle not verified. |
| 2. Validate upstream | Parse YAML; validate `rf` schemas; reconcile verify process/artifact state. | Schema error, nonzero unresolved verify state, unsupported claim, or dangling source. |
| 3. Normalize | Canonicalize IDs, dates, whitespace, locators, units, status, and ordering. | Invalid date, non-UCUM unit where required, duplicate stable ID, or ambiguous locator. |
| 4. Select | Apply claim eligibility and module scope; retain rejected items with reason. | Scope mismatch or hidden conflict. |
| 5. Project evidence | Emit sources and exact-passage assertion records. | Quote/rights problem, no exact passage, or no lifecycle metadata. |
| 6. Join decisions | Match reviewed authoring decisions to claim sets. | Proposal without basis, stale decision, or reviewer role missing. |
| 7. Draft rules | Materialize strict runtime rule JSON and richer provenance sidecar. | Fact/type/unit/missingness/output unresolved. |
| 8. Draft candidates | Materialize candidate patterns and source IDs. | Candidate has no supporting rule/evidence or implies diagnosis/probability. |
| 9. Draft tests | Materialize approved cases and required test placeholders. | Any rule lacks positive, negative, boundary when numeric, missingness, or dangerous-miss classification. |
| 10. Validate | JSON Schema, references, trace graph, determinism, collision, and semantic checks. | Any error; warnings require disposition before release. |
| 11. Manifest | Emit unsigned manifest with hashes and upstream lineage. | Hash set incomplete or evidence review date absent. |

### 4.7 Stable identity rules

| Entity | Stable ID policy | Example |
|---|---|---|
| Module | Human-assigned, immutable snake case plus major version. | `cbc_suite_v1` |
| `rf` run | Preserve native ID exactly. | `rf_run_20260717_pediatric_cbc_suite` |
| Bundle | Preserve `evidence_bundle.yaml.id`. | `bundle_...` |
| Source | Preserve `source_card_id`; add a CDS alias only for current runtime compatibility. | `src_...`, alias `AAP2026_IDA` |
| Passage | Prefer persistent `passage_id`; otherwise hash edition + exact text + selector. | `psg_<sha256>` |
| Claim | Preserve `claim_id`; use persistent canonical claim reference when present. | `clm_...` |
| Authoring decision | Module-scoped immutable ID. | `dec_cbc_ferritin_local_001` |
| Rule | Human-reviewed stable uppercase ID satisfying `^[A-Z0-9-]+$`. | `CBC-IRON-001` |
| Test | Rule ID + class + stable sequence. | `CBC-IRON-001-BOUNDARY-001` |
| Output | Output type + rule ID unless candidate aggregation defines its own ID. | `alert:CBC-SAFE-001` |
| Release | Semantic/content version plus evidence date. | `1.0.0-2027-01-15` |

IDs MUST NOT be derived solely from array position. A renamed claim/rule retains ID when semantics are unchanged; a materially changed assertion receives a new version or ID according to registry policy.

### 4.8 Top-level bundle mapping

| `rf` source | CDS target | Transformation |
|---|---|---|
| `evidence_bundle.yaml.id` | `pack-provenance.json.rfBundleId` | Copy exact. |
| `evidence_bundle.yaml.run_id` | `pack-provenance.json.rfRunId` | Copy exact. |
| `evidence_bundle.yaml.intent_id` | `pack-provenance.json.rfIntentId` | Copy exact. |
| `status` | `upstreamVerification.bundleStatus` | Must equal `verified`. |
| `created_at` | `upstreamVerification.bundleCreatedAt` | Normalize RFC 3339 without changing instant. |
| `artifacts` | `upstreamArtifacts[]` | Resolve relative to run root, hash, record size and media type. |
| `counts` | `upstreamCounts` | Copy for audit; recalculate and compare. |
| `governance.sensitivity` | `dataClassification` | Copy; enforce target environment policy. |
| `governance.approved_for_writeback` | `rfWritebackApproved` | Informational only; not CDS release approval. |
| `lineage` | `rfLineage` | Preserve full block. |
| bundle SHA-256 | `upstreamVerification.bundleSha256` | Calculate over exact input bytes. |

### 4.9 Source-card to `data/evidence.json` mapping

The current `data/evidence.json` has a top-level `knowledgeBaseVersion`, `reviewedThrough`, and `sources[]`. Its source records contain `id`, priority, year, title, organization, journal, DOI/URL, `supports[]`, and optional recency note. The mapping stays backward compatible while adding structured fields.

| `rf` source-card field | `data/evidence.json` field | Rule |
|---|---|---|
| `source_card_id` | `sources[].rfSourceCardId` | Preserve native ID. |
| approved compatibility alias | `sources[].id` | Required by current rules/UI; collision checked and immutable. |
| `source.title` | `sources[].title` | Exact bibliographic title. |
| `source.source_type` + `trust.source_rank` | `sources[].priority` | Map through controlled table; do not overstate authority. |
| `source.published_at` | `sources[].publicationDate` and derived `year` | Preserve full date when known. |
| `source.authors` | `sources[].authors` | Preserve ordered list. |
| `source.publisher` | `sources[].organization` or `publisher` | Organization only when semantically correct. |
| `source.locator.url` | `sources[].url` | Copy normalized URL. |
| `source.locator.doi` | `sources[].doi` | Normalize DOI prefix. |
| source extension citation | `sources[].journal` | Do not synthesize from title/publisher. |
| `trust.known_limitations` | `sources[].limitations` | Copy, never hide. |
| `trust.conflicts_with` | `sources[].conflictsWith` | Resolve to source aliases/native IDs. |
| `usage` | `sources[].contentRights` | Preserve quote/reuse constraints. |
| extracted point summaries | `sources[].supports` | Include only approved source-supported summaries; each links to assertion ID. |
| pediatric lifecycle | `sources[].reviewBy`, `surveillanceQuery`, `supersessionStatus` | Required for clinical content. |
| foundational reason | `sources[].recencyNote` | Required when outside five-year priority window. |

`reviewedThrough` is the latest date on which the complete release evidence set passed surveillance, not the publication date of the newest source.

### 4.10 Exact-passage evidence projection

The current evidence registry is source-level and cannot by itself satisfy exact passage traceability. Add `data/evidence-assertions.json`:

```json
{
  "schemaVersion": "1.0",
  "assertions": [
    {
      "assertionId": "evas_cbc_iron_001",
      "rfRunId": "rf_run_...",
      "rfSourceCardId": "src_...",
      "sourceId": "AAP2026_IDA",
      "rfEvidenceId": "ev_004",
      "rfClaimId": "clm_017",
      "passageId": "psg_<sha256>",
      "locator": {
        "page": "12",
        "section": "Diagnosis",
        "table": null,
        "paragraph": "3"
      },
      "exactPassage": "<licensed short passage or null when display is restricted>",
      "exactPassageSha256": "sha256:<digest>",
      "displayPolicy": "clinician_authenticated_short_excerpt",
      "claimStatus": "supported",
      "applicability": {},
      "laboratory": {},
      "reviewBy": "2027-01-17"
    }
  ]
}
```

If rights prohibit storing/displaying the text, the record MUST retain an immutable passage hash and precise selector plus a governed retrieval path. A rule cannot become release-ready if an independent reviewer cannot inspect the passage.

### 4.11 Claim-ledger mapping

| `claim_ledger.yaml.claims[]` | Authoring/evidence target | Eligibility |
|---|---|---|
| `claim_id` | `basis.claimIds[]`, trace graph node | Always preserve. |
| `text` | `evidence-assertions[].normalizedClaim` | Preserve qualifiers; no lossy paraphrase. |
| `materiality` | `basis.materiality` | Material claims require full evidence and approval. |
| `claim_type` | `basis.claimType` | Quantitative/causal/recommendation receive enhanced checks. |
| `status=supported` | `basis.kind=source_supported_fact` | Eligible with resolved exact passage and applicability. |
| `status=mixed` | `basis.kind=conflicting_source_facts` | Conflict object only until adjudicated representation approved. |
| `status=contradicted` | `basis.kind=contradicted_source_fact` | Cannot be sole positive rule basis. |
| `status=inference` | `basis.kind=implementation_proposal` | Requires valid `inference_basis`, decision record, and clinical approval. |
| `status=speculation` | unresolved/research agenda | Never rule evidence. |
| `status=unsupported` | rejected | Hard failure if material; never emitted into KB evidence. |
| `confidence` | evidence-review metadata | Never mapped to probability, score, or patient risk. |
| `sources[]` | source→passage edges | Every support/contradict/context relation preserved. |
| `inference_basis.from_claims` | proposal derivation edges | All parent claims must resolve. |
| `persistent_references` | durable lineage | Prefer edition/passage/assertion/canonical IDs when present. |
| `reviewer_notes` | review context | Preserved but not executed. |

### 4.12 Authoring decision record

The converter needs an explicit reviewed decision between claims and rules:

```yaml
decision_id: dec_cbc_local_range_precedence_001
module_id: cbc_suite_v1
status: approved_for_rule_draft
basis:
  kind: implementation_proposal
  rf_claim_ids:
    - clm_age_specific_intervals
    - clm_analyzer_variability
  exact_assertion_ids:
    - evas_cbc_age_interval_001
  reasoning: >-
    Prefer configured local pediatric laboratory intervals; abstain when
    method-dependent interpretation is required and no compatible profile exists.
conflicts:
  visible: true
  representation: local_profile_or_abstain
clinical_effect:
  intended_output: interpretive_note
  prohibited_effects:
    - infer_normal_from_missing_range
    - silent_unit_conversion
review:
  evidence_methodologist: pending
  clinician_1: pending
  clinician_2: pending
  laboratory_medicine: pending
```

This is where “implementation proposal vs source-supported fact” becomes an explicit, reviewable choice. It is not encoded by changing an `rf` claim from inference to supported.

### 4.13 Rule proposal to current `data/rules.json`

The current `schemas/rule.schema.json` permits exactly `id`, `category`, `when`, `evidence`, and `output`; `additionalProperties` is false. Therefore:

- Canonical authoring rules MAY contain rich metadata in `rule-proposals.json`.
- Generated `data/rules.json` MUST remain a strict projection conforming to the existing schema.
- Rich traceability MUST go into `data/rule-provenance.json` until a deliberate rule-schema v2 migration.
- The compiler MUST NOT silently discard metadata; it must emit it to the sidecar and prove the join by rule ID.

| Authoring rule field | Runtime `rules.json` | Sidecar/other output |
|---|---|---|
| stable rule ID | `id` | duplicated as join key |
| clinical class | `category` | safety class, owner, status in provenance |
| Boolean expression | `when` | typed-fact and missingness analysis in provenance |
| source aliases | `evidence[]` | claim/assertion/passage IDs in provenance |
| candidate/alert/question/note | `output` | approved wording ID and human-factors status |
| version/effective/review dates | not allowed | `rule-provenance.json` |
| implementation-decision status | not allowed | `basis.kind` in provenance |
| clinical approvers | not allowed | approval records and release manifest |
| test IDs | not allowed | provenance and test corpus |
| supersession | not allowed | provenance and registry |

Example strict runtime projection:

```json
{
  "id": "CBC-IRON-001",
  "category": "differential",
  "when": {
    "all": [
      { "fact": "anemia.present", "op": "eq", "value": true },
      { "fact": "ferritin.low", "op": "eq", "value": true }
    ]
  },
  "evidence": ["AAP2026_IDA"],
  "output": {
    "type": "candidate",
    "candidateId": "iron-deficiency-anemia",
    "level": "meets-defined-pattern",
    "points": 110,
    "support": ["Hemoglobin and ferritin meet the active reviewed pattern criteria."]
  }
}
```

Companion provenance:

```json
{
  "ruleId": "CBC-IRON-001",
  "moduleId": "cbc_suite_v1",
  "basis": {
    "kind": "implementation_proposal",
    "decisionId": "dec_cbc_iron_pattern_001",
    "rfClaimIds": ["clm_017", "clm_018"],
    "evidenceAssertionIds": ["evas_cbc_iron_001", "evas_cbc_iron_002"]
  },
  "missingness": "no_match_and_emit_required-data-question",
  "localProfileRequirement": "ferritin_assay_and_inflammation_context",
  "testIds": [
    "CBC-IRON-001-POSITIVE-001",
    "CBC-IRON-001-NEGATIVE-001",
    "CBC-IRON-001-BOUNDARY-001",
    "CBC-IRON-001-MISSING-001"
  ],
  "reviewStatus": "draft"
}
```

The numeric `points` value remains an ordinal software sorting input. It MUST be labeled non-probabilistic, tested for stable ordering, and never described as likelihood or confidence.

### 4.14 Candidate-pattern mapping

| Candidate field | Source | Requirement |
|---|---|---|
| object key and `id` | Approved ontology term | Exact match; stable kebab case. |
| `label` | Clinician-reviewed wording | Must say “pattern” where diagnosis is not established. |
| `category` | Ontology | No unsupported disease certainty. |
| `summary` | Claims + implementation decision | Qualifiers retained; conflict visible. |
| `defaultNextSteps[]` | Recommendation claims and intended-use policy | Options, not autonomous orders or treatment directives. |
| `evidence[]` | Source aliases | Every ID resolves in evidence registry. |
| rule membership | Rule compiler | At least one approved rule must emit the candidate. |
| traceability | New provenance sidecar | Candidate→rules→claims→passages graph. |

The existing 26 entries in `data/candidates.json` become migration fixtures. They are not accepted as fully traceable simply because they contain source IDs.

### 4.15 Test-corpus contract

Each case is engine-executable and version-pinned:

```json
{
  "testId": "CBC-SAFE-009-DANGEROUS-001",
  "moduleId": "cbc_suite_v1",
  "class": "dangerous-miss",
  "clinicalIntent": "Mild anemia must not suppress a blast/multilineage cytopenia alert.",
  "basis": {
    "ruleIds": ["CBC-SAFE-009"],
    "rfClaimIds": ["clm_marrow_red_flags"],
    "evidenceAssertionIds": ["evas_marrow_red_flags_001"]
  },
  "input": {},
  "expected": {
    "matchedRuleIds": ["CBC-SAFE-009"],
    "requiredAlertSeverity": "emergency",
    "forbiddenCandidateIds": [],
    "assessmentProduced": true
  },
  "boundaryProfile": null,
  "review": {
    "clinician1": "pending",
    "clinician2": "pending"
  }
}
```

| Test class | Minimum per rule/release | Purpose |
|---|---|---|
| Positive | At least one per rule | Proves the intended branch activates. |
| Negative | At least one per rule | Proves a close non-match does not activate. |
| Boundary | Every numeric threshold, age partition, interval, and date edge | Catches `>`/`>=`, unit, age, and rounding defects. |
| Missingness | Every required/clinically material input | Proves absent/unknown/not-assessed is not normal. |
| Conflict | Every executable conflict representation | Proves disagreement remains visible or routes to configuration/abstention. |
| Dangerous miss | Every prespecified high-harm condition and distracting presentation | Proves safety alerts dominate benign pattern ranking. |
| Determinism | Every golden scenario | Same input + same KB produces byte-equivalent clinical content after timestamp scrub. |
| Irrelevant input | Representative rules | Proves unrelated fields do not change output. |
| Mutation | Every safety/threshold rule and risk-based sample of others | Proves tests fail when operators, values, or branches are perturbed. |
| Semantic diff | Every release | Shows affected rules, tests, candidates, outputs, and evidence. |

The current six worked examples and ten tests seed this corpus; they do not meet production coverage by themselves.

### 4.15.1 Expansion-appendix compatibility

The machine-readable appendix’s illustrative objects become governed records rather than parallel schemas:

| Appendix object | Canonical destination | Additional binding required |
|---|---|---|
| `evidence_record` | Source plus evidence assertion projection | Add native source/passage/claim IDs, exact locator, applicability, lifecycle, rights, and conflict status. |
| `rule` | Canonical authoring decision/rule proposal, then current-schema runtime projection | Replace prose `logic[]` with reviewed Boolean AST; resolve inputs, units, abstention, evidence assertions, and tests. |
| `validation_result` | `validation/results/<validation_run_id>.json` and release manifest reference | Pin module/release/engine/KB/dataset versions; add protocol hash, reference standard, confidence intervals, subgroup results, missingness, adjudication, and signoff. |
| `module_release` | Signed KB release manifest and registry entry | Bind evidence cutoff, active profiles, known limitations, approval IDs, validation run/hash, artifact hashes, supersession, engine compatibility, and signature. |

The appendix’s example `dangerous_miss_rate` and `referral_completeness_delta` values are illustrative only. The converter MUST NOT carry example values into a release; metrics come only from an executed, version-pinned validation run.

`validation_result.status` is derived from prespecified protocol gates, never free text supplied by the converter. `module_release.advisory_signoff` is replaced or augmented by verifiable approval records; role names alone do not prove approval.

### 4.16 Traceability graph

The normative trace chain is:

```text
source edition
  -> exact passage / extracted evidence point
  -> rf claim and status
  -> CDS authoring decision
  -> rule proposal
  -> compiled rule
  -> executable test
  -> engine matched-rule trace
  -> rendered output
  -> KB release manifest
```

Required graph edges:

| From | To | Cardinality rule |
|---|---|---|
| Source | Passage | One source edition has one or more passages. |
| Passage | Claim | Every supported implementable claim has at least one supporting passage. |
| Claim | Decision | Every rule decision cites one or more eligible claims; inference cites parent claims. |
| Decision | Rule | Every compiled rule has exactly one active authoring decision version. |
| Rule | Test | Every rule has positive and negative tests; numeric rules also have boundary tests. |
| Test | Output | Every output type has at least one assertion over rendered result and matched-rule trace. |
| Release | All artifacts | Manifest hashes every shipped content artifact and the traceability index. |

Bidirectional queries MUST work:

- Given a rendered caution, show rule, decision, claims, passages, sources, review date, and release.
- Given a source correction, list claims, rules, tests, outputs, and active releases potentially affected.
- Given a test failure, list the rule change and upstream evidence/decision basis.
- Given a release, reproduce the exact bundle, compiler version, rules, tests, and approvals.

### 4.17 Conflict representation

| Upstream state | Allowed downstream result | Prohibited result |
|---|---|---|
| Two sources agree | Shared fact basis with both passages. | Dropping a source qualifier. |
| `mixed` | Configurable profile, dual presentation, question, caution, abstention, or research gap. | Selecting one cutoff silently. |
| `contradicted` | No-rule, explicit conflict warning, or governance adjudication with rationale. | Treating contradicted claim as ordinary supported fact. |
| Local method dependence | Required local lab profile and fail-closed behavior. | Universal hard-coded threshold. |
| Implementation proposal | Explicit decision record, tests, and clinical approvals. | Relabeling proposal as guideline fact. |

### 4.18 Signed KB release manifest tie-in

The production manifest extends the architecture’s proposed manifest:

```json
{
  "knowledgeBaseVersion": "1.0.0-2027-01-15",
  "clinicalContentHash": "sha256:<canonical-pack-digest>",
  "engineCompatibility": ">=1.0.0 <2.0.0",
  "evidenceReviewedThrough": "2027-01-15",
  "rfInputs": [
    {
      "runId": "rf_run_...",
      "bundleId": "bundle_...",
      "bundleSha256": "sha256:...",
      "claimLedgerSha256": "sha256:...",
      "verificationExitCode": 0
    }
  ],
  "converter": {
    "name": "rf-bundle-to-kb-pack",
    "version": "1.0.0",
    "configSha256": "sha256:..."
  },
  "approvedBy": [
    { "role": "pediatric hematologist", "approvalId": "..." },
    { "role": "general pediatrician", "approvalId": "..." },
    { "role": "laboratory medicine", "approvalId": "..." }
  ],
  "validationRunId": "val_cbc_suite_...",
  "validationArtifactHash": "sha256:...",
  "testCorpusHash": "sha256:...",
  "traceabilityHash": "sha256:...",
  "supersedes": "0.9.4-2026-11-01",
  "releasedAt": "2027-01-15T18:00:00Z",
  "signature": {
    "algorithm": "<approved-signing-algorithm>",
    "keyId": "<release-key-id>",
    "value": "<detached-signature>"
  }
}
```

Signing occurs only after canonical serialization. The assessment runtime verifies signature, content hash, engine compatibility, and expiry before loading; any failure produces “no assessment produced.”

### 4.19 Current-repository migration note

- `src/evidence.js` currently duplicates the evidence registry and hard-codes the KB version/review date.
- `data/evidence.json` is used by the build metadata but not the engine import path.
- E0 MUST choose one generated evidence source of truth and eliminate hand-maintained divergence.
- Recommended default: generate a small ESM module from `data/evidence.json` during build, or load an injected immutable registry in both browser and server modes.
- `scripts/validate-kb.mjs` currently checks IDs, executable condition shape, evidence references, and candidate references, but does not validate `schemas/rule.schema.json` directly.
- E0 MUST add actual JSON Schema validation, traceability validation, and sidecar joins.

## 5. Governance and gates

### 5.1 Gate architecture

```text
G0 scope approval
 -> G1 rf governance/search protocol
 -> G2 rf claim verification
 -> G3 evidence council
 -> G4 converter eligibility
 -> G5 independent clinical + lab review
 -> G6 executable technical verification
 -> G7 retrospective/silent/human-factors validation
 -> G8 signed release
 -> G9 surveillance and incident response
```

No downstream pass retroactively cures an upstream failure. For example, a passing engine test cannot legitimize an unsupported threshold.

### 5.2 `rf verify` exit-code routing

| Exit | Meaning | Evidence Foundry state | Required action | Release effect |
|---:|---|---|---|---|
| 0 | OK | `evidence_verified` | Read YAML checks, hash bundle inputs, proceed to council/converter. | Necessary, not sufficient. |
| 1 | Usage/not found | `pipeline_error` | Correct run/artifact reference; do not retry blindly. | Block. |
| 2 | Schema | `evidence_schema_failed` | Repair upstream artifact through supported `rf` workflow; re-run verification. | Block. |
| 3 | GOVERNANCE | `governance_review_required` | Route policy violation with `governance_review.yaml`/stderr to governance owner; change sensitivity/key/target or deny. | Block; never override in converter. |
| 4 | UNSUPPORTED | `unsupported_claims` | Read `verification.yaml.unsupported[]`; add valid evidence, narrow/remove claim, or label legitimate inference; re-run. | Hard block for material clinical content. |
| 5 | Budget | `research_budget_paused` | Evidence lead approves scope/cost change or continues offline with seeds. | Block until run completes adequately. |
| 6 | Adapter | `discovery_adapter_failed` | Preserve partial evidence, diagnose adapter, retry approved lane, or use deterministic seeds. | Block completeness gate unless documented lane still satisfies protocol. |
| 7 | HUMAN_REVIEW | `human_review_pending` | Pause and route to council/human gate; it is not a technical failure. | Block until concern resolved and recorded. |

The process exit code is the stable machine contract. The adapter MUST then read `reviews/verification.yaml` for `passed`, `exit_code`, `checks[]`, `unsupported[]`, and `human_review_required`.

### 5.3 Council and clinical governance are different gates

| Review | Purpose | Minimum roles | Authority |
|---|---|---|---|
| `rf council` | Adversarial evidence-method review, contradiction/gap challenge, and consensus/concern signal. | `methodologist,skeptic` for module recipe. | Can block evidence handoff; cannot approve clinical release. |
| Clinical content review 1 | Verify source interpretation, population, pathway logic, outputs, and dangerous misses. | Subspecialist appropriate to module; pediatric hematologist for CBC. | Independent vote. |
| Clinical content review 2 | Independently repeat rule/passage/test review. | General pediatrician or second qualified pediatric clinician, per rule class. | Independent vote; must not merely countersign reviewer 1. |
| Laboratory review | Verify specimen, method, analyzer, units, local intervals, and assay portability. | Laboratory medicine/pathology. | Required for all lab-dependent rules. |
| Adjudication | Resolve reviewer disagreement and conflict representation. | Named adjudicator not the sole original author; clinical governance chair as needed. | Produces signed decision record. |
| Release authorization | Bind evidence, decisions, tests, validation, intended use, and signature. | Authorized clinical and quality/release roles. | Only gate that marks KB release-ready. |

### 5.4 Dangerous-miss review

For CBC v1, dangerous-miss review MUST include at least:

- blasts or suspected leukemia despite mild anemia;
- multilineage cytopenia and marrow failure/infiltration;
- microangiopathic hemolysis with thrombocytopenia/renal/neurologic findings;
- severe hemolysis and rapidly changing anemia;
- active bleeding or hemodynamic instability;
- febrile neutropenia routed outside intended use;
- severe neutropenia or pancytopenia requiring urgent acute evaluation;
- recent transfusion obscuring morphology, reticulocytes, hemoglobin analysis, or enzyme assays;
- age under six months with no valid neonatal/young-infant profile;
- absent/incompatible units or reference intervals where required;
- benign high-scoring candidate distracting from a higher-severity alert.

Every dangerous-miss hazard maps to a risk record, one or more rules/abstentions, executable cases, retrospective cases where available, human-factors scenarios, and a rollback/incident trigger.

### 5.5 Prompt §10 gates as machine-checkable rules

| Hard gate | `rf` today | New `rf` extension | CDS checks | Pass rule |
|---|---|---|---|---|
| No unsupported medical claim | Enforces unsupported material-claim failure and source resolution. | Pediatric claim completeness and source-status check. | Reject unsupported/speculative rule basis. | Zero material unsupported claims and zero runtime statements without eligible basis. |
| No invented threshold | Partially: can mark unsupported; cannot understand threshold provenance fully. | `implementable_statement.kind`, value/formula, exact passage, portability validator. | AST scan all numeric literals; each maps to passage, local profile, calculated fact, or explicit implementation decision. | Every clinical numeric constant classified and approved. |
| Every clinical statement has source ID | Report material-claim tagging and ledger links. | Claim-role coverage for clinical statements. | Candidate/output/provenance linter. | 100% clinical statements link to evidence assertion or approved implementation decision. |
| Every rule exact passage or proposal | Source/evidence/locator available; exact passage not universally enforced. | Require persistent passage/quote for implementable claim. | Rule provenance join. | Every rule has `source_supported_fact` passage(s) or `implementation_proposal` decision with parent claims. |
| Conflicts visible | Claim statuses and contradiction log. | Require conflict disposition. | Conflict test and UI/API representation. | No mixed/contradicted input produces a hidden single-source conclusion. |
| Local lab interpretation when variable | Not domain-aware. | Laboratory portability fields. | Typed facts/local-profile linter and fail-closed engine tests. | Method-dependent rule requires compatible active local profile or abstains. |
| Missingness not normal | Not patient-data-aware. | None in core `rf`. | Tri-state schema, rule AST missingness analysis, missing-data tests. | Unknown/not-assessed never satisfies normal/negative without explicit clinically approved semantics. |
| Ranking points not probability | Not runtime-aware. | None. | Wording lint, API schema, UI tests, human factors. | No “probability,” “risk %,” calibrated confidence, or likelihood claim derives from points. |
| Generative AI not final decision | Deterministic spine available; optional agents outside patient path. | None. | Architecture test/build policy. | Deployed assessment graph has no model call; outputs derive from signed KB and deterministic engine only. |
| Independent approval + executable tests | Exit 7/council supports review but is not clinical dual review. | Reviewer metadata attachment helpful. | Approval service, test coverage, signature policy. | All required independent reviews approved and mandatory test sets pass. |

### 5.6 Additional release gates

| Gate | Machine criterion |
|---|---|
| Schema | Every source, assertion, decision, rule, candidate, question, test, validation result, and manifest validates. |
| Referential integrity | No dangling source, passage, claim, decision, rule, candidate, test, output, approval, or release edge. |
| Determinism | Repeated compilation yields identical bytes; repeated assessment yields identical clinical content. |
| Coverage | 100% rule activation positive/negative coverage; all numeric edges covered; all safety rules dangerous-miss covered. |
| Mutation | Prespecified mutation score and zero surviving critical-rule mutations; exact target approved before release. |
| Conflicts | All active conflicts have visible representation, local-profile decision, abstention, or no-rule disposition. |
| Security | Signature/hash verification tests, SBOM, dependency/secret/static scans, and threat controls pass. |
| Validation | Release-class-appropriate retrospective/silent/human-factors criteria pass with subgroup review. |
| Expiry | No active rule/evidence item is past `reviewBy`; emergency exception requires explicit authorization and UI disclosure. |
| Compatibility | Engine version satisfies manifest range; incompatible runtime fails closed. |
| Rollback | Prior signed release is available and rollback drill/criteria are documented. |

### 5.7 Release state machine

```text
research_planned
 -> evidence_in_progress
 -> evidence_verified
 -> evidence_council_approved
 -> rule_proposed
 -> clinical_review
 -> technically_verified
 -> retrospectively_validated
 -> silent_mode_validated
 -> human_factors_validated
 -> release_approved
 -> signed
 -> active
 -> superseded | withdrawn | expired
```

Transitions are append-only audit events. “Evidence verified” MUST NOT be displayed as “clinically validated.”

## 6. Build versus reuse and gap register

### 6.1 Capability ledger

| Capability | Reuse/build | Owner | Effort | Module-1 deliverable |
|---|---|---|---:|---|
| Run folders and lineage | Reuse as-is | `rf` | — | Pin run/bundle/artifact hashes. |
| Capture/triage/plan/IntentTree node | Reuse as-is | `rf` | — | CBC module run and research brief. |
| Source ingestion/cards | Reuse as-is | `rf` | — | Hand-seeded authoritative source cards. |
| Extraction cards | Reuse deterministic spine | `rf` | — | Structured extracted facts/cautions. |
| Claim ledger/status/inference basis | Reuse as-is | `rf` | — | Verified CBC claims. |
| Deterministic synthesis | Reuse as-is | `rf` | — | Reviewable baseline report. |
| Verify exit codes/YAML | Reuse as-is | `rf` | — | Automated gate routing. |
| Council | Reuse for evidence challenge | `rf` | — | Methodologist/skeptic consensus record. |
| Bundle/writeback/telemetry | Reuse as-is with offline caveats | `rf` | — | Durable research deliverable and telemetry. |
| Pediatric extraction extension | Extend | `rf` | M | Validated applicability/lab/threshold/lifecycle fields. |
| Search/screening/supersession ledger | Extend | `rf` | M | Reproducible selection and source-status evidence. |
| Exact-passage eligibility check | Extend | `rf` | M | Threshold claims fail without passage/selector. |
| Bundle adapter/read library | Build | CDS | S | Safe YAML loader, hashes, schema reconciliation. |
| `rf-bundle-to-kb-pack` | Build | CDS | M | Evidence, proposals, strict rules, sidecars, tests, unsigned manifest. |
| Module manifest/authoring decisions | Build | CDS | M | CBC scope and reviewed decisions. |
| Typed facts and units registry | Build | CDS | M | CBC facts with UCUM/local-profile constraints. |
| Rule compiler/DSL v1 bridge | Build | CDS | M | Strict current-schema `rules.json` output. |
| Rule schema v2 | Defer/design | CDS | M | Sidecar used in E0/E1; migration decision before multi-module scale. |
| Traceability graph/index | Build | CDS | M | Source→output bidirectional queries. |
| Evidence registry unification | Build | CDS | S | Remove `src/evidence.js`/`data/evidence.json` drift. |
| Test corpus and generator | Build | CDS | M | Positive/negative/boundary/missing/dangerous cases. |
| Property/mutation/semantic-diff CI | Build | CDS | M | Release-blocking checks. |
| Clinical review portal/workflow | Build | CDS | L | E0 may use signed files; portal before scale. |
| Retrospective validation harness | Build | CDS | L | Version-pinned replay and adjudication model. |
| Silent-mode pipeline | Build | CDS | L | Not required for E0 research pack; required before live use. |
| FHIR/terminology emitters | Build | CDS | L | Mapping skeleton in E0, verified profiles later. |
| Signed KB registry | Build | CDS/platform | M | Unsigned E0 manifest; production signing before release. |
| Surveillance impact engine | Build | CDS | M | E2 claim/source→release impact and re-run trigger. |

Effort scale: S is a focused component, M is a multi-artifact feature with tests/review, and L is a cross-system capability requiring clinical/operational validation.

### 6.2 Current `rf` gap register

| Gap | Evidence/current truth | Mitigation | Blocks module #1? |
|---|---|---|---|
| Offline MVP posture | Deterministic spine works without API keys. | E0 deliberately uses curated local source renditions. | No; this is the preferred E0 path. |
| 0/6 live adapters | `claude_agent_sdk`, `gpt_researcher`, `paperqa2`, `opencode`, `litellm_router`, `arc_council` unavailable. | Use hand-seeded E0; use Path-B Claude workflow in E1; install adapters only after value/security evaluation. | No for E0; blocks native live discovery automation. |
| Full web discovery outside core CLI | Path-B `rf-run-execute.js` performs scouts and shells `rf`. | Treat as orchestrator, parameterize paths/date, record search queries/screening, preserve deterministic tail. | No for seeded module; yes for unattended E1 surveillance. |
| Path-B hard-coded paths/stamp | RF, repo, TMP, and date are machine-specific/frozen in current workflow. | Refactor to args/config and add run-date tests before production use. | No for E0; yes for scheduled E1/E2. |
| Native swarm adapters unavailable | `rf swarm run` would degrade with current adapter installation. | Do not present it as successful discovery; gate on `rf doctor` and source count/quality. | No for E0. |
| URL/PDF extraction can degrade | Known URLs can become locator-only; no bundled PDF text extractor in core source-card service. | Archive approved text/Markdown renditions with precise page/section locators; add governed extraction adapter later. | Potentially; exact-passage claims block until good renditions exist. |
| Generic extraction schema | Missing pediatric population/assay/threshold/lifecycle fields. | Add extension schema/validator; E0 carries explicit `pediatric_cds` block. | Yes for converter eligibility unless extension is supplied. |
| Exact passage not universally hard-gated | `rf` validates claims/source cards and warns on locators, but generic cards may lack sufficient clinical passage precision. | Add clinical eligibility check in converter and upstream validator. | Yes for release-ready rules; not for research-only bundle. |
| IntentTree/ARC offline stubs | Writeback/status/council via ARC can degrade locally. | Accept success-with-caveat for E0; use local council; store pending external sync. | No. |
| No FHIR emitter | `rf` emits research artifacts, not FHIR. | Build FHIR projection downstream from approved semantic model. | No for E0 evidence/rule pack; yes for EHR integration milestone. |
| No rule-pack emitter | `rf` stops at evidence/claims. | Build deterministic converter in CDS repo. | Yes; this is the central E0 build. |
| No CDS clinical approval model | Council is not dual credentialed clinical review. | Build append-only approval records and release policy downstream. | Yes for any release; E0 can remain proposal-only. |
| No runtime validation | `rf verify` is claim verification, not patient engine validation. | Build test/retrospective/silent/human-factors systems downstream. | No for E0 proposal; yes for clinical deployment. |
| No KB signatures/registry | Bundle status is research verification, not executable-release signing. | Build canonical pack hashing, signer, registry, runtime verification. | No for E0; yes for signed release. |

### 6.3 Current CDS gaps exposed by the seam

| Gap | Current evidence | Required correction |
|---|---|---|
| Thin evidence records | Six source-level records, no exact passage objects. | Add assertion/passage registry projection and lifecycle/status fields. |
| Rules lack production metadata | Strict five-field schema. | Canonical authoring/provenance sidecar now; deliberate schema v2 later. |
| Evidence duplication | `src/evidence.js` and `data/evidence.json` can drift. | Generate/load from one immutable source. |
| Validator is structural but incomplete | Checks IDs, evidence, candidates, and condition evaluation, not full JSON Schema. | Add actual schema validation and semantic/trace checks. |
| Ten tests for 91 rules | Scenario coverage is far below per-rule gates. | Build generated/curated rule-level corpus and mutation tests. |
| Binary-ish data semantics | Production blocker includes tri-state data. | Define present/absent/unknown/not-assessed in input/fact schemas and engine. |
| No signed manifest | Architecture proposes one but repository does not ship it. | Add canonical hashes, approvals, validation refs, signature, registry, runtime verification. |
| No clinical review workflow | Production blocker. | Add independent review, adjudication, role requirements, and audit. |

### 6.4 What explicitly will not be built

- A second evidence crawler or source-card database in the CDS repository.
- A generative rule-writing service that publishes to `data/rules.json`.
- A patient-specific LLM inference path.
- A universal pediatric threshold service that ignores local methods and intervals.
- A converter that guesses LOINC/UCUM codes from labels.
- A release shortcut that treats `rf verify` or council approval as clinical validation.
- A single “confidence score” combining evidence confidence, rule points, and patient likelihood.

## 7. Phased rollout: Evidence-Foundry-on-`rf`

### 7.1 Increment summary

| Increment | Objective | Discovery | Handoff | Clinical state | Go/no-go |
|---|---|---|---|---|---|
| E0: wire | Prove deterministic evidence→claim→rule-proposal loop for hand-seeded CBC evidence. | Curated local sources via `rf ingest`. | Converter, strict rule projection, provenance, tests, unsigned manifest. | Research proposal only. | Go if traceability and deterministic technical gates pass; no clinical deployment. |
| E1: operate | Add live discovery workflow, evidence council, dual clinical review, stronger tests, and review UX. | Parameterized Path-B Claude workflow; native adapters optional. | Reviewed CBC pack and signed preclinical release candidate. | Retrospective validation candidate. | Go if evidence completeness, review, dangerous-miss, mutation, and retrospective gates pass. |
| E2: maintain | Add guideline-change surveillance, impact analysis, re-run, registry writeback, and controlled release updates. | Scheduled surveillance queries and triggered `rf` runs. | Semantic diff, revalidation class, signed KB registry, rollback. | Governed active module after silent/human-factors gates. | Go if update SLA, impact completeness, signature, rollback, and monitoring gates pass. |

### 7.2 E0 — deterministic wire-up

**Scope**

1. Create `modules/cbc_suite_v1/module.yaml` from the worked example envelope.
2. Select a bounded set of already-approved CBC/anemia sources and create normalized local renditions.
3. Run capture→triage→plan→ingest→extract→claim-map→deterministic synthesize→verify→local council→bundle.
4. Add the pediatric evidence extension as source/extraction metadata or a validated sidecar.
5. Implement read-only run loader, hash pinning, eligibility checks, and `rf-bundle-to-kb-pack`.
6. Migrate a small vertical slice: scope/young-infant abstention, local-range precedence, iron-deficiency pattern, and marrow-red-flag safety rule.
7. Generate strict current-schema rules plus rich provenance/evidence assertions.
8. Generate positive, negative, boundary, missingness, and dangerous-miss tests for the slice.
9. Unify runtime evidence source of truth and add JSON Schema validation.
10. Emit unsigned manifest and conversion report.

**E0 go gate**

- `rf verify` exit 0 and verified bundle.
- Zero dangling source/passage/claim/decision/rule/test/output edges.
- Zero unsupported or speculative rule bases.
- All numeric constants classified; no invented threshold.
- Deterministic conversion reproducible on two clean runs.
- Strict `data/rules.json` projection validates against current schema.
- Every slice rule has all required tests; dangerous-miss tests pass.
- Council concerns resolved or explicitly block the pack.
- Clinical reviewers agree the output is a proposal, not release-ready.

**E0 no-go**

- Any threshold lacks exact passage/portability.
- Converter needs to infer logic from prose.
- Source rights prevent independent review.
- Existing runtime cannot represent safe missingness/conflict without schema/engine change.
- Hash or reproducibility mismatch.

### 7.3 E1 — operational module production

**Scope**

1. Parameterize `rf-run-execute.js` paths, date, freshness, run ID, and source limits.
2. Record exact queries, search surfaces, screening, exclusions, and source-status checks.
3. Run the 12 CBC research angles with concurrency/rate-limit controls.
4. Add exact-passage and pediatric-card validators upstream.
5. Run methodologist/skeptic council with consensus policy.
6. Build clinical review records and a minimal review UI for passage→decision→rule→test.
7. Complete CBC Suite ontology, typed facts, local profile contract, candidate rules, and tri-state questionnaire.
8. Add property, mutation, conflict, unreachable-branch, and semantic-diff tests.
9. Prepare FHIR/terminology mappings with explicit mapping status and site validation.
10. Run retrospective validation with independent adjudication and subgroup/analyzer/site analysis.
11. Produce signed preclinical release candidate; do not activate clinically until applicable later gates pass.

**E1 go gate**

- Search protocol reproducible and authoritative-source coverage approved.
- No open high-severity evidence conflict without visible safe representation.
- Two independent clinical reviews and required laboratory review complete.
- 100% rule positive/negative activation coverage; numeric/missingness/dangerous-miss coverage complete.
- Zero surviving critical mutations and agreed overall mutation target met.
- Retrospective dangerous-miss and utility thresholds meet prespecified protocol.
- No clinically material subgroup/site/analyzer gap without mitigation.
- Signed release candidate verifies but remains inactive pending silent/human-factors authorization.

### 7.4 E2 — surveillance, update, and registry

**Scope**

1. Store surveillance query, cadence, owner, review-by, and trigger class per evidence assertion/rule.
2. Run monthly automated searches for named authorities and high-risk topics; perform quarterly human review.
3. Trigger immediate runs for retraction, correction, withdrawal, safety notice, cutoff/formula change, or superseding guideline.
4. Compare new source editions/passages/claims with the active bundle.
5. Traverse impact graph to affected decisions, rules, tests, outputs, modules, and releases.
6. Classify changes as editorial, evidence-only, non-material logic, material clinical logic, or emergency withdrawal.
7. Require validation depth proportional to change class; material logic repeats clinical review and applicable validation.
8. Write accepted evidence/run status to shared catalog/wiki/CCDash and KB release registry.
9. Sign new immutable KB; never rewrite the active version in place.
10. Monitor activation, abstention, missingness, overrides, alert burden, incidents, and version adoption without unnecessary PHI.
11. Withdraw/rollback when trigger criteria fire.

**E2 go gate**

- Surveillance detects seeded simulated guideline/retraction events within the approved SLA.
- Impact graph finds every seeded affected rule/test/output/release with no false negative.
- Unchanged inputs on unaffected rules are semantically stable.
- New release signature and manifest verify; prior release remains reproducible.
- Rollback drill passes and active clients reject expired/withdrawn KBs as policy requires.
- Silent-mode and human-factors gates required for live clinical use are complete.

### 7.5 Relationship to commercial Wave 0–4

| Commercial wave | Evidence-Foundry capability |
|---|---|
| Wave 0 | E0/E1 foundations: tri-state data, local ranges, exact passages, signed KB, review workflow, validation corpus. |
| Wave 1 | E1 produces governed anemia/neutropenia/leukocyte/eosinophil/platelet/pancytopenia/smear content on shared CBC facts. |
| Wave 2 | E2 surveillance plus longitudinal evidence/validation supports lead, hemoglobinopathy, menstrual bleeding, and response pathways. |
| Wave 3 | Reuse same `rf` seam and compiler for renal, liver, thyroid, inflammatory, and coagulation modules with new domain profiles. |
| Wave 4 | Image/genomic research may use `rf`, but model-based patient inference needs a separate regulatory/validation architecture and is not implied here. |

## 8. Open questions and risks

### 8.1 Design decisions requiring confirmation

| Question | Options | Recommended default | Why / trigger to revisit |
|---|---|---|---|
| Where does the rule DSL compiler live? | Core `rf`; CDS monorepo; separate service. | CDS repository under `tools/` initially, then shared clinical-content package if multiple runtimes need it. | DSL is product/clinical-runtime-specific; revisit when a second CDS product consumes it. |
| Is current strict rule schema extended now? | Add metadata to v1; use sidecar; create v2. | Use canonical authoring record + provenance sidecar for E0, design v2 before multi-module E1 scale. | Avoids breaking runtime while preventing metadata loss. |
| Who owns LOINC/UCUM/SNOMED mapping? | `rf`; converter; integration service. | Clinical terminology service/team downstream; converter only accepts reviewed mappings/status. | Research claims do not establish local code mappings. |
| Are local-range profiles `rf` claims or config? | Evidence claims; runtime config; both. | General need/constraints are claims; actual site ranges/methods are signed tenant configuration with lab approval. | Prevents site data from masquerading as universal evidence. |
| How are confidential local policies handled? | Mix into public run; separate run; downstream only. | Separate `work_sensitive`/`client_sensitive` `rf` run and controlled merge at authoring decision. | Keeps sensitivity/writeback governance correct. |
| What is the canonical evidence registry? | `src/evidence.js`; `data/evidence.json`; database. | `data/evidence.json` plus assertions as canonical versioned content; generate runtime module. | Removes current duplication with minimal E0 change. |
| How are exact passages stored under copyright constraints? | Full text; short quote; hash/selectors only. | Store permitted short excerpt plus immutable hash/selectors; require reviewer-accessible source. | Balances independent review and rights. |
| Which adapter should be installed first? | Native adapter; Path-B only; multiple. | Stabilize/parameterize Path-B first because it is the proven live lane; install one native discovery adapter only after measured gap. | Avoids adapter proliferation before the seam works. |
| Should `rf council` use `consensus` or approve/concern/block? | Free-form consensus; existing default vocabulary. | Honor module recipe `--vote consensus`, but normalize result to approve/concern/block in adapter and verify actual council YAML. | CLI accepts text; downstream needs controlled state. |
| Where does dual clinical review live in E0? | Git-signed files; portal; issue tracker. | Append-only signed review files for E0; portal by E1. | Avoids blocking proof while preserving independent evidence. |
| Are rule proposals auto-generated? | Full prose-to-rule; skeleton only; manual only. | Deterministic skeleton from explicit authoring decisions only. | Prevents generative/inferred clinical logic. |
| How is rule scoring governed? | Keep points; replace; probability model. | Keep visible ordinal points temporarily, with non-probability lint and tests; consider explicit precedence tiers in schema v2. | Current engine depends on points but clinical meaning is limited. |
| Can `mixed` claims ever support a rule? | Never; adjudicated config; one-sided choice. | Only conflict-visible/local-profile/abstention rules; not a universal one-sided rule. | Preserves disagreement. |
| What blocks source-level evidence without exact text? | Warning; hard block; reviewer override. | Hard block for threshold/formula/safety rules; documented exception path only for non-executable background. | Exact passage is a Wave-0 guardrail. |
| What is module #1 scope? | All CBC at once; anemia only; vertical slice then suite. | E0 vertical slice, E1 full CBC Suite. | Reduces integration uncertainty without relabeling prototype as validated. |

### 8.2 Clinical risks

| Risk | Failure mode | Control |
|---|---|---|
| Invented or decontextualized threshold | Converter turns a number in prose/table into universal logic. | No automatic number extraction into rules; exact passage, portability, authoring decision, boundary tests, lab review. |
| Missingness collapse | Unknown value evaluates as false and appears normal. | Tri-state fact types, missingness lint, explicit abstention/question, test corpus. |
| Local method mismatch | Correct evidence is applied to wrong analyzer/specimen/unit. | Signed local profiles, UCUM validation, method compatibility, fail closed. |
| Conflict erasure | One guideline silently wins. | Preserve `mixed`/`contradicted`, conflict object, reviewer decision, UI/API trace, conflict tests. |
| Automation bias | Clinician over-trusts ranked pattern. | Non-probabilistic language, independent review view, counterfactual/missing-data display, human-factors validation. |
| Dangerous distraction | Benign high-scoring candidate obscures urgent alert. | Severity-first output, dangerous-miss tests, retrospective oversampling, alert dominance tests. |
| Stale evidence | Expired rule remains active after guideline change. | Review-by enforcement, surveillance queries, signed immutable releases, runtime expiry policy. |
| Scope creep into treatment | Next-step option becomes directive/dose/transfusion rule. | Intended-use/output vocabulary lint, clinical/regulatory review, prohibited-output tests. |

### 8.3 Platform risks

| Risk | Failure mode | Control |
|---|---|---|
| Two sources of KB truth | `src/evidence.js` disagrees with `data/evidence.json`. | Generate one from the other; hash and compare in CI. |
| Upstream schema drift | `rf` adds/changes fields and converter misreads them. | Validate schema version, contract tests with fixtures, fail closed on unknown required semantics. |
| Mutable upstream run | Bundle bytes change after authoring begins. | Hash all inputs; compare before every compilation/release; new bundle for corrections. |
| CLI stdout parsing | Rich output changes and automation breaks. | Use exit code and YAML only; parse plain `run=` solely for discovery then verify disk. |
| Exit 7 mishandled | Human-review state treated as tool failure or ignored. | Explicit state machine and no blind retry/continue. |
| Adapter false completeness | Degraded swarm returns too few/locator-only sources. | Protocol-level source/angle/quality gates independent of command success. |
| Converter overreach | Tool guesses clinical logic/mappings. | Explicit decisions required; no LLM/network; unresolved queue. |
| Non-deterministic serialization | Same content gets new hash/signature. | Canonical JSON, stable sorting, normalized dates/newlines, reproducibility tests. |
| Dependency compromise | YAML/schema package affects release build. | Pin lockfile, SBOM, SCA, provenance, minimal dependencies, reproducible build. |
| Trace graph scale | Sidecar joins become slow/inconsistent across modules. | Canonical graph schema and registry indexes; promote to service only after file-backed E1 proves need. |

### 8.4 Operational and governance risks

| Risk | Failure mode | Control |
|---|---|---|
| Review theater | Reviewer approves citation without executing boundary/missing cases. | Reviewer checklist requires passage, logic, output, and tests; independent votes recorded. |
| Unclear role authority | Council approval confused with clinical release. | Separate state/labels and release policy; UI never calls council result clinical signoff. |
| Surveillance overload | Monthly searches generate low-value review burden. | Risk-tier cadence, source allowlists, dedupe, materiality classification, measured alert precision. |
| Retraction response delay | Active unsafe rule remains deployed. | Immediate trigger lane, withdrawal state, runtime denylist/registry check, rollback SLA. |
| Site configuration drift | Local lab changes method/ranges without KB awareness. | Signed profile versions, effective dates, compatibility checks, site attestation and audit. |
| PHI leakage into research | Patient data enters public evidence run/writeback. | Module runs contain no PHI; separate validation data boundary; sensitivity guard and secret/PHI scans. |
| Content-rights breach | Exact passages are redistributed improperly. | Usage policy, excerpt limits, access controls, rights review, hash/selectors alternative. |

### 8.5 Recommended ADRs before E1

1. ADR: canonical CDS authoring model and rule schema v2 migration.
2. ADR: exact-passage storage, licensing, and reviewer access.
3. ADR: terminology and local laboratory profile ownership.
4. ADR: clinical approval identity, signature, and adjudication workflow.
5. ADR: KB canonical serialization, signing algorithm, key custody, and registry.
6. ADR: validation data boundary, de-identification, retention, and audit.
7. ADR: surveillance cadence, materiality classes, and emergency withdrawal.
8. ADR: Path-B workflow hardening versus native adapter installation.

## 9. Implementation acceptance checklist

### 9.1 E0 architecture acceptance

- [ ] One approved module manifest deterministically creates/correlates one `rf` run.
- [ ] All `rf` commands execute with the required CWD and no `--json` assumption.
- [ ] Verify codes 0, 3, 4, and 7 have automated routing tests using fixtures.
- [ ] Upstream YAML is read-only and all artifacts are hashed.
- [ ] Pediatric applicability, laboratory, threshold, conflict, and lifecycle fields validate.
- [ ] Exact passage/selector resolves for every executable claim.
- [ ] Converter outputs are byte-reproducible.
- [ ] Converter never invents a rule without an explicit authoring decision.
- [ ] Strict generated rules validate against `schemas/rule.schema.json`.
- [ ] Evidence/candidate/rule IDs have no collisions or dangling refs.
- [ ] Source-supported fact and implementation proposal remain separately queryable.
- [ ] Every rule has source→passage→claim→decision→rule→test→output trace.
- [ ] Positive, negative, boundary, missingness, and dangerous-miss cases execute.
- [ ] Current evidence duplication is eliminated or CI-enforced identical.
- [ ] Unsigned manifest binds all upstream/downstream hashes.
- [ ] No artifact is described as clinically validated or release-ready.

### 9.2 Preclinical release-candidate acceptance

- [ ] Search protocol and screening accounting are reproducible.
- [ ] Retraction/correction/withdrawal/supersession checks are current.
- [ ] Methodologist/skeptic council is approved with concerns resolved.
- [ ] Two independent clinician reviews are complete per governance policy.
- [ ] Laboratory medicine has approved all lab-dependent rules/profiles.
- [ ] Dangerous-miss review is complete and linked to tests/hazards.
- [ ] 100% positive/negative activation coverage is demonstrated.
- [ ] All numeric/age/unit/missingness boundaries are tested.
- [ ] Property, mutation, conflict, unreachable-branch, and semantic-diff checks pass.
- [ ] Retrospective protocol, reference standard, sample size, and subgroup plan are approved.
- [ ] Retrospective results meet prespecified go/no-go criteria.
- [ ] Intended-use/regulatory and content-rights determinations are recorded.
- [ ] Signed manifest verifies against canonical pack and approved release key.
- [ ] Rollback artifact and instructions exist.

### 9.3 Live-release acceptance

- [ ] Prospective silent mode meets safety, mapping, missingness, and alert-burden gates.
- [ ] Human-factors validation shows comprehension and appropriate reliance.
- [ ] Site terminology, unit, analyzer, and local-range profiles are validated.
- [ ] Security/privacy controls, threat mitigations, SBOM, and deployment scans pass.
- [ ] Incident response, withdrawal, and rollback drills pass.
- [ ] Surveillance owners, queries, dates, and SLAs are active.
- [ ] Runtime fails closed for bad signature/hash, incompatibility, expiry, ambiguous units, and unsupported age/range.
- [ ] Generative services are absent from the patient-specific decision path.
- [ ] Production monitoring excludes unnecessary PHI and distinguishes software from clinical incidents.
- [ ] Authorized release roles activate the signed version in the registry.

## 10. Connective summary for the master expansion plan

1. Build Evidence Foundry as a clinical compilation/release layer over `rf`, not as a parallel research pipeline.
2. Let `rf` own source ingestion, extraction, claim mapping, contradiction status, verification, council review, bundle lineage, and research writeback.
3. Let the CDS platform own verified-claim conversion, clinical decisions, typed facts, rule DSL, FHIR mappings, tests, validation, signatures, and deployment.
4. Start E0 with a hand-seeded Pediatric CBC Suite run through the offline deterministic `extract → claim-map → synthesize → verify → bundle` spine.
5. Add `rf-bundle-to-kb-pack` in the CDS repository to emit evidence assertions, candidate/rule proposals, strict runtime JSON, tests, traceability, and an unsigned manifest.
6. Preserve the complete `source → passage → claim → decision → rule → test → output → release` chain and distinguish source fact from implementation proposal everywhere.
7. Route `rf` exit 3 to governance, exit 4 to evidence repair, and exit 7 to human/council review; none is bypassed by the converter.
8. Require dual independent clinical review, laboratory review where applicable, dangerous-miss testing, deterministic CI, retrospective/silent validation, and a signed KB before use.
9. Add live discovery in E1 through the hardened Claude Path-B workflow; 0/6 native adapters and offline IntentTree/ARC stubs do not block the E0 CBC module.
10. Add E2 surveillance, claim-to-release impact analysis, semantic diff, revalidation, registry writeback, immutable signed updates, and rollback.
