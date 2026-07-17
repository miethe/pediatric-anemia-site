# From Pediatric Anemia Aide to an Evidence-Governed Pediatric CDS Platform

**Date:** 2026-07-16  
**Prepared for:** Nick Miethe  
**Status:** Strategic working paper; current product remains an unvalidated research prototype.

## Executive recommendation

Proceed, but do not commercialize the anemia calculator as a standalone endpoint. Use it as the first public and clinically validated module of a broader pediatric laboratory interpretation platform. Build two layers:

1. **PedsLab Pathways** - a pediatric CBC and laboratory interpretation suite.
2. **Evidence Foundry Runtime** - a governed research-to-executable-CDS platform.

**Strategic thesis:** Anemia is the wedge, CBC interpretation is the product, and evidence-to-executable-CDS is the moat.

The strongest paid value is not static medical facts. It is EHR context, local reference ranges, longitudinal state, team governance, referral/documentation outputs, validated modules, analytics, deployment support, and accountable evidence maintenance.

## Recommended product sequence

| Wave | Modules / capabilities | Rationale |
|---|---|---|
| 0 | Tri-state data, local range registry, exact source passages, signed KB, clinical review portal, validation corpus | Safety and defensibility foundation |
| 1 | Anemia, neutropenia, leukocytosis/lymphocytosis, eosinophilia, platelet disorders, pancytopenia, smear | Coherent high-frequency CBC suite |
| 2 | Longitudinal iron/anemia, lead, hemoglobinopathy/newborn screen, heavy menstrual bleeding, referral completeness | Recurring workflow and measurable value |
| 3 | Renal/eGFR, liver, thyroid, inflammatory markers, selected coagulation | Adjacent age-dependent pediatric lab suite |
| 4 | Smear image AI, genomics, individualized trajectories | Research options after data and regulatory foundations |

## Highest-priority functionality

1. Local laboratory range and unit service.
2. Complete CBC/cytopenia suite.
3. SMART-on-FHIR launch and provenance-aware autofill.
4. Tri-state adaptive questionnaire.
5. Longitudinal anemia/iron trajectory.
6. Referral and workup completeness packet.
7. Exact source passages, evidence grades, and freshness/supersession.
8. Counterfactual explanations tested for comprehension and anchoring.
9. Clinician-reviewed note, referral, and parent-handout drafts.
10. Practice/system analytics for adoption, workup, referral, test use, and outcomes.

## Monetization hypotheses

| Tier | Illustrative pricing hypothesis | Paid value |
|---|---:|---|
| Clinician Pro | $149-$299/user/year | Longitudinal workspace, exports, CME, convenience |
| Practice | $3,000-$15,000/year | Shared pathways, local ranges, referral quality, analytics |
| Enterprise | $50,000-$250,000+/year | FHIR, SSO, governance, validated modules, SLA, analytics |
| API/content | $25,000-$200,000+ annual minimum | White-label executable modules and evidence updates |
| Services/research | Project-based | Implementation, validation, guideline digitization |

All prices are planning hypotheses, not market quotes or forecasts.

## Market scenarios

AAP cites reach to 67,000 board-certified members; this is an audience anchor, not a formal TAM [M1]. At $249/year, 5%, 15%, and 25% adoption would yield approximately $0.83M, $2.50M, and $4.17M ARR. Enterprise scenarios of 20 x $75k, 50 x $125k, and 100 x $150k yield $1.5M, $6.25M, and $15M ARR. These are arithmetic scenarios only.

## 90-day plan

- 20-30 structured customer and buyer interviews.
- Clinical advisory board and content-governance SOP.
- Intended-use and regulatory claims memo.
- Tri-state data, exact passage provenance, signed KB manifest, semantic diff, stronger tests.
- Retrospective and silent-mode validation protocol with at least one data partner.
- SMART sandbox prototype, longitudinal mock, referral packet, local-range concept.
- Two or more design-partner letters or paid discovery agreements.

## Key risks / no-go decisions

- No autonomous diagnosis, patient-facing CDS, unsupported confidence percentage, or treatment/dosing/transfusion directives.
- No PHI in the public microsite.
- No random calculator expansion.
- No AI-published rule changes.
- No pay-to-rank sponsorship.
- No compliance or clinical claims based on architecture or disclaimers alone.

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
- **[M1]** American Academy of Pediatrics. *About the AAP*. Accessed 2026. https://www.aap.org/en/about-the-aap/. AAP page cites reach to 67,000 board-certified members; use as an audience anchor, not total market size.
- **[M2]** MDCalc. *About MDCalc*. Accessed 2026. https://www.mdcalc.com/about-us. Vendor claims and product-selection criteria; benchmark only.
- **[M3]** MDCalc. *MDCalc for EHR*. Accessed 2026. https://ehr.mdcalc.com/. Vendor claims regarding autofill, analytics, SSO, cloud updates, and SMART-on-FHIR.
- **[M4]** Wolters Kluwer. *UpToDate clinical solutions*. Accessed 2026. https://www.wolterskluwer.com/en/solutions/uptodate. Vendor claims about individual and enterprise suites, editorial network, EHR access, CME, and patient engagement.
- **[M5]** VisualDx. *VisualDx*. Accessed 2026. https://www.visualdx.com/. Vendor feature benchmark: patient explainers, EHR, SSO, API, usage/reporting.
- **[M6]** EvidenceCare. *BetterCare Platform*. Accessed 2026. https://evidence.care/. Vendor positioning around clinical and financial outcomes; ROI claim not independently verified here.
