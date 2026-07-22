# `review-record`

Offline, deterministic CLI for the **ADR-0004 five-role review-record workflow** — Evidence Foundry
E1's review-workflow machinery. Design/scaffold task **P2-T1** (OQ-1/OQ-2/FR-1/FR-7). Plan:
`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md` and its
`evidence-foundry-e1-v1/phase-2-4-workstreams.md` phase file (row `P2-T1`).

**Status (as of P2-T4)**: `list` (P2-T1) and `scaffold`/`validate` (P2-T2 first increment, extended
P2-T3/T4) are real. `render`/`dry-run` remain dispatch stubs (`NotImplementedError`, exit 1) until
P2-T6/P2-T8. `validate` now covers per-record schema shape, D-4 roster resolution, the FR-4
reviewer-2 textual-independence heuristic (P2-T2), the FR-9/OQ-2 two-layer append-only enforcement
(P2-T3, see "Append-only enforcement" below), and PRD OQ-5's authorship-union computation +
FR-5 (adjudicator/release-authorizer not-in-authorship-union) + FR-6 (release-authorization chain
validity) checks (P2-T4, see "Adjudication + release-authorization" below) — signature (P2-T5)
checks land on the same verb next. Nothing in this tool signs, releases, or clinically approves
anything; nothing in this tool clears, advances, or partially satisfies any of the G0–G4 human gates
(`docs/governance/gates-registry.md`). Structural validity proven by any verb here never implies
clinical validity, safety, or that a named human clinician reviewed anything — see
`schemas/review-record.schema.json`'s own top-level description for that standing caveat.

### Adjudication + release-authorization (P2-T4, PRD OQ-5/FR-5/FR-6)

`lib/adjudication.mjs` computes the PRD OQ-5 authorship-union — the union of (a) every human
identity git-recorded against a module's `authoring-decisions.yaml` and (b) the git author of the
commit that introduced `modules/<id>/module.json` (the proposal-introducing commit); the converter
tool is never an identity (a defensive name-based denylist excludes bot/automation-shaped git
authors). `schemas/authoring-decisions.schema.json` carries no in-band identity field today, so
source (a) is git-history-derived rather than an invented schema field — see
`lib/adjudication.mjs`'s own header for the full honest note. `validate` rejects any
`adjudication`/`release-auth` record whose resolved roster identity is in this union (FR-5), and
fails closed (rather than silently passing) whenever the union cannot be fully computed. Separately,
`evaluateReleaseAuthorization` enforces FR-6: a `release-auth` record is valid only over a complete
(all five roles present), chain-valid, roster-verified, non-synthetic record set — since
`governance/reviewer-roster.yaml` ships synthetic-only pre-G1 (FR-3), this is structurally
non-qualifying for any record this tool can currently produce, re-asserting (not weakening) P1-T7's
`unsigned-stub → release-ready` schema-impossible ceiling.

### Append-only enforcement (P2-T3, FR-9/OQ-2)

`validate --module <id> [--history]` enforces append-only two ways, both fail-closed:

- **Layer (a) — `previousRecordHash` chain, ALWAYS run.** Reuses `lib/chain.mjs`'s
  `checkModuleChainLinkage` (the exact same structured, deterministic report `list` already prints
  informationally, P2-T1) as `validate`'s fail-closed enforcement input — one chain-recomputation
  implementation, not two. Any record whose declared `previousRecordHash` does not recompute cleanly
  from its immediately preceding module record (or, for a module's first record, is not `null`)
  fails closed with a `chain:`-prefixed violation.
- **Layer (b) — `validate --history`, OPT-IN git-history check.** `lib/history.mjs`'s
  `checkAppendOnlyHistory` runs `git log --reverse --name-status` (local, offline, `node:child_process`
  invoking the locally-installed `git` binary — never a network fetch/clone/pull) scoped to
  `modules/<moduleId>/reviews/` inside `--root`, and asks: has any record path EVER been touched by
  more than one commit? A path whose full git history is not exactly one `A` (added) entry — a
  second commit with status `M`/`D`/anything else — fails closed with a `git-history:`-prefixed
  violation. Requires `--root` to be inside a real git working tree
  (`NotAGitRepositoryError` otherwise, itself fail-closed rather than silently skipped) — most
  fixture trees under `tests/fixtures/` are NOT their own git repository, so `--history` is
  exercised in this tool's tests against scratch `git init` repos built in a temp directory, never
  against the real fixture tree.

Both layers report EVERY violation found (not just the first) into the same `ValidationFailedError`
alongside the P2-T2 schema/roster/independence findings — every violation string is prefixed by its
originating layer (`chain:`/`git-history:`, vs. the unprefixed schema/roster lines and the
independence heuristic's own message text) so the layers are always distinguishable in output.
Corrections are new superseding records (`supersedes: <review_id>`) — layer (a) accepts a
correction because it is a brand-new chain-linked record, while layer (b) accepts it because it is a
brand-new git path with its own single `A` history; an in-place edit of an EXISTING path fails
BOTH layers independently (layer (a) only if some later record's hash still points at the old
bytes; layer (b) unconditionally, since it inspects git history directly rather than inferring
mutation from a hash mismatch).

**`scaffold`'s write path is signature-gated, and is correctly inert today** (P2-T2): `reviewerId`
must resolve against `governance/reviewer-roster.yaml` (fail closed on unknown identity or an
out-of-scope module — `lib/roster.mjs`). The resulting draft's `synthetic` flag is always taken
from the resolved roster entry, never asserted independently — and per FR-3 the real roster ships
empty/synthetic-only pre-G1, so every `reviewerId` this verb can currently resolve is
`synthetic: true`. `schemas/review-record.schema.json` requires a populated `TESTKEY-` signature on
every `synthetic: true` record, and `scaffold` owns no signing capability (that is P2-T5, composed
by the P2-T8 `dry-run` flow) — so `scaffold` never writes a `synthetic: true` draft to disk; it
prints a clearly-labeled, fully-shaped preview instead. The disk-write path
(`lib/store.mjs`'s `writeNewReviewRecordFile`, an append-only guard) only fires for a
`synthetic: false` roster entry, which cannot legitimately exist before gate G1 clears (a human act
no task performs) — this mirrors this program's "signature slots const-null on real candidates,
roster synthetic-only pre-G1" guardrail exactly, rather than working around it.

**FR-4 reviewer-2 independence is enforced two ways**: (1) STRUCTURALLY — every role's `scaffold`
draft (including `clinical-2`) links into the module's hash chain via `lib/chain.mjs`'s
`nextChainLink`, which returns only a sequence number and a hash string, never a sibling record's
parsed content; there is no code path in `scaffold` that ever reads a `clinical-1` record's
`decision`/`rationale`/`reviewerId`. (2) a SUPPLEMENTARY heuristic — `lib/independence.mjs`'s
`checkReviewerIndependence`, which `validate` runs over a module's `clinical-1`/`clinical-2` pair,
flags verbatim textual overlap or a direct reference to the sibling reviewer's identity. The
heuristic catches copy-paste, not paraphrase — see that module's own header for the honest scope of
what it can and cannot detect.

## Why this tool exists (and why it is not `scripts/validate-kb.mjs`)

`scripts/validate-kb.mjs` already schema- and cross-record-validates every
`modules/<id>/reviews/*.yaml` file at `npm run validate` time (P1-T7) — that check is required
infrastructure and stays exactly where it is. This tool is the **authoring and read-side surface**
a human (or an agent acting on a human's behalf, pre-gate) uses to create, inspect, and eventually
render those same files — a CLI, not a service, not a portal, not a second source of truth for the
schema.

## CLI usage

```bash
node tools/review-record/cli.mjs --help

# The only fully implemented verb in P2-T1:
node tools/review-record/cli.mjs list \
  --module fixture_module_v1 \
  --root tests/fixtures/ef-review-record-cli
# -> prints a per-module review-record state summary (records by role, informational chain
#    linkage, synthetic flags) read from <root>/modules/fixture_module_v1/reviews/*.yaml.

# Real modules (once records exist there — none do yet outside P2-T8's dry-run set):
node tools/review-record/cli.mjs list --module cbc_suite_v1
```

`--root` defaults to `process.cwd()` (the real repo root in normal use). Tests point it at fixture
trees under `tests/fixtures/` instead — this keeps hand-authored CLI-test fixtures completely
outside the real `modules/` tree, so they can never be mistaken for real review records and never
fire `scripts/validate-kb.mjs`'s runtime `modules/<id>/reviews/*.yaml` scan (a scan that is now
fail-closed against `governance/reviewer-roster.yaml` — see the Phase 1 completion note's
watch-for).

## Module boundary

Five internal boundaries, one file (or small directory) each — the shape P2-T2..T6 build against,
matching this repo's E0 (`tools/rf-bundle-to-kb-pack/`) convention of one narrow file per
responsibility plus a `lib/verbs/` directory of thin verb handlers:

| Module | File | Responsibility | Owning task | Depends on |
|---|---|---|---|---|
| CLI dispatch | `cli.mjs` | Arg parsing, `--help`, verb routing, top-level exit-code handling | **P2-T1** (this task) | — |
| Error taxonomy | `lib/errors.mjs` | `CliError` base + `EXIT_OK`/`EXIT_USAGE` + `NotImplementedError` + (P2-T2) `UnknownReviewerError`/`ReviewerNotInScopeError`/`RecordAlreadyExistsError`/`ValidationFailedError` | **P2-T1**, extended **P2-T2** | — |
| **Store** | `lib/store.mjs` | OQ-2 path layout (`modules/<id>/reviews/rr-<seq4>-<role>.yaml`), `review_id` <-> `{seq, role}`, read-only listing of a module's committed records, next-sequence lookup; (P2-T2) `serializeReviewRecordYaml` + `writeNewReviewRecordFile` — the ONE append-only write path in this tool | **P2-T1**, write path **P2-T2** | errors, `../rf-bundle-to-kb-pack/lib/yaml-lite.mjs` |
| **Chain** | `lib/chain.mjs` | The one canonical `previousRecordHash` hashing convention (`canonicalRecordHash`/`stableStringify`) + a read-only, informational chain-linkage report `list` uses; (P2-T2) `nextChainLink` — the one channel `scaffold` uses to link a new draft into a module's chain, returning only a seq + hash string, never sibling record content (the FR-4 structural-independence mechanism). `checkModuleChainLinkage`'s report is ALSO (P2-T3) `validate`'s fail-closed chain-enforcement input — one implementation, two consumers (informational `list`, fail-closed `validate`) | **P2-T1 primitive; P2-T2 `nextChainLink`; P2-T3 consumed as enforcement input by `validate`** | store |
| **History** | `lib/history.mjs` | Layer (b) of FR-9/OQ-2 append-only enforcement — `checkAppendOnlyHistory` runs a local, offline `git log --name-status` scoped to a module's `reviews/` path and reports (structured, deterministic) whether any record path was ever touched by more than one commit. Opt-in (`validate --history`), fail-closed on a genuine tool-usage failure (not a git repo), never throws for a detected mutation itself (that is `validate`'s call) | **P2-T3** | errors |
| **Roster** | `lib/roster.mjs` | Resolve `reviewerId` against `governance/reviewer-roster.yaml` (unknown identity / out-of-scope module both fail closed, FR-3) | **P2-T2** | errors, `../rf-bundle-to-kb-pack/lib/yaml-lite.mjs` |
| **Independence** | `lib/independence.mjs` | Supplementary, heuristic FR-4 reviewer-2-independence check (`checkReviewerIndependence`) — verbatim textual overlap / direct sibling-identity reference between a module's `clinical-1`/`clinical-2` records. NOT the primary enforcement (see Roster/Chain above and this file's own header) | **P2-T2** | — |
| **Adjudication** | `lib/adjudication.mjs` | `computeAuthorshipUnion` (PRD OQ-5, git-history-derived — see "Adjudication + release-authorization" above) + `rosterEntryInAuthorshipUnion` (FR-5) + `evaluateReleaseAuthorization` (FR-6) | **P2-T4** | store, chain |
| **Signature** | *(new in P2-T5)* | Ed25519 sign/verify over canonicalized record bytes minus `signature` (`node:crypto` only, `TESTKEY-` dry-run only) | **P2-T5** | chain |
| **Render** | *(new in P2-T6)* | Read-only static HTML render to `build/review-render/` | **P2-T6** | store, chain |
| Verb handler | `lib/verbs/scaffold.mjs` | `scaffold` verb — builds + (signature-gated) writes a draft; see this file's "Status" section above | stub P2-T1, real **P2-T2** | store, chain, roster |
| Verb handler | `lib/verbs/validate.mjs` | `validate` verb — schema shape + roster resolution + independence heuristic (P2-T2); FR-9/OQ-2 two-layer append-only enforcement, chain (always) + `--history` git-history check (P2-T3); PRD OQ-5 authorship-union / FR-5 adjudicator-authorship + FR-6 release-authorization validity (P2-T4) | stub P2-T1, first increment **P2-T2**, extended **P2-T3/T4**, further **P2-T5** | store, roster, independence, chain, history, adjudication, `../../../scripts/lib/json-schema-lite.mjs` |
| Verb handler | `lib/verbs/list.mjs` | `list` verb — per-module review-record state summary | **P2-T1** (real) | store, chain |
| Verb handler | `lib/verbs/render.mjs` | `render` verb | stub P2-T1, real **P2-T6** | render |
| Verb handler | `lib/verbs/dry-run.mjs` | `dry-run` verb | stub P2-T1, real **P2-T8** | scaffold, signature, validate |

**Verb-handler contract**: every file under `lib/verbs/` exports `async function run(options)` that
either resolves to a numeric process exit code (`EXIT_OK`/`EXIT_USAGE` from `lib/errors.mjs`) or
throws a `CliError` (or subclass). `cli.mjs` forwards a thrown `CliError`'s `exitCode` verbatim — it
never remaps it. A non-`CliError` throw (a genuine bug) falls back to `EXIT_USAGE` (1).

## OQ-2 store layout

```
modules/<module_id>/reviews/rr-<seq4>-<role>.yaml
```

- `<seq4>` — zero-padded 4-digit sequence number, **global per module**, not per role. Successive
  review acts for the same proposal (across all five roles) share one increasing sequence.
- `<role>` — one of `clinical-1`, `clinical-2`, `lab`, `adjudication`, `release-auth`
  (`schemas/review-record.schema.json`'s `role` enum, `lib/store.mjs`'s `REVIEW_ROLES`).
- One append-only file per review **act**. Corrections are new superseding records
  (`supersedes: <review_id>`), never edits — `lib/store.mjs` exposes no update/delete path, only
  read (`listModuleReviewRecords`) and sequence lookup (`nextSequenceFor`) in this task; the write
  path lands with `scaffold` in P2-T2.

`list --module <id>` walks this exact layout and reports, per record: `role`, `reviewerId`,
`decision`, `synthetic`, `reviewedAt`, `supersedes`, `previousRecordHash`, and an **informational**
chain-linkage status (`lib/chain.mjs`) — never a fail-closed judgment. A module with no
`reviews/` directory yet (the common case for every real module today) is not an error; `list`
reports zero records.

## Design decisions

### No `yaml`/JSON-Schema npm dependency — reuse E0's parser, don't fork it

Per this repo's already-settled architectural posture (`tools/rf-bundle-to-kb-pack/README.md`'s
own "Design decisions" section, itself citing `scripts/lib/json-schema-lite.mjs`'s zero-dependency
rationale): this repository ships zero runtime dependencies. `lib/store.mjs` imports
`parseYamlDocument` directly from `tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs` rather than
duplicating a second hand-rolled YAML parser — one parser, two tools, same fail-closed subset
(an unrecognized YAML construct raises rather than being silently guessed at). If a future task in
this tool needs a construct outside that parser's subset, escalate (new finding) rather than
quietly forking or relaxing it. `scripts/lib/json-schema-lite.mjs` is the analogous reuse target
for `validate` once P2-T3+ lands real schema-checking logic in this CLI (today, schema checking for
committed review records already runs via `scripts/validate-kb.mjs` at `npm run validate` time —
this CLI's own `validate` verb is additive tooling, not a second schema-validation entry point).

### Chain hashing is defined once, here, and reused downstream

`lib/chain.mjs`'s `canonicalRecordHash`/`stableStringify` is the ONE canonicalization every later
chain- or signature-touching task in this phase must reuse — `previousRecordHash` (P2-T2's
`scaffold` write path, P2-T3's `validate` enforcement) and the Ed25519 signature preimage (P2-T5,
"canonicalized record bytes minus the signature object") both need a single deterministic
serialization, not two independently-invented ones. `tools/review-record/lib/wave0-migration.mjs`
(P1-T3) has its own internal-only `stableStringify` that its header explicitly disclaims as "not...
the authoritative implementation" of this spec — `lib/chain.mjs` is that authoritative
implementation.

### `list`'s chain-linkage column is informational, not enforcement

`list` never exits non-zero on a broken chain — it only reports what it observes about the records
it found on disk. Fail-closed append-only enforcement (recomputing the chain and rejecting on any
break, plus rejecting any git-history mutation/deletion of an existing record path) is P2-T3's
explicit, `extended`-effort deliverable (`validate`/`validate --history`). Do not read a `list`
"chainLinkage: ok" line as proof a record set has passed `validate`.

### Zero network / zero LLM, structurally

No file in this tool imports `node:http`, `node:https`, `node:dgram`, `fetch`, or any AI/model SDK.
`tests/ef-review-record-cli.test.mjs` statically greps every file under `tools/review-record/` for
those patterns and additionally invokes each verb with `globalThis.fetch` patched to throw, so an
accidentally-introduced network call fails the test suite rather than silently succeeding.
`lib/history.mjs` (P2-T3) is a deliberate, narrow exception to "no other process spawning": it uses
`node:child_process` to invoke the LOCALLY installed `git` binary against the working tree already
on disk (`git log`/`git rev-parse`, read-only, no `fetch`/`clone`/`pull`/`push`) — this is VCS
introspection over local state, not a network call, and stays outside every pattern the grep above
forbids.

## Directory layout

```
tools/review-record/
  cli.mjs                   verb dispatch, --help, top-level exit-code handling (P2-T1)
  README.md                  this file
  lib/
    errors.mjs                 CliError taxonomy (P2-T1, extended P2-T2)
    store.mjs                   OQ-2 store layout: paths, review_id parsing, listing (P2-T1); write path (P2-T2)
    chain.mjs                    canonical hashing + informational linkage report (P2-T1 primitive); nextChainLink (P2-T2); consumed as validate's chain-enforcement input (P2-T3)
    history.mjs                   FR-9/OQ-2 append-only layer (b): git-history append-only check (P2-T3)
    adjudication.mjs               PRD OQ-5 authorship-union + FR-5/FR-6 adjudication/release-authorization validators (P2-T4)
    roster.mjs                    reviewerId resolution against governance/reviewer-roster.yaml (P2-T2)
    independence.mjs               heuristic FR-4 reviewer-2-independence check (P2-T2)
    wave0-migration.mjs             wave0 -> canonical migration helper (P1-T3, unrelated to CLI dispatch)
    verbs/
      list.mjs                       `list` verb — real (P2-T1)
      scaffold.mjs                    `scaffold` verb — real (P2-T2)
      validate.mjs                     `validate` verb — first increment real (P2-T2); FR-9/OQ-2 append-only enforcement (P2-T3); PRD OQ-5/FR-5/FR-6 adjudication + release-authorization (P2-T4); extended P2-T5
      render.mjs                        `render` verb — stub (real: P2-T6)
      dry-run.mjs                        `dry-run` verb — stub (real: P2-T8)
```

`build/review-render/` (P2-T6's eventual render output root) is git-ignored (`.gitignore`) —
nothing under it is ever committed. Golden/fixture output lives under
`tests/fixtures/ef-review-render/` instead (OQ-3).
