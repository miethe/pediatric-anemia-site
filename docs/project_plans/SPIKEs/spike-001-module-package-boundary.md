---
schema_version: 2
doc_type: spike
title: "SPIKE-001: Module-Package Boundary + Fact-Derivation Registry Design"
status: completed
created: 2026-07-17
feature_slug: platform-foundation-p0
research_questions:
  - "What is the exact modules/anemia/ package layout and module.json manifest shape?"
  - "How does the fact registry split core vs module-specific derivation, and what is the registration mechanism?"
  - "What is the assess(input, moduleId) signature, the module hook contract, and what stays in engine.js core?"
  - "How is the reference-range registry keyed by (module, analyte, age, sex) while preserving AAP-fallback/local-override semantics?"
  - "How do we prove byte-for-byte output equivalence for all 6 examples/ across the refactor?"
complexity: M
estimated_research_time: 3h
---

# SPIKE-001: Module-Package Boundary + Fact-Derivation Registry Design

Gates Phase 0 (roadmap `docs/project_plans/expansion/01-platform-expansion-roadmap.md` lines 121–146,
seed §E lines 486–500, file map lines 590–610). Covers P0-WP1, WP2, WP3, WP4, WP6. **P0-WP5
(multi-module loader for scripts/server + cache-busting) is SPIKE-002's scope**; this spike only notes
where WP1's layout constrains it.

## Critical cross-cutting finding (read first)

`src/facts.js`, `src/engine.js`, `src/evidence.js`, `src/referenceRanges.js` are not only Node-side
modules — **they are imported directly by the browser**, unbundled: `index.html:583` loads
`<script type="module" src="./src/app.js">`; `src/app.js` imports `assessPediatricAnemia` from
`./engine.js` and `EVIDENCE, KNOWLEDGE_BASE_VERSION` from `./evidence.js`, and `fetch()`es
`./data/rules.json`/`./data/candidates.json` itself, passing them as explicit args — no build-time
bundling exists. `src/algorithmExplorer.js` likewise imports `deriveFacts` from `./facts.js` and
`assessPediatricAnemia` from `./engine.js`. `scripts/build-static.mjs` copies `src/`/`data/`/`examples/`
verbatim into `dist/` and regex-stamps `?v=<hash>` only onto `.js` static imports and `fetch('...json')`
calls (lines 62–71) — it does not bundle.

Consequences that drove every decision below:

1. **No `node:fs` and no static JSON module imports** (`import x from './y.json'`) anywhere in
   `src/**`/`modules/**` code the browser also loads — cross-browser support for JSON import
   attributes is unverified, and such an import would silently bypass the cache-busting regex above,
   reopening the stale-KB-behind-fresh-UI class of bug commit `98f7ce5` fixed. All KB JSON stays
   caller-loaded (`fetch()` in browser, `readFile()` in Node), exactly as today.
2. **`npm run check` never executes browser JS** — `scripts/smoke-test.mjs` only checks HTTP 200 and a
   few regex matches on served files. A broken import path in `src/app.js`/`src/algorithmExplorer.js`
   would not fail the gate, and neither file is in any P0 work-package's file list. The only safe
   strategy: **every currently-imported path and exported name from `src/facts.js`, `src/engine.js`,
   `src/evidence.js`, `src/referenceRanges.js` keeps working unchanged** — real logic moves into
   `modules/anemia/`, `src/facts/`, `src/ranges/`, and the old paths become thin re-export shims. This
   is the load-bearing decision of this spike.

---

## Findings by research question

### RQ1 — `modules/anemia/` package layout + `module.json` shape

What actually consumes each `data/*.json` file today:

| File | Consumed by | Notes |
|---|---|---|
| `rules.json` (91 rules) | `server.mjs`, `build-static.mjs`, `validate-kb.mjs`, `engine.test.mjs`, `app.js` (fetch) | Passed as explicit arg everywhere; never read internally by engine code. |
| `candidates.json` (26 patterns) | same call sites | Same explicit-arg pattern. |
| `evidence.json` | `build-static.mjs` only, for `build-info.json` counts | **Not** the runtime evidence source — `src/evidence.js`'s hardcoded `EVIDENCE` object is what `evidenceFor()` and citations actually use. This JSON is a parallel, unverified mirror. |
| `reference-ranges.json` | **nobody** (zero JS/mjs importers found) | Dead data — `src/referenceRanges.js` hardcodes an identical `RANGES` array instead. P0-WP4 is the first time this file becomes load-bearing. |
| `algorithm-explainers.json` (36K) | `algorithmExplorer.js:570` via `fetch()` | UI explainer content, not part of the rule/candidate/evidence/range KB; **not** in the WP1 file list. |

Recommended layout (moved files are byte-identical `git mv` relocations, per the decisions-block's
Risk 3 mitigation):

```
modules/anemia/
  module.json            # NEW — manifest stub (WP6)
  index.js                # NEW — pure-code module descriptor
  facts.anemia.js         # domain fact derivation, moved out of src/facts.js (WP2)
  ranges.js                # registers band tables + ferritin-threshold rule (WP4)
  rules.json               # git mv data/rules.json (WP1)
  candidates.json          # git mv data/candidates.json (WP1)
  evidence.json            # git mv data/evidence.json (WP1) — still a non-authoritative mirror in P0
  reference-ranges.json    # git mv data/reference-ranges.json (WP1) — becomes load-bearing via WP4
data/
  algorithm-explainers.json  # STAYS — see OQ-1
```

`module.json` (unsigned stub; field names forward-compatible with the signed manifest in
`docs/architecture.md` §6):

```json
{
  "id": "anemia", "title": "Pediatric Anemia", "schemaVersion": 1, "status": "unsigned-stub",
  "knowledgeBaseVersion": "0.1.0-2026-07-15", "evidenceReviewedThrough": "2026-07-15",
  "engineLabel": "Pediatric Anemia Deterministic CDSS",
  "supportedAgeMonths": { "min": 6, "max": 216 },
  "clinicalContentHash": null, "approvedBy": [], "validationRunId": null,
  "supersedes": null, "releasedAt": null
}
```

The null fields exist so P1's signed-manifest work fills them in without a shape migration.
`knowledgeBaseVersion`/`evidenceReviewedThrough` must byte-match `src/evidence.js`'s exported consts
(RQ3) — `validate-kb.mjs` gets a new drift check (see Implications/WP6).

### RQ2 — Fact-registry API and core/module split

`src/facts.js` (365 lines) is almost entirely anemia-domain logic — CBC/ferritin/retic/hemolysis/lead/
smear/marrow derivation. The only genuinely generic, reusable pieces are six one-line primitives at the
top: `finite`, `num`, `isTrue`, `statusIs`, `includes`, `countTrue`. Everything else in `deriveFacts()`
has no reuse claim today. **Do not manufacture a bigger "core" than this** — a future CBC module (P2)
may promote more helpers upward, but inventing shared shape now would be scope creep against the
zero-behavior-change mandate.

`src/facts/core.js` exports those six primitives (pure, stateless, zero imports). Registration is an
**explicit static-import registry** — no `import()`, no directory scanning:

```js
// src/facts/registry.js
import { deriveFacts as deriveAnemiaFacts } from '../../modules/anemia/facts.anemia.js';
const REGISTRY = new Map([['anemia', deriveAnemiaFacts]]);
export function deriveFacts(input, moduleId) {
  const derive = REGISTRY.get(moduleId);
  if (!derive) throw new Error(`Unknown module: ${moduleId}`);
  return derive(input);
}
```

`modules/anemia/facts.anemia.js` is today's `deriveFacts` body, importing from `../../src/facts/core.js`
and `../../src/ranges/registry.js` (RQ4) instead of `./referenceRanges.js`. It keeps a single-arg
signature `deriveFacts(rawInput)` so it plugs directly into `modules/anemia/index.js`'s `deriveFacts`
hook without indirection.

### RQ3 — Engine generalization: `assess(input, moduleId, rules, candidates)`

The roadmap's shorthand `assess(input, moduleId)` can't be the literal signature: rules/candidates JSON
is always caller-loaded (browser `fetch()`, Node `readFile()` — see cross-cutting finding), so `assess()`
has no environment-agnostic way to pull KB content itself. The signature that satisfies "generalize
`assessPediatricAnemia`" **and** requires zero edits to `server.mjs`/`src/app.js` in P0-WP3 is the old
signature with one positional insertion:

```js
// src/engine.js
import { runRules } from './ruleEngine.js';
import { getModule } from './modules/registry.js';

const CORE_LIMITATIONS = [ /* today's 4 module-agnostic boilerplate strings, unchanged, same order */ ];

export function assess(input, moduleId, rules, candidates) {
  if (!Array.isArray(rules)) throw new TypeError('rules must be an array');
  const module = getModule(moduleId);
  const facts = module.deriveFacts(input);
  const ruleOutput = runRules(facts, rules, candidates);
  return {
    meta: { engine: module.manifest.engineLabel, knowledgeBaseVersion: module.manifest.knowledgeBaseVersion,
      evidenceReviewedThrough: module.manifest.evidenceReviewedThrough, generatedAt: new Date().toISOString(),
      intendedUser: 'Licensed health care professional', status: 'Research prototype—not clinically validated' },
    classification: module.summarize(facts),
    alerts: ruleOutput.alerts, rankedDifferential: ruleOutput.candidates,
    nextQuestions: ruleOutput.questions, interpretiveNotes: ruleOutput.notes,
    limitations: [...CORE_LIMITATIONS, ...module.limitations(facts)],
    provenance: { evaluatedRuleCount: ruleOutput.audit.length,
      matchedRuleIds: ruleOutput.audit.filter((e) => e.matched).map((e) => e.ruleId),
      ruleAudit: ruleOutput.audit },
  };
}

// Back-compat shim — server.mjs/app.js/algorithmExplorer.js/engine.test.mjs need zero edits in P0.
export function assessPediatricAnemia(input, rules, catalog) {
  return assess(input, 'anemia', rules, catalog);
}
```

`module.manifest` is a small **inline JS object literal** inside `modules/anemia/index.js` (mirroring,
not fetching, `module.json`) — see OQ-3 for why the two must stay in sync via a validator check rather
than one importing the other.

**Hook contract** (`modules/anemia/index.js` default export):

```js
export default {
  id: 'anemia',
  manifest: { engineLabel, knowledgeBaseVersion, evidenceReviewedThrough }, // literal, WP6-owned
  deriveFacts,   // (input) => facts
  summarize,     // (facts) => classification — today's classificationSummary(), moved verbatim
  limitations,   // (facts) => string[] — today's globalLimitations() minus the 4 boilerplate lines
};
```

**What stays in `src/engine.js` core:** orchestration (`assess`), `CORE_LIMITATIONS`, `meta`
construction, `provenance` construction. **No additional "ranking merge" hook is needed in P0** —
`ruleEngine.js`'s `LEVEL_RANK`/`ALERT_RANK` enums and `mergeCandidate()` are already module-agnostic
(verified: `schemas/rule.schema.json` and `schemas/candidate.schema.json` contain zero anemia-specific
literals). Future modules reuse the same `level`/`severity` vocabulary; `ruleEngine.js` genuinely needs
no P0 change, confirming the roadmap's "keep as-is" call.

`src/modules/registry.js` is the explicit static-import registry `engine.js` depends on:

```js
// src/modules/registry.js
import anemia from '../../modules/anemia/index.js';
const REGISTRY = new Map([[anemia.id, anemia]]);
export function getModule(id) {
  const module = REGISTRY.get(id);
  if (!module) throw new Error(`Unknown module: ${id}`);
  return module;
}
export function listModules() { return [...REGISTRY.values()]; }
```

Pure code, no JSON, no fs — safe to import from `engine.js` (server+browser) and, later, from
`scripts/*.mjs`/`server.mjs` for P0-WP5's module iteration; `listModules()` is the seam SPIKE-002
should build on.

### RQ4 — Reference-range registry: `(module, analyte, age, sex)`

Today's `getEffectiveRanges(input)` returns one combined object built by a `pick(key)` closure doing
local-override-then-fallback per key. `getFerritinThreshold(ageMonths, menstruating)` is a **separate,
non-banded** lookup — a flat cutoff gated on a `menstruating` boolean (not `sexAtBirth`), no lower/upper
pair. It cannot be squeezed into an (age, sex) band table without distorting its selection logic, so the
registry needs two related primitives:

```js
// src/ranges/registry.js
const BAND_TABLES = new Map();      // `${moduleId}:${analyte}` -> bands[]
const THRESHOLD_RULES = new Map();  // `${moduleId}:${analyte}` -> (context) => {value, source, rationale} | null

export function registerAnalyteBands(moduleId, analyte, bands) { BAND_TABLES.set(`${moduleId}:${analyte}`, bands); }
export function registerThresholdRule(moduleId, analyte, rule) { THRESHOLD_RULES.set(`${moduleId}:${analyte}`, rule); }

export function getBuiltInAnalyteValue(moduleId, analyte, ageMonths, sexAtBirth) {
  if (!Number.isFinite(ageMonths) || !['female', 'male'].includes(sexAtBirth)) return null;
  const band = BAND_TABLES.get(`${moduleId}:${analyte}`)
    ?.find((b) => ageMonths >= b.minMonths && ageMonths < b.maxMonthsExclusive);
  if (!band) return null;
  return { ...band[sexAtBirth], ageBand: band.label, source: band.source, isFallback: true };
}

export function getThreshold(moduleId, analyte, context) {
  return THRESHOLD_RULES.get(`${moduleId}:${analyte}`)?.(context) ?? null;
}
```

`getBuiltInAnalyteValue` is genuinely keyed on the 4-tuple per the roadmap. `modules/anemia/ranges.json`
(moved unchanged from `data/reference-ranges.json`) is loaded by the caller and its combined-band
entries are unpacked into three analyte tables (`hb`, `mcv` — carrying `mcvLower`/`mcvUpper` together,
`rdw`) via `registerAnalyteBands('anemia', 'hb', ...)` etc. `modules/anemia/ranges.js` also calls
`registerThresholdRule('anemia', 'ferritin', ...)` with today's `getFerritinThreshold` body unchanged.

To preserve the exact call site in `facts.anemia.js` (`const ranges = getEffectiveRanges(input)` →
`{hbLower, mcvLower, mcvUpper, rdwUpper, provenance}`), `modules/anemia/ranges.js` exports a
**composition wrapper** — not the generic registry directly — that calls the per-analyte primitives
three times via the same local-override-then-AAP-fallback `pick()` logic and reassembles today's shape,
including the `provenance` field shape, verbatim.

`src/referenceRanges.js` becomes a compat shim re-exporting `getBuiltInRange`/`getEffectiveRanges`/
`getFerritinThreshold`/`REFERENCE_RANGE_SOURCE`/`BUILT_IN_RANGES` bound to `'anemia'`, so
`tests/engine.test.mjs:5`'s `import { getBuiltInRange } from '../src/referenceRanges.js'` needs no edit.

### RQ5 — Byte-for-byte equivalence strategy

Resolves the decisions-block's OQ-3 (`tests/golden/` vs on-the-fly regeneration): **commit fixtures,
add a permanent test.**

1. **Capture now, before any WP1 code moves**: for each of the 6 `examples/*.json` files, run today's
   `assessPediatricAnemia(input, rules, candidates)`, scrub `meta.generatedAt` (same pattern as
   `engine.test.mjs:99`), and write to `tests/golden/<example-name>.json`. A one-off
   `scripts/capture-golden.mjs` does this and stays in the repo so a future *governed* KB content
   change can regenerate the baseline deliberately, with the diff itself serving as change evidence.
2. **Add `tests/module-equivalence.test.mjs`** (auto-discovered by `npm test`'s existing
   `node --test tests/*.test.mjs` glob — no `package.json` change) that calls
   `assess(input, 'anemia', rules, candidates)` per example, scrubs the same way, and
   `assert.deepEqual`s against the golden fixture.
3. **Determinism is already structurally guaranteed**: `Array.prototype.sort` is stable (ES2019,
   within the Node ≥20 floor) and `Map` iteration is insertion order — no nondeterminism exists in
   `ruleEngine.js` today.
4. Every phase in the decisions-block (P1–P7) re-runs this test as its exit gate, matching the
   roadmap's V2 go/no-go criterion verbatim.
5. **Scope boundary**: this covers only the assessment JSON. Static-build byte-compare (asset hashes,
   `dist/` output) is SPIKE-002/P0-WP5's concern — noted so the two don't silently overlap or gap.

---

## Recommended design — full file tree

```
src/
  facts.js                 # SHIM: export { deriveFacts } from '../modules/anemia/facts.anemia.js'
  facts/core.js             # NEW — finite/num/isTrue/statusIs/includes/countTrue
  facts/registry.js         # NEW — deriveFacts(input, moduleId) explicit Map dispatch
  engine.js                  # assess(input, moduleId, rules, candidates) + assessPediatricAnemia() shim
  evidence.js                 # unchanged exports — see Implications/WP6
  referenceRanges.js          # SHIM: re-exports from src/ranges + modules/anemia/ranges.js, bound to 'anemia'
  ranges/registry.js           # NEW — registerAnalyteBands/registerThresholdRule/getBuiltInAnalyteValue/getThreshold
  ruleEngine.js                 # UNCHANGED (already module-agnostic)
  modules/registry.js            # NEW — getModule(id)/listModules(), explicit static import of modules/anemia
  app.js, algorithmExplorer.js     # UNCHANGED — zero edits required in P0
modules/anemia/
  module.json                # NEW — manifest stub (WP6)
  index.js                    # NEW — { id, manifest, deriveFacts, summarize, limitations }
  facts.anemia.js              # domain fact derivation (moved from src/facts.js body)
  ranges.js                     # registers bands/threshold + composition wrapper (moved from src/referenceRanges.js body)
  rules.json, candidates.json, evidence.json, reference-ranges.json   # git mv from data/
data/
  algorithm-explainers.json    # unchanged location
tests/
  golden/*.json                # NEW — 6 scrubbed baseline outputs, committed
  module-equivalence.test.mjs  # NEW
  engine.test.mjs               # UNCHANGED
```

---

## Alternatives considered

- **Static JSON import (`with { type: 'json' }`) inside module descriptors**, for a true 2-arg
  `assess(input, moduleId)`. Rejected: unverified cross-browser support, and it escapes
  `build-static.mjs`'s cache-busting regex, reopening the bug class commit `98f7ce5` fixed.
- **Dynamic `import()` by moduleId string** for the registry. Rejected: violates the task's "no dynamic
  magic" constraint and breaks static analyzability for the regex-based stamping.
- **One combined `getRange(module, analyte, ageMonths, sex)` that also handles ferritin** by treating
  "menstruating" as a pseudo-sex value. Rejected: would distort `getFerritinThreshold`'s actual
  selection logic to fit a shape it doesn't have — silent threshold-drift risk.
- **Collapsing `src/evidence.js`'s `EVIDENCE` object into `modules/anemia/evidence.json`** now. Deferred:
  the roadmap assigns evidence-content-to-schema conversion to P1-WP3 ("exact-passage schema"); doing it
  early would rewrite `evidenceFor()`'s consumers ahead of that schema and hits the same JSON-import
  portability question for a browser-loaded file.

---

## Risks & open questions

- **OQ-1** (new): `algorithm-explainers.json` is UI content, not KB content, and isn't in the WP1 file
  list — recommend leaving it at `data/` unmoved for P0. Revisit at P2 (CBC suite) for per-module
  namespacing.
- **OQ-2** (new — resolves decisions-block OQ-2): recommend `POST /api/v1/assess` takes **no** `moduleId`
  field in P0; `server.mjs` keeps calling the `assessPediatricAnemia` shim implicitly bound to `'anemia'`.
  A request-body `moduleId` field is Phase 1+ scope.
- **OQ-3** (new — manifest/const duplication): `module.json`'s version fields and `src/evidence.js`'s
  exported consts are **two sources for one fact** in P0, because browser-loaded `evidence.js` needs
  synchronous access and JSON-importing `module.json` hits the same portability risk flagged above.
  Mitigation: `validate-kb.mjs` gets a new check asserting the two match byte-for-byte; true unification
  waits for P1's signed-manifest loading mechanism. Flagged explicitly, not silently accepted.
- **OQ-4** (new — resolves decisions-block OQ-4): `examples/` stays top-level in P0, not moved into
  `modules/anemia/examples/` — it's a static `dist/examples/` path `app.js` fetches directly and isn't in
  the WP1 file list. Revisit at P2 when a second module's examples would otherwise collide.
- **Risk**: `app.js`/`algorithmExplorer.js` breakage from an import-path change is invisible to
  `npm run check` (cross-cutting finding). The shim strategy eliminates the need for any edit to those
  files in P0 — but any future phase that does touch them should add a real headless-browser smoke
  check, since none exists today.
- **Risk**: `modules/` living outside `src/` means `build-static.mjs`'s `directories` copy list
  (`['assets','src','data','examples']`) must add `'modules'`, and its stamping loop (currently walks
  only `dist/src`) must also walk `dist/modules`. Squarely SPIKE-002/P0-WP5 territory — flagged as a
  hard dependency, not solved here.

---

## Implications per work package

- **P0-WP1**: adopt the file tree verbatim. Moves are `git mv` only (empty content diff on
  `rules.json`/`candidates.json`/`evidence.json`/`reference-ranges.json`) plus three new files
  (`module.json`, `index.js`, and `facts.anemia.js`/`ranges.js` which move-with-import-updates).
  `data/algorithm-explainers.json` explicitly out of scope (OQ-1).
- **P0-WP2**: create `src/facts/core.js` (6 primitives), `src/facts/registry.js` (explicit Map),
  `modules/anemia/facts.anemia.js` (today's `deriveFacts` body, imports adjusted); `src/facts.js` becomes
  a 1-line re-export shim. Same function body, same import-graph shape, different file boundaries.
- **P0-WP3**: `assess(input, moduleId, rules, candidates)` — not the roadmap's literal 2-arg shorthand,
  per RQ3's caller-loaded-JSON finding. `assessPediatricAnemia` becomes a 1-line shim; `server.mjs` needs
  zero edits in P0. `ruleEngine.js` genuinely needs no change (confirmed via schema inspection).
- **P0-WP4**: `src/ranges/registry.js` holds the generic band primitive plus a separate threshold-rule
  primitive (ferritin doesn't fit the band shape — RQ4). `modules/anemia/ranges.js` registers anemia's
  bands/threshold and exports the composition wrapper reproducing today's shape exactly.
  `data/reference-ranges.json` goes from dead data to load-bearing — worth calling out in the PR
  description as a genuine change, even though values are byte-identical to the array they replace.
- **P0-WP6**: `modules/anemia/module.json` per the shape above. `src/evidence.js` keeps its two version
  consts unchanged (browser sync-access requirement) but `validate-kb.mjs` gains a drift check against
  `module.json` (OQ-3) — flag as an addition to WP6's scope, or a joint WP6/WP5 line item, when the
  implementation plan is authored.
