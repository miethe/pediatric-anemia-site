# Expected output — Gemini Deep Research / kidney_suite_v1

Save Gemini's returned output into the `external_research_handoff/v1` directory packet below, then hand
it back so Metis can run `rf intake external-report`. Everything imports as `platform_synthesis` →
**candidates only**; Gemini's grounding references and answer spans are candidate material, never
verified evidence. **Future-module asides do NOT go in the packet** — they are captured separately (see
below).

> **Layout source:** `research-foundry/docs/project_plans/PRDs/enhancements/external-research-report-interchange-v1.md` §6.1 (packet layout), §6.6 (producer profiles — Gemini overlay: "normalize grounding/source references and answer spans; no Google API coupling"), §5 / FR-9 (`rf intake external-report`). This packet follows that draft PRD as read on 2026-07-24.

## Directory layout to create

```text
external_research_handoff/v1/
├── handoff.yaml                 # required — packet metadata + sorted member manifest
├── report.md                    # required — content_role: platform_synthesis (Gemini's recency + breadth narrative)
├── sources.yaml                 # required — one packet-local ID per source (DOI/URL/year/license); Gemini grounding refs under a namespaced extension
├── assertion_candidates.yaml    # required — may be an empty candidates list (Gemini's role is recency/breadth, not extraction)
├── activity.yaml                # optional — trace only; non-authoritative
└── attachments/                 # optional — manifest-listed regular files only
```

### Per-file notes for the Gemini profile

- **`handoff.yaml`** — `schema: external_research_handoff`, `version: v1`, `producer_profile: gemini`,
  research question ("recency/supersession + breadth for kidney_suite_v1 / RF-KID-001"), declared
  sensitivity, creation time, content roles, sorted member inventory. No credentials, tokens, or paths.
- **`report.md`** — `content_role: platform_synthesis`. Paste Gemini's recency/supersession table,
  breadth table, and the "no supersession found" note here. Prose is context, never a supported claim.
- **`sources.yaml`** — one entry per surfaced source: packet-local ID, locator (DOI/stable URL), title,
  date, declared license/access, and a `supersedes/extends` note. Put Gemini grounding/citation metadata
  under a namespaced extension (e.g. `x_gemini: {...}`). Use `unknown`/null rather than inventing a field.
- **`assertion_candidates.yaml`** — required file; for the recency/breadth role it may be an **empty
  candidates list**. If Gemini extracted any condition→threshold rows, stage them here as
  `classification: assertion`, each referencing a `sources.yaml` ID.
- **`activity.yaml` / `attachments/`** — optional; attachments listed + hashed, regular files only.

### Future-module asides — capture OUTSIDE the packet

Gemini's `future-module: <domain> — <rationale> — <anchor>` lines are **idea captures, not evidence**.
Per run design §6, they land on the program IntentTree via `op capture`, NOT in this packet. Copy them
into `report.md` for the record if you like, but the canonical capture is:

```bash
op capture "future-module: hepatic/LFT panel — <one-line clinical rationale> — <candidate anchor guideline>"
```

They touch no rule and no module.

## Intake command (run by Metis, not the owner)

```bash
set -a; . ~/.config/research-foundry/serve.env; set +a

rf intake external-report docs/project_plans/expansion/dr-packets/kidney/gemini-dr/expected-output/external_research_handoff/v1 \
  --workspace <kidney_workspace_id> \
  --run <kidney_run_id> \
  --dry-run

rf intake external-report docs/project_plans/expansion/dr-packets/kidney/gemini-dr/expected-output/external_research_handoff/v1 \
  --workspace <kidney_workspace_id> \
  --run <kidney_run_id>
```

- `--run <kidney_run_id>` is a **documented placeholder** — fill with the RF-KID-001 deepen run id once
  Leg A is launched (P2). Omitting `--run` imports staging-only (no run created; PRD §10 default).
- `--workspace <kidney_workspace_id>` — the target rf workspace for this run.
- Only rf's verifier assigns `verified` via exact-passage binding; this import stages candidates only.
