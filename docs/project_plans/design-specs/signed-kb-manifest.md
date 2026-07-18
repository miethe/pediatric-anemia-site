---
doc_type: design_spec
title: "Signed KB Manifest"
status: draft
maturity: idea
created: 2026-07-18
feature_slug: platform-foundation-p0
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
---

# Signed KB Manifest (DEF-4)

## Problem / Context

CLAUDE.md's hard guardrails require "No AI-published rule changes... Rule/KB edits require
independent clinical review + executable tests + signed release," and `docs/architecture.md` §7
names a "signed manifest" among the planned production-hardening additions. Today, nothing in this
codebase cryptographically or procedurally proves that a given `modules/anemia/{rules,candidates,
evidence,reference-ranges}.json` payload was actually reviewed and approved before release — there
is no hash, no signer identity, no approval record, and no mechanism to verify at load time that
the KB content matches what was signed off.

The Deferred Items Triage Table categorizes this as **dependency-blocked**: it is the same signing/
loading mechanism DEF-1 (evidence dual-source unification) also depends on, and building it is a
substantial feature in its own right (key management or equivalent, a signing/verification step in
the release process, a loader that checks the signature before trusting content) — well outside
the scope of Platform Foundation P0's structural, zero-behavior-change refactor.

## Current State (what P0 actually shipped)

P0 ships the **shape** the manifest will eventually fill, explicitly marked unsigned, so that
Phase 1 can populate real fields without a breaking shape migration. `modules/anemia/module.json`:

```json
{
  "id": "anemia",
  "title": "Pediatric Anemia",
  "schemaVersion": 1,
  "status": "unsigned-stub",
  "knowledgeBaseVersion": "0.1.0-2026-07-15",
  "evidenceReviewedThrough": "2026-07-15",
  "engineLabel": "Pediatric Anemia Deterministic CDSS",
  "supportedAgeMonths": { "min": 6, "max": 216 },
  "clinicalContentHash": null,
  "approvedBy": [],
  "validationRunId": null,
  "supersedes": null,
  "releasedAt": null
}
```

Every signing-relevant field is explicitly `null`/empty and `status` is literally the string
`"unsigned-stub"` — this is a deliberate, self-documenting placeholder, not an oversight.
`scripts/validate-kb.mjs` reads this manifest and enforces exactly two things against it today:
that `manifest.id` matches the module directory name, and that `manifest.knowledgeBaseVersion` /
`manifest.evidenceReviewedThrough` byte-match `src/evidence.js`'s exported
`KNOWLEDGE_BASE_VERSION`/`REVIEWED_THROUGH` consts (the P6-T2 drift check, see DEF-1). Nothing in
the codebase reads or checks `clinicalContentHash`, `approvedBy`, `validationRunId`, or
`supersedes`/`releasedAt` — they exist as schema placeholders only.

## Design Sketch

At an idea-stage level:

1. **Content hashing.** `clinicalContentHash` becomes a real digest (e.g. SHA-256) computed over
   the canonicalized concatenation of the module's `rules.json` + `candidates.json` + `evidence.
   json` + `reference-ranges.json` (order and canonicalization rules TBD — JSON key ordering must
   be normalized for a stable hash). A release script computes and stamps this at signing time.
2. **Signing/approval record.** `approvedBy` becomes a list of `{ reviewer, role, approvedAt }` (or
   equivalent) entries populated by whatever human clinical-review process CLAUDE.md's "independent
   clinical review" guardrail already requires out-of-band — this manifest becomes the *machine-
   readable record* of that review, not a replacement for it. `validationRunId` ties the release to
   a specific `npm run check` / equivalence-harness run's output (candidate: golden-fixture run ID
   or CI job ID).
3. **Load-time verification.** `server.mjs`, `scripts/build-static.mjs`, and (eventually) the
   browser loader recompute the content hash at load time and refuse to serve/build if it doesn't
   match `clinicalContentHash`, and `status` flips from `"unsigned-stub"` to something like
   `"signed"`/`"released"` only once all required fields are populated — `scripts/validate-kb.mjs`
   is the natural place to add this check, extending its existing manifest-field validation.
4. **`supersedes`** becomes a pointer to the prior manifest's hash/version, giving an auditable
   release chain.

None of this is committed — the actual signing mechanism (asymmetric key signature vs. a simpler
"approver recorded a hash in a reviewed PR" convention) is the central open question a SPIKE must
resolve before this becomes a `shaping`-level spec.

## Promotion Trigger

Phase 1 manifest-signing track (per the Deferred Items Triage Table).

## Open Questions

- Is "signed" cryptographic (asymmetric signature, key management, verification library) or
  procedural (a hash recorded in a reviewed, merge-gated PR, verified by CI recomputing the hash)?
  The latter may be sufficient for a single-maintainer research prototype and dramatically cheaper.
- Where do signing keys (if cryptographic) live, and who holds them — is this even appropriate
  before the platform has more than one contributor/reviewer?
- Does `validationRunId` reference the golden-fixture equivalence-harness run, a CI run, or a
  separate clinical-validation-gate run (content → technical → retrospective → silent-mode →
  human-factors → interventional, per CLAUDE.md's validation-gate ladder) — these are different
  things and the manifest should be unambiguous about which it records.
- Does `status` need more states than `unsigned-stub` → `signed` (e.g. `superseded`, `revoked`)?
- How does this interact with DEF-1 — does the signed manifest become the single evidence source of
  truth, resolving DEF-1 as a byproduct, or are they independent tracks that happen to share a
  dependency?
