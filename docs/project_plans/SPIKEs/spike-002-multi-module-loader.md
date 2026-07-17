---
doc_type: spike
title: "SPIKE-002 — Multi-module loader for validate-kb, build-static, smoke-test, and server.mjs without breaking content-hash cache-busting"
status: completed
created: 2026-07-17
feature_slug: platform-foundation-p0
research_questions:
  - "How do scripts and server enumerate registered modules — explicit registry vs directory scan?"
  - "How does validate-kb.mjs generalize to per-module schema validation?"
  - "How does build-static.mjs generalize KB data flow into the static bundle, and how must content-hash stamping change so today's single-module output stays correct and future multi-module output still busts caches?"
  - "How do smoke-test.mjs and server.mjs iterate modules, and what is the backward-compatible API surface for moduleId on GET /api/v1/knowledge-base and POST /api/v1/assess?"
  - "What does the new module-load test assert?"
  - "How is the byte-for-byte build-output equivalence gate run in practice?"
complexity: M
estimated_research_time: "4h"
---

# SPIKE-002 — Multi-module loader without breaking content-hash cache-busting

> **Superseded decisions.** Q4's public-API design below — an optional `?moduleId=` query param /
> body field on `GET /api/v1/knowledge-base` and `POST /api/v1/assess`, its `400` unknown-module error
> path, and the `meta.moduleId` response echo — is **superseded** by the binding OQ-2 arbitration
> (Opus arbitration overriding this spike in favor of SPIKE-001's no-surface-change position): **no
> public API surface change ships in P0.** Module iteration in `server.mjs` is internal only; existing
> request/response shapes and `openapi.yaml` are untouched. See
> `.claude/worknotes/platform-foundation-p0/decisions-block.md` §7 OQ-2 and the PRD's AC-5
> (`docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md`). The original Q4 text is left
> unmodified below for research-record purposes — treat it as historical rationale, not current spec.

Gates: **P0** (P0-WP5: `scripts/validate-kb.mjs`, `scripts/build-static.mjs`, `scripts/smoke-test.mjs`, `server.mjs`, `tests/`).
Depends on: P0-WP1 (module package contract; `modules/anemia/{rules,candidates,evidence,reference-ranges}.json`, `module.json` stub).
Companion: SPIKE-001 (module-package boundary + fact-registry design — this spike assumes SPIKE-001's `modules/<id>/` layout and does not re-litigate it).

## Scope note

Zero clinical behavior change. This spike only designs *iteration* — how the four executable surfaces (validate, build, smoke, server) and the test suite learn to loop over N modules instead of hard-coding `data/*.json`. It does not touch `src/facts.js`, `src/ruleEngine.js`, or rule/candidate content (SPIKE-001/P0-WP2/WP3/WP4 territory), except where server.mjs's request handling has an unavoidable soft dependency on P0-WP3's generalized `assess(input, moduleId)` signature (flagged in OQ-002).

---

## Findings

### Q1 — Module discovery/registration

Today nothing enumerates modules: `validate-kb.mjs`, `build-static.mjs`, and `server.mjs` each hard-code `data/rules.json` / `data/candidates.json` (server.mjs:13–14; build-static.mjs:73–75; validate-kb.mjs:5–6), and `server.mjs` imports `assessPediatricAnemia` and evidence constants directly from `./src/engine.js` / `./src/evidence.js` by name. There is no notion of "a module" in the runtime today — only in the roadmap's target file layout.

Two designs were considered: **directory scan** (`readdir('modules')`, treat every subdirectory as a module) vs. **explicit static registry**. Directory scan fails the roadmap's own constraint ("no dynamic import magic beyond a static registry") and has three concrete problems in this repo's workflow: (1) a work-in-progress module directory created mid-branch for P2/P4/P5 (e.g. `modules/cbc/` mid-refactor, missing `rules.json`) would silently activate in every script and the running server the moment the directory exists, before it's ready or reviewed; (2) scan order needs an explicit sort to be deterministic, which is one more thing every consumer must remember, vs. an already-ordered array; (3) `module.json` (WP6) still requires a human decision to register a module's metadata, so "scan then read module.json" is two sources of truth for the same fact (is this module live) — a scan only *looks* like it removes the registration step.

**Recommendation: one static registry file, `src/modules/registry.js`.**

```js
// src/modules/registry.js — the single source of truth for "which modules exist"
// and "how their code loads." Data files are read by path from MODULE_IDS,
// not imported, so adding a module's JSON never touches this file.
export const DEFAULT_MODULE_ID = 'anemia';
export const MODULE_IDS = Object.freeze(['anemia']);

// Per-module *code* (facts.<id>.js and, from P0-WP3 on, module.js hooks)
// is loaded through literal, enumerated import() specifiers — never a
// template-string path built from a variable — so every loadable module is
// visible by reading this one file, and a typo'd id fails at the call site
// with a clear error instead of silently resolving nothing.
const MODULE_CODE_LOADERS = Object.freeze({
  anemia: () => import('../../modules/anemia/facts.anemia.js'),
});

export async function loadModuleCode(moduleId) {
  const loader = MODULE_CODE_LOADERS[moduleId];
  if (!loader) throw new Error(`Unknown module: ${moduleId}`);
  return loader();
}

export function isRegisteredModule(moduleId) {
  return MODULE_IDS.includes(moduleId);
}
```

Data files (`rules.json`, `candidates.json`, `evidence.json`, `reference-ranges.json`, `module.json`) are **not** part of this registry — they're plain JSON read with `fs.readFile(path.join(root, 'modules', id, '<file>'))` wherever a script needs them, keyed off `MODULE_IDS`. JSON isn't code, so reading it by constructed path is normal file I/O, not the "dynamic import magic" the roadmap is warning against — that phrase is specifically about `import()`/`require()` with a computed specifier, which is what `MODULE_CODE_LOADERS` exists to avoid doing implicitly.

This single file becomes the one thing every consumer (`validate-kb.mjs`, `build-static.mjs`, `smoke-test.mjs`, `server.mjs`, the new module-load test) imports to know what modules exist — adding a module is a one-line diff to `MODULE_IDS` plus one line to `MODULE_CODE_LOADERS`, both in the same file, trivially reviewable by `council-review` before it ships.

### Q2 — validate-kb.mjs generalization

Wrap the existing body (validate-kb.mjs:10–28) into `validateModule(moduleId, root)`, called once per `MODULE_IDS` entry, errors aggregated with an `${moduleId}/` prefix:

- Read `modules/<id>/rules.json`, `candidates.json`, `evidence.json` directly (JSON, not via `src/evidence.js`) — see the evidence dual-source note below.
- Unchanged per-rule checks: id present, no duplicate ids, `evaluateCondition(rule.when, {})` dry-run, `rule.evidence[]` ids resolve, `rule.output.candidateId` resolves.
- Unchanged per-candidate checks: key/id match, `candidate.evidence[]` ids resolve.
- **New**: `module.json` shape check — `id` field matches the directory name, and (once WP6 lands) required manifest fields are present. For P0-WP5 specifically, keep this check field-presence-only (no `schemas/module-manifest.schema.json` yet — that schema is WP6 scope; see OQ-003).

One simplification falls out of this generalization: today `validate-kb.mjs` imports `EVIDENCE` from `src/evidence.js` (a hand-authored JS object) to check evidence-id references, while `data/evidence.json` is a *separate*, hand-maintained JSON mirror of the same 6 records (confirmed identical field-for-field by inspection) used only by `build-static.mjs` for `evidenceRecordCount`. Per-module validation should read `modules/<id>/evidence.json` as the sole source and stop importing `src/evidence.js` from the validator — this removes a script's dependency on application JS and collapses one instance of the dual-source problem WP1/WP6 need to resolve anyway (flagged as a risk below, not solved here).

Aggregate output: `Validated modules: anemia (91 rules, 26 candidates, 6 evidence records).` — one line per module, non-zero exit if any module has errors.

### Q3 — build-static.mjs generalization and content-hash stamping

Two different generalization strategies apply to two different parts of `build-static.mjs`, and they should stay different:

**Copy + stamp (registry-agnostic, whole-directory).** `directories` (build-static.mjs:9) becomes `['assets', 'src', 'data', 'examples', 'modules']` — `modules/` is copied wholesale via the existing recursive `cp()` (line 15), exactly like `src/` and `examples/` are today. `stampTargets` (lines 37–44) gains `...(await collectFiles(path.join(dist, 'modules')))`. Because `collectFiles` is already a plain recursive walk that includes every file under a directory (lines 18–26), this one array-literal change makes cache-busting cover **any** module added later with zero further edits to `build-static.mjs` — the digest step itself (lines 45–47, `createHash('sha256')` over every stamped file's bytes in `collectFiles`'s sorted order) needs no logic change, only the list of directories fed into it. `data/` keeps being stamped too, because after P0-WP1 moves `rules.json`/`candidates.json`/`evidence.json`/`reference-ranges.json` out, `data/` still holds `algorithm-explainers.json` (client UI copy fetched by `algorithmExplorer.js:570`, not KB content) — it stays where it is; SPIKE-002 does not move it.

**buildInfo.json (registry-driven).** `build-static.mjs`:73–88 currently hard-codes reading `data/rules.json`/`candidates.json`/`evidence.json` for one flat `buildInfo` object. Post-refactor: import `MODULE_IDS, DEFAULT_MODULE_ID` from `src/modules/registry.js`, loop over `MODULE_IDS` reading each `modules/<id>/{rules,candidates,evidence,module}.json`, and emit:

```json
{
  "application": "Pediatric Anemia Diagnosis Aide",
  "releaseVersion": "0.3.1",
  "assetStamp": "…",
  "generatedAt": "…",
  "knowledgeBaseVersion": "0.1.0-2026-07-15",
  "evidenceReviewedThrough": "2026-07-15",
  "ruleCount": 91,
  "diagnosticPatternCount": 26,
  "evidenceRecordCount": 6,
  "modules": {
    "anemia": { "knowledgeBaseVersion": "0.1.0-2026-07-15", "evidenceReviewedThrough": "2026-07-15", "ruleCount": 91, "diagnosticPatternCount": 26, "evidenceRecordCount": 6 }
  }
}
```

Top-level `knowledgeBaseVersion`/`ruleCount`/etc. keep echoing `DEFAULT_MODULE_ID`'s ("anemia") numbers so any existing consumer reading flat fields (the SPA header, any dashboard) is unaffected; `modules.*` is strictly additive.

**Client fetch paths.** `src/app.js:519–520` fetches `./data/rules.json` and `./data/candidates.json` directly (browser-local, no server involved for the static site). Once WP1 moves those files, these two literals must become `./modules/anemia/rules.json` / `./modules/anemia/candidates.json` — hard-coded to the default module, since P0 ships no client-side module switcher. No change to the stamping *regex* is needed: the existing `fetch\('(\.\/[^'?]+\.json)'\)` rewrite (build-static.mjs:67) runs over every `.js` file under `dist/src` regardless of what relative path the fetch call targets, so it will correctly stamp the new `./modules/anemia/...` literals the same way it stamps today's `./data/...` ones.

**On "byte-identical."** The phase-0 go/no-go (roadmap line 141) requires the **assessment JSON output** for all 6 `examples/*.json` to be byte-for-byte identical (modulo `generatedAt`) pre- vs. post-refactor — it does not require the `?v=` hash **string** to stay the same literal value. It cannot: the hash is computed over file bytes *and the order files are concatenated in* (build-static.mjs:45–47), and moving `rules.json` from `dist/data/` to `dist/modules/anemia/` changes which group a file's bytes land in even though the bytes themselves don't change (WP1 is a pure move). Trying to preserve the exact old hash value by re-ordering the digest inputs to "fix" this would be fragile and buys nothing real. What must hold, and does hold under this design, is: (a) the underlying served bytes for `rules.json`/`candidates.json`/`evidence.json`/`reference-ranges.json` are unchanged (confirm via `diff`/`sha256sum` against the pre-refactor files — the move only changes the path); (b) the stamp is still a deterministic pure function of current content (re-running the build against unchanged source reproduces the same hash); (c) any future edit to any file under `dist/src`, `dist/data`, `dist/modules`, or `dist/examples` still changes the stamp (cache-busting still fires) because `collectFiles` still walks all of them. Treat "byte-identical" as: *served asset payloads* identical, *assess() output* identical, *stamp value* free to change once, at the refactor commit, and stable thereafter.

### Q4 — smoke-test.mjs + server.mjs; API surface for moduleId

**server.mjs.** Replace the two hard-coded reads (server.mjs:13–14) with a startup loop over `MODULE_IDS` (imported from `src/modules/registry.js`) building `const modulesById = new Map()`, each entry `{ rules, candidates, evidenceSources, manifest }` read from `modules/<id>/*.json`. Fail fast at process start (not on first request) if any registered module's files are missing or fail `JSON.parse` — a broken module must never come up silently and serve empty results.

**GET /health** — unchanged shape; could optionally report `registeredModules: MODULE_IDS` but that's cosmetic, not required by WP5.

**GET /api/v1/knowledge-base** — add an optional `?moduleId=` query param. Absent → today's exact behavior, computed from `modulesById.get(DEFAULT_MODULE_ID)` (byte-identical response shape to today, since `DEFAULT_MODULE_ID = 'anemia'` is the only module and its data is byte-identical post-move). Present and registered → same shape scoped to that module. Present and unregistered → `400 { error: 'Unknown module: <id>' }`, matching the existing error-handling pattern already used for bad paths (server.mjs:123–126). Additionally emit a sibling `modules: { anemia: { ruleCount, diagnosticPatternCount, evidenceRecordCount, knowledgeBaseVersion } }` key in the unscoped (no `?moduleId=`) response so a future multi-module client can discover what's registered without hard-coding ids — additive, doesn't change any existing field.

**POST /api/v1/assess** — accept an optional `moduleId` field in the JSON body (sits alongside `patient`/`cbc`/etc., not a wrapper) or `?moduleId=` query param (body field takes precedence if both given); default `DEFAULT_MODULE_ID` when neither is present, so every existing caller (smoke-test, the SPA, any external integration) keeps working unchanged. Look up `modulesById.get(moduleId)`; `404`-vs-`400`: use `400 { error: 'Unknown module: <id>' }` (client error, not "resource not found," consistent with the knowledge-base endpoint). Call `assess(input, moduleId, modulesById.get(moduleId))` once P0-WP3's generalized engine signature exists (see OQ-002 for what to do if WP5 lands first). Echo `moduleId` back inside the response's existing `meta` block (`src/engine.js:57` already returns a `meta` object with `engine`, `knowledgeBaseVersion`, etc. — add `moduleId` there) so a caller can confirm which module actually served the request.

**smoke-test.mjs.** Keep every existing assertion (smoke-test.mjs:35–56) exactly as-is and unscoped — this is the anti-regression backbone proving the *default-module, no-moduleId* path still behaves identically. Add a second block that loops `for (const moduleId of MODULE_IDS)` and, per module: `GET /api/v1/knowledge-base?moduleId=<id>` returns 200 with `ruleCount > 0`, and re-runs the `POST /api/v1/assess` call from the existing test but with `moduleId` set explicitly in the body, asserting the response is `deepEqual` (modulo `meta.generatedAt`) to the unscoped call's response — proving the explicit-id path and the default path agree. For P0 this loop body executes once (only `anemia` is registered), which is exactly the point: it proves the plumbing now, while there's still only one module to prove it against, so P2's `modules/cbc/` registration doesn't have to discover smoke-test gaps for the first time under schedule pressure.

### Q5 — Module-load test design

New file `tests/module-registry.test.mjs`, run under the existing `node --test tests/*.test.mjs` (`package.json`:10 — no new script needed, the glob already picks it up). Assertions:

1. **Registry completeness.** `MODULE_IDS` is a non-empty array of unique strings; `MODULE_IDS.includes(DEFAULT_MODULE_ID)`; `DEFAULT_MODULE_ID === 'anemia'` for P0 specifically (this last assertion is meant to be deleted/updated the day a second module is registered — it's a deliberate tripwire, not a permanent invariant).
2. **Manifest shape.** For every id in `MODULE_IDS`: `modules/<id>/module.json` exists, parses as JSON, and `manifest.id === id`. Field-presence checks only for P0 (no `schemas/module-manifest.schema.json` to validate against yet — WP6 scope; see OQ-003).
3. **Per-module KB files present and parseable.** For every id: `rules.json`, `candidates.json`, `evidence.json`, `reference-ranges.json` under `modules/<id>/` all exist and `JSON.parse` without throwing. (Deliberately duplicates a slice of what `validate-kb.mjs` checks — this is a fast structural smoke check that runs inside `npm test`, `validate-kb` is a separate, deeper `npm run validate` gate; both stay, per the existing 4-gate `npm run check` composition.)
4. **Code loader resolves.** `await loadModuleCode(id)` does not throw, and the resolved module's default/named export matches the `facts.<id>.js` contract from P0-WP2 (minimally: exports a `deriveFacts` function). This is the actual "module-load" assertion — it proves every id in `MODULE_CODE_LOADERS` has real, loadable code behind it, catching a typo'd path or a missing file at `npm test` time instead of on the first real request.
5. **Existing regression anchor untouched.** `tests/engine.test.mjs`'s 6 worked-example assertions (lines 42–101) keep running unmodified — the module-load test is additive, never a replacement for the per-example clinical-output checks.

### Q6 — Byte-for-byte gate, run in practice

Golden-master pattern, captured once *before* refactor code lands and kept as a permanent regression fixture (not a one-time branch-diff):

1. On `main`, before any P0 code changes: for each of the 6 `examples/*.json`, run `assessPediatricAnemia(input, rules, candidates)` with today's engine, scrub `meta.generatedAt` (same pattern already used in `tests/engine.test.mjs:99`), and write the result to `tests/fixtures/golden/<example>.json`. Commit this as the P0 kickoff commit — it's the frozen "before" state.
2. Author the WP1–WP5 refactor on a branch.
3. Add `tests/golden-equivalence.test.mjs`: for each `examples/*.json`, run it through the **post-refactor** call path (`assess(input, 'anemia')` once WP3 lands, or `assessPediatricAnemia` if WP5 is exercised standalone — see OQ-002), scrub `generatedAt`, `assert.deepEqual` against the matching `tests/fixtures/golden/<example>.json`. This becomes a standing member of `npm test`, so WP2/WP3/WP4's *later* changes are caught by the same fixture, not just once at P0 merge.
4. Command sequence for the actual go/no-go: `npm test` (10 existing + module-registry + golden-equivalence tests) → `npm run validate` → `npm run build` → `npm run smoke` — i.e. exactly `npm run check` (`package.json`:13), now covering the new assertions with no new top-level script. No-go if any of the 6 goldens mismatch, if `MODULE_IDS`/manifest/loader assertions fail, or if smoke's per-module loop fails.
5. Separately, for the *build output* (not engine JSON): confirm the underlying KB bytes moved without mutation — `diff <(git show main:data/rules.json) modules/anemia/rules.json` (and the same for `candidates.json`, `evidence.json`, `reference-ranges.json`) must report no differences. This is a one-time check at the WP1 move commit, not a standing test (once WP1 has landed and the fixtures are frozen, `git mv` history plus the golden-equivalence test cover it going forward).

---

## Recommended design (summary)

| File | Change |
|---|---|
| `src/modules/registry.js` (new) | `MODULE_IDS`, `DEFAULT_MODULE_ID`, `loadModuleCode(id)` via a literal `MODULE_CODE_LOADERS` map. Single source of truth for enumeration; imported by every consumer below. |
| `scripts/validate-kb.mjs` | Wrap body in `validateModule(id, root)`, loop `MODULE_IDS`, read `modules/<id>/*.json` directly (drop the `src/evidence.js` import), add manifest field-presence check. |
| `scripts/build-static.mjs` | `directories` += `'modules'`; `stampTargets` += `collectFiles(dist/modules)` (digest logic untouched); `buildInfo` loops `MODULE_IDS` and adds a `modules` map, top-level fields keep echoing `DEFAULT_MODULE_ID`. `src/app.js` fetch literals move from `./data/{rules,candidates}.json` to `./modules/anemia/{rules,candidates}.json` (auto-stamped by the existing regex, no regex change). |
| `scripts/smoke-test.mjs` | Existing default-module assertions unchanged; add a `for (const moduleId of MODULE_IDS)` loop asserting the explicit-id path agrees with the default path. |
| `server.mjs` | Startup loop builds `modulesById` from `MODULE_IDS`, fail-fast on any bad module. `GET /api/v1/knowledge-base` and `POST /api/v1/assess` accept optional `moduleId` (query param or body field), default `DEFAULT_MODULE_ID`; unknown id → `400`. Response `meta.moduleId` added. |
| `tests/module-registry.test.mjs` (new) | Registry completeness, manifest shape, per-module file parseability, code-loader resolution. |
| `tests/golden-equivalence.test.mjs` (new) | Golden-master diff of all 6 examples against fixtures frozen before the refactor. |

## Alternatives considered

- **Directory scan of `modules/`** instead of an explicit registry — rejected (Q1): activates half-built module directories, needs an ad hoc sort for determinism, and still needs `module.json` as a second registration signal, so it doesn't actually remove a step.
- **Fully dynamic `import(`../../modules/${id}/facts.${id}.js`)`** built from `MODULE_IDS` at call time — rejected: this is precisely the "dynamic import magic" the roadmap calls out avoiding; a literal per-id entry in `MODULE_CODE_LOADERS` is one line more per module but keeps every loadable path grep-able and statically analyzable.
- **Preserve the exact pre-refactor `?v=` hash value** by special-casing the digest order — rejected (Q3): not achievable across a real file move without fragile path-remapping hacks, and not actually required by the stated gate (assess() output equivalence, not hash-string equality).
- **Keep `assessPediatricAnemia` as the only entry point and bolt `moduleId` on as a second positional arg that's ignored** — rejected: papering over WP3's generalized `assess(input, moduleId)` with a fake parameter in WP5 would create two competing "the generalized signature" stories; better to sequence server.mjs's assess-call generalization after WP3 lands (OQ-002).

## Risks & open questions

- **OQ-001 — Evidence dual-source.** `src/evidence.js` (JS, hand-authored `EVIDENCE` object + `KNOWLEDGE_BASE_VERSION`/`REVIEWED_THROUGH`) and `data/evidence.json` (JSON mirror of the same 6 records) are two independently maintained copies of the same facts today. This spike routes validate-kb off the JSON copy going forward, which shrinks the blast radius, but does not eliminate the duplication — `src/engine.js` still imports `KNOWLEDGE_BASE_VERSION`/`REVIEWED_THROUGH` from `src/evidence.js` directly. P0-WP6 ("move `KNOWLEDGE_BASE_VERSION`/`REVIEWED_THROUGH` from `evidence.js` into `module.json`") is the natural place to finish collapsing this to one source; flag for the WP6 executor rather than solving here.
- **OQ-002 — WP5/WP3 sequencing.** The roadmap seed marks `P0-WP5.depends_on = ["P0-WP1"]` only, but `server.mjs`'s `POST /api/v1/assess` generalization needs P0-WP3's `assess(input, moduleId)` signature to be genuinely module-generic rather than a moduleId parameter bolted onto `assessPediatricAnemia`. Recommend treating WP3 as a practical (soft) prerequisite for the server.mjs/smoke-test slice of WP5 even though the formal dependency graph doesn't require it — sequence server.mjs's changes after WP3 lands, or land WP1/WP2/WP4/validate-kb/build-static first and hold server.mjs+smoke-test for last within WP5.
- **OQ-003 — Manifest schema timing.** WP5's module-load test wants to assert "manifest shape," but `schemas/module-manifest.schema.json` doesn't exist until WP6 (roadmap appendix lists it under P1, not P0). Recommendation: ship WP5's manifest check as field-presence-only against a hand-written shape check, and have WP6 either add the formal schema (test upgrades to schema validation then) or confirm field-presence is sufficient for P0's scope.
- **Risk — stamp-order churn is a one-time, not recurring, event.** Anyone diffing `build-info.json`'s `assetStamp` across the P0 refactor commit will see it change even though no clinical content changed; call this out explicitly in the PR description so it isn't mistaken for a regression during `council-review`.
- **Risk — client (`app.js`) module hard-coding.** P0 ships no module switcher; `app.js` hard-codes `DEFAULT_MODULE_ID`'s paths. This is intentional and in-scope-sized for P0, but is a marker for whichever later phase (P2, when `modules/cbc/` goes live) adds client-side module selection — that phase will need to revisit `app.js`'s fetch literals again, this time behind a real UI control.

## Implications for P0-WP5 and the V2 technical exit gate

- WP5's four file targets (`scripts/validate-kb.mjs`, `scripts/build-static.mjs`, `scripts/smoke-test.mjs`, `server.mjs`) plus `tests/` each get a bounded, mechanical diff per the table above; none require touching `src/ruleEngine.js`, rule content, or candidate content, so "zero clinical behavior change" holds by construction (no clinical file is in this spike's change set).
- The V2 gate ("`npm run check` green + module-loader tests + anemia output byte-equivalent for all 6 examples," roadmap line 490) is satisfied by: `npm run check` unchanged in invocation (`package.json`:13) now exercising two new test files; `tests/module-registry.test.mjs` is the "module-loader tests" the gate names; `tests/golden-equivalence.test.mjs` against frozen fixtures is the "byte-equivalent" check, scoped correctly to assess() output rather than the cache-bust hash string (Q3 finding).
- Recommend sequencing within WP5 as: registry file + validate-kb + build-static first (no server/API surface decisions needed), then server.mjs + smoke-test last, ideally after WP3 lands (OQ-002), then the two new test files land alongside whichever of the above they exercise.
- Before coding, this design should go through the `council-review` architecture-pre-code gate the roadmap already calls for on P0 (line 146) — the moduleId API surface (query param vs. body field, `400` on unknown module, `meta.moduleId` echo) is a genuine, if small, product-facing decision worth a second look before it ships.
