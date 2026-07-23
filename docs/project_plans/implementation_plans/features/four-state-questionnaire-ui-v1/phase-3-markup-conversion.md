# Phase 3: Markup Conversion

[Return to Parent Plan](../four-state-questionnaire-ui-v1.md)

**Column conventions**: `Estimate` is story points, never Effort. `Model`: `sonnet-5[1m]`
(ica-delegated). `Effort`: `adaptive` | `extended`. `Provider`: `ica` for implementer tasks, `claude`
for gate/review rows, human tasks carry no Model/Provider at all.

**`integration_owner`: the P2 executor (`sonnet`, `claude`, primary)**, not this phase's `sonnet-5[1m]`
executor. Rationale (hard constraint #5): P2 and P3 share ownership of `src/app.js`/`index.html`'s
markup↔registry↔serialization contract. P3's markup is mechanical (59 uniform hand-edits, ica-suitable
per decisions block §7), but the seam task verifying the contract end-to-end (P3-05) is owned by the
higher-trust executor who already touched the serialization logic in P2, not delegated further.

**OQ-1/OQ-2 are a blocking phase-entry precondition, not a task in this phase's table.** Per decisions
block §9 and PRD §12: the exact option ordering (OQ-1) and clinician-facing wording (OQ-2, e.g. "Not
assessed" vs. "Not asked" vs. a blank placeholder) are **clinical-usability calls, not engineering
calls**. **P3 cannot begin hand-editing 59 fields until a named human has resolved both.** No agent
task in this plan resolves them — an agent proposing wording/ordering on its own would be inventing a
clinical-usability decision the guardrails reserve for a human. P4-05 records where the resolution was
captured (§ Deferred Items in the parent plan).

**Why hand-edit, not a generator (decisions block §4)**: this repo's SPA is deliberately
zero-dependency/no-build-step; `scripts/build-static.mjs` only copies and stamps, never generates
markup. Introducing a generator would be a larger architectural change than this feature and would
move the clinical-review surface out of human-readable `index.html`. The FR-11 parity test (P3-04) is
the accepted mitigation for the copy-paste risk 59 hand-edits carry.

---

## Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Provider | Dependencies |
|---------|-----------|-------------|---------------------|---------:|-------------|-------|--------|----------|--------------|
| P3-00 | **Phase-entry precondition** — OQ-1/OQ-2 resolved by a named human | Not an executable task — a gate. Confirm a named human has recorded the final 4-option ordering (OQ-1) and exact wording (OQ-2, honoring the honesty caveat: copy must not imply the choice changes inference — PRD §3 "honesty caveat") **before** P3-01 begins. Record who decided and where (e.g. an addendum to `decisions-block.md`, or a note in this plan's progress file). | A named human + a recorded decision exist for both OQ-1 and OQ-2 before any markup edit starts; the recorded wording is checked against the honesty caveat (no phrase implying "this changes the assessment") | — | — (human) | — | — | — | None |
| P3-01 | `.quad-select` CSS component (styles.css) | Add a small CSS rule for the new `<select>` fields sized to sit inside the existing `.check-grid` 3-column layout (`styles.css:88-89`) without breaking its density — a `<select>` is naturally more compact than the radio-group alternative rejected in the SPIKE (leg C §5), so this should be a minimal addition, not a new grid system. Verify at the two existing responsive breakpoints (`styles.css:207`, `:214`) that a `<select>` does not overflow at 2-column or 1-column collapse. | New CSS class exists; `.check-grid` 3/2/1-column behavior is preserved at all three breakpoints (source-inspected, not rendered — see Verification Honesty); no other `.check-grid`/`.field-grid` rule is modified | 0.25 | general-purpose | sonnet-5[1m] | adaptive | ica | P3-00 |
| P3-02 | Hand-edit symptoms (14) + exam (5) fields — batch 1 (19 fields) | Convert each of the 19 `symptomNames`/`examNames` checkbox fields (`src/app.js:112-115`, `:131`) from `<label><input name="X" type="checkbox"> Text</label>` to a 4-option `<select name="X">` using the OQ-1/OQ-2-resolved ordering and wording (P3-00), with the not-assessed option's `value=""` (matching P1-01's control-value convention) as the default selected option. Apply uniformly — no per-field special-casing (leg C §1 confirms none exists in current markup). Do **not** touch the 8 `immediateSafetyNames` fields' markup differently from the other 11 symptom fields — the safety-exclusion behavior (P2-05) is JS-side only; the markup conversion is identical for all 14 symptom fields. | All 19 fields converted; each `<select>` has exactly the 4 options from OQ-1/OQ-2 in the resolved order; `value=""` is the default-selected not-assessed option; no field varies the option set (FR-2) | 0.75 | general-purpose | sonnet-5[1m] | adaptive | ica | P3-01 |
| P3-03 | Hand-edit history (40) fields — batch 2 | Convert all 40 `historyNames` checkbox fields (`src/app.js:118-129`) the same way as P3-02, same option set, same ordering, same default. This is the largest single batch (40 of 59 fields) — mechanical and diff-reviewable, one commit hunk per field group is acceptable but the diff should show a uniform, repeated pattern with no field-specific deviation. | All 40 fields converted; identical option structure to P3-02's 19; no field-specific deviation in the diff | 1.25 | general-purpose | sonnet-5[1m] | adaptive | ica | P3-01 |
| P3-04 | FR-11 registry↔markup parity test (`tests/questionnaire-registry-parity.test.mjs`) | Author a new test asserting, in both directions, that the field-name set extracted from `index.html`'s new `<select name="...">` markup exactly equals `symptomNames ∪ historyNames ∪ examNames` (`src/app.js:111-131`) — precedent: `tests/module-switcher-eligibility.test.mjs:29-34`'s raw-text-read pattern (`readFileSync` + regex, no DOM parse). Fail if any registry name is missing from markup, **or** if any markup `<select>` name is absent from the registry (catches a stray/renamed field either direction). This closes the latent hand-sync drift risk that exists today between the name arrays and hand-authored markup, independent of this feature (leg C §2/§7). | Test passes after P3-02/P3-03 land; a deliberately removed or renamed field-name in either the registry or the markup (test-of-the-test) makes it fail in the correct direction | 0.5 | general-purpose | sonnet-5[1m] | adaptive | ica | P3-02, P3-03 |
| P3-05 | **Seam task** — markup↔registry↔serialization contract end-to-end (FR-11, integration_owner) | Owned by the P2 `sonnet`/`claude` executor (integration_owner), not this phase's ica executor, per the header note above. Extends P3-04's name-set parity with the piece it does not cover: that the **literal `<option value="...">` strings** used in the new markup are exactly the four control values `fieldState.js` (P1-01) expects (`''`, `'unknown'`, `'true'`, `'false'`) — i.e., the seam from markup, through the registry, through to what `buildInput()`/`setSimpleField()` actually read and write. This is a real set-equality/string-equality check over extracted text (like P3-04), not a DOM execution — it cannot prove a browser reads the selected option correctly, only that the vocabulary used in markup and the vocabulary `fieldState.js` expects are the same four literal strings, so a copy-paste typo (e.g. `"unkown"`) in one of the 59 fields fails loudly instead of silently defaulting a control to not-assessed. | Test (or an addition to P3-04's file) passes; a seeded option-value typo in one field's markup makes it fail and names the specific field; the check is explicitly labeled text-extraction-based, not DOM-executed | 0.25 | general-purpose (integration_owner: P2 executor, sonnet/claude) | sonnet | adaptive | claude | P3-02, P3-03, P3-04 |
| P3-06 | **Human task** — visual layout check recorded | Per §8 Verification Honesty (Cannot Be Proven — rendering/layout): a named person visually confirms the 59 new `<select>` fields render correctly inside the `.check-grid` 3-column layout at representative viewport widths (desktop, the `styles.css:207` 2-column breakpoint, the `:214` 1-column breakpoint), with no overflow, wrapping regression, or visual density break versus the prior checkbox layout. Record the name and date in the phase progress note. This is the P3 slice of the PRD §11 Human-verification acceptance checklist (item 1 of 4) — the remaining three (keyboard operation, safety-reviewed runtime behavior, `form.reset()`) are P4's, since they need P2's rewritten JS live alongside P3's markup. | A named person + date recorded confirming the visual check at all three breakpoints; explicitly not claimed as an automated result | — | — (human) | — | — | — | P3-02, P3-03, P3-01 |
| P3-GATE | `task-completion-validator` gate | Verify the Phase 3 exit gate (decisions block §6): FR-11 parity test green (P3-04); the seam test (P3-05) green; the human visual pass recorded (P3-06). **Reject if** any field's option set deviates from the OQ-1/OQ-2-resolved standard, if the parity test was written to pass by construction rather than by genuinely deriving both sides from source, or if P3-06 is missing a named signer. | All exit-gate criteria pass; recorded in phase progress note | — | task-completion-validator | sonnet | adaptive | claude | P3-01..P3-06 |
| P3-REVIEW | Cross-family adversarial diff review | `codex`/`gpt-5.6-terra` reviews the P3 diff read-only for the 59-field mechanical-edit failure mode this phase is most exposed to: a copy-paste field-name/option-value mismatch that P3-04/P3-05's tests might not catch if the test itself was authored against the same wrong assumption as the markup. Spot-checks a sample of fields against the registry directly, independent of the new tests' own logic. | Review recorded; any finding either fixed in-phase or logged for P4 pickup | — | gpt-5.6-terra | codex | medium | codex | P3-02, P3-03, P3-04, P3-05 |

**Phase 3 Quality Gates:**
- [ ] OQ-1/OQ-2 resolved by a named human before any markup edit (P3-00)
- [ ] All 59 booleanMap fields (14 symptoms + 40 history + 5 exam) converted to the 4-option `<select>`
- [ ] Every field has the identical 4-option set, identical default (`value=""`, not-assessed)
- [ ] `.check-grid` 3/2/1-column density preserved at all three breakpoints (source-inspected)
- [ ] FR-11 registry↔markup parity test green, both directions
- [ ] Markup↔registry↔serialization seam test (P3-05) green — option-value vocabulary matches `fieldState.js` exactly
- [ ] Human visual pass recorded with a named signer and date
- [ ] **Gate criterion**: `npm run check` shows exactly the 8 recorded baseline failures and no others

[Return to Parent Plan](../four-state-questionnaire-ui-v1.md)
