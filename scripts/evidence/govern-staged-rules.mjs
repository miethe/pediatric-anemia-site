#!/usr/bin/env node
// govern-staged-rules.mjs — P3-T6 (evidence-foundry-buildout Phase 3, FR-15, `02 §4.13`).
//
// Finishes tools/rf-bundle-to-kb-pack/lib/rule-provenance-drafts.mjs's `PARTIAL_STRICT_RULES`
// (every `schemas/rule.schema.json`-required field EXCEPT `clinicalApprovers`) into fully
// schema-valid strict rule records, and materializes the staged pack's `rules.json` +
// `rule-provenance.json` at the `02 §4.4` output path.
//
// WHY THIS LIVES HERE, NOT UNDER tools/rf-bundle-to-kb-pack/: tests/ef-converter-invariants.test.mjs
// Invariant 15 ("clinical reviewers approve executable interpretations, not merely citations")
// asserts that NO `.mjs` file anywhere under tools/rf-bundle-to-kb-pack/ ever names the
// `clinicalApprovers` field, even to set it to an always-empty placeholder — clinical sign-off is a
// human/governance-process outcome the converter must never fabricate for itself. The ONE remaining
// field `schemas/rule.schema.json` requires (always the fixed empty list; every rule in this build
// has zero credentialed clinical approvers) is therefore finished here, in `scripts/evidence/` —
// exactly mirroring `scripts/evidence/backfill-rule-governance.mjs`, the existing EP-4 codemod that
// populates the SAME field for `modules/anemia/rules.json`'s 91 rules the same way, also outside the
// converter tree. This module governs a different, smaller rule set (the 4 cbc_suite_v1 slice-rule
// proposals staged for `propose`, not yet committed anywhere) but follows the identical pattern.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  MODULE_ID,
  PARTIAL_STRICT_RULES,
  buildRuleProvenanceDocument,
} from '../../tools/rf-bundle-to-kb-pack/lib/rule-provenance-drafts.mjs';

/** Matches `schemas/rule.schema.json`'s own required-key list and order exactly (also mirrors
 * scripts/evidence/backfill-rule-governance.mjs's `GOVERNED_KEY_ORDER`), so a staged rule and a
 * committed modules/anemia/ rule serialize with the same key order. */
export const GOVERNED_KEY_ORDER = [
  'id', 'category', 'when', 'evidence', 'output',
  'version', 'effectiveDate', 'retireDate', 'owner', 'safetyClass',
  'requiredTestCaseIds', 'changeRationale', 'sourcePassageId', 'clinicalApprovers',
];

/**
 * Adds the one remaining `schemas/rule.schema.json`-required governance field (always `[]` — no
 * credentialed human clinician has approved any rule in this knowledge base, staged or committed)
 * and re-emits the record in `GOVERNED_KEY_ORDER`.
 *
 * @param {object} partialRule a `projectPartialStrictRule()` result (every required field except
 *   the one this function adds)
 * @returns {object} a full `schemas/rule.schema.json`-conformant rule record
 */
export function finalizeStrictRule(partialRule) {
  const full = { ...partialRule, clinicalApprovers: [] };
  const ordered = {};
  for (const key of GOVERNED_KEY_ORDER) {
    if (!Object.hasOwn(full, key)) {
      throw new Error(`govern-staged-rules: partial rule "${partialRule.id}" is missing required field "${key}"`);
    }
    ordered[key] = full[key];
  }
  return ordered;
}

/** All 4 slice rules, fully governed and schema-valid. */
export const STAGED_STRICT_RULES = Object.freeze(PARTIAL_STRICT_RULES.map(finalizeStrictRule));

/**
 * Materializes the staged pack's strict `rules.json` (an array — matches
 * modules/<moduleId>/rules.json's own top-level shape) and companion `rule-provenance.json` at the
 * `02 §4.4` output path (`build/kb-pack/cbc_suite_v1/0.1.0-proposal/`, gitignored per P1-T7). Pure
 * I/O — no clinical inference happens here, only serialization of the already-governed constants
 * above.
 *
 * CONDITIONAL CALL-SITE CONTRACT (multi-bundle-conversion-e1-finish, Phase 1, P1-T3, FR-F6): this
 * function itself stays a small, unconditional, pure serializer — the CONDITIONALITY this task's
 * own name promises ("writeStagedRulesAndProvenance() becomes conditional") lives one level up, at
 * `tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs`'s call site: `propose.mjs`'s `run()` computes
 * the P1-T2 fail-closed emission gate (`resolveRuleEmissionGate()`) BEFORE ever reaching this
 * function, and calls it ONLY when that gate's `permitted` is `true`. When the gate refuses,
 * `run()` never calls this function at all — proven, per this task's own acceptance criteria, by
 * `rules.json`/`rule-provenance.json` provably absent (`fs.access` ENOENT) from a refused run's
 * output directory, not merely "the function returned early." Keeping the conditional branch in
 * the caller (rather than threading a permission flag into this function) keeps this file a single-
 * responsibility, trivially pure serializer, and keeps the gate's one canonical implementation in
 * one place (`propose.mjs`) rather than duplicated across every writer it guards.
 *
 * @param {{ outDir?: string }} [options]
 * @returns {Promise<{ rulesPath: string, ruleProvenancePath: string }>}
 */
export async function writeStagedRulesAndProvenance({ outDir } = {}) {
  const targetDir = outDir
    ?? path.join(process.cwd(), 'build', 'kb-pack', MODULE_ID, '0.1.0-proposal');
  await mkdir(targetDir, { recursive: true });

  const rulesPath = path.join(targetDir, 'rules.json');
  await writeFile(rulesPath, `${JSON.stringify(STAGED_STRICT_RULES, null, 2)}\n`, 'utf8');

  const ruleProvenancePath = path.join(targetDir, 'rule-provenance.json');
  await writeFile(
    ruleProvenancePath,
    `${JSON.stringify(buildRuleProvenanceDocument(), null, 2)}\n`,
    'utf8',
  );

  return { rulesPath, ruleProvenancePath };
}
