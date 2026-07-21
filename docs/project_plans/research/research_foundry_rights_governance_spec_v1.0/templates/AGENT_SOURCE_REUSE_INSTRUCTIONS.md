# Agent Source Reuse Instructions

Use these instructions whenever a task involves discovering, reading, extracting, summarizing, encoding, displaying, training on, or shipping third-party content.

## Non-negotiable rules

1. **Evidence quality and reuse rights are separate.** Assess both.
2. **Citation is not permission.** Attribution does not grant reuse rights.
3. **Access is not ownership.** A subscription or purchased PDF grants only the documented license.
4. **Free to read is not necessarily free to reuse.** Verify the item-level license.
5. **Facts and methods may often be independently used; expression and compilations may be protected.** Never treat this as automatic clearance.
6. **Contracts can restrict extraction or incorporation even when the underlying fact is not copyrighted.** Record the access context.
7. **Do not copy prose, tables, figures, nomograms, questionnaires, algorithms, or patient materials without a compatible license or permission.**
8. **Do not bypass paywalls, scrape contrary to terms, share credentials, or bulk-download through unauthorized methods.**
9. **Do not use logos or endorsement language without authorization.**
10. **Unknown rights block commercial release.**

## Required process

For every source used in a candidate rule or shipped output:

1. Resolve exact source, edition/version, identifiers, correction status, and owner.
2. Record access basis and applicable terms.
3. Verify article/item-level license and third-party exclusions.
4. Classify the component: metadata, fact, method, equation, prose, table, figure, algorithm, instrument, dataset, code, image, or brand.
5. Specify intended use: internal, evidence extraction, runtime logic, user-facing explanation, patient-facing, marketing, TDM, model training, or partner distribution.
6. Check copyright, contract, patent, trademark, database, privacy, confidentiality, and DUA constraints.
7. Prefer public-domain, CC BY, primary-study, or independently validated sources.
8. Write original factual paraphrases and original product logic.
9. Create or link a `rights_record`.
10. Create a `content_reuse_assessment` for every externally shipped component.
11. Create a `permission_record` for affirmative grants.
12. Create a `rights_failure` when use is blocked, ambiguous, or incomplete.
13. Apply the release gate.

## Automatic release blockers

Block shipment when any of the following is true:

- article-level license is unverified;
- rights status is `UNKNOWN`;
- the access agreement restricts intended incorporation or commercial use;
- permission is required and inactive;
- a no-derivatives or noncommercial license conflicts with intended use;
- output copies source wording, visual expression, or substantial arrangement;
- compilation similarity or market substitution risk is high;
- patent, questionnaire, trademark, database, privacy, or confidentiality review is unresolved;
- required attribution or notices cannot be satisfied;
- permission has expired;
- source was obtained by prohibited means.

## Preferred safe pattern

- Extract atomic facts with locators.
- Use primary or openly licensed evidence where possible.
- Author rules and explanations independently.
- Separate source reviewer from rule author for high-risk content.
- Preserve clinical scope, assay, population, and limitation metadata.
- Display a citation rather than a copied source excerpt.
- Seek a direct commercial/EHR license when the source’s complete table, instrument, graphic, or curated structure is clinically necessary.

## AAP-specific default

AAP Pediatric Care Online may be used according to its subscription terms for clinical access and research. Do not assume the subscription grants commercial incorporation, adaptation, redistribution, bulk extraction, or use of AAP tables, figures, algorithms, forms, handouts, or branding. Prefer primary sources and original rule authoring. Use AAP’s licensing channel when AAP content itself must be integrated.

## Output requirement

Every agent answer that proposes source-derived product content must include:

- source IDs;
- rights status;
- safe shippable content;
- blocked content;
- required attribution;
- permission or legal-review needs;
- alternative-source strategy;
- release gate.
