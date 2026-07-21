---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry: Property/Mutation/Semantic-Diff CI Expansion (DF-E1-07)"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-21
feature_slug: evidence-foundry-buildout
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
problem_statement: "E0 ships a fixed 15-invariant seam test suite and a deliberately minimal,
  rule-id-level semantic diff for the rf-bundle-to-kb-pack converter; before a rule-schema v2
  migration begins, this converter-facing test/diff surface needs deliberate hardening (property-
  based testing, mutation testing, and richer semantic-diff classification) rather than growing ad
  hoc as new converter features land."
open_questions: []
explored_alternatives: []
---

# Property/Mutation/Semantic-Diff CI Expansion (DF-E1-07)

## Problem / Context

The Deferred Items Triage Table in
`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`
("Decisions & OQ Resolutions" → "Deferred Items & In-Flight Findings Policy") categorizes this item
as **tech-debt**: "Property/mutation/semantic-diff CI expansion hardens what E0 ships as a minimal
id-level diff (OQ-4) and 15-invariant test set; expansion is follow-on hardening, not new
capability." Its promotion trigger is **"E1 rule-schema v2 migration begins"** — i.e., this spec is
explicitly not asking to be built now, and ADR-0001 (`docs/adr/0001-canonical-authoring-model-rule-
schema-v2.md`, `status: proposed`, §"Unblocks") names this exact item as the reason a stable-schema
target matters before this hardening work is designed in earnest.

This document exists to do one thing precisely, per this item's own Phase 7 task instruction
(`P7-T9`): **scope "expansion" against what E0 already shipped**, so a future reader does not
re-propose work E0 already delivered under a different name. The rest of this document is written
against the actual committed state of this worktree, not the plan's description of it.

## Current State — What E0 Already Ships (do not re-propose this)

### 1. The 15 seam-invariant test suite (P2-T8)

`tests/ef-converter-invariants.test.mjs` provides ≥1 named, passing test for every one of the 15
seam invariants enumerated in `docs/project_plans/expansion/02-evidence-foundry-on-research-
foundry.md` §2.3, cross-checked by a test-name-to-invariant-number table in the file's own header
comment. Invariants 1–6 and 13–15 are additionally covered by dedicated per-module test files
(`tests/ef-converter-loader.test.mjs`, `tests/ef-converter-hashing.test.mjs`,
`tests/ef-converter-determinism.test.mjs`, `tests/ef-converter-verify.test.mjs`, etc.); invariants
7–12 (claim-eligibility routing, no confidence-to-probability translation, no absence-as-normal
inference) are this file's own dedicated coverage. The suite additionally asserts zero network calls
and zero LLM/generative-model calls occur across `inspect`, `verify`, and `propose`. **This is
already a complete, closed 15/15 invariant suite** — DF-E1-07 is not "finish the invariant suite."

### 2. The minimal, rule-id-level semantic diff (P5-T3, OQ-4)

`tools/rf-bundle-to-kb-pack/lib/semantic-diff.mjs` implements exactly the comparison OQ-4 (binding,
parent plan "Decisions & OQ Resolutions") scopes E0 to: rule-`id`-level `added`/`removed`/`changed`
detection between the staged `cbc_suite_v1` proposal and `modules/anemia/rules.json`, with no
impact-graph traversal. Its own header comment is explicit that this is deliberate, not an
oversight: *"That richer, taxonomy-based classification (Families A–H, safety tiers, combinator-
skeleton comparison, etc.) already exists, for the SAME-module drift-over-time use case, at
`scripts/kb-diff.mjs` (wave0-safety-foundation, EP5-T3) — deliberately NOT reused or extended
here."* `tests/ef-converter-semantic-diff.test.mjs` proves the E0 acceptance criterion: 4 `added`,
0 `removed`, 0 `changed` against `modules/anemia/rules.json`, byte-identical across two runs.

**Critically, a separate and already much richer semantic-diff classifier exists in this same
repository, from a different plan** — `scripts/kb-diff.mjs` (wave0-safety-foundation, Phase EP-5),
normed against `docs/project_plans/SPIKEs/spike-005-semantic-diff-classification.md`'s amended
design. It performs combinator-skeleton-before-leaf comparison, negation-parity tracking, fail-
closed unknown-class handling, and is validated against a table of 83 seeded mutations (`M01`–`M83`,
73 individually simulated + 10 confirmed out-of-scope) in `tests/kb-diff.test.mjs`. **This is real,
already-shipped mutation-style testing infrastructure in this codebase — DF-E1-07 must not
re-propose building "a mutation-testing corpus for KB diffs" from scratch; it exists, for the
`modules/anemia/rules.json` same-module-generations use case.** What E0's converter-facing
`semantic-diff.json` lacks, by design, is any of that richness, because E0's diff target
(`cbc_suite_v1` vs. `anemia`) is a disjoint-namespace, purely-additive comparison where richness
would be trivially unexercised (see `semantic-diff.mjs`'s own comment on why `removed` is gated on
`baseModuleId === headModuleId`).

### 3. The determinism double-run proof (P5-T5, invariant 13)

`tests/ef-converter-determinism.test.mjs` and `tests/ef-converter-manifest.test.mjs` run `propose`
twice against byte-identical inputs and assert SHA-256 equality across every emitted artifact
(`pack-provenance.json`, `evidence.json`, `evidence-assertions.json`, `candidates.json`,
`rule-proposals.json`, `rules.json`, `rule-provenance.json`). This is a real, executed double-run
proof, not a documentation claim — **DF-E1-07 is not "prove the converter is deterministic."**

### 4. No CI runner exists for any of this today

`.github/workflows/` contains exactly one workflow, `deploy-pages.yml` (static-site publish). There
is **no GitHub Actions (or other CI) workflow that runs `npm test`, `npm run validate`, or any
converter test file on push/PR** anywhere in this repository. All of the above (15 invariants,
semantic-diff test, determinism proof) currently run only when a human or agent invokes `npm run
check`/`npm test` locally. "CI expansion" in this item's name is therefore not an incremental change
to an existing pipeline — there is no existing test-running pipeline to expand.

### 5. No property-based or mutation-testing library is a project dependency

`package.json` has no `dependencies`/`devDependencies` block at all (zero external packages), and
`tools/rf-bundle-to-kb-pack/` (which per `02 §4.1` was scoped for "a pinned YAML parser + JSON
Schema validator") ships neither — it has a hand-rolled `lib/yaml-lite.mjs` and no schema-validator
dependency, confirmed by `tools/rf-bundle-to-kb-pack/` containing no `package.json` of its own and
no `node_modules`-resolved import outside `node:*` built-ins. `scripts/kb-diff.mjs` states this as a
deliberate "repo constraint": *"Zero-dependency (repo constraint): only Node built-ins are imported
below."* Any property-based-testing proposal below (e.g. `fast-check`) is therefore a **new-
dependency decision**, not a drop-in addition, and must be weighed against this repo's established
zero-dependency norm.

## Design Sketch — What "Expansion" Would Actually Add (E1+, not now)

At `shaping` maturity, three genuinely additive (not duplicative) hardening directions, gated on the
ADR-0001 trigger:

1. **Extend the converter's `semantic-diff.mjs` toward `kb-diff.mjs`-style richness, once it has a
   non-trivial same-module comparison to make.** E0's diff is trivially "4 added, 0 removed, 0
   changed" because `cbc_suite_v1` is brand new (parent plan's own OQ-4 resolution language: "a
   second proposal round against an *existing* `cbc_suite_v1/rules.json` would produce a non-trivial
   result"). Once that second round exists (post rule-schema v2 stabilization per ADR-0001), the
   design question is whether the converter's diff tool grows its own classification richness, or
   whether it delegates to (or is unified with) `scripts/kb-diff.mjs` against `modules/cbc_suite_v1/
   rules.json` as base/head instead of the current cross-module `anemia` comparison. This spec does
   not pick between "extend `semantic-diff.mjs`" and "point `kb-diff.mjs` at `cbc_suite_v1`" — that
   choice depends on how far ADR-0001's provenance-sidecar tier has evolved by then, and is an open
   question below.
2. **Property-based testing for the converter's pure functions** (`computeSemanticDiff`,
   `deepEqualRule`/`stableStringify` in `semantic-diff.mjs`; the eligibility-routing predicates in
   `lib/eligibility.mjs`; the hashing/pinning functions in `lib/hashing.mjs`) — generated random
   rule-object/claim-object inputs checked against invariant properties (e.g. "diffing a rule set
   against itself always yields empty added/removed/changed"; "hashing is injective under byte-level
   change") rather than the fixed example-based fixtures P2–P5 already ship. This is additive
   coverage, not a replacement for the 15-invariant suite or the existing example-based converter
   tests.
3. **A mutation-testing corpus for the converter seam and the minimal semantic-diff**, modeled on
   `tests/kb-diff.test.mjs`'s M01–M83 pattern but scoped to the converter's own inputs (a mutated
   `evidence_bundle.yaml`/`claim_ledger.yaml`/`verification.yaml` fixture per seeded mutation,
   asserting the converter's error taxonomy or eligibility routing reacts correctly) — not a
   duplicate of the existing KB-mutation table, which already covers `modules/anemia/rules.json`-
   shape mutations and should be referenced, not reimplemented, for anything at that layer.
4. **A CI workflow** (new `.github/workflows/*.yml`) that actually runs `npm run check` (or a
   converter-scoped subset) on every PR touching `tools/rf-bundle-to-kb-pack/**`, `modules/**`, or
   `tests/ef-*`/`tests/kb-diff.test.mjs` — closing the "no test-running CI exists" gap identified
   above. This is infrastructure the repository does not have today for *any* test suite, not just
   the converter's.

## Promotion Trigger

Per the parent plan's Deferred Items Triage Table: **"E1 rule-schema v2 migration begins."**
ADR-0001 (`docs/adr/0001-canonical-authoring-model-rule-schema-v2.md`) names this item under
"Unblocks" and is itself `status: proposed` — not accepted. Nothing in this spec should be started
before ADR-0001 (or its successor) is accepted and a second module's rule authoring makes the
converter's semantic diff non-trivial; starting early risks building property/mutation coverage
against a schema surface ADR-0001's own "Considered Alternatives" §3 expects to change shape.

## Open Questions

- Does the future richer converter diff **extend `semantic-diff.mjs` in place**, or **repoint/reuse
  `scripts/kb-diff.mjs`** against `modules/cbc_suite_v1/rules.json` generations? The two already
  duplicate some logic (`stableStringify`/deep-equality helpers exist independently in both files
  today, by explicit design, per `semantic-diff.mjs`'s own header comment) — a unification decision
  belongs here, not left to whichever implementer touches it first.
- Does adopting a property-based-testing library (e.g. `fast-check`) get evaluated as a first
  external `package.json` dependency for this repo, or does the zero-dependency norm (`scripts/
  kb-diff.mjs`'s explicit "repo constraint" comment; the converter's own hand-rolled `yaml-lite.mjs`
  instead of a YAML library) extend to test tooling too, in favor of hand-rolled generator helpers
  over Node's built-in `node:test`?
- Should the new CI workflow run on every PR unconditionally, or path-filtered to converter/module/
  test changes only (mirroring the scoping used for `deploy-pages.yml`'s existing path filters, if
  any) — and does it gate merges (required check) or run advisory-only until proven stable?
- Should the mutation-testing corpus for the converter seam be a wholly separate table from
  `kb-diff.mjs`'s M01–M83, or should the two share a common seeded-mutation authoring convention
  (same table schema, different target file) so future contributors learn one pattern, not two?
- Is a "changed" classification for the converter's semantic diff (once non-trivial) expected to
  reuse `kb-diff.mjs`'s Families A–H taxonomy directly, or does the converter's proposal-vs-released
  distinction (invariant 14: "converter output is a proposal, never a released KB") require its own,
  narrower taxonomy that stops short of `kb-diff.mjs`'s release-gating safety tiers?

## References

- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md` —
  "Decisions & OQ Resolutions" (OQ-4) and "Deferred Items & In-Flight Findings Policy" (DF-E1-07 row).
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-1-2-
  foundation-converter.md` — task row `P2-T8` (15 seam-invariant test suite).
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-
  projection-slice-manifest.md` — task rows `P5-T3` (semantic-diff.json) and `P5-T5` (determinism
  double-run proof).
- `docs/adr/0001-canonical-authoring-model-rule-schema-v2.md` — names DF-E1-07 under "Unblocks";
  states the promotion trigger this spec restates above.
- `tools/rf-bundle-to-kb-pack/lib/semantic-diff.mjs`, `tests/ef-converter-invariants.test.mjs`,
  `tests/ef-converter-semantic-diff.test.mjs`, `tests/ef-converter-determinism.test.mjs`,
  `tests/ef-converter-manifest.test.mjs` — the actual E0 artifacts this spec scopes "expansion"
  against.
- `scripts/kb-diff.mjs`, `tests/kb-diff.test.mjs`, `docs/project_plans/SPIKEs/spike-005-semantic-
  diff-classification.md` — the pre-existing, separate richer semantic-diff/mutation-testing
  infrastructure (wave0-safety-foundation, EP-5) this spec explicitly does not re-propose.
- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §2.3 (15 seam
  invariants), §4.1 (converter runtime dependency scoping).
