---
schema_version: 2
doc_type: spike
title: "SPIKE-009: Converter Module Genericity and Decision-Driven Rule Emission"
status: completed
created: 2026-07-23
completed: 2026-07-23
feature_slug: multi-bundle-conversion-e1-finish
research_questions:
  - "Q1 — Once a valid, schema-conformant `authoring-decisions.yaml` exists for `modules/anemia`, `modules/kidney_suite_v1`, and `modules/growth_suite_v1`, can the real committed converter (`tools/rf-bundle-to-kb-pack`) run `inspect`/`verify`/`propose` end to end for those three bundles the way it already does for `cbc_suite_v1`?"
  - "Q2 — Can `npm run check` be made fully green from the current tree without any human legal or clinical determination?"
complexity: M
estimated_research_time: "~3h (2 parallel legs)"
prd_ref: null
plan_ref: null
related_documents:
  - .claude/worknotes/multi-bundle-conversion-e1-finish/decisions-block.md
  - docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
  - .claude/findings/multi-bundle-conversion-e1-findings.md
  - docs/project_plans/design-specs/df-e1-m1-rule-authoring-workflow.md
---

# SPIKE-009: Converter Module Genericity and Decision-Driven Rule Emission

> **Research record only.** This document reports what two parallel investigation legs found and
> what those findings force onto the downstream plan. It **authorizes nothing**: no code was
> changed by this SPIKE, no gate was cleared, no `authoring-decisions.yaml` was committed, and no
> module's `module.json.status`/`approvedBy[]` changed as a result of anything written here. Leg A
> ran entirely against read-only mirrored module directories under a scratch tmp path; `git status
> --porcelain` was confirmed clean before and after. Leg B diagnosed the current failing gate; it did
> not fix it.

---

## 1. Context

The request that originated this SPIKE assumed the blocker preventing `tools/rf-bundle-to-kb-pack`
from converting `anemia`, `kidney_suite_v1`, and `growth_suite_v1` — the way it already converts
`cbc_suite_v1` — was **the missing per-module `authoring-decisions.yaml` file**: write three
schema-conformant YAML files, and the real converter would run for all four bundles.

That assumption is the thing this SPIKE tested, not a premise it was allowed to inherit. It is
stated here, up front, precisely because it turned out to be false in a way that matters for
planning: if authoring the three files were sufficient, the correct next step would be "author three
files." Because it is not sufficient, the correct next step is different, and a plan built on the
original assumption would have shipped straight past a currently-inert fail-closed gate
(`authoring-decisions.yaml`'s `status` field) without anyone deciding to arm it.

A second, independent question sat alongside the first: the repo's `npm run check` gate is
currently red, and — per this program's evidence-grounding posture (see this repo's `CLAUDE.md`, "0
of 91 rules remain grounded... licensing-shaped") — there was a live risk that greening it would
require a human legal determination this SPIKE is not authorized to make. That risk needed to be
resolved before any phase plan could assume the gate is greenable by an agent at all.

Two legs ran in parallel to answer these two questions empirically, against the real repo, without
modifying anything under `modules/`, `schemas/`, or `tools/`.

---

## 2. Questions investigated

- **Q1 (Leg A)** — Is the converter capable of running the other 3 bundles once a valid
  `authoring-decisions.yaml` exists for each? Tested by mirroring each of the three module
  directories into scratch, writing a real, schema-conformant decisions file into each mirror (bound
  to real `clm_*`/`evas_*` IDs from that bundle's own fixtures), and running `inspect` → `verify` →
  `propose` against each, exactly as a human author would.
- **Q2 (Leg B)** — Can `npm run check` be made fully green without human legal input? Tested by
  running the full check pipeline, reducing all 27 failing tests plus `npm run validate`'s errors to
  their root causes, and classifying each root cause as mechanical (an agent can fix it using
  patterns already committed in this repo) or human-determination-requiring (needs a named human or
  counsel judgment).

---

## Leg A — Is the converter capable of running the other 3 bundles?

**No.** Even a valid, schema-conformant `authoring-decisions.yaml` for `modules/anemia`,
`modules/kidney_suite_v1`, or `modules/growth_suite_v1` gets `inspect`/`verify` to pass, but
`propose` fails closed for all three, with exit 1, at a hard-coded single-module identity check —
independent of anything in the decisions file. Separately, and more consequentially for governance:
`propose.mjs` never reads a decision record's `status` at all — the rule content it would emit for
the one module it does support (`cbc_suite_v1`) is a hard-coded constant chain, written
unconditionally.

### Empirical method

All commands run from the repo root
(`/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-multi-bundle-conversion-e1-finish`)
against `tools/rf-bundle-to-kb-pack/cli.mjs`. No file under `modules/`, `schemas/`, or `tools/` was
modified; `git status --porcelain` was confirmed clean before and after.

1. Read `lib/verbs/{inspect,verify,propose}.mjs`, `lib/loader.mjs`, `lib/eligibility.mjs`,
   `lib/claim-routing.mjs`, `lib/batch.mjs`, `lib/rule-candidate-drafts.mjs`,
   `lib/rule-provenance-drafts.mjs`, `scripts/evidence/govern-staged-rules.mjs`, and
   `schemas/authoring-decisions.schema.json`.
2. Discovered `loader.mjs` always resolves `authoring-decisions.yaml` as
   `path.dirname(--module)/authoring-decisions.yaml` (loader.mjs:229) — it does not honor a
   `--decisions` flag for path purposes; `propose.mjs` separately requires `--decisions` to equal
   that same resolved path (propose.mjs:552-559) or it throws. `inspect.mjs`/`verify.mjs` accept no
   `--decisions` flag at all. Consequently a scratch decisions file cannot be tested in place while
   leaving `modules/` untouched — the module directory itself must be mirrored.
3. Mirrored each of the three module directories verbatim into scratch (read-only copy, no edits to
   the repo):
   ```
   cp -R modules/kidney_suite_v1  /Users/miethe/.claude/jobs/53054696/tmp/module-mirrors/kidney_suite_v1
   cp -R modules/anemia           /Users/miethe/.claude/jobs/53054696/tmp/module-mirrors/anemia
   cp -R modules/growth_suite_v1  /Users/miethe/.claude/jobs/53054696/tmp/module-mirrors/growth_suite_v1
   ```
4. Wrote a minimal, schema-conformant `authoring-decisions.yaml` into each mirrored module
   directory (e.g.
   `/Users/miethe/.claude/jobs/53054696/tmp/module-mirrors/kidney_suite_v1/authoring-decisions.yaml`),
   each binding to one REAL `clm_*` claim ID from that bundle's own
   `tests/fixtures/<fixture>/claims/claim_ledger.yaml` and one REAL `evas_*` assertion ID from the
   module's already-committed `evidence-assertions.json` (e.g. `clm_001` / `evas_kid_clm_001` for
   kidney, `clm_001` / `evas_anemia_clm_001` for anemia, `clm_001` / `evas_gro_clm_001` for growth).
5. Ran, per module (module path points at the scratch mirror; `--run-dir` points at the real,
   unmodified fixture under `tests/fixtures/`):
   ```
   node tools/rf-bundle-to-kb-pack/cli.mjs inspect \
     --run-dir tests/fixtures/rf-kid-001 \
     --module /Users/miethe/.claude/jobs/53054696/tmp/module-mirrors/kidney_suite_v1/module.json

   node tools/rf-bundle-to-kb-pack/cli.mjs verify \
     --pack /Users/miethe/.claude/jobs/53054696/tmp/kid_out \
     --rule-schema schemas/rule.schema.json

   node tools/rf-bundle-to-kb-pack/cli.mjs propose \
     --run-dir tests/fixtures/rf-kid-001 \
     --module /Users/miethe/.claude/jobs/53054696/tmp/module-mirrors/kidney_suite_v1/module.json \
     --decisions /Users/miethe/.claude/jobs/53054696/tmp/module-mirrors/kidney_suite_v1/authoring-decisions.yaml \
     --out /Users/miethe/.claude/jobs/53054696/tmp/kid_out
   ```
   (analogous invocations for `rf-ev-001` → the anemia mirror and `rf-gro-002` → the growth mirror).
6. Recorded exit codes and full stderr/stdout for each stage; results below.

### Blocker 1: hard-coded module gate

`tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs:75`:
```js
export const MODULE_ID = 'cbc_suite_v1';
```

`tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs:568-575` (the throw site — runs AFTER
`loadBundle`/`pinArtifacts`/`checkEligibility` all succeed):
```js
if (pinned.moduleId !== MODULE_ID) {
    throw new UsageError(
      `propose has hand-authored drafting content (P3-T1..T6, FR-14) only for module ` +
        `"${MODULE_ID}" -- got module id "${pinned.moduleId}" from ${modulePath}. Drafting ` +
        'content for a different module is not yet implemented; propose refuses to silently ' +
        `draft "${MODULE_ID}" content under a different module's identity.`,
    );
  }
```

This check is a straight string-equality on `moduleId` vs. the literal `'cbc_suite_v1'`. It has no
dependency on `authoring-decisions.yaml`'s existence, content, or validity — it fires identically
whether the decisions file is missing, empty, or fully populated with `approved_for_rule_draft`
decisions. Empirically confirmed: all three modules produced byte-identical `UsageError` text
(module id substituted) at this exact point, exit code 1, with a fully valid decisions file already
in place.

### Blocker 2: decisions content is never read

`propose.mjs` reads `authoring-decisions.yaml` in exactly two ways, both of which use only its RAW
BYTES, never its parsed `decisions[]` array or any record's `status`:

1. **Path-equality gate** (`propose.mjs:552-559`): `expectedDecisionsPath` is computed from
   `--module`'s directory; the `--decisions` flag's resolved path must equal it or `propose` throws.
   This checks the flag argument, not the file's content.
2. **Traceability hash input** (`propose.mjs:630`):
   ```js
   const decisionsRaw = pinned.decisions.raw.toString('utf8');
   ```
   fed into `computeTraceabilityHash({ decisionsRaw, ... })` (`propose.mjs:402-414`), which only
   does `hash.update(label + '\n' + raw)` per artifact (`propose.mjs:404`:
   `['authoring-decisions.yaml', parts.decisionsRaw]`). This hashes the bytes; it never parses them.

Nowhere in `propose.mjs` is `pinned.decisions.parsed` (the field `loader.mjs:288` populates via
`parseYamlOrThrow`) referenced. Grep confirms zero occurrences of `decisions.parsed` in
`propose.mjs`.

The rule content `propose` actually emits comes from a separate, hard-coded chain that has no
runtime link to the decisions file at all:

- `RULE_PROPOSALS` — `tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs:123`
  (`export const RULE_PROPOSALS = Object.freeze([...])`), a literal array of 4 proposals scoped to
  `cbc_suite_v1` only. Imported into `propose.mjs:70`.
- `PARTIAL_STRICT_RULES` — `tools/rf-bundle-to-kb-pack/lib/rule-provenance-drafts.mjs:85`
  (`export const PARTIAL_STRICT_RULES = Object.freeze(RULE_PROPOSALS.map(projectPartialStrictRule));`)
  — derived mechanically from `RULE_PROPOSALS` above, still `cbc_suite_v1`-only.
- `STAGED_STRICT_RULES` — `scripts/evidence/govern-staged-rules.mjs:61`
  (`export const STAGED_STRICT_RULES = Object.freeze(PARTIAL_STRICT_RULES.map(finalizeStrictRule));`).

`writeStagedRulesAndProvenance()` (`scripts/evidence/govern-staged-rules.mjs:73-89`) writes both
output files with no conditional logic of any kind:
```js
export async function writeStagedRulesAndProvenance({ outDir } = {}) {
  const targetDir = outDir ?? path.join(process.cwd(), 'build', 'kb-pack', MODULE_ID, '0.1.0-proposal');
  await mkdir(targetDir, { recursive: true });

  const rulesPath = path.join(targetDir, 'rules.json');
  await writeFile(rulesPath, `${JSON.stringify(STAGED_STRICT_RULES, null, 2)}\n`, 'utf8');   // line 79

  const ruleProvenancePath = path.join(targetDir, 'rule-provenance.json');
  await writeFile(
    ruleProvenancePath,
    `${JSON.stringify(buildRuleProvenanceDocument(), null, 2)}\n`,
    'utf8',
  );                                                                                          // lines 82-86

  return { rulesPath, ruleProvenancePath };
}
```
`propose.mjs:622` calls this function unconditionally (`const { rulesPath, ruleProvenancePath } =
await writeStagedRulesAndProvenance({ outDir });`), reached whenever the module-id gate and the
seam-invariant-8 guard (`assertNoSoleConflictedBasis`, `propose.mjs:142-153`) both pass. That guard
is keyed on the `rf` claim ledger's own `claim.status` (via `routeClaims`/`routeClaim` in
`lib/claim-routing.mjs`), NOT on the authoring-decision record's `status` field — a decision's
`approved_for_rule_draft`/`rejected`/`withdrawn` value plays no role in it.

There is no branch anywhere in this call chain that inspects a decision's `status`. Therefore: for
the one module `propose` currently supports, `rules.json`/`rule-provenance.json` are written on
every successful run, regardless of what `status` any decision in `authoring-decisions.yaml`
carries — including a file where every decision is `rejected` or `withdrawn`.

### Governance implication

The E1 PRD's FR-9 fail-closed property — no approved decision should ever result in `rules.json`
being emitted — is a property this document set describes and the schema models (the
`status: approved_for_rule_draft | rejected | withdrawn` enum, `schemas/authoring-decisions.schema.json`),
but it is not enforced anywhere in `propose.mjs`'s executable path as traced above. The `status`
field is presently inert at runtime: it is validated for shape by the JSON Schema and cross-checked
for `decision_id`/join-key consistency by hand-written tests (e.g.
`tests/ef-converter-rule-candidate-drafting.test.mjs`, per that file's own header comments in
`rule-candidate-drafts.mjs:20-23`), but `propose.mjs` never reads or branches on it. This is stated
as a code-tracing fact, not a criticism of intent or design.

### Per-module results

| Module (fixture) | `inspect` | `verify` (against empty pack) | `propose` |
|---|---|---|---|
| `kidney_suite_v1` (`rf-kid-001`) | exit 0 — 83/87 claims eligible | exit 0 — vacuous pass (`rulesJson.present: false`, `valid: true`) | **exit 1** — `UsageError` at `propose.mjs:568-575`, moduleId gate (`"kidney_suite_v1" !== "cbc_suite_v1"`) |
| `anemia` (`rf-ev-001`) | exit 0 — 43/48 claims eligible | not separately re-run (same code path) | **exit 1** — identical `UsageError`, moduleId gate (`"anemia" !== "cbc_suite_v1"`) |
| `growth_suite_v1` (`rf-gro-002`) | exit 0 — 89/92 claims eligible | not separately re-run (same code path) | **exit 1** — identical `UsageError`, moduleId gate (`"growth_suite_v1" !== "cbc_suite_v1"`) |

All three failures produced exit code 1 (`EXIT_USAGE`, `tools/rf-bundle-to-kb-pack/lib/errors.mjs:24`),
not a schema (2), governance (3), or human-review (7) exit — this is a usage-level refusal, not a
content-quality or clinical-governance rejection.

### modules/anemia legacy shape

`modules/anemia/evidence.json` uses a legacy top-level shape (`knowledgeBaseVersion`,
`reviewedThrough`, `sources`, `derived_syntheses`) rather than the shape `modules/kidney_suite_v1`
and `modules/growth_suite_v1` project. This is confirmed structurally harmless to `propose`:
`readModuleProjectionFile()` (`propose.mjs`, called at line 577) reads `evidence.json` as a raw
UTF-8 string, and `propose.mjs:613-614` copies it byte-verbatim with `copyFile(evidenceFile.path,
evidencePath)` — it is never `JSON.parse`d or shape-validated anywhere in the converter. (Only
`evidence-assertions.json` is `JSON.parse`d, at `propose.mjs:585`, and `modules/anemia/evidence-
assertions.json` already has the expected `{schemaVersion, moduleId, rfProvenance, assertions[]}`
shape with real `evas_anemia_*` records tied to `rf-ev-001`.) The legacy `derived_syntheses` shape
is therefore a non-issue for this converter; anemia's sole empirical blocker is Blocker 1
(the moduleId gate), identical to kidney and growth.

### Minimum valid decisions-file content

Per `schemas/authoring-decisions.schema.json`, confirmed against the hand-rolled parser in
`lib/yaml-lite.mjs`:

- Top level (required): `schemaVersion`, `moduleId` (must match `module.json.id`),
  `rfProvenance.{rfRunId, rfBundleId, fixturePath}` (all required, non-empty strings), and
  `decisions[]` (array; `minItems: 0` — a scaffold with zero records is schema-valid).
- Each entry in `decisions[]` (if any), all fields required: `decision_id` (`^dec_[a-z0-9_]+$`),
  `module_id`, `status` (`approved_for_rule_draft | rejected | withdrawn`),
  `basis.{kind, rf_claim_ids[≥1, pattern ^clm_[a-z0-9]+$], exact_assertion_ids[≥1, pattern
  ^evas_[a-z0-9_]+$], reasoning[non-empty string]}`, `conflicts.{visible[bool],
  representation[snake_case, non-empty]}`, `clinical_effect.{intended_output[snake_case,
  non-empty], prohibited_effects[≥1 snake_case string]}`, `review.{evidence_methodologist,
  clinician_1, clinician_2, laboratory_medicine}` (each `pending | approved | rejected`).

**ID cross-resolution is NOT enforced by the schema or by any runtime code path in this converter.**
The schema validates each `rf_claim_ids`/`exact_assertion_ids` entry only against a regex pattern
(`^clm_[a-z0-9]+$` / `^evas_[a-z0-9_]+$`) — it does not check that the ID actually exists in the
bundle's `claim_ledger.yaml` or the module's `evidence-assertions.json`
(`schemas/authoring-decisions.schema.json`'s own field descriptions state this explicitly: "This
schema cannot verify that cross-file resolution itself"). That cross-file resolution is currently
proven only by hand-written test suites (e.g. `tests/ef-converter-rule-candidate-drafting.test.mjs`,
which parses the real `cbc_suite_v1` YAML and cross-checks join keys) — there is no
`validateAuthoringDecisions()`-style runtime check invoked by `inspect`/`verify`/`propose` itself
that would catch a decisions file citing a non-existent claim or assertion ID for the other three
modules.

### Effort

Authoring the 3 real `authoring-decisions.yaml` files is estimated at **5–8 story points total
(~2 points/module)**, dominated by clinical/evidentiary judgment rather than mechanics:

- **Mechanical (~15% of effort)**: schema/ID plumbing — `schemaVersion`, `rfProvenance` block,
  YAML structure, `dec_*` ID minting — fully derivable from each fixture's `evidence_bundle.yaml`
  and requires no clinical judgment.
- **Judgment-heavy (~85% of effort)**: for each intended slice rule/candidate per module — selecting
  which real `clm_*`/`evas_*` IDs genuinely support a specific clinical decision, writing the
  `reasoning` narrative, and naming the true `conflicts.representation` /
  `clinical_effect.intended_output` / `prohibited_effects[]` labels. The `cbc_suite_v1` precedent
  (`modules/cbc_suite_v1/authoring-decisions.yaml`'s own header) shows this step required a genuine
  clinical re-scoping correction (the FR-16(c) iron-deficiency → benign-neutropenia-differential
  identity fix) — the kind of judgment call that cannot be scripted. Kidney (87 claims) and growth
  (92 claims) are each larger evidence bases than `cbc_suite_v1`'s fixture; effort scales with the
  number of distinct rule/candidate slices a human author decides each module's plan actually wants,
  not with raw claim count alone.

This effort estimate is scoped to authoring the 3 decisions files only. It does **not** include the
separate code change required to remove Blocker 1 (making `propose.mjs`'s drafting-content chain
module-aware instead of hard-coded to `cbc_suite_v1`), nor any change to make Blocker 2's `status`
field load-bearing at runtime — both are prerequisites, independent of decisions-file authoring,
for any of the three modules to ever complete `propose` end-to-end.

---

## Leg B — Can `npm run check` be made green without human legal input?

**Yes.** Every failing item in the current `npm run check` run traces to one of four independent
root causes, and all four are fixable by an agent using patterns already committed in this repo —
none requires a human legal or clinical determination.

### Failure inventory

`npm test`: 2714 tests run, 27 failing. `npm run validate`: exits 1 (schema + rights-ledger
coverage errors). All 27 test failures and the full validate output reduce to 4 independent root
causes:

| Failing item | Module(s) | Root cause | Mechanical or human |
|---|---|---|---|
| `scripts/validate-kb.mjs` — `evidence.schema.json` required-property errors (`license`, `access_basis`, `terms`, `terms_snapshot` on sources; `evidence_item_type`, `judgment_basis`, `judgment_basis_attestation`, `rights_component_class`, `structured_locator`, `not_captured` on passages) | cbc_suite_v1 (12 sources), kidney_suite_v1 (12), growth_suite_v1 (11) | 35 newly-added/newly-created sources were never given the rights-metadata fields the schema requires | **Mechanical** |
| `validate-kb.mjs` — "no rights/rights-ledger.json entry resolves this evidence_source_id" (FR-WP2-06), for all 35 of the same source ids | same 3 modules | No `rights/rights-ledger.json` entries, and no matching `rights/rights-records.json` records, exist for these 35 ids | **Mechanical** |
| `tests/ef-cbc-002-backfill.test.mjs#buildNewSources` (test 348) | cbc_suite_v1 | `scripts/evidence/lib/cbc-002-projection.mjs`'s `buildNewSources()` builder function itself never emits the rights fields — same root cause as row 1, in code rather than data | **Mechanical** |
| `validateModule('cbc_suite_v1'/…)`, `validate-kb.mjs` CLI exit-0 check, candidate-evidence-resolution, propose-run, manifest-preimage, rights-substrate D7 control, docs-architecture "no clearance" negative-control, `MODULE_KB_LOADERS`/dist tests (~18 further "not ok" lines) | cbc/kidney/growth | All downstream symptoms of the same 35 ungoverned sources — every code path that calls `validateModule`/`validate-kb.mjs` fails on them | **Mechanical** (same fix cascades) |
| `tests/ef-anemia-backfill-integrity.test.mjs` (test 332) + 3 sibling P4-T1-baseline tests | anemia, cbc_suite_v1 (original 8 sources) | `tests/fixtures/p4-t1-pre-merge-snapshot.json.txt` records a stale SHA-256 for `modules/anemia/evidence.json`. Verified: the raw file's actual hash (`shasum -a 256`) is `8c42f9…`, matching `computeSnapshot()`'s fresh output; the committed fixture expects `9bf5a4…`. No working-tree drift exists (`git status` clean, `git diff HEAD` empty) — the fixture itself is stale | **Mechanical** (regenerate fixture) |
| `tests/notice-architecture-no-clearance.test.mjs` | docs only | `docs/architecture.md` says a Phase-6 pattern is "flagged for legal review **rather than cleared** as clinical evidence" — an explicit denial of clearance — but the test's negation-marker regex does not recognize "rather than X" as negating X, so it false-positives on the word "cleared." The doc makes no false claim; the checker's marker list is incomplete | **Mechanical** (reword sentence or extend regex) |
| `module-registry.test.mjs` P6-010(a) / P6-008(c) dist/ checks | build | `dist/` is gitignored and this worktree has never run `npm run build`; unrelated to rights | **Mechanical** (build-ordering artifact) |

### The honest-unknown precedent

The crux of this leg: filling in the 35 sources' missing rights fields does **not** require a
legal or clinical determination, because the schema and the rights substrate already ship a
designed, precedented way to record "not yet assessed" honestly, and that pattern is already
committed and passing for 14 existing sources.

`rights/rights-records.json`'s `RR-AAP2026_IDA` record (one of the 6 EPR0-T4 "triage-only"
seed records) is shaped exactly like this:

- `access.basis: "unknown"`, `access.automated_retrieval_allowed: "unknown"`, `access.text_and_data_mining_allowed: "unknown"`, `access.model_training_allowed: "not_assessed"`
- `copyright.status: "unknown"`, `copyright.noncommercial_only: null`, `copyright.no_derivatives: null`
- `component_decisions[0].decision: "unknown"` with `notes: "Not yet assessed; triage-only record (EPR0-T4)."`
- `overall_status: "UNKNOWN"`
- `review.assessed_by_agent: "epr0-t4-triage-seed"`, `review.human_reviewer: null`, `review.counsel_reviewer: null`, `review.review_status: "agent_triage_only"`

`scripts/validate-rights.mjs`'s own module header states this explicitly (D7): "No gate here
reads `overall_status` (or any rights-authority field) and fails BECAUSE of which legitimate
value is present — a record sitting at `overall_status: 'UNKNOWN'` (the seeded state of all 6
EPR0-T4 records) passes every gate in this file, and so does one sitting at `'PROHIBITED'`." A
gate may only fail on a *structural* defect (a missing cross-link, a dangling reference, a value
outside the schema's closed vocabulary) — never on which honest value is recorded.

Why this is honest rather than fabricated:

1. **It asserts nothing.** Every field is set to the schema's own `"unknown"` / `"unassessed"` /
   `null` enum member, never to a specific license, basis, or judgment. No claim about the
   source's actual rights posture is made.
2. **It uses the schema's own designed vocabulary.** `access_basis`, `license.status`,
   `terms.*`, and `judgment_basis` all carry a closed `unknown`/`unassessed` member specifically
   so that "not yet assessed" is a first-class, typed state (D2: "missingness is never treated as
   normal") rather than an omitted key masquerading as a decision.
3. **It carries an agent-attribution marker that makes misreading it as a determination
   impossible.** `review.assessed_by_agent` + `review.review_status: "agent_triage_only"` +
   `review.human_reviewer: null` / `review.counsel_reviewer: null` stamp the record, permanently
   and machine-checkably, as something an agent seeded and no human has looked at — the opposite
   of a clearance claim.

### Mechanically derivable set

All 35 new/ungoverned source ids are in this bucket. Grouped by module:

**cbc_suite_v1 (12 new sources, RF-CBC-002 batch):**
`ADVCLINEXPMED2024_FA_CYTOGENETICS`, `ASTCT2024_SAA_HCT_GUIDELINE`, `BCMD2024_AIEOP_AA_GUIDELINE`,
`BJHAEM2024_BSH_AA_GUIDELINE`, `BLOOD2022_TBD_OUTCOMES`, `BLOODADV2024_SAA_DELPHI_CONSENSUS`,
`BLOODADV2025_RCC_OBSERVATION_OUTCOMES`, `FRONTIMMUNOL2022_PEDIATRIC_BMF_PROTOCOL`,
`INDIANPEDIATR2022_IAP_AA_CONSENSUS`, `LANCETHAEM2024_DBA_CONSENSUS`,
`LEUKEMIA2024_IBMFS_PROTEOGENOMICS`, `PBC2024_PEDIATRIC_SAA_RECOMMENDATIONS`

**kidney_suite_v1 (12 sources, entire module is new):**
`CKID_U25_GFR_EQUATIONS_2021`, `CKID_RACE_CR_CYSC_GFR_2021`, `AAP_PEDIATRIC_HTN_GUIDELINE_2017`,
`KDIGO_CKD_GUIDELINE_2024`, `CYSTATINC_EGFR_PEDIATRIC_UTILITY_2024`,
`PEDIATRIC_TRANSPLANT_EGFR_COMPARISON_2025`, `HEMATURIA_PROTEINURIA_CHILDREN_REVIEW_2018`,
`PROTEINURIA_CHILDREN_EVALUATION_AFP_2017`, `PROTEINURIA_HEMATURIA_AMBULATORY_REVIEW_2022`,
`PEDIATRIC_EGFR_DISCORDANT_GFR_2023`, `SPOT_PC_RATIO_DIAGNOSTIC_UTILITY_REVIEW_2020`,
`PEDIATRIC_TRANSPLANT_CYSC_VS_CR_EGFR_2024`

**growth_suite_v1 (11 sources, entire module is new):**
`AFP2023_GROWTH_FALTERING_REVIEW`, `ANM2024_FALTERING_GROWTH_UPDATE`,
`ASPEN2015_MALNUTRITION_INDICATORS`, `CDC2010_WHO_CDC_CHART_USE_REC`,
`JPEDS2024_INTERGROWTH21_COGNITIVE_RISK`, `NICE2017_NG75_FALTERING_GROWTH`,
`NUTRIENTS2026_PRETERM_ESPGHAN`, `PEDS2025_GRADUAL_TRANSITION_CHART`,
`WHO2006_LHFA_STANDARD`, `WHO2006_WFL_WFH_STANDARD`, `WHO2007_BMI_5_19Y_REFERENCE`

**Exact 4-step remediation:**

1. Extend `scripts/evidence/lib/cbc-002-projection.mjs`'s `buildNewSources()` to emit the
   EPR0-T4 triage-`unknown` `license` / `access_basis` / `terms` / `terms_snapshot` block on
   each of the 12 cbc sources, and the same `judgment_basis: "unassessed"` /
   `judgment_basis_attestation: null` / typed `not_captured` block already used correctly on
   these sources' own `implementation-proposal` sentinel passages. Hand-author the equivalent
   fields directly into `modules/kidney_suite_v1/evidence.json` and
   `modules/growth_suite_v1/evidence.json` (these two modules have no dedicated builder script
   yet).
2. Mint 35 new triage-only entries in `rights/rights-records.json` (`RR-<sourceId>`,
   `overall_status: "UNKNOWN"`, `review.assessed_by_agent: "<task-marker>"`,
   `review.review_status: "agent_triage_only"`), mirroring `RR-AAP2026_IDA` verbatim in shape.
3. Add matching `evidence_source_id` + `kb_json_file_path` join entries to
   `rights/rights-ledger.json` for each of the 35 ids, mirroring the existing 14
   cbc_suite_v1-backfill entries already in that file.
4. Regenerate `tests/fixtures/p4-t1-pre-merge-snapshot.json.txt` via
   `scripts/lib/p4-t1-snapshot.mjs`'s `computeSnapshot()` (or its capture script) against current
   HEAD, since the committed fixture's expected hash for `modules/anemia/evidence.json` no
   longer matches the real, legitimate, committed file content.

Files that must change: `scripts/evidence/lib/cbc-002-projection.mjs`,
`modules/kidney_suite_v1/evidence.json`, `modules/growth_suite_v1/evidence.json`,
`rights/rights-records.json`, `rights/rights-ledger.json`,
`tests/fixtures/p4-t1-pre-merge-snapshot.json.txt`.

### Human-determination set

**Empty**, for the purpose of greening `npm run check`. No item in the failure inventory
requires a named human or counsel determination to resolve.

Separately, for clarity of the boundary: a human/legal determination **would** be required only
if the project later wants to move any of these 35 sources (or the existing 6 anemia + 8
original-cbc sources, all still at `overall_status: "UNKNOWN"`) *off* that state — i.e., to
actually assert a `license.status` other than `"unknown"`, an `access_basis` other than
`"unknown"`, or a `judgment_basis` other than `"unassessed"`. `judgment_basis_attestation` stays
schema-forced `const: null` for exactly this reason (`schemas/evidence.schema.json`: "the human
attestation that would justify a non-`unassessed` `judgment_basis` does not exist in this project
and MUST NOT be agent-authored"). That work is unchanged, separately-blocked, and out of scope
for greening the current gate.

### Quarantine option (rejected)

Dropping the 35 sources back out of `sources[]` (which `evidence.schema.json`'s
`minItems: 0` on `sources` technically permits for a brand-new module) was considered and
rejected:

- **Breaks committed count assertions.** `tests/ef-cbc-002-backfill.test.mjs` asserts
  `buildNewSources()` returns exactly 12 sources, and that the real committed
  `modules/cbc_suite_v1/evidence.json` has exactly 20 sources (8 + 12). Quarantining would not
  green the suite — it would just relocate the failure into these count assertions.
- **Discards verified `rf` content for zero gain.** Per the E1 conversion commit message ("zero
  new clinical rules") and `cbc-002-projection.mjs`'s own header ("no approved decision exists
  for any RF-CBC-002 claim... `rules.json` is NEVER touched by anything in this file"), none of
  the 35 sources is cited by any rule or candidate yet. Quarantining would throw away real,
  already-verified `rf` bundle content that costs nothing to keep, since the honest-`unknown`
  fix is no harder to write than a quarantine would be.
- **No source-level precedent exists.** Precedent for quarantine in this repo is at the
  **passage** level only: `AAP2026_IDA#ev_001` carries `status: "quarantined"` and
  `reviewFlags: ["source-not-independently-retrievable"]` because an independent fidelity audit
  found a specific defect in that one passage, while the source itself stays fully cited. There
  is no committed precedent anywhere for dropping an entire source out of `sources[]`; inventing
  one here would be a bigger departure from existing patterns than filling in an honest-unknown
  block.

### Residual non-rights failures

Three failures are unrelated to the rights-metadata gap and need their own (still purely
mechanical) fixes:

- **Stale `tests/fixtures/p4-t1-pre-merge-snapshot.json.txt`.** Fix: regenerate the fixture from
  current HEAD via `scripts/lib/p4-t1-snapshot.mjs`'s `computeSnapshot()` (same step 4 above).
- **`notice-architecture-no-clearance.test.mjs` false positive** on "flagged for legal review
  rather than cleared as clinical evidence" in `docs/architecture.md`. Fix: reword the sentence
  to avoid the bare word "cleared" near an unrecognized negation pattern (e.g. "held for legal
  review, not treated as cleared"), or extend the test's negation-marker list to recognize
  "rather than."
- **`module-registry.test.mjs` P6-010(a)/P6-008(c) dist/ checks** fail because `dist/` is
  gitignored and this worktree has never run `npm run build`. Fix: run `npm run build` before
  `npm test` in this worktree, or accept this as expected in a fresh, unbuilt checkout — it is a
  build-ordering artifact, not a defect in the checked-in code.

### Verdict (Leg B, internal)

**Yes — `npm run check` can be made fully green without any human legal or clinical input.**
Route: (1) backfill the 35 sources' rights fields using the already-committed EPR0-T4
honest-unknown pattern (code change in `cbc-002-projection.mjs` + direct edits to the two new
modules' `evidence.json`), (2) mint 35 matching triage-only `rights-records.json` entries plus
`rights-ledger.json` joins, (3) regenerate the stale P4-T1 snapshot fixture, (4) fix the
architecture-notice wording/regex mismatch, (5) run `npm run build` before `npm test` in this
worktree. None of these steps asserts a license status, an access basis, or a judgment-basis
determination beyond what the schema's own `unknown`/`unassessed` vocabulary already permits an
agent to record honestly.

---

## Verdict

**THE PREMISE IS DISPROVED.** Authoring three `authoring-decisions.yaml` files alone accomplishes
nothing. Two independent code blockers sit behind them, and both fire before a decisions file's
content is ever consulted:

1. **A hard-coded module-identity gate** (`tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs:75`,
   enforced at `lib/verbs/propose.mjs:568-575`) refuses `propose` for any module whose id is not the
   literal string `cbc_suite_v1` — exit 1, `UsageError`, identical for `anemia`, `kidney_suite_v1`,
   and `growth_suite_v1`, regardless of decisions-file content. Writing the three files does not move
   this needle by one line: `inspect`/`verify` already pass without them, and `propose` still refuses
   with them in place.
2. **`propose.mjs` never parses a decision's `status`.** It reads `authoring-decisions.yaml` twice —
   once as a path-equality check on the `--decisions` flag, once as raw bytes hashed into a
   traceability digest — and never touches `pinned.decisions.parsed`. The rule content it emits for
   the one module it does support comes from a hard-coded constant chain
   (`RULE_PROPOSALS` → `PARTIAL_STRICT_RULES` → `STAGED_STRICT_RULES`) that
   `writeStagedRulesAndProvenance()` writes to `rules.json`/`rule-provenance.json`
   **unconditionally** on every successful run.

**FR-9's fail-closed property — "no approved decision ⇒ no `rules.json`" — is documented and
schema-modeled but not enforced anywhere in code.** The `status` enum
(`approved_for_rule_draft | rejected | withdrawn`) is presently **inert**: it is validated for shape
by JSON Schema and cross-checked for ID consistency by hand-written tests, but no runtime branch in
`propose.mjs`'s executable path reads it. Today the only thing standing between the current codebase
and AI-drafted `rules.json` output for three clinical modules is the accidental, string-literal
module gate in Blocker 1 — not the intentional governance mechanism the schema implies exists.

**`npm run check` CAN be greened with zero human legal input.** All 27 failing tests and every
`npm run validate` error trace to four independent, purely mechanical root causes (rights-metadata
backfill using the already-committed EPR0-T4 honest-`unknown` pattern; a stale P4-T1 snapshot
fixture; a negation-regex false positive in a docs test; an unbuilt `dist/`). None requires asserting
a license status, an access basis, or a judgment-basis determination beyond the schema's own
`unknown`/`unassessed` vocabulary, and none requires a named human or counsel reviewer.

---

## Consequences for planning

The locked scope decision (recorded canonically in
`.claude/worknotes/multi-bundle-conversion-e1-finish/decisions-block.md` §0) follows directly from
this verdict: the converter becomes module-generic **and** the `status` field becomes a live,
enforced fail-closed gate — as one deliverable, not two independently-orderable ones. Making the
converter module-generic without first arming the gate would take a latent guardrail hole (Blocker
2) and expose it across three additional clinical modules the moment Blocker 1 is removed.

Concretely, once both changes land, the three new modules (`anemia` via the converter path,
`kidney_suite_v1`, `growth_suite_v1`) may emit through `propose`:
- `evidence.json`, `evidence-assertions.json`, conflict objects, `unresolved.json`,
  `pack-provenance.json`, `conversion-report.json`, `semantic-diff.json`
- an **inert** `rule-proposals.json` (proposals recorded, never promoted)

They must **never** emit `rules.json` or `rule-provenance.json` — those two files stay
`cbc_suite_v1`-exclusive until a human-authored, `approved_for_rule_draft` decision exists for
another module and the (newly-enforced) gate actually admits it.

`cbc_suite_v1`'s existing, already-verified conversion output must stay **SHA-256 byte-identical**
across the module-generic refactor — this is the regression anchor. Because `cbc_suite_v1` is the
one module whose converter output is already committed into the KB, any drift here is not a build
break, it is a clinical content change.

The mandatory **P1-before-P2 safety interlock** (fail-closed gate enforcement in code, before the
converter's single-module hard-coding is removed) exists because P2 unlocks rule emission for three
modules at once. If module genericity landed first, there would be a window — however brief — in
which the converter can emit AI-drafted `rules.json` for `anemia`, `kidney_suite_v1`, and
`growth_suite_v1` with nothing but an inert documentation field (the `status` enum) standing in the
way. Arming the safety interlock (P1) before removing the mechanical stop (P2's genericity work) is
the only ordering that never exposes that window. This ordering is stated as binding in the decisions
block and is not delegable to a lower-authority phase re-ordering during expansion.

---

## Open questions carried forward

Canonical text lives in `.claude/worknotes/multi-bundle-conversion-e1-finish/decisions-block.md` §7;
referenced here by ID only, one line each.

- **OQ-A** — What exact non-approving `status` enum value name is added (and does it also cover
  `rejected`/`withdrawn` blocking emission)?
- **OQ-B** — Does the per-module drafting registry live as code keyed by `moduleId`, or is drafting
  content derived wholly from the parsed decisions file (strong prior: the latter)?
- **OQ-C** — Does runtime `clm_*`/`evas_*` ID cross-resolution belong in P1 (with the gate) or P2
  (with genericity)? (Strong prior: P1, as a fabrication guard.)
- **OQ-D** — How does converter-produced `evidence.json` for kidney/growth reconcile with the
  previously-bespoke evidence projections already committed for those modules — does it replace them,
  and is that a reviewable semantic diff?
- **OQ-E** — Prior PRD FR-22 states no task authors a new `authoring-decisions.yaml`; this plan
  deliberately does — must be recorded as an explicit, scoped supersession, not a silent contradiction.
- **OQ-F** — Does `npm run check`'s script string change (e.g. a new converter batch step), requiring
  a same-commit `CLAUDE.md` update to keep `tests/claudemd-check-gate.test.mjs` green?

---

## Reproduction

All commands below run from the repo root
(`/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-multi-bundle-conversion-e1-finish`)
against a clean tree (`git status --porcelain` empty before and after).

### Leg A — reproduce the two blockers

```bash
# 1. Confirm the hard-coded gate and the never-parsed status field, by inspection:
sed -n '60,90p'   tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs   # MODULE_ID = 'cbc_suite_v1'
sed -n '540,630p' tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs           # path-equality gate, moduleId throw, traceability hash
grep -n "decisions.parsed" tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs  # zero hits — parsed content never read

# 2. Mirror a non-cbc module into scratch (read-only copy; nothing under modules/ is touched)
mkdir -p /tmp/module-mirrors
cp -R modules/kidney_suite_v1 /tmp/module-mirrors/kidney_suite_v1
# (repeat for modules/anemia, modules/growth_suite_v1)

# 3. Write a minimal schema-conformant authoring-decisions.yaml into the mirror, binding to a
#    REAL clm_*/evas_* pair pulled from that bundle's own fixtures, e.g.:
#      tests/fixtures/rf-kid-001/claims/claim_ledger.yaml            (clm_001)
#      modules/kidney_suite_v1/evidence-assertions.json              (evas_kid_clm_001)

# 4. Run inspect -> propose against the mirror; --run-dir stays pointed at the real, unmodified fixture
node tools/rf-bundle-to-kb-pack/cli.mjs inspect \
  --run-dir tests/fixtures/rf-kid-001 \
  --module /tmp/module-mirrors/kidney_suite_v1/module.json

node tools/rf-bundle-to-kb-pack/cli.mjs propose \
  --run-dir tests/fixtures/rf-kid-001 \
  --module /tmp/module-mirrors/kidney_suite_v1/module.json \
  --decisions /tmp/module-mirrors/kidney_suite_v1/authoring-decisions.yaml \
  --out /tmp/kid_out
# Expected: inspect exits 0; propose exits 1 with UsageError at propose.mjs:568-575
#   ("propose has hand-authored drafting content ... only for module \"cbc_suite_v1\" -- got module id \"kidney_suite_v1\"")

# Confirm the emitted content for the one module propose DOES support is unconditional:
sed -n '55,90p' scripts/evidence/govern-staged-rules.mjs   # writeStagedRulesAndProvenance() — no status branch
```

### Leg B — reproduce the gate diagnosis

```bash
# 1. Reproduce the full failure inventory
npm test                 # expect: 2714 tests run, 27 failing
npm run validate          # expect: exit 1 — schema + rights-ledger coverage errors

# 2. Confirm the 35-source rights-metadata gap
node scripts/validate-kb.mjs 2>&1 | grep -c "no rights/rights-ledger.json entry resolves"   # expect: 35

# 3. Confirm the honest-unknown precedent already committed and passing
grep -n '"RR-AAP2026_IDA"' -A 20 rights/rights-records.json | grep -E "overall_status|assessed_by_agent|review_status"

# 4. Confirm the stale P4-T1 snapshot fixture
shasum -a 256 modules/anemia/evidence.json
grep -A2 '"modules/anemia/evidence.json"' tests/fixtures/p4-t1-pre-merge-snapshot.json.txt
# expect: the shasum output does not match the fixture's recorded hash; git status/diff on the
# real file is clean, confirming the fixture — not the file — is stale
git status --porcelain modules/anemia/evidence.json    # expect: empty
git diff HEAD -- modules/anemia/evidence.json           # expect: empty

# 5. Confirm the negation-marker false positive
node --test tests/notice-architecture-no-clearance.test.mjs
grep -n "rather than cleared" docs/architecture.md

# 6. Confirm the dist/ build-ordering artifact
git check-ignore -v dist/ 2>/dev/null || true
npm run build && npm test   # re-run after build; the two dist/-dependent assertions should now pass
```
