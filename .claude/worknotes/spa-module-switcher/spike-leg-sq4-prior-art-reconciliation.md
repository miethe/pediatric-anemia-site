---
schema_version: 2
doc_type: report
report_category: investigations
title: "SPIKE leg SQ-4: prior-art reconciliation & governance paperwork"
status: draft
created: 2026-07-22
feature_slug: spa-module-switcher
---

# SQ-4: Prior-Art Reconciliation & Governance Paperwork

## 1. `public-moduleid-api-surface.md` — scope & disposition

**Scope (quoted):** The doc is a **server-API** design spec, not a browser-UX spec. Problem/Context and Design Sketch are entirely about `POST /api/v1/assess`/`GET /api/v1/knowledge-base` (`server.mjs`) — e.g. "the natural shape is additive to the existing `POST /api/v1/assess` contract" (:58), "Accept an optional `moduleId` field in the request body" (:61). The SPA appears only once, as a downstream *consequence*, never designed: "The browser SPA (`src/app.js`) would need a module-selection UI element wired to the new parameter — currently entirely absent" (:72-73). **It does not cover the browser switcher itself.**

**Action: hybrid of (c)/(d), not a clean (a).** Do **not** promote — the server portion's open questions (path segment vs. body field, error contract, `openapi.yaml` impact) are unresolved and nothing needs them yet (see §2). Do **not** treat "SPA needs a UI" as a browser design to promote — it was never designed here. Correct action:
- Fix the stale fact (a 2nd/3rd/4th module dir now exists, commit `263120b`).
- Add a new dated section, matching the doc's own "Deferral re-confirmation" convention: **"Deferral re-confirmation (SQ-4, 2026-07-22)"** stating the promotion trigger's "second module registered" clause fired, but its other clause — *"a client needs to choose [via the HTTP API]"* — has **not**, because the new browser switcher never calls the HTTP API (verified: `src/app.js` has zero `/api/` fetches; all fetches are relative `./modules/...`, `./examples/...`, `./data/...`). Server-side `moduleId` param stays deferred, for a corrected reason.
- Cross-reference the new switcher PRD as the doc that answers :93, not this one.

**Frontmatter edits:**
| Field | Old | New |
|---|---|---|
| `updated` | `2026-07-21` | `2026-07-22` |
| `maturity` | `shaping` | unchanged (open Qs still open) |
| `related_documents` | absent | add `[<new switcher PRD path>]` |

**Answer to :93 (recommend now, binds the PRD):** **single-module-at-a-time**, not a combined view. Rationale: `engine.js#assess(input, moduleId, ...)` is single-module by design; ranking is an ordinal sort priority per module (CLAUDE.md), so merging two modules' candidate lists into one view would misrepresent relative priority across incompatible scales; and 2 of 4 modules (`growth_suite_v1`, `kidney_suite_v1`) are `notYetImplemented` stubs — a combined view would render broken content beside the one real module. Non-functional modules must be **visibly listed, disabled, and labeled**, never hidden (matches the existing `GET /api/v1/knowledge-base` precedent of disclosing unservable state as-is).

## 2. Server-side scope boundary

Confirmed by grep: `src/app.js`/`algorithmExplorer.js`/`evidence.js` make **zero** calls to `/api/*`; the SPA is fully browser-local. Adding a server `moduleId` param is **out of scope** for this feature. Write down: an explicit non-goal in the new PRD ("no `server.mjs`/`openapi.yaml` changes; the switcher never calls the HTTP API"), and leave `server.mjs:127`'s AC-5 comment untouched — it remains accurate.

## 3. ADR question

ADR-0001's trigger ("before multi-module E1 scale") is about **rule-schema authoring**, not UI selection — its own unresolved reading (OQ-7, `cbc-suite-full-authoring.md:16`) concerns full CBC rule-authoring workstreams, not a switcher. **A module switcher does not trip ADR-0001**; it authors no rules and touches no schema. Do not conflate the two in the PRD.

**New ADR: yes.** Recommend **`docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md`** (next free number), `status: proposed`. Decision to record: a binding, future-facing mapping from `module.json.status` (closed enum: `unsigned-stub`/`integrity-recorded`/`superseded`/`revoked`) to UI affordance — only `integrity-recorded` modules are selectable/assessable; all others are listed but disabled with their real status shown verbatim, never hidden or implied-ready; `superseded`/`revoked` never appear as choosable. This governs every future module, not just today's four, and mirrors the "never hide unservable state" precedent already in `server.mjs`.

## 4. Gates

None of G0–G4 (`docs/governance/gates-registry.md`) gate *shipping* the switcher — it flips no module status, signs nothing, touches no reviewer roster or release record. The relevant discipline is G4's standing principle applied to a new surface: **"no claim that a knowledge-base module is clinically released"** — the switcher's status labels must read `manifest.status` verbatim and never render anything resembling an approval badge. If ADR-0009 is authored, it needs **G0 ratification** eventually, but ships `proposed` (software machinery now, adoption later) — same pattern as ADR-0004/0005/0006. No step here needs human sign-off before this feature ships; the risk is purely about not *implying* one exists.

## 5. Architecture doc edits (`docs/architecture.md`)

- **§2a**: add a subsection describing the client-facing module-selection control — read-only consumer of `listModules()`/`MODULE_IDS`, no new registry.
- **§6**: one line noting the browser now surfaces `manifest.status` per module directly (previously only via server response/`dist/build-info.json`).
- **§10**: add a fail-closed entry — selecting a non-eligible module (stub/unregistered-in-evidence-registry) must show an explicit "not yet available" refusal, never a silent/broken partial render (today `evidence/registry.js` throws on unknown id — the switcher must catch, not crash).
- §7 not applicable — no rule-authoring change.

## 6. New tests / CLAUDE.md

- **`tests/module-switcher-status-labels.test.mjs`**: source-grep or unit test asserting each `module.json.status` value maps to one canonical, exact disclaimer string from a single constant — no per-DOM-location hardcoding, no stub module ever renders text implying release-readiness.
- **`tests/module-switcher-eligibility.test.mjs`**: asserts only `integrity-recorded` modules reach `assess()`; others are structurally blocked in the UI path.
- Update `tests/module-registry.test.mjs`'s `DEFAULT_MODULE_ID` tripwire comment/assertion — its stated trigger ("a UI control... ships") has now fired.
- **`CLAUDE.md`**: yes — its "Architecture orientation" diagram and KB bullet still say only `modules/anemia/rules.json`/91 rules, understating the 4 registered modules. Update to the generic `deriveFacts(input, moduleId)` / `modules/<moduleId>/rules.json` shape, cross-referencing `docs/architecture.md` §2a's inventory table rather than restating anemia-only counts.
