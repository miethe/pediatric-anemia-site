# SPA module switcher — visual mockups

Three PNG explorations of a **clinical module switcher** for the pediatric CDS SPA: the clinician
picks which knowledge module to run, and a per-module status banner makes the module's governance
state unmissable.

These are **design mockups only** — non-normative, non-binding, and not an implementation contract.
They render no real patient data (all values are `—` placeholders) and they encode no clinical
claim. Rule/pattern counts shown (91/26, 4/1, 0, 0) reflect the repo at generation time.

## The framing problem these mockups solve

The four modules are deliberately **not equals**, and a naive switcher (a plain dropdown of four
peers) would imply parity that does not exist:

| Module | Status | Reality |
|---|---|---|
| Pediatric Anemia | `integrity-recorded` | 91 rules · 26 patterns — the only one that runs. Still **not** clinically reviewed; zero named clinical approvers. |
| CBC Suite | `unsigned-stub` | 4 rules · 1 pattern; borrows anemia's fact derivation |
| Growth Suite | `unsigned-stub` | 0 rules — scaffold, cannot produce an assessment |
| Kidney Suite | `unsigned-stub` | 0 rules — scaffold, cannot produce an assessment |

Every variant therefore holds two invariants:

1. The literal string **`unsigned proposal · not clinically reviewed`** appears on `unsigned-stub`
   modules.
2. The anemia module **never reads as approved / green / safe**. There is no green state in this
   product; its banner states explicitly that it is not clinically reviewed and has 0 named
   clinical approvers.

## The variants

### `variant-a-sidebar-list.png` — persistent left rail

A ~280px module rail beside the existing tab nav, grouped under **AVAILABLE** and
**SCAFFOLD — NO ASSESSMENT LOGIC**. Scaffold modules are dimmed to ~45% with a padlock glyph and a
diagonal hatch, reading as not-clickable-to-run. The selected module's status banner spans the top
of the content area full-bleed (pale amber `#fff8e8`, 6px `#9e2f2f` left border) with the status
word, the rule/pattern counts, and the zero-approvers disclosure.

**Tradeoff:** the module state is *always* on screen and the grouping does the honesty work
structurally rather than through copy — but it costs ~280px of horizontal room permanently in an
already dense two-column assessment layout, and the banner is scrollable-past on a long form.

### `variant-b-dropdown-plus-banner.png` — header dropdown + dominant banner

A compact `<select>`-style control in the header next to the "Research prototype" badge (shown
open, with the two 0-rule modules greyed and padlocked), plus a very large stacked governance
banner directly beneath the tab bar occupying ~35–40% of the viewport. The banner carries a status
chip row, the module title, and three separate disclosure lines (no clinical review / 0 of 91 rules
bound to an attested passage / deterministic research output only), with the assessment form pushed
below the fold.

**Tradeoff:** minimal chrome cost and it reuses an existing header slot — and the banner is
genuinely unavoidable — but a dropdown is the control idiom most likely to be read as "four
interchangeable options," so all the non-parity signalling has to be carried inside the menu rows
and by the banner rather than by layout.

### `variant-c-card-picker.png` — interstitial picker

A **Step 0** gate before any assessment: four side-by-side cards, each with its own status chip and
an honest capability line (`91 rules · 26 patterns` vs `0 rules · cannot assess`). Anemia gets a
teal-bordered primary "Open module"; CBC gets a de-emphasised "Open module (limited)"; the two
scaffolds are hatched, padlocked, ~45% opacity with a flat disabled "No assessment logic" button.
A footnote bar states no module carries clinical sign-off.

**Tradeoff:** the strongest honesty framing — the clinician must consciously choose, and the four
capability lines sit side by side where the disparity is impossible to miss — but it adds a full
screen of friction to every session and, once dismissed, provides no persistent in-context reminder
of which module is active.

## Recommendation

**Ship C + A together; treat B as the fallback.**

Variant C is the right *entry* gate: the side-by-side capability lines are the only presentation
where a clinician cannot form a false parity impression, and forcing an explicit choice matches the
project's stance that no module has clinical sign-off. But C is a one-time screen, so it must be
paired with a persistent in-context surface — that is variant A's rail plus its full-bleed banner,
which keeps the active module's status visible for the whole session and keeps the scaffold
modules visibly demoted rather than hidden.

B is the cheapest to build and its banner is the most forceful single element, but the dropdown
idiom actively works against the non-parity message. Prefer it only if horizontal space for A's
rail cannot be found.

## Generation provenance

**Model: `gpt-5.6-terra`** (OpenAI Codex CLI `0.145.0-alpha.27`), reasoning effort `medium`, via
Codex's **native image-generation tool**. No Gemini / nano-banana / external image service was used.

```bash
# One run per variant; the prompt file carries the shared design-token context
# (styles.css :root tokens + index.html header/safety-banner/tab-bar structure)
# plus the variant-specific composition brief.
REPO=/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/module-switcher-spa
LOG="$HOME/.codex/exec-logs/$(date +%Y%m%dT%H%M%S)-mockup-variant-a"

cat /tmp/mockup-prompts/variant-a.md | timeout 900 codex exec \
  --ignore-user-config --skip-git-repo-check --sandbox workspace-write \
  -C "$REPO" -m gpt-5.6-terra --config model_reasoning_effort="medium" \
  2>"$LOG.err" | tee "$LOG.log"
```

The prompt instructed Codex to call the image tool once and copy the resulting PNG to
`docs/dev/designs/mockups/spa-module-switcher/<variant>.png`, then `ls -la` to confirm.

| Variant | Codex session id | Output |
|---|---|---|
| A | `019f8b53-1b49-76b2-8e7e-1f6c03dfc801` | `variant-a-sidebar-list.png` (1536×1024) |
| B | `019f8b55-f69a-7b00-a3f1-1ec864665044` | `variant-b-dropdown-plus-banner.png` (1536×1024) |
| C | `019f8b55-f69a-7442-8be3-fd9d1a60f903` | `variant-c-card-picker.png` (1681×935) |

Session rollouts: `~/.codex/sessions/2026/07/22/rollout-*-<session-id>.jsonl`.

Design tokens sourced from `styles.css` `:root` (`--brand #205f72`, `--warning-soft #fff8e8`,
`--danger #9e2f2f`, `--radius 14px`, …) and the existing `.safety-banner` / `.version-card` /
`.tab-nav` markup in `index.html`.
