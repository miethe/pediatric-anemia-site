---
title: "ADR-0009: Module eligibility policy for clinician-facing surfaces"
status: proposed
date: 2026-07-22
deciders: [platform-engineering]
supersedes: []
superseded_by: []
unblocks: ["spa-module-switcher-v1"]
---

# ADR-0009: Module eligibility policy for clinician-facing surfaces

## Status

**Proposed** — 2026-07-22. Not accepted. No clinical governance body has reviewed or ratified this
record; it is a software-architecture decision only, authored ahead of the SPA Module Switcher
feature (`spa-module-switcher-v1`) per that feature's Phase 0. Shipping this ADR with
`status: proposed` is sufficient to unblock the feature — no G0 ratification is claimed or required
here (see "OQ-4" below). This mirrors the standing pattern in this repository of ADR-0004/0005/0006,
all of which also ship `proposed` and are treated as adopted software machinery ahead of formal
governance-body ratification.

## Context

Four modules are registered under `modules/`: `anemia` (`status: integrity-recorded`),
`cbc_suite_v1`, `growth_suite_v1`, and `kidney_suite_v1` (all three `status: unsigned-stub`). Until
now, no clinician-facing surface has ever let a user choose among them — the SPA (`src/app.js`) has
run exactly one module, and the server (`server.mjs`) has advertised all registered modules but
accepted no client-supplied module selector. The SPA Module Switcher feature introduces the first
such surface: a header control that lists all four registered modules and lets a clinician pick one
to run an assessment against.

That surface cannot be built without first deciding, and recording, a policy question this codebase
has never had to answer: **given a module's `status` field, which UI affordance is that module
entitled to?** Getting this wrong in either direction is a live hazard:

- Allowing a `status: unsigned-stub` module to run `assess()` would present unreviewed, unsigned
  scaffold output as though it were a real assessment. Concretely, `cbc_suite_v1`'s hooks currently
  delegate to the anemia module's logic (`modules/cbc_suite_v1/index.js:35-38`) and its rule evidence
  IDs do not resolve against `src/evidence.js`'s anemia-only evidence table — a clinician-visible
  "assessment" from that module today would silently misattribute anemia's classification to a
  different clinical domain and cite evidence that does not exist. That breaches this repository's
  hard guardrail that "every clinical statement ties to a source."
- Hiding non-`integrity-recorded` modules from the surface entirely — rather than listing them,
  disabled, with their real status shown — would forfeit the switcher's actual value (making the
  platform's four-module, one-ready state honestly perceivable) and contradicts a precedent this
  codebase has already established: `server.mjs`'s `GET /api/v1/knowledge-base` handler discloses
  every registered module's real manifest state as-read, including a non-servable
  `status: unsigned-stub` manifest, specifically because — per that handler's own comment — "this
  endpoint never hides a module's real, unservable state." A clinician-facing surface introducing the
  opposite behavior (silently omitting unready modules) would regress a disclosure precedent already
  in production.

This decision is written once, here, so it governs every module this platform ever registers — not
only the four that exist today.

## Decision

**A single, closed mapping from `module.json.status` to UI affordance, evaluated in the client
before any assessment call, and bound to the same runtime constant the server and build already
use.**

The `status` field is a closed, four-value enum (`schemas/module-manifest.schema.json:22`):
`unsigned-stub`, `integrity-recorded`, `superseded`, `revoked`. The binding mapping from each value to
clinician-facing UI affordance is:

| `status` | UI affordance |
|---|---|
| `integrity-recorded` | **Selectable and assessable.** The only status for which a clinician-facing surface may invoke `assess()`/`assessModule()` against the module's knowledge base. |
| `unsigned-stub` | **Listed, but inert.** The module appears in the surface with its status shown verbatim (never implied-ready, never a friendlier paraphrase). Selecting it never reaches `assess()`; the control is programmatically disabled with the reason in its accessible name. |
| `superseded` | **Listed, but inert** — same treatment as `unsigned-stub`. A former `integrity-recorded` release that has been replaced keeps its record but is never choosable. |
| `revoked` | **Listed, but inert** — same treatment as `unsigned-stub`. A withdrawn release is never choosable. |

Only `integrity-recorded` is selectable. `unsigned-stub`, `superseded`, and `revoked` are all
inert-with-reason-shown; none of the three is hidden, and none is ever silently treated as
selectable. This is the same "never hide unservable state" disclosure precedent already established
by `server.mjs`'s `GET /api/v1/knowledge-base` handler, applied for the first time to a
clinician-facing (not machine-facing) surface.

### The eligibility predicate is bound to one runtime constant, never a literal

Every implementation of this policy — client, build, and server alike — MUST decide eligibility by
comparing `module.json.status` against `READY_STATUS`, the single constant exported from
`src/kbVerify.js:43` (`export const READY_STATUS = 'integrity-recorded';`), and MUST NOT hardcode the
literal string `'integrity-recorded'` anywhere in a UI-layer eligibility check. `READY_STATUS` is
already the runtime's own statement of "the only status the server/build/browser will serve"
(`schemas/module-manifest.schema.json:23`'s description of the enum). Binding the UI predicate to the
same imported constant — rather than re-deriving the same string independently — is what keeps
client, build, and server from silently diverging on what "servable" means if that constant is ever
revisited. A manifest whose `status` is absent, malformed, or not a member of the closed enum MUST be
treated as ineligible; there is no default-to-eligible path.

This is a policy decision, not an implementation one — a future implementation is free to reference
`READY_STATUS` however its module system requires, but it may never re-encode the same fact as an
independent literal.

## Scope: this ADR governs every future module, not only the current four

This mapping is written as a general policy over the closed `status` enum, not as a rule about
`anemia`, `cbc_suite_v1`, `growth_suite_v1`, or `kidney_suite_v1` specifically. Any module registered
in the future — including modules that do not exist yet — is subject to the same four-row mapping the
moment it is registered. Reaching `integrity-recorded` is what earns a module a selectable, assessable
UI affordance; nothing else about a module (how many rules it has, how long it has existed, who
authored it) enters into this decision.

## Not conflated with ADR-0001

ADR-0001 ("Canonical CDS Authoring Model and Rule Schema v2 Migration") is a separate decision with a
separate trigger. Its recommended migration point is explicitly "before multi-module E1 scale" —
i.e., before a second module's *rule-schema authoring* pressures the shape of `schemas/rule.schema.json`
itself (provenance fields, sidecar records, `rfClaimIds`, etc.). This ADR is about which already-
registered modules a UI is permitted to let a clinician *select and run*; it authors no rule, extends
no schema, and does not touch `schemas/rule.schema.json` in any way. A module switcher does not trip
ADR-0001's trigger, and this ADR does not depend on, resolve, or supersede it. The two ADRs address
disjoint questions and must not be read as alternatives to one another.

## The FR-14/R-8 lifting authority

`multi-bundle-conversion-e1.md`'s Functional Requirement **FR-14** and Risk **R-8**
(`docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md:367,527`) froze
`DEFAULT_MODULE_ID` at `'anemia'` and prohibited any new client-selectable `moduleId` surface as part
of that pass's registry-wiring work. Read in full, that prohibition is **scope-bounded to the
multi-bundle-conversion-e1 pass itself**, and is explicitly conditioned on a future event: R-8's own
text names the hazard as tempting "an implicit `DEFAULT_MODULE_ID` change or a new client-facing
`moduleId` parameter, **ahead of any UI/API decision to support it**" (emphasis added). FR-14's
mitigation is that pass freezing the surface *until* such a decision is made — not a permanent
prohibition on ever making one.

**`docs/project_plans/PRDs/features/spa-module-switcher-v1.md` is that decision.** That PRD, together
with this ADR, is the recorded authority under which FR-14/R-8's prohibition is lifted:

- This ADR records *how* eligibility is decided once a client-selectable surface exists (the
  status→affordance mapping above), so that lifting the prohibition does not mean "any registered
  module becomes selectable" — it means "the mapping this ADR defines now governs selectability,"
  which today still yields exactly one selectable module (`anemia`) and three inert ones.
  `DEFAULT_MODULE_ID` itself is unaffected by this ADR; the switcher adds a UI-level selection layer
  on top of the existing registry, it does not change which module the registry treats as default.
- The switcher PRD records *that* the decision has been made — ahead of the UI, per FR-14/R-8's own
  condition — and states the feature's non-goals explicitly (no `server.mjs`/`openapi.yaml` change;
  the browser switcher makes zero HTTP `/api/` calls), so the surface being unblocked is a client-side
  selection control only, not the server-side `moduleId` parameter design sketched separately in
  `docs/project_plans/design-specs/public-moduleid-api-surface.md`.

This section is written to be quotable verbatim in a future commit message or test comment — for
example, by the task that eventually revisits `tests/module-registry.test.mjs`'s
`DEFAULT_MODULE_ID`-tripwire comment, which itself states its trigger fires "the day a client-selectable
moduleId surface actually ships" and names ADR-0009 as the recorded authority for that decision.

### R-4's four-peers misread risk, and how D-1's structural grouping answers it

`multi-bundle-conversion-e1.md:523`'s **R-4** names a related but distinct hazard: "Greenfield
module's placeholder `deriveFacts` is mistaken for real clinical logic... An empty-but-schema-valid
module package could be misread by a future contributor as '[module] assessment works,' when it is a
scaffold with zero clinical behavior." Applied to a clinician-facing switcher rather than a
contributor reading source code, the same misread generalizes: presenting all four registered modules
as uniform, equally-weighted peers in a selection list would let a clinician mistake three inert
scaffolds for three additional working assessments.

The status→affordance mapping this ADR defines is what prevents that misread from reaching a
clinician. A conforming UI never renders the four modules as undifferentiated peers — it renders two
structurally distinct groups (selectable vs. not-selectable-with-reason-shown), so a scaffold's
`unsigned-stub` status is visible at the point of choice, not buried in documentation a clinician
would never read. R-4's own stated mitigation (an explicit "not yet implemented" posture, checked
rather than assumed) is exactly what the "listed, but inert, status shown verbatim" affordance row
guarantees at the UI layer; this ADR is the record of that guarantee for the switcher specifically.

## Options considered

1. **All four modules selectable and assessable regardless of status (rejected).** Violates the
   schema's own closed-enum description of `integrity-recorded` as "the only status the
   server/build/browser will serve," and would let a clinician run `cbc_suite_v1` today and receive
   a mislabeled anemia classification citing evidence records that do not exist for that module.
2. **Only `integrity-recorded` modules appear in the surface at all; others hidden (rejected).**
   Forfeits the switcher's disclosure value and regresses the `GET /api/v1/knowledge-base` "never
   hide unservable state" precedent already established elsewhere in this codebase.
3. **Status-driven mapping, listed-but-inert for non-ready statuses, bound to the imported
   `READY_STATUS` constant (adopted).** Discloses every registered module's real state, never
   implies readiness that does not exist, and keeps client/build/server eligibility checks
   structurally incapable of diverging from one another.

## Consequences

- Every future module registration is automatically subject to this mapping; no future feature needs
  to re-derive an eligibility policy from scratch.
- A UI implementing this ADR can never independently decide a module is "close enough" to ready —
  eligibility is binary and status-driven, with no partial-credit affordance.
- Any future change to what counts as "ready" is a change to the `READY_STATUS` constant or the
  schema's closed enum, not a change scattered across UI call sites — because every eligibility check
  is required to reference the one constant.
- This ADR does not itself change any module's `status`, sign anything, or claim any clinical review
  occurred. No `approvedBy` entry, hash, or governance state changes as a result of this record.

## OQ-4 (resolved): does this ADR need G0 ratification before merge?

No. `status: proposed` suffices to unblock and merge the switcher feature that depends on this ADR,
matching the established pattern of ADR-0004, ADR-0005, and ADR-0006 in this repository, all of which
also ship `proposed` without a governance-body ratification pass gating their adoption as software
architecture. No G0–G4 gate (`docs/governance/gates-registry.md`) blocks this ADR or the feature it
unblocks: this ADR flips no module's `status`, signs nothing, and touches no reviewer roster. The
standing G4 principle — no claim that a knowledge-base module is clinically released — is satisfied
because this ADR makes no such claim about any module; it only defines which manifest states a UI may
treat as selectable.
