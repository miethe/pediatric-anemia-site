---
schema_version: 2
doc_type: spike
title: "SPIKE-004: UCUM Unit Handling and Mismatch Rejection"
status: completed
created: 2026-07-19
completed: 2026-07-19
feature_slug: wave0-safety-foundation
research_questions:
  - "Reject vs. convert — at which pipeline boundary is a unit mismatch detected: schema validation, fact derivation, or range lookup?"
  - "What is the minimal UCUM subset needed for CBC/ferritin analytes?"
  - "Do we take a UCUM dependency or hand-roll a closed unit table, given the repo has zero dependencies today?"
  - "How do we handle input that omits units entirely — implicit-default or rejection?"
  - "What error shape does the API return, and how does the browser SPA surface it without losing clinician work?"
  - "How does FHIR Observation UCUM alignment constrain the chosen unit representation?"
complexity: L
estimated_research_time: "5h"
related_documents:
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
  - docs/architecture.md
  - .claude/worknotes/wave0-safety-foundation/repo-current-state.md
---

# SPIKE-004: UCUM Unit Handling and Mismatch Rejection

Gates **Phase 1** (P1-WP2, roadmap `docs/project_plans/expansion/01-platform-expansion-
roadmap.md:159`). **No P0 deferred-item design spec exists for units** — none of the 8 `docs/
project_plans/design-specs/*.md` files address unit handling; this is genuinely greenfield,
anchored only by `docs/architecture.md` §8 and §10 and the roadmap's P1-WP2 line. State this
explicitly rather than force a citation that doesn't exist.

## Problem statement

`docs/architecture.md` §8 states FHIR mapping "should reject unit mismatches rather than silently
convert ambiguous values" (`:165`), and §10's fail-closed contract requires failing closed "when
reference units are absent or incompatible" (`:182`). **Zero unit representation exists in code
today**: `patient-input.schema.json`'s `"description": "g/dL"` etc. fields (`cbc.hemoglobin:23`,
`cbc.mcv:24`, `cbc.rdw:25`, `cbc.rbc:26`, `cbc.wbc:27`, `cbc.anc:28`, `cbc.platelets:29`,
`labs.ferritin:71`, `labs.stfrFerritinIndex:77`, `labs.bloodLeadLevel:82`) are JSON Schema
doc-strings only — never validated or compared (repo-current-state.md §B). `src/ranges/
registry.js`'s `getBuiltInAnalyteValue`/`getThreshold` (`:31-56`) return `null` for an unregistered
`(moduleId, analyte)` pair and never throw (`:12-13` doc comment) — today's tolerant-null pattern
is the opposite of fail-closed and is exactly what this SPIKE's unit-mismatch path must not inherit
for the unit-check case specifically.

## Scope

**In scope**: the ~10 numeric lab fields listed above; reject-vs-convert boundary placement;
UCUM subset selection; dependency-vs-hand-roll decision; missing-unit handling; API/UI error
contract; FHIR `Observation`/UCUM alignment (architecture.md §8).

**Out of scope**: actual FHIR resource ingestion/mapping code (architecture.md §8 is a "potential
read resources" proposal, not a committed integration — this SPIKE informs the unit-governance
piece of that future work, it does not build the FHIR client); unit handling for a second module's
analyte set (no second module exists yet).

## Research questions & exit criteria

### RQ1 — Reject-vs-convert boundary
ARCH §8 already answers "reject, not silently convert" — the open question is **where** in the
pipeline: JSON Schema validation (before `deriveFacts()` ever runs), inside `deriveFacts()` itself
(`modules/anemia/facts.anemia.js`), or at range lookup (`src/ranges/registry.js`)?
**Exit criterion**: one decision, with a concrete code sketch showing the exact call site — e.g. a
new `src/units.js` function invoked from `server.mjs`'s request-handling path (`server.mjs:153-160`,
`POST /api/v1/assess`) before `assessPediatricAnemia()` is called, returning a typed rejection the
handler turns into the RQ5 error shape. The sketch must show why that boundary (not one of the
other two) is chosen — e.g. schema-level rejection cannot express "which unit was expected for
which analyte" as cleanly as a dedicated validator, while range-lookup-level rejection would let a
bad-unit value flow through `deriveFacts()`'s derived booleans first, which is worse for a
fail-closed contract.

### RQ2 — Minimal UCUM subset
**Exit criterion**: a closed table, one row per numeric lab field (hemoglobin, mcv, rdw, rbc, wbc,
anc, platelets, ferritin, stfrFerritinIndex, bloodLeadLevel — repo-current-state.md §G P1-WP2 row),
each mapped to: canonical UCUM code (e.g. `g/dL`, `fL`, `pg`, `%`, `ng/mL`, `10*9/L`, `10*12/L` in
UCUM's own case-sensitive syntax), any accepted synonym the input JSON might carry (e.g. `ug/L` vs.
`µg/L` encoding), and whether a same-quantity different-unit input (e.g. hemoglobin in `g/L` instead
of `g/dL`) is rejected outright or requires an explicit conversion factor table to even *detect* the
mismatch (a straight string-mismatch check cannot tell `g/L` from a typo). `bloodLeadLevel`'s
existing doc-string is `µg/dL` (`patient-input.schema.json:82`) — confirm this is UCUM-expressible
and add it to the table.

### RQ3 — Dependency vs. hand-rolled table
**Exit criterion**: a go/no-go recommendation naming the specific candidate (if a UCUM validation
library was evaluated) vs. a hand-rolled `src/units.js` module, weighed explicitly against
repo-current-state.md §D's finding that `package.json` has **zero** `dependencies`/
`devDependencies` and no lockfile today — adopting any package here would be the first external
runtime dependency this project has ever taken. Given the subset is ~10 fixed analytes (RQ2), the
exit artifact should include a rough LOC estimate for the hand-rolled option and an explicit
statement of whether a full UCUM parser (arbitrary unit expressions) is overkill for a closed,
known analyte list — the recommendation should default toward hand-rolled unless a concrete reason
(e.g. FHIR interop requiring arbitrary incoming units) rules it out.

### RQ4 — Missing-unit handling
**Exit criterion**: an explicit decision — is an input lab value with no unit field treated as an
implicit default (assume the documented unit, e.g. `g/dL` for hemoglobin) or rejected as
under-specified? Must include the schema-shape consequence: does each numeric field gain a sibling
`<field>Unit` property (e.g. `hemoglobinUnit`) making the unit structural rather than a doc-string,
and if so, is that property required or optional-with-default in `patient-input.schema.json`. State
the fail-closed implication explicitly: ARCH §10 requires failing closed when "reference units are
absent or incompatible" (`:182`) — "absent" is named directly, so silently assuming a default unit
for a field that omits one is in tension with that clause unless the decision explicitly argues the
schema's fixed-unit contract (not per-request unit fields) satisfies "absent" differently than a
FHIR-sourced value would.

### RQ5 — API error shape + SPA UX
**Exit criterion**: a concrete JSON error-response shape extending `server.mjs`'s existing
`sendJson(response, 400, {error: ...})` pattern (`server.mjs:89-96, 106-127, 177-180` — the existing
`400`/`413` error paths already follow this shape) — e.g. `{error: "Unit mismatch", details: [{field,
providedUnit, expectedUnit}]}` — plus a UX sketch for how `src/app.js` surfaces this without losing
clinician-entered form state. Ground the UX sketch in the current pattern: `src/app.js`'s
`showFatalError()` (`:627-630`) replaces the entire results panel with a generic error message and
`loadExample().catch(showFatalError)` (`:564`) is the closest existing analog, but neither preserves
partially-entered form values today — the exit artifact must state whether a unit-mismatch error
needs a *different*, form-preserving UX path than today's fatal-error pattern (recommended: yes,
since a unit typo is a recoverable input error, not an application fault, and conflating the two
would make every mismatch look like a broken app to the clinician).

### RQ6 — FHIR Observation/UCUM alignment
**Exit criterion**: confirm whether the UCUM subset chosen in RQ2 aligns with how a FHIR
`Observation.valueQuantity.unit` would encode the same analytes (architecture.md §8's `Observation`
read-resource proposal, `:151-156`), and record any analyte where FHIR's typical encoding diverges
from the internal schema's current doc-string unit (e.g. confirm hemoglobin is conventionally
`g/dL` vs. `g/L` in FHIR-sourced CBC panels) — this does not require building FHIR ingestion, only
confirming the internal unit table (RQ2) would not need a second incompatible table if FHIR
ingestion is built later.

## Method

1. Enumerate the ~10 fields directly from `patient-input.schema.json` (already done above); do not
   assume the current-state brief's field list is exhaustive — recheck against the live schema file
   at SPIKE execution time.
2. For RQ3, do a bounded search (not an open-ended survey) for a minimal UCUM validation library
   candidate, explicitly time-boxed to under 1 hour of the total budget, then compare against a
   hand-rolled sketch covering only the RQ2 table.
3. For RQ1/RQ4/RQ5, produce a short call-flow diagram (`request → validation layer → fact
   derivation → response`) annotated with where rejection happens and what the caller sees at each
   stage — this is a design artifact, not working code.
4. Cross-check RQ2's table against architecture.md §8's FHIR resource list for RQ6.

## Overall SPIKE exit criteria

Closed when: (1) RQ1–RQ6 each have a recorded decision; (2) the RQ2 unit table is complete for all
~10 fields; (3) RQ3's dependency decision explicitly reasons about the "first dependency" cost; (4)
a call-flow diagram exists showing the chosen rejection boundary end-to-end.

## Timebox

**Timebox: 5 hours.** If the timebox expires before RQ2's table is fully populated: ship RQ1, RQ3,
RQ4, RQ5 decisions plus whatever fraction of the RQ2 table covers the two safety-critical analytes
(hemoglobin, ferritin — the two the roadmap's worked examples center on) and flag the remaining
analytes for a fast-follow pass before P1-WP2 coding starts on those specific fields.

## Decision impact

| P1 work package | Blocking? | Default/fallback if this SPIKE is skipped |
|---|---|---|
| P1-WP2 (local reference-range registry + unit service) | **Direct, hard block** | Cannot start — WP2's entire "fail-closed unit-mismatch rejection" scope is this SPIKE's RQ1/RQ2/RQ4 decisions. |
| P1-WP5 (signed KB manifest) | Soft — no direct dependency | Unaffected either way. |

**If skipped**: the fallback is implementing unit handling ad hoc during WP2 coding without a
reviewed boundary/dependency decision — given repo-current-state.md's flag that a dependency
decision here is a genuine one-way door for this project's zero-dependency posture, skipping this
SPIKE risks an unreviewed first-dependency addition slipping in under implementation pressure.

## Citations

- `docs/project_plans/expansion/01-platform-expansion-roadmap.md:159, 217-220`
- `docs/architecture.md` §8 (`:148-165`), §10 (`:178-188`)
- `.claude/worknotes/wave0-safety-foundation/repo-current-state.md` §B (ranges/registry note), §D (zero-dependency finding), §G (P1-WP2 row)
- `schemas/patient-input.schema.json` (`cbc`, `labs` properties), `src/ranges/registry.js`, `modules/anemia/ranges.js`, `server.mjs`, `src/app.js`

---

## Critical cross-cutting finding (read first)

**The browser SPA never goes through `server.mjs` to run an assessment.** `src/app.js`'s form-submit
handler calls `assessPediatricAnemia(input, rules, candidates)` directly, in-browser
(`src/app.js:588`), and `loadExample()` does the same (`src/app.js:500`) — both call the shared
`src/engine.js` export synchronously, client-side, with no network round trip. This means RQ1's own
exit-criterion illustration — "a new `src/units.js` function invoked from `server.mjs`'s
request-handling path... before `assessPediatricAnemia()` is called" — **cannot be the actual
boundary**: placing the check only in `server.mjs` would leave the SPA's identical code path
completely unprotected. The only place that structurally guarantees both callers run the same
check is *inside* the shared `assess()`/`assessPediatricAnemia()` entry point in `src/engine.js`
itself (`src/engine.js:11` `assess(input, moduleId, rules, candidates)`, `:40` shim) — not a
caller-side wrapper either caller could forget to invoke.

Second, compounding finding: **`schemas/patient-input.schema.json` is not enforced by any runtime
validator today.** `grep -rn "ajv|Ajv|patient-input.schema" --include="*.js" --include="*.mjs"` over
the whole repo (excluding `node_modules/`) returns zero hits outside the schema file itself and
`openapi.yaml`'s `$ref`; `server.mjs`'s `POST /api/v1/assess` handler does only
`JSON.parse` + a shallow `typeof input === 'object' && !Array.isArray(input)` check
(`server.mjs:154-157`) before calling `assessPediatricAnemia()` directly. `package.json` has no
`dependencies`/`devDependencies` field at all (confirmed by reading the full file — 7 top-level
keys, no lockfile) — there is no schema-validation library anywhere in the runtime path. This means
"reject at JSON Schema validation" (one of RQ1's three candidate boundaries) is not merely
suboptimal, it is **currently a no-op with nothing wired to enforce it** — building that boundary
would require introducing a JSON Schema validator (e.g. `ajv`) as a *second* new dependency
alongside whatever RQ3/D-5 decides, which is reason enough on its own to rule it out.

These two findings jointly decide RQ1.

---

## Findings by research question

### RQ1 — Reject-vs-convert boundary

**Decision: reject inside `assess()`, before `module.deriveFacts(input)` is called, in
`src/engine.js`.** Not schema validation (nothing enforces the schema today — see cross-cutting
finding), not range lookup (`src/ranges/registry.js`) — by the time a value reaches
`getBuiltInAnalyteValue`/`getThreshold`, `deriveFacts()` has already computed derived booleans off
the raw wrong-unit number (e.g. `anemiaStatus`, `ferritinLow`, `morphology` in
`modules/anemia/facts.anemia.js:30-48`) — rejecting *after* that point would mean the fail-closed
check runs too late to prevent a wrong-unit value from ever entering derivation, defeating the
purpose. `assess()` already receives `moduleId` as its second positional argument
(`src/engine.js:11`), which is exactly what a per-module unit table needs to know which analyte-unit
table to check against — no signature change required, only a new call at the top of the function
body.

Concrete sketch:

```js
// src/engine.js
import { validateUnits } from './units.js';

export function assess(input, moduleId, rules, candidates) {
  if (!Array.isArray(rules)) throw new TypeError('rules must be an array');
  const module = getModule(moduleId);

  const unitCheck = validateUnits(moduleId, input);
  if (!unitCheck.ok) {
    const error = new Error('Unit mismatch or unrecognized unit in patient input.');
    error.code = 'UNIT_REJECTED';
    error.statusCode = 400;
    error.details = unitCheck.errors; // [{field, providedUnit, expectedUnit, reason}]
    throw error;
  }

  const facts = module.deriveFacts(input);
  // ...unchanged...
}
```

Both `server.mjs` and `src/app.js` call `assess()`/`assessPediatricAnemia()` as their one shared
entry point (confirmed above), so this single call site protects both surfaces without either
caller needing to remember anything. `server.mjs`'s existing catch-all (`server.mjs:177-180`)
already turns any thrown error with a `.statusCode` into the right HTTP status — see RQ5 for the
(small) extension needed to also surface `.details`. `src/app.js`'s submit handler has **no
try/catch today** (`src/app.js:585-592`) — see RQ5 for why that is itself a safety gap this SPIKE
must flag, independent of where the throw originates.

### RQ2 — Minimal UCUM subset

Live-schema recheck (per Method step 1) confirms the field list is accurate and complete —
`schemas/patient-input.schema.json` has exactly 10 numeric lab fields with a unit-bearing
`description` doc-string, plus one (`stfrFerritinIndex`) with **no unit doc-string at all**
(`:77` — confirmed by re-reading the file: no `"description"` key present, unlike its 9 siblings).

| Analyte | Schema field : line | Current doc-string | Canonical (ASCII-safe) | UCUM code | Accepted synonyms (same value, different spelling) | Known-rejected confusables (same quantity kind, different scale — reject with a targeted message) |
|---|---|---|---|---|---|---|
| Hemoglobin | `cbc.hemoglobin` `:23` | `g/dL` | `g/dL` | `g/dL` | `g/dl` (case) | `g/L` (10× scale), `mmol/L` (molar, not mass) |
| MCV | `cbc.mcv` `:24` | `fL` | `fL` | `fL` | `fl` (case) | `um3`/`µm³` (numerically 1:1 with fL but a different UCUM notation — reject for consistency per D-5/RQ1's uniform reject-don't-convert rule, no silent exceptions) |
| RDW | `cbc.rdw` `:25` | `%` | `%` | `%` | `percent`, `pct` | — (single-scale field; nothing else clinically reported) |
| RBC | `cbc.rbc` `:26` | `10^12/L` | `10^12/L` | `10*12/L` | `10*12/L` (UCUM), `x10^12/L`, `M/uL` (numerically identical: 10¹²/L = 10⁶/µL = "M/µL", pure notation, no arithmetic) | — |
| WBC | `cbc.wbc` `:27` | `10^9/L` | `10^9/L` | `10*9/L` | `10*9/L`, `x10^9/L`, `K/uL` (numerically identical: 10⁹/L = 10³/µL) | — |
| ANC | `cbc.anc` `:28` | `10^9/L` | `10^9/L` | `10*9/L` | `10*9/L`, `x10^9/L`, `K/uL` | — |
| Platelets | `cbc.platelets` `:29` | `10^9/L` | `10^9/L` | `10*9/L` | `10*9/L`, `x10^9/L`, `K/uL` | — |
| Ferritin | `labs.ferritin` `:71` | `ng/mL` | `ng/mL` | `ng/mL` | `ug/L`, `µg/L` (numerically identical: 1 ng/mL = 1 µg/L) | `ng/L` (1000× scale — a very plausible typo/EHR-mapping error, worth naming explicitly in the reject message) |
| sTfR/ferritin index | `labs.stfrFerritinIndex` `:77` | **none — gap** | `1` (dimensionless ratio) | `1` | — | any unit string at all (a ratio has no legitimate unit; if a caller ever sends one, that is itself the mismatch) |
| Blood lead level | `labs.bloodLeadLevel` `:82` | `µg/dL` (Unicode micro-sign) | `ug/dL` | `ug/dL` | `µg/dL` (Unicode variant — see normalization risk below), `mcg/dL` (common clinical shorthand) | `µmol/L` (SI molar unit used internationally — ~0.0483 conversion factor, must reject not convert) |

Two things this table surfaces that the charter's problem statement didn't anticipate:

1. **`stfrFerritinIndex` has no unit doc-string today at all** (schema:77) — it's a calculated
   dimensionless ratio, not a lab value with an implied unit. It still needs an entry in the closed
   table (canonical `1`/dimensionless, zero accepted unit strings) so that if a future caller *does*
   attach a spurious unit to it, that is itself caught as a mismatch rather than silently accepted
   because "no unit was expected anyway."
2. **The schema's own doc-strings are not valid UCUM syntax** — `10^12/L` (caret) vs UCUM's
   `10*12/L` (asterisk exponent syntax), and `µg/dL` (Unicode U+00B5 MICRO SIGN) vs UCUM's ASCII
   `ug/dL`. The closed table's canonical *comparison* form must be the ASCII/UCUM form; the existing
   doc-strings stay as human-readable hints only, and one accepted synonym per affected field is the
   doc-string's own literal spelling, so nothing that matches today's documentation is spuriously
   rejected.

Every "accepted synonym" in the table above is a **pure notation change — the number is never
transformed**, only the unit label is normalized to canonical before comparison. Every
"known-rejected confusable" requires an actual arithmetic conversion factor to reconcile with the
canonical unit (10×, 1000×, or a different quantity kind such as molar vs. mass concentration) —
per D-5/RQ1, this SPIKE's answer is to *reject*, never apply that factor silently. This is the exact
distinction the charter's RQ2 exit criterion asks for: "a straight string-mismatch check cannot tell
`g/L` from a typo" — the table's "known-rejected confusables" column exists specifically so the
rejection message can say *"you sent g/L, hemoglobin expects g/dL"* instead of a generic
*"unrecognized unit string"*, which is both safer (harder to misread as "your value was accepted")
and more actionable for the clinician fixing the input.

### RQ3 — Dependency vs. hand-rolled table

**Decision: hand-roll, in a new `src/units.js` (generic mechanism, mirroring `src/ranges/
registry.js`'s existing pattern) + `modules/anemia/units.json` (the closed 10-row table) +
`modules/anemia/units.js` (registration, mirroring `modules/anemia/ranges.js`). No UCUM library
dependency.**

Bounded search performed (within the charter's 1-hour time-box) turned up two real, current
candidates:

- **`@lhncbc/ucum-lhc`** (NLM/Regenstrief reference implementation; current version `7.1.6`,
  published Feb 2026, actively maintained). Ships a `browser-dist/ucum-lhc.min.js` for direct
  browser use without a build step, but the full package (validation + conversion + commensurable-
  unit search + the complete UCUM unit-code definitions dataset) measures roughly **1.4 MB** per a
  package-size listing found during the search — built to validate/convert *any* UCUM expression a
  FHIR `Observation` might carry, not a closed 10-item list.
- **`@atomic-ehr/ucum`** — a newer TypeScript implementation (current version `0.2.5`) offering
  parsing, canonical-form conversion, and quantity arithmetic. Immature (0.2.x) for a
  patient-safety-relevant dependency, and — like `ucum-lhc` — a general arbitrary-unit-expression
  engine, not a lookup table scoped to our 10 analytes.
  (Sources: [@lhncbc/ucum-lhc — npm](https://www.npmjs.com/package/@lhncbc/ucum-lhc),
  [LHNCBC/ucum-lhc — GitHub](https://github.com/lhncbc/ucum-lhc),
  [@atomic-ehr/ucum — npm](https://www.npmjs.com/package/@atomic-ehr/ucum),
  [atomic-ehr/ucum — GitHub](https://github.com/atomic-ehr/ucum).)

Weighed against `.claude/worknotes/wave0-safety-foundation/repo-current-state.md` §D's finding that
`package.json` has **zero** `dependencies`/`devDependencies` and no lockfile today — either
candidate would be **the first external runtime dependency this project has ever taken**, and
CLAUDE.md's hard guardrail ("no third-party scripts/fonts/analytics" in the public microsite) plus
`server.mjs`'s CSP (`script-src 'self'`, `server.mjs:86`) mean any such dependency must be locally
vendored, not CDN-loaded. `scripts/build-static.mjs` copies files verbatim with no bundling step
(confirmed by SPIKE-001's cross-cutting finding, still true) — so consuming either package would
also require either introducing a bundler (a materially bigger one-way door than the dependency
itself) or manually vendoring a ~1.4 MB or immature-0.x minified bundle into the repo for the sole
purpose of validating 10 fixed strings per request.

Hand-rolled LOC estimate, based directly on the existing, already-reviewed
`src/ranges/registry.js` (57 lines) / `modules/anemia/ranges.js` (118 lines) pattern this design
deliberately mirrors:

- `src/units.js` (generic `registerAnalyteUnit`/`getUnitSpec`/`validateUnits`, module-agnostic,
  keyed `` `${moduleId}::${analyte}` `` exactly like `src/ranges/registry.js`): **~60–80 lines**.
- `modules/anemia/units.json` (the closed table above, one object per analyte): **~90–120 lines**
  of JSON.
- `modules/anemia/units.js` (registration + Unicode/notation normalization,
  mirroring `modules/anemia/ranges.js`'s `import ... with { type: 'json' }` pattern): **~60–90
  lines**.

Total **~210–290 LOC across 3 new files** — smaller than the doc-string comments alone in
`@lhncbc/ucum-lhc`'s unit-definitions dataset. A full arbitrary-unit-expression parser (handling
compound/derived units, exponents, arbitrary metric-prefix combinations) is unambiguously overkill
for a closed, enumerable, ~10-row analyte list with no user-composed unit expressions anywhere in
this codebase's actual input surface. The one condition that would flip this recommendation — real
FHIR `Observation` ingestion accepting arbitrary incoming UCUM strings from unknown external systems
— is explicitly out of this SPIKE's scope (problem statement: "this SPIKE informs the unit-
governance piece of that future work, it does not build the FHIR client") and should be the trigger
to re-open this decision, not a reason to pre-emptively take the dependency now.

### RQ4 — Missing-unit handling / schema shape

**Decision: each of the 10 numeric fields gains an optional sibling `<field>Unit` string property
in `cbc`/`labs` (e.g. `hemoglobinUnit`), not required.** If present, its value is checked against
the RQ2 table (synonym → accept-and-normalize, confusable/unrecognized → reject per RQ1). If
**absent**, the canonical unit is assumed — this is OQ-5's resolution, argued in full there.

This requires touching `additionalProperties: false` object property lists at
`schemas/patient-input.schema.json:21` (`cbc`) and `:69` (`labs`) to add the 10 new sibling keys —
mechanical, but a hard-coupling point worth flagging explicitly (same shape of gotcha
`rule.schema.json`'s `additionalProperties: false` already presents for WP4, per repo-current-
state.md §C). Since the schema file is not runtime-enforced today (cross-cutting finding), this
edit is "keep the documentation honest" now, and becomes load-bearing later if/when an ajv-style
validator is ever added — but the *real* enforcement in P1-WP2 is `src/units.js`'s check inside
`assess()`, independent of whether the schema file itself is ever wired to a validator.

ARCH §10's fail-closed clause is quoted precisely: fail closed "when reference units are absent or
incompatible" (`docs/architecture.md:182`). Read literally against the actual data this repo has
today, "reference units" most naturally refers to the **reference range/threshold's own unit** —
and `modules/anemia/reference-ranges.json` already declares those explicitly
(`"units": {"hb": "g/dL", "mcv": "fL", "rdw": "%"}`, `reference-ranges.json:2-6`) — not to whether a
given *request* happened to include a redundant per-field unit string. "Incompatible" is the
input-value case this SPIKE's RQ1/RQ2 answer squarely: any declared-but-wrong unit is always
rejected, no exceptions. An *omitted* per-request unit field is not the same failure mode as a
FHIR-sourced `Observation.valueQuantity` genuinely lacking `.unit` (where the value's physical
quantity is structurally ambiguous) — `patient-input.schema.json` has always implied exactly one
fixed unit per field via its `description` doc-strings, for every one of the 6 examples and every
existing caller, since before this SPIKE existed. Full argument and the safer-alternative comparison
are in OQ-5.

### RQ5 — API error shape + SPA UX

**API error shape** (extends `server.mjs`'s existing `sendJson(response, 400, {error: ...})`
pattern, `server.mjs:89-96, 106-127, 177-180`):

```json
{
  "error": "Unit mismatch or unrecognized unit in patient input.",
  "code": "UNIT_REJECTED",
  "details": [
    { "field": "cbc.hemoglobin", "providedUnit": "g/L", "expectedUnit": "g/dL", "reason": "incompatible" },
    { "field": "labs.bloodLeadLevel", "providedUnit": "µmol/L", "expectedUnit": "ug/dL", "reason": "incompatible" },
    { "field": "cbc.mcv", "providedUnit": "cubic-microns", "expectedUnit": "fL", "reason": "unrecognized" }
  ]
}
```

HTTP **400**, matching the existing convention (`server.mjs`'s other `400`/`413` paths,
`openapi.yaml:103-114`). `reason` is a closed two-value enum: `incompatible` (a known confusable
unit at the wrong scale/quantity kind — table has a specific `expectedUnit` to name) vs.
`unrecognized` (not in the table at all). `server.mjs`'s catch block needs a small, surgical
extension — it already computes `status` from `error.statusCode` (`:178`); it just needs to also
forward `error.details` when present:

```js
// server.mjs:177-180, extended
} catch (error) {
  const status = error.statusCode || (error.code === 'ENOENT' ? 404 : 400);
  const body = { error: status === 404 ? 'Not found' : error.message };
  if (error.details) body.details = error.details;
  sendJson(response, status, body, requestId);
}
```

`openapi.yaml`'s `Error` component (`:117-122`) needs an additive `details` property (optional
array) alongside the existing required `error` string — non-breaking.

**SPA UX — this is where the sharpest safety gap actually is.** `src/app.js`'s form-submit handler
has **no try/catch at all** today (`src/app.js:585-592`):

```js
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = buildInput();
  const result = assessPediatricAnemia(input, rules, candidates);  // ← would throw, uncaught
  currentAudit = { input, result };
  renderResult(result);
  refreshAuditView();
});
```

Once `assess()` can throw a `UNIT_REJECTED` error (RQ1), an uncaught exception here does **not**
trigger `showFatalError()` — that function is only wired to `loadExample().catch(showFatalError)`
(`src/app.js:564`), not to the submit handler. An uncaught throw inside a DOM event listener fails
silently from the user's perspective (console-only), leaving `#results` showing whatever the
**previous** successful assessment rendered. That is precisely the state ARCH §10 forbids: a
clinician resubmits a corrected/edited case, the new input is silently rejected, and the *old*
result stays on screen with no visual indication it no longer corresponds to the current form
values — stale output presented as current. This gap exists independent of anything this SPIKE adds;
it is exposed the moment any exception-throwing validation is added to the shared `assess()` path,
which is exactly what RQ1 does.

The exit criterion's own framing is right: a unit-mismatch error needs a UX path distinct from
`showFatalError()`'s "the application is broken" framing, because it is a recoverable input mistake,
not an application fault. Recommended: a new `showInputRejection(error)`, wired into **both** the
submit handler and `loadExample()`:

```js
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = buildInput();
  try {
    const result = assessPediatricAnemia(input, rules, candidates);
    currentAudit = { input, result };
    renderResult(result);
    refreshAuditView();
  } catch (error) {
    if (error.code === 'UNIT_REJECTED') showInputRejection(error);
    else throw error; // genuine app fault — let it surface as today
  }
});

function showInputRejection(error) {
  currentAudit = null;
  $('#results').hidden = true;
  $('#results-placeholder').hidden = false;
  $('#results-placeholder').innerHTML = `
    <h2>Check the highlighted values</h2>
    <p>${escapeHtml(error.message)}</p>
    <ul>${error.details.map((d) => `<li><strong>${escapeHtml(d.field)}</strong>: entered
      "${escapeHtml(d.providedUnit)}", expected ${escapeHtml(d.expectedUnit ?? 'a recognized unit')}
      </li>`).join('')}</ul>`;
  // form values are left untouched — buildInput() reads live DOM state, nothing is cleared.
}
```

This keeps every entered form value intact (`buildInput()` reads directly from the live DOM;
nothing in this path calls `form.reset()`), clears the stale-results risk identified above by
explicitly hiding `#results`, and is visually and semantically distinct from `showFatalError()` —
an itemized, fixable list rather than a generic "Application error" message. Whether the SPA's
*form itself* ever grows a real unit-selector input control (as opposed to the fixed labels it has
today, e.g. `index.html:126` `"Hemoglobin (g/dL)"`) is separate, undecided future scope — flagged
under Risks & open questions so P1-WP2 doesn't silently absorb it.

### RQ6 — FHIR Observation/UCUM alignment

Cross-checked the RQ2 table's canonical units against standard US-context FHIR/LOINC Observation
conventions for each analyte (general domain knowledge of typical US Core / LOINC unit reporting
practice — **not verified against a live FHIR server or terminology service in this session**;
flagged as a fast-follow verification item, not a hard claim, consistent with this SPIKE's
"potential read resources" framing in `docs/architecture.md` §8, which is itself explicitly a
proposal, not committed integration):

| Analyte | Typical LOINC code | Typical FHIR-reported unit | Aligns with RQ2 canonical? |
|---|---|---|---|
| Hemoglobin | 718-7 | `g/dL` | Yes, direct match |
| MCV | 787-2 | `fL` | Yes, direct match |
| RDW | 788-0 | `%` | Yes, direct match |
| RBC | 789-8 | `10*6/uL` | Numerically identical to canonical `10*12/L` — already an accepted synonym (RQ2 table) |
| WBC | 6690-2 | `10*3/uL` | Numerically identical to canonical `10*9/L` — already an accepted synonym |
| ANC | 751-8 | `10*3/uL` | Same as WBC — already an accepted synonym |
| Platelets | 777-3 | `10*3/uL` | Same pattern — already an accepted synonym |
| Ferritin | 2276-4 | `ng/mL` (sometimes `ug/L`) | Yes — both already in RQ2's synonym list |
| Blood lead level | 5671-3 | `ug/dL` | Yes, direct match (schema's Unicode `µg/dL` doc-string normalizes to this) |
| sTfR/ferritin index | no single canonical LOINC | dimensionless / lab-specific | Consistent with RQ2's dimensionless-`1` treatment |

No analyte required inventing a second, FHIR-specific unit table — every divergence between a
typical FHIR-reported unit and this schema's internal canonical unit (the `10*3/uL`- vs.
`10*9/L`-style notation differences) is a **pure-notation synonym already captured in RQ2's table**,
not a scale conversion. This confirms the RQ6 exit criterion: the RQ2 table, as designed, would not
need to be replaced or duplicated if FHIR `Observation` ingestion is built later — it would only
need its synonym lists extended if a not-yet-seen FHIR unit variant showed up in practice.

---

## Recommended design

```
src/
  units.js                    # NEW — generic, module-agnostic unit registry + validator
                               #   registerAnalyteUnit(moduleId, analyte, {canonical, synonyms, confusables})
                               #   validateUnits(moduleId, input) -> {ok, errors[]}
                               #   mirrors src/ranges/registry.js's registerX/getX + Map-keyed pattern
  engine.js                    # assess() calls validateUnits(moduleId, input) before
                               #   module.deriveFacts(input); throws a typed, statusCode-bearing
                               #   error on rejection (RQ1)
  app.js                        # submit handler + loadExample() wrapped in try/catch; new
                               #   showInputRejection(error), distinct from showFatalError()  (RQ5)
modules/anemia/
  units.json                  # NEW — the closed 10-analyte table (RQ2), one object per analyte:
                               #   { analyte, canonical, synonyms: [...], confusables: [{unit, note}] }
  units.js                     # NEW — registers modules/anemia/units.json entries with
                               #   src/units.js, mirroring modules/anemia/ranges.js's
                               #   `import ... with { type: 'json' }` + register* pattern
server.mjs                     # catch block forwards error.details when present (RQ5, ~3-line diff)
schemas/patient-input.schema.json  # 10 new optional `<field>Unit` sibling properties under
                               #   cbc/labs; additionalProperties lists updated (RQ4)
openapi.yaml                   # Error component gains optional `details` array (RQ5)
tests/
  units.test.mjs                # NEW — exercises every canonical/synonym/confusable/unrecognized
                               #   combination in the RQ2 table, plus the missing-unit-assumed
                               #   path and the golden-fixture zero-migration guarantee (see Risks)
```

`src/units.js`'s validator classification per field, in order: (1) unit field absent →
`unitAssumed: true`, canonical assumed, no rejection (OQ-5); (2) unit field present and matches
canonical or a listed synonym → normalize, no rejection; (3) unit field present and matches a listed
confusable → reject with `reason: "incompatible"` and a named `expectedUnit`; (4) unit field present
and matches nothing → reject with `reason: "unrecognized"`. This four-way branch is the concrete
shape `validateUnits()` implements, directly answering RQ1's "typed rejection the handler turns
into the RQ5 error shape."

---

## Alternatives considered

- **UCUM library dependency** (`@lhncbc/ucum-lhc` or `@atomic-ehr/ucum`). Rejected under D-5/RQ3:
  first external runtime dependency this project has ever taken, ~1.4 MB (or immature 0.x) general
  arbitrary-expression engine for a closed 10-row lookup, requires vendoring under a
  no-third-party-scripts/`script-src 'self'` CSP with no existing bundler, and is disproportionate
  to the actual problem (~250 LOC hand-rolled equivalent).
- **Reject at JSON Schema validation.** Rejected under RQ1: `patient-input.schema.json` is not
  enforced by any runtime code today — this boundary is currently a no-op, and wiring it up would
  itself require a new schema-validator dependency, doubling the D-5 decision rather than answering
  it.
- **Reject at range-lookup level** (inside `src/ranges/registry.js`'s `getBuiltInAnalyteValue`/
  `getThreshold`). Rejected under RQ1: by that point `deriveFacts()` has already computed several
  derived booleans off the raw (possibly wrong-unit) number, which is worse for a fail-closed
  contract than rejecting before any derivation runs.
- **Silent conversion** (accept `g/L`, divide by 10, proceed). Rejected — this is the exact behavior
  `docs/architecture.md:165` and `:182` explicitly forbid, and the whole premise of this SPIKE (D-5
  is reject-vs-hand-roll, not reject-vs-convert — ARCH already answered reject-vs-convert).
- **Hard-reject on missing unit** (no implicit default, ever). Considered seriously for OQ-5 —
  rejected as the *default* policy (see OQ-5) because it would break the SPA (which has no unit
  input UI and sends none), all 6 golden fixtures (none have unit fields), and every existing API
  caller, for a scenario (ambiguous multi-unit external source) that does not describe this closed,
  single-unit-per-field schema as it exists today. Flagged as the policy to revisit the moment real
  external/FHIR ingestion is built (see Risks).
- **Numerically-equivalent-notation units treated as "confusables" requiring rejection** (e.g.
  rejecting `K/uL` for WBC just like `g/L` is rejected for hemoglobin, out of maximal caution).
  Rejected: `K/uL` and `10*9/L` are the *same number*, not a scale conversion — treating pure
  notation variance as a rejectable mismatch would make the SPA/API reject a large fraction of real
  US-lab-report-formatted CBC values for no safety benefit, and blurs the RQ2 distinction the
  charter itself asks for between "detectable mismatch" and "typo."

---

## Risks & open questions

- **OQ-5 (resolved) — the missing-unit policy: accept-with-`unitAssumed`-flag, not hard-reject.**
  When a `<field>Unit` sibling is omitted, the canonical unit is assumed and `unitAssumed: true` is
  recorded per-field. This is judged **safer here**, not merely more convenient, for three reasons
  argued in full at RQ4: (1) the schema has always implied exactly one fixed unit per field via its
  doc-strings — this is not the FHIR-style "structurally ambiguous, could be any compatible unit"
  case ARCH §10's "absent" language is written against; (2) a blanket hard-reject would force every
  existing caller (the SPA, all 6 golden fixtures, this repo's own examples) to add a unit field
  just to keep working, which in practice invites implementers to paste in *some* unit string just
  to pass validation — a fabricated-but-accepted value is worse for audit integrity than an honestly
  flagged assumption; (3) fail-closed is fully preserved where the actual risk lives — any
  *declared* wrong or unrecognized unit is always rejected, unconditionally, no exceptions. **How
  the flag surfaces to the clinician**: `unitAssumed` fields propagate into the assessment's
  `provenance`/`limitations` output (the same output shape `src/engine.js:17-37`'s `assess()`
  already returns) as a per-field list, e.g. `provenance.unitsAssumed: ["cbc.hemoglobin",
  "labs.ferritin"]`, and — for the SPA specifically — into a small, non-blocking notice rendered
  alongside the results panel (not a rejection banner; assumed-unit is not an error) so the
  clinician can see, per assessment, which values were interpreted against the documented default
  unit rather than an explicitly asserted one. **Revisit trigger**: the moment real FHIR/EHR
  ingestion (ARCH §8) is built, the calculus changes — a machine-to-machine integration omitting a
  unit is a materially different risk than a clinician using the repo's own SPA form, and hard-reject
  should be reconsidered *for that specific input channel* at that time, not retrofitted onto the
  current single-source schema now.
- **New gap found, not in the charter's original field list**: `labs.stfrFerritinIndex` has no unit
  doc-string in the schema today (`:77`) — it's a dimensionless ratio. Recommend registering it in
  the closed table as canonical `1` (dimensionless) with zero accepted unit synonyms, so any future
  caller attaching a spurious unit string to it is still caught, rather than silently ignored because
  "no unit was ever expected."
- **Unicode normalization risk**: the schema's own `bloodLeadLevel` doc-string uses U+00B5 MICRO SIGN
  (`µg/dL`, `:82`) while UCUM's canonical ASCII form is `ug/dL`; clinicians/EHRs may also produce
  U+03BC GREEK SMALL LETTER MU. `src/units.js`'s comparison must normalize these (fold micro-sign
  variants to ASCII `u` before table lookup) or an honestly-typed `µg/dL` could be wrongly rejected
  as "unrecognized" — a false-positive fail-closed that is safe but user-hostile; worth an explicit
  unit test in `tests/units.test.mjs`.
- **The SPA form has no unit-input UI today** (`index.html:126`, fixed label
  `"Hemoglobin (g/dL)"`, no unit `<select>`/field anywhere for any of the 10 analytes). This SPIKE's
  recommended design makes the `<field>Unit` schema properties meaningful primarily for the REST
  API surface first; whether/when the SPA form itself grows real per-field unit-selector controls is
  separate, undecided scope — flag explicitly so P1-WP2 doesn't silently absorb a UI-design task
  this SPIKE did not scope.
- **Golden-fixture zero-migration claim needs a real test, not just an assertion.** None of the 6
  `tests/golden/*.json` fixtures or `examples/*.json` inputs carry any `<field>Unit` property today
  — under the accept-with-flag policy this is safe by construction (every field defaults to
  `unitAssumed: true`, canonical unit, byte-identical downstream behavior), but
  `tests/module-equivalence.test.mjs`'s existing byte-for-byte harness does not exercise this path
  explicitly. `tests/units.test.mjs` (new, per Recommended design) should assert this directly rather
  than relying on the equivalence harness continuing to pass as implicit proof.
- **Schema `additionalProperties: false` coupling**: adding the 10 new `<field>Unit` properties to
  `schemas/patient-input.schema.json`'s `cbc`/`labs` objects (`:21`, `:69`) is mechanical but easy to
  forget one of; the schema is documentation-only today (cross-cutting finding) so a missed field
  won't break any current test, which is itself a minor risk — recommend `scripts/validate-kb.mjs`
  or a new lightweight check assert the 10 `units.json` analytes and the 10 schema `<field>Unit`
  properties stay in 1:1 correspondence, so drift is caught mechanically rather than relying on
  review alone.

---

## Implications per work package

- **P1-WP2 (direct, this SPIKE's primary target)**: concrete file list —
  `src/units.js` (NEW, generic registry/validator), `modules/anemia/units.json` (NEW, closed
  10-analyte table), `modules/anemia/units.js` (NEW, registration, mirrors `ranges.js`),
  `src/engine.js` (add `validateUnits()` call inside `assess()`, before `deriveFacts()`),
  `server.mjs` (catch block forwards `error.details`, ~3-line diff),
  `src/app.js` (wrap submit handler + `loadExample()` in try/catch; new `showInputRejection()`,
  distinct from `showFatalError()`), `schemas/patient-input.schema.json` (10 new optional
  `<field>Unit` properties + `additionalProperties` list updates), `openapi.yaml` (`Error` component
  gains optional `details`), `tests/units.test.mjs` (NEW — full table coverage + missing-unit-assumed
  path + golden-fixture zero-migration proof). No dependency addition (D-5).
- **P1-WP1 (tri-state)**: no file overlap with this SPIKE's recommended design — `src/units.js`
  and `modules/anemia/facts.anemia.js`'s tri-state migration touch disjoint concerns and can proceed
  in parallel, though both ultimately feed the same `modules/anemia/facts.anemia.js` call site
  (`getEffectiveRanges(input)` at `facts.anemia.js:25` runs *after* `assess()`'s unit check per RQ1's
  boundary, so WP1's tri-state changes to that file are unaffected by where the unit check sits).
- **P1-WP5 (signed KB manifest)**: unaffected, confirming the charter's own Decision-impact table —
  no shared files, no ordering dependency in either direction.
- **P1-WP6 (expanded validation corpus)**: `tests/units.test.mjs`'s exhaustive canonical/synonym/
  confusable/unrecognized matrix (RQ2's table has a closed, enumerable input space) is a natural
  candidate for WP6's property-based test suite once WP2 lands — every row of the RQ2 table is a
  ready-made property-test case (a valid synonym must always normalize to the same canonical value;
  a listed confusable must always reject with the correct `expectedUnit`), worth flagging for WP6's
  planning rather than re-deriving the table independently.
- **P1-WP4 (rule metadata)**: no overlap — `rule.schema.json`'s `additionalProperties: false`
  coupling (repo-current-state.md §C) is a structurally identical gotcha to this SPIKE's own
  `patient-input.schema.json` `additionalProperties: false` note (RQ4/Risks), worth the implementer
  noticing both exist so neither surprises them mid-WP.
