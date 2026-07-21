---
schema_version: 2
doc_type: spike
title: "SPIKE-006: KB Signing Key Custody and Browser-Side Verification"
status: amended-pending-re-review
status_note: "Findings recorded 2026-07-19 (EP0-T5). The council-review pass required by exit criterion (2) and Method step 4 was performed 2026-07-19 (ARC run arc-run-2026-07-19-spike-006-kb-integrity-governance) — OQ-8 is closed-with-caveats, not cleanly closed. VERDICT: RQ1's threat model is UPHELD WITH QUALIFICATION (honest and non-euphemistic, but derived from the browser surface and stated as covering the whole deployment model, and it surveyed only cryptographic custody options). RQ6's NO-GO on cryptographic signing STANDS — no seat argued for signing now. But RQ3/RQ6's *sufficiency* claim does NOT survive: the four-file clinicalContentHash does not cover the JavaScript where real clinical thresholds live (modules/anemia/ranges.js, modules/anemia/facts.anemia.js), does not cover module.json's own governance fields, addresses no expiry requirement, and reaches no API consumer. Six amendments are REQUIRED before EP-5 acts — see OQ-8. Do not read 'clinicalContentHash verified' as 'clinical output unchanged'. The council is a synthetic adversarial review; it is not clinical validation or human approval. Amendments 1-6 landed 2026-07-21 as an additive 'Amended design' section (below the original findings, which are preserved verbatim as the audit trail) — a formal ARC re-review of the amended two-part digest (clinicalContentHash + governanceHash) has NOT been performed."
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

---

## Authorship note

Primary reasoning for this SPIKE was routed to `gpt-5.6-sol` (reasoning effort `xhigh`) via `codex
exec` as a deliberate cross-family lens, per this task's plan (EP0-T5). The section below is a
transcription of that model's output, not independent Claude analysis; disagreement, if any, is
recorded as a labelled dissent rather than silently substituted. Raw transcript:
`/Users/miethe/.claude/jobs/fc2ff3fd/tmp/ep0-t5-codex.md` (Codex accepted `gpt-5.6-sol` on the first
attempt — no fallback to `gpt-5.6-terra` was needed).

## Findings by research question

### RQ1 — Key custody and honest threat model

**Decision**: do not create or hold a signing private key in the current phase. The hash-and-chain
design defends against accidental or partial KB substitution and provides content-level provenance
for auditors. It does **not** defend against unreviewed content shipping or a fully compromised
GitHub account, workflow, or Pages origin.

**Rationale**: the actual actors are — one maintainer authors the clinical content; that same
maintainer controls `main`, can dispatch the workflow, and would hold any signing key; the new PR
`verify` job (`.github/workflows/deploy-pages.yml`, added in EP0-T9/commit `2d1e5cd`) runs the
software gates but cannot reach the Pages `deploy` job, so push-to-main or manual dispatch remains
under the same single account; the public microsite has no PHI, server authentication, or
third-party runtime scripts. A cryptographic signature would prove only "this exact byte content was
what the release script signed" — it would **not** prove "independent clinical review happened."
That assurance can come only from a real out-of-band review process recorded truthfully in
`approvedBy[]`; the signature itself cannot create it. Custody alternatives were weighed and none
change the conclusion:

- **Maintainer laptop**: separates the private key from GitHub, so an independent auditor with an
  out-of-band trusted public key could detect a forged release — but does not protect against laptop
  compromise or the maintainer signing their own unreviewed change.
- **GitHub Actions secret**: offers little separation, since the same account controls content,
  workflow changes, dispatch, and deployment; a compromised account or workflow can invoke or expose
  the key.
- **Hardware token**: makes key extraction harder but cannot stop the maintainer from signing
  unreviewed content, nor protect the browser if an attacker can replace the verification JavaScript.

**Explicitly not defended against**: independent-review bypass by the maintainer; clinical
invalidity, diagnostic error, or failure to pass the validation-gate ladder; malicious replacement of
the KB, manifest, and verifier together at the static origin; general tamper-in-transit by an
attacker capable of defeating HTTPS and replacing all same-origin assets (HTTPS is the primary
transit control — the digest only catches isolated corruption or substitution while the expected
anchor itself remains unchanged).

### RQ2 — Public key location for browser-only verification

**Decision**: no public key, because RQ6 rejects cryptographic signing. Embed the current
hash-chain tip as a literal release anchor in a new `src/kbVerify.js` (e.g. an
`EXPECTED_MANIFEST_HASH` constant) — do not fetch a separate `public-key.json` or trust-root
document. Browser flow: load `module.json` and the four KB JSON inputs at startup, verify the
canonical `module.json` against the embedded anchor, recompute `clinicalContentHash` from the four
KB inputs, and require the result to match. `supersedes` identifies the prior version and prior
canonical manifest digest; historical manifests and their KB inputs must stay retained in release
tags/artifacts so the chain is actually auditable.

**Rationale**: fetching a public key from the same GitHub Pages origin would be circular — the
browser would be trusting the same channel to provide both the content under verification and the
key supposedly establishing trust in that content. Embedding an anchor in JavaScript avoids a
separately mutable key fetch and still detects partial deployment, stale-file mixing, corruption, or
a KB-only replacement — but it does **not** create an independent trust root: an attacker controlling
Pages can replace `src/kbVerify.js` or `src/app.js` along with the KB. Note: `build-static.mjs`'s
existing asset stamp (`?v=<hash>`) is cache-busting, not a clinical-content trust anchor — it is
generated from the deployed assets and is never compared against the manifest.

**Explicitly not defended against**: a compromise capable of replacing the same-origin verification
code — such an attacker can replace the embedded anchor or disable the check entirely.

### RQ3 — Signing primitive and hashing scope

**Decision**: a plain SHA-256 `clinicalContentHash` plus the manifest `supersedes` chain. Not
Ed25519, not HMAC. Hash preimage: the UTF-8 encoding of an RFC 8785/JCS-canonicalized structure —

```json
{
  "domain": "pediatric-cds-clinical-content-v1",
  "files": [
    { "path": "modules/anemia/rules.json", "content": {} },
    { "path": "modules/anemia/candidates.json", "content": {} },
    { "path": "modules/anemia/evidence.json", "content": {} },
    { "path": "modules/anemia/reference-ranges.json", "content": {} }
  ]
}
```

— where each `content` value is the parsed JSON value, `files` order is fixed exactly as shown, and
the result is stored as lowercase hex with a `sha256:` prefix.

**Rationale**: HMAC is unsuitable — browser verification would require shipping the shared secret,
making it non-secret. Ed25519 is technically feasible but offers no meaningful browser trust
improvement without an independently distributed public-key root and a separated release authority
(RQ1/RQ2 already establish neither exists here). SHA-256 is available in both Node and browser
WebCrypto and directly satisfies architecture §10's fail-closed hash/signature requirement.
Architecture §9's cryptographic package-signing control remains an appropriate future
production-hardening goal — it does not justify an ineffective key ceremony now.

**DEF-1 confirmation (RQ3 acceptance criterion)**: DEF-1 is resolved as of commit `2d1e5cd`.
`src/evidence.js` is now a thin loader over `modules/anemia/evidence.json` (`import evidenceData from
'../modules/anemia/evidence.json' with { type: 'json' }`); the former hand-maintained JS evidence
literal is gone. Therefore **the four KB JSON files above are the complete `clinicalContentHash`
scope** — there is no second evidence copy to hash and no independently editable evidence
representation that can drift out of step with what gets hashed. (The now-removed P6-T2
manifest-vs-const drift check in `validate-kb.mjs` existed precisely to catch that class of drift
between two hand-maintained copies; EP0-T6 made it structurally unnecessary rather than leaving it
passing-but-vacuous.) The thin loader and engine code themselves belong to the software/build
integrity surface, not the clinical-content digest.

**Explicitly not defended against**: the digest does not authenticate an author, establish clinical
approval, or prevent a privileged maintainer or origin attacker from changing both content and
expected digest together.

### RQ4 — Verification-failure behavior, server vs. browser

**Decision**: both surfaces fail closed before any assessment is possible.

**Server** — replace `server.mjs`'s `ENOENT` tolerance for `module.json` with mandatory loading and
verification: require a parseable manifest; reject `status: "unsigned-stub"`; recompute the
four-file `clinicalContentHash`; validate the current manifest anchor and `supersedes` shape; on any
failure, log a concise fatal integrity error and call `process.exit(1)` — do not start the HTTP
listener and do not defer failure to a per-request 4xx. This matches the existing all-or-nothing
startup pattern for missing/unparsable KB JSON. `scripts/build-static.mjs` must use the same
verifier and exit nonzero before a Pages artifact can be uploaded. Recommended `status` vocabulary
for DEF-5's schema (supersedes the draft `unsigned-stub` → `signed` binary): `unsigned-stub` (not
loadable once verification is enforced), `integrity-recorded` (hash and chain verified; makes no
cryptographic-signature or clinical-validation claim), `superseded` (retained and verifiable
historically, not current), `revoked` (never loadable for assessment).

**Browser** — `src/app.js` must complete verification before assigning KB data, attaching the
submit/example handlers, or initializing the algorithm explorer. Failure needs a distinct **"KB
integrity blocked"** UI state, not today's generic `showFatalError()` (`src/app.js:627-630`): disable
the entire assessment form and example-loading controls, do not render the rule explorer or any
stale result, display "No assessment produced — the knowledge base could not be verified," and keep
technical details in the console or a non-clinical diagnostic disclosure only.

**Rationale**: the current generic fatal path only replaces the result placeholder — it does not
clearly communicate that assessment is prohibited. Architecture §10 requires an explicit "no
assessment produced" state and forbids stale or partial advice, so this needs to be a distinct state
from today's fatal-error path, not a reuse of it.

**Explicitly not defended against**: successful hash verification proves content consistency only —
it does not prove the verified content is clinically valid or independently reviewed.

### RQ5 — Key rotation

**Decision**: **not applicable pending RQ6.** There is no private key, public key, `keyId`, or
previously cryptographically signed KB, so no key-rotation mechanism should be designed or
implemented now. For the selected hash-chain design, succession is not rotation: every new manifest
records the prior version and prior manifest digest in `supersedes`; previous hash-recorded releases
remain verifiable indefinitely from retained tags/artifacts; a new release does not invalidate
earlier hashes.

**Rationale**: adding archived-key schemas and rotation procedures for a nonexistent key would
preserve the appearance that signing is still planned for this phase, contradicting RQ6. Reopen RQ5
only when the trust boundary actually changes — e.g. an independent release authority must sign,
consumers need to verify packages outside GitHub Pages, or an out-of-band public-key root is
established. At that point compromise suspicion or custody change should trigger rotation (routine
calendar rotation alone is not useful); until roles separate, the solo operator is necessarily the
one who would perform it.

**Explicitly not defended against**: the hash chain has no key-compromise recovery property; its
auditability depends entirely on retained, independently observable git history or release
artifacts.

### RQ6 — Signing vs. hash + manifest chain: an honest recommendation

**Decision — GO/NO-GO: NO-GO on cryptographic signing now.** Defer it; ship
`clinicalContentHash` plus the `supersedes` manifest chain as the Phase 1 deliverable (this is
option (b) of the charter's exit criterion, not (a)).

**Rationale**: in this exact deployment model, signing is theater. The same maintainer authors
content, holds any key, and controls release. The browser obtains the KB, verification code, and any
public key from the same static origin. An origin attacker who can replace the KB can equally replace
the key or verification code — the specific circularity the charter asked to be reasoned about. The
project has not passed any clinical validation gate, so a signature risks visually upgrading
unvalidated content into something that appears clinically endorsed — protecting a claim of
trustworthiness the KB does not yet have. The new PR `verify` job provides useful software-quality
gates but cannot deploy; the same single account still controls push-to-main and workflow-dispatch
publication, so it does not change the custody analysis.

The right-sized deliverable is a canonical content digest, immutable release ancestry through
`supersedes`, fail-closed build/server/browser checks (RQ4), and truthful approval/validation
metadata: `validationRunId` must identify a technical validation run and must never be presented as
clinical validation; `approvedBy[]` must contain only real human approvals — never inferred approval
from a hash, a CI pass, or a signature. Cryptographic signing should be reconsidered when there is a
genuinely independent approver or release authority and an out-of-band trust root, or when clinically
validated packages need verification outside the GitHub Pages origin.

**Explicitly not defended against**: hash plus chain does not authenticate the maintainer, does not
stop that maintainer from shipping unreviewed content, does not survive a full origin compromise, and
does not establish clinical correctness.

**Plain-English summary** (as authored): "Do not build a key-management system for this prototype.
It would add ceremony and a misleading aura of clinical assurance without separating the author,
signer, host, or browser trust root. Record exactly which four KB files make up each release, link
every release to its predecessor, reject mismatches everywhere, and continue labeling the product as
an unvalidated research prototype. Revisit real signing only when another accountable party or an
external verifier creates a trust boundary that a signature can genuinely protect."

**Claude's position on RQ6**: no dissent. The circularity argument (verification code and any key
travel over the same static origin as the content they verify) is sound and matches the charter's own
framing; the recommendation is consistent with CLAUDE.md's validation-gate ladder (signing content
that hasn't passed content/technical/retrospective/silent-mode/human-factors/interventional review
would misrepresent its trust status) and with `module.json`'s existing self-documenting
`"unsigned-stub"` placeholder. Concurring, not rubber-stamping: the "PR verify job can't deploy, so
custody is unchanged" point independently checks out against `.github/workflows/deploy-pages.yml`
read directly for this task.

## Recommended design

- **`clinicalContentHash`**: SHA-256 over a JCS-canonicalized `{domain, files[]}` structure spanning
  exactly `modules/anemia/{rules,candidates,evidence,reference-ranges}.json` (RQ3), stored as
  `sha256:<hex>`. DEF-1's resolution (commit `2d1e5cd`) makes this scope final — no second evidence
  copy exists to hash or drift.
- **No cryptographic signature, no key, no `keyId` field** (RQ6, RQ5 not-applicable).
- **`src/kbVerify.js`** (new): embeds the current release's expected manifest digest as a literal
  constant (RQ2, analogous to `src/evidence.js`'s existing hardcoded-consts pattern for synchronous
  browser access) and exposes a verify function used by both `server.mjs` and `src/app.js`.
- **`status` enum**: `unsigned-stub` → `integrity-recorded` → `superseded` / `revoked` (RQ4),
  replacing the draft's binary `unsigned-stub`/`signed` sketch.
- **Fail-closed everywhere**: `server.mjs` (`process.exit(1)` at startup, no per-request fallback),
  `scripts/build-static.mjs` (nonzero exit before Pages artifact upload), `src/app.js` (new "KB
  integrity blocked" UI state gating the entire form, not `showFatalError()`) (RQ4).
- **`supersedes`**: points to the prior release's version + manifest digest, forming an auditable,
  indefinitely-retained chain (RQ2, RQ5).

## Alternatives considered

- **Ed25519 via WebCrypto detached signature.** Rejected: technically feasible (WebCrypto has the
  primitive), but with no independently distributed public-key root and no separated release
  authority (RQ1/RQ2), a signature adds no verifiable trust beyond what the hash already provides —
  only the appearance of one.
- **HMAC-style shared secret.** Rejected outright: browser-side verification would require shipping
  the "secret" to the browser, which makes it not a secret — this option was never viable for a
  no-server static-verification path.
- **GitHub Actions secret custody for a signing key.** Considered under RQ1, rejected: the same
  account already controls content, workflow, dispatch, and deploy, so a key stored there adds a
  ceremony step without adding separation of duties.
- **Hardware-token custody.** Considered under RQ1, rejected for this phase: raises the bar against
  key extraction but does nothing about the maintainer signing their own unreviewed content or an
  attacker replacing the browser-side verifier.
- **Server-fetched public key / separate `public-key.json`.** Rejected under RQ2 as circular by
  construction — it would travel over the same static-hosting channel as the KB it claims to verify.

## Risks & open questions

- **Perception risk**: even `integrity-recorded` status and a "verified" UI treatment could be
  misread by a clinician as a clinical-validation claim if UI copy is not careful — RQ6's rationale
  explicitly warns that any signing-adjacent apparatus risks "visually upgrading unvalidated content."
  Recommend the eventual implementation PR (P1-WP5) include explicit copy review for this failure
  mode, not just a functional fail-closed check.
- **`approvedBy[]` integrity is a process risk, not a software risk**: nothing in this design
  prevents the sole maintainer from writing a false entry into `approvedBy[]`. That is explicitly
  out of scope for a software fix per RQ1/RQ6 — it can only be mitigated by an actual second human
  reviewer existing, which is a program-level (not SPIKE-level) gap already tracked via the ARC
  clinical-council non-qualifying-review finding (see repo CLAUDE.md's AOS-assets section).
  Recommend the implementation PR log this as an explicit known limitation in
  `docs/architecture.md` §10 rather than let a passing check imply more than it proves.
- **Revisit trigger for RQ6 is not calendar-based**: reconsider cryptographic signing only on a
  structural change (second independent release authority, external-to-Pages verification need) —
  flagged so a future session doesn't reopen this SPIKE on a "it's been N months" cadence.
- **DEF-5 schema authoring is now unblocked**: this SPIKE's `status` enum and the absence of a
  `signature`/`keyId` field are exactly DEF-5's stated blocking input
  (`docs/project_plans/design-specs/module-manifest-json-schema.md`) — sequence DEF-5's
  `schemas/module-manifest.schema.json` authoring immediately after this SPIKE closes, per the
  charter's own note.

## Implications per work package

- **P1-WP5 (signed KB manifest + semantic diff)**: scope changes from "signed manifest" to
  "integrity-recorded manifest" — implement `clinicalContentHash` computation (RQ3's canonicalization
  spec), `src/kbVerify.js` (RQ2), the `status` enum (RQ4), fail-closed checks in `server.mjs` and
  `scripts/build-static.mjs` (RQ4), and the new browser "KB integrity blocked" UI state in
  `src/app.js` (RQ4). No key generation, no `keyId` field, no rotation tooling (RQ5/RQ6) — do not
  build what RQ6 rejected.
- **P1-WP7 (review-portal concept)**: `approvedBy[]`-emission target is now concrete —
  `{reviewer, role, approvedAt}` entries recorded as the machine-readable trace of an out-of-band
  human review, never auto-populated from a hash/CI/signature pass (RQ6's explicit constraint).
- **DEF-5 (module-manifest-json-schema.md)**: unblocked — author `schemas/module-manifest.schema.json`
  next, using this SPIKE's `status` enum (`unsigned-stub`/`integrity-recorded`/`superseded`/`revoked`)
  and confirming no `signature`/`keyId` field is added.
- **`docs/architecture.md` §9/§10**: §9's "cryptographic signature verification for KB packages" line
  should be annotated as a deferred future-hardening goal (not a Phase 1 commitment) per RQ6; §10's
  fail-closed language is satisfied by the hash-chain design, not weakened by deferring signing.

---

## OQ-8 — council-review pass: performed 2026-07-19; **closed with caveats**

### The gap, as originally recorded

**Raised by the EP-0 reviewer gate, not by the authoring pass.** This charter's own *Overall SPIKE
exit criteria* item (2) requires that RQ6's recommendation "is explicit (signing now vs. defer to
hash+chain) **and has passed `council-review`**", and *Method* step 4 requires routing RQ1's
threat-model statement and RQ6's recommendation through `council-review` "before treating either as
final". Neither happened.

The SPIKE was nonetheless marked `status: completed` with no disclosure — SPIKE-005 hit the identical
gap and self-disclosed it as OQ-7, so this is a documentation inconsistency between two SPIKEs in the
same phase, not a difference in what was actually done. Both are recorded now.

### The pass that closes it

**Performed 2026-07-19.** Both objects Method step 4 names — RQ1's threat-model statement **and**
RQ6's recommendation — were routed through `council-review`.

- **Run**: `arc-run-2026-07-19-spike-006-kb-integrity-governance`
- **Council**: `pediatric-anemia-clinical-review-council@0.1.0`
- **Artifacts**: `agentic-research/runs/2026-07-19-spike-006-kb-integrity-governance/` — `findings.yaml`,
  `scorecard.json`, `risk_register.yaml`, `decision_record.md`, `validation_plan.md`,
  `adjudication_record.yaml`, `pediatric_clinical_review.json`, `evidence_pack.md`,
  `arc_certification.yaml`, `friction_log.yaml`, `trace_bundle.jsonl`, plus per-reviewer raw output
  under `reviewers/`. ARC run records always live in the `agentic-research` checkout, not in this
  repository (see `docs/project_plans/expansion/03-arc-clinical-council-handoff.md:39`).
- **Run spec**: `examples/arc-runspecs/spike-006-kb-integrity-governance.runspec.yaml` (this repo),
  binding this file by digest `5bac1388…d3f1f6` at commit `e69d307`.
- **Bundle gate**: `uv run arc validate runs/2026-07-19-spike-006-kb-integrity-governance` → `ok: true`.
- **Method**: four isolated reviewer passes with disjoint briefs and no shared context — adversarial
  code-tracer, clinical informatics/interoperability, patient safety/human factors, and reasoning-quality
  audit — then adjudication. 27 raw findings → 20 accepted (2 critical, 8 high, 7 medium, 3 verified
  confirmations), 1 disputed and preserved, 1 watchlist, 6 duplicates from independent convergence,
  0 rejected on the merits. Overall recommendation: **proceed with conditions**.

### Verdict on RQ1 — threat model

**Upheld with qualification.** No seat disputed it. RQ1 meets the charter's "no euphemism" bar, and
every factual premise it rests on was independently re-derived from source and held. Two qualifications:

1. It is derived from the **static-browser surface** and then stated as covering the deployment model
   as a whole. The mirror REST API (`server.mjs`, `openapi.yaml`) is a structurally different trust
   boundary — the consumer is not the publisher — and RQ1 never analyses it. The conclusion happens to
   hold today only because no external API consumer exists, and the SPIKE does not say that is why.
2. **Only cryptographic custody options were surveyed.** Laptop, Actions secret and hardware token were
   weighed; GitHub *environment protection rules* (already declared on the existing `deploy` job) and
   branch protection on `main` were never considered, despite targeting the exact "same account controls
   everything" threat RQ1 lists as undefended.

### Verdict on RQ6 — NO-GO on cryptographic signing

**The NO-GO stands. The sufficiency claim attached to it does not.**

Deferring cryptographic signing is **upheld**. No seat argued for signing now, and the one dissenting
seat concedes directly that *a signature over the same four files would carry the identical blind spot* —
so the crypto-versus-hash choice is largely orthogonal to the council's central finding.

**What does not survive: the DEF-1 objection survives DEF-1's own resolution.** RQ3 answered the
charter's dual-evidence-copy warning by showing DEF-1 is resolved, therefore the objection evaporates.
It does not. The objection's deeper structural form — *does the hash cover everything that determines
clinical output?* — was never asked, and the answer is no:

- **Clinical thresholds live in JavaScript the digest never sees.** `modules/anemia/ranges.js:38-53`
  hardcodes the ferritin cutoffs 30 and 20 ng/mL with their age bands;
  `modules/anemia/facts.anemia.js:51-55, 76, 82-84, 171-173, 201-202` hardcodes lead action levels, IDA
  severity bands, sTfR-index cutoffs, the hemolysis marker count and marrow-failure age windows. None is
  in the four hashed files. **Two isolated passes found this independently.** The same EP-0 phase that
  authored this SPIKE had already proven the hazard by execution the same day (commit `2d1e5cd`:
  deleting one `ranges.js` branch moves a menstruating child's ferritin threshold from 30 to 20 ng/mL
  while 0 of 6 golden fixtures move).
- **`module.json`'s own governance fields are unhashed** — `approvedBy`, `validationRunId`,
  `evidenceReviewedThrough`, `status`, `supersedes` are all outside the preimage, so the fields RQ6 relies
  on for truthful approval metadata are exactly the fields no check covers.
- **Nothing addresses expiry.** `docs/architecture.md:186` requires failing closed on expired evidence and
  the roadmap's V2 no-go names it; the design checks byte consistency only, no governance policy defining
  expiry exists, and `src/app.js:517-532` fetches the KB once at load with no revalidation.
- **No provenance reaches an API consumer.** `server.mjs:142-151` returns no manifest field and
  `openapi.yaml:26-44` has nowhere to put one, so "auditable" holds only for a party with repo access.

The drift risk therefore did not disappear when DEF-1 closed — it **moved from evidence-versus-evidence
to content-versus-code**. The remedy is not "sign instead"; it is *hash more*, or *claim less*, and say
which.

Two further defects in the argument itself: the NO-GO is stated more broadly than its premise supports
(the same-origin circularity argument does not reach **server-only** verification, where a key never
leaves CI — that option was foreclosed without being separately rejected); and the perception argument
("a signature would visually upgrade unvalidated content") is used to reject signing while the identical
hazard attached to this SPIKE's own `integrity-recorded` status is downgraded to a copy-review footnote.

**Preserved dissent** (`SPK6-DISSENT-001`, `findings.yaml#SPK6-DISPUTE-001`): the reasoning-quality seat
returned `dispute` on RQ6 and holds it should be reopened as a decision; the informatics and safety seats
returned `concur_with_qualification` and treat the gaps as closable conditions. The adjudicator resolved
the signing decision and did **not** resolve the sufficiency claim. All three seats agree this document
overstates what its recommended design protects.

### Required amendments before EP-5 acts on the SPIKE-006 contingency branch

1. Amend RQ3/RQ6 to state the digest's true scope — either extend the preimage to the threshold-bearing
   code (or extract those constants into a hashed JSON file), or narrow the provenance claim explicitly
   and name what is excluded, including `data/algorithm-explainers.json`.
2. Amend RQ1/RQ6 to scope the NO-GO to *browser-verifiable* signing and to the current
   no-external-API-consumer state; either reject server-only signing on its own merits or record it open.
3. Reconcile the roadmap's V2 no-go ("unsigned/expired KB not rejected by the server",
   `01-platform-expansion-roadmap.md:225-226`) explicitly rather than by implication — its own illustrative
   manifest at `:206-216` carries a distinct `signature` field, so reading the criterion as satisfied by a
   hash is a redefinition that must be recorded in the roadmap itself.
4. Record `docs/architecture.md` §10's **expiry** clause as **not closed** by this SPIKE, tracked separately.
5. Make copy review of any surface displaying `integrity-recorded` a hard P1-WP5 acceptance criterion, not
   a recommendation.
6. Fix the citation: `5eaa048` is cited three times as "current HEAD" but is not an ancestor of `e69d307`;
   the DEF-1 resolution reached the mainline as `2d1e5cd` with byte-identical `src/evidence.js`.

Also owed, outside this SPIKE's scope but raised by it: a control against fabricated `approvedBy[]`
entries (critical — nothing today detects one, including one written by an agent), and verification or
enablement of branch/environment protection, on which the hash-chain's auditability claim silently depends.

### Honesty boundary — read this before citing the run

The `council-review` pass is a **synthetic adversarial review**. It satisfies this charter's *process*
requirement that RQ1 and RQ6 be routed through `council-review`. It is **not** clinical validation, **not**
credentialed clinical sign-off, **not** laboratory or institutional approval, and **not** a regulatory
determination. Certification state is `pending`; clinical release status is `blocked`; human approval is
`not_executed_owner_held`. **No output of that run may ever populate `modules/anemia/module.json`'s
`approvedBy[]`, any `clinicalApprovers[]` field, or any other record of human clinical approval** — the
project's `CLAUDE.md` names treating ARC output as credentialed clinical sign-off as one of the two most
likely mistakes a session can make.

Coverage limit, stated rather than concealed: **five of eight voting seats returned `out_of_scope`**
(hematology, laboratory medicine, general pediatrics, model evaluation, equity). The target is a
key-custody and release-integrity document with no clinical thresholds under review. This run is a
governance-and-integrity review; it says nothing about the clinical content of the anemia module, and its
`dangerous_miss_review` records every family as `not_applicable` — a declaration of no coverage, not a pass.

**Status**: OQ-8 is **closed with caveats**. The process gate is satisfied. The substantive outcome is a
materially qualified RQ6 with six required amendments outstanding, which is why this SPIKE's frontmatter
read `completed-with-required-amendments` (now `amended-pending-re-review`, once the amendments below
landed — see frontmatter `status_note`).

---

## Amended design — required amendments 1-6 applied (2026-07-21) — THIS SUPERSEDES RQ3/RQ6's sufficiency claim

Everything above this line — RQ1-RQ6, the Recommended design, Alternatives, Risks, Implications, and the
OQ-8 council section — is preserved verbatim as the audit trail of what was actually reviewed on
2026-07-19. It is **not amended in place** (with the sole exception of three factual citation corrections
under Amendment 6, below, which are typos, not reviewed conclusions). Where this section's normative
design conflicts with anything stated above — most importantly RQ3's "the four KB JSON files above are
the complete `clinicalContentHash` scope" and RQ6's sufficiency framing — **this section is the current
implementation target for EP-5's `scripts/sign-kb.mjs` and `src/kbVerify.js`, and the earlier claim does
not survive.** The NO-GO on cryptographic signing itself (RQ6's core recommendation) is **not** revisited
here — see Amendment 2.

This section is a specification, not an implementation. No code in this repo was written or modified to
produce it, and no clinical threshold or governance number stated below was invented — every number is
either quoted from source already in this repo (cited inline) or explicitly flagged as undetermined and
requiring a human governance decision before EP5-T6 may hardcode anything.

### Amendment 1 — digest scope: extend the preimage AND name the exclusions (both, not either)

The council proved the four-file `clinicalContentHash` never covers the JavaScript where real clinical
thresholds live. Verified directly against current source (not the SPIKE's own now-stale line citations,
which described a pre-EP-0.5-registry version of `ranges.js`):

- **`modules/anemia/ranges.js`** — `ferritinThresholdRule()` (current lines ~59-71) hardcodes the AAP
  ferritin thresholds directly in JS: `30` ng/mL for menstruating patients and for the 144-215-month
  adolescent band, `20` ng/mL for the 6-143-month band. Unlike the hb/mcv/rdw bands in the same file (which
  EP-0.5's range-registry refactor moved into `reference-ranges.json`, already inside the four-file scope),
  the ferritin cutoffs were never migrated and remain literal numbers in source.
- **`modules/anemia/facts.anemia.js`** — confirmed by direct grep for numeric comparisons, current lines:
  severe/moderate/mild IDA hemoglobin-category bands (`hb < 7`, `7 <= hb < 9`, `hb >= 9`, lines ~213-215);
  sTfR/ferritin-index cutoffs (`> 2`, `< 1`, `1-2`, lines ~82-86); the hemolysis-marker-count heuristic
  (`>= 2`, line 107); blood-lead-level action tiers (`>= 3.5`, `20-44`, `>= 45`, lines ~113-115); the
  supported/neonatal/outside-range age gates (`6`, `216`, line ~53-55, duplicating the age-band boundary
  also encoded in `module.json.supportedAgeMonths`); and the TEC/DBA age-compatibility windows (`< 72`,
  `< 12`, line ~246-247).
- **No other file hardcodes a clinical cutoff.** A repo-wide grep for numeric comparisons in
  `modules/anemia/*.js` and `src/*.js` was run for this amendment. Every other hit is one of: (a) generic
  code (`.length > 0`, array/index bounds, tie-break comparisons with no clinical meaning — e.g.
  `src/ruleEngine.js`'s `clinicalApprovers` length check, `src/app.js`'s `index < 0`); (b) UI/display
  formatting with no bearing on computed output (`src/app.js`'s `ageMonths < 24` age-string formatter;
  `src/algorithmExplorer.js`'s rendered expression strings, which restate an already-computed fact for
  display and do not compute it); or (c) `data/algorithm-explainers.json`, addressed below as an
  exclusion, not an inclusion.

**The DECISION (orchestrator-directed): do both — extend the preimage, and name what remains excluded.**
Normative two-part digest:

**`clinicalContentHash`** — SHA-256 over the UTF-8 bytes of an RFC 8785/JCS-canonicalized structure:

```json
{
  "domain": "pediatric-cds-clinical-content-v1",
  "files": [
    { "path": "modules/anemia/rules.json", "content": {} },
    { "path": "modules/anemia/candidates.json", "content": {} },
    { "path": "modules/anemia/evidence.json", "content": {} },
    { "path": "modules/anemia/reference-ranges.json", "content": {} }
  ],
  "sourceFiles": [
    { "path": "modules/anemia/ranges.js", "sha256": "<hex, over the file's raw UTF-8 bytes>" },
    { "path": "modules/anemia/facts.anemia.js", "sha256": "<hex, over the file's raw UTF-8 bytes>" }
  ]
}
```

Stored as `sha256:<hex>`, same convention as RQ3's original design.

**The JSON/source asymmetry, stated explicitly:** `files[]` entries keep RQ3's original treatment — each
KB file is parsed and its JSON *value* is embedded directly in the structure above, so JCS's canonical
key-ordering and number-formatting rules govern all four uniformly (this is what makes the digest
insensitive to whitespace/key-order noise in those files). `sourceFiles[]` entries cannot get that
treatment because a `.js` file is not JSON and has no meaningful "canonical form" to embed as a `content`
value — there is no canonicalization rule that would tell you whether two semantically-different
JavaScript programs should hash the same or differently, whereas for JSON that question has a real answer.
So each source file is hashed on its own raw committed bytes first, and only the resulting hex digest
(itself an ordinary JSON string) enters the JCS-canonicalized wrapper. This is a deliberate asymmetry, not
an oversight: hashing exact bytes is the only guarantee available for source, and it is the stronger
guarantee where it applies — a single-character edit to `ranges.js` (exactly the class of change the
council's own `2d1e5cd` demonstration showed can silently move a menstruating child's ferritin threshold
from 30 to 20 ng/mL) changes the byte hash with certainty, which is not true of every possible
re-serialization-tolerant JSON canonicalization scheme.

**Exclusion list — named explicitly, not silently assumed away.** These files and mechanisms still
influence what a clinician sees, and are **not** covered by either `clinicalContentHash` or
`governanceHash`:

- **`data/algorithm-explainers.json`** — the council named this one directly. Verified by grep: it is
  fetched only by `src/algorithmExplorer.js` (`fetch('./data/algorithm-explainers.json')`) to render the
  read-only "algorithm explorer" teaching UI. It is **not** imported by `facts.anemia.js`, `ranges.js`, or
  `ruleEngine.js`, and therefore **cannot change a computed assessment result** — it is display-only.
  It is excluded from the digest deliberately, not by omission: including it would falsely imply it
  participates in computing output, when it does not. But excluding it silently would hide a real, distinct
  risk this SPIKE must name: the file's `equations[].expression` strings restate several of the same
  numbers now inside `sourceFiles[]` (e.g. "`ferritinThreshold = 30 if menstruating or age ≥ 144 months;
  otherwise 20`", "`BLL ≥ 3.5`") as free-text prose, not as a live reference to the constants — if
  `ranges.js` or `facts.anemia.js` changes a threshold, this file does not update automatically and could
  keep showing a stale number to a clinician reading the explainer even after the computed result has
  already changed. That is a *display-staleness* risk, not a *computation-integrity* risk, and belongs to
  copy/content review (see Amendment 5's adjacent concern), not to a release-time hash gate.
- **The rule-evaluation and range-lookup engine itself** — `src/ruleEngine.js`, `src/engine.js`,
  `src/ranges/registry.js`, `src/facts/core.js`, `src/facts/tristate.js`, `src/units.js`. These interpret
  the hashed JSON and hashed source constants; a bug or behavior change in the interpreter can change
  computed output without changing either hash. This matches RQ3's own already-established distinction
  ("the thin loader and engine code themselves belong to the software/build integrity surface, not the
  clinical-content digest") — extending it to engine code would make the digest a whole-repo hash, which
  defeats its purpose as a *content* provenance signal distinct from general software correctness. That
  gap is the test suite's job (91-rule activation-witness ratchet, golden fixtures, mutation corpus per
  SPIKE-005), not this digest's.
- **Per-request local reference ranges** (`cbc.localRanges.*`, `localFlags.*` in the request body) — these
  are clinician-supplied input at assessment time, not KB content. They were never in scope for a
  release-time digest and remain out of scope here; `assertLocalRangeUnit()` and unit-rejection (SPIKE-004)
  are the correctness control for that input path, not this hash.
- **`module.json` fields outside `governanceHash`'s field list** (Amendment 1's sibling decision, below):
  `id`, `title`, `schemaVersion`, `engineLabel`, `releasedAt`. None currently carries a value with clinical
  or governance-decision weight distinct from what `governanceHash` already covers; `releasedAt` is a
  timestamp of when a release was published, not a policy input (the policy input is
  `evidenceReviewedThrough`, which **is** covered — see Amendment 4).

**Do not read "`clinicalContentHash` verified" as "clinical output unchanged."** A hash match proves only
that the four KB JSON files and the two named source files are byte-for-byte (JSON files:
value-for-value) identical to what was recorded at release time. It does not prove the engine that
interprets them is unchanged, does not prove the algorithm-explainer copy is still accurate, and does not
prove independent clinical review happened — that guarantee still depends entirely on the out-of-band
human process `approvedBy[]` records (RQ1's finding, unchanged by this amendment).

**`governanceHash`** — SHA-256 over the UTF-8 bytes of a second, separate JCS-canonicalized structure,
closing the council's "`module.json`'s own governance fields are unhashed" gap:

```json
{
  "domain": "pediatric-cds-governance-v1",
  "moduleId": "anemia",
  "fields": {
    "status": null,
    "knowledgeBaseVersion": null,
    "evidenceReviewedThrough": null,
    "approvedBy": [],
    "validationRunId": null,
    "supersedes": null,
    "supportedAgeMonths": { "min": 6, "max": 216 }
  }
}
```

(Values shown are `modules/anemia/module.json`'s current stub values, confirmed by direct read; the
structure, not the current values, is the normative part.) `clinicalContentHash` and `governanceHash`
themselves are excluded from this structure's `fields` to avoid self-reference — a manifest cannot hash a
field that includes its own hash. `releasedAt`, `id`, `title`, `schemaVersion`, and `engineLabel` are
deliberately outside `governanceHash` too, per the exclusion list above.

### Amendment 2 — scope the NO-GO to browser-verifiable signing; server-only signing is rejected on its own merits, not left open

RQ1/RQ6's NO-GO is amended to be explicit about its scope: it applies to **browser-verifiable
signing** under the **current no-external-API-consumer state** — the same-origin circularity argument
(verifier and content travel over the same static Pages channel) is a browser-specific argument and was
overextended when RQ6 stated the NO-GO as if it covered every signing topology.

**Decision on server-only signing (key never leaves CI, `server.mjs` verifies without shipping a public
key to the browser): rejected on its own merits, not recorded as open.** Reasoning, grounded in RQ1's own
already-completed analysis rather than a new claim: RQ1 already evaluated "GitHub Actions secret" custody
and rejected it — "the same account already controls content, workflow, dispatch, and deployment; a
compromised account or workflow can invoke or expose the key" — and this repo's only CI workflow
(`.github/workflows/deploy-pages.yml`, re-confirmed by direct read for this amendment) has no separate
server-deployment job today; `server.mjs` is not currently deployed by CI at all. Server-only signing
would need that same single GitHub account's CI to both author the signing step and hold the key,
identical to the custody arrangement RQ1 already rejected — the browser-circularity objection does not
apply to it, but the deeper, non-circularity objection (does the signature prove independent review
happened, when the signer and the author are provably the same actor) applies with undiminished force.
Rejecting it now, on that existing reasoning, is preferred over recording it open indefinitely: an
open-ended "maybe reconsider" item with no resolution criterion tends to get treated as quietly settled by
default, which is the same documentation failure OQ-8 itself was raised to correct. **Reopen trigger**
(same shape as RQ5's rotation trigger): a second independent release authority, or a real deployed
server-mode consumer with its own trust boundary distinct from the static-site publisher, whichever comes
first — not a calendar date.

### Amendment 3 — roadmap V2 no-go reconciled

`docs/project_plans/expansion/01-platform-expansion-roadmap.md`'s V2 no-go criterion ("unsigned/expired KB
not rejected by the server," confirmed at current line 226) and its illustrative P1-WP5 manifest
(confirmed at current lines 208-216) carrying a distinct `signature` field predate SPIKE-006's NO-GO.
Reading "unsigned" as satisfied by `clinicalContentHash` + `governanceHash` failing closed, instead of by
an actual cryptographic signature, **is a redefinition of that criterion**, and per this amendment it is
now recorded explicitly at the point where the criterion lives, not only here: see the annotation added
directly under the No-go bullet in the roadmap file (dated 2026-07-21, citing this SPIKE), which also
records that "expired" is not yet satisfiable at all, pending Amendment 4. The original roadmap criterion
text is left intact; the annotation is additive, matching this section's own preservation rule for the
SPIKE's original findings.

### Amendment 4 — expiry is NOT closed; minimum policy this amendment specifies

`docs/architecture.md` §10 (line 186, confirmed by direct read) requires failing closed when "evidence
version is expired under governance policy." **SPIKE-006 does not close this requirement — neither the
original findings nor this amendment resolve it — it is tracked separately** and must not be read as
satisfied by anything in the two-part digest above; a byte-identical hash says nothing about whether the
underlying evidence is stale.

Minimum policy this amendment specifies, for EP5-T6 to implement against:

- **The field that defines staleness**: `module.json.evidenceReviewedThrough` (already present as a stub
  field, confirmed by direct read — currently `"2026-07-15"`). Expiry is a function of the gap between
  this date and the current date at verification time, evaluated wherever `clinicalContentHash`/
  `governanceHash` are verified (`server.mjs` startup, `scripts/build-static.mjs`, `src/app.js` startup).
- **The staleness window is an undetermined governance decision — stated honestly, not invented.** No
  number of days/months is specified anywhere in this repo, this SPIKE, or its council review, and none is
  invented here. Picking one now would violate the same "no invented thresholds" guardrail that governs
  clinical cutoffs — an expiry window is itself a safety-relevant governance number, not an engineering
  default.
- **Implementation requirement**: EP5-T6 must read the staleness window from a declared configuration
  value (e.g. a named field on the manifest or a build/server config, such as
  `evidenceStalenessWindowDays` — the exact name is EP5-T6's to choose, not fixed by this amendment) rather
  than hardcode a number picked during implementation. Until a human makes that governance decision and
  records it, the configuration value must be treated as **required and absent** — verification must fail
  closed (refuse to serve/build, same `process.exit(1)`-class failure as every other integrity check in
  this design) rather than silently default to "never expires" or to any invented number. A missing
  governance decision is not a green light to pick a plausible-sounding default.

### Amendment 5 — copy review is a hard EP-5 acceptance criterion, not a recommendation

The original Risks & open questions section's "recommend the eventual implementation PR include explicit
copy review" is upgraded: **copy review of any UI surface displaying `integrity-recorded` status (or any
successor state in the RQ4 `status` enum) is a hard P1-WP5/EP-5 acceptance criterion.** A PR that ships the
hash/governance verification described in this amendment without that copy review does not meet EP-5's
acceptance bar, full stop — this is not a nice-to-have follow-up.

The copy **must**:
- State plainly that `integrity-recorded` means the recorded content digest matched at verification time —
  a statement about byte/value consistency with a prior release, nothing more.
- Make clear that the underlying knowledge base is an unvalidated research prototype, consistent with this
  repo's `CLAUDE.md` status line, wherever `integrity-recorded` (or its successor states) is shown.

The copy **must not**:
- Imply clinical validation, regulatory clearance, or diagnostic-performance approval of any kind.
- Imply that independent clinical review occurred, unless `approvedBy[]` actually contains real named
  human approvals for the exact release being displayed (RQ6's existing constraint, restated here as a
  copy-level requirement, not only a data-level one).
- Use words like "verified," "certified," "approved," or "signed" in a way a reasonable clinician reader
  would associate with clinical sign-off rather than software integrity — RQ6's own rationale already
  warned that any signing-adjacent apparatus risks "visually upgrading unvalidated content," and that
  hazard applies to `integrity-recorded` copy exactly as it would have applied to a cryptographic
  "signed" badge.

### Amendment 6 — citation corrected

`5eaa048` was cited three times in the original findings as "current HEAD." Verified for this amendment
via `git merge-base --is-ancestor`: `5eaa048` exists only on the side branch `worktree-wave0-ep0-derisk`
and is **not** an ancestor of `e69d307` or of this repo's current mainline HEAD. `2d1e5cd` **is** confirmed
an ancestor of both `e69d307` and current HEAD, and its diff (`git show 2d1e5cd`) confirms it is the commit
that both resolved DEF-1 (`src/evidence.js` becomes the thin loader, per its own commit message) and added
the CI `verify` job. All three citations (in the "RQ1 — Key custody" finding, the "DEF-1 confirmation"
paragraph, and the "Recommended design" bullet) have been corrected in place to `2d1e5cd`, per the
in-place-edit exception stated at the top of this section — this is a factual identifier error, not a
reviewed conclusion being revised.
