---
status: proposed
date: 2026-07-21
deciders: ["evidence-foundry-buildout plan owner", "pending: named clinical/technical reviewers"]
unblocks: ["DF-E1-05"]
supersedes: []
superseded_by: []
---

# ADR-0002: Exact-Passage Storage, Licensing, and Reviewer Access

## Status

**Proposed** — 2026-07-21. Not accepted. No implementation decision follows from this document until
a human reviewer moves status to `accepted` in a separate, reviewable edit.

## Context

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` (`02 §8.5` item 2, `02 §8.1`
row "How are exact passages stored under copyright constraints?") flags an open design question: the
evidence-to-rule pipeline requires that "a rule cannot become release-ready if an independent reviewer
cannot inspect the passage" (`02 §4.10`), but the source articles the converter draws from are almost
always copyrighted journal content, not public-domain text this repository can commit verbatim.

This is not hypothetical for this plan — it is the actual, already-encountered disposition of the one
fixture bundle this plan ships:

1. **P1-T6's fixture rights disposition (worked example).** The `RF-CBC-001` fixture committed at
   `tests/fixtures/rf-cbc-001/` carries a hash-provenance note
   (`tests/fixtures/rf-cbc-001/HASH-PROVENANCE.md`) documenting that **every one of its 12 source
   cards** (Elsevier, Wiley, Oxford University Press/AJCP, AAP, ASH, MDPI, and others) carries the
   identical `usage` block `{allowed_for_public_output: false, allowed_for_work_output: true,
   allowed_for_personal_meatywiki: true, citation_required: true, quote_limit_notes: "Short excerpts
   only."}`. Per that block, **0 of the fixture's 74 extracted passages are positively confirmed
   rights-clear for verbatim public-repository commit** — the note applies the `02 §4.10`
   rights-restricted fallback uniformly: every verbatim excerpt in every source card and every
   `threshold.passage_locator` embedded quote was replaced by `[redacted — content-rights: restricted
   (usage.allowed_for_public_output=false); sha256:<hash>]`, preserving the human-readable `locator`
   selector (e.g., "Abstract, Methods paragraph (PubMed record, PMID 41565092)") undiminished so that
   addressability survives redaction. This is the disposition this ADR must generalize a policy for,
   not a hypothetical worst case.
2. **P3-T3's rights-restricted fallback mechanism (in flight, specified, not hypothetical).** Per this
   plan's OQ-2/OQ-3 resolutions and `02 §4.10`'s schema, P3-T3 specifies
   `modules/cbc_suite_v1/evidence-assertions.json` with an `exactPassage` field that is `null` (with
   `exactPassageSha256` populated) for any passage not positively confirmed rights-clear, wired into
   `scripts/validate-kb.mjs` so that a record missing `exactPassageSha256` when `exactPassage` is
   `null` fails schema validation — the fallback is enforced structurally, not left to author
   discipline. Given P1-T6's fixture disposition above, this mechanism is expected to fire for **all
   four** slice rules' supporting evidence in Phase 4, not as an edge case.

So the practical question this ADR must resolve is not "should we ever redact" (P1-T6/P3-T3 already
answer that: yes, routinely) but: **what exactly gets stored in place of the withheld text, how does a
credentialed independent reviewer actually inspect the original passage before approving a rule, and
what does "reviewer-accessible source" (`02 §4.10`'s closing requirement) concretely mean when this
repository ships as a public, no-PHI, no-third-party-script microsite** (CLAUDE.md hard guardrail).

## Decision

Adopt the **hash-plus-selector-with-governed-retrieval** model as the storage policy, and defer the
reviewer-access retrieval mechanism itself to E1 (named explicitly, not left silently unaddressed):

1. **Storage (binding for E0, already the shipped behavior)**: `evidence-assertions.json` records
   never store full copyrighted article text. Each record stores:
   - An **immutable SHA-256 hash** of the exact original passage bytes (`exactPassageSha256`),
     computed once at fixture/ingestion time and never recomputed against a mutated source — this is
     the tamper-evidence anchor a reviewer can check the retrieved original against.
   - A **precise selector** (`locator`: page/section/table/paragraph, or the richer human-readable
     form P1-T6 preserved, e.g., "Abstract, Methods paragraph (PubMed record, PMID 41565092)") — enough
     for a human to locate the passage in the original source without this repository reproducing it.
   - `exactPassage` populated with verbatim text **only** when the source's `usage` block positively
     confirms `allowed_for_public_output: true` (or an equivalent explicit repository-commit grant) —
     never by default, never by omission-as-permission. Per P1-T6's actual fixture, this is the
     minority/zero case today, not the common one.
   - A `displayPolicy` field (already in the `02 §4.10` schema) recording which downstream surface, if
     any, may render the passage — distinct from whether the passage is stored at all.
2. **Reviewer access (named, deferred to E1 — this ADR's own boundary)**: the "governed retrieval
   path" `02 §4.10` requires — where a credentialed reviewer can retrieve the actual original text
   corresponding to a hash, e.g., via the source's DOI/URL, an institutional subscription, or a
   controlled internal mirror — is **not implemented by this plan**. E0 ships zero reviewer-facing UI
   of any kind (this plan's decisions block, Phase 1-5 file). This ADR states the requirement and
   names the mechanism as a design target for **DF-E1-01** (clinical review portal/workflow) to solve
   concretely, rather than silently assuming a reviewer will "just look it up" with no supporting
   tooling.

**Recommended default** (restated from `02 §8.1`'s row, adopted with the concrete E0 fixture as
confirmation it is workable): *store permitted short excerpt plus immutable hash/selectors; require a
reviewer-accessible source.* This is Option 3 below for storage, paired with an explicit
not-yet-built retrieval mechanism named as DF-E1-01's problem, not silently left unsolved.

## Considered Alternatives

1. **Store full verbatim article text in the repository** (commit the complete passage regardless of
   licensing).
   - Pros: maximal reviewer convenience — no separate retrieval step; simplest schema (`exactPassage`
     always populated).
   - Cons: directly violates the publishers' `usage.allowed_for_public_output: false` terms P1-T6's
     fixture already surfaces for 12/12 real source cards; this repository is a **public** microsite
     (CLAUDE.md: "No PHI in the public microsite... no third-party scripts/fonts/analytics" — the
     spirit of that guardrail, minimizing what a public artifact exposes, extends naturally to
     copyrighted third-party content); creates unbounded content-rights liability that scales with
     every future module's fixture.
   - Decision: **rejected**.

2. **Store nothing beyond a bare citation** (no hash, no selector — just a bibliographic reference and
   trust the reviewer to relocate the exact passage from the citation alone).
   - Pros: zero content-rights exposure; simplest possible implementation.
   - Cons: fails `02 §4.10`'s hard requirement directly ("a rule cannot become release-ready if an
     independent reviewer cannot inspect the passage") — a bare citation to a 20-page paper gives no
     addressability to the specific sentence a threshold or claim rests on; also loses tamper-evidence
     (no hash means a later edit to the source-of-record cannot be detected as drift from what the
     rule was actually authored against).
   - Decision: **rejected**.

3. **Store immutable hash + precise selector, permitted short excerpt only when rights-confirmed,
   governed reviewer-retrieval path named as a follow-on** (the model this ADR selects).
   - Pros: matches `02 §4.10`'s own schema and requirement exactly; matches the actual, already-shipped
     P1-T6 fixture disposition and P3-T3's already-specified validator enforcement — this is not a new
     mechanism to build, it generalizes what E0 already does; preserves tamper-evidence via the hash;
     preserves addressability via the selector; keeps the public repository free of copyrighted
     verbatim text by default.
   - Cons: a reviewer cannot verify a hash-only record's underlying claim without some external
     retrieval step that does not yet exist (E0 ships none); until DF-E1-01 builds that path, review of
     a hash-only assertion is manual and out-of-band (e.g., a reviewer independently pulls the cited
     DOI) — an operational gap this ADR names rather than hides.
   - Decision: **selected** — recommended default.

## Consequences

### Positive

- Generalizes a policy this plan's own fixture already had to apply in practice (74/74 passages
  restricted) into an explicit, citable ADR rather than leaving it as an implicit convention baked
  into one hash-provenance note.
- Keeps the public, no-PHI, no-third-party-script microsite guardrail's spirit — minimal public
  exposure of third-party content — intact without requiring the pipeline to refuse copyrighted
  sources altogether (which would make the evidence base nearly empty, since almost all pediatric
  hematology literature is paywalled).
- Gives P3-T3's `scripts/validate-kb.mjs` enforcement (`exactPassage: null` requires
  `exactPassageSha256` populated) an explicit policy rationale, not just a schema rule.
- Names the retrieval-mechanism gap explicitly as DF-E1-01's problem, so it is tracked rather than
  silently assumed solved.

### Negative

- Until DF-E1-01 ships a governed retrieval path, a hash-only assertion is not actually independently
  reviewable through this repository's own tooling — reviewers must obtain the original source
  through their own institutional access, which this ADR does not provide or guarantee.
- Every future module's fixture is expected to hit the same restricted disposition by default (per
  the pattern P1-T6 already demonstrates across 12/12 diverse publishers), meaning near-zero
  `exactPassage`-populated records should be expected in practice, not an occasional exception — any
  future author who assumes otherwise will be surprised.

### Neutral

- This ADR does not change `schemas/evidence-assertions.schema.json`'s shape (P3-T3 already specifies
  the `exactPassage`/`exactPassageSha256`/`displayPolicy` fields per `02 §4.10`) — it ratifies the
  policy that schema already encodes, it does not redesign it.

## Unblocks

- **DF-E1-05** — FHIR/terminology emitters (deferred-items triage table, parent plan) need a resolved
  passage-display policy before a terminology-mapping/emitter contract can specify what, if anything,
  a FHIR `Evidence`/`Citation` resource may carry as display text versus a hash/selector reference.
  This ADR's storage policy (excerpt only when rights-confirmed, otherwise hash+selector) is the
  concrete display-policy input DF-E1-05's design spec (Phase 7, `P7-T7`) needs; DF-E1-05 also depends
  on ADR-3's terminology-ownership decision (a separate, orthogonal question this ADR does not
  address).

## Implementation Notes (non-binding until accepted)

- No code changes ship from this ADR. It is a design-record artifact only (`docs/adr/`), per this
  plan's Phase 6 scope (`P6-T2`, docs-only, no `modules/**`/`tools/**`/`src/**` touches beyond what
  P1-T6/P3-T3 already build under their own task authority).
- If accepted, the next actions would be: (a) confirm P3-T3's `scripts/validate-kb.mjs` wiring matches
  this ADR's storage policy exactly (Phase 3 territory, already in flight, not reopened by this ADR);
  (b) scope DF-E1-01's design spec (Phase 7, `P7-T3`) to include a concrete reviewer-retrieval
  mechanism proposal, since this ADR explicitly defers that mechanism rather than solving it; (c) scope
  DF-E1-05's design spec (Phase 7, `P7-T7`) against this ADR's display-policy vocabulary
  (`displayPolicy` values and their meaning for a FHIR emitter).

## References

- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §8.5 item 2 ("ADR: exact-
  passage storage, licensing, and reviewer access"), §8.1 row "How are exact passages stored under
  copyright constraints?", §4.10 (exact-passage evidence projection schema and rights-restricted
  fallback requirement), §8.4 row "Content-rights breach."
- `tests/fixtures/rf-cbc-001/HASH-PROVENANCE.md` — the P1-T6 fixture's actual, worked-example rights
  disposition: 12/12 source cards, 74/74 extracted passages, uniform `usage.allowed_for_public_output:
  false`, 0/74 positively confirmed rights-clear, 198 total redactions replaced with
  `sha256:<hash>` markers preserving the sibling `locator` selector.
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-1-2-foundation-converter.md`
  — task row `P1-T6` (fixture rights disposition).
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md`
  — task row `P3-T3` (`evidence-assertions.json` exact-passage projection + rights-restricted fallback
  validator enforcement).
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md` — Decisions &
  OQ Resolutions §, OQ-2 (fixture-seeding run and rights-restricted fallback default) and OQ-3
  (evidence-assertions landing path); Risk Mitigation table row "Fixture provenance / content-rights
  exposure."
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-6-7-adrs-docs.md`
  — task row `P6-T2` (this ADR's acceptance criteria).
- Deferred-items triage table (parent plan) — `DF-E1-05` row.
- CLAUDE.md hard guardrail — "No PHI in the public microsite... no third-party scripts/fonts/
  analytics" (this ADR extends the same public-exposure-minimization principle to third-party
  copyrighted text, by analogy, not by direct guardrail text).

## Metadata

- **Author**: documentation-writer (Phase 6, `P6-T2`), evidence-foundry-buildout plan.
- **Reviewers**: pending — no named credentialed clinical or technical reviewer has approved this
  ADR; `status: proposed` reflects that literally, not just formally.
- **Affected components**: `modules/cbc_suite_v1/evidence-assertions.json` (Phase 3, referenced not
  modified by this ADR), `schemas/evidence-assertions.schema.json` (Phase 3), any future FHIR/
  terminology emitter design (DF-E1-05), any future clinical review portal design (DF-E1-01).
- **Risk level**: Medium — the decision governs content-rights exposure discipline and the minimum
  bar for independent reviewability; getting the storage policy wrong risks either a licensing
  liability (Option 1) or an unreviewable rule base (Option 2).
