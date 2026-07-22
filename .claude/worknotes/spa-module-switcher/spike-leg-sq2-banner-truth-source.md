---
schema_version: 2
doc_type: report
report_category: investigations
title: "SPIKE leg SQ-2: banner truth source & browser honesty boundary"
status: draft
created: 2026-07-22
feature_slug: spa-module-switcher
---

# SQ-2 — Where banner truth comes from, honestly

## 1. Candidate truth sources

| | (a) fetch module.json + run `verifyManifest()` in-browser | (b) fetch `dist/build-info.json` | (c) static `import … with {type:'json'}` |
|---|---|---|---|
| **Dev (no `dist/`)** | Runs, but see §2 — verdict is structurally incomplete | **FAILS.** No `build-info.json` exists at repo root (verified: untracked, `.gitignore:2` = `dist/`). Banner would be "unknown" in dev only | **Works.** Precedent already shipped: `modules/anemia/facts.anemia.js:5` imports `./module.json`; `src/evidence.js:9` imports `evidence.json` |
| **Built `dist/`** | **FAILS — decisive.** `verifyManifest` needs raw-byte SHA-256 of `ranges.js` + `facts.anemia.js` (`kbVerify.js:60-68`, `sign-kb.mjs:68-76`). `build-static.mjs:139-153` **rewrites every `.js`** to add `?v=`. Verified: `modules/anemia/ranges.js` = `49a597cb…`, `dist/…/ranges.js` = `d154a20c…`. `clinicalContentHash` can **never** match in `dist/` | Works | Works |
| **`?v=` stamping** | Breaks it (above) | JSON untouched (`:140` skips non-`.js`); `build-info.json` written post-stamp (`:213`) | Survives — specifier stamped at `:144`, JSON MIME unaffected. Verified: `rules.json` bytes identical dev↔dist |
| **`check:imports`** | Fetches of `./modules/<id>/…` resolve; but literal-only, 4 fetches | **FAILS** pass (a): `checkFetchSpecifier` resolves `./build-info.json` against `repoRoot` (`check-app-imports.mjs:137-141`) → missing in dev → exit 1 | Passes, **if** the new file is added to `APP_SURFACE_FILES` (`:48`) — pass (a) is explicitly non-transitive (`:46-47`) |
| **Cost** | 4 modules × 6 files = 24 fetches + 6 WebCrypto digests + JCS canonicalization of the whole KB, on load | 1 fetch, async, one failure mode | 4 JSON files in the initial static graph; anemia's is already there |

## 2. What `verifyManifest()` can prove in a browser

Checks performed (`src/kbVerify.js`): schema errors folded in `:234-237`; `clinicalContentHash` present+matching `:240-244`; `governanceHash` present+matching `:246-250`; `validationRunId` non-empty `:252-254`; `status === 'integrity-recorded'` `:256-258`; `schemaVersion` supported `:260-271`; evidence expiry `:273-279`.

Inputs the browser **cannot** supply:

- **`schemaErrors`** — the file's own doc comment (`:185-188`) states it does not validate; the validator is `scripts/lib/json-schema-lite.mjs`, deliberately unreachable from a browser build. Node callers compute it (`server.mjs:37-39`, `build-static.mjs:53`). A browser passing the default `[]` (`:207`) is asserting "no schema errors" **without having looked** — a silent false negative.
- **`sourceFiles`** raw bytes — impossible in `dist/` (§1). So `clinicalContentHash` is either unverifiable or falsely mismatching.

`governanceHash` **is** browser-computable (`:217` uses only `moduleId` + manifest fields). But a manifest that lies about itself self-consistently still hashes correctly — `governanceHash` proves internal consistency, not content authenticity.

**Honesty boundary:** *The browser has verified nothing about this module's knowledge base. It has read the module's published manifest and is displaying its declared fields. It has NOT recomputed the content digest, NOT validated the manifest against its schema, and NOT confirmed the rules it loaded are the rules that were signed.*

## 3. The `sign-kb` defect — CONFIRMED

`sign-kb.mjs:36` hardcodes `moduleDir = modules/anemia`; `loadKbJsonFiles()` `:58-65` and `loadKbSourceFiles()` `:68-76` take **no module argument** and emit literal `modules/anemia/<f>` paths. `build-static.mjs:54-55` calls both inside the `for (const moduleId of MODULE_IDS)` loop (`:44`); `server.mjs:81-82` does the same. So every module's `clinicalContentHash` is recomputed from anemia's six files. `governanceHash` is **not** affected (`kbVerify.js:217` passes the real `moduleId` + that module's fields).

**Currently masked, not benign:** all three non-anemia manifests have `clinicalContentHash: null`, so `kbVerify.js:240` short-circuits on "missing" and the wrong-recompute branch `:242` is never reached. Also `sign-kb.mjs:37` can only ever *write* to anemia. The defect activates the moment a second module is signed.

**Verdict: OUT OF SCOPE for the switcher — but a binding display constraint.** `dist/build-info.json` (`build-static.mjs:180-187`) exposes `status`/`kbVersion`/`evidenceReviewedThrough`/`validationRunId`/`approvedBy`/`supersedes` and **no hashes**, so today's surface does not leak the defect. Therefore: the switcher may surface `status` and `approvedBy`; it **must not** surface any hash, `hashes.recomputed`, or the words "integrity verified"/"content unmodified" — those become actively misleading. Making `sign-kb.mjs` per-module is a **prerequisite for any integrity-hash UI**, not for the switcher. (Note: `sign-kb --check` is not in `npm run check` at all — `package.json scripts.check`.)

## 4. Evidence staleness

Yes — showing `evidenceReviewedThrough` makes the banner a consumer of the expiry verdict, exactly as `evidenceStalenessPolicy.js:11-14` requires ("every caller … MUST … disclose that non-enforcement loudly"). `checkEvidenceExpiry` already returns the disclosure string (`kbVerify.js:132-141`), and it is already carried into `build-info.json` as `evidenceStalenessPolicy.{maxAgeDays:null, enforced:false, disclosure}` (`build-static.mjs:188-192`). Required banner text, adjacent to the date, not in a tooltip: **"Evidence-staleness expiry is not enforced — no governance window has been set. This date is declared by the module, not checked."**

(Aside, real drift found: `kidney_suite_v1` manifest says `0.0.0-2026-07-22`, its `evidence.json` says `0.1.0-2026-07-22`.)

## 5. Recommendation — pick **(c)**, static JSON import

New `src/moduleManifests.js` with four literal `import m from '../modules/<id>/module.json' with { type: 'json' }` lines, exported as a moduleId-keyed frozen map; add it to `APP_SURFACE_FILES` and `DYNAMIC_IMPORT_TARGETS` (`check-app-imports.mjs:48,50-59`).

**Flow:** static import (build-time literal, `?v=`-stamped) → already-parsed object → **no verification step** → render `status`, `approvedBy.length === 0`, `validationRunId`, `evidenceReviewedThrough` + fixed non-enforcement disclosure.

Why not (a): impossible in `dist/`, and its partial verdict would be a *stronger* claim than the runtime earns. Why not (b): dev/prod divergence + `check:imports` failure; keep it as optional enrichment only if a build-verdict badge is later wanted.

**Exact sentence the UI must carry:**

> Status shown is read from this module's published manifest. The browser has not verified it — no content digest was recomputed, no schema was validated, and no check confirms the loaded rules are the rules that were signed. `integrity-recorded` records a content digest only; it is not clinical review, validation, or approval — `approvedBy` is empty for every module. Evidence-staleness expiry is not enforced; "reviewed through" is a declared date, not a checked one.

**Key files:** `/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/module-switcher-spa/src/kbVerify.js`, `/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/module-switcher-spa/scripts/sign-kb.mjs`, `/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/module-switcher-spa/scripts/build-static.mjs`, `/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/module-switcher-spa/scripts/check-app-imports.mjs`, `/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/module-switcher-spa/src/evidenceStalenessPolicy.js`, `/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/module-switcher-spa/src/modules/registry.js`.
