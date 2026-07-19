---
schema_version: 2
doc_type: spike
title: "SPIKE-004: UCUM Unit Handling and Mismatch Rejection"
status: draft
created: 2026-07-19
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
