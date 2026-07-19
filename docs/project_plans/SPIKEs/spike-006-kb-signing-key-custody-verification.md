---
schema_version: 2
doc_type: spike
title: "SPIKE-006: KB Signing Key Custody and Browser-Side Verification"
status: completed
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
`verify` job (`.github/workflows/deploy-pages.yml`, added in EP0-T9/commit `5eaa048`) runs the
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

**DEF-1 confirmation (RQ3 acceptance criterion)**: DEF-1 is resolved at current HEAD `5eaa048`.
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
  `sha256:<hex>`. DEF-1's resolution (commit `5eaa048`) makes this scope final — no second evidence
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
