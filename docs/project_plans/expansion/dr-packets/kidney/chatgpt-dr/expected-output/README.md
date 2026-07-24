# Expected output — ChatGPT Deep Research / kidney_suite_v1

Save ChatGPT's returned output into the `external_research_handoff/v1` directory packet below, then
hand it back so Metis can run `rf intake external-report`. Everything imports as
`platform_synthesis` → **candidates only**; ChatGPT's condition→threshold rows are candidate
assertions, never verified evidence.

> **Layout source:** `research-foundry/docs/project_plans/PRDs/enhancements/external-research-report-interchange-v1.md` §6.1 (packet layout), §6.6 (producer profiles — ChatGPT overlay: "map cited answer/source exports into packet-local IDs; no OpenAI API call or session scraping"), §5 / FR-9 (`rf intake external-report`). This packet follows that draft PRD as read on 2026-07-24.

## Directory layout to create

```text
external_research_handoff/v1/
├── handoff.yaml                 # required — packet metadata + sorted member manifest
├── report.md                    # required — content_role: platform_synthesis (ChatGPT's narrative + gap/conflict notes)
├── sources.yaml                 # required — one packet-local ID per source ChatGPT cited (DOI/URL/year/license)
├── assertion_candidates.yaml    # required — the extraction: one candidate per condition→threshold row, each referencing a sources.yaml ID
├── activity.yaml                # optional — trace only; non-authoritative
└── attachments/                 # optional — manifest-listed regular files only
```

### Per-file notes for the ChatGPT profile

- **`handoff.yaml`** — `schema: external_research_handoff`, `version: v1`, `producer_profile: chatgpt`,
  research question ("net-new candidate-pattern table for kidney_suite_v1 / RF-KID-001"), declared
  sensitivity, creation time, content roles, sorted member inventory. No credentials, tokens, or paths.
- **`report.md`** — `content_role: platform_synthesis`. Paste ChatGPT's narrative, the
  candidate-without-threshold list, and the unit/population-conflict notes here. Prose is context, never
  a supported claim.
- **`assertion_candidates.yaml`** — the **core deliverable for this profile**. One packet-local candidate
  ID per condition→threshold row. Each candidate carries: candidate text (the pattern), `classification`
  (`assertion` for a source-cited threshold, `inference` for a derived flag), `relation`, the referenced
  `sources.yaml` ID, and the quoted text / selector when ChatGPT has it. Producer confidence is a
  non-authoritative hint. Threshold + UCUM unit belong in the candidate text/fields — keep both unit
  systems where the source gave both.
- **`sources.yaml`** — one entry per cited source: packet-local ID, locator (DOI/stable URL), title,
  date, declared license/access. Put ChatGPT-specific citation metadata under a namespaced extension
  (e.g. `x_chatgpt: {...}`). Use `unknown`/null rather than inventing a field.
- **`activity.yaml` / `attachments/`** — optional; attachments listed + hashed, regular files only.

> If ChatGPT emitted rows with `NO CITATION — do not use` in the threshold cell, keep them in
> `assertion_candidates.yaml` as `basis_incomplete` candidates (or list them in `report.md`) — they are
> real patterns lacking a groundable number, which the human seam still wants to see. Do not fabricate a
> citation to make them promotable.

## Intake command (run by Metis, not the owner)

```bash
set -a; . ~/.config/research-foundry/serve.env; set +a

rf intake external-report docs/project_plans/expansion/dr-packets/kidney/chatgpt-dr/expected-output/external_research_handoff/v1 \
  --workspace <kidney_workspace_id> \
  --run <kidney_run_id> \
  --dry-run

rf intake external-report docs/project_plans/expansion/dr-packets/kidney/chatgpt-dr/expected-output/external_research_handoff/v1 \
  --workspace <kidney_workspace_id> \
  --run <kidney_run_id>
```

- `--run <kidney_run_id>` is a **documented placeholder** — fill with the RF-KID-001 deepen run id once
  Leg A is launched (P2). Omitting `--run` imports staging-only (no run created; PRD §10 default).
- `--workspace <kidney_workspace_id>` — the target rf workspace for this run.
- Only rf's verifier assigns `verified` via exact-passage binding; this import stages candidates only.
