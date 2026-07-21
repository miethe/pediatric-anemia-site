---
doc_type: handoff_spec
title: "Research Foundry rights & evidence-item entity model — capability request v1"
status: draft
created: 2026-07-21
feature_slug: rights-aware-evidence-capture
target_project: research-foundry
source_project: pediatric-anemia-site
related_documents:
  - .claude/findings/rights-governance-spec-v1.0-review-findings.md
  - .claude/worknotes/rights-aware-evidence-capture/decisions-block.md
  - docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0.md
  - docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/schemas/rights_record.schema.json
  - docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/schemas/rights_extension.schema.json
  - docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md
owner: Nick Miethe (source_project owner; Research Foundry counterpart TBD)
risk_level: medium
---

# Research Foundry rights & evidence-item entity model — capability request v1

> **This is an engineering and governance specification. It is not legal advice, and it is not
> clinical sign-off.** Case law is cited below as the *reason a data model needs a particular axis*,
> never as a determination of how any specific item should be classified. Every legal determination
> named here routes to counsel, and no field proposed in this document may be set to a cleared value
> by an automated agent.

**Audience:** Research Foundry / Evidence Foundry maintainers and agents. No knowledge of the
requesting project is assumed. Where a concrete example is needed, it is drawn from pediatric
clinical decision support, but nothing requested here is pediatric-specific — that is the point.

## 1. Context & motivation

### 1.1 What happened upstream of this document

Research Foundry published the **Source Reuse & Rights Governance Specification v1.0** (1374-line
spec, five JSON Schemas, three agent templates, six validated examples). A consuming project reviewed
it in depth — four parallel read-only investigation legs, then three adversarial verifiers each
prompted to refute the load-bearing claims. The determination was **adopt**: the spec's core framing
(evidence quality, reuse rights, and clinical suitability are three independent dimensions) is
correct and was the thing the consuming project most needed stated plainly.

The review also independently checked **all 15 Appendix B citations. They hold up — no fabricated
citations**, including `[S15]`, the FDA Clinical Decision Support final guidance of January 2026,
which the reviewer opened by *assuming* was a citation defect (believing the September 2022 guidance
still controlled) and was wrong about. Everything in §7 is therefore a **refinement, not a correction
of fabrication** — which matters for how the amendments should be triaged.

### 1.2 Why this request goes to Research Foundry rather than to the consuming repo

The consuming project's binding decisions block (D5) draws a two-repo line and states the test:

> **Boundary rule when in doubt: if a second, unrelated content module would need it too, it is
> Research Foundry's.**

Four things fall on the Research Foundry side under that test: (1) licence / access-basis / terms
fields on source and evidence entities; (2) the `evidence_item_type` taxonomy and the
measured-vs-judged axis; (3) capture-time rights triage and terms snapshotting; (4) alternative-source
discovery when a source is restricted.

None depend on the domain. They are properties of *how evidence is captured*, not of what it is
about. Built locally, every Research Foundry consumer rebuilds them incompatibly and the rights
posture reverts to per-repo folklore. What stays local is everything domain-shaped: coverage gates
over a specific knowledge base's file set, module wiring, and the content itself.

### 1.3 The concrete gap this closes

The consuming project's evidence schema defines a `source` entity with `id`, `priority`, `year`,
`title`, `organization`, `journal`, `doi`, `url`, `supports[]`, `passages[]` — and records **no
licence, no access basis, and no terms at all.** That a particular subscription-accessed source is
contractually unusable for incorporation into another product exists only as prose in a findings
file. The review named making that machine-checkable as **the largest real safety gain on offer**.

Research Foundry's `rights_record` already models the rights *facts* well. What is missing is the
**binding between those records and the entities agents touch during capture**, plus one taxonomy
axis the spec does not have. That is the whole of this request.

Everything below **composes with spec v1.0** rather than replacing it: where a field already exists in
`rights_record.schema.json`, this document declines to duplicate it and asks for a link instead. §9
lists the places where the proposal *cannot* compose without an upstream amendment.

## 2. Capability 1 — Rights / licence / access / terms on source and evidence entities

### 2.1 The normalization question, answered first

Spec §10.1 is right that rights data should not all live inside the source record, and its
three-object split (`rights_record` / `content_reuse_assessment` / `permission_record`) is the
correct normalization. This request does **not** propose moving those fields onto the entity.

The split proposed here is:

| Lives in the linked `rights_record` | Lives on the entity |
|---|---|
| Full licence identity, version, URL, per-component applicability | A **link** to the record(s) |
| The complete contract restriction set with clause locators | A **denormalized triage subset**, ≤6 fields, never authoritative |
| Terms snapshot URI + hash + verified-at | The **snapshot reference id** only |
| Component decisions, permitted/prohibited uses | Nothing |
| Overall clearance status | A **mirror** of it, marked as a cache |

**Why denormalize at all:** capture-time and validation-time code paths must fail closed on a single
object without a join — an agent deciding whether it may retrieve a PDF, and a release gate deciding
whether an atom may ship, both need a local answer. If the answer requires resolving a foreign key,
the fail-open mode is "record missing → field absent → looks fine."

**Why the copy must be explicitly non-authoritative:** two fields that can disagree is a fail-open,
and the review flagged that pattern as a hazard. The mitigation is not avoiding denormalization but
(a) naming the mirrored fields as a cache in the schema description, (b) requiring a
`rights_record_ids[]` link whenever any mirror is non-null, and (c) a validator that re-derives the
mirror and fails on divergence.

### 2.2 Proposed entity-level field set

A new object, `rights_summary`, attachable to **source entities** and **evidence entities** (atoms,
passages, extracted points — whatever the Foundry's evidence granularity is called). Field names are
proposals; the semantics are the request.

```jsonc
{ "rights_summary": {
    "schema_version": "1.0.0",
    // Linkage — authoritative data lives in these records
    "rights_record_ids": ["RR-SRC-XXX-001"],   // array<string>; minItems 1 when any mirror is set
    "reuse_assessment_ids": [], "permission_record_ids": [],

    // Copyright / licence mirror
    "copyright_status": "copyrighted",         // enum, §2.3
    "rights_holder": null,                     // string|null
    "publication_license": null,               // string|null  e.g. "CC BY"
    "license_version": null,                   // string|null  e.g. "4.0"
    "license_url": null,                       // string|null — `pattern`, NOT format:uri (§9.6)
    "license_applies_to": [],                  // array<enum>, §2.4
    "is_public_domain": "unknown",             // yes|no|unknown
    "is_us_federal_government_work": "unknown",// yes|no|unknown

    // Access basis and terms
    "access_basis": "unknown",                 // enum, §2.5
    "terms_url": null,                         // string|null
    "terms_snapshot_ref": null,                // string|null — content-addressed handle
    "terms_snapshot_sha256": null,             // string|null — ^[a-f0-9]{64}$
    "terms_verified_at": null,                 // date-time|null
    "automated_retrieval_allowed": "unknown",  // permission enum, §2.5

    // Contract restriction set (mirror of rights_record.contract); all default "unknown"
    "restrictions": {
      "incorporation_into_other_products": "unknown", "adaptation": "unknown",
      "commercial_use": "unknown", "redistribution": "unknown", "sublicensing": "unknown",
      "text_and_data_mining": "unknown", "model_training": "unknown"
    },

    // Cache discipline
    "mirror_of_record_id": null,               // string|null
    "mirror_derived_at": null,                 // date-time|null
    "mirror_is_authoritative": false           // const false — schema-pinned
} }
```

### 2.3 `copyright_status` — enum, and why the boolean flags sit beside it

Reuse the existing `rights_record.copyright.status` enum verbatim so the mirror is exact:
`copyrighted` | `open_license` | `public_domain` | `us_federal_government_work` |
`mixed_or_third_party` | `unknown`.

**But `is_public_domain` and `is_us_federal_government_work` must be separate tri-state fields, not
enum members**, because the single-enum shape cannot express three common states: a US federal work
that also embeds third-party copyrighted figures (§3.7's actual trap); an open-licensed article whose
supplementary dataset is public domain; and a copyrighted article by university authors on
**federally funded** research, which is *not* a federal work (§7.C). `unknown` is the default; `yes`
and `no` are assertions and must carry a `rights_record_id`.

### 2.4 `license_applies_to` — per-component applicability

Reuse the existing `rights_record.copyright.license_applies_to` enum:
`text` | `abstract` | `figures` | `tables` | `supplements` | `data` | `code` | `questionnaires` |
`all_content` | `unknown`. An empty array means *not assessed* and must be read as `unknown` by every
gate — never as "applies to nothing," never as "applies to everything."

### 2.5 `access_basis` and the permission enum

`access_basis` reuses spec §11's list exactly: `public_web` | `open_repository` |
`personal_subscription` | `institutional_subscription` | `purchased_copy` | `licensed_api` |
`direct_permission` | `author_provided_copy` | `government_source` | `partner_confidential` |
`data_use_agreement` | `other` | `unknown`. `unknown` is **added** — the existing
`rights_record.access.basis` enum lacks it, forcing an agent that does not know the basis to guess or
omit a required field, both worse than recording ignorance (§9.3).

Every entry in `restrictions{}` and `automated_retrieval_allowed` uses **one** permission enum —
the existing `rights_record.contract.*` enum:

```
allowed | allowed_with_conditions | restricted_without_written_approval |
prohibited | not_addressed | unknown
```

It is deliberately used for the retrieval/TDM/training fields too, which today live under
`rights_record.access.*` with a *different* enum shape (`yes` / `yes_with_conditions` / `no` /
`unknown`). Two enums for one question is a translation bug waiting to happen (§9.4).

### 2.6 Required invariants

1. **Presence, not clearance.** Every source and evidence entity MUST carry a `rights_summary`. An
   unassessed entity carries one full of `unknown` — visible ignorance, not absence.
2. **Fail-closed defaults.** Every enum defaults to `unknown`, every nullable to `null`;
   `mirror_is_authoritative` is schema-pinned `false`.
3. **Link-before-assert.** Any non-`unknown` mirror value requires a non-empty `rights_record_ids[]`.
4. **Divergence is an error.** A validator MUST re-derive the mirror from the linked record and fail
   on mismatch. Silent staleness is the failure mode this design exists to prevent.
5. **No agent may write a `CLEARED_*` value** into any field, on any entity, ever (§6.3).

## 3. Capability 2 — `evidence_item_type` and the measured-vs-judged axis

**This is the substantive contribution back upstream. If only one capability in this document is
adopted, it should be this one.**

### 3.1 The gap

Spec §5.1's content-component classes are a **rights taxonomy**: they sort content by *what kind of
protected thing it is* (prose, table, figure, nomogram, questionnaire, logo), and they are well built
for that job.

They do not encode the distinction the review established as decisive: **whether a value was
measured/observed, or arrived at by expert judgment.** Under §5.1, "the sensitivity of a test at a
cutoff, as reported by a cohort study" and "the cutoff a specialty society's committee recommends
clinicians act on" are both `Atomic factual finding` → *facts-only implementation potentially
permitted*. §15's decision matrix reinforces this with a single row: "Encode a reported numeric
threshold → **Facts-only candidate**."

### 3.2 Why that distinction is legally decisive

Stated carefully, as a reason for a data-model axis rather than as a determination:

- **Feist Publications v. Rural Telephone Service**, 499 U.S. 340 (1991) — controlling authority for
  the fact/expression line. **Absent from the spec entirely.**
- **CCC Information Services v. Maclean Hunter Market Reports**, 44 F.3d 61 (2d Cir. 1994) — used-car
  valuations held **protected expression rather than facts**, because they reflected the editors'
  predictions and professional judgment; the infringing use there was a commercial database product.
- **American Dental Association v. Delta Dental Plans Ass'n**, 126 F.3d 977 (7th Cir. 1997) — a
  taxonomy (numbering plus short descriptions) held copyrightable.

The operational consequence is that a single "numeric threshold" class routes two materially
different risk profiles down one path. Whether any *particular* threshold is measured or judged is a
legal determination for counsel; **the model's job is to make the question askable and the answer
recordable.** Today it is neither.

### 3.3 Proposed `evidence_item_type` enum

Carried from the consuming project's decisions block D2, generalized:

| `evidence_item_type` | Nature | Facts-only strength (engineering heuristic, not a legal conclusion) |
|---|---|---|
| `observed_finding` | measured or derived from data reported in the source | strong |
| `reference_interval_value` | a single interval value, population-scoped | strong individually; **compilation risk in aggregate** |
| `equation_or_method` | formula, conversion, derivation | strong; screen separately for patent |
| `guideline_recommendation` | consensus / committee judgment | **weak — this is the CCC-shaped exposure** |
| `instrument_or_questionnaire` | scored instrument, test items, scoring rules | permission by default |
| `bibliographic_metadata` | identifiers, citation elements | cleared |
| `derived_synthesis` | **first-party** authored claim over ≥2 sources | ours to licence — see §4 |

`unassessed` is **not** a member. An item of unknown type must either be missing a required field and
caught by the gate, or carry an explicit `unknown` member if the Foundry prefers total functions —
either is acceptable; silent defaulting to `observed_finding` is not.

### 3.4 Proposed `judgment_basis` field

A second, smaller enum on the same entity, defaulting to `unassessed`:

```
measured | derived_from_measured | expert_judgment | mixed | unassessed
```

**`unassessed` is the default and is honest, not lazy** — for most corpora the question has never been
put to counsel. `derived_from_measured` covers a value computed from reported measurements by a
stated method (a pooled estimate, a unit conversion): it behaves like `measured` for facts-only
purposes but carries a distinct provenance obligation. `mixed` is common in guidelines, where a
committee anchors on a measured value and then adjusts it — it must not be forced into either pure
category.

**Gates MUST treat `unassessed` as blocking for any commercial-release decision and non-blocking for
internal capture.** That asymmetry is the entire value of the field: capture proceeds, release does
not.

### 3.5 Why this must never be collapsed into `rights_component_class`

There are three orthogonal axes, and the review flagged conflation of any two as a **fail-open**:

| Axis | Question it answers | Existing home |
|---|---|---|
| `rights_component_class` (§5.1) | What kind of *protected thing* is this? | spec `component_decisions.component_type` |
| `evidence_item_type` (**requested**) | What kind of *knowledge* is this? | — |
| `judgment_basis` (**requested**) | Was it *measured or judged*? | — |

Plus, in a consuming repo, a fourth: an *epistemic* status (is this claim supported by its located
source?) separate from *legal* clearance status. A passage can be epistemically `source-supported`
**and** legally `CONTRACT_RESTRICTED` at once — not an edge case but the common case for
subscription-accessed guidelines.

Collapsing is tempting because the values correlate; it fails because the correlation is not a
function. A `guideline_recommendation` may appear as prose, a table row, or a flowchart node — three
`rights_component_class` values, one `evidence_item_type`. A `table` may hold
`reference_interval_value` items (measured) and `guideline_recommendation` items (judged) in adjacent
columns. Every collapse loses information a downstream gate needs, and loses it in the permissive
direction.

**Requested as a hard schema constraint:** three separate fields, all required (or
required-with-explicit-unknown), and no derived field computed from one to stand in for another.

## 4. Capability 3 — `derived_synthesis` as a first-class item type

### 4.1 The request, and why it cannot be deferred

`derived_synthesis` — a first-party claim authored over two or more input sources — must be a
**first-class item type from the first release, with attribution-to-inputs modelled from day one.**
This is spec §21.1/§21.4 ("build independent clinical intellectual property", "original research as a
rights and moat strategy") made operational: the only path that ends with content the Foundry's
consumers own and can licence.

From decisions block D3, the load-bearing engineering point:

> **Retrofitting provenance onto synthesis is not possible.** You cannot reconstruct which inputs a
> claim came from once it has been written.

Every other field in this document can be backfilled. Attribution cannot. A synthesis authored today
without recorded inputs is permanently unattributable, and an unattributable first-party claim is as
unusable as a rights-blocked third-party one — worse, because it *looks* clear. So the ask is not
"add an enum member": it is ship the enum member **together with** the attribution structure, even
though few instances will exist at first.

### 4.3 Proposed structure

```jsonc
{ "evidence_item_type": "derived_synthesis",
  "synthesis": {
    "input_refs": [                         // minItems 2 — a "synthesis" over one input is not one
      { "evidence_item_id": "...", "rights_record_id": "...", "contribution": "anchor" },
      { "evidence_item_id": "...", "rights_record_id": "...", "contribution": "corroborating" }],
    "method": "...",                        // required, non-empty: how the inputs were combined
    "divergence_notes": [],                 // where inputs disagreed, and how that was resolved
    "reproduces_source_arrangement": false, // required — §15's substantial-similarity question
    "first_party_rights_holder": null,      // string|null
    "attestation": {                        // §4.4
      "attested_by": null,                  // MUST be null in any agent-authored record
      "attested_at": null, "attestation_ref": null,
      "status": "candidate"                 // candidate|attested — agents may only write "candidate"
} } }
```

`contribution` is deliberately coarse (`anchor` | `corroborating` | `contradicting` |
`scope_limiting`) — the goal is reconstructability, not a full argument graph.

### 4.4 The attestation constraint (non-negotiable)

A `derived_synthesis` in a clinical context **is a clinical claim.** It requires the **same human
attestation** as any other binding clinical assertion, and **no agent may author one as
authoritative** — agents prepare *candidates*, a qualified human adjudicates and attests.
`attestation.status` MUST be schema-constrained so agent-writable paths can only produce `candidate`.
(The consuming repo enforces the equivalent as a hard schema violation plus a fails-closed test,
precisely because a free-string reviewer field is an open door.)

This mirrors a hazard the review found in spec v1.0 itself: `approvals.clinical_owner` and
`review.clinical_reviewer` are free strings, and the spec's own examples put an *agent name* in a
reviewer field — actively modelling the mistake (§7.F). Note also that `rights_record.source_id` is
required with `minLength: 3`, so a `derived_synthesis` has no valid rights record under the current
schema (§9.5).

## 5. Capability 4 — Capture-time rights triage, terms snapshotting, alternative-source discovery

### 5.1 Capture-time triage

Rights assessment must happen **at capture**, in the same pass that fetches or records a source — not
as a later sweep. Two practical reasons: (1) **the access context is only knowable at capture time** —
whether a PDF arrived via public web, institutional subscription, or an author copy is ambient in the
fetching step and unrecoverable afterwards, which makes `access_basis` the field most often silently
wrong when backfilled; (2) **a restricted source never captured costs nothing**, whereas one captured
and *then* found restricted has already created the exposure.

Requested behaviour: capture emits a `rights_summary` for every source and evidence item it creates,
populated to whatever confidence is available and `unknown` elsewhere, at `review_status:
agent_triage_only`. Triage is a *classification*, never a *clearance*.

### 5.2 Terms snapshotting

Spec §8.3 already says agents SHOULD "retain snapshots of applicable terms and licenses." Requested as
a concrete capability: snapshot the applicable terms/licence page **at capture**, content-addressed
(`terms_snapshot_sha256`) with `terms_verified_at`; store it **outside the shipped artifact set** in
whatever controlled zone the Foundry designates, since terms pages are themselves third-party
content; re-snapshot on the surveillance schedule and **diff**, because a silent terms change is what
turns a cleared status into a false one; and record snapshot *failure* structurally rather than as an
absent field. Several publisher terms URLs return 403 to any automated client, making a "verified"
stamp non-reproducible — that should surface as `terms_snapshot_ref: null` plus an explicit failure
reason, not as a clean record.

### 5.3 Alternative-source discovery

Spec §8.3 says agents SHOULD "use multiple independent sources to reduce dependence on one
proprietary compilation," and §21.3 says to prefer source substitutability and avoid an architecture
where one proprietary source can revoke the core knowledge base. Requested as a capability rather
than a recommendation: when triage yields a blocking status (`CONTRACT_RESTRICTED`,
`PERMISSION_REQUIRED`, `PROHIBITED`, or a use-blocking `UNKNOWN`), discovery SHOULD search for a
rights-clear substitute covering the same claim and record the result — including a **negative**
result — structurally:

```jsonc
{ "substitutability": {
    "searched_at": "...",
    "status": "substitute_found | no_substitute_found | not_searched",
    "candidate_source_ids": [],
    "coverage_notes": "..."      // what the substitute does and does not cover
} }
```

A recorded `no_substitute_found` is a genuine research finding — it quantifies single-source
dependency, a business risk as much as a legal one. Spec §8.3's closing line already says to "treat
negative rights findings as structured research results, not missing metadata." This makes that line
executable.

## 6. Non-goals — explicitly NOT requested

Stated as hard boundaries, because each is a plausible over-build that would make things worse.

### 6.1 Do not build a full-text vault (the D1 boundary)

The consuming project's binding decision D1 is:

> **The archive is provenance, not text. Maximal capture means maximal *addressable provenance*,
> never retained third-party expression.**

The intuition to "capture everything now and decide legality later" is right about the goal and wrong
about the mechanism. Storing source full text or verbatim tables against a hoped-for future licence
converts a **copyright** question (defensible, fact-dependent) into a **contract-breach** question
(much less so), and it is unrecoverable — restricted text in version-control history cannot be
un-shipped. What makes future lawful use possible is not having the text but having, for every claim,
a locator precise enough to re-fetch and re-bind *mechanically* once a licence exists: source +
edition + section + table + row + column + assay + population. That asset is lawful to hold today and
survives losing access to the source entirely.

So: **do not** propose that Research Foundry store third-party full text on behalf of consumers, and
do not design any field whose intended population is a verbatim third-party span. Spec §7's Zone 1
(controlled source vault) may exist inside Research Foundry's own infrastructure; it must never be
something a consuming content repo inherits. Requested instead: **richer locators** — every capability
in this document is worth less than one more locator dimension.

### 6.2 Do not build clearance automation

No rules engine that computes a clearance status from licence metadata. The requested gates are
**coverage- and consistency-shaped** (*does every entity have a rights summary? do the axes agree?
does the mirror match the record?*), never clearance-shaped (*is this cleared?*). Clearance is a legal
determination, and an automated clearance engine produces confident wrong answers at scale — strictly
worse than no answer.

### 6.3 No agent may assign a `CLEARED_*` status

Absolute. `CLEARED_OPEN_LICENSE`, `CLEARED_PUBLIC_DOMAIN`, `CLEARED_FACTS_ONLY`,
`CLEARED_PERMISSION`, and `counsel_approved` are **human-only**; agents write `agent_triage_only` and
non-cleared statuses. The consuming repo enforces this locally regardless, but enforcing it upstream
removes the door rather than posting a guard at it.

### 6.4 Do not turn on a hard release gate before answers can be recorded

Spec §20.2's release gate, adopted before rights records exist, converts an undocumented rights
position into a build-breaking wall of `UNKNOWN` with no path to resolution — and no safety gain,
since nothing shipped in the interim was cleared either. Ship the model first; ship the gate when a
named human rights owner exists to close records.

## 7. Proposed amendments to the rights spec itself

Carried from the consuming project's review findings §2, ranked by consequence. **All 15 Appendix B
citations were independently verified and hold up — these are refinements, not corrections of
fabrication.** `[S15]` (FDA CDS final guidance, January 2026) in particular was confirmed against the
guidance PDF cover page, the FDA guidance database entry, a CDRH town hall transcript, and three
independent law-firm analyses; if the spec ever pins an exact date, use **January 29, 2026** (the
January 6 version is itself superseded). Note that `fda.gov` returns a spurious 404 to automated
fetchers — bot-blocking, not a dead link.

### A. Split §15's numeric-threshold row (material — this is the priority)

§15 currently reads: "Encode a reported numeric threshold → **Facts-only candidate**."

**Amend to two rows:**

| Proposed use | Default disposition | Conditions |
|---|---|---|
| Encode a **measured/observed** numeric value reported by a primary study | Facts-only candidate | Preserve population/assay limits; assess contract and compilation dependence |
| Encode a **consensus/judgment-derived** recommended threshold | **Legal review required** | Judgment-derived values may be protected expression (*CCC*); assess contract, compilation dependence, and market substitution |

This has the largest downstream effect of any amendment here, because `CLEARED_FACTS_ONLY` is the
entire basis for the unblock consuming projects are counting on, and this narrows it materially.

### B. Add the missing case law to Appendix B

- **Feist Publications v. Rural Telephone Service**, 499 U.S. 340 (1991) — controlling authority for
  the fact/expression line; currently absent from the document entirely.
- **CCC Information Services v. Maclean Hunter Market Reports**, 44 F.3d 61 (2d Cir. 1994) —
  judgment-derived numbers held protected expression.
- **American Dental Association v. Delta Dental Plans Ass'n**, 126 F.3d 977 (7th Cir. 1997) — a
  taxonomy (numbering plus short descriptions) held copyrightable. Directly relevant to §5.1, which
  *is* a taxonomy.

### C. Fix §3.7's conflation of government *works* with government-*funded* works (material)

U.S. federal-government works are uncopyrightable under 17 U.S.C. §105. Articles by university
authors reporting **federally funded** research are copyrighted, and they are abundant in exactly the
open-repository corpora Research Foundry searches. §3.7's operational guidance does not draw that
line, and a triage agent reading it will misclassify. Make the authorship test explicit, and carry
the third-party-embedded-content caveat that already appears in Example G.

### D. Re-attach §16.1's contract caveat to §16.2 (moderate, under-conservative)

§16.1 correctly states that the subscription in question bars incorporating materials into other
materials. §16.2 then lists "state independently worded clinical facts or recommendations" as often
usable — **without re-attaching that caveat.** Re-wording does not defeat a *contractual* prohibition
on incorporation; copyright and contract are separate questions, as §3.3 itself says. §16.2 should
carry the caveat inline rather than relying on the reader to hold §16.1 in mind.

### E. Scope the EU sui generis database right (moderate — currently blocks needlessly)

§3.2's statement of Directive 96/9/EC Art. 7(1) is verbatim-accurate but omits two scoping facts:
**territorial scope** (an EU/EEA instrument that does not attach to a US-only product on its own
terms), and **the create-vs-obtain carve-out** — the CJEU's *British Horseracing Board* / *Fixtures
Marketing* line excludes investment in **creating** data from the protected investment, counting only
investment in obtaining, verifying, and presenting it. An organization generating its own
measurements (a laboratory establishing its own reference intervals, say) is plausibly on the
creating side. As written, §3.2 discourages a viable path; amend to state the scope rather than
removing the warning.

### F. Constrain the reviewer/approver fields (added by this document)

`approvals.clinical_owner` and `review.clinical_reviewer` are free strings, and the spec's examples
populate reviewer fields with an *agent* name. Amend the examples at minimum; better, constrain the
fields so an agent identifier cannot land in a human-reviewer slot, and require `counsel_approved` to
carry a resolvable attestation reference rather than being a self-declared string.

### G. Citation hygiene (minor)

`[S7]` is defined but never cited. `[S1]` is over-loaded (one chapter URL carrying §102, §103, §105,
§107) and `[S14]` duplicates it. `[S11]`'s pin-cite is one page off. `[S13]`'s EUR-Lex URL returns a
bot challenge — prefer the ELI permalink. Several publisher terms URLs 403 any automated client, so
those "verified" stamps are not machine-reproducible (mildly ironic given §8.2's own restriction on
unapproved automated retrieval) — worth a footnote noting those verifications were human-performed.

## 8. Acceptance criteria

"Research Foundry has delivered this" is true when **all** of the following are checkable by a third
party with repository access and no conversation history:

**Capability 1 — rights on entities.** [ ] A published schema defines `rights_summary` (or
equivalent) attachable to source and evidence entities, with the fields of §2.2 and the enums of
§2.3–§2.5. [ ] Every field defaults to `unknown`/`null`, none to a permissive value, and
`mirror_is_authoritative` is schema-pinned `false`. [ ] A validator fails when a mirror field is
non-`unknown` without a linked `rights_record_id`, and when a mirror diverges from its record — both
with passing negative tests. [ ] That validator is time-parameterized (`--as-of` or equivalent) and
never calls wall-clock time, so runs are byte-reproducible.

**Capability 2 — item-type taxonomy.** [ ] `evidence_item_type` is a required field carrying the
§3.3 enum, and `judgment_basis` a *separate* required field carrying the §3.4 enum, defaulting to
`unassessed`. [ ] `rights_component_class`, `evidence_item_type`, and `judgment_basis` are three
independent fields; no schema or code path derives one from another. [ ] A release-gate rule treats
`judgment_basis: unassessed` as blocking for commercial-release dispositions and non-blocking for
internal capture, with tests in both directions.

**Capability 3 — derived synthesis.** [ ] `derived_synthesis` is an `evidence_item_type` member and a
`synthesis` object exists with `input_refs` (`minItems: 2`), non-empty `method`, and required
`reproduces_source_arrangement`. [ ] `attestation.status` cannot be set to `attested` by any
agent-writable path — schema-enforced, with a fails-closed test. [ ] A `derived_synthesis` can exist
without a third-party `source_id` (§9.5).

**Capability 4 — capture-time triage.** [ ] Capture emits a `rights_summary` for every source and
evidence item it creates, at `review_status: agent_triage_only`. [ ] Terms snapshotting produces a
content-addressed artifact plus `sha256` and `verified_at`, records snapshot *failure* structurally
rather than as an absent field, and a re-snapshot diff reports terms changes. [ ] Blocking-status
sources trigger substitute discovery, and `no_substitute_found` is recorded as a positive structured
result.

**Spec amendments.** [ ] §15 has two threshold rows (measured / judgment-derived); [ ] Appendix B
contains Feist, CCC, and ADA v. Delta Dental; [ ] §3.7 distinguishes government works from
government-funded works; [ ] §16.2 carries §16.1's contract caveat inline; [ ] §3.2 states
territorial scope and the create-vs-obtain carve-out; [ ] no example places an agent identifier in a
human reviewer or approver field.

**Global.** [ ] No agent-writable code path can produce a `CLEARED_*` status or `counsel_approved`,
with a test asserting so. [ ] No requested capability stores third-party full text.

## 9. Conflicts with the existing schemas, for RF to adjudicate

These are places where the proposal **cannot** compose with spec v1.0's schemas as published. They
are listed as questions for the Research Foundry team, not as defects the consumer intends to route
around.

### 9.1 `rights_extension.schema.json` cannot carry the taxonomy

It is `additionalProperties: false` and requires `rights_record_ids`, `clearance_status`,
`release_gate`, `last_reviewed_at`. So `evidence_item_type` and `judgment_basis` **cannot** go under
`extensions.rights` without amending it — and arguably should not, since they are not rights fields.
Options: (a) add them as optional properties to `rights_extension`; (b) define a sibling
`extensions.evidence_taxonomy`. **Preference: (b)**, which keeps the axes physically separate — the
whole point of §3.5. The required `clearance_status`/`release_gate` pair also means the extension
cannot serve as a lightweight capture-time carrier: an unassessed atom must declare `UNKNOWN`/`BLOCK`,
correctly fail-closed but heavier than triage wants.

### 9.2 §5.1's prose table and `component_decisions.component_type` do not agree

Near-but-not-equal: "Prose or abstract" is one row but two enum members (`prose`, `abstract`);
"Figure or chart" is one row but two (`figure`, `chart`); "Atomic factual finding" maps to
`atomic_facts_and_methods`, which also absorbs "Equation or method" despite `equation` being its own
member. An agent implementing from the prose will emit values the schema rejects. Worth reconciling
before a fourth axis is layered on top.

### 9.3 `rights_record.access.basis` has no `unknown` member

`basis` is required and its enum closes with `other` but no `unknown`, so an agent that does not know
the access basis must guess or write `other` — both record a false certainty. Requested: add
`unknown`, treated as blocking.

### 9.4 The same restriction family is modelled twice with different enums

`access.automated_retrieval_allowed`, `access.text_and_data_mining_allowed`, and
`access.model_training_allowed` use `yes`/`yes_with_conditions`/`no`/`unknown` (and
`model_training_allowed` alone adds `not_assessed`, which its siblings lack), while
`contract.bulk_retrieval` and `contract.model_training` use
`allowed`/`allowed_with_conditions`/`prohibited`/`not_addressed`/`unknown`. TDM and model training
are each expressible in two objects with two incompatible vocabularies that can disagree. Requested:
one enum, one home, per restriction.

### 9.5 `rights_record` cannot describe first-party content

`source_id` is required with `minLength: 3`, `record_scope` has no first-party member, and
`overall_status` has no `OWNED`/`FIRST_PARTY`/`NOT_APPLICABLE` value. A `derived_synthesis` —
content the consumer authored and owns — therefore has no representable rights record. Requested: a
first-party record scope and status, or an explicit statement that first-party content sits outside
the rights-record model (in which case §4 needs a different home).

### 9.6 Two fail-opens in the current schemas

**`format: "uri"` is not enforced by common lightweight validators.** `license_url` and `terms_url`
rely on `format`; at least one validator in active use (`json-schema-lite`) ignores `format` except
`date` and `date-time`, so `license_url: "not a url"` validates clean. Requested: `pattern` for URL
fields, or an explicit documented gap. §2.2 already specifies `pattern` for that reason.

**`contract` is nullable with no required members.** It is `["object", "null"]` with no `required`
array, so `{"contract": {}}` validates and reads as "no restrictions assessed" identically to "no
restrictions exist." Requested: make the restriction fields required-with-`unknown`-default, or make
`null` the only way to express "not assessed" and forbid the empty object.

## 10. Open questions for the Research Foundry team

- **OQ-RF-1 (the gating question; consuming project's OQ-4).** Does Research Foundry **accept this
  entity model as authored, or counter-propose a different shape?** The consuming project will not
  hard-couple to any Research Foundry shape until this is answered, so the answer's *timing* matters
  as much as its content. A counter-proposal is a fine outcome; silence is the expensive one.
- **OQ-RF-2.** Is `evidence_item_type` a base-layer concept or an Evidence Foundry specialization
  (§10.2/§10.3)? For base: measured-vs-judged is not clinical — it applies to financial valuations
  (where *CCC* arose), engineering standards, and legal taxonomies equally. For specialization: the
  drafted enum members lean clinical. A base axis with a domain-extensible enum may be the answer.
- **OQ-RF-3.** Should the entity-level mirror (§2.1) exist at all, or will Research Foundry guarantee
  a resolution API fast enough that no denormalization is needed? If the latter, the fail-closed
  requirement moves from schema to runtime and consumers need to know which.
- **OQ-RF-4.** Where does the terms snapshot live? It is third-party content and cannot sit in a
  consuming content repository. Does Research Foundry host it, or only the hash?
- **OQ-RF-5.** Does Research Foundry intend to own **surveillance** (§20.4) as a service, or is it
  per-consumer? This determines whether `next_review_at` is actionable or decorative.
- **OQ-RF-6.** Is there an existing Research Foundry rights owner or counsel relationship? Several
  capabilities produce records only a human can close. If no such role exists upstream either, ship
  the model explicitly as "records the debt," with the closing role named as a known gap.

## 11. Interim behaviour in the consuming project

Recorded so the Research Foundry team knows what is being built locally and can object early if any
of it belongs upstream. While this handoff is pending, the consuming project will:

1. **Vendor the five spec v1.0 schemas verbatim** under a local `schemas/rights/` as an interop
   contract, in the spirit of a checked-in OpenAPI document — no runtime code reads them; they pin
   and make diffable the shape being targeted.
2. **Harden the vendored copies only** — null-constraining human-reviewer and approver fields so no
   agent can populate them (§6.3, §7.F). *Narrowings*, never widenings, so any record valid locally
   is valid upstream.
3. **Keep local field names behind a thin adapter**, so adopting Research Foundry's eventual shape is
   a mapping change, not a data migration. **No hard coupling until OQ-RF-1 is answered.**
4. **Ship a `release-context` declaration** asserting non-commercial, internal-research use — the
   cheapest guardrail against a future agent assuming commercial clearance.
5. **Coverage- and consistency-shaped gates only**; no clearance-shaped gate until a named rights
   owner exists (§6.4).
6. **Enforce the D1 boundary locally** with a negative invariant test asserting no third-party full
   text enters the repository, independent of what Research Foundry ships.
7. **Record `judgment_basis: unassessed`** on every item until counsel answers, blocking nothing
   except work that would ship a cleared status.

If Research Foundry counter-proposes a materially different model, items 1–3 change; items 4–7 are
local policy and stand regardless.

## 12. Summary of the ask

| # | Capability | One-line ask |
|---|---|---|
| 1 | Rights on entities | Add a fail-closed `rights_summary` (licence, access basis, terms snapshot, contract restriction set) to source and evidence entities, linking to — not duplicating — `rights_record`. |
| 2 | Item-type taxonomy | Add `evidence_item_type` plus a separate `judgment_basis` axis carrying measured-vs-judged, never collapsed into `rights_component_class`. |
| 3 | Derived synthesis | Make `derived_synthesis` a first-class item type with attribution-to-inputs from day one, and human attestation that no agent can write. |
| 4 | Capture-time triage | Assess rights at capture, snapshot terms content-addressed, and search for rights-clear substitutes when a source is blocked — recording negative results structurally. |
| — | Spec amendments | Split §15's threshold row; add Feist/CCC/ADA; fix §3.7 works-vs-funded; re-attach §16.1's caveat to §16.2; scope the EU database right. |
| — | Non-goals | No full-text vault, no clearance automation, no agent-assigned `CLEARED_*`, no hard release gate before there is somewhere to record answers. |

**Reciprocal offer.** Capability 2 is the consuming project's contribution back upstream, not a
one-way request: the measured-vs-judged axis was found by adversarially reviewing Research Foundry's
own spec, and it improves the spec for every consumer, clinical or otherwise.
