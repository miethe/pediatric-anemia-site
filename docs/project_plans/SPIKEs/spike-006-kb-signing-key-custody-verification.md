---
schema_version: 2
doc_type: spike
title: "SPIKE-006: KB Signing Key Custody and Browser-Side Verification"
status: draft
created: 2026-07-19
feature_slug: wave0-safety-foundation
research_questions:
  - "Where does the signing private key live for a solo-operator project, and what does the threat model actually defend against?"
  - "Where does the public key live so browser-only mode can verify without a server?"
  - "What signing primitive is used — Ed25519 via WebCrypto, detached signature, or content hash + manifest chain?"
  - "What does the server do on verification failure vs. the browser (ARCH §10 fail-closed)?"
  - "How does key rotation work, and what happens to previously-signed KBs?"
  - "Is cryptographic signing meaningful at all pre-clinical-validation, or is the real deliverable the hash + manifest chain with signing deferred?"
complexity: M
estimated_research_time: "4h"
related_documents:
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
  - docs/project_plans/design-specs/signed-kb-manifest.md
  - docs/project_plans/design-specs/module-manifest-json-schema.md
  - docs/project_plans/design-specs/evidence-dual-source-unification.md
  - docs/architecture.md
  - .claude/worknotes/wave0-safety-foundation/repo-current-state.md
---

# SPIKE-006: KB Signing Key Custody and Browser-Side Verification

Gates **Phase 1** (P1-WP5, roadmap `docs/project_plans/expansion/01-platform-expansion-
roadmap.md:162`). Companion design spec: `docs/project_plans/design-specs/signed-kb-manifest.md`
(DEF-4, maturity `idea`) — **DEF-4 explicitly names this SPIKE's exact questions as its own
unresolved central open question** ("the actual signing mechanism ... is the central open question
a SPIKE must resolve before this becomes a `shaping`-level spec"). This SPIKE is that SPIKE.

## What DEF-4 already settles vs. leaves open

DEF-4 already settles: the manifest **shape** (`clinicalContentHash`, `engineCompatibility`,
`evidenceReviewedThrough`, `approvedBy[]`, `validationRunId`, `supersedes`, `releasedAt` — matching
`docs/architecture.md` §6 verbatim, and already present as null/empty stub fields in `modules/
anemia/module.json`, confirmed by direct read); that `clinicalContentHash` is a digest over the
canonicalized concatenation of the module's 4 KB JSON files (order/canonicalization TBD); that
`approvedBy` is the *machine-readable record* of an out-of-band human clinical-review process, not a
replacement for it; that load-time verification recomputes the hash and refuses to serve/build on
mismatch, with `status` flipping from `"unsigned-stub"` to a released state only once required
fields are populated.

DEF-4 leaves open, verbatim: cryptographic vs. procedural signing; where keys live and who holds
them; what `validationRunId` references; whether `status` needs more states (`superseded`,
`revoked`); and whether DEF-1 (evidence dual-source) is resolved as a byproduct of this work. This
SPIKE resolves all of these for a solo-operator, static-deploy context specifically.

**DEF-1 interaction (evidence-dual-source-unification.md):** DEF-1's own open question asks whether
its SPIKE folds into this one. Recommend: **keep structurally separate** — DEF-1 is a data-
consolidation/loader problem (`src/evidence.js` vs. `modules/anemia/evidence.json`), this SPIKE is a
custody/verification problem — but note a hard sequencing dependency: `clinicalContentHash` cannot
be a meaningful integrity guarantee while two independently-editable evidence copies exist
(repo-current-state.md's cross-cutting observation, `:436-438`: "extending `evidence.json` for
exact-passage without collapsing `src/evidence.js` first means WP5's manifest hash would need to
hash two files that can drift from each other, defeating the concept's integrity guarantee"). This
SPIKE's RQ3 (hashing scope) must therefore state explicitly that DEF-1 needs resolving *before* or
*as part of* whatever release-signing flow this SPIKE designs, not as an independent parallel track.

**DEF-5 interaction (module-manifest-json-schema.md):** DEF-5 defers formalizing `schemas/module-
manifest.schema.json` until DEF-4's signing fields settle. This SPIKE's output — the concrete
`status` enum and any new manifest fields (e.g. a `signature` field, a `keyId`) — is exactly the
input DEF-5 is waiting on. Sequence DEF-5's schema authoring immediately after this SPIKE closes.

## Scope

**In scope**: threat model for a static GitHub-Pages deploy specifically; key custody options for a
single-maintainer project; signing primitive selection; browser-side (no-server) verification path;
server-side verification-failure behavior; key rotation; the honest signing-vs-hash-chain
recommendation.

**Out of scope**: building a multi-party/multi-reviewer key-management system (no second
contributor/reviewer exists today per DEF-4's own open question); the semantic-diff classifier
itself (SPIKE-005's concern — this SPIKE only decides what gates a release, not how a change is
classified).

## Research questions & exit criteria

### RQ1 — Key custody and honest threat model
Where does the signing private key live, and what does the threat model actually defend against —
tamper-in-transit, unreviewed content shipping, or provenance for auditors?
**Exit criterion**: an explicit, non-euphemistic threat-model statement naming which of the three
this design defends against and which it explicitly does **not**, given the deploy target is
`.github/workflows/deploy-pages.yml` (repo-current-state.md §D — the only CI workflow, gated on
`push: branches: [main]`/`workflow_dispatch`, no PR-trigger gate today) publishing to static
GitHub Pages. Must state plainly: if the same person who authors KB content also holds the signing
key and runs the release script on their own machine or in CI under their own account, the
signature proves "this exact byte content was what the release script signed," it does **not**
prove independent clinical review happened — that guarantee still depends entirely on the
out-of-band human process CLAUDE.md's guardrail requires. A design that implies otherwise is a
finding to flag, not a design to ship quietly.

### RQ2 — Public key location for browser-only verification
**Exit criterion**: a concrete decision on where the public key (or hash-chain root) is embedded so
`src/app.js`'s browser-only mode (no server involved for the static site, per SPIKE-001 RQ5's
finding that `index.html`/`src/app.js` fetch KB JSON directly with no build-time bundling) can
verify without a network call to anything other than the already-fetched KB files themselves — e.g.
committed as a literal constant in a new `src/kbVerify.js` (analogous to how `src/evidence.js`
already ships hardcoded consts for synchronous browser access, repo-current-state.md §B) vs. a
separate fetched `public-key.json`. State explicitly why a server-fetched public key would be
circular (the thing verifying trust in the KB would itself need to be trusted, and it travels over
the same static-hosting channel as the KB it verifies).

### RQ3 — Signing primitive and hashing scope
**Exit criterion**: one decision among Ed25519-via-WebCrypto detached signature, a simpler HMAC-style
shared-secret scheme, or (per RQ6) a plain content-hash + manifest chain with no cryptographic
signature at all — justified against `docs/architecture.md` §9's "cryptographic signature
verification for KB packages" line (`:175`) and §6's manifest shape. If a real signature is chosen,
must also specify exactly which bytes are hashed/signed — per the DEF-1 interaction above, this
cannot be finalized independent of whether `src/evidence.js` and `modules/anemia/evidence.json`
have been unified; state the dependency explicitly rather than picking an input set that silently
assumes DEF-1 is already resolved.

### RQ4 — Verification-failure behavior, server vs. browser
**Exit criterion**: for each surface, the exact fail-closed behavior per `docs/architecture.md` §10
(`:178-188`, "a failed system should display a clear 'no assessment produced' state, not stale or
partially calculated advice"): **server** — `server.mjs`'s current `loadModuleData()`/startup loop
(`:19-48`) already fails fast (`process.exit(1)`) on missing/unparseable JSON but tolerates a
missing `module.json` entirely (`:26-31`, catches `ENOENT` and continues with `manifest: null`) —
this SPIKE's exit criterion must specify the exact new behavior replacing that tolerance: manifest
required, hash/signature verified, `process.exit(1)` (not a per-request 4xx) on failure, since a
bad KB must never come up silently at all, matching the existing all-or-nothing startup pattern
rather than inventing a new one. **Browser** — since there is no server in static-deploy mode, the
equivalent must be a startup check in `src/app.js` before rendering any assessment UI, producing the
"no assessment produced" state ARCH §10 requires rather than falling through to `showFatalError()`'s
generic message (`src/app.js:627-630`) — state whether this needs a distinct UI state from today's
fatal-error path.

### RQ5 — Key rotation
**Exit criterion**: a concrete answer to what happens to a previously-signed KB when the key
rotates — does `module.json`'s `supersedes` chain (DEF-4 design sketch) carry a `keyId` per release
so old signatures remain verifiable against an archived public key, or does rotation invalidate all
prior releases' verifiability (acceptable only if explicitly stated as a deliberate simplification
for a project with no released clinical-validated KB yet)? Must also state the operational trigger
for rotation in a solo-operator context (compromise suspicion vs. routine rotation) and who performs
it, given RQ1's finding that there is currently only one operator.

### RQ6 — Signing vs. hash + manifest chain: an honest recommendation
**Exit criterion**: a direct go/no-go recommendation, not a menu. Weigh: the project is explicitly
an **unvalidated research prototype** (CLAUDE.md status line) with no released, clinically-validated
KB yet; `module.json`'s `status: "unsigned-stub"` is today's honest, self-documenting placeholder
(DEF-4 body); a full cryptographic-signature apparatus (key generation, custody, rotation, browser
WebCrypto verification code) is real engineering cost for a threat RQ1 already shows is only
partially defended (author-holds-key does not prove independent review). The exit artifact must
state plainly whether the recommendation is: (a) ship signing now, or (b) defer cryptographic
signing and ship only `clinicalContentHash` + the `supersedes` manifest chain — giving auditable,
tamper-evident-if-diffed provenance (a changed hash is visible in git history and in the manifest
chain) without claiming a security property the deploy model can't actually back up — with
signing revisited once there is a second reviewer/contributor or a real clinical-validation gate
passed. **This recommendation must be made even if it is uncomfortable** — the charter's job is to
force the honest answer, not the more impressive-sounding one.

## Method

1. Re-confirm `server.mjs`'s current manifest-tolerance behavior and `module.json`'s stub shape by
   direct read (done above) rather than trusting a summary.
2. For RQ1/RQ6, this is primarily a reasoning/judgment exercise grounded in the project's actual
   deploy model (`deploy-pages.yml`, static hosting, single maintainer) — do not default to
   "cryptographic signing is best practice" without weighing it against this project's actual threat
   surface and CLAUDE.md's validation-gate ladder (content → technical → retrospective → silent-mode
   → human-factors → interventional — signing a KB that hasn't passed any of these gates yet
   protects a claim of trustworthiness the KB doesn't yet have).
3. For RQ3, if Ed25519/WebCrypto is a live candidate, do a short (≤30 min) feasibility check of
   WebCrypto API availability/ergonomics for detached-signature verification in a plain `<script
   type="module">` browser context with no build step (matches SPIKE-001's finding that the browser
   SPA is genuinely unbundled).
4. Route RQ1's threat-model statement and RQ6's recommendation through `council-review` before
   treating either as final — this is exactly the kind of safety/governance-adjacent judgment call
   roadmap AOS wiring (`:230`) assigns to the safety council.

## Overall SPIKE exit criteria

Closed when: (1) RQ1's threat-model statement names what is and is not defended against, with no
euphemism; (2) RQ6's recommendation is explicit (signing now vs. defer to hash+chain) and has passed
`council-review`; (3) RQ2–RQ5 each have a recorded decision consistent with whichever RQ6 path is
chosen (if RQ6 recommends deferring signing, RQ2–RQ5 should be answered for the hash-chain-only
design, not left dangling as if signing were still assumed); (4) the DEF-1 sequencing dependency
(RQ3) is stated explicitly, not silently assumed away.

## Timebox

**Timebox: 4 hours.** If the timebox expires before RQ5 (key rotation) is fully resolved: ship RQ1,
RQ2, RQ3, RQ4, RQ6 as final (RQ6's recommendation is the load-bearing decision and must not be
deferred), and record RQ5 as an explicitly open follow-up — key rotation only matters once a key
exists, so if RQ6 recommends deferring signing entirely, RQ5 becomes moot for Phase 1 and should be
marked "not applicable pending RQ6" rather than researched further under time pressure.

## Decision impact

| P1 work package | Blocking? | Default/fallback if this SPIKE is skipped |
|---|---|---|
| P1-WP5 (signed KB manifest + semantic diff) | **Direct, hard block** on the manifest/signing half | Cannot start — `scripts/sign-kb.mjs` and `server.mjs`'s fail-closed manifest verification (roadmap `:162`) are literally this SPIKE's output. |
| P1-WP7 (review-portal concept) | Soft | WP7's `approvedBy[]`-emission contract assumes *some* manifest verification story exists; if skipped, WP7 design has no concrete target to emit into. |

**If skipped**: the default fallback is `server.mjs` continuing to tolerate a missing/unverified
manifest indefinitely (today's `ENOENT`-tolerant behavior, `server.mjs:26-31`), which directly
contradicts ARCH §10's "fail closed ... when the KB package signature/hash is invalid" requirement
and the roadmap's V2 no-go criterion ("unsigned/expired KB not rejected by the server," `:225`).
Skipping this SPIKE is equivalent to accepting that no-go condition as permanent, not deferring it.

## Citations

- `docs/project_plans/expansion/01-platform-expansion-roadmap.md:162, 225, 230`
- `docs/project_plans/design-specs/signed-kb-manifest.md` (DEF-4)
- `docs/project_plans/design-specs/module-manifest-json-schema.md` (DEF-5)
- `docs/project_plans/design-specs/evidence-dual-source-unification.md` (DEF-1)
- `docs/architecture.md` §6 (`:103-122`), §9 (`:167-176`), §10 (`:178-188`)
- `.claude/worknotes/wave0-safety-foundation/repo-current-state.md` §B, §D, §G (P1-WP5 row), cross-cutting observation
- `server.mjs:19-48`, `modules/anemia/module.json`, `src/app.js:627-630`
