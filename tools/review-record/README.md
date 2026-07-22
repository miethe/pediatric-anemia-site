# `review-record`

Offline, deterministic CLI for the **ADR-0004 five-role review-record workflow** — Evidence Foundry
E1's review-workflow machinery. Design/scaffold task **P2-T1** (OQ-1/OQ-2/FR-1/FR-7). Plan:
`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md` and its
`evidence-foundry-e1-v1/phase-2-4-workstreams.md` phase file (row `P2-T1`).

**Status (as of P2-T1)**: `list` is real. `scaffold`, `validate`, `render`, `dry-run` are dispatch
stubs (`NotImplementedError`, exit 1) — each lands in the phase-2 task that owns it (see the verb
table below). Nothing in this tool signs, releases, or clinically approves anything; nothing in
this tool clears, advances, or partially satisfies any of the G0–G4 human gates
(`docs/governance/gates-registry.md`). Structural validity proven by any verb here never implies
clinical validity, safety, or that a named human clinician reviewed anything — see
`schemas/review-record.schema.json`'s own top-level description for that standing caveat.

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
| Error taxonomy | `lib/errors.mjs` | `CliError` base + `EXIT_OK`/`EXIT_USAGE` + `NotImplementedError` | **P2-T1** | — |
| **Store** | `lib/store.mjs` | OQ-2 path layout (`modules/<id>/reviews/rr-<seq4>-<role>.yaml`), `review_id` <-> `{seq, role}`, read-only listing of a module's committed records, next-sequence lookup | **P2-T1** | errors, `../rf-bundle-to-kb-pack/lib/yaml-lite.mjs` |
| **Chain** | `lib/chain.mjs` | The one canonical `previousRecordHash` hashing convention (`canonicalRecordHash`/`stableStringify`) + a read-only, informational chain-linkage report `list` uses. **Fail-closed chain enforcement** (recompute + reject on break, plus the git-history mutation/deletion check) is a separate, later concern | **P2-T1 primitive; P2-T3 enforcement** | — |
| **Roster** | *(new in P2-T2)* | Resolve `reviewerId` against `governance/reviewer-roster.yaml`; enforce reviewer-2 structural independence (FR-4) | **P2-T2** | store |
| **Adjudication** | *(new in P2-T4)* | Authorship-union computation (PRD OQ-5) + adjudicator-not-in-authorship-union enforcement | **P2-T4** | store, chain |
| **Signature** | *(new in P2-T5)* | Ed25519 sign/verify over canonicalized record bytes minus `signature` (`node:crypto` only, `TESTKEY-` dry-run only) | **P2-T5** | chain |
| **Render** | *(new in P2-T6)* | Read-only static HTML render to `build/review-render/` | **P2-T6** | store, chain |
| Verb handler | `lib/verbs/scaffold.mjs` | `scaffold` verb | stub P2-T1, real **P2-T2** | store, roster |
| Verb handler | `lib/verbs/validate.mjs` | `validate` verb | stub P2-T1, real **P2-T3/T4/T5** (added incrementally) | store, chain, roster, adjudication, signature |
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

## Directory layout

```
tools/review-record/
  cli.mjs                   verb dispatch, --help, top-level exit-code handling (P2-T1)
  README.md                  this file
  lib/
    errors.mjs                 CliError taxonomy (P2-T1)
    store.mjs                   OQ-2 store layout: paths, review_id parsing, listing (P2-T1)
    chain.mjs                    canonical hashing + informational linkage report (P2-T1 primitive)
    wave0-migration.mjs           wave0 -> canonical migration helper (P1-T3, unrelated to CLI dispatch)
    verbs/
      list.mjs                     `list` verb — real (P2-T1)
      scaffold.mjs                  `scaffold` verb — stub (real: P2-T2)
      validate.mjs                   `validate` verb — stub (real: P2-T3/T4/T5, incremental)
      render.mjs                      `render` verb — stub (real: P2-T6)
      dry-run.mjs                      `dry-run` verb — stub (real: P2-T8)
```

`build/review-render/` (P2-T6's eventual render output root) is git-ignored (`.gitignore`) —
nothing under it is ever committed. Golden/fixture output lives under
`tests/fixtures/ef-review-render/` instead (OQ-3).
