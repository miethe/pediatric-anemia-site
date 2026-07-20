# `tests/witness/` — activation-witness corpus

This directory holds **synthetic, test-only inputs** whose only purpose is to make specific rules
in `modules/anemia/rules.json` fire, so that `scripts/rule-coverage.mjs` can observe them and so
that future migrations/refactors of the rule engine have something to diff against.

**These are not curated clinical worked examples.** They are not published: nothing under
`scripts/build-static.mjs` copies this directory into `dist/`, and `src/app.js`'s example picker
never reads from it. That separation is intentional (see decision D2 in
`.claude/progress/wave0-safety-foundation/phase-0.5-progress.md`) — `examples/*.json` is a
published surface for the clinician-facing microsite; this directory is not.

Rules for any fixture added here:

- Its only job is to make one or more otherwise-unwitnessed rules activate (`assess()`'s
  `provenance.matchedRuleIds` should include the target rule id(s)). It does not need to be a
  plausible "case" beyond internal coherence.
- **No fixture may introduce a clinical threshold, cutoff, or numeric value that is not already
  present in the knowledge base** (`modules/anemia/rules.json`, `modules/anemia/candidates.json`,
  `modules/anemia/reference-ranges.json`). If witnessing a rule seems to require inventing a new
  cutoff, that is out of scope for this corpus and must be escalated, not authored.
- Fixtures may be organized into subdirectories; `scripts/rule-coverage.mjs` walks this directory
  recursively.

Fixture authoring for specific rules is out of scope for this task (EP05-T1) — this README is a
placeholder establishing the location. See `phase-0.5-activation-witness-corpus.md` tasks EP05-T2
through EP05-T4 for the actual fixture authoring.
