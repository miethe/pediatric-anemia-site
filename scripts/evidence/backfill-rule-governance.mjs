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
//     2. REVIEWED_RULE_PASSAGE_MAP (below) is consulted, keyed by rule.id. It is the ONLY source
//        of a source-supported binding this script is permitted to mint, and it is empty today.
//     3. Every rule for which REVIEWED_RULE_PASSAGE_MAP has no entry falls back to
//        `${primarySourceId}#implementation-proposal`. That is every one of the 91 rules as of
//        this writing.
//
//   Reviewer-gate fix-1 (finding 1, HIGH) removed this script's earlier keyword/substring matcher
//   entirely — it does not survive as a disabled code path, a commented-out table, or a "stricter"
//   variant. That matcher bound `sourcePassageId` by testing whether a hand-picked fact-name
//   substring appeared anywhere in `JSON.stringify(rule.when)`, with no polarity awareness (a fact
//   inside a `not` condition matched identically to a fact the rule requires present) and no
//   claim-level check that the passage's language actually supports the rule's specific threshold
//   and output. `Q-NORMO-LOW-001` was bound to a marrow-replacement/multilineage-cytopenia passage
//   solely because that fact name occurred inside a NEGATED branch of its `when` — the rule fires
//   when multilineage cytopenia is ABSENT. A keyword hit is not the "unambiguous documented match"
//   D-EP3-6 requires; inventing a rule-to-passage clinical-grounding claim mechanically is exactly
//   what this codebase's guardrails forbid. There is no in-repo mechanism today that can verify a
//   passage's prose actually supports a rule's complete condition and output — that is a human
//   clinical-review task, not a string-matching one.
//
//   REVIEWED_RULE_PASSAGE_MAP is therefore the ONLY path to a source-supported binding, and it
//   ships empty. Entries may be added later, but ONLY by hand, ONLY from an independently reviewed,
//   human-attested rule->passage mapping (a named clinical reviewer confirming the passage's prose
//   supports this rule's complete `when`/`output`) — never derived mechanically, never regenerated
//   by re-running this script, and never populated from ARC/council-review or any other non-human-
//   attested source (same posture as `clinicalApprovers`, D-4/AC-D4). Even an entry present in this
//   map is bound only when `isBindableAsSourceSupported(passage)` also passes — a passage the
//   EP3-T5 fidelity audit later quarantines stops being usable without editing this table.
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

// Reviewer-gate fix-1 (finding 1): the ONLY permitted source of a source-supported
// `sourcePassageId` binding. Keyed by rule id -> passage id. SHIPS EMPTY.
//
// An entry may be added here ONLY when all of the following hold:
//   1. A named human with clinical review authority has read the rule's complete `when`/`output`
//      AND the passage's `exactPassage`, and confirmed the passage's language unambiguously
//      supports the rule's specific threshold/logic/output — not merely a shared topic or fact
//      name.
//   2. That review is attested outside this file (this codebase has no clinical reviewer role
//      today — see CLAUDE.md's hard guardrails and D-4/AC-D4) and the attestation is referenced
//      in the commit that adds the entry.
//   3. The entry is added by hand, in a commit whose message names the reviewer and the review
//      artifact. It is NEVER derived by this script, by a keyword/substring match, by ARC/
//      council-review output, or by any other mechanical process.
// A rule with no entry here — which, as of this writing, is all 91 — falls back to its primary
// source's `<sourceId>#implementation-proposal` sentinel (D-EP3-6). That is the honest, conservative
// default, not a defect: "we do not claim this rule is source-backed" until a human says otherwise.
const REVIEWED_RULE_PASSAGE_MAP = new Map([
  // ruleId -> passageId. Empty pending independent clinical review (see the block comment above).
]);

const GOVERNED_KEY_ORDER = [
  'id', 'category', 'when', 'evidence', 'output',
  'version', 'effectiveDate', 'retireDate', 'owner', 'safetyClass',
  'requiredTestCaseIds', 'changeRationale', 'sourcePassageId', 'clinicalApprovers',
];

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

// Explicit codepoint comparator (mirrors scripts/evidence/build-evidence-pack.mjs's own):
// `String.prototype.localeCompare` is locale-dependent, so it cannot back the byte-identical
// determinism guarantee `--check` proves. `<`/`>` on strings compares UTF-16 code units, fixed
// and environment-independent for the ASCII ids this file sorts.
function compareCodepoints(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
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
  const fallback = `${primarySourceId}#implementation-proposal`;

  const reviewedPassageId = REVIEWED_RULE_PASSAGE_MAP.get(rule.id);
  if (reviewedPassageId === undefined) {
    return {
      sourcePassageId: fallback,
      reason: 'fallback: no entry in REVIEWED_RULE_PASSAGE_MAP — no independently reviewed, human-attested rule->passage mapping exists for this rule (D-EP3-6 default)',
    };
  }

  const bindablePassages = passagesFor(primarySourceId).filter(isBindableAsSourceSupported);
  const reviewedPassage = bindablePassages.find((passage) => passage.id === reviewedPassageId);
  if (!reviewedPassage) {
    return {
      sourcePassageId: fallback,
      reason: `fallback: REVIEWED_RULE_PASSAGE_MAP names "${reviewedPassageId}", but it is not (or is no longer) a bindable source-supported passage for "${primarySourceId}" (EP3-T5 quarantine, unknown id, or wrong source) — falling back per D-EP3-6`,
    };
  }

  return {
    sourcePassageId: reviewedPassageId,
    reason: `source-supported: independently reviewed, human-attested mapping (REVIEWED_RULE_PASSAGE_MAP)`,
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
  lines.push('(D-EP3-6 fail-safe binder).');
  lines.push('');
  lines.push('**Reviewer-gate fix-1 (finding 1, HIGH):** this script no longer contains a keyword/substring');
  lines.push('matcher. The earlier version bound `sourcePassageId` by testing whether a hand-picked fact-name');
  lines.push('substring appeared anywhere in `JSON.stringify(rule.when)` — with no polarity awareness (a fact');
  lines.push('inside a negated branch matched identically to one the rule requires present) and no check that');
  lines.push('the passage\'s actual language supports the rule\'s specific threshold and output. That produced');
  lines.push('provably wrong bindings (`Q-NORMO-LOW-001` bound to a marrow-replacement passage because that');
  lines.push('fact name appeared inside a `not` condition). A correct rule->passage mapping requires human');
  lines.push('clinical review that has not happened; inventing one mechanically is exactly what this');
  lines.push('codebase\'s guardrails forbid — so that authority was removed, not "fixed."');
  lines.push('');
  lines.push('The ONLY path to "source-supported" now is `REVIEWED_RULE_PASSAGE_MAP`, a hand-maintained,');
  lines.push('currently-EMPTY table in the script itself. An entry may be added only from an independently');
  lines.push('reviewed, human-attested mapping — never derived mechanically. Every rule without an entry');
  lines.push('falls back to its cited source\'s minted `implementation-proposal` sentinel: the honest,');
  lines.push('conservative default meaning "no source-supported clinical-grounding claim is made for this');
  lines.push('rule." As of this writing that is all 91 rules.');
  lines.push('');
  lines.push(`**Split: ${supportedCount} source-supported / ${proposalCount} implementation-proposal (of ${mappingRows.length} rules).**`);
  lines.push('');
  lines.push('Per-source split (keyed by each rule\'s first cited source, `evidence[0]`):');
  lines.push('');
  lines.push('| Source | source-supported | implementation-proposal |');
  lines.push('|---|---|---|');
  for (const [sourceId, counts] of [...bySource.entries()].sort(([a], [b]) => compareCodepoints(a, b))) {
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
  const nextMappingDoc = buildMappingDoc(mappingRows);

  if (check) {
    // Reviewer-gate fix-4: --check must cover the generated mapping document too, not only
    // rules.json — a hand-edited or stale ep4-rule-passage-map.md would otherwise silently drift
    // from the actual bindings without failing this gate.
    const targets = [
      { path: RULES_PATH, label: 'rules.json', next: nextSerialised, count: `${governed.length} rules` },
      { path: MAPPING_DOC_PATH, label: 'ep4-rule-passage-map.md', next: nextMappingDoc, count: `${mappingRows.length} mapping rows` },
    ];
    let allMatch = true;
    for (const target of targets) {
      const current = await readFile(target.path, 'utf8');
      if (current === target.next) {
        console.log(`backfill-rule-governance --check: ${path.relative(REPO_ROOT, target.path)} matches regenerated output (${target.count}).`);
        continue;
      }
      allMatch = false;
      const diff = firstDiffLines(current, target.next);
      console.error(`backfill-rule-governance --check: ${path.relative(REPO_ROOT, target.path)} differs from regenerated output.`);
      console.error(diff ? `First differing hunks:\n${diff}` : '(no line-level diff produced; check byte lengths)');
    }
    if (!allMatch) process.exit(1);
    return;
  }

  await writeFile(RULES_PATH, nextSerialised, 'utf8');
  await writeFile(MAPPING_DOC_PATH, nextMappingDoc, 'utf8');

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
