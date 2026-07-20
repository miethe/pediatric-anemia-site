# Validation, Regulatory, and Risk Roadmap

## 1. Current status

This package is a software and clinical-content prototype. Automated tests show that the engine behaves deterministically and that selected examples reach intended branches. They do **not** establish clinical validity, clinical utility, safety, or regulatory status.

## 2. FDA CDS posture

The January 2026 FDA Clinical Decision Support Software guidance explains the non-device CDS criteria under section 520(o)(1)(E) and emphasizes whether a health care professional can independently review the basis of recommendations. It also discusses intended use, specificity, time criticality, and whether software provides a directive rather than reviewable support. [FDA2026_CDS]

This prototype is designed toward independent review by:

- exposing all input values and reference limits;
- showing matched rule IDs and evidence sources;
- using diagnostic patterns rather than a guaranteed diagnosis;
- separating urgent warnings from autonomous emergency management;
- avoiding treatment orders, medication dosing, and transfusion commands;
- using deterministic, inspectable logic.

**This does not establish that the product is non-device CDS.** A diagnostic aide that produces patient-specific ranked outputs may still be regulated depending on intended use, claims, workflow, time criticality, and the final implementation. Obtain specialized FDA counsel and, when appropriate, use a formal FDA interaction before clinical launch.

## 3. Standards and quality-system roadmap

Depending on classification and market strategy, plan for:

- **ISO 14971:** medical-device risk management;
- **IEC 62304:** medical-device software lifecycle processes;
- **IEC 62366-1:** usability engineering and use-error risk;
- **ISO 13485:** quality management if a regulated-device pathway applies;
- FDA cybersecurity and premarket/postmarket expectations;
- secure software development framework, SBOM, vulnerability disclosure, and patch governance;
- HIPAA Privacy/Security Rules when the deployment handles PHI for covered entities/business associates;
- applicable state health-data and consumer-health privacy laws.

These are regulatory implementation recommendations, not clinical evidence.

## 4. Hazard analysis starter set

| Hazard | Potential harm | Primary controls | Verification |
|---|---|---|---|
| Wrong age/sex/local range | Missed or false anemia classification | local-range precedence, age guardrails, visible source | boundary tests; analyzer-site validation |
| Unit mismatch | Grossly incorrect rule result | unit-string equality, fail-closed (mismatched or missing units block rather than silently convert); UCUM-syntax validation is NOT implemented — unit codes are opaque strings (owner-held gap, `docs/clinical/local-profile-charter-contract.md` §2.7 C13) | integration tests on the mismatch/missing-unit blocker paths |
| Ferritin falsely reassuring in inflammation | Missed iron deficiency | CRP confounding note, sTfR/iron pattern | inflammatory IDA cases |
| HbA2 falsely reassuring during ID | Missed beta-thalassemia trait | explicit caution | combined ID/thal cases |
| Normal G6PD during acute event | Missed enzymopathy | timing/transfusion caution | acute hemolysis cases |
| Mild anemia distracts from leukemia/marrow failure | Delayed escalation | cytopenia/blast/exam alerts dominate | dangerous-miss test set |
| Automated output treated as final diagnosis | Incorrect management | pattern language, source display, no auto-write diagnosis | human-factors study |
| Stale evidence/KB | Outdated recommendation | review date, expiry policy, signed version | release-gate test |
| Rule regression | Changed output without awareness | golden cases, semantic diff, approval workflow | CI regression suite |
| PHI leakage | Privacy harm | no third-party scripts, data minimization, no body logs | privacy/security testing |
| Alert fatigue | Important warning ignored | tiered alerts, specificity review | usability and alert burden study |
| Missing data interpreted as normal | False reassurance | explicit unknown and next-question rules | missingness matrix |

## 5. Clinical validation program

### Phase A — clinical-content verification

1. Two independent pediatric hematologists review every rule and exact source passage.
2. A general pediatrician reviews usability and primary-care appropriateness.
3. A laboratory medicine specialist reviews units, assay dependence, reference intervals, and smear/specialized-test interpretation.
4. Resolve disagreements in a signed decision log.
5. Build bidirectional traceability: source passage ↔ rule ↔ test cases ↔ UI output.

### Phase B — software verification

- JSON schema and rule-schema validation.
- 100% rule activation coverage with at least one positive and one negative test.
- Boundary tests for every age band and threshold.
- Property tests for determinism and irrelevant-input stability.
- Mutation testing to ensure tests fail when conditions are altered.
- Security, accessibility, browser, and API contract tests.
- Reproducible build and KB signature tests.

### Phase C — retrospective clinical validation

Use de-identified, multi-site pediatric data with independent chart adjudication. Include:

- tertiary hematology and general pediatrics/primary care;
- multiple analyzers and laboratory ranges;
- broad age distribution including transition boundaries;
- iron deficiency with and without anemia;
- thalassemia, inflammation, hemolysis, blood loss, lead, renal, nutrient, TEC, marrow failure/malignancy, and mixed cases;
- deliberate oversampling of dangerous low-prevalence conditions;
- cases with incomplete data and recent transfusion.

Reference standard:

- final diagnosis after follow-up and confirmatory testing, adjudicated by at least two specialists;
- disagreements resolved by a third reviewer;
- reviewers blinded to tool output.

Metrics:

- sensitivity of emergency/urgent alerts;
- top-1 and top-3 differential recall;
- proportion of final diagnoses represented anywhere in the output;
- confirmatory-test recommendation agreement;
- false-negative rate for marrow failure, microangiopathy, severe hemolysis, lead urgency, and other high-harm conditions;
- subgroup performance by age, sex, race/ethnicity where appropriate, ancestry, site, analyzer, language, and missingness;
- time to correct workup and clinician override rate.

Because the engine does not output probabilities, probability calibration and AUROC are not the primary measures. Diagnostic coverage and safety-event sensitivity are more relevant.

### Phase D — prospective silent mode

Run in parallel without showing output to clinicians. Compare recommendations with real workflow and final diagnosis. Measure data-mapping errors, missingness, alert burden, and site-specific threshold failures.

### Phase E — human-factors/usability validation

Test with pediatricians, emergency clinicians, nurse practitioners/physician assistants where intended, and pediatric hematologists. Include:

- unstable symptomatic patient;
- severe IDA without instability;
- mild anemia with blasts/cytopenias;
- coexisting ID and thalassemia;
- ferritin obscured by inflammation;
- elevated capillary lead;
- recent transfusion;
- neonatal patient outside scope;
- incorrect units and missing local ranges.

Primary human-factors questions:

- Can clinicians correctly explain why each output appeared?
- Do they understand that ranking is not probability?
- Can they independently review the source and rule basis?
- Do urgent alerts cause appropriate action without excessive false alarms?
- Does the tool reduce or introduce anchoring?

### Phase F — controlled clinical rollout

- limited sites and trained users;
- real-time support and incident response;
- weekly safety review initially;
- predefined rollback triggers;
- post-deployment drift and override monitoring;
- formal evidence surveillance and change-control cadence.

## 6. Proposed release acceptance criteria

These are **project targets**, not evidence-derived clinical standards:

- 100% of rules have dual clinical approval and exact source traceability;
- 100% positive/negative rule activation coverage;
- zero known critical-severity software defects;
- no unresolved high-risk hazards under the risk-management process;
- very high sensitivity for prespecified dangerous red-flag scenarios in retrospective and silent-mode cohorts;
- no clinically material subgroup performance gap without mitigation;
- successful summative usability validation for intended users;
- documented regulatory determination and approved labeling/intended use.

Numerical thresholds should be finalized with the clinical/statistical/regulatory team after prevalence and sample-size analysis.

## 7. Evidence maintenance

- Automated monthly searches for new AAP/ASH/WHO/CDC/FDA guidance and key review updates.
- Human review at least quarterly and before every release.
- Immediate review for retraction, safety alert, cutoff change, or superseding guideline.
- Every rule has `effectiveFrom`, `reviewBy`, and `supersedes` metadata in production.
- Old KB versions remain reproducible for audit but cannot be selected for new assessments after expiry unless explicitly authorized.

## 8. Privacy and operational controls

A production deployment with PHI should include:

- minimum-necessary data and no free text by default;
- BAA and vendor-risk review where applicable;
- encryption in transit/at rest and managed keys;
- role-based access, MFA, session timeout, and tenant isolation;
- immutable access/audit logs without unnecessary clinical payloads;
- documented retention, deletion, backup, and disaster recovery;
- penetration test and incident response;
- prohibition on model training or analytics reuse without explicit governance.

## Reference

[FDA2026_CDS] US Food and Drug Administration. *Clinical Decision Support Software: Guidance for Industry and Food and Drug Administration Staff.* Final guidance, January 2026. https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software
