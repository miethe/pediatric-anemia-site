# DR HITL Packets — module evidence runs

> Companion to [`../05-three-module-evidence-run-design.md`](../05-three-module-evidence-run-design.md) (§4 = the HITL loop + trust invariants)
> and, for the `anemia/` packets, [`../06-anemia-red-cell-indices-evidence-run.md`](../06-anemia-red-cell-indices-evidence-run.md) (§6 = Leg B).
> These packets are the **Leg B** upstream: owner-run deep-research, imported into rf as **candidates only**.

## What this is

12 packets = **3 providers × 4 modules**. Each packet is paste-ready: a provider prompt, a manifest of
files to attach, and the return-layout the output must be saved into for `rf intake external-report`.

```
dr-packets/
  cbc/     { perplexity/  chatgpt-dr/  gemini-dr/ }
  growth/  { perplexity/  chatgpt-dr/  gemini-dr/ }
  kidney/  { perplexity/  chatgpt-dr/  gemini-dr/ }
  anemia/  { perplexity/  chatgpt-dr/  gemini-dr/ }   ← RF-ANE-001 (design 06)
                 │            │            │
                 │            │            └─ RECENCY + BREADTH  (newest guidelines, adjacent-domain / future-module signals)
                 │            └─────────────  STRUCTURED EXTRACTION  (candidate-pattern table: condition→trigger→threshold+UCUM→source)
                 └──────────────────────────  SOURCE-GATHERING  (ranked citation list: DOI / URL / year / license)

  each provider dir = { prompt.md · attachments.md · expected-output/README.md }
```

**Role deltas for `anemia/` (RF-ANE-001).** Same three roles, retargeted at a reference-interval
substrate rather than candidate patterns: chatgpt-dr produces an **interval table** (analyte × age band
× sex × value × UCUM × **measurement method**) plus discriminator and definition tables; perplexity
hunts **quotable numeric carriers** (`free-to-read` kept distinct from `open-access`); gemini-dr covers
**recency + a deprecation list** — what not to encode. See design 06 §6.

## The HITL loop (per packet)

1. **Metis prepared** the packet (this directory) — nothing else automated.
2. **Owner runs** `prompt.md` in the provider UI, attaching the files listed in `attachments.md`.
3. **Owner saves** the provider output into the `external_research_handoff/v1` layout in `expected-output/README.md`.
4. **Metis imports:** `rf intake external-report <packet_dir> --run <module_run_id>` → candidates, tagged `platform_synthesis`.

## Trust invariants (non-negotiable, repeated in every prompt.md)

- Provider prose is always `platform_synthesis` → **candidates only, never verified evidence**. Only rf's verifier assigns `verified` via exact-passage binding.
- Every source returned with **DOI/URL + year + license/access status**; no numeric threshold without a citation.
- Paywalled / rights-restricted sources are **flagged, never paraphrased around** (they route to the licensing/REG-002 track).
- **Numerics-first:** threshold-bearing, independently-retrievable (public-domain → open-license) passages beat copyrighted framework prose.

## Import order (after results returned)

Import per module into that module's rf deepen-run id (see design 05 §8 P2/P3; design 06 §10 for
`anemia/`). Suggested sequence follows provider role: **perplexity** (sources) → **chatgpt-dr**
(structured candidates) → **gemini-dr** (recency + asides). Run the gpt-5.6-terra
passage-fidelity/numeric audit (design 05 §5) before merging into the bundle.

**`anemia/` deconfliction.** RF-ANE-001 and the `cbc_suite_v1` deepen run both touch pediatric CBC
reference intervals. RF-ANE-001 **consumes** cbc's CALIPER numerics rather than re-running that hunt,
and owns only the red-cell-index substrate the anemia engine consumes (design 06 §2). Duplicate claims
across the two bundles are a merge defect — check at merge, the failure is silent.
