# Research Foundry Prompt - New Pediatric CDS Module

**Purpose:** Produce a clinically reviewable, deterministic, machine-executable evidence package for a new pediatric decision-support module.  
**Date policy:** Prioritize evidence published in the last five years from the run date. Retain older sources only when foundational and not superseded, and explain why.

## Variables to fill before running

- **Module/topic:** [e.g., pediatric neutropenia]
- **Intended HCP users:** [e.g., general pediatricians, pediatric emergency clinicians]
- **Patient population:** [age, sex/physiology, setting]
- **Intended output:** [reviewable patterns, questions, and next-step options]
- **Explicit exclusions:** [neonates, ICU, oncology, time-critical use, treatment directives, etc.]
- **Jurisdictions:** [United States plus others]
- **Integration target:** [web, SMART-on-FHIR, CDS Hooks, API]

## Master prompt

Act as a multidisciplinary evidence-synthesis and clinical-software team comprising pediatric subspecialists for the module, general pediatricians, laboratory medicine, clinical informatics, evidence-methodology, biostatistics, human-factors, medical-device regulatory, privacy/security, and software-quality experts.

Create a complete evidence-to-executable-CDS package for **[MODULE]**. The product is intended for **[INTENDED HCP USERS]** and **[POPULATION/SETTING]**. It must support, not replace, clinician judgment. It must not invent thresholds, claim probability without a validated model, or provide treatment directives outside the explicitly approved intended use. Patient-specific inference must be deterministic and reviewable.

### 1. Search and evidence policy

1. Search current professional-society guidelines, government guidance, systematic reviews, diagnostic-accuracy studies, consensus statements, and major peer-reviewed reviews.
2. Search the most recent five years first. Include older sources only when foundational, still authoritative, and not replaced.
3. Check every candidate source for update, correction, retraction, withdrawal, and supersession.
4. Record search date, databases/sites, exact queries, screening criteria, and reasons for exclusion.
5. Prefer primary and authoritative sources. Do not use consumer summaries as rule evidence.
6. Identify copyright/licensing restrictions on tables, figures, text, and executable reuse.

### 2. Evidence extraction

For every potentially implementable claim, provide an evidence card with:

- unique evidence ID;
- full citation, DOI/PMID/URL, publication date, and version;
- exact supporting passage with page, section, table, or figure location;
- source type and evidence grade/strength when supplied;
- study population, setting, sample size, inclusion/exclusion, comparator, and outcome;
- age, sex, gestational, physiologic, ancestry/population, and comorbidity applicability;
- test method, specimen, analyzer/assay, units, reference interval, timing, and preanalytic requirements;
- threshold or formula and whether it is universal, local-lab dependent, or implementation-proposed;
- sensitivity, specificity, likelihood ratios, predictive values, confidence intervals, and prevalence when available;
- contraindications, confounders, false positives/negatives, and dangerous exceptions;
- conflicts with other sources and a proposed representation that does not hide disagreement;
- expiration/review date and surveillance query.

Do not paraphrase away qualifiers. Never infer a cutoff from a chart unless the source explicitly supports it.

### 3. Clinical pathway

Define:

- intended use, users, population, care setting, exclusions, and non-goals;
- urgent or out-of-scope conditions that must be assessed first;
- starting trigger and minimum required data;
- differential diagnosis or classification ontology;
- branch sequence and rationale;
- confirmatory tests/questions and specialist referral triggers;
- knowns, unknowns, and data-quality requirements;
- conflicts between organizations, with local configuration where appropriate;
- treatment boundary: separate diagnostic support from treatment, dosing, transfusion, or mandatory action.

### 4. Adaptive questionnaire

Produce a FHIR-compatible adaptive questionnaire ordered by estimated diagnostic information value. For every question specify:

- stable ID and clinician wording;
- present / absent / unknown / not assessed semantics;
- answer type, allowed values, unit, terminology/LOINC/SNOMED/UCUM mapping;
- data source and timestamp requirements;
- enableWhen / branching condition;
- why the question is useful and which candidate branches it changes;
- stop conditions and minimum safe dataset;
- patient/parent wording only when intended and clinician-reviewed.

Propose a research method to measure information gain and completion-time reduction; do not claim it is optimal until validated.

### 5. Machine-executable rules

For every rule return:

- rule ID, version, effective date, review date, status, and owner;
- clinical purpose and output type;
- typed inputs, units, valid ranges, source, timing, and data-quality constraints;
- explicit Boolean logic with all/allOf/anyOf/not and missing-data behavior;
- population and setting applicability;
- exclusions and conflict behavior;
- output phrased as a reviewable pattern, caution, question, or next-step option;
- severity and rationale;
- exact evidence IDs and passages;
- implementation decision versus source-supported fact;
- positive, negative, boundary, missingness, and dangerous-miss test cases.

Return canonical JSON conforming to a proposed schema. Also map the module to FHIR Questionnaire/QuestionnaireResponse, Observation/DiagnosticReport, PlanDefinition/ActivityDefinition, GuidanceResponse, and CDS Hooks/SMART launch where appropriate.

### 6. Validation and human factors

Design:

- clinical-content verification with independent reviewers and adjudication;
- software verification including schema, boundary, property, mutation, conflict, unreachable-branch, semantic-diff, and deterministic reproducibility tests;
- retrospective multi-site validation with an independent reference standard;
- prospective silent mode;
- human-factors testing for comprehension, time, alert burden, automation bias, anchoring, missingness, and independent review;
- controlled rollout, monitoring, incident review, drift/evidence surveillance, and rollback;
- primary and balancing metrics appropriate to non-probabilistic outputs;
- subgroup/site/analyzer/language/missingness analyses and sample-size approach.

### 7. Regulatory, privacy, security, and quality

Assess the final function against current FDA CDS guidance and alternative SaMD/device pathways. Address intended user, patient population, time criticality, automation, directive versus options, source transparency, input disclosure, and validation disclosure. Include HIPAA/FTC/state-law questions, data minimization, threat model, audit, retention, consent, cybersecurity, IEC 62304, ISO 14971, IEC 62366-1, and ISO 13485 applicability. Clearly distinguish legal/regulatory analysis from conclusions requiring counsel or agency interaction.

### 8. Product and business value

For the module, estimate and label as hypotheses:

- encounter frequency and user segments;
- current workflow and failure modes;
- measurable provider, patient, specialist, laboratory, and buyer value;
- time, test-utilization, referral, safety, and quality metrics;
- local configuration and integration requirements;
- competition and whether the module is commodity, differentiated, or strategically enabling;
- willingness-to-pay interview hypotheses;
- fit with a pediatric CBC/lab suite and evidence-to-CDS platform.

### 9. Required deliverables

1. Executive clinical and product summary.
2. Reproducible search protocol and PRISMA-style source accounting.
3. Evidence table and exact-passage evidence cards.
4. Conflict, gap, and outdated-source matrix.
5. Clinical ontology / knowledge graph.
6. Full adaptive questionnaire.
7. Decision trees and branch narrative.
8. Machine-readable rule package and schemas.
9. FHIR mappings and API examples.
10. Positive, negative, boundary, missingness, and dangerous-miss test corpus.
11. Clinical, software, retrospective, silent-mode, human-factors, and rollout validation plans.
12. Regulatory, privacy, security, quality, and content-rights roadmap.
13. Product value hypothesis, competitive assessment, module priority score, and research agenda.
14. Source-to-rule-to-test-to-output traceability matrix.
15. Signed-release and evidence-surveillance operating model.

### 10. Quality gates

- No unsupported medical claim or invented threshold.
- Every clinical statement has a source ID; every rule has an exact supporting passage or is marked as an implementation proposal.
- Conflicting recommendations remain visible.
- Local laboratory interpretation is required when methods or intervals vary.
- Missingness is not treated as normal.
- Ranking points are not presented as probability.
- Generative AI does not make the final patient-specific decision.
- No rule is release-ready without independent clinical approval and executable tests.
