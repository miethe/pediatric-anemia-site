---
type: design-note
schema_version: 1
doc_type: design_note
title: "Contracts Design Note — Evidence Foundry E1 Phase 1 (R5 Unification + OQ-2/OQ-4/OQ-5 Encodings)"
feature_slug: evidence-foundry-e1
task_id: P1-T1
created: 2026-07-21
updated: 2026-07-21
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md
phase_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-1-contracts-gates.md
status: committed
---

# Contracts Design Note — R5 Unification + OQ Encodings

**Design only. No schema files change in this task.** This note fixes, before `schemas/review-record.schema.json`
is touched by P1-T2, exactly what P1-T2/T3/T4/T5/T7 must build: (a) the canonical ADR-0004
five-role review-record model and its field-by-field mapping from wave0's five-state contract;
(b) OQ-2's store layout + signature-object shape; (c) the PRD OQ-5 authorship-union definition;
(d) OQ-4's registry entry shape; (e) every current consumer of the wave0 schema, with disposition.

**Honesty posture (binding on this note and everything it directs):** nothing described below is,
or may be read as, a clinical-validity, safety, or release-readiness claim. Every canonical field
this note specifies exists to keep the eventual review workflow fail-closed and human-gated —
`approvedBy[]`/`clinicalApprovers[]` stay `maxItems: 0`, `synthetic: true` records stay
structurally incapable of satisfying any approval, and real signature slots stay schema-forced
empty until G1/G2 clear (see §(b), §(d)).

---

## (a) Canonical ADR-0004 model + wave0 field-by-field mapping (ruling R5)

### a.1 Why the shapes are structurally different, up front

Wave0's `schemas/review-record.schema.json` (EP7-T1, wave0-safety-foundation) modeled **one
mutable-until-terminal record per change proposal**: a single JSON/YAML document whose
`workflowState` advanced `proposed → under-review → (disputed) → approved/rejected`, with an
in-record `reviewers[]` array (primary/secondary/conflict-arbiter), an in-record
`conflictResolution` object, and an in-record `history[]` transition log.

ADR-0004's canonical model is **one immutable append-only file per review ACT**, one per role
(`clinical-1`, `clinical-2`, `lab`, `adjudication`, `release-auth`), at
`modules/<module_id>/reviews/<review_id>.yaml`. There is no single record whose state advances —
corrections are new superseding files, never edits (ADR-0004 decision item 1). This is a
**reshape, not a renaming**: wave0's 1 document : 1 proposal cardinality becomes 5 documents : 1
proposal (one per role). Every mapping below is judged against that reshape, not against a
field-for-field rename.

Per D-4 (no synthetic/automated source may ever occupy a reviewer or approver position), the
canonical model preserves the *guarantee*, not the *mechanism*: wave0 enforced D-4 with two inline
`const` markers on an embedded reviewer object (`reviewerType: "human"`, `attestedHuman: true`).
The canonical model has no embedded reviewer-identity object — identity is a roster reference
(`reviewerId`, P1-T4) — so D-4 moves from a single-schema structural check to a **three-layer
system guarantee**: (1) the roster schema (P1-T4) requires any `synthetic: false` entry to carry
an out-of-band `verificationRef`, a G1 human act; (2) the review-record's own `synthetic` flag is
downstream-rejected from ever satisfying a release-authorization validity check (P2-T4); (3)
P1-T7's validator wiring cross-checks `reviewerId` against the roster at `npm run validate` time —
a cross-file check the schema layer itself cannot express (`scripts/lib/json-schema-lite.mjs` has
no `$data` support, confirmed by inspection — see §(e) item 5). **This adaptation is the single
most load-bearing item in this note and is exactly what P1-GATE2 (karen) sanity check #2 ("every
forced-empty ceiling intact, no ceiling raised") must independently re-verify against the P1-T2
diff.**

### a.2 Canonical schema v1 — authoritative field list

This is the field list P1-T2 implements (schema-version-1, one YAML file per role act):

| Field | Type | Required | Notes |
|---|---|---|---|
| `schemaVersion` | integer ≥ 1 | yes | Canonical shape version; reset to `1` — this is a replacement, not a value carried forward from wave0's `schemaVersion`. |
| `review_id` | string, pattern `^rr-[0-9]{4}-(clinical-1\|clinical-2\|lab\|adjudication\|release-auth)$` | yes | OQ-2. Filename stem; global per-module sequence (`<seq4>`), not per-role. |
| `role` | string enum `[clinical-1, clinical-2, lab, adjudication, release-auth]` | yes | Explicit (not derived) so tooling never has to regex-parse `review_id`. Cross-checked against the `review_id` suffix via `if`/`then` (five branches, one per role) — expressible in the local validator without `$data` since both fields live on the same instance. |
| `moduleId` | string, pattern `^[a-z][a-z0-9_]*$` | yes | Mirrors `release-manifest.schema.json`'s `moduleId` pattern exactly. |
| `subjectContentHash` | string, pattern `^sha256:[0-9a-f]{64}$` | yes | OQ-2/hash-of-record-under-review. Hash of the exact target-artifact bytes this review act reviewed. Ties all five role-files for one proposal together (same value across the set) without re-embedding proposal narrative (see a.3 item 3). |
| `previousRecordHash` | string, pattern `^sha256:[0-9a-f]{64}$`, or `null` | yes (key present) | OQ-2 hash-chain. `null` only for the very first record ever created for a given `moduleId`. Enforced by the CLI/validator (P2-T3), not expressible as a pure schema constraint (needs the prior file's bytes). |
| `supersedes` | string matching the `review_id` pattern, or `null` | yes (key present) | Non-null only when this record is an explicit correction of a prior record (never an edit — ADR-0004 item 1). |
| `reviewerId` | string, minLength 1 | yes | Roster reference (`governance/reviewer-roster.yaml` `reviewerId`, P1-T4). No inline `name`/`credential` — see a.3 item 5. |
| `decision` | string enum `[approve, reject, request-changes]` | yes | Narrowed from wave0's 5-value enum — see a.3 item 5. |
| `rationale` | string, minLength 1 | yes | Narrative justification for `decision`. Upgraded from wave0's optional `comment` to required (FR-28 audit posture: an append-only clinical review act always carries its reasoning). |
| `reviewedAt` | string, `format: date-time` | yes | Single timestamp; collapses wave0's `decidedAt`/`createdAt`/`updatedAt` triad — see a.3 item 9. |
| `synthetic` | boolean | yes | OQ-2/PRD FR-3/FR-11. `true` only for clearly-labeled dry-run records; structurally incapable of satisfying release-authorization validity (P2-T4). |
| `signature` | object or `null` | yes (key present) | OQ-2 signature-object shape — see §(b) for the full `if`/`then` construction. |

No `title`, `summary`, `targetArtifacts`, `proposedBy`, `proposedAt`, or top-level
`changeProposal.rationale` analog is carried into this schema — see a.3 item 3 for why, and where
that provenance actually lives (E0's `authoring-decisions.yaml`/`rule-provenance.json` sidecars,
untouched by this plan).

Chain/authorization semantics that need to read **multiple** files (e.g. "has this proposal's full
five-role chain reached `approve`") are **P2-T4 validator logic**, not a stored field on any one
file — see §(c) for the one place this multi-file computation is named (the authorship-union).

### a.3 Field-by-field mapping table (every wave0 field accounted for)

Legend: **MAPPED** = direct analog exists; **MAPPED-WITH-RESHAPE** = analog exists but cardinality/
shape changed; **MAPPED-WITH-NARROWING** = analog exists with a reduced value set; **DROPPED** =
no canonical field, with reason.

| # | Wave0 field (`schemas/review-record.schema.json`) | Disposition | Canonical target / reason |
|---|---|---|---|
| 1 | `schemaVersion` | MAPPED | Canonical `schemaVersion`, reset to `1` (new shape lineage, not a carried value). |
| 2 | `id` (`RR-YYYY-NNN`, one per proposal, whole lifecycle) | MAPPED-WITH-RESHAPE | Canonical `review_id` (`rr-<seq4>-<role>`), one **per review act**. Cardinality goes from 1:1 (proposal:record) to 1:5 (proposal:review-act files). |
| 3 | `changeProposal` (`proposalId`, `title`, `summary`, `targetArtifacts[]`, `proposedBy`, `proposedAt`, `rationale`) | DROPPED, replaced by `moduleId` + `subjectContentHash` | The canonical record is a lightweight append-only review-ACT record, not a proposal-tracking record. Proposal narrative already has a canonical home in E0's per-pack sidecars (`authoring-decisions.yaml`, `rule-provenance.json`) — duplicating it into all five per-proposal review files would create a sixth place these facts could drift (DRY). `moduleId` + `subjectContentHash` give exactly the structural binding a review act needs (which module, exactly which artifact bytes) without re-authoring narrative. Note: `changeProposal.rationale` (proposal author's justification) is a **different fact** from the canonical `rationale` field (a.2) — the latter is the *reviewer's* reasoning for their own `decision`, never a carry-over of the former. |
| 4 | `workflowState` (`proposed\|under-review\|disputed\|approved\|rejected`) | DROPPED | No single record's state advances in the canonical model — there is no record to hold this field. Module-level review status (e.g. "has this proposal cleared clinical-1 and clinical-2 yet") is a **derived** view over which role-files exist for a given `moduleId` + `subjectContentHash` (`tools/review-record/cli.mjs list`, P2-T1/P2-T2), never a stored field that could drift from the actual file set. This is a stronger audit property than wave0's stored enum, not a weaker one. |
| 5 | `reviewers[]` array — `humanReviewer` items | MAPPED-WITH-RESHAPE | One array entry becomes one canonical file. Sub-fields disposed individually below. |
| 5a | `reviewers[].reviewerId` | MAPPED | Canonical top-level `reviewerId`. |
| 5b | `reviewers[].name`, `.credential` | DROPPED, moved to roster | Inline identity data is replaced by the `reviewerId` roster reference. Credential/name facts live once, in `governance/reviewer-roster.yaml` (P1-T4), not once per review file — same DRY rationale as item 3. |
| 5c | `reviewers[].reviewerType` (`const: "human"`), `.attestedHuman` (`const: true`) | DROPPED FROM THIS SCHEMA, guarantee re-homed | D-4's two inline structural markers cannot be re-expressed on a schema that no longer embeds an identity object. Preserved as a **three-layer system guarantee** — see a.1. This is the mapping's one genuine structural risk and is called out explicitly for P1-GATE2. |
| 5d | `reviewers[].role` (`primary-reviewer\|secondary-reviewer\|conflict-arbiter`) | MAPPED-WITH-RESHAPE | Canonical `role` enum (`clinical-1\|clinical-2\|lab\|adjudication\|release-auth`) per ADR-0004's five-role minimum-roles table. Rough correspondence only, not 1:1 semantics: `primary-reviewer` ~ `clinical-1`, `secondary-reviewer` ~ `clinical-2`, `conflict-arbiter` ~ `adjudication`; ADR-0004 additionally names a distinct `lab` role and a distinct terminal `release-auth` role that wave0 never modeled at all. |
| 5e | `reviewers[].decision` (`pending\|approve\|reject\|request-changes\|abstain`) | MAPPED-WITH-NARROWING | Canonical `decision` enum (`approve\|reject\|request-changes`). `pending` DROPPED: canonical files are only created once a decision exists — no file means no act yet; there is no mutable "pending" record (ADR-0004 forbids in-place edits). `abstain` DROPPED: no ADR-0004 role or E1 FR names abstention; a v2 schema-version bump would add it deliberately if ever needed, never silently. |
| 5f | `reviewers[].comment` (optional) | MAPPED, required | Canonical `rationale`, upgraded optional → required (a.2). |
| 5g | `reviewers[].decidedAt` (nullable) | MAPPED, non-nullable | Canonical `reviewedAt`, required non-null (canonical records only exist once decided, so there is no "not yet decided" state to leave null for). |
| 6 | `conflictResolution` (nullable: `triggeredAt`, `reason`, `resolvedBy{name,credential,reviewerType,attestedHuman}`, `resolution` enum, `resolvedAt`, `notes`) | DROPPED, folded into the `adjudication`-role file | Wave0 modeled dispute resolution as an embedded sub-object on the one evolving record. Canonical has no such record — adjudication is simply its own top-level review-act file (`role: adjudication`) using the exact same shape as every other role. `conflictResolution.reason` → the adjudication file's own `rationale`. `conflictResolution.triggeredAt`/`.resolvedAt` collapse to the adjudication file's single `reviewedAt` (the "when did the dispute start" fact is derivable from the `clinical-1`/`clinical-2` files' own `reviewedAt` via the hash chain, not re-stored). `conflictResolution.resolvedBy{...}` → the adjudication file's own top-level `reviewerId` (same DRY rationale as item 5b/5c — no embedded identity object). |
| 6a | `conflictResolution.resolution` (`escalated-to-additional-review\|returned-to-authors\|resolved-by-arbiter`) | DROPPED-WITH-REASON | Canonical adjudication's `decision` enum already carries the outcome. Wave0's escalation semantics (route to a *third* reviewer, or return to authors) are unmodeled in ADR-0004's fixed five-role structure and out of E1 scope: disagreement between `clinical-1`/`clinical-2` routes straight to the single named `adjudication` role, not a variable escalation path. |
| 7 | `approvedBy[]` (flat array of non-empty strings, byte-compatible with `module-manifest`/`rule` schemas' `approvedBy`/`clinicalApprovers`) | DROPPED FROM THIS SCHEMA, compatibility re-homed | Wave0's own description names this field's purpose: a future, **separately gated** act could copy it verbatim into a module manifest. That downstream act is untouched by E1 — `module-manifest.schema.json`'s `approvedBy[]` and `rule.schema.json`'s `clinicalApprovers[]` both stay `maxItems: 0` (FR-6, hard guardrail, unconditionally). The canonical per-role-act model has no single record that ever reaches an "approved, dual-signed-off" terminal state the way wave0's record did — the closest equivalent ("does this proposal's full role chain resolve to approve") is a **multi-file computation**, P2-T4's job, never a stored field on any one canonical file. If/when a future, separately gated act needs an `approvedBy[]`-shaped array, P2-T4's chain computation is directed to emit one as a flat array of non-empty strings — preserving the *intent* of wave0's byte-compatibility requirement even though no field on this schema itself carries that shape anymore. |
| 8 | `history[]` (`{state, enteredAt, actor, note}`, append-only log on the one record) | DROPPED | The canonical model's append-only property is achieved at the **file** level, not an in-record log: a new immutable file per review act, chained via `previousRecordHash`. The ordered file sequence for a `moduleId` (`rr-0001-*`, `rr-0002-*`, …) *is* the history — and is more tamper-evident than wave0's `history[]` array, which lived inside a single mutable-until-approved record with no cross-file hash chain at all. |
| 9 | `createdAt` / `updatedAt` | MAPPED-WITH-NARROWING | Canonical single `reviewedAt`. The created/updated distinction is meaningless for a record that is immutable from the moment it is written — "created" and "updated" always coincide, so collapsing to one field removes a redundant pair that could otherwise drift. |
| — | `$defs.workflowState` | DROPPED | See item 4; no canonical field holds this concept. |
| — | `$defs.reviewerRole` | MAPPED-WITH-RESHAPE | See item 5d. |
| — | `$defs.humanReviewer` | MAPPED-WITH-RESHAPE (decomposed) | Its fields are individually disposed under item 5a-5g. |
| — | `$defs.changeProposal`, `$defs.historyEntry` | DROPPED | See items 3 and 8. |

**No wave0 field is unaccounted for.** Every top-level property, every `$defs.humanReviewer`
sub-field, and every `$defs.changeProposal`/`conflictResolution`/`historyEntry` sub-field appears
above with an explicit disposition.

### a.4 D-4 preservation checklist (for P1-T2's own tests and P1-GATE2)

- [ ] `synthetic: false` + populated `signature` → schema rejects (§(b)).
- [ ] `synthetic: true` + `signature.keyId` not matching `^TESTKEY-` → schema rejects (§(b)).
- [ ] `role` value not matching the `review_id` suffix → schema rejects (a.2's `if`/`then` cross-check).
- [ ] No field on this schema can express an ARC/council/automated/model-self-review source as a
      `reviewerId` value (the schema cannot enforce *humanness* of a referenced id at all — that
      guarantee lives entirely in the roster schema + P1-T7 validator wiring, per a.1; this line
      item exists so P1-GATE2 checks the roster/validator side, not this schema, for that
      guarantee).
- [ ] `approvedBy[]`/`clinicalApprovers[]` on `module-manifest.schema.json`/`rule.schema.json`
      remain `maxItems: 0`, byte-untouched by this plan.

---

## (b) OQ-2 — store layout + signature-object shape

**Store layout.** One append-only YAML file per review act at
`modules/<module_id>/reviews/<review_id>.yaml`, `review_id = rr-<seq4>-<role>` (role ∈
`clinical-1 | clinical-2 | lab | adjudication | release-auth`), e.g.
`modules/cbc_suite_v1/reviews/rr-0001-clinical-1.yaml`. `<seq4>` is a zero-padded 4-digit sequence
number, global per module (not per role) — matching `review_id`'s pattern in a.2. Corrections are
new superseding records (`supersedes: <review_id>`), never edits. Append-only is enforced two ways:
the `previousRecordHash` hash-chain field (a.2), validated by the CLI, plus a git-history validator
(P2-T3) that rejects any mutation or deletion of an existing record path.

**Signature-object shape.** Detached Ed25519 semantics, embedded as a `signature` object:

```json
{ "algorithm": "ed25519", "keyId": "<string>", "value": "<base64/hex string>" }
```

...computed over the canonicalized record bytes **minus the signature object itself** — the same
ADR-0005 mechanism used for release-manifest signing, satisfying ADR-0004's "signature binds
reviewer identity to content hash." **Git commit signatures are explicitly not the review
signature**: the committer is the platform owner (author-in-effect), which would recreate
SPIKE-006's signer=author collapse and cannot express five distinct reviewer identities on the same
commit.

**Schema mechanics (`schemas/review-record.schema.json`, P1-T2), expressed in the local validator's
supported keyword set — `const`, `if`/`then`, `pattern`, no `$data` (confirmed against
`scripts/lib/json-schema-lite.mjs`, §(e) item 5):**

```
"signature": {
  "type": ["object", "null"]
},
...
"allOf": [
  {
    "if": { "properties": { "synthetic": { "const": false } } },
    "then": { "properties": { "signature": { "type": "null" } } }
  },
  {
    "if": { "properties": { "synthetic": { "const": true } } },
    "then": {
      "properties": {
        "signature": {
          "type": "object",
          "additionalProperties": false,
          "required": ["algorithm", "keyId", "value"],
          "properties": {
            "algorithm": { "const": "ed25519" },
            "keyId": { "type": "string", "pattern": "^TESTKEY-" },
            "value": { "type": "string", "minLength": 1 }
          }
        }
      }
    }
  }
]
```

This is schema-forced-empty on any non-synthetic (real) record — const/type-null pattern, mirroring
`clinicalApprovers[]`'s `maxItems: 0` idiom for an object-typed field instead of an array. On
`synthetic: true` records, `signature.keyId` **must** match the `TESTKEY-` prefix; a `synthetic:
true` record can never satisfy any release-authorization validity condition regardless of its
signature (that check is P2-T4's job, over multiple files, not expressible here).

**Interim semantics pre-G1/G2 (PRD OQ-2 second half):** synthetic dry-run records carry throwaway
test-key signatures whose `keyId` has the structural `TESTKEY-` marker (OQ-6: ephemeral in-memory
key generation, never written to the tree — see the parent plan's OQ-6 resolution, unchanged by
this note). Real (non-synthetic) records have the `signature` slot schema-forced empty until G1/G2
clear.

---

## (c) PRD OQ-5 — authorship-union definition (consumed by FR-5/FR-23)

**Definition (binding, adopted verbatim from the parent implementation plan's OQ-5 resolution —
this note does not revise it, only restates it as P1-T1's authoritative source and adds the
schema/mechanism sketch the parent plan left implicit):**

The "author" of a converter-produced pack is the **union of**:

1. every human identity recorded in the pack's `authoring-decisions.yaml` decision records, and
2. the git author of record of the commit that introduced the proposal pack.

The converter tool itself is never an identity — it cannot appear in this union under any
circumstance.

**Mechanism.** This union is a **machine-readable `authorship` block**, computed by
`tools/review-record/cli.mjs validate` (P2-T4) — not a stored field on any canonical review-record
file, because it requires reading two sources outside any single review file (the pack's
`authoring-decisions.yaml` sidecar and `git log`), which the schema layer cannot express (no
`$data`, no filesystem/VCS access from `scripts/lib/json-schema-lite.mjs`). The block shape (for
P2-T4 to implement, not schema-validated by P1-T2):

```json
{ "authors": ["<human identity string>", ...], "sources": ["authoring-decisions" | "git-commit-author"] }
```

The adjudication (FR-5) and release-authorization (FR-6/FR-23) validators reject any adjudicator or
release-authorizer whose roster `reviewerId` maps (via the roster's `name`/`credentialRef`) to any
identity in this union — i.e., nobody who authored or committed the proposal may adjudicate or
authorize its own release. FR-23's discordance/adjudication records (Workstream C, P4-T5) reuse
this exact helper by import, never by re-implementation (P4-T5's own AC already requires this,
grep-tested).

**Why this belongs in P1, not P2/P4:** both FR-5 (Workstream A) and FR-23 (Workstream C) depend on
the identical definition; fixing it once here, before either workstream's tasks start, prevents two
independently-invented "authorship" notions from shipping in parallel wave-2 lanes (the same class
of risk R5 exists to prevent for the review-record model itself).

---

## (d) OQ-4 — `releases/registry.json` entry shape (FR-14 fields only, inert withdrawal consts)

**Definition (binding, adopted verbatim from the parent implementation plan's OQ-4 resolution;
restated here as P1-T1's authoritative source for P1-T5's schema work):**

Entry shape — exactly the FR-14 list, nothing more:

```json
{
  "version": "<string>",
  "moduleId": "<string>",
  "packDigest": "sha256:<64 hex>",
  "manifestDigest": "sha256:<64 hex>",
  "signature": null,
  "signedAt": null,
  "supersedes": null,
  "withdrawalState": "none",
  "withdrawnAt": null,
  "withdrawalReason": null
}
```

...plus a top-level `schemaVersion` on the registry document itself (an array of these entries, or
`{ "schemaVersion": <int>, "entries": [...] }` — P1-T5 picks the exact envelope; either satisfies
this note's field list, the registry-seed file itself ships in P3-T4, not this task).

**Schema mechanics for `schemas/release-registry.schema.json` (P1-T5):**

- `signature`: `type: "null"` for every E1 entry — no branch exists yet under which it could be
  non-null (mirrors §(b)'s pattern, simpler here since **no** registry entry may carry a real or
  test-key signature in E1: registry entries are integrity records for candidates, not the
  candidate manifests themselves; a real signature only ever lives on the manifest's own signature
  slot, gated per §(b)/G2).
- `signedAt`, `supersedes`, `withdrawnAt`, `withdrawalReason`: `type: "null"`, i.e. always exactly
  `null` in E1 — no schema branch admits a non-null value (P1-T5's AC requires a
  `withdrawalState: "withdrawn"` fixture to be rejected; the `const` on `withdrawalState` alone
  already achieves this, these three fields' `null`-only typing reinforces it).
- `withdrawalState`: `const: "none"` — E1 never sets any other value; DF-E2-03 extends this field
  family later, not this plan.
- **Fields explicitly omitted, not deferred silently:** any surveillance/re-verify-cadence field,
  any materiality-class field, any `signer`/`custodian` identity field beyond what `signature`
  itself would carry once non-null. These belong to ADR-0007's unaccepted taxonomy (DF-E2-01);
  seeding them now would speculate ahead of G0. `additionalProperties: false` on the entry schema
  makes this omission structural, not merely a documentation note.

`packDigest`/`manifestDigest` use the same `sha256:<64 hex>` pattern already established by
`release-manifest.schema.json`'s `testCorpusHash`/`traceabilityHash` (confirmed by inspection) —
new pattern, not invented ad hoc.

---

## (e) Wave0-schema consumers found by grep — inventory + disposition

Search performed: `grep -rn "review-record" --include="*.mjs" --include="*.js" --include="*.json"
--include="*.yaml" --include="*.md" scripts/ tests/ src/ tools/ docs/` plus a second pass for
`reviewRecord|ReviewRecord|review_record` across `scripts/ tests/ src/ tools/` (zero additional
hits — the codebase only ever spells this concept `review-record`, kebab-case, no alternate
casing).

| # | Path | Kind | Consumer? | Disposition |
|---|---|---|---|---|
| 1 | `tests/review-record-schema.test.mjs` | Executable test (~15 assertions) | **Yes — direct, loads the live schema file and its example fixture, validates 4-state round-trip, D-4 consts, `approvedBy` state-gating, and byte-compatibility with `module-manifest.schema.json`.** | **DELETE in P1-T3.** Every assertion tests the wave0 shape specifically (`workflowState`, `reviewers[]`, `conflictResolution`, `approvedBy` — none of which exist on the canonical schema per §(a)). It cannot be repurposed in place without becoming misleading; its own header comment names it `EP7-T1`. P1-T2's own AC already requires a *new* canonical-schema test suite (five role fixtures under `tests/fixtures/ef-review-records/`); P1-T3's AC ("zero remaining references to the wave0 5-state contract outside the migration helper and its fixtures") requires this file's dependency on the live schema to be gone. |
| 2 | `schemas/examples/review-record.example.json` | Fixture consumed by #1 | **Yes — indirect, via #1.** | **RELOCATE, do not delete outright.** P1-T3 needs "a representative wave0-shaped record fixture for each of the 5 wave0 states" (plan wording) as the migration function's input corpus. This file (the terminal `approved` state) plus the three earlier-state snapshots the old test synthesizes inline (`buildSnapshots()` in #1) together already cover exactly those 5 states. Move/copy under `tools/review-record/lib/` or `tests/fixtures/ef-review-record-migration/` (import-safe, standalone per P1-T3's wording) as the migration test's wave0-shaped *input* corpus — it stops being "the schema's own example" (the schema it exemplified no longer exists at this path after P1-T2) and becomes the migration test's seed data. |
| 3 | `docs/project_plans/design-specs/review-portal-design.md` | Paper design doc (wave0-era, `feature_slug: wave0-safety-foundation`) | **No — narrative reference only, not code; not in this plan's `files_affected`.** | **No edit required by P1-T1/T2/T3.** Its own text already states "the schema is the source of truth... where this document's prose and the schema disagree, the schema wins," so it does not need correcting to stay honest — but it will read as describing a schema that no longer exists at that shape. Recommended for the **P5-T2 honesty-language audit owner**: this file is not currently in P5-T2's bounded `target_surfaces` list; flag it as a candidate for either a one-line "superseded by ADR-0004 canonical model, see `contracts-design.md`" pointer, or an explicit documented exclusion. This note does not add a new task (would require a plan-level change) — it records the disposition for the P5 owner to see. |
| 4 | Planning/PRD/roadmap docs referencing the schema path as a string (wave0 PRD, wave0 implementation plan + phase-7 file, E1 PRD, E1 implementation plan + phase files, human-briefs, `01-platform-expansion-roadmap.md`) | Prose/frontmatter references (`files_affected`, `references.specs`, narrative describing FR-2's own migration) | **No — these documents describe the migration this task performs; they are not executable and require no code change.** | **No action.** They are internally consistent with the target state this note specifies. |
| 5 | `scripts/validate-kb.mjs` | Build/CI validator | **No — confirmed zero references to `review-record`/`reviews` anywhere in this file (grep hit count: 0).** | **No migration needed; P1-T7 is net-new wiring, not an update.** This matters directly for P1-T7's implementer: there is no existing wave0 hook to find or adapt — `scripts/validate-kb.mjs` has never validated review records at all. P1-T7 adds the first-ever `modules/<id>/reviews/*.yaml` validation call, wired against the P1-T2 canonical schema from day one. |
| 6 | `src/` (browser SPA) | Runtime code | **No — confirmed zero references to `review-record`/`reviewRecord`/`ReviewRecord`/`review_record` anywhere under `src/`.** | **No action.** Consistent with wave0's own EP7 scope note ("data contract only, not the app") — the SPA never touched this contract, and this plan's PRD confirms the deployed SPA/API stay untouched (§2 Architectural Context). |

**Summary for P1-T2/T3:** exactly one executable consumer (#1) and one fixture it depends on (#2)
require action; both are handled inside P1-T3's migration-test task, not P1-T2's schema-replacement
task, so that `npm run check` never goes red between the two (P1-T2 lands the new schema; P1-T3, in
the same dependency chain, removes/relocates the last wave0-shape references in the same commit
sequence per its own AC). No other path under `scripts/`, `tests/`, `src/`, or `tools/` needs
updating.
