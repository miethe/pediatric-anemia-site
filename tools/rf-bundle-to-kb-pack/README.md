# `rf-bundle-to-kb-pack`

Deterministic, offline converter from a **verified** Research Foundry (`rf`) evidence bundle to a
staged CDS knowledge-base ("kb-pack") authoring proposal. This is **EF-WP0** — the central build
of the Evidence Foundry buildout's Phase 2 ("Converter Core"). Design spec:
`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` (the "02 doc"), §4.
Task table: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-1-2-foundation-converter.md`
(row `P2-T1`).

**Status (as of P3-T7)**: `inspect` (P2-T6), `verify` (P2-T7), and `propose` (P3-T7) are all real.
`propose` assembles the full staged `02 §4.4` pack by wiring together the hand-authored P3-T1..T6
drafting content behind the same loader → hashing → eligibility pipeline `inspect`/`verify` use,
plus the seam-invariant-8 conflict-visibility guard (`lib/verbs/propose.mjs`). Nothing in this tool
is signed, released, or clinically approved — its only output authority is a *proposal* (02 §4.1,
"Release authority: None").

## Why this tool is not `rf`

Per 02 §4.2: the converter knows the pediatric clinical DSL, the typed fact registry, the output
vocabulary, `schemas/rule.schema.json`, and the current rule engine's actual limitations — none of
which belong in a general research control plane. It lives in **this** repository
(`tools/rf-bundle-to-kb-pack/`), reads a read-only `rf` run directory, and never writes back to it.

## CLI usage

```bash
node tools/rf-bundle-to-kb-pack/cli.mjs --help

node tools/rf-bundle-to-kb-pack/cli.mjs inspect \
  --run-dir tests/fixtures/rf-cbc-001 \
  --module modules/cbc_suite_v1/module.json

node tools/rf-bundle-to-kb-pack/cli.mjs verify \
  --pack build/kb-pack/cbc_suite_v1/0.1.0-proposal \
  --rule-schema schemas/rule.schema.json

node tools/rf-bundle-to-kb-pack/cli.mjs propose \
  --run-dir tests/fixtures/rf-cbc-001 \
  --module modules/cbc_suite_v1/module.json \
  --decisions modules/cbc_suite_v1/authoring-decisions.yaml \
  --out build/kb-pack/cbc_suite_v1/0.1.0-proposal
# -> exit 0; writes pack-provenance.json, evidence.json, evidence-assertions.json, candidates.json,
#    rule-proposals.json, rules.json, rule-provenance.json to --out (P3-T7).
```

Note the `--module` path is `module.json`, not the 02 doc's `module.yaml` — the 02 doc predates
this repo's module-package refactor; see
`.claude/worknotes/evidence-foundry-buildout/path-mapping.md` (P1-T1) for the full stale-path
reconciliation. This scaffold, and every task built against it, cites current-tree paths only.

## Module boundary

Five internal boundaries, one file (or small directory) each, matching the phase task table's
`(seam task owner, FR-6, 02 §4.1, 02 §4.5)` description:

| Module | File | Responsibility | Owning task | Depends on |
|---|---|---|---|---|
| CLI dispatch | `cli.mjs` | Arg parsing, `--help`, verb routing, top-level exit-code forwarding | P2-T1 (this task) | — |
| Error taxonomy | `lib/errors.mjs` | The 8 `rf` exit-code constants + one `ConverterError` subclass per code | P2-T1 scaffold, hardened by **P2-T5** | — |
| Loader | `lib/loader.mjs` | Read-only bundle + artifact resolution off `evidence_bundle.yaml.artifacts` | **P2-T2** | errors |
| Hashing | `lib/hashing.mjs` | SHA-256 "Pin" phase over loader output | **P2-T3** | loader, errors |
| Eligibility | `lib/eligibility.mjs` | Status reconciliation + per-claim eligibility (02 §3.7 field table) | **P2-T4** | hashing, errors |
| Verb handler | `lib/verbs/inspect.mjs` | Runs loader → hashing → eligibility, prints summary, emits no pack output | **P2-T6** | loader, hashing, eligibility, errors |
| Verb handler | `lib/verbs/verify.mjs` | Structural pre-check (Phase 2: input-side only; P5-T1 completes the pack-output path) | **P2-T7** | inspect (per task table), errors |
| Verb handler | `lib/verbs/propose.mjs` | Assembles the full staged pack (pack-provenance.json + evidence/evidence-assertions copies + P3-T5/T6 drafting output) behind loader → hashing → eligibility → claim-routing, plus the seam-invariant-8 conflict-visibility guard | **P3-T7** | loader, hashing, eligibility, claim-routing, rule-candidate-drafts, govern-staged-rules, errors |

**Verb-handler contract**: every file under `lib/verbs/` exports `async function run(options)`
that either resolves to a numeric process exit code (see `EXIT_*` in `lib/errors.mjs`) or throws a
`ConverterError` (or subclass). `cli.mjs` forwards a thrown `ConverterError`'s `exitCode` verbatim
— it never remaps it. A non-`ConverterError` throw (a genuine bug) falls back to `EXIT_USAGE` (1)
since none of the 8 taxonomy states is a natural fit for an unclassified crash.

**Data flow for `inspect`/`verify`/`propose`** (02 §4.6 phases 1-4 for all three; `propose` continues
into phases 4-9 via `claim-routing.mjs`'s `routeClaims` + the P3-T5/P3-T6 drafting modules):

```
loader.loadBundle()  ->  hashing.pinArtifacts()  ->  eligibility.checkEligibility()  ->  verb prints summary / exits
     (P2-T2)                  (P2-T3)                       (P2-T4)                          (P2-T6 / P2-T7 / P3-T7)
```

Each arrow is a plain function call passing the prior stage's return value forward — no shared
mutable state, no writes to `runDir` at any stage (seam invariant 6).

## Error taxonomy (`lib/errors.mjs`)

| Exit | Class | `rf` state | Never do |
|---:|---|---|---|
| 0 | *(n/a — success return)* | `evidence_verified` | — |
| 1 | `UsageError` | `pipeline_error` | Retry blindly |
| 2 | `SchemaError` | `evidence_schema_failed` | Proceed past a schema failure |
| 3 | `GovernanceError` | `governance_review_required` | **Override in the converter, ever** |
| 4 | `UnsupportedError` | `unsupported_claims` | Treat as ordinary/soft failure for material clinical content |
| 5 | `BudgetError` | `research_budget_paused` | Continue without evidence-lead approval |
| 6 | `AdapterError` | `discovery_adapter_failed` | Silently drop partial evidence |
| 7 | `HumanReviewError` | `human_review_pending` | **Treat as a technical failure** |

`NotImplementedError` (a `UsageError` subclass) is this phase's scaffold-only marker for a module
boundary defined but not yet built; it is not part of the permanent taxonomy and should disappear
from each file as P2-T2..T7 (and Phase 3's `propose`) land real logic.

## Design decisions

### No `yaml`/JSON-Schema npm dependency (deviates from 02 §4.1's literal wording)

02 §4.1's "Runtime" row says: *"Node.js ESM, matching the current project; use a pinned YAML
parser and JSON Schema validator."* That line predates two now-merged, already-established
precedents in this exact repository:

- `scripts/lib/json-schema-lite.mjs` — a dependency-free JSON Schema (2020-12 subset) validator,
  whose own header explains: *"The project ships with zero runtime dependencies (package.json has
  no `dependencies` block and there is no `node_modules` tree)... Ajv is not available and adding
  it would change the repo's supply-chain posture for the sake of two schema files."*
- `scripts/evidence/vendor-rf-bundle.mjs` — hand-rolls a small YAML-subset parser for `rf` source
  cards' frontmatter shape, with the same rationale: *"Adding a `yaml` dependency to a
  zero-dependency repo... would change the supply-chain posture for no gain the pinned schema does
  not already give us; the parser fails closed on any construct it does not recognize."*

Both predate this plan (commit `28c1487`, already merged) and were not authored by this feature —
they are the repo's settled architectural posture, exactly the kind of thing the parent plan's
"Stale-Path Hazard" (decisions block §2) already teaches this feature to defer to over the 02
doc's literal pre-refactor text. This is not a reopening of OQ-1..OQ-7 (none of them address
dependency policy); it is this task's own design-authority call, made explicit here per P2-T1's
own instruction to "define the internal module boundary... and document it."

**Ruling for P2-T2 (loader) and any schema-validating task in this phase or Phase 3**: hand-roll (or
extend a shared, hand-rolled) YAML-subset parser matching the `rf` bundle YAML shapes actually seen
in `tests/fixtures/rf-cbc-001/`, and reuse (or extend) `scripts/lib/json-schema-lite.mjs` rather
than adding `yaml`/`ajv`/any other npm package. Both parsers must keep the same fail-closed
posture: an unrecognized construct/keyword raises rather than being silently skipped. If a future
task finds the `rf` bundle YAML uses a construct outside what a hand-rolled parser can support
safely, escalate (new finding) rather than quietly adding a dependency.

This keeps `tools/rf-bundle-to-kb-pack/` inside the same zero-runtime-dependency, offline,
deterministic posture 02 §4.1 wants in substance ("no network, no LLM," reproducible output) even
though its literal "pinned...deps" phrasing is stale.

### Zero network / zero LLM, structurally

No file in this tool imports `node:http`, `node:https`, `node:dgram`, `fetch`, or any AI/model SDK.
P2-T8's seam-invariant suite is the executable proof of this (invariants 13-15 plus the
"zero-network/zero-LLM assertion... across `inspect`, `verify`, and the P3 `propose` stub"); this
scaffold keeps the import surface minimal on purpose so that assertion stays easy to write and hard
to accidentally violate later.

## Seam invariants (02 §2.3) — where each one is enforced

| # | Invariant | Enforced by |
|---:|---|---|
| 1 | Accepts only a `verified`-status bundle | `eligibility.mjs` (P2-T4) |
| 2 | Reads YAML from disk, never human-formatted CLI tables | `loader.mjs` (P2-T2) |
| 3 | Records the `rf` process exit code + `verification.yaml.exit_code` | `eligibility.mjs` (P2-T4) |
| 4 | Rejects process/artifact status disagreement | `eligibility.mjs` (P2-T4) |
| 5 | Pins `run_id`, bundle ID, bundle/ledger/source hashes | `hashing.mjs` (P2-T3) |
| 6 | Never mutates `runs/<run_id>/` | `loader.mjs` (P2-T2) — read-only by construction |
| 7 | `supported` claims admitted as fact candidates only when source + exact passage resolve | `eligibility.mjs` (P2-T4) |
| 8 | `mixed`/`contradicted` claims -> conflict-visible objects only, never one-sided rules | `eligibility.mjs` (P2-T4) categorization; `claim-routing.mjs` (P3-T4) `basis.kind` routing; `propose.mjs`'s `assertNoSoleConflictedBasis` (P3-T7) fail-closed guard |
| 9 | `inference` claims admitted only as implementation-proposal inputs with `inference_basis.from_claims` | `eligibility.mjs` (P2-T4), `claim-routing.mjs` (P3-T4) |
| 10 | `speculation`/`unsupported` claims rejected from clinical rule evidence | `eligibility.mjs` (P2-T4), `claim-routing.mjs` (P3-T4) |
| 11 | No confidence-to-probability translation | `eligibility.mjs` (P2-T4) / drafting logic (Phase 3) — asserted directly by P2-T8 |
| 12 | Absence of an extracted claim is never treated as evidence of normality/safety | `eligibility.mjs` (P2-T4) / drafting logic (Phase 3) — asserted directly by P2-T8 |
| 13 | Deterministic: identical bytes + converter version -> identical normalized output bytes | Whole pipeline; proven by P2-T8 and Phase 5's double-run gate |
| 14 | Converter output is a proposal, never a released KB | `lib/errors.mjs`'s "Release authority: None" framing; `propose`'s `build/kb-pack/` staging path |
| 15 | Clinical reviewers approve executable interpretations, not merely citations | Out of this converter's scope by design — enforced by the governance process this tool feeds, not by code |

`tests/ef-converter-invariants.test.mjs` (P2-T8) is the executable cross-check that all 15 rows
above actually hold, one named test per invariant.

## Directory layout

```
tools/rf-bundle-to-kb-pack/
  cli.mjs                 verb dispatch, --help, top-level exit-code handling
  README.md                this file
  lib/
    errors.mjs              exit-code taxonomy (P2-T1 scaffold / P2-T5 hardening)
    loader.mjs               bundle loader (P2-T2)
    hashing.mjs               hash pinning (P2-T3)
    eligibility.mjs            eligibility + status reconciliation (P2-T4)
    verbs/
      inspect.mjs              `inspect` verb (P2-T6)
      verify.mjs                `verify` verb (P2-T7)
      propose.mjs                `propose` verb (P3-T7)
```

`build/kb-pack/` (this tool's eventual output root) is git-ignored (`.gitignore`, P1-T7) — nothing
under it is ever committed. Golden/fixture outputs for converter tests live under `tests/fixtures/`
instead (OQ-6).
