---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry: Withdraw/Rollback Machinery (DF-E2-03)"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-22
feature_slug: evidence-foundry-e1
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md
problem_statement: "E1 now ships an inert OQ-4 withdrawal-state field family on the release registry (const 'none', never set to anything else), so a future E2 withdraw/rollback engine has a seeded field to extend rather than a bare registry — but no mechanism exists to actually withdraw an active KB release or roll a client back to a prior signed version when a retraction, safety notice, or emergency-withdrawal-class change fires, because no signed release exists yet, and E1 builds no detection, classification, or rollback code path at all."
open_questions:
  - "Who holds authority to confirm an emergency withdrawal at E1/E2 (a named clinical role per ADR-4, an on-call rotation, both), and what is the confirmation medium (signed commit, portal action, issue-tracker approval)?"
  - "What is the rollback SLA (hours/days) from trigger detection to an active client rejecting the withdrawn KB, and how is that SLA measured before any live deployment exists to generate real incident data?"
  - "Does 'rollback' mean the runtime falls back to the immediately-prior signed release, or to the last release that itself has no open withdrawal flag (which could skip more than one version if two releases are withdrawn in sequence)?"
  - "How does a runtime client discover a withdrawal out-of-band (denylist poll, registry check on load, push notification) given the deterministic/offline converter-and-runtime guardrail — is a withdrawal check itself required to stay offline-safe (fail closed with no assessment) if the client cannot reach the registry?"
  - "Does the rollback drill (02 §7.4 E2 go gate: 'Rollback drill passes and active clients reject expired/withdrawn KBs as policy requires') get authored as an executable test against the flat registry ADR-5 recommends, or does it require live-deployment infrastructure this program has no plan to operate before E1?"
explored_alternatives:
  - "No dedicated withdrawal state — treat a bad release the same as any other supersession (new version simply replaces old) — rejected implicitly by ADR-7: this collapses the 'emergency withdrawal' materiality class into ordinary supersession and reproduces the 'Retraction response delay' risk (02 §8.4) because nothing signals to an already-deployed client that the version it holds is now unsafe, not merely outdated."
  - "Human-confirmed emergency withdrawal, gated on automated detection, recorded as a distinct registry entry/state (ADR-7's recommended default, extended here) — automated detection triggers the immediate-run lane and materiality classification, but the withdrawal action itself requires a human sign-off step, matching the CLAUDE.md 'no AI-published rule changes' guardrail extended symmetrically to un-authoring a release."
  - "Fully automated withdrawal (detection and action both automatic, no human confirmation) — rejected in ADR-7 (option 1, 'automated-only withdrawal trigger and action'): converts a KB release state without a human sign-off step, the same category of concern the CLAUDE.md guardrail addresses for authoring, extended here to withdrawal."
---

# Withdraw/Rollback Machinery (DF-E2-03)

## Problem / Context

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §7.4 (E2 — surveillance,
update, and registry) lists withdraw/rollback as scope item 11: "Withdraw/rollback when trigger
criteria fire." The E2 go gate (§7.4) requires: "Rollback drill passes and active clients reject
expired/withdrawn KBs as policy requires." §5.7's release state machine names `withdrawn` as one of
three terminal states a release can reach (`superseded | withdrawn | expired`), and §5.6's release
gate table lists "Rollback" as one of the release-readiness rows: "Prior signed release is available
and rollback drill/criteria are documented." `02 §8.4`'s operational-risk table names the failure mode
directly: "Retraction response delay — Active unsafe rule remains deployed," with the stated control
being "Immediate trigger lane, withdrawal state, runtime denylist/registry check, rollback SLA."

E0 (`evidence-foundry-buildout`) built none of this — it shipped the deterministic
`rf-bundle-to-kb-pack` converter and a 4-rule `cbc_suite_v1` vertical slice at proposal status
only, with no signed release and no registry, so no withdrawal state or rollback target could exist
yet. The Deferred Items Triage Table in the (then) parent plan categorized this as **prereq**:
"Withdraw/rollback machinery needs a registry of signed releases to roll back between; none exists
before E1" (trigger: "E1 signed release registry exists").

E1 (`evidence-foundry-e1`, this plan) is the first plan to actually create that registry — see
"What E1 Shipped: the OQ-4 Registry Seed" below. This spec's promotion trigger has therefore
partially fired: a registry now exists, but it is empty (`{"schemaVersion": 1, "entries": []}`), it
holds only inert, `const`/`null`-typed placeholders for the fields this machinery would extend, and
E1 builds zero detection, classification, or rollback code path. This machinery remains `shaping`,
not implementation-ready — see "E2 Boundary" below for exactly what still separates the two.

This spec is seeded jointly from two Phase 6 ADRs, per the parent plan's explicit instruction:

- `docs/adr/0005-kb-serialization-signing-key-custody.md` (ADR-5) recommends the flat, append-only,
  git-tracked signed-release registry this withdrawal/rollback machinery needs *something to roll
  back between* — ADR-5 names `DF-E2-01` and `DF-E2-03` (via ADR-7's cross-reference) as depending on
  its registry-shape recommendation.
- `docs/adr/0007-surveillance-cadence-materiality-classes.md` (ADR-7) ratifies "emergency withdrawal"
  as the fifth materiality class and requires it to be "a human-confirmed action gated on automated
  detection, never a fully automated release step." ADR-7 names `DF-E2-03` explicitly: "withdrawal is
  itself the fifth materiality class this ADR ratifies... and rollback needs the registry (ADR-5) plus
  this ADR's human-confirmed trigger-handling design to know when and how a rollback is initiated."

## Current State (E1, what this program actually ships as of this update)

- Still no *signed* release exists anywhere in this repository: E1's release-candidate artifacts
  (`build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-manifest.unsigned.json`, P5-T1; dry-run signed
  candidates under the same tree, P3-T2) all carry `dryRun: true`/`"unsigned-stub"`-class status —
  never `active`, `superseded`, `withdrawn`, or `expired` (§5.7's state machine has no state this
  program's output legitimately occupies except the pre-`signed` proposal states).
- A registry file **now exists**: `releases/registry.json`, git-tracked, root-level, per
  `schemas/release-registry.schema.json` (P1-T5) and populated by `tools/release-sign`'s `register`
  verb (P3-T4). See "What E1 Shipped: the OQ-4 Registry Seed" below for its exact shape.
- Still no withdrawal detection, denylist, or rollback code path exists anywhere in `src/engine.js`,
  `server.mjs`, or the runtime. Nothing polls for retraction/correction/withdrawal/safety-notice/
  cutoff-or-formula-change/superseding-guideline events (§7.4 item 3's six named trigger types). E1's
  own quality gates require this to stay true — `tests/ef-retro-*` and the retrospective harness
  (`tools/retro-validate`) never write registry entries, only read them.
- `ADR-0005` and `ADR-0007` remain `status: proposed`, not `accepted` — this spec's design sketch
  below is therefore still provisional pending both ADRs' ratification, exactly as the promotion
  trigger states, now updated to reflect that the registry half of that trigger has fired.

## What E1 Shipped: the OQ-4 Registry Seed

The implementation plan's decisions block resolved **OQ-4** — "`releases/registry.json` E2-seed
fields: exactly the FR-14 list, nothing more" — and P1-T5/P3-T4 built exactly that. This is the
concrete substrate this spec's "Withdrawal state on the registry entry" design-sketch item (below)
would extend, not invent from scratch:

- **Shape shipped**: `{schemaVersion, entries[]}`, each entry `additionalProperties: false` over
  exactly ten fields — `version`, `moduleId`, `packDigest`, `manifestDigest`, `signature`, `signedAt`,
  `supersedes`, `withdrawalState`, `withdrawnAt`, `withdrawalReason`.
- **Inert withdrawal consts, verbatim from OQ-4's resolution**: `withdrawalState` is `const: "none"`
  under this schema version — never `enum`, so any other value (e.g. `"withdrawn"`) is a hard schema
  violation, not a policy violation a task could work around. `withdrawnAt` and `withdrawalReason` are
  both `type: "null"` — always exactly `null`, reinforcing that a withdrawal timestamp/reason cannot
  exist without a withdrawal. `signature`, `signedAt`, and `supersedes` are likewise `null`-typed
  (mirroring the DF-E1-06 signing boundary — no real signature exists pre-G2, and E1 registers at most
  one entry per module, so no supersession chain exists yet either).
- **Surveillance hooks omitted entirely, deliberately** — this is the field family this spec and
  `DF-E2-01` (surveillance/update/registry engine) would need but that OQ-4's resolution explicitly
  declined to seed: no re-verify-cadence field, no materiality-class field, no signer-identity index.
  The registry schema's own header states the reason plainly: "surveillance hooks (re-verify cadence,
  materiality class) are omitted entirely — they belong to ADR-0007's unaccepted taxonomy, and seeding
  them would speculate ahead of G0." `additionalProperties: false` on the entry shape makes adding any
  such field today a structural rejection, not a documentation gap — this program chose not to guess
  at ADR-0007's eventual shape rather than seed a field it might have to change later.
- **Append-only enforcement is procedural, not schema-level** — `register`'s two-layer (in-process +
  git-history) check (P3-T4) is what actually prevents a past entry from being mutated or removed; the
  JSON Schema alone cannot compare a document to its own prior committed state. This spec's future
  "withdrawn entry is never deleted or rewritten in place" requirement (design-sketch item 1, below)
  would need to extend this same enforcement mechanism, not a new one.

## E2 Boundary

Restated precisely, now that E1's half of the prerequisite exists: this spec's machinery is **entirely
E2 scope**. E1 draws the boundary at exactly one point — a registry exists, with an inert
`withdrawalState` field family that no E1 code path can set to anything but its seeded defaults.
Everything on the other side of that boundary remains unbuilt and unshaped-past-`shaping`:

- **No trigger detection or classification** (`DF-E2-01`'s job — ADR-0007's five-class materiality
  taxonomy, including "emergency withdrawal," is itself unratified).
- **No human-confirmed withdrawal action, no code path that could write anything other than
  `withdrawalState: "none"`** — raising that ceiling (from `const: "none"` to an `enum` admitting
  `"withdrawn"`) is, per this program's standing convention (mirroring the `approvedBy[]`
  `maxItems: 0` idiom), the deliberate, separately reviewed act that would first give this machinery
  teeth; no E1 or E2-planning task performs it implicitly.
- **No runtime rejection of withdrawn/expired KBs** — `src/engine.js`/`server.mjs` carry no load-time
  registry check of any kind; this remains a from-scratch build against §7.4's E2 go gate.
- **No rollback drill, executable or otherwise.**

E1's contribution to this boundary is narrow and honest: a schema that will not silently accept an
undisclosed withdrawal field later (`additionalProperties: false`), and a registry file that already
exists for `DF-E2-01`/this spec to extend rather than create from nothing — nothing more.

## Design Sketch

At a `shaping`-level (direction known from the two seeding ADRs, not yet a committed implementation
plan):

1. **Withdrawal state on the registry entry.** Each signed-release registry entry (ADR-5's flat,
   append-only file) gains a `withdrawalState` field distinct from ordinary `supersedes` chaining —
   matching §5.7's state machine, which treats `withdrawn` as a terminal state reachable from `active`,
   separate from the ordinary `active -> superseded` supersession path. A withdrawn entry is never
   deleted or rewritten in place (§7.4 item 9: "Sign new immutable KB; never rewrite the active version
   in place" — the same immutability discipline extends to marking a past release withdrawn).
2. **Trigger classification feeds this machinery, but does not execute it.** ADR-7's five-class
   materiality taxonomy and immediate-trigger lane (retraction, correction, withdrawal, safety notice,
   cutoff/formula change, superseding guideline) classify a detected change as `emergency withdrawal`
   — that classification is `DF-E2-01`'s (surveillance engine) job. This spec's machinery is what
   happens *after* that classification resolves to "emergency withdrawal": recording the withdrawal
   state against the registry entry and initiating rollback, not detecting or classifying the trigger
   itself.
3. **Human-confirmed withdrawal action.** Per ADR-7's ratified default, automated detection may
   surface a candidate emergency-withdrawal event, but the registry write that actually marks a
   release `withdrawn` requires an explicit human-confirmed action — never a fully automated release-
   lifecycle change. This mirrors the CLAUDE.md "No AI-published rule changes" guardrail applied
   symmetrically to un-authoring (withdrawing) a release, per ADR-7's rationale.
4. **Rollback target selection.** When a client-active release is withdrawn, the rollback target is
   the nearest prior signed release without an open withdrawal flag of its own (see frontmatter open
   question on whether this can skip more than one version). §5.6's release gate table requires "Prior
   signed release is available and rollback drill/criteria are documented" as a precondition of any
   release being considered rollback-safe in the first place — this spec's machinery cannot originate
   that precondition; it consumes it.
5. **Runtime rejection of withdrawn/expired KBs.** Per §7.4's E2 go gate ("active clients reject
   expired/withdrawn KBs as policy requires") and `02 §4.18`'s hard runtime rule (restated in ADR-5:
   "the assessment runtime verifies signature, content hash, engine compatibility, and expiry before
   loading; any failure produces 'no assessment produced'"), a load-time check against the registry's
   withdrawal/expiry state is an extension of that same verification step, not a new independent
   mechanism — failing closed (no assessment produced) is the only acceptable failure mode, consistent
   with this feature's deterministic/offline guardrail (see frontmatter open question on how an
   offline client discovers a withdrawal at all).
6. **Rollback drill as an executable test.** The E2 go gate's "rollback drill passes" criterion should
   be exercisable as a deterministic test once the registry (ADR-5) exists: seed a registry fixture
   with an `active` release, a prior signed release, and a simulated withdrawal event; assert the
   runtime's load-time check rejects the withdrawn release and falls back to (or refuses to silently
   substitute) the prior one per whatever policy this spec's open questions resolve.

None of this design sketch is implemented by E0, by E1, or committed by this spec — see "E2 Boundary"
above for exactly what E1 shipped instead (the inert registry seed) and what remains untouched. `ADR-0005`
and `ADR-0007` both remain `proposed`, and E1/E2 planning must ratify or revise them before any of the
above becomes an implementation task.

## Promotion Trigger

Per the parent plan's Deferred Items Triage Table: "E2 planning." E1's half of the original trigger —
"a signed-release registry exists" — has now fired (`releases/registry.json`, per "What E1 Shipped"
above); what remains outstanding, and what actually gates this spec's promotion past `shaping`, is E2
planning itself: a first real (non-dry-run, non-`unsigned-stub`) release to register, withdraw, and
roll back against, `ADR-0007`'s materiality taxonomy ratified, and an E2 implementation plan that picks
this spec up as a task. E1 alone — registry seed included — is not sufficient to promote this spec;
nothing here changes that.

## Open Questions

See frontmatter `open_questions`. In summary: who holds withdrawal-confirmation authority and via what
medium; the concrete rollback SLA and how it is measured pre-deployment; whether rollback can skip
more than one withdrawn version; how an offline-first runtime discovers a withdrawal without violating
the deterministic/offline converter-and-runtime guardrail; and whether the E2 go-gate rollback drill
can be authored as a deterministic test against a registry fixture before any live deployment exists.

## References

- ADR: `docs/adr/0007-surveillance-cadence-materiality-classes.md` — ratifies "emergency withdrawal" as
  the fifth materiality class and requires human-confirmed withdrawal action; names `DF-E2-03`
  explicitly as depending on both its taxonomy and `ADR-0005`'s registry.
- ADR: `docs/adr/0005-kb-serialization-signing-key-custody.md` — the signed-release registry this
  machinery's withdrawal state and rollback target attach to; names `DF-E2-03` (via `DF-E2-01`'s
  shared dependency) as blocked on its registry recommendation. `status: proposed` (G0 outstanding),
  same as `ADR-0007` — see `docs/project_plans/design-specs/signed-release-key-custody.md`'s "What
  Stays Gated" section for the full G0/G2 boundary this spec's own registry dependency inherits.
- Registry schema (E1, shipped): `schemas/release-registry.schema.json` — the exact ten-field,
  `additionalProperties: false` shape this spec's "What E1 Shipped" section quotes; `withdrawalState`
  const/`withdrawnAt`/`withdrawalReason` null-typed under this schema version.
- Tool: `tools/release-sign/README.md` (`register` verb, P3-T4) — the writer that populates
  `releases/registry.json`'s seeded shape; this spec's future withdrawal-state write would need to
  extend the same append-only enforcement this verb already implements.
- Design spec: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §5.6 (release
  gate table, "Rollback" row), §5.7 (release state machine, `withdrawn` terminal state), §7.4 (E2 scope
  item 11, E2 go gate rollback-drill criterion), §8.4 ("Retraction response delay" risk row).
- Deferred items: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md`
  Deferred Items Triage Table, row `DF-E2-03`; Decisions & OQ Resolutions § OQ-4 (the registry seed
  decision this spec's "What E1 Shipped" section quotes verbatim).
- CLAUDE.md hard guardrails: "No AI-published rule changes... signed release" (extended here to
  withdrawal, per ADR-0007's rationale); the deterministic/offline converter-and-runtime constraint
  (governs how a client can safely discover and act on a withdrawal without a network call).
- Related deferred-item specs: `docs/project_plans/design-specs/surveillance-update-registry-engine.md`
  (`DF-E2-01`, detects and classifies the trigger this machinery acts on),
  `docs/project_plans/design-specs/production-monitoring-telemetry.md` (`DF-E2-02`, monitors the
  incidents a withdrawal responds to), `docs/project_plans/design-specs/signed-release-key-custody.md`
  (`DF-E1-06`, the signing/registry substrate this spec's withdrawal state is recorded against and
  updated alongside this spec, P5-T7).
