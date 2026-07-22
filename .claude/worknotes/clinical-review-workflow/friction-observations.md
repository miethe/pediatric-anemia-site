# Portal-Promotion Framework & Friction Observation Log (OQ-8)

**Task**: P4-T1 (clinical-review-workflow-v1) · **Answers**: PRD OQ-8 / OQ-4, FR-15 / FR-16 ·
**Feature slug**: `clinical-review-workflow` · **Author**: Opus judgment pass, 2026-07-22

> **Purpose.** This document is BOTH (1) the committed markdown observation log that captures
> friction with the shipped append-only file + CLI review workflow (`tools/review-record/`), and
> (2) the OQ-8 *portal-promotion decision framework* that says how that log is read, what
> first-cut threshold is proposed for convening a promotion decision, which human role owns that
> decision, and how the resulting decision is recorded. Sibling task **P4-T3** references this
> file's framework sections from `docs/project_plans/design-specs/clinical-review-portal-workflow.md`
> (`maturity: shaping`, unchanged); this file is the single source of truth for the framework's
> mechanics, and the design spec summarizes rather than restates it.

---

## 0. What this document is — and what it is NOT

**Status: unvalidated research prototype.** This framework proves *process mechanics* only. Nothing
in it is, or may be read as, clinical validation, a clinical sign-off, a regulatory clearance, or
approval of anything. It clears **no** gate: not G0 (ADR-0004 ratification), not G1 (real-reviewer
roster), not G2 (signing custody), not G3/G4 — see `docs/governance/gates-registry.md`. Building a
review portal is an *infrastructure/product* decision this framework helps a human make; it is not
one of the five clinical-governance gates and does not substitute for any of them.

This document, by itself:

- **makes no recommendation** about whether, when, or how to build a review portal — that call
  belongs to the named human decision-owner in §5, informed by (not dictated by) the log in §3;
- **cannot self-trigger any action.** A threshold being "met" (§4) authorizes exactly one thing:
  the decision-owner *convening a decision* and recording it via the template in §6. It never, on
  its own, authorizes writing portal code, standing up hosting, or opening a second trust boundary;
- **is not a defect report.** "Friction" here means "manual-coordination cost of the current
  file + CLI shape," never "the tool is broken." Every behavior the log records is the substrate
  working exactly as designed (FR-3 / FR-6 / FR-9: fail-closed, append-only, synthetic-only pre-G1).

The first evidence feed into this log — the P2-T8 five-role synthetic dry-run — already exists at
`.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md`; §3.3 links its five observations as
the log's seed row. That note, like this one, explicitly disclaims proposing a promotion decision.

---

## 1. Zero-network / zero-telemetry constraint (restated verbatim — binding)

Friction is captured **only** as committed markdown in this repository. There is no automatic
capture, no instrumentation, and no external service anywhere in this framework. PRD **FR-16** is
restated here verbatim, unaltered, and is binding on every observation this log ever holds:

> Friction observations are captured only as committed markdown files in this repository —
> **zero telemetry, zero network, zero third-party analytics**.
> The framework MUST explicitly restate this constraint.

This is the same posture the root `CLAUDE.md` hard guardrail names for the public microsite —
"no third-party scripts/fonts/analytics" — carried to the review-workflow boundary. Concretely,
for this framework:

- **No telemetry.** No metric is emitted by any running process. Every entry in §3 is typed by hand
  by a human observer (or by an agent transcribing a human's stated observation, never inventing
  one) and committed to git. There are no counters, spans, trace IDs, event hooks, or structured
  logs anywhere in `tools/review-record/` that feed this log — the substrate's own zero-network,
  zero-LLM grep tests already enforce that at the code layer.
- **No network.** Nothing in this framework fetches, posts, phones home, or contacts any host.
  Observations never leave the repository; the "store" is the committed file you are reading.
- **No third-party analytics.** No analytics SDK, no dashboards, no aggregation service. The only
  "aggregation" is a human reading the markdown table in §3 with their own eyes.

Any future proposal to add automated friction capture is out of scope here and would itself require
its own review — it is explicitly **not** authorized by this framework.

---

## 2. Friction-metric categories (element **a**, part 1)

Friction is classified into six categories. Each names *what* is being observed and *how* a human
would notice it — never a machine-emitted number. Categories are qualitative buckets, not scored
telemetry. The first five map directly onto the five P2-T8 dry-run observations (§3.3); the sixth
(volume) is the ergonomic pressure ADR-0004 itself names as a promotion trigger and can only be
observed once more than one module is in active review.

| ID | Category | What it captures | How a human notices it (no telemetry) |
|----|----------|------------------|----------------------------------------|
| **F-COORD** | Coordination / turn-taking | No queue or "your turn" signal across the five separate review acts; participants must run `list` (or read the directory) to learn whose turn is next. | A reviewer logs that they were blocked waiting, or acted out of turn, because nothing told them the prior role had finished. |
| **F-ONBOARD** | Onboarding / git-literacy | A non-engineer clinical reviewer cannot complete their assigned role end-to-end (scaffold → correction-via-`supersedes` → commit) without engineer hand-holding. | A reviewer (or the engineer helping them) logs that the git/CLI mechanics — not the clinical judgment — were the blocker. |
| **F-ERROR** | Error-entry / recovery | A wrong or transposed `subjectContentHash`, an out-of-order act, or a botched correction reaches `validate` instead of being caught at entry time. | An observer logs an incident that surfaced late (as an "incomplete record set" or chain finding) rather than at the point of the mistake. |
| **F-LATENCY** | Validate latency | `validate`'s module-wide checks (chain, independence, authorship-union, release-auth) re-run over the whole set on every call; a reviewer perceives it as slow enough to impede iteration. | A reviewer logs a wait long enough to change their behavior (batching, skipping re-validation). Note: the incremental-cache work in Phase 2 targets exactly this — log residual latency *after* that lands. |
| **F-INTERP** | Interpretability | A by-design terminal or fail-closed state (e.g. "structurally non-qualifying" for a synthetic set) is read as a bug because its meaning is not obvious at the point it appears. | A reviewer logs confusion / a mistaken "something is broken" reaction to a correct, by-design outcome. |
| **F-VOLUME** | Review volume | The number of modules and/or concurrent review acts under active human review grows past what manual `list`-based coordination can carry. | An observer logs that coordinating N concurrent module reviews by hand has become unmanageable (ADR-0004's own named promotion pressure). |

**Severity** is likewise qualitative — a human judgment, not a computed score — recorded as one of:

- `blocking` — a real reviewer could **not** complete a required review act at all via the
  file + CLI path (the strongest single signal; see §4);
- `impeding` — completed, but only with material extra effort, a workaround, or engineer help;
- `minor` — noticed and noted, but did not change the outcome.

---

## 3. Observation-log format (element **a**, part 2)

This section **is** the log. New observations are appended as rows to the running table in §3.2,
each expanded (when it needs detail) into a per-entry block using the §3.1 template. Append-only in
spirit: correct an entry by adding a new, superseding row that references the one it corrects
(mirroring the workflow's own `supersedes` discipline) — do not silently rewrite a past
observation's meaning.

Every entry must record its **source honestly**: `synthetic-dry-run` (a tool-building agent's
automated pass — the only source that exists today), `real-reviewer` (a named, post-G1,
`synthetic: false` reviewer's first-hand use — none exist yet), or `self-observation` (an
engineer/agent noticing mechanics while building). Only `real-reviewer` observations count toward
the promotion threshold's necessary precondition in §4.

### 3.1 Per-entry template

```markdown
#### OBS-<NNN> — <one-line summary>

- **Date**: <YYYY-MM-DD>
- **Observer (role)**: <role name — e.g. clinical reviewer, laboratory reviewer, review coordinator,
  platform engineer; a role, never a person's name in this shared note>
- **Source**: synthetic-dry-run | real-reviewer | self-observation
- **Module(s)**: <module_id(s), e.g. cbc_suite_v1>
- **Category**: F-COORD | F-ONBOARD | F-ERROR | F-LATENCY | F-INTERP | F-VOLUME
- **Severity**: blocking | impeding | minor
- **Completion**: did the reviewer finish the intended review act? (yes / no / yes-with-help)
- **What happened**: <plain-language description of the friction — no metrics, no telemetry>
- **Workaround / resolution**: <what unblocked it, if anything>
- **Supersedes**: <OBS-id this entry corrects, or "—">
```

### 3.2 Running observation log

| Obs ID | Date | Source | Module | Category | Severity | Completion | Summary |
|--------|------|--------|--------|----------|----------|-----------|---------|
| OBS-000 | 2026-07-22 | synthetic-dry-run | cbc_suite_v1 | F-COORD, F-ONBOARD, F-ERROR, F-LATENCY, F-INTERP | impeding | yes (automated) | Seed row: the five P2-T8 dry-run mechanics observations (see §3.3). Not real-reviewer evidence. |

*(No `real-reviewer` observations exist yet — the roster is `synthetic: true`-only pre-G1. This
table stays seeded with OBS-000 only until a real, post-G1 reviewer uses the workflow.)*

### 3.3 Seed entry (OBS-000) — the P2-T8 synthetic dry-run

The full text lives at `.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md`; it is
summarized here as this log's seed and is **explicitly not real-reviewer evidence** — it is one
automated, single-session pass by a tool-building agent, and it disclaims proposing any promotion
decision. Its five observations map onto the §2 categories as:

1. `scaffold` alone cannot produce a file for the only identity kind that exists today → **F-ONBOARD**.
2. Five roles must share one hand-carried `subjectContentHash`; a transposed character surfaces late → **F-ERROR**.
3. `validate`'s module-wide checks re-run in full on every call → **F-LATENCY**.
4. The terminal "structurally non-qualifying" state reads as a bug without its own explanation → **F-INTERP**.
5. Nothing surfaces whose-turn-is-next beyond manually running `list` → **F-COORD**.

Because OBS-000's source is `synthetic-dry-run`, it contributes **zero** toward §4's real-reviewer
precondition. It is context for the decision-owner, not a step toward the threshold.

---

## 4. Promotion threshold — FIRST-CUT PROPOSAL, pending human ratification (element **b**)

> **This threshold is a PROPOSAL. It has no force and triggers no action until the human
> decision-owner named in §5 has explicitly ratified it.** Until ratified, the specific categories,
> the AND/OR logic, and every number below are non-binding first-cut suggestions only. No task, no
> agent, no CI job, no `rf`/ARC output, and no automated process may treat this threshold as met, or
> act on it, of its own accord. "Threshold met" authorizes exactly one thing: the decision-owner
> convening a promotion decision and recording it via §6 — and the recorded decision may perfectly
> well be *"defer / do not build."* Meeting the threshold is necessary to *open* the question; it is
> never sufficient to *answer* it, and never sufficient to build anything.

### 4.1 Necessary precondition (a gate on even considering promotion)

**At least one real, non-synthetic (post-G1) reviewer must have actually used the file + CLI
workflow for a genuine review act.** Every observation on record today comes from a single automated
dry-run pass; there is no real-reviewer friction evidence at all yet. Until G1 clears and a
`synthetic: false` reviewer logs a `real-reviewer` observation in §3, the threshold is **structurally
un-meetable** regardless of any other signal — mirroring the substrate's own "synthetic evidence can
never qualify" posture. This precondition is a floor, not a trigger.

### 4.2 First-cut friction bar (proposed values — illustrative, non-binding until ratified)

With the precondition satisfied, the *proposed* first-cut bar for convening a decision is met when
**any one** of the following is logged from `real-reviewer` sources in §3:

- **F-COORD / F-VOLUME**: ≥ **5** coordination-failure observations across ≥ **2** distinct modules,
  **or** ≥ **3** modules simultaneously in active multi-role review where manual `list`-based
  coordination is logged as unmanageable; **or**
- **F-ONBOARD**: ≥ **2** distinct real reviewers logged as unable to complete their assigned role
  end-to-end without engineer hand-holding; **or**
- **Any single `blocking`-severity observation**: one real reviewer who could **not** complete a
  required review act at all via the file + CLI path. A single genuine `blocking` event is, by
  proposal, on its own enough to convene a decision (fail-closed toward *looking at it*, not toward
  *building*).

`F-ERROR`, `F-LATENCY`, and `F-INTERP` observations are recorded and inform the decision's rationale
but are **not**, in this first cut, proposed as standalone triggers — several are already targeted by
in-feature work (the Phase 2 incremental-validate cache; the Phase 3 terminal-state messaging and
reviewer runbook), so they should be re-measured *after* that work lands before being weighed.

### 4.3 What ratification means

Ratification is the decision-owner (§5) recording, via the §6 template, that they adopt (or amend)
this threshold as the standing bar. The numbers, the categories in each clause, and the
one-`blocking`-event rule are all explicitly open to that human's revision. This section names an
*explicit* first cut precisely so ratification has something concrete to accept or change — not so
that anything acts on it beforehand.

---

## 5. Authorized human decision-owner (element **c**) — a ROLE, never a person or an agent

The single authority that owns the portal-promotion call is a **role**, filled by a named human at
decision time (recorded in the §6 record), never hard-coded to a person in this shared note:

> **Decision-owner role: the Evidence Foundry platform-engineering lead** — the named
> platform-engineering governance role that owns Evidence Foundry infrastructure decisions (the same
> role family the gates registry names as "platform-engineering lead" / the `platform-engineering`
> registry owner). This role reads the §3 log, applies the §4 threshold, and — because a review
> portal displays clinical evidence and, once real reviewers exist, real reviewer identities, making
> it a **second trust boundary** distinct from the PHI-free public microsite — **must consult the
> named clinical-governance lead** before recording any decision to promote. Both are roles.

**Explicit exclusions (binding — mirrors the D-4 invariant and the gates registry's own posture):**
the decision-owner is **never**:

- an autonomous agent, a Claude Code session, this plan's authoring session, or any automated
  process;
- an `rf` (Research Foundry) output, an ARC / `council-review` output, or any AI-generated
  recommendation standing alone;
- a person's name written into this shared framework file (the *role* is named here; the accountable
  *individual* is recorded only in a §6 decision record at the moment a decision is actually made);
- any of the clinical-governance gate owners (G0–G4) *acting in that gate capacity* — this is a
  product/infrastructure promotion decision, separate from and additional to those gates, and
  clearing it grants no clinical approval of any kind.

The decision-owner's authority is bounded: they may convene a decision, record it, and — if they
decide to promote — authorize *design work to begin* on the portal, which itself still requires the
portal's own security review (a second trust boundary) before any build commits to an architecture.
They may **not**, via this framework, clear any clinical gate, add a real roster entry, sign a real
record, or ratify ADR-0004.

---

## 6. Decision-record template (element **d**)

When (and only when) the decision-owner convenes a promotion decision, they record it by copying the
template below into a new, committed markdown decision record (an ADR under `docs/adr/` if the
outcome is a durable architectural commitment, or a dated entry appended to this file's §6 log if it
is a "defer / re-check later" outcome). The record is the artifact; a threshold being met is never
itself the decision.

```markdown
### PPD-<NNN> — Portal-Promotion Decision

- **Date**: <YYYY-MM-DD>
- **Decision-owner (role → accountable human)**: Evidence Foundry platform-engineering lead
  — <named individual, filled at decision time; never an agent, never rf/ARC output>
- **Consulted (role → human)**: clinical-governance lead — <named individual> (required when the
  outcome is "promote"); others as needed
- **Triggering observations**: <OBS-ids from §3 that prompted convening this decision>
- **Precondition check (§4.1)**: has ≥ 1 real (post-G1) reviewer used the workflow? <yes / no>
  — if "no", the decision can only be "defer (precondition unmet)"
- **Threshold assessment (§4.2)**: <which clause(s) met / not-met, against the ratified bar; cite
  the observation IDs>
- **Decision**: Promote (begin portal design) | Defer (re-check at <trigger/date>) | Reject
  (file model remains the answer) | Ratify/Amend threshold only
- **Rationale**: <plain-language justification tied to the logged observations — no metrics claimed
  that the zero-telemetry log cannot support>
- **Second-trust-boundary acknowledgment** (required if Decision = Promote): design work is
  authorized to *begin*, but no portal architecture is committed until the portal's own security
  review resolves the second-trust-boundary threat model (per the design spec's Design Sketch). This
  record does **not** authorize writing portal code or standing up hosting.
- **Gate posture (binding)**: this decision clears no clinical gate (G0–G4), adds no real roster
  entry, signs no real record, and does not ratify any ADR.
- **Supersedes**: <PPD-id this decision revises, or "—">
```

### 6.1 Recorded portal-promotion decisions

*(none yet — the threshold's necessary precondition in §4.1 is unmet; no real reviewer has used the
workflow. The first entry here, if ever, is authored by the §5 decision-owner, never by a task or
an agent acting alone.)*

---

## 7. References

- `docs/project_plans/design-specs/clinical-review-portal-workflow.md` — the `maturity: shaping`
  design spec this framework informs; sibling task P4-T3 references §2/§4/§5/§6 from it.
- `.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md` — the P2-T8 dry-run friction note;
  OBS-000's full text and this log's first (synthetic) evidence feed.
- `docs/adr/0004-clinical-approval-identity-adjudication.md` (`status: proposed`, G0) — names review
  volume / reviewer feedback as the promotion pressure this framework operationalizes; never edited
  by this feature.
- `docs/governance/gates-registry.md` — G0–G4 human gates and the repo's role-naming convention
  (owner-role is a human role, "never an agent, never ARC/`rf`/`council-review` output").
- PRD `docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md` — FR-15 (framework),
  FR-16 (zero telemetry/network/analytics, restated verbatim in §1), OQ-4 (log location), OQ-8
  (portal-promotion framework).
- Root `CLAUDE.md` hard guardrails — "No PHI in the public microsite … no third-party
  scripts/fonts/analytics"; the D-4 invariant this framework's §5 exclusions mirror.
