# `review-record`

Offline, deterministic CLI for the **ADR-0004 five-role review-record workflow** — Evidence Foundry
E1's review-workflow machinery. Design/scaffold task **P2-T1** (OQ-1/OQ-2/FR-1/FR-7). Plan:
`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md` and its
`evidence-foundry-e1-v1/phase-2-4-workstreams.md` phase file (row `P2-T1`).

**Status (as of P2-T8)**: `list` (P2-T1), `scaffold`/`validate` (P2-T2 first increment, extended
P2-T3/T4/T5), `render` (P2-T6), and `dry-run` (P2-T8) are all real — every verb this tool's `--help`
lists is now implemented. `validate` covers per-record schema shape, D-4 roster resolution, the FR-4
reviewer-2 textual-independence heuristic (P2-T2), the FR-9/OQ-2 two-layer append-only enforcement
(P2-T3, see "Append-only enforcement" below), PRD OQ-5's authorship-union computation + FR-5
(adjudicator/release-authorizer not-in-authorship-union) + FR-6 (release-authorization chain
validity) checks (P2-T4, see "Adjudication + release-authorization" below), and FR-10/OQ-2 Ed25519
signature verification, TESTKEY- dry-run only, fail-closed on tamper (P2-T5, see "Signature binding"
below). `render` (P2-T6, see "Read-only static render" below) emits a self-contained, read-only
static HTML render of a module's committed review chain — explicitly NOT a portal. `dry-run` (P2-T8,
see "Five-role synthetic dry-run" below) composes `scaffold`'s draft-building, `signRecordDryRun`'s
TESTKEY- signing, and `validate`'s chain-validation into one end-to-end pass over all five ADR-0004
roles — the only code path in this tool that ever writes a `synthetic: true` record to disk. Nothing
in this tool signs, releases, or clinically approves anything; nothing in this tool clears, advances,
or partially satisfies any of the G0–G4 human gates (`docs/governance/gates-registry.md`). Structural
validity proven by any verb here never implies clinical validity, safety, or that a named human
clinician reviewed anything — see `schemas/review-record.schema.json`'s own top-level description
for that standing caveat.

### Five-role synthetic dry-run (P2-T8, FR-11, ruling R4)

`dry-run [--module <id>] [--subject <content-hash>] [--reviewed-at <iso>] [--root <dir>]` executes
ONE full end-to-end pass of the ADR-0004 five-role workflow — scaffold → sign (TESTKEY-, P2-T5) →
chain-validate, in role order (`clinical-1`, `clinical-2`, `lab`, `adjudication`, `release-auth`) —
over a single `subjectContentHash` shared by all five records. `--module` defaults to `cbc_suite_v1`
(this task's binding scope); `--subject` defaults to a REAL SHA-256 computed over the target module's
own committed content (`lib/subject.mjs`'s `computeModuleContentHash` — every file under
`modules/<id>/` except `reviews/` itself, relative path + content, sorted, deterministic) rather than
an invented value. Every persona `dry-run` resolves (`lib/verbs/dry-run.mjs`'s `DRY_RUN_PERSONAS`) is
a clearly-labeled, `synthetic: true`, NON-CREDENTIALED entry added to
`governance/reviewer-roster.yaml` by this same task — the roster's first content, still zero
`synthetic: false` entries (FR-3 unchanged).

**Append-only, one-time act**: `dry-run` refuses (fails closed) to run over a module that already has
any committed review record — it is never a re-run, and never overwrites or supersedes existing
history.

**Expected structural terminal state (FR-6)**: after the fifth (`release-auth`) write, the module-wide
`validate` pass this verb runs after every step ALWAYS finds exactly one violation —
"release-authorization is not valid ... synthetic:true ... (FR-6, D-4)" — because this entire
five-record set is `synthetic: true`, and `evaluateReleaseAuthorization` (P2-T4) requires a
non-synthetic set. `dry-run` recognizes this ONE specific, narrowly-matched violation shape
(`isExpectedTerminalNonQualifyingViolations`) as the correct, by-design end state, not a failure —
any OTHER violation, at any step, still propagates and fails `dry-run` closed. This dry-run populates
zero `approvedBy[]`/`clinicalApprovers[]` fields anywhere, on any artifact (schema-forced, P1-T5/T7).

The committed output of this task's own real invocation lives at `modules/cbc_suite_v1/reviews/`
(five files, `rr-0001-clinical-1.yaml` .. `rr-0005-release-auth.yaml`), with a pinned golden copy at
`tests/fixtures/ef-review-dryrun/golden/modules/cbc_suite_v1/reviews/` guarding against accidental
future modification of that committed, immutable history. The first friction-observations note this
dry-run feeds into PRD OQ-8's (human-owned) portal-trigger decision lives at
`.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md`.

### Read-only static render (P2-T6, FR-8/FR-31/OQ-3)

`render --module <id> [--record <review_id>] [--root <dir>] [--out <dir>]` reads a module's
already-committed review-record chain (`lib/store.mjs`) plus, when present, its
`traceability-index.json` (rule -> passage -> test chain) and `evidence-assertions.json` (passage
text/rights posture) and writes ONE self-contained `<!doctype html>` file to
`<out>/<module_id>/{index,<review_id>}.html` — `--out` defaults to `<cwd>/build/review-render/`
(OQ-3, git-ignored); `--root` only ever names where the SOURCE artifacts live, so a render over a
fixture tree can never collide with a real `build/review-render/` output. Explicitly **not a
portal**: no server, no database, no write path back into `modules/`, no auth, no `<script>` tag
anywhere in the output, and no `<a href>` at all (so no third-party/remote asset or URL can ever
appear). Every page carries `lib/render.mjs`'s `UNVALIDATED_PROTOTYPE_BANNER` — the exact string
`tools/retro-validate/lib/metrics.mjs` (P4-T4) already uses for its own report header, reused
verbatim rather than re-authored — in both a header and a footer, and every `synthetic: true`
record's card carries a `NON_QUALIFYING_RECORD_LABEL`.

**Rights posture (FR-31, ADR-0002, E0 OQ-2 precedent)**: a passage renders as inline text ONLY when
its resolved `evidence-assertions.json` assertion carries `displayPolicy: "public_short_excerpt"`
AND a non-empty `exactPassage`. Every other case — `hash_and_selector_only`,
`clinician_authenticated_short_excerpt` (this static output has no auth layer to gate that audience
either), or an assertionId `traceability-index.json` references but `evidence-assertions.json` does
not carry — renders as a hash + selector reference block (`passageId`/`exactPassageSha256` +
`locator.raw`) instead, never the passage text. Ambiguous or missing data defaults to the MORE
restrictive rendering, matching this program's "missingness is never treated as normal" guardrail.

`lib/render.mjs` is pure (never touches the filesystem) and deterministic — no wall-clock timestamp
or non-reproducible value appears anywhere in its output, so re-rendering identical committed
artifacts twice produces byte-identical bytes. `lib/verbs/render.mjs` is the only writer, and the
only thing in this tool that ever writes under `build/`.

### Signature binding (P2-T5, FR-10/OQ-2/OQ-6)

`lib/signature.mjs` implements the ONE `signature` mechanism `schemas/review-record.schema.json`
already names: a detached Ed25519 signature (`node:crypto` only, zero new dependencies) over the
"canonicalized record bytes minus the signature object" (`lib/chain.mjs`'s `stableStringify` applied
to the record with `signature` omitted) — binding `reviewerId` to `subjectContentHash` (and every
other field) by construction, since mutating any field other than `signature` itself invalidates it.

E1 signing exists **only** in synthetic dry-run mode (OQ-6, decisions block Risk 1, FR-15 "no
agent/CI keys ever"): `signRecordDryRun(record)` generates a fresh Ed25519 keypair in memory on
every call (`node:crypto#generateKeyPairSync`), never reads a key from a file or a CLI flag (there
is **no** `--test-keys` flag anywhere in this tool), and never writes either half of the keypair to
disk — the private key lives only in that function's own stack frame and is discarded the instant
the call returns. It fails closed (`UsageError`) unless `record.synthetic === true` and
`record.signature` is not already populated — **"writable only onto synthetic:true records" is
enforced structurally, at the point of signing**, not left to a caller's discipline. The resulting
`signature.keyId` always carries the structural `TESTKEY-` prefix.

**Self-certifying `keyId`, and why**: `schemas/review-record.schema.json`'s `signature` object has
exactly three fields (`algorithm`, `keyId`, `value`, `additionalProperties: false`) — there is no
fourth slot for a public key, and OQ-6 explicitly rules out any persistent test-key registry. So
`signRecordDryRun` encodes the ephemeral public key's raw Ed25519 x-coordinate (the same 32 raw
bytes a JWK `x` field carries, base64url-encoded) directly into `keyId`, right after the `TESTKEY-`
prefix: `TESTKEY-<43-char base64url x-coordinate>`. This makes the committed record file itself
self-sufficient for verification — a later, wholly separate `validate` invocation (a different
process, no shared memory, no key it "kept") recovers the public key straight from `keyId` and
cryptographically checks `value` against a fresh recomputation of the signing preimage. The public
half of an Ed25519 keypair is non-secret by definition, so folding it into the identity label that
already exists loses nothing a dedicated field would have provided.

`validate` calls `verifyRecordSignature(record)` for every record it examines (respects `--record`
narrowing — a signature is a fact about one record, unlike the module-wide chain/independence/
authorship checks) and fails closed with a `signature:`-prefixed violation on: a `synthetic: true`
record with no signature; a populated signature on a `synthetic: false` record (never legitimate
pre-G1/G2, checked independently of the schema's own equivalent `allOf` branch); a malformed shape
(wrong algorithm, missing `TESTKEY-` prefix, empty `value`); an unparseable embedded public key; or —
the tamper case — a signature that fails cryptographic verification against the record's own
canonicalized bytes. A `synthetic: false` record's forced-null signature slot verifies trivially
(nothing to check, by design).

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

**The (1) STRUCTURAL guarantee is scoped to the scaffold path only, not to this tool as a whole.**
`nextChainLink` is deliberately narrow: it derives `seq` from `reviews/` directory FILENAMES alone
(never file content), and it opens and hashes exactly ONE file — the single highest-numbered
(immediate predecessor) record — never "every prior record" in the module. A module with several
existing records never has records 1..N-1 read at all when record N+1 is scaffolded; only record
N's bytes are ever touched, and even then only its canonical hash — never its parsed
`decision`/`rationale`/`reviewerId` — leaves `lib/chain.mjs`. `validate` and `list`, by contrast,
legitimately parse EVERY committed record in a module (`lib/store.mjs`'s `listModuleReviewRecords`
feeding `checkModuleChainLinkage`) — a validator's whole job is to read everything and check it, and
`list`'s per-module summary is likewise allowed full read access. Do not read that full-read
posture as extending to `nextChainLink`, and do not refactor `nextChainLink` to route through
`listModuleReviewRecords` (or any other full-module read) — doing so reintroduces a real gap a
second-opinion review caught once already: the original P2-T2 implementation's independence claim
was CONTRACTUAL ("the return value is narrow") rather than STRUCTURAL, because the full parsed array
of every sibling record — decision/rationale included — existed in memory on the call stack en
route to that narrow return, even though nothing in `scaffold` ever read past it.
`tests/ef-review-workflow.test.mjs` proves the current, hardened behavior with a fixture module
(`chain_isolation_v1`) carrying a deliberately unparseable non-immediate-predecessor sibling record:
`scaffold --role clinical-2` over that module still succeeds, because that sibling is never opened.

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

# Real modules — cbc_suite_v1 now carries the P2-T8 five-role synthetic dry-run set:
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
| **Chain** | `lib/chain.mjs` | The one canonical `previousRecordHash` hashing convention (`canonicalRecordHash`/`stableStringify`) + a read-only, informational chain-linkage report `list`/`validate` use (both legitimately full-read, via `store.mjs`'s `listModuleReviewRecords`); (P2-T2, P2-fix hardened) `nextChainLink` — the one channel `scaffold` uses to link a new draft into a module's chain, deriving `seq` from filenames alone and hashing ONLY the single immediate-predecessor file's bytes, structurally never touching any other sibling record's content (the FR-4 structural-independence mechanism — see this README's "reviewer-2 independence" section for the scoping distinction). `checkModuleChainLinkage`'s report is ALSO (P2-T3) `validate`'s fail-closed chain-enforcement input — one implementation, two consumers (informational `list`, fail-closed `validate`) | **P2-T1 primitive; P2-T2 `nextChainLink`; P2-T3 consumed as enforcement input by `validate`; P2-fix hardened `nextChainLink` to single-file touch** | store |
| **History** | `lib/history.mjs` | Layer (b) of FR-9/OQ-2 append-only enforcement — `checkAppendOnlyHistory` runs a local, offline `git log --name-status` scoped to a module's `reviews/` path and reports (structured, deterministic) whether any record path was ever touched by more than one commit. Opt-in (`validate --history`), fail-closed on a genuine tool-usage failure (not a git repo), never throws for a detected mutation itself (that is `validate`'s call) | **P2-T3** | errors |
| **Roster** | `lib/roster.mjs` | Resolve `reviewerId` against `governance/reviewer-roster.yaml` (unknown identity / out-of-scope module both fail closed, FR-3) | **P2-T2** | errors, `../rf-bundle-to-kb-pack/lib/yaml-lite.mjs` |
| **Independence** | `lib/independence.mjs` | Supplementary, heuristic FR-4 reviewer-2-independence check (`checkReviewerIndependence`) — verbatim textual overlap / direct sibling-identity reference between a module's `clinical-1`/`clinical-2` records. NOT the primary enforcement (see Roster/Chain above and this file's own header) | **P2-T2** | — |
| **Adjudication** | `lib/adjudication.mjs` | `computeAuthorshipUnion` (PRD OQ-5, git-history-derived — see "Adjudication + release-authorization" above) + `rosterEntryInAuthorshipUnion` (FR-5) + `evaluateReleaseAuthorization` (FR-6) | **P2-T4** | store, chain |
| **Signature** | `lib/signature.mjs` | `signRecordDryRun` (ephemeral in-memory Ed25519 keypair, `TESTKEY-` self-certifying `keyId`, writable only onto `synthetic:true` records) + `verifyRecordSignature` (fail-closed verification, tamper detection) — see "Signature binding" above | **P2-T5** | chain |
| **Render** | `lib/render.mjs` | Loads a module's committed review chain + (existence-gated) `traceability-index.json`/`evidence-assertions.json` and builds ONE self-contained, deterministic HTML string (`renderModuleHtml`) — see "Read-only static render" above | **P2-T6** | store, chain |
| **Subject** | `lib/subject.mjs` | `computeModuleContentHash` — real SHA-256 over a module's own committed content (excludes `reviews/`), sorted relative-path + bytes, mirroring `tools/release-sign/lib/pack-digest.mjs`'s convention without importing that sibling tool — `dry-run`'s default `subjectContentHash` source | **P2-T8** | errors |
| Verb handler | `lib/verbs/scaffold.mjs` | `scaffold` verb — builds + (signature-gated) writes a draft; see this file's "Status" section above | stub P2-T1, real **P2-T2** | store, chain, roster |
| Verb handler | `lib/verbs/validate.mjs` | `validate` verb — schema shape + roster resolution + independence heuristic (P2-T2); FR-9/OQ-2 two-layer append-only enforcement, chain (always) + `--history` git-history check (P2-T3); PRD OQ-5 authorship-union / FR-5 adjudicator-authorship + FR-6 release-authorization validity (P2-T4); FR-10/OQ-2 Ed25519 signature verification (P2-T5) | stub P2-T1, first increment **P2-T2**, extended **P2-T3/T4/T5** | store, roster, independence, chain, history, adjudication, signature, `../../../scripts/lib/json-schema-lite.mjs` |
| Verb handler | `lib/verbs/list.mjs` | `list` verb — per-module review-record state summary | **P2-T1** (real) | store, chain |
| Verb handler | `lib/verbs/render.mjs` | `render` verb — writes `lib/render.mjs`'s output to `<out>/<module_id>/{index,<review_id>}.html`, the only writer under `build/` | stub P2-T1, real **P2-T6** | render |
| Verb handler | `lib/verbs/dry-run.mjs` | `dry-run` verb — composes scaffold's draft-building + signature's TESTKEY- signing + validate's chain-validation into one five-role end-to-end pass; see "Five-role synthetic dry-run" above | stub P2-T1, real **P2-T8** | store, chain, roster, scaffold, signature, subject, validate |

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
    signature.mjs                   FR-10/OQ-2 Ed25519 signature binding: signRecordDryRun + verifyRecordSignature (P2-T5)
    render.mjs                      FR-8/FR-31/OQ-3 read-only static-HTML render core: renderModuleHtml (P2-T6)
    roster.mjs                    reviewerId resolution against governance/reviewer-roster.yaml (P2-T2)
    independence.mjs               heuristic FR-4 reviewer-2-independence check (P2-T2)
    subject.mjs                     computeModuleContentHash — real subjectContentHash source for dry-run (P2-T8)
    wave0-migration.mjs             wave0 -> canonical migration helper (P1-T3, unrelated to CLI dispatch)
    verbs/
      list.mjs                       `list` verb — real (P2-T1)
      scaffold.mjs                    `scaffold` verb — real (P2-T2)
      validate.mjs                     `validate` verb — first increment real (P2-T2); FR-9/OQ-2 append-only enforcement (P2-T3); PRD OQ-5/FR-5/FR-6 adjudication + release-authorization (P2-T4); FR-10/OQ-2 Ed25519 signature verification (P2-T5)
      render.mjs                        `render` verb — real (P2-T6)
      dry-run.mjs                        `dry-run` verb — real (P2-T8): five-role scaffold -> sign -> chain-validate composition
```

`modules/cbc_suite_v1/reviews/` (five files, `rr-0001-clinical-1.yaml` .. `rr-0005-release-auth.yaml`)
is this task's (P2-T8) own real, committed dry-run output — see "Five-role synthetic dry-run" above.
A pinned golden copy lives at `tests/fixtures/ef-review-dryrun/golden/modules/cbc_suite_v1/reviews/`.

`build/review-render/` (P2-T6's render output root, `--out` default) is git-ignored (`.gitignore`) —
nothing under it is ever committed. One golden render lives under `tests/fixtures/ef-review-render/`
instead (OQ-3): `input/` is a hand-authored, non-real fixture module (`render_fixture_v1`, five
synthetic review records + a two-passage traceability chain, one rights-restricted and one
inline-eligible) and `golden/` holds the exact HTML `render` produces over it — regenerate with
`node tools/review-record/cli.mjs render --module render_fixture_v1 --root
tests/fixtures/ef-review-render/input --out <scratch-dir>` and diff, never hand-edit the golden file.
