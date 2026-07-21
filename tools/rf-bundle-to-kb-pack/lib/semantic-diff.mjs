// tools/rf-bundle-to-kb-pack/lib/semantic-diff.mjs -- `semantic-diff.json` emission (P5-T3,
// evidence-foundry-buildout Phase 5, FR-21, this plan's binding OQ-4 resolution).
//
// OQ-4 (binding, docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
// "Decisions & OQ Resolutions"): a MINIMAL, rule-`id`-level added/removed/changed comparison between
// the staged `cbc_suite_v1` proposal and the currently active `modules/anemia/rules.json` -- no
// impact-graph traversal. That richer, taxonomy-based classification (Families A-H, safety tiers,
// combinator-skeleton comparison, etc.) already exists, for the SAME-module drift-over-time use
// case, at `scripts/kb-diff.mjs` (wave0-safety-foundation, EP5-T3) -- deliberately NOT reused or
// extended here. This file's entire reason to exist is to stay the minimal, id-level tool OQ-4
// explicitly scopes E0 to: "the E0 deliverable is the semantic-diff.json schema and plumbing... not
// a materially interesting diff."
//
// Why `removed` is gated on `baseModuleId === headModuleId`, not an unconditional base-minus-head
// subtraction:
//   FR-21's literal comparison target is `modules/anemia/rules.json` -- the only module that
//   existed before this feature. Its 91 rule IDs are a COMPLETELY DISJOINT namespace from
//   `cbc_suite_v1`'s 4 new IDs (verified directly against both committed files: zero overlap). An
//   unconditional base-minus-head subtraction over that disjoint pair would report all 91 anemia
//   rules as "removed" -- a false alarm: this proposal is purely ADDITIVE (a brand-new module
//   package; `modules/anemia/rules.json` itself is untouched, OQ-1) and never claims to supersede
//   or replace anemia's own rule inventory. "Removed" is the correct, non-trivial question ONLY
//   when base and head represent two GENERATIONS OF THE SAME MODULE's rule set -- exactly what this
//   plan's own decisions block names as E1's real use: "a second proposal round against an EXISTING
//   cbc_suite_v1/rules.json would produce a non-trivial result." This function computes the
//   base-minus-head subtraction ONLY when `baseModuleId === headModuleId`; across two different
//   modules it is definitionally empty -- exactly this task's own stated expected output (0
//   removed), not a special case carved out to force that number.
//
// Pure functions only -- no I/O, no timestamps, sorted output throughout (FR-20 seam invariant 13;
// this task's own "byte-identical across two runs" AC).

/**
 * Deterministic deep-equality via a canonical (key-sorted) JSON stringification -- same technique
 * `scripts/kb-diff.mjs` uses for its own content-hash/deep-equality checks, reimplemented locally
 * (not imported) so this minimal id-level tool has zero dependency on that separate, richer
 * classifier.
 *
 * @param {unknown} value
 * @returns {string}
 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function deepEqualRule(a, b) {
  return stableStringify(a ?? null) === stableStringify(b ?? null);
}

/**
 * Rule-`id`-level added/removed/changed comparison (OQ-4, FR-21). See this file's header comment
 * for why `removed` is scoped to same-module comparisons. Pure function -- no I/O.
 *
 * @param {{
 *   baseModuleId: string,
 *   baseRules: ReadonlyArray<{ id: string }>,
 *   headModuleId: string,
 *   headRules: ReadonlyArray<{ id: string }>,
 * }} args
 * @returns {{ added: string[], removed: string[], changed: string[] }}
 */
export function computeSemanticDiff({ baseModuleId, baseRules, headModuleId, headRules }) {
  const baseById = new Map((baseRules ?? []).map((rule) => [rule.id, rule]));
  const headById = new Map((headRules ?? []).map((rule) => [rule.id, rule]));

  const added = [];
  const changed = [];
  for (const [id, headRule] of headById) {
    const baseRule = baseById.get(id);
    if (!baseRule) {
      added.push(id);
    } else if (!deepEqualRule(baseRule, headRule)) {
      changed.push(id);
    }
  }

  // See header comment: base-minus-head ("removed") is only computed for a same-module comparison
  // -- an additive, cross-module comparison (E0's case) can never honestly report a base rule as
  // "removed" by this proposal, since the proposal neither touches nor replaces the base file.
  const removed = baseModuleId === headModuleId
    ? [...baseById.keys()].filter((id) => !headById.has(id))
    : [];

  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort(),
  };
}

/**
 * Full `semantic-diff.json` document shape. No dedicated JSON-Schema file exists for this artifact
 * -- this plan's binding OQ-7 ruling names exactly 4 new schema types (`evidence-assertions`,
 * `authoring-decisions`, `rule-provenance`, `release-manifest`), none of them `semantic-diff` --
 * same no-schema precedent as `pack-provenance.json`/`conversion-report.json` (P3-T7/P5-T2). No
 * timestamp field: this artifact must be byte-identical across two clean runs against unchanged
 * inputs (FR-20; P5-T5's own cross-artifact double-run proof covers it).
 *
 * @param {{
 *   baseModuleId: string,
 *   baseRulesPath: string,
 *   baseRules: ReadonlyArray<{ id: string }>,
 *   headModuleId: string,
 *   headRules: ReadonlyArray<{ id: string }>,
 * }} args
 * @returns {object}
 */
export function buildSemanticDiffReport({
  baseModuleId,
  baseRulesPath,
  baseRules,
  headModuleId,
  headRules,
}) {
  const diff = computeSemanticDiff({ baseModuleId, baseRules, headModuleId, headRules });
  return {
    schemaVersion: '1.0',
    scope: 'rule-id-level added/removed/changed only -- no impact-graph traversal (OQ-4, FR-21)',
    base: { moduleId: baseModuleId, path: baseRulesPath, ruleCount: (baseRules ?? []).length },
    head: { moduleId: headModuleId, ruleCount: (headRules ?? []).length },
    added: diff.added,
    removed: diff.removed,
    changed: diff.changed,
    summary: {
      addedCount: diff.added.length,
      removedCount: diff.removed.length,
      changedCount: diff.changed.length,
    },
  };
}
