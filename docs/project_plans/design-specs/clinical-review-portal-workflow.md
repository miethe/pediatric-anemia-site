---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry Buildout: Clinical Review Portal/Workflow (DF-E1-01)"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-22
feature_slug: "evidence-foundry-buildout"
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
adr_ref: docs/adr/0004-clinical-approval-identity-adjudication.md
problem_statement: "E1 needs a clinical review portal/workflow that gives named clinical reviewers a review-state model, independent dual review, adjudication, and release authorization, none of which E0 built or was scoped to build."
open_questions: []
explored_alternatives:
  - "Append-only, git-signed review files in the module package layout — ADR-0004's recommended default for E1 v1; zero new infrastructure, reuses the hash/signature substrate this plan's Phase 5 manifest work and ADR-0005 already build, but has poor reviewer ergonomics (no UI, no notifications, git literacy required of non-engineer clinical reviewers)."
  - "Dedicated clinical review portal web application — this spec's own eventual subject; purpose-built reviewer UX (queues, diffs, side-by-side passage/rule view, roster/credential management), but is new infrastructure (auth, hosting, its own threat model as a second trust boundary distinct from the public microsite) that ADR-0004 explicitly hands off rather than builds."
  - "Generic issue tracker (e.g. GitHub Issues/PRs) as the review record — rejected in ADR-0004: mutable/force-pushable state is not tamper-evident, no native cryptographic binding of reviewer identity to content hash, and it conflates engineering workflow tooling with a clinical governance record."
---

# Evidence Foundry Buildout: Clinical Review Portal/Workflow (DF-E1-01)

## Problem / Context

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §5.1 places independent
clinical review, laboratory review, and adjudication as a distinct gate (`G5`) — strictly after
evidence council (`G3`) and converter eligibility (`G4`), strictly before executable technical
verification (`G6`) and signed release (`G8`). §5.3 is explicit that `rf council`'s adversarial
evidence review is not a substitute for clinical content review, laboratory review, or adjudication:
council "can block evidence handoff; cannot approve clinical release." §5.3 names five minimum roles
this gate must eventually support — clinical content review 1, clinical content review 2 (independent,
"must not merely countersign reviewer 1"), laboratory review, adjudication (named adjudicator, not the
sole original author), and release authorization (the only gate that marks a KB pack release-ready).

None of this exists today. This feature (E0, `evidence-foundry-buildout-v1`) is scoped to
deterministic wire-up only — per the plan's decisions block §1, E0 ships **zero clinical review UI**.
Every module package the converter produces (including `modules/cbc_suite_v1/`) carries
`status: "unsigned-stub"`, `clinicalContentHash: null`, `approvedBy: []` — a proposal no clinical
reviewer has yet seen, precisely so this feature can exist without the review workflow this spec
addresses being built or even fully decided. CLAUDE.md's hard guardrail — "No AI-published rule
changes. Rule/KB edits require independent clinical review + executable tests + signed release" — is
binding today with zero tooling behind it beyond human discipline.

## Current State (what E0 actually shipped)

E0 shipped the substrate this spec's eventual design will sit on top of, but nothing review-specific:

- A module package layout (`modules/<id>/module.json`, `rules.json`, `candidates.json`,
  `evidence.json`, `evidence-assertions.json`, `rule-provenance.json`) that a review record could
  reference by path and content hash.
- Phase 5's canonical-serialization/manifest work (determinism-proven), the substrate ADR-0005's
  signing decision — and by extension this spec's reviewer-signature model — builds on.
- Zero reviewer roster, zero review-state model, zero UI, zero notification mechanism, and no
  mechanism to bind a named reviewer's signature to a specific content hash. `approvedBy` is an
  empty array schema placeholder only (see `docs/project_plans/design-specs/signed-kb-manifest.md`,
  DEF-4) — nothing reads or writes it.

## What E1 Actually Shipped (Phase 2, `tools/review-record/`)

E1 (this feature's own plan, `evidence-foundry-e1-v1`) built exactly ADR-0004's recommended default
end to end — the append-only files-plus-CLI workflow this spec's "Design Sketch" above described in
the abstract is now real, working software, not a proposal. This section records its **actual**
shape so a future `committed`-maturity revision of this spec (or the human deciding OQ-8) is
grounding a portal design in what exists, not in what was originally sketched.

**Store layout** (`tools/review-record/lib/store.mjs`, "OQ-2 store layout"):

```
modules/<module_id>/reviews/rr-<seq4>-<role>.yaml
```

One append-only file per review act — never mutated in place; corrections are new
`supersedes: <review_id>` records. `<seq4>` is a zero-padded, four-digit sequence number **global
per module** (shared across all five roles, not per-role), and `<role>` is one of `clinical-1`,
`clinical-2`, `lab`, `adjudication`, `release-auth`. Each record chains to its immediate
predecessor via a `previousRecordHash` field over `lib/chain.mjs`'s canonical hash — the one
hashing/serialization convention this tool, its signature preimage, and E0's manifest work all
share. Append-only is enforced two ways, both fail-closed: (a) the `previousRecordHash` chain,
always checked; (b) an opt-in `validate --history` pass over local `git log --name-status`, scoped
to a module's `reviews/` path, that fails closed if any record path was ever touched by more than
one commit.

**Roster** (`governance/reviewer-roster.yaml`, `schemas/reviewer-roster.schema.json`): a flat list
of `{reviewerId, name, credentialRef, moduleScopes[], synthetic}` entries. `scaffold` resolves
`reviewerId` against this file and fails closed on an unknown identity or an out-of-scope module.
The roster ships with **zero `synthetic: false` (real) entries pre-G1** by design (FR-3) — the only
content it carries today is the five `synthetic: true`, clearly-labeled
("SYNTHETIC — NOT A CREDENTIALED REVIEWER") dry-run personas P2-T8 added, scoped only to
`cbc_suite_v1`. Adding a real entry is a human act gated by G1 (roster credential verification) that
no task, tool, or agent in this repository performs.

**CLI verbs** (`tools/review-record/cli.mjs`, verb-dispatch over `lib/verbs/`): `list` (informational
per-module state summary), `scaffold` (builds a draft — prints a preview rather than writing to disk
for every identity kind that currently exists, since every resolvable `reviewerId` is
`synthetic: true` and `scaffold` owns no signing capability), `validate` (schema shape + roster
resolution + FR-4 reviewer-2 independence heuristic + append-only chain/history enforcement + FR-5
adjudicator≠author + FR-6 release-authorization validity + FR-10 Ed25519 signature verification —
all module-wide, fail-closed), `render` (read-only static HTML, see below), and `dry-run` (the one
code path that composes scaffold + ephemeral `TESTKEY-` signing + validate into an end-to-end
five-role pass, and the only code path that ever writes a `synthetic: true` record to disk).

**Render** (`tools/review-record/lib/render.mjs`, `render` verb, P2-T6): reads a module's already-
committed review-record chain plus (when present) `traceability-index.json` and
`evidence-assertions.json`, and writes ONE self-contained, deterministic `<!doctype html>` file per
record plus an index — explicitly not a portal: no server, no database, no write path back into
`modules/`, no auth, no `<script>` tag, and no `<a href>` at all (so no third-party/remote asset or
URL can ever appear). Every page carries the shared `UNVALIDATED_PROTOTYPE_BANNER` (the same string
`tools/retro-validate` uses for its own reports) in a header and footer, and every `synthetic: true`
record's card carries a non-qualifying-record label. Passage text renders inline only under the
`public_short_excerpt` display policy with a non-empty exact passage; every other case (including
missing/ambiguous data) renders as a hash-and-selector reference block instead of guessing — matching
this program's "missingness is never treated as normal" guardrail.

**What this confirms about the Design Sketch above**: ADR-0004's five-step model (independent files
per role, roster-verified identity, signature binding content hash to identity, independent
reviewer-2, distinct adjudication record, release-authorization as the sole terminal transition) is
not just a paper design — it is implemented, tested, and exercised end to end (P2-T8) with zero
deviation from the sketch's shape. The portal question this spec exists to answer is therefore now
squarely about the **ergonomics of that already-working file model**, not about whether the
underlying data/process model is sound.

## Friction Evidence — First OQ-8 Trigger Input (P2-T8 Dry-Run)

FR-11 required the Phase 2 five-role synthetic dry-run to "emit the first friction observations" —
the first evidence feed for PRD OQ-8 ("Portal friction trigger — what measurable friction threshold
promotes DF-E1-01, and who calls it?"). That observation note lives at
`.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md` and is summarized here as this spec's
first concrete friction evidence. It comes from one automated, single-session dry-run pass by the
tool-building agent — **not** from an independent human reviewer's first real use — and it explicitly
disclaims making any promotion recommendation.

1. **`scaffold` cannot itself produce a file for the only identity kind that currently exists.**
   Every roster entry today is `synthetic: true`, which the schema requires a `TESTKEY-` signature
   on; `scaffold` owns no signing capability, so it prints a draft preview instead of writing a file,
   and there is no general-purpose `sign` verb on the CLI — signing composition lives only inside the
   E1-scoped, synthetic-only `dry-run` shortcut. A human following `scaffold --help` literally would
   reasonably expect a file after a successful invocation.
2. **The five roles must share one `subjectContentHash`, computed once and pasted by hand into five
   separate invocations.** A single transposed character would not fail loudly at entry (the flag
   only checks `sha256:<64 hex>` shape) — it would surface much later, as an "incomplete record set"
   finding once someone finally runs `validate`.
3. **`validate`'s module-wide checks re-run over the whole record set on every invocation**, not just
   the newest record (correct by design — chain integrity is not a per-record property) — a human
   iterating role-by-role re-pays the same authorship-union git-history computation on every call.
4. **The terminal "structurally non-qualifying" state needs its own explanation to not read as a
   bug.** After all five synthetic records land, `validate` correctly rejects the `release-auth`
   record (FR-6: synthetic sets can never qualify) — a human running the steps by hand, without
   `dry-run`'s own closing message naming this as the expected end state, has no way to tell a
   by-design terminus from a mistake.
5. **Nothing surfaces cross-record coordination state** (who has reviewed, whose turn is next) other
   than manually running `list` or listing the directory — no notification, queue, or "your turn"
   signal exists for the five separate participants a real review act would involve.

The note is explicit that none of this is a defect report — every behavior above is the tool working
exactly as designed (FR-3/FR-6/FR-9's fail-closed, append-only, non-synthetic-only posture) — and
that it measures tool-mechanics friction from one automated pass, not real reviewer usability. It
neither proposes a friction threshold nor a promotion decision.

## Portal-Promotion Decision Framework (OQ-8)

`clinical-review-workflow-v1` Phase 4 (task P4-T1) answers PRD OQ-8 with a committed decision
framework at `.claude/worknotes/clinical-review-workflow/friction-observations.md`. That file is
the single source of truth for the framework's mechanics — it is BOTH the running friction
observation log AND the promotion-decision framework — and this section only summarizes its four
required elements and links to it, per that file's own stated convention. Nothing below adds to,
weakens, or resolves what this spec's "Promotion Trigger" section already says: the framework
*informs* a future human decision, it does not make one, and it clears no clinical gate (G0–G4;
`docs/governance/gates-registry.md`).

1. **Friction-metric categories + observation-log format** (friction-observations.md §2–§3) — six
   qualitative categories (never machine-emitted telemetry): coordination/turn-taking
   (`F-COORD`), onboarding/git-literacy (`F-ONBOARD`), error-entry/recovery (`F-ERROR`), validate
   latency (`F-LATENCY`), interpretability (`F-INTERP`), and review volume (`F-VOLUME`); plus a
   committed-markdown, append-only observation-log format (a per-entry template and a running
   table). The framework restates PRD FR-16's zero-telemetry / zero-network / zero-third-party-
   analytics constraint verbatim in its §1 — every entry is typed by hand by a human (or an agent
   transcribing a human's stated observation) and committed to git; nothing in
   `tools/review-record/` emits a metric that feeds this log.
2. **Promotion threshold — a first-cut PROPOSAL, pending human ratification** (friction-observations.md
   §4) — an explicit necessary precondition (at least one real, post-G1 reviewer
   must have actually used the workflow; every observation on record today comes from a single
   automated dry-run pass, so the threshold is **structurally un-meetable today**), plus an
   illustrative first-cut friction bar (F-COORD/F-VOLUME/F-ONBOARD counts, or any single
   `blocking`-severity observation on its own). The document is explicit that this threshold "has
   no force and triggers no action until the human decision-owner ... has explicitly ratified it" —
   meeting it authorizes only *convening* a decision, never building anything.
3. **Authorized human decision-owner — a role, never a person or an agent** (friction-observations.md
   §5) — the Evidence Foundry platform-engineering lead, who must consult the named
   clinical-governance lead before recording any decision to promote (a review portal is a second
   trust boundary distinct from the PHI-free public microsite this spec's own "Design Sketch"
   discusses below). The role is explicitly never an autonomous agent, a Claude Code session, an
   `rf`/ARC/`council-review` output, or a gate owner (G0–G4) acting in that capacity — mirroring
   this program's D-4 invariant that agent output cannot populate a reviewer/approver-shaped field.
4. **Decision-record template** (friction-observations.md §6) — the template a decision-owner
   copies into a new, committed decision record (an ADR if the outcome is a durable architectural
   commitment, or a dated entry in that file's §6.1 log otherwise) the one time a promotion
   decision is actually convened and recorded. No decision has been recorded yet (§6.1: "none yet —
   the threshold's necessary precondition ... is unmet").

See `.claude/worknotes/clinical-review-workflow/friction-observations.md` for the full framework
text, the seed observation-log entry (`OBS-000`, sourced from the P2-T8 synthetic dry-run —
explicitly not real-reviewer evidence), and the complete decision-record template.

## Design Sketch

ADR-0004 (`docs/adr/0004-clinical-approval-identity-adjudication.md`, `status: proposed`) resolves the
process/data-model question this spec would otherwise have to re-litigate from scratch: its
recommended default is **append-only, git-signed review files in the module package for E0/E1 v1**,
explicitly deferring the portal build below. Concretely, for the first operational module (CBC
Suite, E1):

1. Each independent review (clinical content review 1, clinical content review 2, laboratory review,
   adjudication, release authorization) is a versioned, append-only YAML/Markdown file under source
   control (e.g. `modules/<module_id>/reviews/<review_id>.yaml`), never mutated in place.
2. Reviewer identity is a named individual with an out-of-band-verified credential record tracked in
   a reviewer roster — never an automated agent, never an ARC/council output.
3. "Signature" is a cryptographic signature (the ADR-0005 key-custody mechanism) binding reviewer
   identity to the exact content hash of the material under review.
4. Reviewer 2 reviews independently, with no read dependency on reviewer 1's file.
5. Adjudication is a distinct signed file, produced only on disagreement, by a named adjudicator who
   is not the sole original author.
6. Release authorization is the terminal signed file; only its existence flips a KB pack from
   `unsigned-stub`/`review-pending` to `release-ready`.

This spec's own subject — Option 2 in ADR-0004's options (a dedicated review portal web application)
— is the follow-on this ADR names but declines to build: purpose-built reviewer UX (queues, diffs,
side-by-side passage/rule view), roster and credential management surfaced in-app, and enforcement of
the independent-review-before-disclosure rule at the application layer rather than by file-schema
convention alone. ADR-0004's stated trigger for promoting this from "append-only files" to "portal" is
review volume or reviewer feedback demonstrating the git-based workflow's friction is load-bearing —
not a fixed date or review count.

Building the portal also requires resolving its own trust boundary: a clinical review surface that
displays real evidence content and (once real reviewers use it) real reviewer identities is a
different threat model than the public, PHI-free microsite CLAUDE.md governs — it needs its own
security review before design work here can commit to an architecture, which is why this spec starts
at `maturity: shaping` rather than `committed`.

## Concept Mockups (CONCEPT-ONLY)

Phase 4 (task P4-T2) attached one CONCEPT-ONLY watermarked mockup image to inform — never to
specify or schedule — what a future portal's reviewer UX might look like, generated on the
operator-directed codex gpt-5.6 native image tool:

- `docs/project_plans/design-specs/assets/clinical-review-portal-concept-v2.png` — an illustrative
  review-queue + rule/evidence + decision UI concept. The image itself carries a full-width
  "CONCEPT ONLY — NOT COMMITTED" watermark banner plus a footer disclaimer ("This is a conceptual
  user interface for a future state. Layout, content, and interactions are subject to change and
  are not committed for v1.") baked into the rendered pixels.

`docs/project_plans/design-specs/assets/asset-manifest.md` is the docs-truth-checkable registry for
this and any future asset under that directory (watermark string, generation lane, origin task) —
that manifest, not this spec, is the source of truth for the asset registry itself, and
`tests/portal-concept-assets-manifest.test.mjs` fails closed on any image/manifest drift (a new
image with no manifest row, or a manifest row naming a file no longer present).

This image is not a specification, not a schedule, and not evidence that a portal has been
authorized — it is one input to the "Portal-Promotion Decision Framework" above, nothing more. This
spec's `maturity` stays `shaping` regardless of anything shown in it.

## Promotion Trigger

Per ADR-0004: E1 plan approved, reviewer roles named, and either (a) review volume across modules
makes the append-only-file workflow demonstrably unworkable, or (b) reviewer feedback identifies the
git-based friction as load-bearing. Do not build a portal preemptively — E1 v1 uses ADR-0004's
append-only file model first.

**Restated after Phase 2 (E1) shipped that model**: the boundary above is unchanged by the fact that
the file+CLI workflow now exists and works. The five mechanics-level friction observations recorded
above are *evidence to inform* a future human decision — they are not themselves a trigger, and this
spec takes no position on whether they clear any threshold. Promotion to a portal remains gated on:
(1) real, non-synthetic reviewers actually using the workflow (every observation so far comes from a
single automated dry-run pass, never an independent human's first real use); and (2) an explicit
human call, per OQ-8, on whether the friction observed at that point is load-bearing enough to justify
building and securing a second trust boundary (see "Design Sketch" above on the portal's own,
unresolved security-review need). No task, tool, or agent in this repository is authorized to make
that call or to begin portal implementation pre-emptively on the strength of this note alone.

**Framework now exists (Phase 4, P4-T1)**: see "Portal-Promotion Decision Framework (OQ-8)" above
for the friction-metric categories, the first-cut threshold proposal, the named decision-owner
role, and the decision-record template that future call will use. As of this writing, that
framework's own necessary precondition remains unmet — no real, post-G1 reviewer has used the
workflow yet — so no promotion decision can be convened today; the framework document, not this
spec, is the single source of truth for that mechanism's detail.

## Open Questions

Recorded here in prose (frontmatter `open_questions` intentionally left empty at this shaping stage,
per this feature's Phase 7 task instruction — these are the questions a `committed`-maturity revision
of this spec will need to resolve):

- **[Answered by E1 Phase 2, for the current file model]** Where does the reviewer roster live, and
  how are credentials verified out-of-band before a reviewer is added to it? It lives at
  `governance/reviewer-roster.yaml` (`schemas/reviewer-roster.schema.json`), gated by G1
  (`docs/governance/gates-registry.md`) for any real entry — a human recruits and independently
  verifies a named, credentialed reviewer and commits the resulting entry with a populated
  `verificationRef`; no task, tool, or agent performs that verification. This answers the
  file-model's roster mechanics; it does **not** resolve whether a future portal owns this same file
  as its backing store or a separate credential-management surface — that half of the question is
  still open below.
- Does the portal read the same append-only review files ADR-0004 defines as its backing store (portal
  as a UI layer over the file model), or does it own its own database once built — and if the latter,
  how does that reconcile with the append-only, tamper-evident property clinical review records need?
- **[First-cut framework drafted, Phase 4 P4-T1 — pending human ratification]** What is the actual
  friction threshold (review count, reviewer complaint volume, calendar time) that triggers building
  this, and who is authorized to make that call? The P2-T8 dry-run friction note (see "Friction
  Evidence" above) was the first evidence feed toward answering this; the framework at
  `.claude/worknotes/clinical-review-workflow/friction-observations.md` (see "Portal-Promotion
  Decision Framework" above) now proposes a first-cut threshold (§4) and names the decision-owner
  role (§5), but is explicit that every number is non-binding until that role ratifies it, and that
  the threshold's own necessary precondition (a real, post-G1 reviewer having used the workflow) is
  unmet today. This question therefore stays open until both ratification and a first real-reviewer
  observation exist — the framework is a proposal, not the answer.
- How does the portal's authentication/authorization model interact with the reviewer-credential
  verification ADR-0004 requires — does the portal itself verify credentials, or only display a
  roster verified elsewhere?
- Now that the CLI's actual verb surface exists (`list`/`scaffold`/`validate`/`render`/`dry-run`), does
  a portal wrap those same operations as a UI (thin layer, reusing `lib/*.mjs`), or reimplement its
  own review-state logic against the same files — and what does that imply for keeping one
  canonicalization/validation implementation rather than two independently-drifting ones?

## References

- `docs/adr/0004-clinical-approval-identity-adjudication.md` — this spec's seed ADR; recommended
  default and all three `explored_alternatives` above are drawn directly from its Options section.
- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §5.1, §5.3, §8.1.
- `docs/project_plans/design-specs/signed-kb-manifest.md` (DEF-4) — the manifest fields
  (`approvedBy`, `clinicalContentHash`) this review model populates.
- `docs/project_plans/design-specs/retrospective-validation-harness.md` (DF-E1-04) — depends on this
  spec's reviewer-identity/signature model plus an independent data-source SPIKE.
- CLAUDE.md hard guardrails: "No AI-published rule changes"; ARC clinical-council non-qualification
  note in the AOS-assets index.
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md` (Phase 2,
  tasks P2-T1..P2-T8) — the plan that actually built the file+CLI workflow this spec's "What E1
  Actually Shipped" section describes.
- `tools/review-record/README.md` — canonical, code-level documentation of the shipped CLI, store
  layout, roster resolution, signature binding, and render behavior; this spec summarizes it but does
  not restate it in full — that README is the source of truth for implementation detail.
- `.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md` (P2-T8, FR-11) — the full first
  friction-observations note this spec's "Friction Evidence" section summarizes.
- `governance/reviewer-roster.yaml`, `schemas/reviewer-roster.schema.json` — the shipped roster this
  spec's roster-mechanics open question now answers for the current file model.
- `.claude/worknotes/clinical-review-workflow/friction-observations.md` (Phase 4, P4-T1, FR-15/
  FR-16/OQ-4/OQ-8) — the single source of truth for the "Portal-Promotion Decision Framework"
  section above: friction-metric categories, the running observation log, the first-cut threshold
  proposal, the decision-owner role, and the decision-record template. This spec summarizes it but
  does not restate it in full.
- `docs/project_plans/design-specs/assets/asset-manifest.md` (Phase 4, P4-T2, FR-17) — the
  docs-truth-checkable CONCEPT-ONLY watermark registry for the mockup image the "Concept Mockups"
  section above links.
- `docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md` (Phase 4,
  tasks P4-T1..P4-T3) — the plan that authored the portal-promotion framework and concept mockups
  this revision integrates (distinct from this spec's frontmatter `plan_ref`,
  `evidence-foundry-buildout-v1`, which is the plan that shipped the file+CLI substrate this spec's
  "What E1 Actually Shipped" section describes).
