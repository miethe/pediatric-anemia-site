# Expected output layout — Gemini Deep Research / growth_suite_v1

Save the Gemini result into an `external_research_handoff/v1` packet so `rf intake external-report` accepts
it. Layout and the Gemini producer overlay are taken from the RF PRD
**`external-research-report-interchange-v1`** (§6.1 packet layout, §6.6 producer profiles, §5 user journey).

> **Source-doc note:** transcribed from
> `research-foundry/docs/project_plans/PRDs/enhancements/external-research-report-interchange-v1.md`
> (read 2026-07-24). The PRD is **draft** and the importer is not confirmed shipped — treat exact field
> names as PRD intent. If `rf intake` rejects a field, reconcile against the then-current
> `schemas/external_research_handoff.schema.yaml` in the rf repo.

## Directory layout

```text
external_research_handoff/v1/
├── handoff.yaml                 # required — packet metadata + member manifest
├── report.md                    # required — content_role: platform_synthesis (the Gemini prose)
├── sources.yaml                 # required — the recency / successor sources (Section A)
├── assertion_candidates.yaml    # required — revised-numeric candidates if any; else candidates: []
├── activity.yaml                # optional — trace only (grounding/search steps if exported)
└── attachments/                 # optional — manifest-listed regular files only
```

Put the tree under a run-scoped directory, e.g.
`dr-returns/growth/gemini-dr/<date>/external_research_handoff/v1/`.

## Per-file guidance (Gemini producer overlay)

- **`handoff.yaml`** — `schema: external_research_handoff`, `version: v1`, `producer_profile: gemini`,
  research question/task context ("growth_suite_v1 recency + breadth sweep"), `declared_sensitivity: public`,
  creation time, content roles, sorted member inventory. No credentials or filesystem paths.
- **`report.md`** — the Gemini narrative verbatim, `content_role: platform_synthesis`, **including Section
  B (the `future-module:` one-liners)**. Section B is trace/idea material — see "Asides handling" below.
- **`sources.yaml`** — one packet-local `source_id` per Section-A recency/successor source, with DOI/URL,
  title, year, declared metadata. Gemini grounding/source references and answer spans normalized into a
  namespaced `x_gemini:` extension. Overlay boundary: **normalize grounding/source references and answer
  spans; no Google API coupling.**
- **`assertion_candidates.yaml`** — stage any *revised numeric threshold* Gemini surfaced as a candidate
  (`classification: assertion`, cite the new source, `quoted_text`/selector, confidence as hint). If Gemini
  only returned recency/supersession findings with no new numeric, this may be `candidates: []`. Say
  `unknown` / leave empty rather than invent.
- Every field is untrusted data; injection-shaped strings stay inert.

## Asides handling (§6 future-module captures)

Gemini's Section-B one-liners are **idea captures, not evidence.** They do NOT belong in `sources.yaml` or
`assertion_candidates.yaml` as candidates. After intake, pipe each into the program IntentTree as a T0
capture (0 agents), verbatim in the design's format:

```bash
op capture "future-module: <domain> — <one-line clinical rationale> — <candidate anchor guideline>"
```

Guardrail (05-doc §6): an aside is an idea capture, never a rule, never a bundle — no aside touches
`modules/`.

## Intake command

```bash
# 1) Dry-run first — validates structure + computes identity, no canonical mutation:
rf intake external-report <packet_dir> \
  --workspace <growth_workspace_id> \
  --run <growth_run_id> \
  --dry-run

# 2) Real import — stages platform_synthesis + any revised-numeric CANDIDATES only:
rf intake external-report <packet_dir> \
  --workspace <growth_workspace_id> \
  --run <growth_run_id>
```

- `<packet_dir>` = directory containing `external_research_handoff/v1/`.
- `<growth_run_id>` = **PLACEHOLDER** — the rf run id for the growth deepen run (Leg A), filled after the
  P2 launch of `Deepen RF-GRO-002` (05-doc §10). Omit → staging-only import (PRD §5 / target-run-optional
  assumption).
- `<growth_workspace_id>` = the rf workspace hosting the growth run; always explicit.

Everything imports quarantined from `verified`. Only the rf verifier assigns `verified` via exact-passage
binding — this packet never crosses that line.
