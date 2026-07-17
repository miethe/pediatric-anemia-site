# Pediatric Anemia Diagnosis Aide - Current-State Product Specification

**Specification:** 1.0  
**Date:** 2026-07-16  
**Application:** 0.2.0 plus Algorithm Explorer update  
**Knowledge base:** 0.1.0-2026-07-15  
**Status:** Research prototype; not clinically validated or regulator-cleared.

## Product summary

A deterministic, evidence-linked clinician reference for pediatric anemia. The application captures demographics, CBC, history, examination, smear, and targeted laboratory findings; derives facts; runs 91 inspectable rules; merges 26 diagnostic patterns; and returns safety alerts, ranked patterns, rationale, missing questions, confirmatory workup, citations, and a reproducible audit.

## Scope

- Licensed healthcare professionals.
- Built-in age scope: 6 months to <18 years.
- Local laboratory ranges override AAP-derived fallbacks.
- <6 months routes outside the static general-pediatric fallback pathway.
- No autonomous diagnosis, treatment, dosing, transfusion, or probability claim.

## Inventory

- 91 rules: 55 differential, 17 adaptive-question, 13 safety, 6 interpretive-note.
- 13 safety rules: 5 emergency, 4 urgent, 4 important.
- 26 diagnostic patterns.
- 6 evidence records.
- 6 worked examples.
- 10 automated tests.

## Runtime

```text
patient JSON -> deriveFacts() -> JSON rule engine -> merge/rank patterns -> evidence-linked output and rule audit
```

## UI

Assessment, Algorithm Explorer, Evidence, Rule Catalog, Safety/Validation, and Audit JSON. The Explorer explains six stages: scope/urgency, confirm anemia, morphology, marrow response, morphology-specific rules, and provenance/ranking. It adds explanatory content without changing clinical rules.

## API

- `GET /health`
- `GET /api/v1/knowledge-base`
- `POST /api/v1/assess`

## Verification

All 10 engine tests pass; 91 rules, 26 candidates, and 6 evidence records validate; static build and smoke test pass. These checks prove software behavior, not clinical validity.

## Production blockers

Clinical review; exact passage traceability; tri-state data; multi-site retrospective validation; prospective silent mode; human factors; intended-use/regulatory review; security/privacy controls; quality system; content rights; signed release/change control.

## References

- **[C1]** American Academy of Pediatrics. *Prevention, Screening, Diagnosis, and Treatment of Iron Deficiency and Iron Deficiency Anemia in Infants, Children, and Adolescents: Clinical Report*. 2026. https://publications.aap.org/pediatrics/article/158/1/e2026077414/207901/Prevention-Screening-Diagnosis-and-Treatment-of. Primary current clinical source in the app.
- **[C2]** World Health Organization. *Guideline on haemoglobin cutoffs to define anaemia in individuals and populations*. 2024. https://www.who.int/publications/i/item/9789240088542. Supports age- and population-aware cutoff governance.
- **[C3]** Blood / American Society of Hematology. *Anemia in the pediatric patient*. 2022. https://doi.org/10.1182/blood.2021013018. Recent peer-reviewed morphology and reticulocyte framework.
- **[C4]** US Centers for Disease Control and Prevention. *Recommended Actions Based on Blood Lead Level*. 2025. https://www.cdc.gov/lead-prevention/hcp/clinical-guidance/index.html. Current lead reference value, confirmation, and escalation pathways.
- **[C5]** British Society for Haematology. *Laboratory diagnosis of G6PD deficiency: A British Society for Haematology Guideline*. 2020. https://pubmed.ncbi.nlm.nih.gov/?term=Laboratory+diagnosis+of+G6PD+deficiency+British+Society+for+Haematology. Foundational exception outside the five-year priority window.
- **[R1]** US Food and Drug Administration. *Clinical Decision Support Software: Guidance for Industry and FDA Staff*. 2026. https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software. Final guidance, January 2026.
- **[R2]** World Health Organization. *SMART Guidelines*. Current page accessed 2026. https://www.who.int/teams/digital-health-and-innovation/smart-guidelines. Describes the challenge of translating guidance into digital systems.
- **[R3]** HL7 International. *SMART App Launch Implementation Guide v2.2.0*. Current published version accessed 2026. https://hl7.org/fhir/smart-app-launch/. FHIR-based app launch and authorization standard.
- **[R4]** HL7 International. *CDS Hooks Implementation Guide v2.0.1*. Current published version accessed 2026. https://cds-hooks.hl7.org/. Workflow-triggered CDS integration standard.
- **[R5]** HL7 International. *FHIR PlanDefinition R4*. R4. https://hl7.org/fhir/R4/plandefinition.html. Shareable conditions, triggers, and executable actions.
- **[R6]** HL7 International. *FHIR Questionnaire R5*. R5. https://www.hl7.org/fhir/questionnaire.html. Structured, ordered clinical data capture and QuestionnaireResponse.
- **[R7]** US Department of Health and Human Services. *The HIPAA Security Rule*. Page reviewed March 2026. https://www.hhs.gov/hipaa/for-professionals/security/index.html. Administrative, physical, and technical safeguards for ePHI.
- **[R8]** US Federal Trade Commission. *Health Breach Notification Rule*. Final rule notice 2024. https://www.ftc.gov/legal-library/browse/rules/health-breach-notification-rule. May apply to vendors of personal health records and related entities.
