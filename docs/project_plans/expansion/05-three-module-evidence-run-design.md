# 05 — Three-Module Evidence Run Design (CBC · Growth · Kidney)

> **Status:** proposed · **Author:** Metis (design pass, 2026-07-24) · **Route:** `research → rf` (T3 initiative, per-module T1/T2 legs)
> **Depends on:** [02-evidence-foundry-on-research-foundry.md](02-evidence-foundry-on-research-foundry.md) · [03-arc-clinical-council-handoff.md](03-arc-clinical-council-handoff.md) · [aos-asset-index.md](aos-asset-index.md) · `rf-handoff/RESULTS.md`
> **Nothing here is executed.** This is a launch-ready design. No rf run is started, no rule is authored, no attestation is written by this document.

---

## 0. TL;DR

Deepen the evidence behind the three `unsigned-stub` modules — `cbc_suite_v1`, `growth_suite_v1`,
`kidney_suite_v1` — so each can cross from *evidence-only* into *rule-bearing*, while capturing
future-module ideas as a cheap side-channel. Each module already sits on **one verified rf bundle**;
this run **extends** those bundles rather than starting cold.

Three objectives per module, all three selected by the owner:

1. **Deepen existing bundles → unblock rules** — extend each bundle, then author the missing
   `authoring-decisions.yaml` so the deterministic converter can emit rules (closes **DF-E1-M1**).
2. **Net-new candidate patterns** — discover clinical patterns each module should cover beyond the
   3–4 decisions its current bundle holds.
3. **Numerics-bearing passages** — specifically hunt *threshold-carrying, independently-retrievable*
   passages, because the platform's 13 currently-bindable passages are numerics-light (the
   threshold-bearing ones were quarantined `omits-source-numerics`).

The **manual deep-research providers** (ChatGPT Deep Research, Perplexity Pro, Gemini Deep Research)
are wired in as a **HITL upstream**, three ways: (a) division of labor by provider strength,
(b) future-module idea scouting, (c) owner-run source-gathering — Metis generates the provider prompt
+ attaches the key module files, the owner runs it and hands results back, and the output imports into
rf as **candidate feeders only** (`platform_synthesis` never launders into verified evidence).

**Hard honesty boundary, unchanged:** rf produces *verified claims, not rules*; the converter only
emits rules for a module with a committed `authoring-decisions.yaml`; and **no attestation ledger entry
is written by any agent** — grounding a rule still requires a named credentialed clinician deleting the
tripwire and attesting each rule individually. This run gets us to the doorstep of that human step; it
does not cross it.

---

## 1. Ground truth this design is built on

### 1.1 Module state (verified on disk, 2026-07-24)

| Module | `status` | rules.json | candidates | Bundle behind it | `evidenceReviewedThrough` | Converter-complete? |
|---|---|---|---|---|---|---|
| `cbc_suite_v1` | `unsigned-stub` | **4 rules** | 1 pattern | **RF-CBC-002** (`rf_run_20260717_rf_cbc_001…`) | 2026-07-21 | **Yes** (only module with committed `authoring-decisions.yaml`) |
| `growth_suite_v1` | `unsigned-stub` | `[]` empty | `{}` empty | **RF-GRO-002** (`rf_run_20260717_rf_gro_002…`) | 2026-07-21 | No — evidence-only, decisions `drafted_pending_human_approval` |
| `kidney_suite_v1` | `unsigned-stub` | `[]` empty | `{}` empty | **RF-KID-001** (`rf_run_20260717_rf_kid_001…`) | 2026-07-22 | No — greenfield, `intended_output: ["not_yet_implemented"]` |

`anemia` (91 rules, `integrity-recorded`) is **out of scope** for this run per owner decision.

### 1.2 The seam (from 02-evidence-foundry)

```
literature + local policy
  → rf run  : capture → triage → plan → ingest(×N) → [Path-B swarm] → extract → claim-map
              → synthesize --deterministic → verify → [council] → bundle       (rf owns: evidence → verified claim)
  → immutable handoff (run id + bundle SHA-256 + claim/passage lineage)
  → CDS     : rf-bundle-to-kb-pack converter → evidence projections → candidate drafts
              → clinician decisions (authoring-decisions.yaml) → rule DSL → compiler + tests
              → dual approval → signed KB manifest                             (CDS owns: claim → rule → release)
```

- The converter (`tools/rf-bundle-to-kb-pack/`) is **deterministic, offline, no-LLM, fails closed.**
- **`inspect` halts with `DecisionsNotFoundError`** if a module has no `authoring-decisions.yaml`.
  That is exactly why growth/kidney emitted zero rules — the blocker is **DF-E1-M1**, not missing evidence.
- Seam invariants that govern *what a run may produce*: only `verified` bundles admitted; `supported`
  claims → fact candidates **only with a resolved exact passage**; `mixed`/`contradicted` → conflict-visible
  objects only; `inference` → implementation-proposal inputs only; `speculation`/`unsupported` **rejected**;
  confidence never mapped to patient probability; absence never treated as normality.

### 1.3 The numerics problem (why objective #3 exists)

From `.claude/findings/rights-governance-spec-v1.0-review-findings.md`: of the 13 passages bindable
*today* (BLOOD 5, WHO 3, CDC 2, BSH 2, FDA 1), **all are `passageFidelity: paraphrase` and numerics-light** —
the threshold-bearing passages were quarantined `omits-source-numerics` during rights-avoidance paraphrasing.
Attesting the survivors grounds rules to *thin framework claims rather than the cutoffs they encode*.
**Design consequence:** every leg of this run must prioritize sources whose thresholds are (a) numeric and
UCUM-typed and (b) **independently retrievable** (public-domain or open-license), so the passages produced
are groundable to the actual numbers, not paraphrased frameworks.

### 1.4 What the external DR providers are (and are not)

rf has **no live ChatGPT/Perplexity/Gemini Deep Research API integration** — MODEL-ROUTING confirms zero
such adapters, and RFUP-6 native discovery adapters are `Deferred, 0/6 live`. The interchange path is the
draft PRD **`external_research_handoff/v1`** (vendor-neutral packet → `rf intake external-report <packet>
--workspace <id> [--run <id>]`). Trust rule is absolute: **external platform prose is always
`platform_synthesis`; its citations produce candidates only, never supported claims.** Only rf's own
verifier assigns `verified` via exact-passage binding. So the providers are a **manual upstream feeder**,
operated HITL — never a claim source.

---

## 2. Run architecture — three legs per module

Each of the three modules runs the **same three-leg structure**. Legs A and C are rf-native (automated
spine + Path-B swarm). Leg B is the HITL DR upstream. Legs run **concurrently**; they converge at the
per-module bundle merge.

```
                       ┌─────────────────────────────────────────────┐
   MODULE (e.g. cbc)   │                                             │
                       │   Leg A  rf DEEPEN run  (Path-B swarm)       │──► extends RF-CBC-002
                       │          net-new angles + candidate patterns │      → verified claims
                       │                                             │
                       │   Leg B  DR HITL packets (owner-run)         │──► external_research_handoff/v1
                       │          division of labor by provider       │      → candidate feeders (platform_synthesis)
                       │                                             │
                       │   Leg C  numerics/retrievability hunt        │──► exact-passage locators,
                       │          public-domain + open-license first  │      UCUM-typed thresholds
                       └───────────────────┬─────────────────────────┘
                                           │ merge + rf verify
                                           ▼
                              extended verified bundle  (rf owns → stops here)
                                           │
                        ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (human seam: DF-E1-M1)
                                           ▼
                    authoring-decisions.yaml  (clinician decisions, out of this run's automated scope)
                                           ▼
                    rf-bundle-to-kb-pack converter → rule-proposals → tests   (post-research follow-on)
```

### Leg A — rf deepen run (per module)

- **Mechanism:** `op research` → rf Path-B swarm (`rf-run-execute.js` workflow) — per-angle Claude scouts
  hydrate source cards via `aos-web` (free SearXNG lane) + native Gemini grounding, then the deterministic
  rf spine (`extract → claim-map → synthesize --deterministic → verify → bundle`) runs offline.
- **Reuse, don't restart:** launch with `retrieval_policy: catalog_then_discovery` so the existing bundle's
  claims are reused and only *new* angles hit discovery. **Check the catalog first**
  (`GET $RF_API_URL/api/catalog/search?q=…`) — a verified claim may already exist.
- **Card contract:** every source card must carry the `pediatric_cds` evidence-card extension
  (population / assay / threshold+UCUM / lifecycle / classification) — this is the **EF-WP1** eligibility
  gate the converter later enforces. A card without it is converter-ineligible.
- **Output:** an *extended* verified bundle (same run lineage, new claims), honoring exact-passage locators.

### Leg B — DR HITL packets (per module, owner-run)

The owner-supplied workflow: *"pass prompts and key files to a HITL to run them and hand back results."*
Metis produces, per provider, a **packet** = { provider-specific prompt, attached key module files,
expected output layout }. Owner runs it in the provider UI, saves the output into the
`external_research_handoff/v1` directory layout, and hands it back; Metis runs
`rf intake external-report <packet> --run <module_run_id>`. Everything imports as **candidates**, tagged
`platform_synthesis`, quarantined from verified status. See §4 for the division of labor and packet spec.

### Leg C — numerics / retrievability hunt (per module)

A **targeted** sub-sweep (not general discovery) whose single job is to surface *threshold-bearing,
independently-retrievable* passages, ranked by license:

1. **Public-domain first** — US federal (CDC growth charts, NIH/NHLBI, FDA labeling, CFR), WHO
   (open-access child-growth standards & anthropometry cut-offs).
2. **Open-license next** — KDIGO (freely distributed guidelines), open-access journal articles
   (CKiD/CALIPER primary papers), society statements with reuse terms.
3. **Quarantine, don't paraphrase-around** — copyrighted threshold tables (e.g. AAP subscription content)
   get an `evidence-assertion` with `exactPassage: null` + `exactPassageSha256` + precise `locator`, flagged
   for the licensing/rights track (**REG-002**), *not* re-paraphrased into a numerics-stripped survivor.

This leg is what makes objective #3 real: it optimizes for passages that a human can later attest to
*with their numbers intact*.

---

## 3. Per-module research briefs

Each brief lists the module's **current bundle coverage**, the **net-new angles** to add (objective #2),
and the **numerics targets** (objective #3). These become the rf run brief + the DR packet prompts.

### 3.1 `cbc_suite_v1` — Pediatric CBC Suite (extends RF-CBC-002)

- **Current coverage:** young-infant (<6mo) abstention; local-range precedence; benign ethnic / Duffy-null
  neutropenia differential; marrow red-flag / congenital neutropenia → heme-onc referral.
- **Net-new candidate angles:** thrombocytopenia (ITP vs. consumptive vs. marrow); isolated eosinophilia /
  monocytosis patterns; leukocytosis with left-shift vs. leukemoid vs. malignant blast triggers; pancytopenia
  work-up ordering; microcytosis/macrocytosis on CBC indices as a bridge into anemia module; reactive vs.
  pathologic lymphocytosis in young children.
- **Numerics targets (Leg C priority):** **RF-EV-002 — CALIPER (Bohn 2023) + age-partitioned pediatric CBC
  reference intervals.** This is the flagged, never-run gap and the single highest-value numerics source for
  this module (age/sex-partitioned, UCUM-typed, from open-access primary literature). ANC thresholds for
  benign vs. severe neutropenia; platelet-count action thresholds; age-banded WBC/differential intervals.
- **Bundle:** `bundle_20260718_intent_research_20260717_rf_cbc_001` · fixtures `tests/fixtures/rf-cbc-001/`.

### 3.2 `growth_suite_v1` — Pediatric Growth Suite (extends RF-GRO-002)

- **Current coverage:** faltering-growth indicator conflicts; chart-dependent threshold binding
  (WHO vs CDC vs INTERGROWTH); preterm/VLBW corrected-age branch.
- **Net-new candidate angles:** short stature work-up triggers (mid-parental height, growth velocity
  crossing percentiles); overweight/obesity BMI-percentile trajectory flags; head-circumference
  micro/macrocephaly branches; WHO↔CDC chart-transition at 24 months as an explicit rule; catch-up vs.
  failure-to-thrive velocity distinctions.
- **Numerics targets (Leg C priority):** WHO Child Growth Standards z-score/percentile cut-offs
  (open-access); CDC 2000 chart percentiles (US public domain); INTERGROWTH-21st preterm standards; ASPEN/AND
  pediatric malnutrition z-score severity bands; NICE NG75 faltering-growth thresholds. **Chart data is
  largely public-domain/open — this module has the best numerics-retrievability profile of the three.**
- **Bundle:** `bundle_20260718_intent_research_20260717_rf_gro_002` · fixtures `tests/fixtures/rf-gro-002/`.

### 3.3 `kidney_suite_v1` — Pediatric Kidney Suite (extends RF-KID-001)

- **Current coverage:** dual eGFR threshold coexistence; scope-exit for infants <1y; nephrotic-range
  proteinuria unit conflicts.
- **Net-new candidate angles:** hematuria evaluation branches (glomerular vs. non-glomerular); AKI staging
  (pediatric KDIGO / pRIFLE) triggers; CKD stage-transition flags; pediatric hypertension percentile-based
  BP classification (AAP 2017); electrolyte-derived flags where CBC/CMP overlap.
- **Numerics targets (Leg C priority):** **CKiD U25 / bedside Schwartz & cystatin-C eGFR equations**
  (open-access primary literature — coefficients are numeric and citable); KDIGO 2024 CKD GFR/albuminuria
  category thresholds (freely distributed); AAP 2017 pediatric BP percentile tables (society statement);
  proteinuria UPCR/UACR cut-offs with UCUM units (the unit-conflict decision needs these numerics grounded).
- **Bundle:** `bundle_20260718_intent_research_20260717_rf_kid_001` · fixtures `tests/fixtures/rf-kid-001/`.

---

## 4. Deep-research provider division of labor + HITL packet spec

### 4.1 Assignment by strength

| Provider | Strongest at | Assigned role in this run | Feeds |
|---|---|---|---|
| **Perplexity Pro** | citation-dense source *finding*, live web, DOI/URL surfacing | **Source-gathering** — hand back a ranked citation list (DOI/URL/year/license) per module brief; the raw material for Leg A ingest + Leg C retrievability triage | candidates + source-card seeds |
| **ChatGPT Deep Research** | structured multi-step *synthesis*, tabular extraction | **Structured extraction** — per module, produce the candidate-pattern table (condition → trigger → threshold → source) from a supplied source set; best at objective #2 shape | candidate patterns |
| **Gemini Deep Research** | broad recency sweeps, wide net | **Recency + breadth** — surface newest guidelines/supersessions and adjacent-domain signals; primary engine for the **future-module scouting** asides (§6) | candidates + idea captures |

Rationale: triangulation is *available* but the owner chose division-of-labor + scouting, so we avoid
running the same brief three times and instead pipeline provider strengths (Perplexity finds → ChatGPT
structures → Gemini catches what's new/adjacent).

### 4.2 The HITL loop (per provider, per module)

```
Metis builds packet ──► owner runs in provider UI ──► owner saves output to packet layout ──► hands back
      │                                                                                          │
      │ packet = { prompt.md, attachments/*, expected-output/README }                            │
      └──────────────────────────────────────────────────────────────────────────────► rf intake external-report
                                                                                          → candidates (platform_synthesis)
```

**Packet contents Metis prepares (no execution — just authoring):**
- `prompt.md` — provider-specific prompt built from the §3 brief, with the trust framing baked in
  ("return sources with DOI/URL/license; do not assert thresholds without a citation; flag any paywalled
  source explicitly").
- `attachments/` — the **key module files** the owner should attach: the module's current
  `evidence.json` (source list, so the provider doesn't re-find what we have), `candidates.json`,
  `authoring-decisions.yaml`, and the relevant §3 brief excerpt.
- `expected-output/` — the `external_research_handoff/v1` directory layout the provider output must be
  saved into (per the draft PRD's producer-profile overlay for that provider) so `rf intake` accepts it.

**Trust invariants (non-negotiable):** provider prose → `platform_synthesis`; citations → candidates only;
paywalled/rights-restricted sources flagged, never used to mint a supported claim; all vendor fields treated
as untrusted/injection-inert data. rf's verifier is the only path to `verified`.

---

## 5. AOS routing table (which lane runs which leg)

Per MODEL-ROUTING §5 "web-grounded research" and the scorecard. Free lanes preferred; spine stays on Opus.

| Leg / task | Lane | Model | Why |
|---|---|---|---|
| Leg A discovery scouts (Path-B swarm) | `aos-web` (SearXNG `:8888`, free) + native `gemini-cli` grounding | Gemini 3.5 Flash (grounded) | Only Search-grounded lane; free web spine |
| Leg A deterministic spine | rf offline (`extract→…→verify→bundle`) | none (no-LLM) | Deterministic, no API keys |
| Leg C numerics/retrievability triage | `aos-web` + native Gemini grounding | Gemini 3.5 Flash / 3.1 Pro | Grounded recency for guideline versions |
| Cross-family skeptic votes on candidate quality | `ica-delegate` (free) | ICA Haiku / Gemma + ICA Gemini (ungrounded) | Cheap diversity lens; **never** for grounded facts |
| Second-opinion passage-fidelity audit | `codex` | gpt-5.6-terra | Caught 3 unit/enumeration gaps in the original 7 bundles; keep the cross-model numeric audit |
| Candidate-pattern synthesis / brief authoring | subscription Claude | Sonnet 5 | Default execution tier |
| Final adjudication, bundle-merge sign-off, this design | subscription Claude | **Opus 4.8** | Spine — never offloaded |
| DR provider execution (Legs B) | **HITL — owner-run** | ChatGPT / Perplexity / Gemini DR | No API integration; manual upstream |

> ⚠️ The ICA `gemini-3.5-flash[1m]` instance is **not** Search-grounded — use it only for cross-family
> votes, never to source a clinical fact. Grounded research must go through **native** gemini-cli
> (needs `GEMINI_API_KEY`) or `aos-web`.

---

## 6. Future-module idea capture (the "asides")

Cheap, non-blocking, runs alongside the main legs. Two capture surfaces:

1. **Gemini DR breadth sweeps (§4.1)** double as scouts: while surfacing recency for the 3 modules, they
   flag adjacent pediatric lab-interpretation domains (hepatic/LFT panel, thyroid/TSH-FT4, electrolytes &
   acid-base, coagulation/PT-INR, inflammatory markers, newborn-screen follow-up, lipid panel). Each hit is
   a one-line idea, not a research commitment.
2. **`op capture` → IntentTree Ideas (T0):** every future-module idea lands as a T0 capture on the program
   tree (`tree_01KXQ7WC1HQE2GKZSCNDVXA9G7`, Work workspace) — 0 agents, ~free. Format:
   `op capture "future-module: <domain> — <one-line clinical rationale> — <candidate anchor guideline>"`.

**Guardrail:** an aside is an *idea capture*, never a rule, never a bundle. No aside touches `modules/`.
Promotion of an idea into a real module is a separate future `op new`/`/plan-feature` decision.

---

## 7. Convergence → rules (post-research follow-on, flagged, not in this run)

This run stops at **extended verified bundles**. Turning them into rules is the human seam and a *separate*
work item, but the design names it so the path is visible:

1. **Close DF-E1-M1** — author `authoring-decisions.yaml` for `growth_suite_v1` and `kidney_suite_v1`
   (cbc already has one; extend it for the new candidates). This is a **clinician-judgment artifact**, not
   an automated output — it records which supported claims become which candidate/rule and why.
2. **Run the converter** — `tools/rf-bundle-to-kb-pack` `inspect → verify → propose` against each extended
   bundle → staged `build/kb-pack/<module>/<version>/` proposal (evidence, assertions, candidates,
   rule-proposals, tests, unsigned manifest). Fails closed; emits nothing without decisions.
3. **Route the proposal through ARC** ([03-arc-clinical-council-handoff.md](03-arc-clinical-council-handoff.md))
   for adversarial review — advisory, **not** clinical sign-off.
4. **Attestation stays empty** — `evidence-packs/passage-attestations.json` is untouched. Grounding any rule
   requires a **named credentialed clinician** consciously deleting the tripwire
   (`tests/attestation-ledger-gate.test.mjs`) and attesting each rule to a bindable passage. No agent does this.
5. **`approvedBy[]` / `clinicalApprovers[]` stay `[]`** until a real credentialed identity signs.

---

## 8. Sequencing & gates

| Phase | What | Gate to advance |
|---|---|---|
| **P0 — Catalog probe** | `GET /api/catalog/search` per module; confirm no duplicate claims; confirm RF-EV-002 not already run | Owner reviews probe results |
| **P1 — Brief + packet authoring** | Finalize §3 briefs; build the 9 DR packets (3 providers × 3 modules) + attachments | Owner approves briefs & packets |
| **P2 — Launch (parallel)** | Leg A rf runs (3) via `op research`; hand DR packets to owner (Leg B); Leg C numerics sweeps | rf **verify exit 0** per bundle; DR results handed back |
| **P3 — Import + audit** | `rf intake external-report` the DR packets; gpt-5.6-terra passage-fidelity/numeric audit; merge into bundles | Bundle `verified`; audit clean |
| **P4 — Handoff** | Extended verified bundles + a per-module gap report (what's groundable-with-numerics vs. quarantined-licensing) | **Human seam** — DF-E1-M1 / attestation are the owner's next call |

Gate mapping to rf exit codes: `3=GOVERNANCE` → route to rights/REG-002; `4=UNSUPPORTED` → read
`verification.yaml.unsupported[]` and drop/repair; `7=HUMAN_REVIEW` → flag, not a hard fail.

---

## 9. What this run needs from the owner (HITL touchpoints)

1. **Approve scope/briefs** (P1) — the §3 per-module angle lists and numerics targets.
2. **Run the 9 DR packets** (P2) — ChatGPT/Perplexity/Gemini DR in their own UIs, save output to the packet
   layout, hand back. Metis prepares every prompt + attachment; the owner only runs and returns.
3. **The clinical judgment** (P4+, out of this run) — `authoring-decisions.yaml`, the attestation tripwire,
   and any `approvedBy` signature are **owner/clinician-only**. No agent substitutes for a credentialed human.

Two structural bottlenecks remain, by design, and no part of this run resolves them: **a credentialed
clinician** (for attestation/approval) and **a named rights owner** (for the licensing/REG-002 third).

---

## 10. Launch commands (ready — DO NOT run until briefs approved)

```bash
# Source the rf API creds (read; never inline the token)
set -a; . ~/.config/research-foundry/serve.env; set +a

# P0 — catalog probe (per module) before launching anything
curl -s "$RF_API_URL/api/catalog/search?q=pediatric+CBC+reference+interval+CALIPER" \
     -H "Authorization: Bearer $RF_TOKEN_AGENT" | jq '.total, .items[].title'

# P2 — launch the deepen runs via op (classify→plan gate→dispatch to rf).
#      Each is a bounded deepen pass on an existing bundle → route research, tier T2.
op research "Deepen RF-CBC-002: net-new pediatric CBC candidate patterns (thrombocytopenia, \
  eosinophilia, leukocytosis triggers) + CALIPER/Bohn 2023 age-partitioned reference intervals \
  (RF-EV-002), numerics-bearing & independently-retrievable passages first" --tier 2
op research "Deepen RF-GRO-002: short-stature / obesity-trajectory / head-circumference candidate \
  patterns + WHO/CDC/INTERGROWTH public-domain z-score & percentile cutoffs, numerics-first" --tier 2
op research "Deepen RF-KID-001: hematuria / AKI-staging / pediatric-HTN candidate patterns + CKiD U25 \
  & cystatin-C eGFR equations, KDIGO 2024, AAP 2017 BP tables, numerics-first" --tier 2

# NOTE: POST /api/runs only scaffolds (capture→triage→plan); the Path-B discovery swarm is driven by the
#       rf-run-execute.js workflow with cwd=/Users/miethe/dev/homelab/development/research-foundry.

# P3 — import owner-returned DR packets as candidate feeders (per provider/module)
#   rf intake external-report <packet_dir> --run <module_run_id>   # → platform_synthesis, candidates only

# Asides — capture future-module ideas (0 agents)
op capture "future-module: hepatic/LFT panel — pediatric transaminase/bilirubin interpretation — <anchor>"
```

---

## Appendix — cross-references

- Seam & converter detail: `02-evidence-foundry-on-research-foundry.md`, `tools/rf-bundle-to-kb-pack/README.md`
- Bundle inventory & Path-B pattern: `rf-handoff/RESULTS.md` §1, §8
- Grounding/numerics blocking picture: `.claude/findings/rights-governance-spec-v1.0-review-findings.md`
- ARC review route: `03-arc-clinical-council-handoff.md`
- Model routing: `agentic_meta_dev/docs/agentic-operator/MODEL-ROUTING.md` §5, §1.5
- rf run contract: `agentic_meta_dev/docs/agentic-operator/contracts/rf.md`
- External DR interchange: `research-foundry/docs/project_plans/PRDs/enhancements/external-research-report-interchange-v1.md`
- Program tree: `tree_01KXQ7WC1HQE2GKZSCNDVXA9G7` (Work workspace `ws_01KV8VMWXK05CTAZVHKT57HY0H`)
