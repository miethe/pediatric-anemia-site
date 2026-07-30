---
title: "Research Foundry ERI — enhancement spec (external research import path)"
description: "Portable, code-grounded defect and enhancement spec for Research Foundry's external-research-import path, derived from a real 7-packet / 429-action run that resolved 36 of 120 sources and produced 0 verified claims. 19 gaps, each with file:line evidence, the measured failure it caused, a proposed fix and acceptance criteria. Intended for delivery to the research-foundry project."
status: proposal
created: 2026-07-30
owner: Nick Miethe
project: pediatric-cds-platform
target_project: research-foundry
derived_from: "07-dr-packet-ingest-p3-execution-record.md; PR #36 root-cause analysis 2026-07-30"
related: "10-dr-claim-reanchoring-design.md"
---

# Research Foundry ERI — enhancement spec

**Audience:** the `research-foundry` maintainers. Written to be read without any pediatric-CDS context.

**Provenance.** Every gap was found by tracing `rf` source and reconciling it against a real run: 7
external research packets, 429 actions, **36 of 120 sources resolved (30%)**, **2 of 309 candidates
passage-bound (0.6%)**, **0 verified**. Cross-checked against the 766 effect files that run produced.
Line references are to `research-foundry` as of 2026-07-30.

**Headline.** Most of that loss is not a property of the sources. Probing all 120 cited locators over
HTTP independently: only **3 are dead**, 66 return 200 to a plain `curl`, 41 return 403 (publisher
bot-blocking). The single largest cause is **G1 — `rf` cannot resolve a DOI**.

### Loss decomposition (the motivating run)

| Bucket | Count | Attributable to |
|---|---:|---|
| DOI-only source — never fetched (G1) | 29 | `rf` |
| URL present, HTTP GET failed — largely anti-bot (G4, G9, G10) | 28 | mixed |
| Declared `paywalled`, rejected pre-fetch (G3, G11) | 20 | policy default |
| No locator in the producer's report | 7 | the producer |
| Resolved | 36 | — |

### Priority

| Rank | Gaps | Theme | Why first |
|---|---|---|---|
| 1 | **G5, G6, G7** | correctness of binding | they produce or prevent *false* verifications; raising yield before these land increases the false-positive rate |
| 2 | **G1, G10, G9** | acquisition yield | largest measured loss; G1's minimal fix is a few lines |
| 3 | **G2, G15, G16** | observability | G2 caused a real operator misdiagnosis and blocks all future self-diagnosis |
| 4 | **G4, G12, G13, G14, G11** | acquisition robustness & control | retries, caching, timeouts, policy overrides, local assets |
| 5 | **G3, G8, G17, G18, G19** | naming, edge cases, hygiene | no direct yield impact |

---

## Correctness of binding

### G5 — passage selectors have no minimum-content requirement

**Evidence.** `AssertionRegistry.ingest` requires only that a selector be a non-empty string and that
selectors be mutually distinct (`assertion_registry.py:399-401`). `_resolve_candidate_impl` binds by
exact substring with an ambiguity guard (`external_research_resolution.py:845-854`: more than one
same-edition match → `citation_ambiguous`). There is **no minimum-content rule**.

**Failure caused.** A bare numeral is a legal passage selector. In the motivating run **32 of 309
candidate quotes (10%) were purely numeric** — `'323'`, `'350'`, `'2.90'` — and 109 (35%) were ≤20
characters. A three-digit number occurring exactly once in an acquired document would bind and carry a
`passage_resolved` tier with no semantic tie to the claim.

*Correction, recorded for honesty:* an earlier draft asserted this had caused the run's 2 observed
bindings. That was wrong. Recomputing `passage_id = "psg_" + sha256(f"{edition_id}:{sha256(quote)}:{index}")`
(`assertion_registry.py:717-745`) identifies them as `ane_gpt_c40` (`>360 g/L`) and `ane_gpt_c62`
("Hematocrit levels that are too low may be a sign of anemia.") — neither numeric, both legitimate
verbatim lifts. **G5 is a demonstrated latent hazard, not the cause of an observed defect.** It
matters because any effort to raise binding yield will exercise it.

**Fix (small).** Reject purely numeric/punctuation spans; enforce a minimum length; require at least
one alphabetic token; emit a distinct `selector_not_contentful` so producers can correct packets.
**Fix (medium).** For a numeric claim, require the span to carry the number plus at least one of its
unit, population, or qualifying term.

**Acceptance.** A purely numeric selector cannot reach `passage_resolved`; existing such records are
re-classified rather than silently retained.

---

### G6 — quote provenance is unspecified at the contract boundary

**Evidence.** `rf` binds candidate quotes against the **acquired source text**
(`external_research_resolution.py:845`). The handoff contract does not state this as a producer
requirement, and the producer profiles are built around a `report.md` that `rf` itself designates
non-authoritative `platform_synthesis` (`cli_commands.py:1150-1158`).

**Failure caused.** A producer that transcribes quotes verbatim from its own report — the natural
reading — produces packets whose candidates largely cannot bind. Since a deep-research report
paraphrases, its prose is usually not a substring of the underlying paper. The motivating run bound 2
of 309; both were cases where the provider *quoted* rather than paraphrased.

This is contract under-specification rather than a code defect, but it is the single largest
determinant of whether an external packet can ever yield a verified claim.

**Fix (small).** State in the contract and in `intake --help` that `assertion_candidates[].quote` MUST
be a verbatim span of the **cited source**, not of the producer's report, and that report-derived
quotes will not bind.
**Fix (medium).** Support two explicit fields — `quote_source` (binding anchor) and `quote_report`
(provenance/search hint) — so packets can carry both honestly instead of conflating them.

**Acceptance.** The contract states which document a quote must come from; a packet supplying only
report-derived quotes fails fast rather than quarantining 99.4% of candidates one at a time.

---

### G7 — passage matching is byte-exact SHA-256 with zero normalization

**Evidence.** `find_exact_passages` (`assertion_registry.py:479-499`) compares `_digest(raw_text)`
against `passage["raw_text_sha256"]`; `_load_passage_file` (:657-658) enforces the same identity.
`extract_bytes` (`external_research_resolution.py:348-389`) applies no normalization beyond whitespace
collapsing in the HTML extractor (:337) and a UTF-8 decode with `errors="replace"` (:369). The PDF
extractor (`extractors/pdf_extractor.py:82-94`) is a raw `page.extract_text()` join with no
de-hyphenation.

**Failure caused.** A quote that is *physically present* in the source still quarantines as
`citation_unresolved` if it differs by one soft hyphen, U+2010 vs U+002D, a smart quote, a
non-breaking space, a ligature (`ﬁ` vs `fi`), or a line-break-hyphenated word. These are endemic to
PDF extraction. This makes exact matching against PDF-derived text close to unusable, and it is a
hard blocker for any re-anchoring workflow.

**Fix (large).** A normalization stage (NFC, fold hyphen/dash/quote/space variants, de-hyphenate
line-break splits) applied **symmetrically** at ingest and query time; or a locality-preserving fuzzy
match behind a flag with strict as the default. Either way, pair it with a new reason/tier (e.g.
`passage_binding_normalized`) so audits can separate exact hits from normalized hits.

**Acceptance.** A quote copied from the same PDF via a different extractor binds; audits can tell
exact from normalized matches.

---

## Acquisition yield

### G1 — `rf` cannot resolve a DOI-only source (critical)

**Evidence.** `external_research_resolution.py:742`:

```python
acquisition = self._acquire(
    normalized.locator.url or f"doi:{normalized.locator.doi}",
    ...
)
```

The literal string `doi:10.1234/xyz` reaches `canonicalize_locator`
(`source_acquisition_policy.py:291`), rejected at :308:

```python
if scheme not in allowed_schemes or scheme not in ("http", "https"):
```

There is no DOI resolution anywhere in the acquisition path — no `doi.org` prefixing, no Crossref, no
Unpaywall.

**Failure caused.** A DOI-only source can *never* resolve, regardless of open-access status. Clean
experiment from the run: a packet of 10 DOI-only open-access papers resolved **0**. Across the run,
**29 sources were rejected on a scheme check with no network request made**, then reported to the
operator as `source_unavailable` — i.e. as though retrieval had been attempted and failed.

**Fix (small).** Expand a DOI-only locator to `https://doi.org/<doi>` before `acquire()`. Measured:
this alone would move **15 of the 29** to fetchable, lifting source resolution from 30% to ~42%.
**Fix (medium).** See G10.

**Acceptance.** A DOI-only open-access source reaches `source_resolved`; an unresolvable DOI reports a
reason distinguishable from transport failure (G2).

---

### G10 — no scholarly-metadata providers (Unpaywall / Crossref / PMC / OpenAlex)

**Evidence.** Searching the tree for `unpaywall|crossref|openalex|pubmed|pmc|arxiv|semanticscholar`
yields only docstring mentions (`search_router/mcp_server.py:326-327`, `search_router/modes.py:143`,
`verification.py:1190`). `search_router/providers/` contains Brave, Exa, Firecrawl, GitHub, Jina and
SearXNG adapters only — no scholarly-metadata provider. `search_router` is also not wired into the ERI
resolver: `ExternalResearchResolver._acquire` is bound to `source_acquisition_policy.acquire` and
nothing else (`external_research_resolution.py:110`, :741).

**Failure caused.** Combined with G1 and G9, DOI-only packets have essentially zero acquisition
surface. `rf` cannot obtain an OA copy for a DOI whose publisher page is gated, cannot get canonical
metadata, cannot fall back to PMC.

**Fix (large).** A metadata-resolution stage before `acquire()`: given a DOI, query Unpaywall
(`api.unpaywall.org/v2/{doi}?email=`), Crossref (`api.crossref.org/works/{doi}`), or PMC E-utilities to
obtain a fetchable HTTPS URL, then hand that URL to the existing `acquire()` gate. Each provider is a
small adapter; the wiring is the harder part.

**Acceptance.** A paywalled-at-publisher DOI with an OA copy elsewhere resolves.

---

### G9 — no content negotiation and no landing-page → PDF traversal

**Evidence.** `_build_request` (`source_acquisition_policy.py:553-561`) sends only `GET`, `Host`,
`User-Agent`, `Accept: */*`, `Connection: close`. `extract_bytes`
(`external_research_resolution.py:348-389`) dispatches on content type and magic bytes only; it never
inspects HTML for `<meta name="citation_pdf_url">`, `<link rel="alternate" type="application/pdf">`, or
Highwire/DC metadata that publishers routinely expose to point crawlers at full text. Redirects follow
`Location:` only, capped at 3 hops (:624, :709-729).

**Failure caused.** A DOI URL redirects to a publisher landing page; `rf` extracts the landing page's
title/abstract/paywall notice as the source text; every quote from the paper's body then fails to
match. The source looks resolved-but-unmatchable, or quarantines — even though `citation_pdf_url` was
sitting in the page `<head>`.

**Fix (large).** Send scholarly-appropriate `Accept` headers; after acquiring HTML, parse
`citation_pdf_url` / `<link rel="alternate">` and issue one follow-up acquisition to the PDF, under all
existing per-hop address gates, capped at one follow-up and costed against `max_hops`.

**Acceptance.** A DOI that lands on a publisher page with a `citation_pdf_url` yields the PDF's text.

---

### G4 — bot-hostile, uncontactable User-Agent

**Evidence.** `source_acquisition_policy.py:556` sends `User-Agent: research-foundry-eri/1`, with no
contact URL or `mailto:`, and no `From:` header. `acquire()` is a hand-rolled `http.client`
implementation (:11 — "`acquire` *is* the HTTP client").

**Failure caused.** 28 sources in the run had a valid URL and still failed. An independent probe of the
same locators with a browser `User-Agent` returned 200 for 66 of 120 and 403 for 41 — publisher
anti-bot gates, not missing content. A bare bot UA can only do worse. Separately, Crossref and several
publisher robots policies grant higher rate limits to crawlers that advertise a contact
(`Crossref-Polite-Pool`); `rf` forfeits that.

**Fix (small).** Policy-configurable UA defaulting to the scholarly convention
`research-foundry/1 (+https://<homepage>; mailto:<email>)`; send `From:` when supplied; forbid the
empty string in the policy schema.

**Acceptance.** Measurable reduction in 403-class failures on a fixed corpus of open-access DOIs.

---

## Observability

### G2 — `source_unavailable` collapses ~8 distinct failure modes into one opaque code

**Evidence.** `source_acquisition_policy.py:60-66` states the intent:

> Every `deny` outcome carries a rich `denial_code` for this module's own callers (audit-only) —
> never a caller-visible reason. `external_research_resolution.py` collapses every acquisition-layer
> failure into exactly one closed-vocabulary `source_unavailable` reason … satisfying contract §4.3's
> "one generic denial, zero reason-code differential" rule structurally rather than by careful
> omission.

The one code merges DNS failure, connection refused, timeout, any non-2xx, TLS error, redirect-limit,
oversized response, forbidden-address category, **G1's scheme rejection**, and — from a different call
site (`external_research_resolution.py:751`) — *successful download whose text extraction produced
nothing*.

Confirmed in the artifacts: all **766** effect files carry an identical 11-key schema
(`schema_version, type, receipt_digest, action_id, kind, outcome, completeness_tier, reason_code,
canonical_refs, effect_digest, created_at`). No status code, error string, attempted URL, or timing.

**Failure caused.** An operator cannot distinguish "we never tried" from "the publisher blocked us"
from "we downloaded the PDF but could not parse it." In the motivating run this **directly caused a
misdiagnosis**: 57 `source_unavailable` were read as evidence the sources were unretrievable and a
licensing workstream was proposed, when at least 29 needed only G1. The error was undetectable from
the receipts; it took a source-code trace to find.

**Fix (small).** Split the two clearly non-sensitive cases into their own closed-vocabulary codes:
`locator_scheme_unsupported` (no network contact occurred) and `extraction_failed` (content acquired,
parsing failed). Neither reveals anything about a remote host the operator did not already supply. See
also G15 for the storage side.

**Acceptance.** From artifacts alone, an operator can determine whether a network request was
attempted; the `zero reason-code differential` guarantee still holds on the JSON/machine caller
surface.

---

### G15 — no per-run acquisition log; `AcquisitionOutcome` diagnostics are discarded

**Evidence.** `AcquisitionOutcome` (`source_acquisition_policy.py:580-594`) carries `denial_code`,
`status_code` and `hops`. `_resolve_source_impl` reads only `.ok` and `.content`
(`external_research_resolution.py:746-747`) — the rest is thrown away. There is no on-disk acquisition
log anywhere in the tree.

**Failure caused.** G2 is not only a vocabulary problem, it is a **storage** problem: even with source
access, no one can answer after the fact "was this source ever fetched, and what did the server
return?"

**Fix (small).** An append-only, workspace-scoped `acquisition_log.jsonl` in the data plane (never in
the receipt, never in the packet): `source_id`, `final_locator`, `status_code`, `denial_code`, `hops`,
`bytes`, `elapsed_ms`, timestamp — written just after the `acquire()` call regardless of outcome. The
receipt vocabulary can stay closed while the operator gains a diagnostic surface.

---

### G16 — every promotion failure collapses to `verification_failed`

**Evidence.** `_finish_passage_resolved` (`external_research_resolution.py:924-956`) calls
`self._promote(request)` at :952 and returns `_candidate_quarantine("verification_failed")` at :954 on
any non-OK result. The specific reason — schema failure, quote-fidelity mismatch, rights denial, path
collision — is discarded.

**Fix (small).** Propagate `PromotionOutcome.reason` and add a small closed vocabulary
(`schema_failed`, `quote_fidelity_failed`, `rights_denied`, `path_collision`).

---

## Acquisition robustness and control

### G12 — no retry, no cross-run caching, no per-host rate limiting

**Evidence.** `acquire()` (`source_acquisition_policy.py:597-741`) is single-shot: any connect/read
exception returns a denial at :682 or :704 with no retry, no backoff, and no `Retry-After` handling
(`_ALLOWED_STATUS_2XX = range(200,300)` at :101 collapses every non-2xx). `_resolve_source_impl` calls
`_acquire` exactly once (`external_research_resolution.py:741-751`) and never caches — no on-disk
keying by URL/DOI, no ETag/`Last-Modified` (`_build_request` :553-561). No politeness delay, host
queue, or concurrency lock exists.

**Failure caused.** (a) a publisher 502s once and the source is lost for the whole packet; (b)
re-running a 700-source packet issues 700 fresh requests; (c) bursts trigger IP rate limits that
cascade back as `source_unavailable`.

**Fix (medium).** Bounded retry with jitter for 5xx/timeouts; an on-disk content cache keyed by
`(final_locator, content_sha256)`; a per-host token bucket. Cache reads should return the same
`AcquisitionOutcome` shape so callers stay oblivious.

---

### G13 — timeout and max-bytes are hardcoded and unreachable from the CLI

**Evidence.** `DEFAULT_TIMEOUT_SECONDS = 10.0` (`source_acquisition_policy.py:97`, used at :601) and
`DEFAULT_MAX_RESPONSE_BYTES = 25_165_824` (:98). `ExternalResearchResolver.__init__` accepts a
`timeout` kwarg (`external_research_resolution.py:553`) and passes it at :744, but
`import_external_report` never sets it (`external_research_import.py:473-475`), and the CLI exposes no
`--timeout`. No env var, no `foundry.yaml` lookup.

**Failure caused.** Publisher endpoints that legitimately take >10s time out unconditionally, with no
operator remedy short of editing source.

**Fix (small).** Surface `--timeout` and `--max-bytes` and thread them to the seam that already
accepts them.

---

### G14 — acquisition and authorization policies cannot be overridden except from Python

**Evidence.** `rf intake external-report` exposes only `packet_dir`, `--workspace`, `--run`,
`--dry-run`, `--resume`, `--limit`, `--json` (`cli_commands.py:1125-1147`). `import_external_report`
accepts `policy` and `authorization_policy` kwargs (`external_research_import.py:321-408`) reachable
only in-process; defaults are the hardcoded `DEFAULT_ACQUISITION_POLICY` (:99-176) and
`AuthorizationPolicy()`. No `foundry.yaml` key, no env var.

**Failure caused.** An operator cannot permit a corporate IP range, change
`require_rights_for_access_statuses`, widen redirect hops, or set a User-Agent without monkey-patching.

**Fix (medium).** `--policy PATH` and `--authorization-policy PATH`, plus a documented `foundry.yaml`
`eri.acquisition_policy` / `eri.authorization_policy` block.

---

### G11 — the local-asset carve-out is advertised in policy but entirely unimplemented

**Evidence.** `DEFAULT_ACQUISITION_POLICY["local_asset_carve_out"]`
(`external_research_import.py:163-168`) declares `packet_internal_attachment_resolution: True`,
`out_of_packet_requires_operator_grant: True`, `operator_grant_binds_path_and_digest: True`. Searching
the tree for those keys returns **only the declaration — there is no consumer.** `acquire()` has no
`file://` or local-asset branch; `canonicalize_locator` rejects any non-http(s) scheme; and
`NormalizedLocator` (`external_research_resolution.py:123-142`) has only `doi` and `url` fields.

**Failure caused.** An operator holding a legitimately obtained PDF for a paywalled paper has no
supported way to satisfy that source. The policy advertises a capability the code does not have. This
is the natural remedy for the 20 `paywalled` sources in the motivating run, and it does not exist.

**Fix (medium).** Add an optional `local_asset: {path, sha256}` to `NormalizedLocator`; add a branch in
`_resolve_source_impl` that reads the file, verifies its digest against the operator grant, and hands
bytes to `extract_bytes`, bypassing `acquire()`; surface `--operator-grant PATH`.

---

## Edge cases and hygiene

### G3 — `rights_metadata_missing` is misnamed and fires on *present* metadata

**Evidence.** `external_research_resolution.py:399-407`:

```python
class AuthorizationPolicy:
    denied_access_statuses: frozenset[str] = frozenset()
    require_rights_for_access_statuses: frozenset[str] = frozenset({"paywalled"})

def _authorize_source(normalized, policy) -> str | None:
    if normalized.access_status in policy.denied_access_statuses:
        return "sensitivity_denied"
    if normalized.access_status in policy.require_rights_for_access_statuses:
        return "rights_metadata_missing"
```

Invoked at :718, **before** any locator check or acquisition. `rf`'s own test is
`test_paywalled_source_quarantines_rights_metadata_missing_without_acquiring`
(`tests/integration/test_external_research_resolution.py:466`). *(Directly verified — this returns the
string `rights_metadata_missing`, not a distinct code.)*

**Failure caused.** The code fires when `access_status` **is present and equals `"paywalled"`**.
Nothing is missing. Verified: the run's 20 `rights_metadata_missing` sources are an **exact per-packet
match** (7/7) to the 20 records declaring `access_status: "paywalled"`. The name caused these to be
read as a producer metadata-quality problem when they are an importer policy decision.
(`access_status: "unknown"` is accepted — non-obvious, worth documenting.)

Note a second conflation: `AssertionRegistry.ingest` emits `missing_rights_metadata` when `allowed_use`
is empty (`assertion_registry.py:390`), and `external_research_resolution.py:776` maps it to the **same
caller-visible string** — so two genuinely different conditions are indistinguishable.

**Fix (small).** Rename the pre-acquisition case to `rights_not_cleared`; reserve
`rights_metadata_missing` for the genuinely-missing case; document the default in `intake --help`.

---

### G8 — truncated documents are silently matched against

**Evidence.** `_MAX_EXTRACT_CHARS = 100_000` (`external_research_resolution.py:304`); text over that is
truncated and returned as `STATUS_PARTIAL` with a `("truncated",)` diagnostic (:387-388).
`_resolve_source_impl` (:749-803) treats `extraction.status` as opaque — it ingests the truncated body
and never surfaces the diagnostic.

**Failure caused.** A `citation_unresolved` on a paper whose full text just exceeded 100 000 characters
is indistinguishable from one that was never fetched; the quote may exist past the truncation point.
For guideline PDFs — exactly our use case — this is a common size.

**Fix (medium).** Make the cap policy-configurable, and either fail closed on `STATUS_PARTIAL` with a
distinct `content_truncated` reason or persist the diagnostic on the source edition so downstream
verification can distinguish a genuine miss from a truncation-window miss.

---

### G17 — `_existing_edition_reuse` locks the edition on the first matching quote

**Evidence.** `external_research_resolution.py:685-713`: the loop returns as soon as *any* quote
matches (:697-712), fixing `edition = matches[0][0]`, then classifies all remaining quotes against that
edition. Quotes belonging to a different edition of the same source are classified `not_found` (:711)
rather than `ambiguous` or `citation_mismatch`.

**Failure caused.** With multiple editions of a source in the registry (any re-import after upstream
content changed), edition selection is order-dependent on quote iteration and other editions' correct
matches are discarded.

**Fix (small).** Gather matches across all quotes into `{edition_id: matched_quotes}`, choose the
edition covering the most quotes, quarantine `citation_ambiguous` on a tie.

---

### G18 — the two-ingest pattern writes N+1 passages per source

**Evidence.** `_resolve_source_impl` ingests once with `passages=None`
(`external_research_resolution.py:757-774`) — the inline comment explains this deliberately avoids a
latent registry landmine where `passages=[]` publishes an empty pointer that `_load_passages` then
rejects on every subsequent read — and then re-ingests once per quote with `passages=[quote]`
(:788-796).

**Failure caused.** Two registry writes per source and `N+1` passages, plus a documented landmine that
forecloses ever passing an empty explicit list. *Lower confidence than other entries: the correctness
impact is unclear and may be nil; reported as hygiene.*

**Fix (small).** A single ingest carrying `[whole_body] + quotes`, or fix the underlying `passages=[]`
behaviour so an empty list is safe.

---

### G19 — candidate/source ordering dependency (**unverified**)

**Evidence.** `_resolve_candidate_impl` (`external_research_resolution.py:808-822`) returns
`citation_unresolved` (:821) if no `resolvable_ref` is already in `self._source_outcomes` with tier
`source_resolved`. There is no re-resolution pass.

**Status: could not determine.** Whether `ExternalResearchInterchange._execute` guarantees
sources-are-resolved-before-candidates across a whole packet was not verified end to end. If it does,
this is a non-gap. If it does not, every out-of-order candidate is permanently lost. **Flagged for the
maintainers to confirm rather than asserted as a defect.**

**Fix (small, if real).** Defer via `ResolutionDeclined` when the source outcome is absent, letting the
batch driver re-service after all sources complete; otherwise document the ordering invariant.

---

## Checked and found sound

Recorded so maintainers do not re-investigate:

- **DNS-rebinding is closed.** `acquire()` re-checks the connected peer IP against the resolved and
  validated set (`source_acquisition_policy.py:686-695`).
- **Redirect *safety* is fine.** Every hop is revalidated against `canonicalize_locator` and the
  forbidden-address list, capped at 3 (:709-729). The complaint in G9 is redirect *behaviour*, not
  safety.
- **HTML extraction is minimal but safe.** stdlib `HTMLParser`, drops `<script>`/`<style>`, no JS
  execution, no network (`external_research_resolution.py:310-337`).
- **PDF extraction degrades cleanly.** `extract_pdf` returns `STATUS_LOCATOR_ONLY` on missing
  dependency, corrupt PDF, or no text layer, and never raises (`extractors/pdf_extractor.py:57-110`).
- **Multiple same-edition matches → `citation_ambiguous` is correct abstention**, not a bug
  (`external_research_resolution.py:853-854`).
- **Ignoring the producer's `locator_type` hint is contract-correct**
  (`external_research_import.py:167`) — the acquisition layer should not trust packet content. The
  real gap there is G11.
- **`pypdf` was present for the motivating run** (6.13.2 in the workspace venv), so the optional-extra
  hazard below did **not** contribute to its results.

**Deploy hazard worth a guard rather than a fix:** `pdf = ["pypdf>=3.0.0"]` is an optional extra
(`pyproject.toml:36`). A deployment without it silently turns every PDF into `locator_only`. The ERI
path should check availability at start-of-run and fail loudly rather than silently degrading.

## What we are not asking for

- No change to the `verified` tier's meaning or to the promotion seam.
- No relaxation of exact-passage binding. G5 asks for it to be **stricter**; G7 asks for normalization,
  which must be tiered so exact and normalized hits stay distinguishable.
- No change to the `platform_synthesis` posture on `report.md`. We agree with it — see
  `10-dr-claim-reanchoring-design.md` §2 for why binding claims to the producer's report would be the
  wrong fix.

## Reproduction

The motivating packets are committed at
`docs/project_plans/expansion/dr-packets/<module>/<provider>/expected-output/extraction.json` (7 files,
120 sources, 309 candidates) in the `pediatric-anemia-site` repository, with the builder and
deterministic gate under `tools/dr-packet/`. The corresponding `rf` receipts and 766 effect files are in
the `research-foundry` workspace under `external_research_interchange/workspaces/37a8eec1…/`.

## Method note

Gaps G1–G4 and G5–G6 were found by direct source tracing and reconciled against the run's effect files.
G7–G19 came from a delegated read of the ERI path, then re-verified against source before inclusion.
The design conclusions were adversarially reviewed; that review refuted the first draft's explanation
of G5's observed impact, and the correction is recorded inline above rather than quietly dropped.
