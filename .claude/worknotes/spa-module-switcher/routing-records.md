# Delegation Routing Records — Tier 3 feature-planning run (spa-module-switcher)

**Resolver status: REAL / resolver-emitted.** `SKILL.md`'s references point at
`/Users/miethe/dev/homelab/development/skillmeat/.claude/skills/delegation-router/` which does
**not exist** on this machine (`ls` → "No such file or directory"). The real, loadable resolver
lives at the globalized location `/Users/miethe/.claude/skills/delegation-router/resolver.js` +
`audit-log.js` (per SPEC.md BL-5: "complete for engine + registry data"). All 11 RoutingRecords
below are the literal output of calling `resolve({...})` from that file against
`~/.claude/config/model-registry.yaml` — nothing here was hand-applied from the SPEC chain rules.
All 9 legs were also logged via the real `appendEntry(...)` into
`/Users/miethe/.claude/logs/routing-decisions.jsonl` (append-only; pre-existing 72 lines, verified
present before this run).

Two legs (L3, L5, L6) were run twice — once with the literal `task_class` string given in the
task table, once with the nearest registered `routing_policy` key — because the literal strings
(`documentation` aside) do not all exist verbatim as registry chain keys, and the resolver's
class-name normalization only swaps `-`/`_`, it does not do synonym matching. Both variants are
reported so the mismatch is visible rather than silently resolved away.

---

## Per-leg summary table

| leg | task_class (used) | chosen_plugin_id | agent_type_id | model | effort | fallback_chain | must_stay_override | rationale |
|---|---|---|---|---|---|---|---|---|
| L1 | `exploration` | ica | ica-executor | claude-haiku-4-5 | low | claude/claude-haiku-4-5 | no | Free-eligible: `exploration` chain free-first hit `ica/claude-haiku-4-5` (allowance: unlimited). Applies to all 4 SPIKE research legs identically. |
| L2 | `documentation` | ica | ica-executor | claude-haiku-4-5 | standard | claude/claude-haiku-4-5 | no | Free-eligible: `documentation` chain free-first hit `ica/claude-haiku-4-5`. |
| L3 | `documentation` (as given) | ica | ica-executor | claude-haiku-4-5 | standard | claude/claude-haiku-4-5 | no | **Finding, not a guess:** requesting `model: sonnet` does not change the outcome — the `documentation` routing_policy chain ignores the requested model entirely and always resolves to free-tier Haiku unless the caller passes an **explicit `provider`**. Probe `L3b` (`provider: claude`, `model: sonnet`, same `task_class`) resolved to `claude/claude-sonnet-5` via the resolver's step-1 explicit-provider-override path (see raw JSON). Recommendation: PRD authoring should NOT be routed through bare `task_class: documentation` if Sonnet-quality drafting is required — pin `provider: claude` explicitly, or use a distinct task_class once one exists. |
| L4 | `orchestration` | claude | claude | opus (claude-opus-4-8) | high | *(none — MUST-stay short-circuits before a chain/fallback is built)* | **yes** | MUST-stay-primary: resolver rejects any non-claude provider unconditionally regardless of requested `provider`. |
| L5 | `implementation` (nearest registered class; literal `implementation-planning` is unregistered) | claude | claude | sonnet (claude-sonnet-5) | high | ica/claude-sonnet-5[1m], ica/claude-sonnet-5 | no | Registered `implementation` chain pins `claude/claude-sonnet-5` directly (`enabled: true`, single-entry chain). Cross-check: the literal unregistered string `implementation-planning` independently lands on the identical `claude/claude-sonnet-5` via the resolver's step-3 cost/priority-ranking fallback (no free Sonnet instance exists, so priority breaks the tie to claude) — two independent paths agree, confirming "do not downgrade below sonnet" holds either way. |
| L6 | `mechanical` (nearest registered class; literal `mechanical-tasks` is unregistered) | ica | ica-executor | claude-haiku-4-5 | low | ica/gemma-4-26b-a4b-it, claude/claude-haiku-4-5 | no | Free-eligible: registered `mechanical` chain free-first hits `ica/claude-haiku-4-5`. Cross-check: literal `mechanical-tasks` independently lands on the same free ICA Haiku instance via step-3 cost/priority ranking, but with a thinner fallback_chain (misses the Gemma hop) since that path isn't chain-derived. |
| L7 | `image-generation` (registered as `image_generation`; normalizes via `-`/`_` swap) | **codex** (operator override) | codex-executor | gpt-5.6-terra | high | nano-banana/nano-banana-2, nano-banana/nano-banana-pro, claude/claude-sonnet-5 | no (not a MUST-stay class) | **The registry's natural chain does NOT pick codex.** Un-overridden `resolve({task_class:'image-generation', model:'nano-banana-2', ...})` (no `provider`) resolves `chosen_plugin_id: 'nano-banana'` — the `image_generation` routing_policy chain is `["nano-banana/nano-banana-2", "nano-banana/nano-banana-pro"]`; codex/gpt-5.6 is not a chain candidate at all (the gpt-5.6-* registry entries carry `tools: []`, no imagegen capability recorded). This is exactly the provider the user forbade. Complying with the hard constraint required an **explicit operator override**: `resolve({provider:'codex', model:'gpt-5.6-terra', task_class:'image-generation', ...})`, which the resolver accepts via its step-1 explicit-provider-override path (gpt-5.6-terra is a registered, enabled codex instance) — it does not silently fail, but it is a manual bypass of the chain, not the chain's own recommendation. Logged to the audit log with `fallback_applied: true` to mark the override. |
| L8 | `second-opinion` (registered as `second_opinion`) | ica | ica-executor | gemma-4-26b | standard | ica/gemini-3.5-flash[1m], ica/meta-llama/llama-4-maverick-17b-128e-instruct-fp8, ica/claude-haiku-4-5, claude/claude-sonnet-5 | no | Free-eligible: `second_opinion` chain free-first hits `ica/gemma-4-26b-a4b-it` (allowance: unlimited). |
| L9 | `verdict` | claude | claude | opus (claude-opus-4-8) | xhigh | *(none)* | **yes** | MUST-stay-primary: `verdict` is one of the 7 literal `MUST_STAY_PRIMARY_CLASSES` in `resolver.js` (registry's `must_stay_primary` array has 5; resolver adds `schema-recovery`/`cross-wave-merge` as split-out literals — 7 total, matching SKILL.md's "Do Not Say" note). |

**Probe rows** (`L3b`, `L5-literal`, `L6-literal`, `L7-natural`) are included in the raw JSON below for
full transparency but are not separate deliverable legs — they exist to prove the above findings
against the real resolver rather than asserting them from reading SPEC.md alone.

---

## Raw JSON — RoutingRecords (resolver output) + audit-log entries

```json
{
  "resolver_source": "/Users/miethe/.claude/skills/delegation-router/resolver.js",
  "audit_log_source": "/Users/miethe/.claude/skills/delegation-router/audit-log.js",
  "audit_log_path": "/Users/miethe/.claude/logs/routing-decisions.jsonl",
  "records": [
    {
      "leg_id": "L1",
      "label": "SPIKE research legs (x4, read-only)",
      "input": { "model": "haiku", "effort": "low", "profile": "free-tier", "task_class": "exploration", "resume_active": false },
      "record": {
        "chosen_plugin_id": "ica",
        "model": "haiku",
        "effort": "low",
        "agent_type_id": "ica-executor",
        "invocation_template": "~/ica-claude.sh -p \"{prompt}\" --model claude-haiku-4-5 --dangerously-skip-permissions",
        "scope_flags": [],
        "stage": "A",
        "validation_contract": "none",
        "continuity_mode": "stateless",
        "fallback_chain": [ { "plugin_id": "claude", "model": "claude-haiku-4-5" } ],
        "reason": "Selected provider='ica', model_id='claude-haiku-4-5' for task_class='exploration'; cost_tier='free', allowance='unlimited', free=true; routing_policy['exploration'] chain free-first: selected 'ica/claude-haiku-4-5'; requested provider 'claude' not used"
      }
    },
    {
      "leg_id": "L2",
      "label": "SPIKE synthesis doc authoring",
      "input": { "model": "haiku", "effort": "standard", "profile": "default", "task_class": "documentation", "resume_active": false },
      "record": {
        "chosen_plugin_id": "ica",
        "model": "haiku",
        "effort": "standard",
        "agent_type_id": "ica-executor",
        "invocation_template": "~/ica-claude.sh -p \"{prompt}\" --model claude-haiku-4-5 --dangerously-skip-permissions",
        "scope_flags": [],
        "stage": "A",
        "validation_contract": "none",
        "continuity_mode": "stateless",
        "fallback_chain": [ { "plugin_id": "claude", "model": "claude-haiku-4-5" } ],
        "reason": "Selected provider='ica', model_id='claude-haiku-4-5' for task_class='documentation'; cost_tier='free', allowance='unlimited', free=true; routing_policy['documentation'] chain free-first: selected 'ica/claude-haiku-4-5'; requested provider 'claude' not used"
      }
    },
    {
      "leg_id": "L3",
      "label": "PRD authoring (prd-writer) [task_class=documentation as given]",
      "input": { "model": "sonnet", "effort": "standard", "profile": "default", "task_class": "documentation", "resume_active": false },
      "record": {
        "chosen_plugin_id": "ica",
        "model": "claude-haiku-4-5",
        "effort": "standard",
        "agent_type_id": "ica-executor",
        "invocation_template": "~/ica-claude.sh -p \"{prompt}\" --model claude-haiku-4-5 --dangerously-skip-permissions",
        "scope_flags": [],
        "stage": "A",
        "validation_contract": "none",
        "continuity_mode": "stateless",
        "fallback_chain": [ { "plugin_id": "claude", "model": "claude-haiku-4-5" } ],
        "reason": "Selected provider='ica', model_id='claude-haiku-4-5' for task_class='documentation'; cost_tier='free', allowance='unlimited', free=true; routing_policy['documentation'] chain free-first: selected 'ica/claude-haiku-4-5'; requested provider 'claude' not used"
      }
    },
    {
      "leg_id": "L3b (probe)",
      "label": "PRD authoring - explicit claude/sonnet override probe",
      "input": { "model": "sonnet", "provider": "claude", "effort": "standard", "profile": "default", "task_class": "documentation", "resume_active": false },
      "record": {
        "chosen_plugin_id": "claude",
        "model": "sonnet",
        "effort": "standard",
        "agent_type_id": "claude",
        "invocation_template": "claude -p \"{prompt}\" --model claude-sonnet-5 --dangerously-skip-permissions",
        "scope_flags": [],
        "stage": "A",
        "validation_contract": "none",
        "continuity_mode": "resumable",
        "fallback_chain": [
          { "plugin_id": "ica", "model": "claude-haiku-4-5" },
          { "plugin_id": "claude", "model": "claude-haiku-4-5" },
          { "plugin_id": "ica", "model": "claude-sonnet-5[1m]" },
          { "plugin_id": "ica", "model": "claude-sonnet-5" }
        ],
        "reason": "Selected provider='claude', model_id='claude-sonnet-5' for task_class='documentation'; cost_tier='standard', allowance='billed', free=false; explicit provider='claude' honored for model='sonnet'"
      }
    },
    {
      "leg_id": "L4",
      "label": "Opus decisions block",
      "input": { "model": "opus", "effort": "high", "profile": "default", "task_class": "orchestration", "resume_active": false },
      "record": {
        "chosen_plugin_id": "claude",
        "model": "opus",
        "effort": "high",
        "agent_type_id": "claude",
        "invocation_template": "claude -p \"{prompt}\" --model claude-opus-4-8 --dangerously-skip-permissions",
        "scope_flags": [],
        "stage": "A",
        "validation_contract": "none",
        "continuity_mode": "resumable",
        "fallback_chain": [],
        "reason": "MUST-stay-primary: task_class='orchestration' is protected; non-claude providers are rejected"
      }
    },
    {
      "leg_id": "L5 (literal probe)",
      "label": "Implementation plan expansion [literal task_class=implementation-planning, unregistered]",
      "input": { "model": "sonnet", "effort": "high", "profile": "default", "task_class": "implementation-planning", "resume_active": false },
      "record": {
        "chosen_plugin_id": "claude",
        "model": "sonnet",
        "effort": "high",
        "agent_type_id": "claude",
        "invocation_template": "claude -p \"{prompt}\" --model claude-sonnet-5 --dangerously-skip-permissions",
        "scope_flags": [],
        "stage": "A",
        "validation_contract": "none",
        "continuity_mode": "resumable",
        "fallback_chain": [
          { "plugin_id": "ica", "model": "claude-sonnet-5[1m]" },
          { "plugin_id": "ica", "model": "claude-sonnet-5" }
        ],
        "reason": "Selected provider='claude', model_id='claude-sonnet-5' for task_class='implementation-planning'; cost_tier='standard', allowance='billed', free=false; cost/priority ranking for model='sonnet' (free-first, then priority)"
      }
    },
    {
      "leg_id": "L5b",
      "label": "Implementation plan expansion - nearest registered class (implementation)",
      "input": { "model": "sonnet", "effort": "high", "profile": "default", "task_class": "implementation", "resume_active": false },
      "record": {
        "chosen_plugin_id": "claude",
        "model": "sonnet",
        "effort": "high",
        "agent_type_id": "claude",
        "invocation_template": "claude -p \"{prompt}\" --model claude-sonnet-5 --dangerously-skip-permissions",
        "scope_flags": [],
        "stage": "A",
        "validation_contract": "none",
        "continuity_mode": "resumable",
        "fallback_chain": [
          { "plugin_id": "ica", "model": "claude-sonnet-5[1m]" },
          { "plugin_id": "ica", "model": "claude-sonnet-5" }
        ],
        "reason": "Selected provider='claude', model_id='claude-sonnet-5' for task_class='implementation'; cost_tier='standard', allowance='billed', free=false; routing_policy['implementation'] chain free-first: selected 'claude/claude-sonnet-5'"
      }
    },
    {
      "leg_id": "L6 (literal probe)",
      "label": "Progress/context artifact generation [literal task_class=mechanical-tasks, unregistered]",
      "input": { "model": "haiku", "effort": "low", "profile": "free-tier", "task_class": "mechanical-tasks", "resume_active": false },
      "record": {
        "chosen_plugin_id": "ica",
        "model": "haiku",
        "effort": "low",
        "agent_type_id": "ica-executor",
        "invocation_template": "~/ica-claude.sh -p \"{prompt}\" --model claude-haiku-4-5 --dangerously-skip-permissions",
        "scope_flags": [],
        "stage": "A",
        "validation_contract": "none",
        "continuity_mode": "stateless",
        "fallback_chain": [ { "plugin_id": "claude", "model": "claude-haiku-4-5" } ],
        "reason": "Selected provider='ica', model_id='claude-haiku-4-5' for task_class='mechanical-tasks'; cost_tier='free', allowance='unlimited', free=true; cost/priority ranking for model='haiku' (free-first, then priority); requested provider 'claude' not used"
      }
    },
    {
      "leg_id": "L6b",
      "label": "Progress/context artifact generation - nearest registered class (mechanical)",
      "input": { "model": "haiku", "effort": "low", "profile": "free-tier", "task_class": "mechanical", "resume_active": false },
      "record": {
        "chosen_plugin_id": "ica",
        "model": "haiku",
        "effort": "low",
        "agent_type_id": "ica-executor",
        "invocation_template": "~/ica-claude.sh -p \"{prompt}\" --model claude-haiku-4-5 --dangerously-skip-permissions",
        "scope_flags": [],
        "stage": "A",
        "validation_contract": "none",
        "continuity_mode": "stateless",
        "fallback_chain": [
          { "plugin_id": "ica", "model": "gemma-4-26b-a4b-it" },
          { "plugin_id": "claude", "model": "claude-haiku-4-5" }
        ],
        "reason": "Selected provider='ica', model_id='claude-haiku-4-5' for task_class='mechanical'; cost_tier='free', allowance='unlimited', free=true; routing_policy['mechanical'] chain free-first: selected 'ica/claude-haiku-4-5'; requested provider 'claude' not used"
      }
    },
    {
      "leg_id": "L7-natural (probe)",
      "label": "Visual PNG mockup - natural chain, no provider override",
      "input": { "model": "nano-banana-2", "effort": "standard", "profile": "default", "task_class": "image-generation", "resume_active": false },
      "record": {
        "chosen_plugin_id": "nano-banana",
        "model": "nano-banana-2",
        "effort": "standard",
        "agent_type_id": "claude",
        "invocation_template": "nano-banana \"{prompt}\" --model nano-banana-2",
        "scope_flags": [],
        "stage": "A",
        "validation_contract": "none",
        "continuity_mode": "stateless",
        "fallback_chain": [
          { "plugin_id": "nano-banana", "model": "nano-banana-pro" },
          { "plugin_id": "claude", "model": "claude-sonnet-5" }
        ],
        "reason": "Selected provider='nano-banana', model_id='nano-banana-2' for task_class='image-generation'; cost_tier='billed', allowance='billed', free=false; routing_policy['image_generation'] chain free-first: selected 'nano-banana/nano-banana-2'; requested provider 'claude' not used"
      }
    },
    {
      "leg_id": "L7-override",
      "label": "Visual PNG mockup - FORCED operator override to codex/gpt-5.6-terra (hard constraint: no gemini/nano-banana)",
      "input": { "model": "gpt-5.6-terra", "provider": "codex", "effort": "high", "profile": "default", "task_class": "image-generation", "resume_active": false },
      "record": {
        "chosen_plugin_id": "codex",
        "model": "gpt-5.6-terra",
        "effort": "high",
        "agent_type_id": "codex-executor",
        "invocation_template": "codex exec --sandbox workspace-write \"{prompt}\"",
        "scope_flags": [ "--sandbox workspace-write" ],
        "stage": "A",
        "validation_contract": "{schema}",
        "continuity_mode": "resumable",
        "fallback_chain": [
          { "plugin_id": "nano-banana", "model": "nano-banana-2" },
          { "plugin_id": "nano-banana", "model": "nano-banana-pro" },
          { "plugin_id": "claude", "model": "claude-sonnet-5" }
        ],
        "reason": "Selected provider='codex', model_id='gpt-5.6-terra' for task_class='image-generation'; cost_tier='premium', allowance='billed', free=false; explicit provider='codex' honored for model='gpt-5.6-terra'"
      }
    },
    {
      "leg_id": "L8",
      "label": "Adversarial second-opinion review of finished plan",
      "input": { "model": "gemma-4-26b", "effort": "standard", "profile": "default", "task_class": "second-opinion", "resume_active": false },
      "record": {
        "chosen_plugin_id": "ica",
        "model": "gemma-4-26b",
        "effort": "standard",
        "agent_type_id": "ica-executor",
        "invocation_template": "~/ica-claude.sh -p \"{prompt}\" --model gemma-4-26b-a4b-it --dangerously-skip-permissions",
        "scope_flags": [],
        "stage": "A",
        "validation_contract": "none",
        "continuity_mode": "stateless",
        "fallback_chain": [
          { "plugin_id": "ica", "model": "gemini-3.5-flash[1m]" },
          { "plugin_id": "ica", "model": "meta-llama/llama-4-maverick-17b-128e-instruct-fp8" },
          { "plugin_id": "ica", "model": "claude-haiku-4-5" },
          { "plugin_id": "claude", "model": "claude-sonnet-5" }
        ],
        "reason": "Selected provider='ica', model_id='gemma-4-26b-a4b-it' for task_class='second-opinion'; cost_tier='free', allowance='unlimited', free=true; routing_policy['second_opinion'] chain free-first: selected 'ica/gemma-4-26b-a4b-it'; requested provider 'claude' not used"
      }
    },
    {
      "leg_id": "L9",
      "label": "Final synthesis / verdict",
      "input": { "model": "opus", "effort": "xhigh", "profile": "default", "task_class": "verdict", "resume_active": false },
      "record": {
        "chosen_plugin_id": "claude",
        "model": "opus",
        "effort": "xhigh",
        "agent_type_id": "claude",
        "invocation_template": "claude -p \"{prompt}\" --model claude-opus-4-8 --dangerously-skip-permissions",
        "scope_flags": [],
        "stage": "A",
        "validation_contract": "none",
        "continuity_mode": "resumable",
        "fallback_chain": [],
        "reason": "MUST-stay-primary: task_class='verdict' is protected; non-claude providers are rejected"
      }
    }
  ],
  "audit_log_entries_appended": [
    { "task_id": "MODSW-SPA-L1-spike-research",       "chosen_plugin_id": "ica",    "actual_provider_used": "ica",    "fallback_applied": false },
    { "task_id": "MODSW-SPA-L2-spike-synthesis",       "chosen_plugin_id": "ica",    "actual_provider_used": "ica",    "fallback_applied": false },
    { "task_id": "MODSW-SPA-L3-prd-authoring",         "chosen_plugin_id": "ica",    "actual_provider_used": "ica",    "fallback_applied": false },
    { "task_id": "MODSW-SPA-L4-opus-decisions",        "chosen_plugin_id": "claude", "actual_provider_used": "claude", "fallback_applied": false },
    { "task_id": "MODSW-SPA-L5-impl-plan-expansion",   "chosen_plugin_id": "claude", "actual_provider_used": "claude", "fallback_applied": false },
    { "task_id": "MODSW-SPA-L6-progress-artifacts",    "chosen_plugin_id": "ica",    "actual_provider_used": "ica",    "fallback_applied": false },
    { "task_id": "MODSW-SPA-L7-visual-mockup",          "chosen_plugin_id": "codex",  "actual_provider_used": "codex",  "fallback_applied": true },
    { "task_id": "MODSW-SPA-L8-adversarial-review",    "chosen_plugin_id": "ica",    "actual_provider_used": "ica",    "fallback_applied": false },
    { "task_id": "MODSW-SPA-L9-final-verdict",          "chosen_plugin_id": "claude", "actual_provider_used": "claude", "fallback_applied": false }
  ]
}
```

All 9 `appendEntry(...)` calls above executed for real against
`/Users/miethe/.claude/logs/routing-decisions.jsonl` (append-only; file pre-existed with 72 lines
before this run, now +9). L7's audit entry deliberately sets `fallback_applied: true` — not
because a runtime failure occurred, but to flag in the audit trail that the emitted record was an
explicit operator override of the registry's natural chain pick, per the task's instruction to
"record the operator override explicitly with `fallback_applied` semantics noted."

---

## Execution-run legs (2026-07-22, /execute-plan dispatch)

Operator directive at dispatch: "utilize /delegation-router thoroughly, especially ICA for leafs and
gpt-5.6 as relevant." All 9 legs resolver-emitted and appended to
`~/.claude/logs/routing-decisions.jsonl` (`task_id: spa-module-switcher-exec:E-*`). Overrides are
explicit-provider (resolver step-1) and logged `fallback_applied: true` to mark them as operator
overrides of the natural chain, matching the L7 convention above.

| leg | phase | chosen | agent_type | model | effort | override? | rationale |
|---|---|---|---|---|---|---|---|
| E-P0 | P0 governance docs | ica | ica-executor | sonnet (`claude-sonnet-5[1m]`) | standard | yes | chain gives free haiku for `documentation`; governance needs sonnet; user directed ICA for leafs |
| E-P1 | P1 manifest/vocab leaf | ica | ica-executor | sonnet | standard | yes | bounded data modules; validator gate re-run in-session |
| E-P2 | P2 seams | claude | native | sonnet-5 | high | no | load-bearing foundation stays primary |
| E-P3 | P3 dropdown UI (D-7) | claude | native | sonnet-5 | high | no | primary; orchestrator holds visual gate |
| E-P4 | P4 fail-closed refusal | claude | native | sonnet-5 | xhigh | no | safety-critical — never offloaded |
| E-P5 | P5 degradation leaf | ica | ica-executor | sonnet | standard | yes | bounded, exact-spec tasks |
| E-P6 | P6 gates + tests | claude | native | sonnet-5 | xhigh | no | gate surgery, verdict-adjacent |
| E-P7 | P7 docs leaf | ica | ica-executor | sonnet | standard | yes | upgraded from plan's haiku — ADR-0010 is governance-quality |
| E-SO | per-milestone diff review | codex | codex-executor | gpt-5.6-terra | high | yes | operator directive; chain would pick ica/gemma; prior codex reviews caught real fail-closed gaps here |

Reviewer gates (task-completion-validator, karen milestones, FEATURE-KAREN) run in-session on the
primary subscription — MUST-stay `verdict`/`council-review` classes, never offloaded. ICA legs run
with `--dangerously-skip-permissions` (acceptEdits alone cannot execute gates); every gate is re-run
in-session by the orchestrator regardless of what the delegate reports.
