---
schema_version: 2
doc_type: spike
title: "SPIKE-007: Retrospective Data-Source Selection, DUA, Retention, and De-Identification Standard"
status: chartered-not-run
status_note: "Charter authored 2026-07-22 (E1 P4-T9), per FR-25 and binding ruling R6. **This SPIKE has NOT been run.** Only the charter — the research questions, exit criteria, method, and future GO/NO-GO verdict criteria this SPIKE must satisfy once run — is authored here. Running this SPIKE, executing a data-use agreement (DUA) with any external partner, and any real-data retrospective-validation work are gate **G3** (`docs/governance/gates-registry.md` — Data-source SPIKE verdict + data-partner DUA), an external human-blocked state this plan (Evidence Foundry E1) does not clear and no task in this plan claims to advance. Authoring this charter is explicitly IN scope per ruling R6; everything downstream of it is explicitly OUT."
created: 2026-07-22
feature_slug: evidence-foundry-e1
research_questions:
  - "Which corpus/partner option, among ADR-0006's three, actually supplies the harness's real retrospective-validation input, and under what concrete acquisition path?"
  - "What must a data-use agreement (DUA) with an external partner contain for this program to accept the resulting corpus as retrospective-validation input?"
  - "What retention period and deletion trigger govern the externally-held (non-public) dataset, and how is that decision recorded and audited?"
  - "What must the selected corpus/partner satisfy for FR-19's version-pinned deterministic replay (registry-digest pinning) to remain meaningful against externally-versioned, externally-updated data?"
  - "Which de-identification standard — HIPAA Safe Harbor or Expert Determination — does the selected corpus/partner claim, and what evidence of that claim does this program require before accepting a case as `provenance: deidentified`?"
  - "What are the explicit success/verdict criteria the future SPIKE run must satisfy before its recommendation may be treated as final?"
complexity: M
estimated_research_time: "not applicable — charter only; the future SPIKE run's own timebox is a decision this charter poses, not answers (see RQ6)"
related_documents:
  - docs/adr/0006-validation-data-boundary-deidentification.md
  - docs/governance/gates-registry.md
  - docs/project_plans/design-specs/retrospective-validation-harness.md
  - docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
  - docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md
  - docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md
  - tools/retro-validate/schemas/fixture-corpus.schema.json
---

# SPIKE-007: Retrospective Data-Source Selection, DUA, Retention, and De-Identification Standard

**This document is a charter, not a completed SPIKE.** No research question below has been
researched, no option has been chosen, and no verdict has been rendered. Per FR-25 and binding
ruling R6 (`docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md:379`), authoring this
charter is the entirety of what Evidence Foundry E1 does with SPIKE-007 — running it is gate **G3**
(`docs/governance/gates-registry.md:113-121`), an external human-blocked state. Read the frontmatter
`status_note` before citing this document for anything beyond "the charter exists."

Gates the real-data half of `DF-E1-09` (real-data retrospective validation run) and the retention/
deletion-trigger and data-source-identity gaps `docs/project_plans/design-specs/
retrospective-validation-harness.md` (DF-E1-04) explicitly leaves open (`:15, :98-109`, "Neither
[retention period nor deletion trigger] can be named responsibly until the data-source SPIKE
identifies the actual external partner or dataset"). This charter does not close that gap — it
specifies exactly what a future SPIKE run must produce to close it.

## What ADR-0006 already settles vs. leaves open

`docs/adr/0006-validation-data-boundary-deidentification.md` (status `proposed`, not accepted — see
gate G0) already settles the **architectural direction**: no patient-identifiable data ever enters
this repository, its build outputs, or any `rf` run/writeback, under any option; Option 1 (external
partner-governed, pre-de-identified dataset) is the recommended default for the program's first real
retrospective-validation pass, with Option 3 (synthetic/case-report corpus) run continuously as a
non-substitute complement; Option 2 (first-party HIPAA environment) is named as a later fallback
only, not adopted now.

ADR-0006 explicitly leaves open, verbatim (`:127-141`): the specific partner or dataset identity; the
retention period and deletion trigger for the underlying dataset ("out of scope for this ADR to
fix"); and the concrete DUA terms. It names this SPIKE — not itself — as the place those decisions
get made. This charter is that naming made concrete: the research questions below, and only those
research questions, are what a future SPIKE run must resolve before gate G3 can even be considered
for clearance (G3 additionally requires an executed DUA, which is a human/legal act this SPIKE's
verdict alone cannot perform — see Decision impact).

## Scope

**In scope for this charter (authored now, P4-T9):** the research questions, exit criteria, method,
and success/verdict criteria a future SPIKE run must satisfy. Nothing else.

**Out of scope for this charter, and for this entire plan (Evidence Foundry E1):**
- Running any part of this SPIKE's research questions.
- Contacting, negotiating with, or evaluating any specific named external partner, health system, or
  dataset.
- Drafting, negotiating, or executing any actual data-use agreement.
- Any real, patient-derived case data entering `tools/retro-validate/`'s harness, this repository, its
  build outputs, or any `rf` run/writeback (structurally rejected today regardless of this SPIKE's
  status — `tools/retro-validate/schemas/fixture-corpus.schema.json`'s `provenance` enum admits only
  `synthetic`/`deidentified`, per P4-T1/T2; running this SPIKE and clearing G3 does not, by itself,
  change that schema — a further, separately reviewed implementation change would be required, which
  this plan does not make, per `docs/governance/gates-registry.md:121`).
- Naming an actual retention period, deletion trigger, or DUA term as final — this charter poses the
  decision framework; a future SPIKE run supplies the answer, grounded in whichever partner/dataset it
  actually evaluates.

## Research questions & exit criteria

### RQ1 — Corpus/partner option selection

ADR-0006 names three options; Option 1 is its recommended default but was never evaluated against a
concrete, named alternative — the ADR reasons about the option *category*, not a specific partner.

**Exit criterion**: for **Option 1 (external partner-governed, pre-de-identified dataset)**, the
future SPIKE run must survey concrete candidate categories (a health system's honest-broker
de-identification pipeline; a public de-identified pediatric CBC/hematology dataset with a
documented de-identification method; an academic or consortium-governed pediatric lab-data
repository) and, for each candidate actually pursued, record: dataset/partner identity, approximate
cohort size and case-mix (age bands, anemia-pattern coverage relevant to `modules/*/candidates.json`),
licensing/access terms, and estimated time-to-access. The SPIKE must also explicitly re-confirm
**Option 3 (synthetic/case-report corpus)** as the continuous, non-substitute complement already
partially served by this program's E0 dangerous-miss/boundary corpus (`tools/retro-validate`'s P4-T8
adapter) — Option 3 is never itself sufficient to satisfy the retrospective rung of the CLAUDE.md
validation ladder, per ADR-0006's own reasoning (`:105-109`). If no Option-1 candidate proves
accessible on a reasonable timeline, the SPIKE must record that finding honestly (per the RQ6
discipline below) rather than force a selection, and must explicitly re-evaluate whether **Option 2**
(first-party HIPAA-controlled environment) needs to be revisited — ADR-0006 states that revisit
decision belongs to a future ADR, not this SPIKE, so the SPIKE's job here is only to flag the
trigger condition, not to make the revisit decision itself.

### RQ2 — DUA requirements

**Exit criterion**: a concrete, checklist-shaped statement of what an executed data-use agreement
with an external partner must contain for this program to accept the resulting corpus as
retrospective-validation input, at minimum:
- Confirmation that all data supplied is **already de-identified** before it reaches this program —
  this program never receives, holds, or processes identifiable data under any DUA (restates ADR-0006's
  binding constraint, `:55-59`, as a DUA-drafting requirement rather than only an architectural one).
- The specific de-identification method the partner attests to (RQ5 — Safe Harbor vs. Expert
  Determination), and whether that attestation is itself auditable by this program (e.g. a
  determination letter reference, a described methodology) or is taken on the partner's word alone —
  the SPIKE must state which, honestly, not assume auditability it cannot confirm.
- Permitted use scope: retrospective validation of this program's rule/candidate output only; no
  redistribution; no re-identification attempt; no use beyond the stated purpose.
- Retention and deletion terms consistent with RQ3's framework — the DUA is the enforcement
  instrument for whatever retention period and deletion trigger RQ3 determines, not a separate,
  independently negotiated term.
- Named point(s) of contact and audit/breach-notification obligations on the partner's side.
- Explicit statement that this program's own audit obligation (FR-22's access log, already built and
  structurally distinct from the review-record chain per P4-T7) applies to every access of the
  DUA-governed corpus, and that the DUA does not substitute for or weaken that obligation.
- Legal review and execution authority: per gate G3's owner-role (`docs/governance/gates-registry.md:118`),
  DUA execution is a named-human legal/partnership act this SPIKE cannot perform — the exit artifact
  must identify what legal review this program needs (external counsel vs. partner-supplied template
  review) as a recommendation, not conduct that review itself.

### RQ3 — Retention period and deletion trigger

ADR-0006 explicitly declines to fix either value (`:133-137`) and the DF-E1-04 design spec repeats
that deferral (`:15, :100-103`), naming this SPIKE as the resolution point.

**Exit criterion**: because the actual retention period is a function of *which* partner/dataset RQ1
selects (a partner's own data-governance policy will frequently set an outer bound this program
cannot exceed regardless of preference), the future SPIKE run must produce a **decision framework**
now and a **concrete value** once a partner is selected, not invent a number in the abstract:
- **Framework** (answerable by this charter, in advance): retention is scoped to the minimum period
  needed to (a) complete the retrospective-validation run(s) the corpus was acquired for, and (b)
  support re-verification of a prior run's result if a discordance record (FR-23) is later disputed
  or adjudicated — not indefinite retention as a default, and not a fixed calendar duration invented
  without partner input.
- **Deletion trigger**: at minimum, one of — DUA term expiration; program abandonment of the specific
  validation effort the corpus was acquired for; partner-initiated revocation; or a fixed maximum
  duration if the partner's own policy sets one (whichever is shortest, if multiple apply).
- **Concrete values**: the SPIKE run, once a partner exists (RQ1), must record the partner's actual
  policy-imposed retention ceiling (if any), this program's proposed retention period within that
  ceiling, and the specific deletion trigger(s) that apply — as a provenance-carrying decision
  record analogous to the existing evidence-record pattern (`modules/*/evidence.json`), per
  ADR-0006's own instruction (`:129-132`) that no dataset-derived figure enters this repository
  without a traceable source.
- **Audit**: every access to the (externally-held) dataset, even fully de-identified, is logged with
  actor identity, timestamp, and purpose (ADR-0006 `:138-141`) — the SPIKE must confirm this
  obligation is satisfied by extending the *already-built* `tools/retro-validate/access-log.jsonl`
  mechanism (FR-22, P4-T7) to cover partner-corpus access specifically, not by inventing a second,
  separate audit mechanism; the SPIKE must also re-confirm that log stays structurally distinct from
  the review-record audit trail (ADR-0004), per ADR-0006's explicit instruction not to conflate the
  two (`:139-141`).

### RQ4 — Replay-pinning obligations

FR-19's version-pinned deterministic replay (`tools/retro-validate run --candidate-digest <registry
digest>`, implemented at P4-T3) resolves the KB/candidate side of pinning already: a validation
result is always attributable to one specific signed `releases/registry.json` entry, never "current
tree." That mechanism is built and does not depend on this SPIKE. What it does *not* yet resolve is
the **corpus** side of pinning — whether the *case data itself*, once real, is versioned in a way that
lets a validation result be reproducibly attributed to one specific corpus snapshot.

**Exit criterion**: the future SPIKE run must confirm, for whichever partner/dataset RQ1 selects:
- The partner supplies (or this program can independently establish) a stable corpus version
  identifier — e.g. a dataset release tag, an extraction-date snapshot, or a partner-issued version
  string — that can populate the `corpusId` field `tools/retro-validate/schemas/
  fixture-corpus.schema.json` already requires (`corpusId`, `sourceAttestation.ref`), so a future
  real-data `run-provenance.json` sidecar (FR-21) can name both the KB/candidate digest (already
  solved) and the corpus version (this RQ's job) without inventing a new provenance field.
- Whether the partner's corpus is static (a fixed extract) or continuously updated — if continuously
  updated, the SPIKE must state how a specific historical validation run remains reproducible against
  a corpus snapshot that may no longer exist in its original form at the partner (e.g. via a retained,
  DUA-permitted local snapshot within RQ3's retention framework, or via the partner's own
  point-in-time versioning if they offer one).
- That nothing in the replay-pinning design requires re-deriving or re-implementing FR-19's existing
  digest-pinning mechanism — the SPIKE's job is to confirm the corpus side can compose with it, not to
  redesign the KB/candidate side.

### RQ5 — De-identification standard

`tools/retro-validate/schemas/fixture-corpus.schema.json`'s `sourceAttestation.deidentificationStandard`
field already exists as an enum of exactly `null | "safe-harbor" | "expert-determination"` — the two
HIPAA de-identification methods (45 CFR § 164.514(b)) — with an explicit note in its own description
that the field "records a CLAIM about upstream process, not a guarantee this schema enforces or can
enforce." This SPIKE is where that claim gets evaluated before this program relies on it.

**Exit criterion**: for whichever partner/dataset RQ1 selects, the future SPIKE run must record:
- Which of the two standards the partner attests to, and what evidence backs that attestation (an
  Expert Determination requires a named, qualified expert's statistical/scientific determination and
  documentation of the analysis performed; Safe Harbor requires removal of all 18 HIPAA-enumerated
  identifier categories plus no actual knowledge the remaining information could identify an
  individual — the SPIKE must state which the partner claims and whether the partner will produce
  supporting documentation, not merely assert compliance).
- An explicit statement of what this program can and cannot independently verify about that claim —
  consistent with SPIKE-006's own discipline of stating a threat model "with no euphemism"
  (`spike-006-kb-signing-key-custody-verification.md` RQ1's exit criterion): if this program has no
  practical way to audit a partner's de-identification methodology beyond their attestation, the SPIKE
  must say so plainly rather than imply a verification capability that does not exist.
- Confirmation that the resulting corpus, once ingested, is tagged `provenance: deidentified` (never
  `synthetic`) and carries `sourceAttestation.deidentificationStandard` populated with the confirmed
  value — both already enforced structurally by `tools/retro-validate/schemas/fixture-corpus.schema.json`
  once a real corpus exists; this RQ supplies the value, the schema already supplies the enforcement.
- That no case, regardless of a partner's de-identification claim, may carry any of the identifier
  fields the fixture-corpus schema already structurally forbids (name, MRN, DOB, address, contact,
  SSN-like patterns) — a partner's Safe-Harbor or Expert-Determination attestation is a claim about
  their upstream process, not a substitute for this program's own structural boundary, which stays
  enforced regardless (P4-T1/T2, unaffected by this SPIKE's outcome).

### RQ6 — Success/verdict criteria for the future SPIKE run

**Exit criterion**: the future SPIKE run is closed only when all of the following hold, modeled
directly on the discipline SPIKE-006 established and this program's own CLAUDE.md honesty posture:
1. RQ1–RQ5 each have a recorded, explicit answer — not a placeholder, and not "TBD" carried forward a
   second time. If RQ1 finds no viable Option-1 partner within a reasonable investigation window, that
   is itself a valid, honest answer (see RQ1's finding-not-forcing instruction) — but it must be stated
   as a finding, with the Option-2-revisit trigger flagged, not silently left open.
2. The overall recommendation is an explicit **GO/NO-GO** on proceeding toward gate G3 with a named
   candidate partner/dataset — not a menu of options presented as equally live. Per SPIKE-006 RQ6's own
   framing: "This recommendation must be made even if it is uncomfortable — the charter's job is to
   force the honest answer, not the more impressive-sounding one."
3. The recommendation is routed through independent review (`council-review`, per this program's
   AOS conventions, before it is treated as final — the same discipline SPIKE-006's Method step 4
   required and SPIKE-006's own OQ-8 finding shows matters in practice: SPIKE-006 was originally marked
   complete without that review having actually happened, a gap only caught and closed later. This
   SPIKE's future run must not repeat that sequencing mistake — route through review *before* declaring
   the SPIKE complete, not after.
4. The honesty boundary this program requires is stated explicitly in the SPIKE's own output: a
   completed SPIKE-007 (even with a GO recommendation and a named partner) is **not** itself a cleared
   gate G3 — G3 additionally requires an executed DUA (a separate human/legal act, RQ2) — and is
   **never** clinical validation, regulatory clearance, or IRB approval of anything. The SPIKE
   identifies a data source and terms; it does not itself validate the program's clinical output.
5. If the recommendation is GO, RQ3's retention/deletion values and RQ4's corpus-versioning
   confirmation are recorded as concrete, partner-specific answers (not left as the abstract
   framework this charter poses) — per the design spec's own instruction that DF-E1-04 cannot fix
   those values until this SPIKE identifies the actual partner.
6. If the timebox (to be set by the human commissioning the future run, not fixed here — this
   charter is explicitly silent on a specific hour count because, unlike SPIKE-004/005/006, this
   SPIKE's critical path runs through external partner engagement, not internal codebase research,
   and cannot be timeboxed the same way) expires before all of RQ1–RQ5 resolve, the SPIKE must record
   which remain open and must not present a partial result as a final GO recommendation — an
   incomplete SPIKE with an honest "not yet resolved" status is preferred over a rushed, overconfident
   verdict, consistent with this program's "no invented thresholds" guardrail extended to data-source
   decisions.

## Method (for the future SPIKE run — not performed now)

1. Re-confirm this charter's premises against source at run time (ADR-0006's current status,
   `tools/retro-validate/schemas/fixture-corpus.schema.json`'s current shape, `docs/governance/
   gates-registry.md`'s G3 entry) rather than trusting this document's snapshot, since any of those
   may have changed between charter authoring and SPIKE execution.
2. For RQ1, this is primarily an external-engagement/business-development exercise (identifying and
   approaching candidate partners), not a codebase-research exercise — the human(s) named as G3's
   owner-role (`docs/governance/gates-registry.md:118`) drive this step; an agent's role is
   documentation and option-comparison support, not partner outreach itself.
3. For RQ2/RQ3/RQ5, once a candidate partner is identified, gather their actual data-governance
   policy, DUA template (if any), and de-identification-method documentation as primary sources rather
   than assuming generic answers.
4. For RQ4, cross-check the selected partner's versioning practice against `tools/retro-validate`'s
   existing `corpusId`/`sourceAttestation` schema fields (already built, P4-T1) to confirm no schema
   change is needed — if one is, flag it as a follow-on implementation item, not something this SPIKE
   implements itself.
5. Route RQ1's partner-selection reasoning and the RQ6 overall recommendation through
   `council-review` before treating either as final (RQ6 criterion 3).

## Success/verdict criteria — summary

Restated compactly per FR-25's explicit requirement for "explicit success/verdict criteria for the
future SPIKE run": the SPIKE is successful when it produces an honest, council-reviewed GO/NO-GO on a
named candidate partner/dataset (or an honest NO-GO/not-yet-viable finding), with RQ2's DUA-content
checklist, RQ3's concrete retention/deletion values, RQ4's corpus-versioning confirmation, and RQ5's
de-identification-standard attestation all resolved for that specific candidate — and it is
unsuccessful (per RQ6.6) if it renders a rushed verdict without completing that set, or if it is
marked complete without the RQ6.3 independent-review step actually having occurred.

## Decision impact

| Item | Blocking? | Default/fallback if this SPIKE is never run |
|---|---|---|
| Gate **G3** (`docs/governance/gates-registry.md:113-121`) | **Direct, hard block.** G3's entry criteria require both this SPIKE reaching a recorded GO/NO-GO verdict *and* an executed DUA — this SPIKE not running means G3 cannot open at all, by definition. | G3 stays permanently unopened; `tools/retro-validate`'s harness continues operating exclusively against synthetic + de-identified fixtures indefinitely (not a temporary state — the current schema-forced structural rejection of any other input, P4-T1/T2, does not expire or soften on its own). |
| `DF-E1-09` (real-data retrospective run, gated on G3 cleared + protocol thresholds set by named humans) | Hard block, transitively via G3. | Stays a deferred item indefinitely; no real-data retrospective validation ever occurs. |
| `docs/project_plans/design-specs/retrospective-validation-harness.md` (DF-E1-04) retention/deletion-trigger gap | Hard block on that spec's own stated resolution path — the spec names this SPIKE as the only way those two values get fixed. | The design spec's retention/audit section stays "flagged open" indefinitely, and any future design-spec update (P5-T8 per the E1 plan) inherits the same open flag rather than resolving it. |
| The CLAUDE.md validation ladder's **retrospective** rung, in its real-data sense | Soft-to-hard: ADR-0006's Option 3 (synthetic/case-report corpus, already built via `tools/retro-validate` + the P4-T8 E0-dangerous-miss adapter) provides a *continuous regression complement*, but ADR-0006 itself states that option alone "cannot, by itself, satisfy the 'retrospective' rung ... in the sense that ladder intends" (`0006-validation-data-boundary-deidentification.md:105-109`). | The program can keep claiming only synthetic/fixture-level software agreement (already true today, unaffected by this SPIKE) — it can never claim to have passed a genuine real-world retrospective-validation rung without this SPIKE running and G3 clearing. |

**If never run**: the default, permanent state is exactly today's state — a fixtures-only harness
that structurally cannot accept real data, no real-data retrospective claim ever made, and the
program's honesty posture (CLAUDE.md: "unvalidated research prototype") holds without qualification
for exactly that reason. Skipping this SPIKE is not a software regression; it is a decision to never
attempt the real-data half of the retrospective validation rung, which is a legitimate — if
program-limiting — outcome, not a defect.

## Honesty boundary — read this before citing this charter

This document is a **charter only**. It contains no research findings, no partner selection, no DUA
terms, no retention period, no deletion trigger, and no de-identification-standard determination — it
poses the questions a future SPIKE run must answer and the bar that run's verdict must clear. Nothing
in this document may be read as: a decision that any specific data partner has been selected or
contacted; a statement that a DUA exists or is in negotiation; a retention period or deletion trigger
this program has adopted; a confirmed de-identification standard for any real corpus; or any form of
clinical validation, regulatory clearance, or IRB approval. Gate **G3** remains fully closed, and
`tools/retro-validate`'s harness remains structurally restricted to synthetic and de-identified
fixtures only, exactly as it was before this charter was authored.

## Citations

- `docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md:379` (FR-25), `:104` (binding
  rulings R1–R6 authorship note), `:326-334` (§6.0 external human gates, ruling R4).
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md:352-363` (OQ-5),
  `:390-394` (PRD OQ-6, E0 dangerous-miss adapter), `:426` (FR-25 → P4-T9 coverage row).
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-2-4-workstreams.md:97-106`
  (P4-T1..T9 task table — this charter's six required content areas are drawn directly from the P4-T9
  row).
- `docs/adr/0006-validation-data-boundary-deidentification.md` (full document — the primary
  architectural input; `status: proposed`, not accepted, per gate G0).
- `docs/governance/gates-registry.md:113-121` (G3 — Data-source SPIKE verdict + data-partner DUA).
- `docs/project_plans/design-specs/retrospective-validation-harness.md` (DF-E1-04 — the design spec
  this SPIKE's future run unblocks on the retention/deletion-trigger and data-source-identity axes).
- `docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md` (the discipline model
  this charter's RQ6 and Method are patterned on, including its OQ-8 lesson about sequencing
  independent review before, not after, declaring a SPIKE complete).
- `tools/retro-validate/schemas/fixture-corpus.schema.json` (the already-built structural boundary
  this SPIKE's outcome must compose with, not modify).
- CLAUDE.md validation ladder (content → technical → retrospective → silent-mode → human-factors →
  interventional) and "unvalidated research prototype" status line.
