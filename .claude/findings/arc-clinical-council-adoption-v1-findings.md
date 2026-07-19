---
title: "Findings: ARC Clinical Council Adoption v1"
schema_version: 2
doc_type: report
report_category: findings
status: completed
created: 2026-07-19
updated: 2026-07-19
feature_slug: arc-clinical-council-adoption-v1
plan_ref: docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md
owner: pediatric-cds-program-owner
tags: [arc, clinical-review, security, findings]
---

# Findings — ARC Clinical Council Adoption v1

In-flight findings from the independent reviewer gates for P0–P3. Each row records the gate that
produced it, the disposition, and where it landed. Findings that were **refuted** are kept, because a
refuted finding is evidence too.

Severity uses the reviewers' own scale. "Fixed" means a regression test exists.

> **Read P0-9 first.** The most instructive finding in this run was produced *by* this pipeline and ratified by its own independent reviewer: a confident refutation resting on a search of the wrong set of repositories. Absence of evidence where you thought to look is not evidence of absence. It is recorded rather than quietly reverted, on the same principle the rest of this document applies to everyone else's claims.

## P0-V1 — truth review (verdict: PASS-WITH-FINDINGS)

| # | Severity | Finding | Disposition |
|---|---|---|---|
| P0-1 | high | `RESULTS.md` totals row arithmetically false: `576 (485/50/31)`; 485+50+31=566, and the live inference sum is 60 | Fixed in `63e06a8` |
| P0-2 | high | Provenance note cited `GET /api/runs` as substantiating §3 and §4; that endpoint carries neither per-source-card data nor any audit record | Fixed — re-cited to local run artifacts; §4 marked `corroborated-by-artifact, no standalone audit record` |
| P0-3 | med-high | The `planned → verified` upgrade was cited to `status_derived: published`, which reads `published` for **all 48 runs** in the store while `status_raw` remains `planned` for all 48 — it would have read `published` on the day the docs correctly said "planned" | Fixed — re-cited to `runs/<id>/reviews/verification.yaml` (`passed: true`, `exit_code: 0`, 2026-07-18), with an explicit warning not to re-derive "verified" from the non-discriminating field |
| P0-4 | medium | `00-expansion-plan.md` cited a nonexistent `plan-completion.md` | Fixed — the real file was located under `.claude/progress/platform-foundation-p0/` |
| P0-5 | low | README referenced a "status column" that does not exist | Fixed |
| P0-6 | low | "entirely gitignored" overstated; `runs/.gitkeep` is tracked | Fixed |
| P0-9 | **high** | **Self-inflicted.** P0 "corrected" the original `committed locally 4144634` claim as fabricated, and P0-V1 independently ratified it. **Both were wrong — the original claim was true.** `4144634` is a real commit (`data: land 7 verified pediatric-CDS evidence bundles`) holding all 7 runs / 253 files. It lives in a **separate dual git-dir** at `research-foundry/.git-data`, which tracks the data plane and pushes to the private `research-foundry-data` remote; the public repo `.gitignore`s that path by design. Both passes searched the four project repos and the public `.git`, found nothing, and concluded fabrication — never considering a dual git-dir | **Retracted at merge** in the squash commit; RESULTS.md now states the original claim with the mechanism documented, and the retraction is kept visible rather than quietly reverted |
| P0-7 | low-med | Three absolute `cd /Users/…` paths in the handoff, plus a paragraph pre-authorizing them | Fixed in P1-T4 (`412fc37`) — now `cd "$ARC_REPO"`; the exemption paragraph is removed |
| P0-8 | low | Runs-viewer assertion unverified | Not upgraded; left unasserted |

Also closed at P0: IntentTree was queried and holds **no tree** for either repo, so this program has no
IntentTree binding and no program-graph state to reconcile.

## P1-V1 — adversarial security review of target resolution (verdict: PASS-WITH-FINDINGS)

All fixed in `f1a51c8` with a regression test each; ADR-0004 updated so design does not drift from code.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| F1 | high | Clean-tree gate failed open: only `dirty`/`untracked` were rejected, so `not_git` — no commit at all — passed. A missing git binary, `rev-parse` failure, timeout, and non-40-hex result **all** collapsed into `not_git`. A clinical run could resolve against fully mutable uncommitted bytes | Fixed — only `clean` accepted; indeterminate git state is a hard error. Pediatric fixtures now `git init` rather than the gate being weakened (every fixture was non-git, so the gate had never once been exercised) |
| F2 | high | Scan/hash TOCTOU: the prohibited-content scan ran on source bytes **before** hashing, proving hash→copy→verify but never scan→hash | Fixed — authoritative scan moved to the isolated copy after post-copy digest verification |
| F3/F3b | medium | Preview was a false green: `--dry-run` returned `ok:true` for unregistered alias, wrong digest, and absolute target `/etc/hosts`, and leaked the unresolved absolute path into AOS correlation | Fixed — preview resolves, fails closed, emits only canonical identifiers, stays side-effect-free |
| F4 | medium | New-format validation could be downgraded to legacy by deleting one manifest field | Fixed via durable provenance evidence. **One clause refuted**: "unconditionally reject absolute manifest targets" is unsatisfiable alongside byte-identical legacy validation, because an existing run legitimately records one. Residual accepted as ADR T15 |
| F5 | medium | Git pathspec magic could forge `clean`: a file named `*.md` matched every tracked `.md` | Fixed — `--literal-pathspecs`, and `ls-files` must cover exactly the requested path |
| F6 | medium | Registry accepted a relative root resolving against CWD; `runs/` exclusion enforced only in the CLI writer | Fixed at load time |
| F7 | medium | `arc validate` never checked that the recorded locator agreed with `root_alias` + `relative_path`, so it could print "target identity verified" for a file the locator never named | Fixed |
| F8 | low | Hardlinks bypassed every `is_symlink()`-only control | Fixed at scaffold, dispatch, and copy time |
| F9 | low | Non-regular files invisible to hash and scan; `copytree` would open a FIFO and hang dispatch indefinitely | Fixed — rejected at scaffold |
| F11 | low | HTTP API could not express `target_artifact_class`/`target_sha256` | Fixed; `openapi.json` regenerated (it was already stale) |
| F13 | low | Registry temp file created at ambient umask; no trust check on read | Fixed — `mkstemp` 0600 from first byte; refused if symlink, not owner-owned, or group/world-writable |
| F14 | info | Unknown class strings echoed; `..` pattern rejected legal `notes..md`; duplicate `verify_resolved_target` | All three fixed |
| F10, F12 | low | `artifact_class_defaulted` inert; `ARC_APPROVED_ROOTS` overrides the approval boundary | **Tracked, not fixed** |

## P2-V1 — adversarial review of authenticated authority (verdict: PASS-WITH-FINDINGS)

**The core claim survived**: no path was found by which a model-authored, hand-edited, or forged record
mints authority, given an uncompromised trust registry. Verified independently: no signing path exists
in `arc_cli/`, no `arc authority issue`, `credentialed_review_complete` is unreachable, and the signed
payload covers everything except the `signature` object itself (all schemas `additionalProperties:
false` at every level), so there is no unsigned-field-injection or signature-stripping surface.

What it found instead are **temporal and aggregation weaknesses that let a genuinely-signed record
assert more, later, and more broadly than it should** — plus one destructive side effect.

| # | Severity | Finding | Status |
|---|---|---|---|
| F1 | high | `arc validate` pins the verification moment to `verified_at` — a field inside the summary whose truthfulness is being checked. An expired record re-derives as `verified` forever. Recorded `revocation_state` is reported but never cross-checked against the offline snapshot, which needs no network | Fixed in `50df81b` |
| F2 | high | `arc authority attach` on a completed run retroactively changes the expected signoff, making the existing honest receipt fail validation — satisfiable only by hand-editing the receipt to the **stronger** claim. The schema's "at receipt write time" semantics are unenforceable | Fixed in `50df81b` |
| F3 | medium | `any()` over gates: one satisfied authority of N (schema minimum 2) flips the receipt, and masks a sibling in `conflicted_records` — where the owner both approved and rejected. `satisfies_authority` is an unbound free string, and `binding["required_authorities"]` is hardcoded `None`, so the V3 check never runs | Fixed in `50df81b` |
| F4 | medium | A verified owner **rejection** falls through to `owner_held_not_executed` — indistinguishable from "the owner never acted." Refusal must be louder than absence | Fixed in `50df81b` |
| F5 | medium | The self-approval check is dead code: `initiator_subject` is read but never written by any ARC path. Separation of duties reduces to two booleans the issuer asserts about itself | Fixed in `50df81b` |
| F6 | medium | `max_age_hours` is optional, so an offline revocation snapshot of any age is accepted as authoritative `clear` — contradicting "stale ⇒ verification_unavailable" | Fixed in `50df81b` |
| F7 | medium | Online revocation accepts `http://` and an unsigned, unbound JSON body; anyone answering that host suppresses a revocation by returning `{}`. The offline path, by contrast, requires a fully verified signed snapshot | Fixed in `50df81b` |
| F8 | medium | `arc validate` **deletes** files: `verify_run_authority` unlinks on `prohibited_content`, and the scan false-positives on `metadata.owner: someone@example.org` — a required free-form field. An owner-signed record is irreversibly destroyed by a read-only command | Fixed in `50df81b` |
| F9 | medium | `metadata.*` is `additionalProperties: true`, and a shipped run already carries a hand-authored `review_execution` block using the exact D8 vocabulary — never re-derived, never schema-constrained. The mint boundary is airtight for validated carriers and open for the free-form neighbour that looks identical to a reader | Fixed in `50df81b` |
| F10 | low | `signature.key_id` sits outside the signed payload and is never reconciled with the signed `spec.signer.key_id` | Fixed in `50df81b` |
| F11 | low | Non-atomic, unlocked manifest/certification rewrite in `attach`; `summary()` can emit `"unknown"`, outside the schema enums | Fixed in `50df81b` |
| F12 | low | Unquoted RFC-3339 YAML timestamps canonicalize differently; the diagnostic is indistinguishable from tampering | Fixed in `50df81b` |
| H1 | hypothesis | Trust registry has no ownership/mode/symlink check on read, and `ARC_AUTHORITY_TRUST` is the human-approval boundary | Fixed in `50df81b` |
| H2 | hypothesis | `VerifiedRecord.spec` is not `repr=False`; no live leak found, but one careless log line from exposing `credential_ref` | Fixed in `50df81b` |

## Owner-held, unresolved (not findings — plan §6)

OQ-2 identity provider and credential authority; OQ-3 first institution, laboratory director,
analyzers, methods, units, intervals, critical values; OQ-4 V3 datasets and protocol; OQ-5 MeatyWiki
vault and ACL; OQ-6 authoritative approval and adjudication system. Until an operator runs
`arc authority trust add`, every authority gate remains `owner_held_not_executed` and runtime
behavior is unchanged.

## P3-V1 — clinical-informatics review of local applicability (verdict: **FAIL**, then remediated)

The only gate in this run to fail. Remediated in `9ebf240` (pediatric) and `fed4de5` (ARC); both
suites re-verified discriminating by deliberate mutation.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| F1 | critical | The pediatric activation gate had no verifier — `signatureState: "bound"` was self-declared, and the "additionally requires attachmentRef" text was prose, not a constraint. Four field edits promoted the shipped synthetic fixture to `applicable`, and the mutated document was schema-valid | Fixed — `bound` is unreachable by construction on that side; schema conditionals pin the authority and attestation blocks |
| F2 | critical | Each interval's own `ageBand` was required by schema and read by nothing: a 0-14-day interval was served for a 12-month-old with zero blockers | Fixed — matched, with `AGE_BAND_MISMATCH` scoped to `intervals[]` |
| F3 | critical | The assertion discriminator guarded only one key per container, so every secondary value was a silent wildcard when null — altitude became `±Infinity` (matching every altitude, in code whose comment says sea level is never assumed), `ageBand.high` unbounded, interval sex `any`, mapping unit/specimen skipped | Fixed. **Headline partly refuted**: `analyzer.method: null` *did* emit a blocker — but the wrong one (`METHOD_MISMATCH` when nothing was mismatched and the dimension was never asserted). Fixed as a diagnosis defect |
| F4 | high | Bound-less and inverted intervals were `applicable` | Fixed — `INTERVAL_BOUNDS_MISSING`, `INTERVAL_BOUNDS_INVALID` |
| F5 | high | Conflicting local mappings resolved silently by first match | Fixed — `MAPPING_CONFLICT` |
| F6 | high | `supersedingObservationRef: null` satisfied the correction check while the negative case used `"unset"` — **the suite proved the opposite of its claim**. Semantics were also inverted; self-reference, lineage membership, and ordering unchecked | Fixed, and the test corrected to exercise the real defect |
| F7 | high | `partial`/`appended` (DiagnosticReport statuses) accepted in an Observation policy with no `resourceType` discriminator; `entered-in-error` treated as merely non-decision-grade rather than a **retraction** | Fixed — discriminator added, value set corrected to FHIR ObservationStatus, retraction gets its own code |
| F8 | high | No drift detection: only a case count, against ARC's own vendored copy. An edited mutation upstream is undetectable | Fixed — SHA-256 per file plus upstream commit and data-model version pins. Verified at merge: byte-identical, pin equals pediatric HEAD |
| F9 | high | Nine confirmed JS↔Python semantic divergences on inputs outside the manifest — most dangerous, an unparseable evaluation time silently disabled expiry, not-yet-effective, and staleness together | All nine resolved and tested; two remain deliberate ARC-side strictness, flagged for upstreaming |
| F10-F18 | medium/low | Raw-Mapping path skipped the profile-digest filter; assertion identity never cross-checked against the document; containment levels not independent; summary dropped the locator; messages echoed owner values; candidate binding digest-only; supersession chain unresolved | All fixed in `fed4de5` |
| H4 | hypothesis | Separation of duties enforced at verification but defeatable at configuration — nothing stopped granting one issuer both rights | Fixed — refused at registration and verification |

### Clinically insufficient (distinct from incorrect)

The reviewer separated seventeen items that pass their own tests and would still be rejected by a
laboratory director. Three were treated as blocking and fixed, because they are structural rather
than matters of clinical judgment:

- **C1** — one unit per profile made a CBC inexpressible (hemoglobin g/dL, hematocrit %, MCV fL,
  platelets 10⁹/L all self-blocked). Unit moved to the analyte.
- **C11** — critical values were modelled, required, and **never once consulted** by either
  implementation, with no blocker codes. A panic threshold that is stored and never read.
- **C2** — no gestational or corrected age: a 4-week-old born at 27 weeks and one born at 40 weeks
  were the same patient, though anemia of prematurity differs in nadir, depth, and timing.

The remaining thirteen (C4-C10, C12-C17 — neonatal boundary arithmetic, sex-by-age-band, pregnancy,
race-based vs race-free stratification, capillary vs venous, anticoagulant and time-to-analysis,
reagent lot and QC state, interval vs decision limit, UCUM, LOINC six axes, altitude adjustment,
request-side assertion discriminator, downtime and recovery) are recorded in
`docs/clinical/local-profile-charter-contract.md` §2.7 as **required owner input** with clinical
rationale and the exact question each owner must answer. They were deliberately **not invented**: an
agent authoring pediatric reference-interval semantics into a schema that gates clinical decision
support is precisely the failure this plan exists to prevent.
