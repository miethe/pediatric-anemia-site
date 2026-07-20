#!/usr/bin/env node
// backfill-rule-governance.mjs — EP-4 (FR-WP4-02), single-commit codemod over all 91 rules.
//
// Populates the 9 governance fields EP4-T1 added to schemas/rule.schema.json on every rule in
// modules/anemia/rules.json. Deterministic and re-runnable: given the same rules.json +
// modules/anemia/evidence.json + tests/witness//tests/fixtures fixture trees, this script always
// produces byte-identical output (`--check` mode proves it, mirroring
// scripts/evidence/build-evidence-pack.mjs's own --check convention). This is explicitly cheap,
// mechanical, near-zero-judgment work (per the phase plan) — no per-rule clinical judgment is
// exercised anywhere below; every field is either a fixed constant or derived from a documented,
// closed table.
//
// Field-by-field population rules:
//
//   version            — fixed "1.0.0" for every rule (first governed version).
//   effectiveDate       — modules/anemia/evidence.json's `reviewedThrough` (src/evidence.js's
//                         REVIEWED_THROUGH export), uniformly. A governance-record stamp, not a
//                         per-rule clinical review date.
//   retireDate          — fixed `null` (no rule is retired by this backfill).
//   owner               — fixed OWNER constant below: a role/team string, deliberately NOT a
//                         named human (this is an unvalidated research prototype with no
//                         credentialed clinical owner — see CHANGE_RATIONALE).
//   changeRationale     — fixed CHANGE_RATIONALE constant: states this is the EP-4 mechanical
//                         governance backfill and that no clinical re-review occurred. Never a
//                         per-rule clinical rationale — this script is not clinically qualified
//                         to author one, and inventing one would be exactly the kind of unsupported
//                         claim this codebase's guardrails exist to prevent.
//   clinicalApprovers   — fixed `[]`, unconditionally, for every rule. There are no credentialed
//                         human approvers today. NEVER populate this from ARC/council-review
//                         output or any other non-owner-attested source (D-4/AC-D4; EP4-T3 is a
//                         dedicated structural test for exactly this).
//
//   safetyClass — derived from `rule.category` via SAFETY_CLASS_BY_CATEGORY (below). The KB's
//   `category` field is already in a 1:1 correspondence with `output.type`
//   (safety<->alert, differential<->candidate, interpretive-note<->note, adaptive-question<->
//   question — verified against all 91 rules), so keying off `category` alone is sufficient and
//   avoids a second, redundant derivation off `output.type`/severity. Derivation table:
//
//     category            | output.type | safetyClass     | rationale
//     --------------------|-------------|-----------------|----------------------------------------
//     safety              | alert       | safety-critical | Every alert (any severity: emergency/
//                         |             |                 | urgent/important) is a hazard flag or a
//                         |             |                 | missing-data block on safe use — the
//                         |             |                 | highest governance tier regardless of
//                         |             |                 | the individual severity value.
//     differential        | candidate   | diagnostic      | Ranked differential-diagnosis pattern
//                         |             |                 | candidates — core diagnostic reasoning,
//                         |             |                 | not a safety flag or a data-collection
//                         |             |                 | prompt.
//     interpretive-note   | note        | informational   | Contextual caveats/interpretive notes;
//                         |             |                 | inform clinician judgment, make no
//                         |             |                 | ranked claim.
//     adaptive-question   | question    | informational   | Missing-data prompts; gather data
//                         |             |                 | in support of a later decision, are not
//                         |             |                 | themselves a diagnostic claim or a
//                         |             |                 | hazard flag.
//
//   requiredTestCaseIds — mechanically discovered via scripts/rule-coverage.mjs's computeCoverage()
//   restricted to fixtureDirs: ['tests/witness', 'tests/fixtures'] (per FR-WP4-02 — deliberately
//   excludes examples/*.json, which is a published clinician-facing surface, not a test-case
//   registry). A rule's requiredTestCaseIds is the sorted, deterministic list of relative fixture
//   paths whose activation witness (assessPediatricAnemia()'s provenance.matchedRuleIds) includes
//   this rule id; `[]` when no such fixture exists yet. Never hand-curated.
//
//   sourcePassageId — D-EP3-6's fail-safe, non-optimistic binder. For each rule:
//     1. primarySourceId = rule.evidence[0] ("the rule's first cited source").
//     2. bindablePassages = passagesFor(primarySourceId).filter(isBindableAsSourceSupported) — the
//        one shared predicate (src/evidence.js) that excludes every passage the EP3-T5 fidelity
//        audit flagged. AAP2026_IDA is 7/7 flagged, so it contributes zero bindable passages: every
//        one of the 32 rules citing it as evidence[0] falls to its proposal sentinel below,
//        regardless of any keyword match — this is the correct, honest outcome (see EP3-T5).
//     3. KEYWORD_MATCH_TABLE (below) is consulted: every entry whose `sourceId` equals
//        primarySourceId AND whose `factSubstring` is a literal substring of
//        JSON.stringify(rule.when) is a candidate match, restricted to passages actually in
//        `bindablePassages` right now (so a passage that becomes flagged in a future audit
//        silently stops being a candidate rather than needing this table edited).
//     4. If the candidate matches name EXACTLY ONE DISTINCT passage id, sourcePassageId is that
//        id (a source-supported binding). If they name zero or more than one, OR bindablePassages
//        is empty, sourcePassageId falls back to `${primarySourceId}#implementation-proposal` —
//        ambiguity and absence are treated identically: fail toward "not source-backed."
//   KEYWORD_MATCH_TABLE is a small, hand-authored-once, mechanically-applied table — each entry's
//   comment quotes the exact passage language that motivated it. It is deliberately conservative:
//   generic/broad topic passages (e.g. BLOOD2022_PED_ANEMIA#ev_001's "morphology-first,
//   reticulocyte-response" framework statement, or ev_003's reticulocyte-direction statement, both
//   of which are thematically touched by dozens of unrelated rules) are NOT added, because binding
//   them would overclaim rule-specific grounding for what is actually a source-level framework
//   claim. "Expect a lot of fallbacks" (per the phase design record) is the intended outcome, not a
//   defect in this table.
//
// Usage:
//   node scripts/evidence/backfill-rule-governance.mjs             writes rules.json + the mapping doc
//   node scripts/evidence/backfill-rule-governance.mjs --check     regenerates in memory; exits 1
//                                                                   with a diff summary if rules.json
//                                                                   on disk differs; writes nothing.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REVIEWED_THROUGH, passagesFor, isBindableAsSourceSupported } from '../../src/evidence.js';
import { computeCoverage } from '../rule-coverage.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULES_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json');
const MAPPING_DOC_PATH = path.join(
  REPO_ROOT, 'docs', 'project_plans', 'implementation_plans', 'infrastructure',
  'wave0-safety-foundation-v1', 'ep4-rule-passage-map.md',
);

const GOVERNANCE_VERSION = '1.0.0';
const OWNER = 'team:pediatric-cds-kb-maintainers';
const CHANGE_RATIONALE =
  'EP-4 governance backfill (wave0-safety-foundation, scripts/evidence/backfill-rule-governance.mjs): '
  + 'mechanically populates required rule-governance metadata across all 91 rules in one '
  + 'deterministic, re-runnable codemod. This is a structural/administrative backfill only — no '
  + 'clinical re-review of this rule\'s threshold, logic, or evidence occurred as part of this '
  + 'change. clinicalApprovers stays empty pending real credentialed clinician sign-off.';

const SAFETY_CLASS_BY_CATEGORY = {
  safety: 'safety-critical',
  differential: 'diagnostic',
  'interpretive-note': 'informational',
  'adaptive-question': 'informational',
};

// See the header block above for the exact passage quotes motivating each entry.
const KEYWORD_MATCH_TABLE = [
  { sourceId: 'BLOOD2022_PED_ANEMIA', passageId: 'BLOOD2022_PED_ANEMIA#ev_005', factSubstring: 'multilineageCytopenia' },
  { sourceId: 'BLOOD2022_PED_ANEMIA', passageId: 'BLOOD2022_PED_ANEMIA#ev_004', factSubstring: 'schistocytes' },
  { sourceId: 'BLOOD2022_PED_ANEMIA', passageId: 'BLOOD2022_PED_ANEMIA#ev_004', factSubstring: 'spherocytes' },
  { sourceId: 'CDC2025_LEAD', passageId: 'CDC2025_LEAD#ev_005', factSubstring: 'level45Plus' },
  { sourceId: 'CDC2025_LEAD', passageId: 'CDC2025_LEAD#ev_005', factSubstring: 'level20to44' },
  { sourceId: 'BSH2020_G6PD', passageId: 'BSH2020_G6PD#ev_004', factSubstring: 'Transfusion' },
];

const GOVERNED_KEY_ORDER = [
  'id', 'category', 'when', 'evidence', 'output',
  'version', 'effectiveDate', 'retireDate', 'owner', 'safetyClass',
  'requiredTestCaseIds', 'changeRationale', 'sourcePassageId', 'clinicalApprovers',
];

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function computeSafetyClass(rule) {
  const safetyClass = SAFETY_CLASS_BY_CATEGORY[rule.category];
  if (!safetyClass) {
    throw new Error(
      `backfill-rule-governance: no safetyClass mapping for category "${rule.category}" (rule `
      + `${rule.id}) — extend SAFETY_CLASS_BY_CATEGORY deliberately, do not guess`,
    );
  }
  return safetyClass;
}

/** Returns { sourcePassageId, reason } — see the D-EP3-6 binder walk-through in the header. */
function computeSourcePassageId(rule) {
  const primarySourceId = rule.evidence[0];
  const bindablePassages = passagesFor(primarySourceId).filter(isBindableAsSourceSupported);
  const fallback = `${primarySourceId}#implementation-proposal`;

  if (bindablePassages.length === 0) {
    return {
      sourcePassageId: fallback,
      reason: `fallback: "${primarySourceId}" has zero bindable (unflagged source-supported) passages after the EP3-T5 fidelity audit`,
    };
  }

  const whenText = JSON.stringify(rule.when);
  const matched = new Map(); // passageId -> factSubstring that matched (for the reason column)
  for (const entry of KEYWORD_MATCH_TABLE) {
    if (entry.sourceId !== primarySourceId) continue;
    if (!whenText.includes(entry.factSubstring)) continue;
    if (!bindablePassages.some((passage) => passage.id === entry.passageId)) continue;
    matched.set(entry.passageId, entry.factSubstring);
  }

  if (matched.size === 1) {
    const [[passageId, factSubstring]] = matched;
    return {
      sourcePassageId: passageId,
      reason: `source-supported: deterministic keyword match — rule's "when" condition references "${factSubstring}" (KEYWORD_MATCH_TABLE)`,
    };
  }
  if (matched.size > 1) {
    return {
      sourcePassageId: fallback,
      reason: `fallback: ambiguous keyword match against ${[...matched.keys()].join(', ')} — falling back per D-EP3-6`,
    };
  }
  return {
    sourcePassageId: fallback,
    reason: `fallback: no KEYWORD_MATCH_TABLE entry for "${primarySourceId}" matched this rule's "when" condition`,
  };
}

async function buildGovernedRules(rules) {
  const coverage = await computeCoverage({ rootDir: REPO_ROOT, fixtureDirs: ['tests/witness', 'tests/fixtures'] });

  const governed = [];
  const mappingRows = [];
  for (const rule of rules) {
    const safetyClass = computeSafetyClass(rule);
    const requiredTestCaseIds = [...(coverage.byRule[rule.id]?.witnessedBy ?? [])];
    const { sourcePassageId, reason } = computeSourcePassageId(rule);

    const governedRule = {};
    for (const key of GOVERNED_KEY_ORDER) {
      governedRule[key] = {
        id: rule.id,
        category: rule.category,
        when: rule.when,
        evidence: rule.evidence,
        output: rule.output,
        version: GOVERNANCE_VERSION,
        effectiveDate: REVIEWED_THROUGH,
        retireDate: null,
        owner: OWNER,
        safetyClass,
        requiredTestCaseIds,
        changeRationale: CHANGE_RATIONALE,
        sourcePassageId,
        clinicalApprovers: [],
      }[key];
    }
    governed.push(governedRule);

    mappingRows.push({
      ruleId: rule.id,
      primarySourceId: rule.evidence[0],
      sourcePassageId,
      status: sourcePassageId.endsWith('#implementation-proposal') ? 'implementation-proposal' : 'source-supported',
      reason,
    });
  }
  return { governed, mappingRows };
}

function serializeRules(rules) {
  return JSON.stringify(rules, null, 2) + '\n';
}

function buildMappingDoc(mappingRows) {
  const supportedCount = mappingRows.filter((row) => row.status === 'source-supported').length;
  const proposalCount = mappingRows.length - supportedCount;
  const bySource = new Map();
  for (const row of mappingRows) {
    const entry = bySource.get(row.primarySourceId) ?? { supported: 0, proposal: 0 };
    if (row.status === 'source-supported') entry.supported += 1; else entry.proposal += 1;
    bySource.set(row.primarySourceId, entry);
  }

  const lines = [];
  lines.push('---');
  lines.push('doc_type: generated_artifact');
  lines.push('title: "EP-4 Rule -> Passage Mapping"');
  lines.push('generated_by: scripts/evidence/backfill-rule-governance.mjs');
  lines.push('phase: EP-3+EP-4');
  lines.push('feature_slug: wave0-safety-foundation');
  lines.push('---');
  lines.push('');
  lines.push('# EP-4 Rule → Passage Mapping');
  lines.push('');
  lines.push('Generated by `scripts/evidence/backfill-rule-governance.mjs` — do not hand-edit; re-run the');
  lines.push('script to regenerate. Shows, for every rule, which `sourcePassageId` it was bound to and why');
  lines.push('(D-EP3-6 fail-safe binder). "source-supported" means the passage traces to a located passage');
  lines.push('in the cited source and is unflagged by the EP3-T5 fidelity audit; "implementation-proposal"');
  lines.push('means the rule fell back to its cited source\'s minted sentinel — the honest, conservative');
  lines.push('default whenever the mapping is not mechanically unambiguous.');
  lines.push('');
  lines.push(`**Split: ${supportedCount} source-supported / ${proposalCount} implementation-proposal (of ${mappingRows.length} rules).**`);
  lines.push('');
  lines.push('Per-source split (keyed by each rule\'s first cited source, `evidence[0]`):');
  lines.push('');
  lines.push('| Source | source-supported | implementation-proposal |');
  lines.push('|---|---|---|');
  for (const [sourceId, counts] of [...bySource.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`| ${sourceId} | ${counts.supported} | ${counts.proposal} |`);
  }
  lines.push('');
  lines.push('| Rule ID | sourcePassageId | Status | Matching reason |');
  lines.push('|---|---|---|---|');
  for (const row of mappingRows) {
    lines.push(`| ${row.ruleId} | \`${row.sourcePassageId}\` | ${row.status} | ${row.reason} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function firstDiffLines(a, b, contextLines = 3, maxHunks = 5) {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const diffs = [];
  const max = Math.max(aLines.length, bLines.length);
  let i = 0;
  while (i < max && diffs.length < maxHunks) {
    if (aLines[i] === bLines[i]) { i += 1; continue; }
    let j = i;
    while (j < max && aLines[j] !== bLines[j]) j += 1;
    const start = Math.max(0, i - contextLines);
    const end = Math.min(max, j + contextLines);
    const chunk = [];
    for (let k = start; k < end; k += 1) {
      const a1 = aLines[k];
      const b1 = bLines[k];
      if (a1 === b1) chunk.push(`  ${k + 1}: ${a1 ?? ''}`);
      else {
        if (a1 !== undefined) chunk.push(`- ${k + 1}: ${a1}`);
        if (b1 !== undefined) chunk.push(`+ ${k + 1}: ${b1}`);
      }
    }
    diffs.push(chunk.join('\n'));
    i = j;
  }
  return diffs.join('\n---\n');
}

function parseArgs(argv) {
  const out = { check: false };
  for (const arg of argv) {
    if (arg === '--check') out.check = true;
    else if (arg === '--write') out.check = false;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

async function main() {
  const { check } = parseArgs(process.argv.slice(2));
  const rules = await loadJson(RULES_PATH);
  const { governed, mappingRows } = await buildGovernedRules(rules);
  const nextSerialised = serializeRules(governed);

  if (check) {
    const current = await readFile(RULES_PATH, 'utf8');
    if (current === nextSerialised) {
      console.log(`backfill-rule-governance --check: ${path.relative(REPO_ROOT, RULES_PATH)} matches regenerated output (${governed.length} rules).`);
      return;
    }
    const diff = firstDiffLines(current, nextSerialised);
    console.error(`backfill-rule-governance --check: ${path.relative(REPO_ROOT, RULES_PATH)} differs from regenerated output.`);
    console.error(diff ? `First differing hunks:\n${diff}` : '(no line-level diff produced; check byte lengths)');
    process.exit(1);
  }

  await writeFile(RULES_PATH, nextSerialised, 'utf8');
  await writeFile(MAPPING_DOC_PATH, buildMappingDoc(mappingRows), 'utf8');

  const supportedCount = mappingRows.filter((row) => row.status === 'source-supported').length;
  console.log(
    `Wrote ${path.relative(REPO_ROOT, RULES_PATH)}: ${governed.length} rules governed. `
    + `sourcePassageId split: ${supportedCount} source-supported / ${mappingRows.length - supportedCount} implementation-proposal. `
    + `Wrote ${path.relative(REPO_ROOT, MAPPING_DOC_PATH)}.`,
  );
}

main().catch((error) => {
  console.error(`backfill-rule-governance: ${error.stack ?? error.message}`);
  process.exit(1);
});
