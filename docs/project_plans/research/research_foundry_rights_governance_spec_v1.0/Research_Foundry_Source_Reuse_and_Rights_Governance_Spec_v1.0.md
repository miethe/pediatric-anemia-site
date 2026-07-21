# Research Foundry and Evidence Foundry Source Reuse & Rights Governance Specification

**Version:** 1.0.0  
**Status:** Internal implementation specification  
**Verified through:** 2026-07-21  
**Primary jurisdiction:** United States, with global escalation requirements  
**Applies to:** Research Foundry, Evidence Foundry, PedsLab Pathways, Evidence Foundry Runtime, research agents, evidence-extraction agents, clinical-rule agents, content reviewers, product engineers, and release managers

> **Important:** This document is an operational governance specification, not a legal opinion. It deliberately uses conservative defaults. Product counsel should review the actual source licenses, access agreements, intended product functions, jurisdictions, and release package before commercial launch.

---

## 1. Purpose

This specification defines how Research Foundry and the Evidence Foundry beneath it may discover, access, analyze, extract, transform, store, cite, encode, and ship knowledge obtained from scientific publications, clinical guidelines, professional-society products, standards, datasets, questionnaires, software, images, and other third-party sources.

It resolves a common but consequential misunderstanding:

- **Scientific knowledge is meant to be learned and used.**
- **Copyright may protect the source’s expression, presentation, and compilation, not the underlying facts, methods, systems, or discoveries.**
- **A subscription or purchase grants only the rights stated in the applicable agreement.**
- **Attribution proves provenance; it does not itself grant permission.**
- **A source can be clinically authoritative but legally restricted, or legally reusable but clinically weak.**

Research Foundry must therefore track three independent dimensions:

1. **Evidence quality and clinical applicability**
2. **Reuse rights and contractual permissions**
3. **Clinical/regulatory suitability for the intended product function**

No one dimension substitutes for the others.

---

## 2. Executive policy

### 2.1 Default position

Research Foundry may ordinarily use lawfully accessed publications to learn, evaluate, and independently state factual findings. Evidence Foundry may ordinarily encode independently authored deterministic logic based on uncopyrightable facts, discoveries, equations, methods, and clinical procedures, subject to:

- the specific source-access agreement;
- patents or other intellectual-property rights;
- compilation and database rights;
- trademark and endorsement restrictions;
- privacy, confidentiality, and data-use obligations;
- the amount and structure extracted;
- the intended commercial and product use;
- jurisdiction-specific law;
- clinical validation and regulatory requirements.

### 2.2 Default prohibition

Agents must not assume that payment, subscription access, public availability, open access, PMC availability, citation, or clinical custom grants the right to reproduce or redistribute source content.

Without verified permission or a compatible license, the shipped product must not include:

- copied article or guideline prose;
- copied or lightly redrawn figures, tables, charts, nomograms, or decision trees;
- substantial portions of a curated proprietary knowledge base;
- proprietary questionnaires, forms, scoring instruments, or patient handouts;
- publisher or society branding suggesting approval or endorsement;
- full-text source documents or source-derived content that substitutes for the original product;
- content obtained through prohibited scraping, paywall circumvention, credential sharing, or unauthorized bulk retrieval.

### 2.3 Preferred implementation pattern

The preferred implementation pattern is:

1. Find the strongest primary and authoritative sources.
2. Verify the article-level license and access terms.
3. Extract atomic factual claims with precise source locators.
4. Separate the underlying fact or method from the source’s expression.
5. Write original rule logic and original product explanations.
6. Validate the clinical logic independently.
7. record source rights, component rights, and intended-use clearance.
8. Ship only the facts, logic, citations, and explanations cleared for that release.

### 2.4 Conservative release rule

A commercial release must be blocked when rights are **unknown**, **materially disputed**, **contractually restricted**, or **dependent on a copied proprietary compilation**, unless product counsel or the rights holder clears the intended use.

---

## 3. Legal and operational foundation

### 3.1 Facts, methods, systems, procedures, and discoveries

Under 17 U.S.C. § 102(b), copyright protection does not extend to an idea, procedure, process, system, method of operation, concept, principle, or discovery, regardless of how it is described or illustrated. The U.S. Copyright Office likewise states that copyright does not protect facts, ideas, systems, or methods of operation, though it may protect the way they are expressed. [S1][S2] The controlling U.S. Supreme Court authority for this fact/expression line is *Feist Publications v. Rural Telephone Service*, 499 U.S. 340 (1991) [S16], which holds that facts are not original to their discoverer and that copyright protects only the original selection, coordination, or arrangement contributed by an author — not the underlying facts themselves. [Amendment 2026-07-21, EPR5-T2, per FR-WP5-02]

Operational consequence:

- A reported numeric result, observed association, equation, measurement, or clinical method can often be independently described and used.
- The source’s exact prose, figure, table, graphical layout, explanatory narrative, or creative organization may remain protected.
- The fact that an article is copyrighted does not make the scientific facts themselves proprietary.

### 3.2 Compilations and databases

A compilation may receive copyright protection for original selection, coordination, or arrangement, while protection does not extend to the underlying preexisting facts. The Copyright Office similarly distinguishes individual facts from copyrightable database authorship. [S1][S3]

Operational consequence:

- Encoding one independently stated threshold is different from reproducing a publisher’s entire age-by-risk-by-time threshold table.
- A complete table, nomogram, taxonomy, or curated set may create compilation risk even when individual values are factual — a coding taxonomy of numbering plus short descriptions was held copyrightable in *ADA v. Delta Dental Plans Ass'n*, 126 F.3d 977 (7th Cir. 1997) [S18], and a compiled set of values reflecting professional judgment, not bare measurement, was held protected expression in *CCC Information Services v. Maclean Hunter Market Reports*, 44 F.3d 61 (2d Cir. 1994) [S17]. [Amendment 2026-07-21, EPR5-T2, per FR-WP5-02]
- The risk increases when the shipped product preserves the source’s same scope, selection, sequence, labels, categories, and arrangement and can substitute for the source product.

Outside the United States, additional rights may exist. European Union law, for example, recognizes a sui generis database right protecting substantial investment in obtaining, verifying, or presenting database contents. [S13] Two qualifications scope that statement for this project. **Territorial scoping:** Directive 96/9/EC is EU/EEA law; it does not attach to a US-only product's US operations on its own terms, though it can still matter if a database is sourced from an EU-based publisher or the product is distributed into the EU/EEA. **The creation-vs-obtaining carve-out:** the Court of Justice of the European Union held, in a line of judgments including *The British Horseracing Board Ltd and Others v William Hill Organization Ltd*, Case C-203/02, [2004] ECR I-10415 (9 November 2004), and *Fixtures Marketing Ltd v Organismos Prognostikon Agonon Podosfairou AE (OPAP)*, Case C-444/02 (9 November 2004), that the sui generis right protects investment in **obtaining** (collecting from existing sources), verifying, and presenting data — not investment in **creating** it. An organization that generates its own measurements — a laboratory establishing its own reference intervals from its own patient population, for example — is plausibly on the creating side of that line, and the sui generis right is correspondingly less likely to reach that data. [Amendment 2026-07-21, EPR5-T3, per FR-WP5-05]

### 3.3 Access agreements and contracts

Copyright and contract are separate questions. A fact may not be copyrightable, yet the terms governing a particular subscription, portal, dataset, API, or institutional account may restrict extraction, incorporation, redistribution, commercial use, automated access, or use by third parties.

The AAP Pediatric Care Online terms, for example, provide a limited license for clinical use and prohibit, without separate written approval, altering, adapting, preparing derivative works from, or incorporating the licensed Materials into other materials. [S5]

Operational consequence:

- Do not use a personal or institutional subscription as a corporate content-extraction license unless its terms allow that activity.
- When terms restrict incorporation, use an independently accessible primary source, a compatible open-license source, a separately licensed feed, or direct permission.
- Research Foundry treats applicable access terms as binding operational constraints unless counsel determines otherwise.

### 3.4 Attribution is not permission

A citation establishes provenance and supports scientific integrity. It does not grant reproduction, adaptation, redistribution, or commercial-use rights.

Attribution is sufficient only when:

- the material is not protected for the intended use;
- the material is in the public domain;
- an exception applies;
- the applicable license authorizes the use subject to attribution; or
- the rights holder has granted permission.

Creative Commons licenses illustrate the distinction. CC BY 4.0 allows commercial sharing and adaptation if its conditions are met; CC BY-NC 4.0 does not authorize commercial use. [S8][S9]

### 3.5 Free to read is not free to reuse

Public availability, a downloadable PDF, inclusion in PubMed Central, or the label “open access” is not enough. Article-level license terms control. PMC states that many freely accessible articles remain copyrighted and that only designated article datasets and licenses permit broader reuse; it also restricts systematic downloading to authorized services. [S10]

Operational consequence:

- Record the exact article-level license, not merely the journal’s general policy.
- Do not infer commercial reuse from `open_access=true`.
- Do not systematically retrieve content through unapproved scraping or browser automation.

### 3.6 Fair use

Fair use is a case-specific legal doctrine governed by the four statutory factors in 17 U.S.C. § 107. The Copyright Office emphasizes that there is no fixed safe number of words or percentage and that only a court can definitively determine fair use. [S4]

Operational policy:

- Fair use may support limited internal research, criticism, validation, or short quotations in appropriate circumstances.
- Fair use must **not** be the default legal basis for commercial product content.
- Any release relying materially on fair use requires documented counsel approval.
- The Foundry’s internal “short quotation” limits are governance guardrails, not statutory safe harbors.

### 3.7 Government works and public domain

Copyright protection is generally unavailable for **works of the United States Government** — a work
prepared by an officer or employee of the federal government as part of that person's official duties
— under 17 U.S.C. § 105, subject to statutory nuances and third-party content. [S1] [Amendment
2026-07-21, EPR5-T4, per FR-WP5-06: citation consolidated from the retired [S14] into [S1] — see
Appendix B and Appendix D] That rule does
**not** extend to **government-*funded*** works: federal grant or contract funding does not itself
divest the authoring university, researcher, or publisher of copyright in the resulting article. §105
turns on federal *authorship*, not on federal *funding*. [Amendment 2026-07-21, EPR5-T3, per
FR-WP5-03]

Operational consequence:

- U.S. federal guidance and datasets **authored by a federal officer or employee as part of official
  duties** are often excellent reuse candidates.
- Confirm authorship and ownership; a government-hosted page may include copyrighted third-party content.
- Government agency names, seals, and logos may have separate restrictions.
- **The PMC trap.** NIH-funded articles by university-affiliated authors are copyrighted, not §105
  government works, and they are abundant in exactly the PubMed Central corpus this project searches
  (§3.5). A grant acknowledgment, an `.gov`-adjacent funder, or PMC hosting is not evidence of federal
  authorship. Confirm the byline is a federal officer or employee writing in that official capacity
  before treating an article as a §105 government work; absent that, treat it under §3.5 (article-level
  license controls) instead. [Amendment 2026-07-21, EPR5-T3, per FR-WP5-03]

### 3.8 Patents

A method may be uncopyrightable yet potentially covered by a patent. A U.S. patent grants the owner the right to exclude others from making, using, selling, offering for sale, or importing the claimed invention. [S12]

Operational consequence:

- Screen named, branded, proprietary, licensed, or commercially marketed scores, assays, devices, and algorithms for patent or license constraints.
- Patent review is especially important for diagnostic signatures, analyzer-derived algorithms, companion diagnostics, and vendor-specific methods.

### 3.9 Trademarks and endorsement

Trademarks identify the source of goods or services. A source name may be cited descriptively, but logos, branding, and product positioning must not suggest sponsorship or endorsement without authorization. [S11] [Amendment 2026-07-21, EPR5-T4, per FR-WP5-06: pin-cite corrected — see Appendix B and Appendix D]

Operational consequence:

- Cite “American Academy of Pediatrics” as the source when appropriate.
- Do not label a product “AAP-approved,” “AAP-certified,” or use the AAP logo unless expressly authorized.
- Do not use protected product names as your own module names.

### 3.10 Privacy, confidentiality, and trade secrets

Copyright clearance does not authorize use of protected health information, confidential partner data, unpublished manuscripts, internal hospital pathways, trade secrets, or data obtained under a restrictive data-use agreement.

Operational consequence:

- Rights records must link to separate data-use, confidentiality, privacy, IRB, and security records when applicable.
- Confidential content must never be released merely because it contains factual information.

### 3.11 Regulatory transparency is separate from content permission

FDA’s Clinical Decision Support Software final guidance, re-issued January 29, 2026 (superseding the January 6, 2026 version, itself superseding the September 2022 final guidance), addresses when clinicians can independently review the basis of recommendations and distinguishes certain non-device CDS from device software functions. It does not grant copyright or reuse rights. [S15] [Amendment 2026-07-21, EPR5-T4, per FR-WP5-06: date pinned — see Appendix B and Appendix D]

Operational consequence:

- Evidence Foundry needs citations, logic transparency, validation, and limitations for regulatory and clinical reasons.
- That transparency must be achieved using content the product is authorized to display.

---

## 4. Why clinician use differs from commercial product reuse

A clinician normally reads a source, forms professional judgment, and applies the knowledge to a patient. The clinician is generally using the underlying facts and methods rather than redistributing the publisher’s expression.

A commercial CDS may instead:

- store and distribute hundreds of extracted values;
- reproduce a complete clinical pathway or nomogram;
- present the same curated organization as the source;
- expose the content to users who did not purchase the source;
- eliminate the user’s need to access the publisher’s product;
- charge for access to the encoded knowledge base;
- update and redistribute the content repeatedly.

Those differences increase copyright, compilation, contract, and market-substitution concerns.

The correct question is not:

> “Did a clinician have the right to learn this?”

It is:

> “Does this intended product output independently implement uncopyrightable knowledge, or does it copy, adapt, redistribute, or substitute for protected or contractually restricted source material?”

---

## 5. Reuse classification model

Every source component and intended use must be classified separately. The same publication can contain a reusable fact, a restricted figure, and a separately licensed questionnaire.

### 5.1 Content-component classes

| Component | Examples | Default treatment |
|---|---|---|
| Bibliographic metadata | title, authors, DOI, journal, date | Generally shippable as citation metadata |
| Atomic factual finding | reported threshold, measured association, sample size | Facts-only implementation potentially permitted; independently word and assess contract |
| Equation or method | eGFR equation, unit conversion, decision criterion | Potentially implementable; check patent, contract, branding, and source context |
| Guideline recommendation | repeat in X weeks, refer under condition Y | Independently implementable in many cases; preserve scope and cite; review full-set copying risk |
| Reference-interval value | age/sex/analyzer interval | Individual values may be factual; full dataset may be compilation or licensed database |
| Prose or abstract | article text, explanatory paragraph | Do not ship verbatim without license/permission or approved exception |
| Table | threshold table, evidence table | Permission or specific license usually required to reproduce; facts may be independently restructured |
| Figure or chart | forest plot, workflow diagram | Permission or compatible license required |
| Nomogram | bilirubin chart, risk curve | High-risk; license or independently validated implementation and legal review |
| Decision tree / flowchart | guideline algorithm | Underlying method may be usable; do not copy visual or expressive structure; high-risk when complete |
| Questionnaire / instrument | screening form, test items, scoring instructions | Permission required by default unless explicit terms allow intended use |
| Patient handout | society education sheet | Permission or explicit license required |
| Dataset | reference intervals, registry export | Governed by copyright, contract, database rights, privacy, and DUA |
| Software/code | calculator source, package, rules engine | Follow software license; algorithms may have separate patent or content rights |
| Image / morphology example | smear image, clinical photograph | Permission and privacy/model-release review required |
| Brand or logo | society logo, product mark | Do not use without authorization except limited descriptive reference |

### 5.2 Intended-use classes

Rights decisions must identify the intended use:

- internal reading;
- internal research notes;
- internal searchable archive;
- automated text and data mining;
- model training or retrieval corpus;
- evidence-atom extraction;
- candidate-rule authoring;
- internal validation;
- commercial runtime logic;
- commercial user-facing explanation;
- source preview or excerpt display;
- clinician-facing citation;
- patient-facing content;
- documentation, marketing, or training;
- sublicense, export, or partner distribution.

A right to perform one use does not imply a right to perform another.

---

## 6. Rights decision statuses

The Foundry must use the following controlled decisions.

| Status | Meaning | Release behavior |
|---|---|---|
| `CLEARED_OPEN_LICENSE` | Explicit license permits intended use and conditions are satisfied | May ship with required notices and attribution |
| `CLEARED_PUBLIC_DOMAIN` | Verified public-domain or applicable U.S. federal-government work | May ship; preserve recommended attribution and third-party notices |
| `CLEARED_FACTS_ONLY` | Output independently implements factual knowledge or method without protected expression; no blocking contract identified | May ship after rights and clinical review |
| `CLEARED_PERMISSION` | Written license or permission covers intended product, territory, channel, duration, and transformations | May ship within grant scope |
| `INTERNAL_ONLY` | Access permits internal research but not product redistribution | Block external shipment |
| `LOCAL_VALIDATION_ONLY` | Source can inform local validation but cannot support a universal or redistributed content package | Block universal default; allow controlled site-specific implementation as approved |
| `LEGAL_REVIEW_REQUIRED` | Ambiguity, high compilation similarity, fair-use reliance, custom terms, or jurisdiction issue | Block until counsel decision |
| `PERMISSION_REQUIRED` | Protected expression, instrument, or content set requires license | Block until permission record is active |
| `CONTRACT_RESTRICTED` | Access agreement prohibits intended extraction/incorporation/use | Block; find alternative source or obtain license |
| `PROHIBITED` | Circumvention, confidential source, revoked license, unresolvable rights, or expressly forbidden use | Do not ingest or ship as specified |
| `UNKNOWN` | Rights not verified | Block commercial release |

### 6.1 Risk colors

- **Green:** cleared open license, public domain, or approved facts-only implementation
- **Yellow:** legal review, custom license, short quote, substantial compilation, branded method
- **Orange:** permission required, noncommercial license in commercial product, no-derivatives adaptation, contract restriction
- **Red:** prohibited access, confidential content, unauthorized copying, expired/revoked permission, deceptive endorsement

---

## 7. Research Foundry content zones

Research Foundry must enforce rights by architecture, not only by policy.

### Zone 0 — Discovery index

Contains:

- bibliographic metadata;
- public URLs;
- search results;
- license candidates;
- no full-text assumptions.

### Zone 1 — Controlled source vault

May contain lawfully obtained source files subject to:

- access controls;
- subscription or institutional-user limits;
- no uncontrolled redistribution;
- source checksum and access provenance;
- deletion or access termination requirements;
- authorized retrieval methods.

### Zone 2 — Research evidence registry

Contains:

- independently worded evidence atoms;
- precise source locators;
- short controlled excerpts where justified;
- appraisal and conflict records;
- rights records;
- no copied figures, tables, or long text unless separately licensed.

### Zone 3 — Rule-authoring workspace

Contains:

- approved factual inputs;
- original deterministic logic;
- original explanation text;
- test cases;
- source citations;
- reusable content only.

### Zone 4 — Release candidate

Contains only:

- rights-cleared atoms and rules;
- required attribution and license notices;
- active permission records;
- no unresolved rights failures;
- versioned clearance manifest.

### Zone 5 — Product runtime and distribution

Contains only the shippable package approved for:

- the named product;
- the named audience;
- the named territory;
- the named channel;
- the approved product claims;
- the applicable license period.

Content must not move to a higher zone merely because it has strong medical evidence.

---

## 8. Required agent behavior

### 8.1 Agents MUST

1. Identify the exact source, edition, version, correction status, and publication date.
2. Record how the source was accessed and which terms governed that access.
3. Verify the article-level or item-level license.
4. Separate facts and methods from expression, presentation, and compilation.
5. Extract one atomic factual claim per evidence atom.
6. Use precise page, section, table, figure, or equation locators.
7. Write original paraphrases and original product explanations.
8. Record whether an output is source-stated, analyst-paraphrased, analyst-derived, or expert-adjudicated.
9. Create a `rights_record` for every source used in rule authoring.
10. Create a `content_reuse_assessment` for every component intended for external shipment.
11. Record permission evidence and expiration when permission is required.
12. Link candidate rules to all supporting reuse assessments.
13. Block release when the rights status is unknown or unresolved.
14. Preserve attribution and license notices exactly as required.
15. Re-review rights when the source, product, audience, territory, channel, or business model changes.
16. Use only authorized bulk-retrieval and text-mining methods.
17. Flag patents, questionnaires, proprietary scores, branded methods, and commercial datasets for specialist review.
18. Search for alternative primary or openly licensed sources when a proprietary source creates avoidable restrictions.

### 8.2 Agents MUST NOT

1. Treat a citation as permission.
2. Treat paid access as ownership or a commercial content license.
3. Treat “free online,” “open access,” PubMed indexing, or PMC inclusion as proof of commercial reuse rights.
4. Copy or lightly rewrite substantial source prose.
5. recreate a table or figure by changing colors, fonts, labels, or layout while preserving its protected expression.
6. Reconstruct a complete proprietary knowledge product from a subscription source without approval.
7. Bulk scrape a website or repository contrary to its terms or technical controls.
8. Share credentials or use personal subscriptions for unauthorized organizational extraction.
9. Bypass paywalls, robot exclusions, download limits, or access controls.
10. Use society logos, marks, or endorsement language without authorization.
11. Ship proprietary questionnaires, scoring instructions, test items, or patient handouts without verified rights.
12. Assume an equation is unencumbered by patent, trademark, or contractual rights merely because equations are not protected by copyright as such.
13. Use long verbatim passages in the evidence registry.
14. rely on fair use as an automated or default commercial release rationale.
15. infer rights from another product’s apparent use of the same source.

### 8.3 Agents SHOULD

- prefer primary studies, public-health guidance, public-domain works, and CC BY sources;
- use multiple independent sources to reduce dependence on one proprietary compilation;
- recreate clinical logic from underlying evidence rather than copying a society’s presentation;
- use clean-room authoring for high-similarity algorithms;
- seek licensing when a proprietary content set materially reduces clinical risk or implementation cost;
- retain snapshots of applicable terms and licenses;
- obtain human review for high-risk, neonatal, urgent, medication, or patient-facing content;
- treat negative rights findings as structured research results, not missing metadata.

---

## 9. Clean-room rule-authoring pattern

For high-risk guideline or knowledge-base content, use a separation-of-duties process:

### Research reviewer

- lawfully accesses sources;
- extracts atomic facts, methods, population limits, and locators;
- does not copy expressive structure into the implementation brief;
- records rights constraints.

### Independent rule author

- receives approved evidence atoms and clinical requirements;
- writes the deterministic rule, variable names, ordering, and explanations independently;
- does not use copied source tables, diagrams, or prose.

### Clinical adjudicator

- confirms clinical fidelity, scope, exclusions, and safety exits;
- documents expert judgment separately from source-stated evidence.

### Rights reviewer

- compares the proposed product output with the source components;
- assesses compilation similarity, market substitution, branding, contract constraints, and notices;
- assigns the release status.

### Technical verifier

- confirms source-to-rule traceability;
- tests boundaries, units, profiles, missing data, and version differences;
- verifies that only cleared content enters the release package.

This process reduces copying risk but is not a substitute for legal clearance where the underlying use is restricted.

---

## 10. Evidence Foundry integration

### 10.1 Design recommendation

Do not place all rights data inside the existing source record. Use three linked objects:

1. **`rights_record`** — source-level and access-context rights baseline
2. **`content_reuse_assessment`** — component-level decision for a specific intended use
3. **`permission_record`** — evidence of an affirmative license or permission grant

This normalization is necessary because:

- the same source may be accessed through multiple licenses;
- rights differ by component;
- a use may be internal-only but not commercial;
- permission may apply to one product, territory, or duration;
- rights can change without changing the scientific source record;
- different products may make different uses of the same evidence.

### 10.2 Research Foundry base layer

The generic Research Foundry rights model applies to:

- articles and books;
- guidelines and standards;
- datasets and APIs;
- questionnaires and instruments;
- software and code;
- images and media;
- patents and branded algorithms;
- partner-provided and confidential materials.

### 10.3 Evidence Foundry specialization

Evidence Foundry adds clinical deployment fields:

- evidence atom IDs;
- candidate rule IDs;
- clinical content type;
- direct pediatric applicability;
- rule derivation method;
- source-dependency level;
- number and proportion of encoded values from the source;
- compilation similarity;
- local profile requirement;
- clinician-facing display scope;
- patient-facing display scope;
- source-locator display permission;
- required regulatory transparency;
- clinical reviewer and legal reviewer;
- release package and effective version.

### 10.4 Existing schema compatibility

The existing `source_record.access.license` and `reuse_notes` fields are insufficient for release decisions. Retain them for discovery-level metadata, but add `extensions.rights` with links to formal records.

Recommended source extension:

```json
{
  "extensions": {
    "rights": {
      "rights_record_ids": ["RR-SRC-AAP-001"],
      "commercial_reuse_status": "CONTRACT_RESTRICTED",
      "last_reviewed_at": "2026-07-21T12:00:00Z",
      "release_gate": "BLOCK"
    }
  }
}
```

Recommended evidence-atom extension:

```json
{
  "extensions": {
    "rights": {
      "rights_record_ids": ["RR-SRC-PRIMARY-001"],
      "reuse_assessment_ids": ["CRA-EA-0042-RUNTIME"],
      "clearance_status": "CLEARED_FACTS_ONLY",
      "shippable_claim_text_allowed": true,
      "verbatim_excerpt_allowed": false,
      "source_locator_display_allowed": true
    }
  }
}
```

Recommended candidate-rule extension:

```json
{
  "extensions": {
    "rights": {
      "reuse_assessment_ids": [
        "CRA-EA-0042-RUNTIME",
        "CRA-EA-0043-RUNTIME"
      ],
      "clearance_status": "CLEARED_FACTS_ONLY",
      "publisher_content_dependency": "low",
      "compilation_similarity": "low",
      "permission_required_before_release": false,
      "release_gate": "PASS"
    }
  }
}
```

---

## 11. Rights record specification

The companion JSON Schema is authoritative for machine validation. At minimum, a rights record must capture:

### Identity and scope

- rights-record ID;
- source ID;
- source version or edition;
- source component scope;
- jurisdiction;
- rights review date;
- current status.

### Access basis

- public web;
- open repository;
- personal subscription;
- institutional subscription;
- purchased copy;
- licensed API;
- direct permission;
- author-provided copy;
- government source;
- partner or confidential source;
- data-use agreement.

### Copyright and license

- copyright owner;
- publication license and version;
- license URL;
- license applicability to text, figures, tables, supplements, code, and data;
- public-domain status;
- U.S. federal-government-work status;
- attribution and notice requirements;
- share-alike, noncommercial, or no-derivatives obligations.

### Contract restrictions

- incorporation into another product;
- adaptation;
- commercial use;
- redistribution;
- sublicensing;
- text and data mining;
- automated retrieval;
- model training;
- user-count and territory restrictions;
- termination and deletion duties.

### Component decisions

For each component:

- permitted;
- permitted with conditions;
- facts-only;
- permission required;
- prohibited;
- unknown.

### Other rights and constraints

- patents;
- trademarks and endorsement;
- database rights;
- privacy and confidentiality;
- data-use agreement;
- third-party embedded content;
- export or jurisdiction limits.

### Product disposition

- internal research;
- evidence-atom extraction;
- independent rule implementation;
- commercial runtime;
- user-facing explanation;
- patient-facing content;
- marketing or training;
- bulk retrieval or corpus use.

### Review and surveillance

- automated assessment agent;
- human rights reviewer;
- counsel decision;
- review date;
- expiration or renewal date;
- change triggers;
- source snapshots and checksums;
- permission record IDs.

---

## 12. Content reuse assessment specification

A source-level rights record does not answer every intended-use question. Each shipped component requires a content reuse assessment that records:

- source and rights record;
- exact content component;
- intended product and version;
- intended audience;
- commercial or noncommercial status;
- territory and channel;
- amount and substantiality used;
- whether the output reproduces source wording or arrangement;
- whether the output was independently derived;
- whether alternative sources exist;
- compilation similarity;
- market-substitution risk;
- license conditions;
- clinical and regulatory transparency requirements;
- final decision and rationale;
- approvers and expiration.

The decision is use-specific. A figure may be blocked for runtime display but permitted in an internal legal-review memo.

---

## 13. Permission record specification

When permission is obtained, preserve the grant as a structured record rather than an email attachment alone.

Required fields include:

- rights holder and contact;
- permission or license identifier;
- executed agreement location and checksum;
- source and components covered;
- product and affiliates covered;
- commercial use;
- channels;
- audiences and user counts;
- territory;
- term and renewal;
- adaptation rights;
- attribution and notices;
- update rights;
- sublicensing and hosting rights;
- fees and reporting obligations;
- warranties, indemnities, and disclaimers;
- revocation and deletion obligations;
- approval status.

A permission grant must not be generalized beyond its documented scope.

---

## 14. Automated decision workflow

Agents must apply the following workflow.

### Step 1 — Identify the source

Resolve the authoritative source, version, correction status, identifiers, and owner.

### Step 2 — Identify the access context

Record the exact platform, account type, subscription, API, repository, or permission used.

### Step 3 — Determine the intended use

Specify internal/external, commercial/noncommercial, runtime/display, audience, territory, volume, and channel.

### Step 4 — Classify the component

Fact, method, prose, table, figure, compilation, questionnaire, dataset, code, image, brand, or other.

### Step 5 — Verify license and terms

Use the item-level license, access agreement, and rights-holder information. Do not infer.

### Step 6 — Check other constraints

Patent, trademark, database right, confidentiality, privacy, DUA, third-party content, and jurisdiction.

### Step 7 — Choose the least restrictive lawful implementation

Preferred order:

1. public-domain source;
2. CC BY or similarly compatible source;
3. primary study and facts-only independent implementation;
4. direct permission or commercial license;
5. local validation and independently generated content;
6. legal review;
7. block or defer.

### Step 8 — Produce records

Create or update:

- source record;
- rights record;
- content reuse assessment;
- permission record when applicable;
- evidence atom;
- candidate rule;
- research failure or conflict when blocked.

### Step 9 — Apply release gate

No external release when:

- status is `UNKNOWN`;
- required permission is missing or expired;
- access terms prohibit intended use;
- source output is substantially copied;
- unresolved patent, trademark, privacy, or database-right risk exists;
- required attribution or license notices cannot be satisfied;
- clinical validation or regulatory transparency is inadequate.

### Step 10 — Monitor changes

Reassess when:

- a source updates or is superseded;
- terms of use change;
- a license changes;
- a permission expires;
- the product becomes commercial;
- the audience changes from clinician to patient;
- the product enters a new country;
- content moves from internal display to runtime logic;
- extraction volume grows materially;
- a named source becomes a core marketing claim.

---

## 15. Decision matrix: common product uses

| Proposed use | Default disposition | Conditions |
|---|---|---|
| Store DOI, PMID, title, authors, date | Cleared | Verify accuracy; metadata only |
| Store original paraphrase of one study finding | Facts-only candidate | Lawful access, locator, no blocking terms, no copied expression |
| Encode a measured/observed numeric value (e.g., a cohort's reported sensitivity, specificity, or other quantity at a stated cutoff, drawn from a primary study) [Amendment 2026-07-21, EPR5-T1] | Facts-only candidate | Preserve population/assay limits; assess contract and compilation dependence |
| Encode a consensus/judgment-derived numeric recommendation (e.g., a guideline committee's threshold, cutoff, or scoring recommendation) [Amendment 2026-07-21, EPR5-T1] | `LEGAL_REVIEW_REQUIRED` | Represents the drafting body's professional judgment, not a bare measured fact — do not route to Facts-only candidate; preserve population/assay limits and assess contract/compilation dependence pending review; see Appendix D |
| Encode an equation | Facts-only candidate | Check patent, branded method, license, inputs, validity |
| Combine several studies into an original rule | Facts-only candidate | Document synthesis and expert judgment; do not reproduce source organization |
| Display a citation and link | Usually cleared | No copied preview or endorsement; use stable identifier |
| Display a short source quotation | Legal review or license | No fixed word safe harbor; purpose and context matter |
| Reproduce a source table | Permission/license required | Follow exact grant and attribution |
| Redraw the same table or figure | Permission/license likely required | Cosmetic changes do not remove derivative-work risk |
| Implement an entire proprietary nomogram | Legal review/license | High compilation and substitution risk; prefer direct license or independent validation |
| Copy guideline flowchart logic and labels | Legal review/license | Independently author structure and text; assess substantial similarity |
| Use a proprietary questionnaire | Permission required by default | Verify exact instrument terms, scoring rights, languages, electronic use |
| Use CC BY article text/figure | Cleared with conditions | Attribution, link, change indication, article-level license verification |
| Use CC BY-NC content in paid SaaS | Block without permission | Commercial use not granted |
| Adapt CC BY-ND figure or table | Block without permission | Adaptation not permitted |
| Use a PMC article because it is free to read | Not enough information | Verify article-level license and retrieval method |
| Use U.S. federal-government guidance | Public-domain candidate | Verify federal authorship and third-party content; avoid logo misuse |
| Bulk-download subscription content for RAG | Contract/legal review | Requires explicit TDM, automated retrieval, storage, and model-use rights |
| Train a model on source full text | Legal review required | Separate use not implied by reading or clinical subscription |
| Use AAP logo or “AAP-approved” claim | Prohibited absent authorization | Citation is not endorsement |

> **Amendment note (EPR5-T1):** the two numeric-value rows above replace what was originally a single
> "Encode a reported numeric threshold → Facts-only candidate" row. See Appendix D for the dated
> amendment entry, its rationale, and its scope. This row split states a routing rule only; it makes
> no determination about any specific threshold family. Whether a given clinical threshold is measured
> or committee-judged is open question **OQ-1** and routes to counsel — it is not decided here or
> anywhere in this document. The judgment-derived row's routing rests on *CCC Information Services v.
> Maclean Hunter Market Reports*, 44 F.3d 61 (2d Cir. 1994) [S17], which held that valuations
> reflecting the compiler's predictions and professional judgment — not bare measurement — were
> protected expression, not facts, in a commercial-database context. [Amendment 2026-07-21, EPR5-T2,
> per FR-WP5-02]

---

## 16. AAP-specific operating guidance

### 16.1 What an AAP subscription does

AAP Pediatric Care Online grants subscribers limited access and use for healthcare services and imposes restrictions on distribution, adaptation, derivative works, and incorporation into other materials absent separate approval. [S5]

Therefore:

- the subscription is useful for clinical research and source identification;
- it is not, by itself, a commercial content-ingestion license;
- account terms must be respected even when the underlying medical fact may be independently usable.

### 16.2 What may often be usable

Subject to source and legal review, the product may often:

- cite the AAP publication;
- state independently worded clinical facts or recommendations;
- implement a clinical method in original code;
- use primary studies cited by the AAP as the direct evidentiary basis;
- record that an AAP guideline supports a recommendation;
- build original explanations and safety logic;
- independently validate the implementation.

**Contract caveat, carried inline from §16.1.** Every item above answers a *copyright* question; none
of them, by itself, answers the separate *contract* question §16.1 raises. The AAP Pediatric Care
Online subscription bars, absent separate written approval, incorporating the licensed Materials into
other materials. Re-wording a clinical fact or recommendation does not defeat that contractual
prohibition when the item was extracted from the AAP-licensed Materials, or when its selection and
organization tracks them — copyright and contract are separate questions, as §3.3 already states, and
this list's facts-only framing answers only the copyright question. Before treating any item above as
cleared, confirm the access basis is not the AAP subscription itself: an independently accessible
primary source, a compatible open-license source, a separately licensed feed, or direct permission,
per §3.3's operational consequence. [Amendment 2026-07-21, EPR5-T3, per FR-WP5-04]

### 16.3 What should not be assumed usable

Do not assume the right to:

- copy AAP prose;
- reproduce an AAP figure, table, chart, nomogram, algorithm, form, handout, or slide — AAP's own
  author instructions govern figures, tables, and supplementary material and impose their own reuse
  constraints on top of the subscription terms above [S7] [Amendment 2026-07-21, EPR5-T4, per
  FR-WP5-06: [S7] was defined in Appendix B but never cited from the body — cited here];
- extract and redistribute the full AAP threshold or knowledge set;
- incorporate Pediatric Care Online Materials into the commercial knowledge base in violation of the subscription terms;
- use AAP trademarks or imply endorsement.

AAP expressly provides a permissions and licensing process and states that it is willing to discuss reuse in electronic health records. [S6]

### 16.4 Recommended AAP strategy

For each AAP-dependent module:

1. Determine whether the module can be based directly on primary studies, public guidance, and independently generated clinical logic.
2. Calculate how much of the value depends on the complete AAP-curated structure.
3. Use facts-only implementation when genuinely independent and contract-compatible.
4. Request an EHR/CDS or commercial-content license when the product needs AAP tables, graphics, full algorithms, patient materials, or a complete curated content set.
5. Do not market AAP association without a separate agreement.

---

## 17. Detailed examples

### Example A — Single threshold from a primary study

A pediatric cohort reports that a laboratory value below a stated cutoff had specified diagnostic performance on a named analyzer.

**Permitted pattern:**

- store bibliographic metadata;
- create an original evidence atom;
- record exact population, analyzer, reference standard, and performance;
- write original rule logic;
- cite the study;
- prohibit application when analyzer or population is outside scope.

**Do not:** copy the study’s table, wording, or figure into the product without permission.

**Expected decision:** `CLEARED_FACTS_ONLY`, assuming no blocking contract, patent, or other restriction.

### Example B — AAP multi-dimensional threshold nomogram

An AAP guideline provides a custom graph and complete table crossing age, gestation, risk, and laboratory value.

**Permitted research:** understand the method, identify underlying evidence, record source locators, and assess clinical logic.

**High-risk shipment:** reproducing all values and the same categories in a product that substitutes for the AAP tool.

**Preferred path:** obtain a license, or independently derive and validate a clinically justified implementation from permissible sources with legal review.

**Expected decision:** `LEGAL_REVIEW_REQUIRED` or `PERMISSION_REQUIRED`.

### Example C — Pediatric eGFR equation

A peer-reviewed study publishes an equation and coefficients.

**Permitted pattern:** independently encode the equation, cite it, capture calibration population and assay assumptions, and validate it.

**Additional checks:** patents, branded name, transition-age validity, source access terms, and whether coefficients came from a proprietary dataset.

**Expected decision:** commonly `CLEARED_FACTS_ONLY`, but never automatic.

### Example D — CC BY article figure

An article-level CC BY 4.0 license applies to the figure and contains no credited third-party material.

**Permitted pattern:** reuse or adapt commercially with required attribution, license reference, and indication of changes.

**Expected decision:** `CLEARED_OPEN_LICENSE`.

### Example E — CC BY-NC clinical table

The table is covered by CC BY-NC and the product is paid commercial SaaS.

**Expected decision:** `PERMISSION_REQUIRED`; attribution alone is insufficient.

### Example F — PMC author manuscript

An article is freely readable in PMC but has no reuse license.

**Permitted pattern:** read and extract independently worded factual claims as otherwise lawful.

**Do not:** assume the article text, tables, or figures can be commercially redistributed.

**Expected decision:** facts-only assessment or `LEGAL_REVIEW_REQUIRED`, not open-license clearance.

### Example G — U.S. federal guidance

A CDC-authored page contains original federal text plus a third-party chart.

**Permitted pattern:** reuse the federal text or facts subject to verification and attribution practices.

**Do not:** reuse the third-party chart without checking its separate notice; do not use agency seals deceptively.

### Example H — Proprietary questionnaire

A screening instrument has publicly visible questions but requires an electronic-use license.

**Expected decision:** `PERMISSION_REQUIRED`. Do not rewrite questions lightly and assume independence; test items and arrangement may be protected.

### Example I — Local laboratory reference intervals

A health-system partner provides local ranges under a data-use agreement.

**Permitted pattern:** use only for the contractually approved site or study, with access controls and provenance.

**Do not:** generalize or redistribute the range set to other customers without explicit rights.

**Expected decision:** `LOCAL_VALIDATION_ONLY` or permission-scoped clearance.

### Example J — Research agent bulk retrieval

An agent can technically download thousands of articles from a subscription website.

**Expected decision:** prohibited unless the provider expressly authorizes automated retrieval, storage, and intended reuse. Technical capability is not permission.

---

## 18. Rights-aware evidence authoring

### 18.1 Shippable evidence atom

A shippable atom should contain:

- original factual paraphrase;
- source citation and locator;
- population, method, and limitations;
- no long source text;
- rights clearance status;
- source-component classification;
- product uses approved;
- attribution requirements;
- no protected visual content.

### 18.2 Shippable rule explanation

A product explanation should:

- state what the tool observed;
- state what rule fired;
- state the clinical reason in original language;
- cite the supporting source;
- state scope and limitations;
- avoid copying guideline recommendation text;
- avoid implying source endorsement;
- expose enough basis for clinician review without redistributing the source product.

### 18.3 Internal source excerpts

Internal excerpts should:

- be minimal and purpose-limited;
- include exact locator and access context;
- remain in controlled zones;
- not be automatically propagated into user-facing content;
- follow license and contract limits;
- be deleted or restricted when access terminates if required.

---

## 19. Rights failures and research failures

Rights limitations must create structured failure records. Recommended failure codes:

- `LICENSE_UNKNOWN`
- `ARTICLE_LEVEL_LICENSE_UNVERIFIED`
- `CONTRACT_PROHIBITS_INCORPORATION`
- `COMMERCIAL_USE_NOT_GRANTED`
- `NO_DERIVATIVES_RESTRICTION`
- `PERMISSION_REQUIRED_NOT_OBTAINED`
- `PERMISSION_EXPIRED`
- `THIRD_PARTY_COMPONENT_RIGHTS_UNKNOWN`
- `SUBSTANTIAL_COMPILATION_RISK`
- `DATABASE_RIGHT_RISK`
- `PATENT_REVIEW_REQUIRED`
- `TRADEMARK_OR_ENDORSEMENT_RISK`
- `QUESTIONNAIRE_LICENSE_REQUIRED`
- `CONFIDENTIAL_OR_DUA_RESTRICTED`
- `AUTOMATED_RETRIEVAL_NOT_AUTHORIZED`
- `MODEL_TRAINING_RIGHTS_UNCLEAR`
- `FAIR_USE_COUNSEL_REVIEW_REQUIRED`
- `NO_SHIPPABLE_SOURCE_PATH`

A rights failure should record:

- affected source and component;
- intended use;
- source terms and locator;
- safe residual use;
- product impact;
- alternative sources;
- permission strategy;
- owner;
- retry trigger;
- release block status.

---

## 20. Release governance

### 20.1 Required release manifest

Every commercial knowledge release must include a rights-clearance manifest listing:

- release ID and product version;
- all source IDs;
- rights-record IDs;
- reuse-assessment IDs;
- permission-record IDs;
- license notices;
- attribution output;
- open and resolved rights failures;
- counsel decisions;
- expiration dates;
- source and terms snapshots;
- automated validation results.

### 20.2 Automated release gates

The build must fail when:

- a shipped atom or rule lacks a rights assessment;
- clearance is `UNKNOWN`, `INTERNAL_ONLY`, `CONTRACT_RESTRICTED`, `PERMISSION_REQUIRED`, or `PROHIBITED`;
- a required permission has expired;
- an open critical rights failure exists;
- a required notice or attribution is missing;
- an output contains a prohibited source excerpt, image, table, or brand asset;
- the product use exceeds the recorded license scope;
- the product territory or channel is not covered.

### 20.3 Human signoff

At minimum:

- evidence owner approves scientific provenance;
- clinical owner approves interpretation and safety;
- rights owner approves the reuse assessment;
- counsel approves escalated legal issues;
- release manager confirms the manifest and notices.

### 20.4 Surveillance

Monitor:

- source corrections and retractions;
- guideline supersession;
- terms-of-use changes;
- license changes;
- permission renewal;
- partner or DUA termination;
- patent status where relevant;
- new jurisdictions;
- product commercialization changes;
- new patient-facing uses.

---

## 21. Recommended product and sourcing strategy

### 21.1 Build independent clinical intellectual property

The strongest long-term strategy is not to copy proprietary knowledge products. It is to create a defensible evidence-to-executable system that:

- synthesizes primary evidence;
- records conflicts and uncertainty;
- produces independently authored rules;
- validates local ranges and implementation behavior;
- generates original longitudinal and workflow logic;
- maintains auditable provenance and rights clearance;
- creates original clinical-validation datasets and publications.

### 21.2 License selectively

Licensing is appropriate when:

- a society’s complete table or algorithm is clinically decisive;
- exact fidelity to an authoritative implementation is safer than independent reconstruction;
- patient handouts or questionnaires are required;
- brand association materially increases trust or procurement value;
- licensing costs less than independent evidence synthesis and validation;
- the rights holder offers ongoing updates, warranties, or integration support.

### 21.3 Prefer source substitutability

For every key rule, track whether an alternative evidence basis exists. Avoid a product architecture where one proprietary source can revoke the core knowledge base.

### 21.4 Original research as a rights and moat strategy

Where evidence or rights are weak, conduct independent retrospective and prospective validation. Original data and independently authored clinical logic can improve:

- clinical validity;
- portability;
- product differentiation;
- acquisition value;
- freedom to operate;
- defensibility against simple content replication.

---

## 22. Minimum agent checklist

Before using any source-derived content, answer:

1. What is the exact source and version?
2. How was it accessed?
3. What license and contract apply?
4. What exact component is being used?
5. Is it fact, method, expression, compilation, instrument, code, data, image, or brand?
6. What is the intended internal or external use?
7. Is the product commercial?
8. Is the output independently authored?
9. Does it reproduce the source’s selection, labels, sequence, or arrangement?
10. Does the use substitute for the source product?
11. Are patents, trademarks, database rights, privacy, or confidentiality relevant?
12. Is article-level commercial reuse explicitly allowed?
13. Are attribution, notice, and change-marking obligations satisfied?
14. Is a permission record required and active?
15. Is the rights status green for this specific release?

If any answer is unknown, the external release is blocked.

---

## 23. Implementation roadmap

### Phase 1 — Schema and policy integration

- Add `rights_record`, `content_reuse_assessment`, and `permission_record` schemas.
- Add `extensions.rights` to source, evidence-atom, and candidate-rule records.
- Add rights failure codes.
- Establish controlled source zones.
- Create automated release validation.

### Phase 2 — Backfill

- Inventory all existing anemia sources.
- Verify article-level licenses and access paths.
- classify source components used by current rules.
- Create facts-only, open-license, permission-required, and blocked cohorts.
- Remove or quarantine copied or uncertain content.
- Identify AAP-dependent rule families.

### Phase 3 — Rights-aware research automation

- Add license discovery and terms snapshotting.
- Add content-component classification.
- Add permission and expiry monitoring.
- Add alternative-source discovery when a source is restricted.
- Prevent restricted content from entering prompts for user-facing generation.

### Phase 4 — Counsel and licensing program

- Develop a standard legal review packet.
- Prioritize licenses for high-value AAP, questionnaire, dataset, and patient-education content.
- Create standard rights-holder outreach templates.
- Negotiate update, API, EHR, and commercial redistribution rights where valuable.

### Phase 5 — Continuous governance

- Monitor terms, licenses, permissions, and product-use changes.
- Include rights review in evidence surveillance and signed release.
- Audit a sample of released atoms and rules each quarter.
- Track rights debt as a product-risk metric.

---

## 24. Acceptance criteria

This specification is implemented when:

- every source used by a candidate rule has a rights record;
- every externally shipped component has a use-specific reuse assessment;
- every affirmative permission is stored as a permission record;
- release builds block unresolved rights statuses;
- copied source content is technically prevented from reaching runtime packages;
- article-level licenses and access terms are snapshotted;
- agents follow authorized retrieval paths;
- rights failures are reportable and auditable;
- AAP and other proprietary-source dependencies are explicit;
- the product can generate a complete rights-clearance manifest for any release;
- clinical, evidence, rights, and regulatory approvals remain distinct.

---

## Appendix A — Reference rights-record example for AAP subscription content

```json
{
  "schema_version": "1.0.0",
  "rights_record_id": "RR-SRC-AAP-PCO-001",
  "source_id": "SRC-AAP-PCO-001",
  "record_scope": "source_and_access_context",
  "jurisdictions": ["US"],
  "access": {
    "basis": "institutional_subscription",
    "platform": "AAP Pediatric Care Online",
    "terms_url": "https://publications.aap.org/pediatriccare/pages/terms",
    "terms_verified_at": "2026-07-21T12:00:00Z",
    "automated_retrieval_allowed": "unknown"
  },
  "copyright": {
    "status": "copyrighted",
    "rights_holder": "American Academy of Pediatrics",
    "publication_license": "traditional_copyright"
  },
  "contract": {
    "incorporation_into_other_products": "restricted_without_written_approval",
    "adaptation": "restricted_without_written_approval",
    "redistribution": "restricted",
    "commercial_use": "not_granted_by_subscription"
  },
  "component_decisions": [
    {
      "component_type": "bibliographic_metadata",
      "decision": "permitted"
    },
    {
      "component_type": "atomic_facts_and_methods",
      "decision": "facts_only_subject_to_access_contract_and_legal_review"
    },
    {
      "component_type": "prose",
      "decision": "permission_required"
    },
    {
      "component_type": "tables_figures_algorithms",
      "decision": "permission_required"
    },
    {
      "component_type": "trademarks_and_logos",
      "decision": "prohibited_without_authorization"
    }
  ],
  "overall_status": "CONTRACT_RESTRICTED",
  "safe_residual_uses": [
    "internal_research",
    "citation_metadata",
    "alternative_primary_source_discovery"
  ],
  "recommended_action": "Use primary or openly licensed evidence for independently authored rules; request AAP EHR/CDS permission when AAP content itself must be incorporated.",
  "review": {
    "reviewed_at": "2026-07-21T12:00:00Z",
    "review_status": "legal_review_required_before_commercial_use"
  }
}
```

---

## Appendix B — Authoritative source register

**[S1]** U.S. Copyright Office, *Title 17, Chapter 1*, §§ 102, 103, 105. Verified 2026-07-21.  
https://www.copyright.gov/title17/92chap1.html  
*[Amendment 2026-07-21, EPR5-T4, per FR-WP5-06.]* Section coverage extended from §§102–103 to include
§105: the §105 citation previously carried under a separate entry, [S14], pointed at this identical
URL. Citing the same chapter page under two source numbers for different subsections overstated it as
two independently identified sources rather than one page consulted for three sections. [S14] is
retired below and folded into this entry; see Appendix D.

**[S2]** U.S. Copyright Office, *What Does Copyright Protect?* Verified 2026-07-21.  
https://www.copyright.gov/help/faq/faq-protect.html

**[S3]** U.S. Copyright Office, *Automated Databases*. Verified 2026-07-21.  
https://www.copyright.gov/register/tx-databases.html

**[S4]** U.S. Copyright Office, *More Information on Fair Use* and 17 U.S.C. § 107. Verified 2026-07-21.  
https://www.copyright.gov/fair-use/more-info.html  
https://www.copyright.gov/title17/92chap1.html

**[S5]** American Academy of Pediatrics, *Pediatric Care Online Terms and Conditions*. Verified 2026-07-21.  
https://publications.aap.org/pediatriccare/pages/terms

**[S6]** American Academy of Pediatrics, *Licensing and Permissions*. Verified 2026-07-21.  
https://publications.aap.org/pages/licensing-permissions

**[S7]** American Academy of Pediatrics, *Pediatrics Author Instructions: Figures, Tables, and Supplementary Material*. Verified 2026-07-21.  
https://publications.aap.org/pediatrics/pages/author-instructions  
*[Amendment 2026-07-21, EPR5-T4, per FR-WP5-06.]* Now cited from the body at §16.3 (previously
defined here but never cited).

**Automated-retrieval note on [S5]/[S6]/[S7]** *[Amendment 2026-07-21, EPR5-T4, per FR-WP5-06.]* All
three `publications.aap.org` URLs above return HTTP 403 Forbidden to automated/scripted clients
(confirmed by direct fetch during this amendment, consistent with the review finding). A human
browser session can reach the pages; an automated agent cannot. The "Verified 2026-07-21" stamps on
[S5], [S6], and [S7] therefore record a human verification and are **not machine-reproducible** — an
agent re-running this citation set will see a 403, not confirmation, and must not treat that 403 as
evidence the source changed or went away. This is mildly ironic given §8.2's ban on unapproved
automated retrieval, and is recorded here rather than silently left implicit.

**[S8]** Creative Commons, *Attribution 4.0 International*. Verified 2026-07-21.  
https://creativecommons.org/licenses/by/4.0/

**[S9]** Creative Commons, *Attribution-NonCommercial 4.0 International*. Verified 2026-07-21.  
https://creativecommons.org/licenses/by-nc/4.0/

**[S10]** National Library of Medicine, *PMC Copyright Notice* and *PMC Open Access Subset*. Verified 2026-07-21.  
https://pmc.ncbi.nlm.nih.gov/about/copyright/  
https://pmc.ncbi.nlm.nih.gov/tools/openftlist/

**[S11]** U.S. Patent and Trademark Office, *What Is a Trademark?* (Trademark Basics: Learning the
Essentials). Verified 2026-07-21.  
https://www.uspto.gov/trademarks/basics/what-trademark  
*[Amendment 2026-07-21, EPR5-T4, per FR-WP5-06.]* Pin-cite corrected: previously pointed at the
`/trademarks/basics` section landing page, one page up from the specific page that states a trademark
"identifies your goods or services" and discusses logos/branding distinguishing a business in the
marketplace — the actual textual basis for §3.9's citation.

**[S12]** U.S. Patent and Trademark Office, *Patent Essentials*. Verified 2026-07-21.  
https://www.uspto.gov/patents/basics/essentials

**[S13]** EUR-Lex, *Directive 96/9/EC of the European Parliament and of the Council of 11 March 1996 on
the legal protection of databases* — ELI permalink. Verified 2026-07-21.  
https://eur-lex.europa.eu/eli/dir/1996/9/oj/eng  
*[Amendment 2026-07-21, EPR5-T4, per FR-WP5-06.]* Replaced the prior `legal-content/.../LSU/?uri=CELEX:...`
URL, which returns a bot challenge to automated clients, with the European Legislation Identifier
(ELI) permalink — a stable, canonical identifier for the same instrument that resolves cleanly.

**[S14]** *Retired — folded into [S1].* *[Amendment 2026-07-21, EPR5-T4, per FR-WP5-06.]* Previously:
U.S. Copyright Office, 17 U.S.C. § 105, *United States Government Works*, at
`https://www.copyright.gov/title17/92chap1.html` — the identical URL already cited as [S1]. Retained
here as a numbering placeholder, not deleted silently, so a reader following an existing [S14]
reference elsewhere is redirected rather than met with a gap; see [S1] and Appendix D. No text in this
document cites [S14] after this amendment.

**[S15]** U.S. Food and Drug Administration, *Clinical Decision Support Software: Final Guidance*,
re-issued January 29, 2026 (docket FDA-2017-D-6569, CDRH GUI01400062). Verified 2026-07-21.  
https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software  
*[Amendment 2026-07-21, EPR5-T4, per FR-WP5-06.]* Date pinned to the exact re-issue date per the
review finding: FDA issued a revised final CDS guidance on 2026-01-06, superseded five days later by
a further re-issue on 2026-01-29, which is the controlling version. `fda.gov` returns a spurious 404 to
automated fetchers (bot-blocking, not a dead link); the "Verified" stamp reflects human verification
against the guidance PDF cover page, the FDA guidance-database entry, an FDA CDRH town hall transcript,
and three independent law-firm analyses, not an automated fetch of this URL.

**Case law** — added [Amendment 2026-07-21, EPR5-T2, per FR-WP5-02]. These are judicial authorities,
not verified web sources; they are transcribed from
`.claude/findings/rights-governance-spec-v1.0-review-findings.md` (review determination at commit
`cd15b4a`), not reconstructed from memory, and no "Verified" date applies to case citations the way it
does to [S1]–[S15]'s URLs. See Appendix D for the full rationale; each is also cited from the body at
the section noted below.

**[S16]** *Feist Publications v. Rural Telephone Service*, 499 U.S. 340 (1991). Controlling U.S.
Supreme Court authority for the fact/expression (originality) distinction underlying §3.1's
facts-are-not-copyrightable framing. Cited from the body at §3.1.

**[S17]** *CCC Information Services v. Maclean Hunter Market Reports*, 44 F.3d 61 (2d Cir. 1994). Held
that used-car valuations reflecting the editors' predictions and professional judgment were protected
expression, not facts, in a commercial-database context — the authority for §15's measured-vs-judged
routing split. Cited from the body at §3.2 and §15.

**[S18]** *ADA v. Delta Dental Plans Ass'n*, 126 F.3d 977 (7th Cir. 1997). Held a coding taxonomy
(numbering plus short descriptions) copyrightable. Cited from the body at §3.2.

---

## Appendix C — Interpretation cautions

- This specification primarily reflects U.S. law and conservative product governance.
- Contract enforceability, fair use, patent scope, trademark use, and database rights are fact- and jurisdiction-specific.
- A source’s terms can change; the snapshot governing actual access matters.
- A license may exclude third-party figures, tables, supplements, datasets, or instruments.
- Medical knowledge reuse does not establish clinical validity or regulatory compliance.
- Legal clearance does not establish that a rule is clinically correct, safe, or appropriately validated.
- Clinical authority does not establish product reuse rights.

---

## Appendix D — Amendment log (Phase EP-R5, declared local amendments)

This document is a vendored copy of the reviewed spec bundle: it is checksummed at vendoring time in
`docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/checksums.sha256` and that
checksum is recorded in `schemas/rights/VENDORING.md` (`EPR0-T2` provenance record) alongside the
bundle's vendored schemas. Every edit made to this file after vendoring is a **declared amendment**,
recorded below with a date, task ID, section touched, and rationale — **never a silent edit**. As of
the first entry below, this file's SHA-256 no longer matches the value recorded in `checksums.sha256`;
that divergence is expected and is exactly what "declared amendment" means (the same convention
`schemas/rights/VENDORING.md` uses for the vendored schema files).

Every amendment entry below draws solely on
`.claude/findings/rights-governance-spec-v1.0-review-findings.md` (the review determination recorded
at commit `cd15b4a`) for its facts and citations. Per the phase's standing constraint, case law is
cited here as the reason a data model needs a particular axis — **never** as a determination of how
any specific item, source, or threshold should be classified. This log draws no legal conclusion and
states none.

- **2026-07-21 — EPR5-T1 (FR-WP5-01), §15 decision matrix.** Split the single "Encode a reported
  numeric threshold → Facts-only candidate" row into two rows, distinguishing what §15 previously
  treated as one case:
  - a **measured/observed value** from a primary study (e.g., a cohort's reported sensitivity or
    specificity at a stated cutoff) — routing unchanged: *Facts-only candidate*, subject to the
    existing conditions (preserve population/assay limits; assess contract and compilation
    dependence);
  - a **consensus/judgment-derived recommendation** (e.g., a guideline committee's threshold, cutoff,
    or scoring recommendation) — now routes to **`LEGAL_REVIEW_REQUIRED`** (§6) rather than
    Facts-only candidate.

  **Rationale.** The published spec never cited *CCC Information Services, Inc. v. Maclean Hunter
  Market Reports, Inc.*, 44 F.3d 61 (2d Cir. 1994), which held that used-car valuations reflecting the
  editors' predictions and professional judgment were **protected expression, not facts** — in a
  commercial-database context. A guideline consensus cutoff is a committee's professional judgment,
  which is exactly the fact pattern *CCC* found protectable; a measured value from a primary study is
  close to the strong end of the facts argument instead. Treating both under a single "Facts-only
  candidate" disposition, as originally published, understated the exposure of the judgment-derived
  case. *Feist*, *CCC*, and *ADA* are added to Appendix B, and cited from the body, by **EPR5-T2**
  (not by this entry — EPR5-T1's scope is the §15 routing split only).

  **Scope of this amendment — what it does *not* do.** This amendment states a routing *rule*
  (judgment-derived → `LEGAL_REVIEW_REQUIRED`; measured → unchanged). It makes **no determination**
  about how any specific existing or future threshold family should be classified as measured or
  judged. That determination is a case-by-case legal question and remains open question **OQ-1**
  (`.claude/worknotes/rights-aware-evidence-capture/decisions-block.md` §6 "Open questions"; also
  tracked in the plan's Quality Gates table,
  `docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md`), which
  routes to counsel and is explicitly **not closable by this phase or by any agent**. No item in this
  project's knowledge base is reclassified, reassessed, or assigned `judgment_basis` by this
  amendment; every item continues to carry `judgment_basis: unassessed` until OQ-1 is answered.

- **2026-07-21 — EPR5-T2 (FR-WP5-02), Appendix B and citing sections.** Added three case-law
  authorities to Appendix B's new "Case law" subsection — [S16] *Feist Publications v. Rural
  Telephone Service*, 499 U.S. 340 (1991); [S17] *CCC Information Services v. Maclean Hunter Market
  Reports*, 44 F.3d 61 (2d Cir. 1994); [S18] *ADA v. Delta Dental Plans Ass'n*, 126 F.3d 977 (7th Cir.
  1997) — and cited each from the body, not merely listed in the appendix:
  - [S16] *Feist* is cited at §3.1, as the controlling authority for the fact/expression (originality)
    distinction that §3.1 already stated without a case citation.
  - [S17] *CCC* is cited at §3.2 (compilation/taxonomy risk discussion) and at §15 (the amendment
    note EPR5-T1 added, which named the case in prose in Appendix D but not in the visible §15 body
    text until this entry).
  - [S18] *ADA* is cited at §3.2 (taxonomy/compilation risk discussion), as the authority for a coding
    taxonomy (numbering plus short descriptions) being independently copyrightable.

  **Rationale.** FR-WP5-02 and the review findings (`.claude/findings/rights-governance-spec-v1.0-review-findings.md`
  §2.A) identify all three cases as omitted from the originally published spec despite being directly
  relevant to the fact/expression and compilation-risk analysis the spec's operational guidance
  depends on. All three citations are transcribed verbatim from the review findings document and the
  phase task table (`docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1/phase-r5-spec-amendments.md`,
  EPR5-T2 row), not reconstructed from memory.

  **Scope of this amendment — what it does *not* do.** This amendment adds citations only. It draws no
  legal conclusion about any specific source, threshold, taxonomy, or compilation in this project's
  knowledge base, and reclassifies nothing. §3.7's works/funded-works conflation, §16.2's contract
  caveat placement, and §3.2's EU sui generis scoping are **not** addressed by this entry — they are
  **EPR5-T3**'s scope (FR-WP5-03/04/05), sequenced after this task. The six citation-hygiene items
  ([S7], [S1]/[S14] overload, [S11] pin-cite, [S13] permalink, [S5]/[S6]/[S7] 403 annotation, [S15]
  date pin) are **EPR5-T4**'s scope (FR-WP5-06), also not addressed here.

- **2026-07-21 — EPR5-T3 (FR-WP5-03/04/05), §3.7, §16.2, §3.2 corrections.** Three independent
  corrections, each drawn from review findings §2.B–§2.D:

  - **§3.7 (FR-WP5-03) — government works vs. government-*funded* works.** The published §3.7 stated
    that "works of the United States Government" are generally uncopyrightable under 17 U.S.C. § 105
    and moved directly to operational consequences, without distinguishing a work *authored* by a
    federal officer or employee (§105 — uncopyrightable) from a work merely *funded* by federal money
    (ordinary copyright applies to the authoring institution). Added a sentence drawing that line
    explicitly and a new operational-consequence bullet naming **the PMC trap**: NIH-funded articles by
    university-affiliated authors are copyrighted, not §105 government works, and are abundant in
    exactly the PubMed Central corpus this project searches (§3.5) — a live risk, not a hypothetical
    one, for a research agent that treats "government-funded" or "found via a `.gov`-adjacent portal"
    as a proxy for "public domain."
  - **§16.2 (FR-WP5-04) — re-attach §16.1's contract caveat inline.** §16.1 correctly states the AAP
    subscription bars incorporating the licensed Materials into other materials absent separate written
    approval. The published §16.2 then listed "state independently worded clinical facts or
    recommendations" and similar items as often usable, without re-stating that caveat — inviting a
    reader to treat re-wording as sufficient on its own. Added an inline "Contract caveat" paragraph
    stating that re-wording does not defeat a contractual incorporation prohibition when the item was
    extracted from, or tracks the selection/organization of, the AAP-licensed Materials, and that
    copyright and contract are separate questions (§3.3). The caveat is now inline in §16.2, not reached
    only by a reader who separately visits §16.1 or §3.3.
  - **§3.2 (FR-WP5-05) — scope the EU sui generis database-right discussion.** The published §3.2 stated
    the EU sui generis database right (Directive 96/9/EC Art. 7(1)) without territorial scoping or the
    creation-vs-obtaining carve-out, which read as an unconditional discouragement of a viable path (a
    laboratory generating its own reference intervals). Added two qualifications: **territorial
    scoping** (an EU/EEA instrument that does not attach to a US-only product's US operations on its own
    terms), and the **creation-vs-obtaining carve-out** established by the Court of Justice of the
    European Union in *The British Horseracing Board Ltd and Others v William Hill Organization Ltd*,
    Case C-203/02, [2004] ECR I-10415 (9 November 2004), and *Fixtures Marketing Ltd v Organismos
    Prognostikon Agonon Podosfairou AE (OPAP)*, Case C-444/02 (9 November 2004) — both part of the same
    Grand Chamber judgment day restricting sui generis protection to investment in *obtaining*,
    verifying, and presenting data, excluding investment in *creating* it.

  **Rationale.** All three items are identified in the review findings
  (`.claude/findings/rights-governance-spec-v1.0-review-findings.md` §2.B "§3.7 conflates government
  *works* with government-*funded* works", §2.C "EU sui generis database right is overstated as
  applied", §2.D "§16.2 drops its own contract caveat") as material or moderate defects in the
  originally published spec's operational guidance. The two CJEU case citations (Case numbers, court,
  and judgment date) were independently verified against public case-reporting sources during this
  amendment because the findings document names the cases but does not carry their case numbers; no
  other fact in this entry required verification, since every other figure and citation is transcribed
  from the findings document or the phase task table
  (`docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1/phase-r5-spec-amendments.md`,
  EPR5-T3 row).

  **Scope of this amendment — what it does *not* do.** This amendment corrects the three named passages
  only. It draws no legal conclusion about any specific source, article, laboratory dataset, or AAP-
  derived item in this project's knowledge base — it states the applicable legal *frameworks* (the
  works/funded-works line, the contract/copyright separation, the EU creation/obtaining line), not a
  determination of which side of any line a specific item falls on. No PMC article, no AAP-derived
  content item, and no locally generated reference-interval dataset is reclassified, cleared, or
  assigned a rights disposition by this entry. The six citation-hygiene items ([S7], [S1]/[S14]
  overload, [S11] pin-cite, [S13] permalink, [S5]/[S6]/[S7] 403 annotation, [S15] date pin) remain
  **EPR5-T4**'s scope (FR-WP5-06), not addressed here.

- **2026-07-21 — EPR5-T4 (FR-WP5-06), citation hygiene.** Per the review findings §2.E ("Minor
  citation hygiene"), resolved all six items the finding named. **The review found no fabricated
  citations anywhere in the source register — all 15 originally published sources ([S1]–[S15]) were
  independently checked and hold up (findings §1).** This entry is refinement of a clean register, not
  a fabrication remediation; a future reader should not infer a fabrication problem from the volume of
  changes below.

  1. **[S7] cited, not removed.** [S7] (AAP *Pediatrics Author Instructions: Figures, Tables, and
     Supplementary Material*) was defined in Appendix B but never cited from the body. It is a real,
     independently-checked source (findings §1), so it is cited, not deleted: added to §16.3's bullet
     on AAP figures/tables/charts/nomograms, where it is directly on point — AAP's own author
     instructions for exactly that content class.
  2. **[S1]/[S14] de-overloaded.** [S1] (Title 17, Chapter 1) and [S14] (17 U.S.C. §105) cited the
     identical URL (`copyright.gov/title17/92chap1.html`) under two different source numbers for
     different subsections, presenting one page as two independently identified authorities. [S14] is
     retired (Appendix B entry kept as a redirect placeholder, not deleted, so an existing [S14]
     cross-reference is not silently orphaned) and folded into [S1], whose section coverage is
     extended from §§102–103 to §§102, 103, 105. §3.7's body citation, previously [S14], now reads
     [S1].
  3. **[S11] pin-cite corrected.** [S11] pointed at the `/trademarks/basics` section landing page.
     Verified by direct fetch during this amendment: the specific page stating a trademark "identifies
     your goods or services" — the textual basis for §3.9's citation — is one page deeper, at
     `/trademarks/basics/what-trademark`. Corrected the URL to that page.
  4. **[S13] uses the ELI permalink.** [S13]'s prior EUR-Lex `legal-content/.../LSU/?uri=CELEX:...` URL
     returns a bot challenge to automated clients. Verified by direct fetch during this amendment: the
     European Legislation Identifier (ELI) permalink for the same instrument,
     `https://eur-lex.europa.eu/eli/dir/1996/9/oj/eng`, is stable and resolves cleanly. Swapped to it.
  5. **[S5]/[S6]/[S7] 403 annotated.** Verified by direct fetch during this amendment: all three
     `publications.aap.org` URLs return HTTP 403 Forbidden to automated clients, confirming the review
     finding. Added an Appendix B note stating this explicitly, so the "Verified 2026-07-21" stamps on
     these three entries are understood as human-only verification, not machine-reproducible — a
     re-running agent will see a 403 and must not read it as evidence the source moved or lapsed.
  6. **[S15] date pinned.** Per findings §1's [S15] check, pinned the FDA CDS guidance citation to its
     exact controlling date, **January 29, 2026** (re-issue of docket FDA-2017-D-6569,
     CDRH GUI01400062, superseding the 2026-01-06 version, itself superseding the September 2022 final
     guidance) — in both the Appendix B entry and the §3.11 body citation.

  **Rationale.** All six items and their resolutions are named in
  `.claude/findings/rights-governance-spec-v1.0-review-findings.md` §2.E and the phase task table
  (`docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1/phase-r5-spec-amendments.md`,
  EPR5-T4 row). The specific corrected URLs for [S11] and [S13], the 403 status of [S5]/[S6]/[S7], and
  the exact FDA re-issue framing for [S15] were independently verified by direct fetch during this
  amendment, since the finding names the defect but not always the corrected value; every fact drawn
  directly from the finding is used as published, not reconstructed from memory.

  **Scope of this amendment — what it does *not* do.** This amendment is citation hygiene only. It
  adds, retires, or repoints source-register entries and their in-body citation markers; it draws no
  legal conclusion about any specific source, threshold, taxonomy, or compilation in this project's
  knowledge base, reclassifies nothing, and clears nothing. No item in this project's knowledge base is
  reclassified, reassessed, or assigned a rights disposition by this amendment. OQ-1 stays open. This
  is the final task-level amendment of Phase EP-R5's spec-amendment set; EPR5-T5–T7 touch other files
  (`CLAUDE.md`, `NOTICE.md`, `docs/architecture.md`), not this document.
