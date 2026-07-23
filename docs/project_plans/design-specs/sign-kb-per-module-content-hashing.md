---
schema_version: 2
doc_type: design_spec
title: "Per-module content hashing in `scripts/sign-kb.mjs` (DF-SMS-01)"
status: draft
maturity: shaping
created: 2026-07-23
updated: 2026-07-23
feature_slug: spa-module-switcher
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
related_documents:
  - .claude/findings/spa-module-switcher-findings.md
  - docs/architecture.md
open_questions:
  - "What is the exact per-module file inventory each `clinicalContentHash` should be computed over — every module's KB is the same four JSON files, but the raw-byte source files anemia currently hashes (`src/ranges.js`, `src/facts.anemia.js`) are anemia-specific; do non-anemia modules have equivalent source files, and does the hash need to enumerate them per-module or generalize to a per-module directory tree?"
  - "Does `build-static.mjs:54-55`'s per-module invocation need to change signature to pass a module id, or does `sign-kb.mjs` become module-aware by reading the module id from the invocation context (e.g. the CWD or an explicit `--module` flag)?"
  - "How does verification (`src/kbVerify.js#verifyManifest`) evolve — today it re-computes `clinicalContentHash` over an anemia-shaped file list; a per-module fix must generalize the recomputation the same way, or verification would silently pass a module whose signed hash was over anemia's content."
  - "Once per-module hashing is correct, does FR-31's renderer allow-list relax to permit surfacing `clinicalContentHash` and `hashes.recomputed` in the module row/banner, or does it stay closed until a clinical-review gate (§7) also passes?"
explored_alternatives:
  - "Fix `sign-kb.mjs` in place — change the hardcoded file list to a module-id-parameterized enumeration and thread the module id through `build-static.mjs`. Preserves the two-part manifest scheme (`clinicalContentHash` + `governanceHash`), touches only the signing/verification seam, and can be gated by a regression test that seeds a synthetic non-anemia module and checks that its hash is over its own files, not anemia's."
  - "Replace `clinicalContentHash` with a per-file digest list — instead of one aggregate hash, emit `hashes.files[]` recording each KB file's SHA-256 individually. Makes drift attribution finer-grained but breaks the current single-hash verification path and requires a schema migration to `module-manifest.schema.json`."
  - "Defer the fix until a clinician-facing surface actually needs to render a hash — the current setup is masked because non-anemia modules ship `hash: null` and the browser SPA's FR-31 forbids surfacing any hash-shaped field. Leaves the defect in place indefinitely; explicitly rejected here as the reason this spec exists."
---

# Per-module content hashing in `scripts/sign-kb.mjs` (DF-SMS-01)

## Problem / Context

`scripts/sign-kb.mjs:58-73` hardcodes the file inventory each module's `clinicalContentHash` is
computed over. Specifically, the hash includes:

- `modules/anemia/rules.json`
- `modules/anemia/candidates.json`
- `modules/anemia/evidence.json`
- `modules/anemia/reference-ranges.json`
- `src/ranges.js` (raw-byte source hash — anemia's threshold code)
- `src/facts.anemia.js` (raw-byte source hash — anemia's fact-derivation code)

`scripts/build-static.mjs:54-55` invokes `sign-kb.mjs` per-module with **no module id** — the script
reads the same anemia file list on every invocation. The consequence: every module's signed
`clinicalContentHash`, were it ever populated, would be a hash over anemia's files rather than the
invoking module's own KB.

**The defect is currently masked, not fixed.** The three non-anemia modules (`cbc_suite_v1`,
`growth_suite_v1`, `kidney_suite_v1`) ship `clinicalContentHash: null`, and `src/kbVerify.js:240`
short-circuits on `null` (an `unsigned-stub` module never has its hash verified). Anemia's own hash
happens to be over anemia's files and so is not itself misattributed. Nothing today produces a
non-anemia hash, so nothing today reads a misattributed one — but the surface is wired to produce
misattributed hashes the moment a second module is signed, and any UI surface that emitted a
`clinicalContentHash` value under the current shape would emit a false attestation of what the hash
covers.

## Why this stays off-screen right now (FR-31)

`spa-module-switcher-v1`'s FR-31 renderer allow-list (`docs/project_plans/PRDs/features/spa-module-switcher-v1.md`
§6.1.B, verified at P6-008) restricts the module row/banner renderer to reading only `id`, `title`,
`status`, `knowledgeBaseVersion`, `evidenceReviewedThrough`, and `approvedBy.length`. It explicitly
forbids reading `clinicalContentHash`, `hashes.recomputed`, `governanceHash`, `validationRunId`, or
`clinicalApprovers`; it also forbids `JSON.stringify(manifest)`, `{...manifest}`, and any spread of
the manifest into a `data-*` attribute, `innerHTML`, or `textContent`. This closes the surface at
the renderer boundary; the token scan in P6-008 (secondary layer) additionally rejects the substring
`sha256:` in the built output.

**FR-31's prohibition is a guard, not a fix.** It keeps a misattributed hash from reaching a
clinician while the defect exists; it does not remove the defect. The defect must be fixed before
any clinician-facing surface may relax FR-31 to render a hash value.

## Design Sketch

Once a second module reaches `status: integrity-recorded` (see promotion trigger), the fix is:

1. **Parameterize the file list.** Replace `sign-kb.mjs`'s hardcoded anemia paths with a per-module
   enumeration — for each module, hash its own `modules/<id>/{rules,candidates,evidence,reference-ranges}.json`.
   The raw-byte source-file inputs (`src/ranges.js`, `src/facts.anemia.js`) need a per-module
   equivalent: each module owns its own `facts.<id>.js` and its own `ranges.js` shape today via
   `src/facts/registry.js` and `src/ranges/registry.js`, so the enumeration reads from those
   registries rather than a hardcoded path list.
2. **Thread the module id through `build-static.mjs`.** Either add an explicit `--module <id>` flag
   to `sign-kb.mjs` and pass it from `build-static.mjs:54-55`'s per-module loop, or make `sign-kb.mjs`
   infer the id from CWD/`process.env`. The explicit flag is preferred — infer-from-context is a
   silent-failure surface.
3. **Generalize verification the same way.** `src/kbVerify.js#verifyManifest` recomputes the hash to
   verify it; the recomputation must be over the same per-module file list, or verification would
   pass a module whose signed hash was over anemia's content while its actual files had drifted.
4. **Add a regression test.** Seed a synthetic two-module fixture, sign both, and assert that the
   two resulting hashes are distinct — a false hardcoded-anemia fix would make the two hashes
   collide.

The concrete API shape (positional argument vs. flag; whether the module id is a `sign-kb.mjs`
argument or a `build-static.mjs` orchestration concern) should be decided against the second
module's actual `integrity-recorded` transition, not speculatively now.

## Prerequisite relationship

This spec is a **hard prerequisite** for any integrity-hash UI or any clinician-facing surface that
would render `clinicalContentHash`, `hashes.recomputed`, `governanceHash`, or any hash-shaped
manifest field. `spa-module-switcher-v1`'s FR-31 must stay closed until this defect is fixed;
relaxing FR-31 before this spec is executed would let a misattributed hash reach a clinician.

## Promotion Trigger

Anyone proposes surfacing a hash, `hashes.recomputed`, or per-module integrity status in a
clinician-facing surface. Concretely: any PR that touches `src/moduleManifests.js`'s renderer
allow-list to add a hash-shaped field, or that adds a hash-shaped column to the SPA's module
selector, or that writes a hash-shaped value into any `data-*` attribute, `innerHTML`, or
`textContent` in an `APP_SURFACE_FILES` entry.

Independently: any module other than `anemia` transitioning to `status: integrity-recorded`, at
which point its signed hash would be over anemia's files if this spec has not yet been executed.

## Open Questions

(See frontmatter `open_questions`.)

## References

- `scripts/sign-kb.mjs:58-73` — the hardcoded file list this spec targets.
- `scripts/build-static.mjs:54-55` — the per-module invocation site with no module id.
- `src/kbVerify.js:240` — the `null`-short-circuit that currently masks the defect.
- `src/kbVerify.js#verifyManifest` — the recomputation path that must be generalized alongside the
  signing fix.
- `docs/project_plans/PRDs/features/spa-module-switcher-v1.md` §6.1.B (FR-31) — the renderer
  allow-list that keeps a misattributed hash off-screen today.
- `.claude/findings/spa-module-switcher-findings.md` Finding P-1 — the recorded finding this spec
  answers.
- `docs/architecture.md` §2a — the module-inventory table naming which modules currently ship
  `hash: null`.
