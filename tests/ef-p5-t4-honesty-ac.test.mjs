// tests/ef-p5-t4-honesty-ac.test.mjs — multi-bundle-conversion-e1, Phase 5, row P5-T4
// (LOAD-BEARING honesty AC; decisions block Notes for implementation-planner; repeated at the
// parent plan's "LOAD-BEARING Honesty Acceptance Criteria" section).
//
// P5-T1 (RF-KID-001) and P5-T2 (RF-GRO-002) projected real, verified evidence into
// modules/kidney_suite_v1/ and modules/growth_suite_v1/ -- evidence.json, evidence-assertions.json,
// unresolved.json all grew. This test proves the one thing that MUST NOT have moved as a result:
// neither module emitted a single clinical rule, and neither module's governance posture changed.
//
// Three load-bearing invariants, each test-enforced (not merely asserted in prose):
//
//   1. rules.json stays byte-identical `[]` for both modules -- whole-file byte comparison, not
//      just "JSON.parse gives an empty array" (a reformatted-but-parses-the-same file would still
//      fail this). git history corroborates this independently: as of this commit,
//      `git log --oneline -- modules/kidney_suite_v1/rules.json` and the growth equivalent each
//      show exactly ONE commit (P3-T1 9c803dc / P3-T2 b9741c9, the Phase 3 scaffold) -- i.e. `git
//      diff <that commit> HEAD -- <path>` is empty. That git evidence is necessarily a
//      point-in-time fact about *this* branch's history (commit ids do not survive a squash
//      merge), so it is recorded here as commentary, not encoded as a runtime dependency on a
//      specific SHA -- the runtime test instead pins the literal expected byte content, which is
//      the durable, forever-repeatable form of the same invariant.
//   2. module.json.status/approvedBy/clinicalContentHash stay exactly "unsigned-stub"/[]/null for
//      both modules -- unchanged by the projection landing real evidence.
//   3. "Evidence projected" is never described, anywhere in this phase's own tracked output
//      surfaces, as "module complete" or "clinically ready" EXCEPT inside an explicit negation
//      (the AC text itself says "never... module complete... clinically ready" -- that sentence is
//      the rule, not a violation of it). A bare, unqualified occurrence of either phrase fails.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MODULES = Object.freeze(['kidney_suite_v1', 'growth_suite_v1']);

// The exact, whole-file byte content every module's rules.json must carry -- Phase 3's scaffold
// state, confirmed unchanged through Phase 5 by `git diff` against each module's sole scaffold
// commit (P3-T1 9c803dc for kidney_suite_v1, P3-T2 b9741c9 for growth_suite_v1).
const EXPECTED_RULES_JSON_BYTES = '[]\n';

// The three module.json fields this AC pins. `status` is the machine-readable "not clinically
// ready" signal a downstream consumer (or a careless human) could otherwise be tempted to flip
// once real evidence lands; `approvedBy`/`clinicalContentHash` are the schema-forced
// no-clinical-sign-off-exists markers (docs/architecture.md section 6/7/10).
const EXPECTED_GOVERNANCE_FIELDS = Object.freeze({
  status: 'unsigned-stub',
  approvedBy: [],
  clinicalContentHash: null,
});

for (const moduleId of MODULES) {
  test(`${moduleId}/rules.json stays byte-identical "[]" after Phase 5's evidence projection`, async () => {
    const rulesPath = path.join(REPO_ROOT, 'modules', moduleId, 'rules.json');
    const raw = await readFile(rulesPath, 'utf8');
    assert.equal(
      raw,
      EXPECTED_RULES_JSON_BYTES,
      `${moduleId}/rules.json must remain exactly "[]\\n" (Phase 3's scaffold state) -- zero rules ` +
        'may be emitted as a side effect of projecting evidence (no authoring-decisions.yaml exists ' +
        `for ${moduleId}, so nothing is approved to author a rule from). Got: ${JSON.stringify(raw)}`,
    );
    // Belt-and-suspenders: also confirm the parsed shape, so a failure clearly distinguishes
    // "wrong bytes" from "not even valid JSON".
    assert.deepEqual(JSON.parse(raw), [], `${moduleId}/rules.json must parse to an empty array`);
  });

  test(`${moduleId}/module.json keeps its unsigned-stub governance posture unchanged`, async () => {
    const manifestPath = path.join(REPO_ROOT, 'modules', moduleId, 'module.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

    assert.equal(
      manifest.status,
      EXPECTED_GOVERNANCE_FIELDS.status,
      `${moduleId}/module.json.status must stay "unsigned-stub" -- landing real evidence via the ` +
        'projection is not clinical review, and must never be read as "module complete" or ' +
        `clinically ready. Got: ${JSON.stringify(manifest.status)}`,
    );
    assert.deepEqual(
      manifest.approvedBy,
      EXPECTED_GOVERNANCE_FIELDS.approvedBy,
      `${moduleId}/module.json.approvedBy must stay [] -- no named, credentialed clinician has ` +
        `reviewed anything this phase projected. Got: ${JSON.stringify(manifest.approvedBy)}`,
    );
    assert.equal(
      manifest.clinicalContentHash,
      EXPECTED_GOVERNANCE_FIELDS.clinicalContentHash,
      `${moduleId}/module.json.clinicalContentHash must stay null -- there is no signed clinical ` +
        `content to hash. Got: ${JSON.stringify(manifest.clinicalContentHash)}`,
    );
  });
}

test('modules/kidney_suite_v1/ and modules/growth_suite_v1/ never emitted a rule between them (aggregate zero-new-rules check)', async () => {
  for (const moduleId of MODULES) {
    const rules = JSON.parse(await readFile(path.join(REPO_ROOT, 'modules', moduleId, 'rules.json'), 'utf8'));
    assert.equal(rules.length, 0, `${moduleId}/rules.json must have zero rules`);
  }
});

// --- "never described as module complete / clinically ready" language check -----------------
//
// The AC's prose requirement ("never described anywhere in this phase's output") is checked
// against the concrete, tracked documentation surfaces Phase 5's own tasks write to: the phase
// progress tracker and the decisions-block worknote (the two places a human or agent narrating
// "what P5-T1..T4 did" would plausibly write a summary sentence). A bare, unqualified occurrence
// of either forbidden phrase fails; an occurrence wrapped in an explicit negation (e.g. "never...
// module complete") -- which is exactly how this AC itself is phrased everywhere it is quoted --
// is allowed, since that sentence *is* the rule, not a violation of it.

const FORBIDDEN_PHRASES = Object.freeze(['module complete', 'clinically ready']);
const NEGATION_WINDOW_CHARS = 120;
const NEGATION_PATTERN = /\b(never|not|no longer|isn't|is not|must not|nor|cannot|can not|n't)\b/i;

const HONESTY_SCANNED_SURFACES = Object.freeze([
  '.claude/progress/multi-bundle-conversion-e1/phase-5-progress.md',
  '.claude/worknotes/multi-bundle-conversion-e1/decisions-block.md',
]);

function findUnqualifiedOccurrences(text, phrase) {
  const lowerText = text.toLowerCase();
  const lowerPhrase = phrase.toLowerCase();
  const offenses = [];
  let fromIndex = 0;
  for (;;) {
    const idx = lowerText.indexOf(lowerPhrase, fromIndex);
    if (idx === -1) break;
    const windowStart = Math.max(0, idx - NEGATION_WINDOW_CHARS);
    const window = text.slice(windowStart, idx);
    if (!NEGATION_PATTERN.test(window)) {
      offenses.push({ index: idx, context: text.slice(windowStart, idx + phrase.length + 20) });
    }
    fromIndex = idx + lowerPhrase.length;
  }
  return offenses;
}

for (const relPath of HONESTY_SCANNED_SURFACES) {
  test(`${relPath} never describes evidence projection as "module complete" or "clinically ready" unqualified`, async () => {
    const absPath = path.join(REPO_ROOT, relPath);
    const text = await readFile(absPath, 'utf8');
    for (const phrase of FORBIDDEN_PHRASES) {
      const offenses = findUnqualifiedOccurrences(text, phrase);
      assert.deepEqual(
        offenses,
        [],
        `${relPath} contains an unqualified (non-negated) occurrence of "${phrase}" -- Phase 5's ` +
          'evidence projection (P5-T1/P5-T2) must never be read as implying module completeness ' +
          `or clinical readiness. Offending context(s): ${JSON.stringify(offenses, null, 2)}`,
      );
    }
  });
}
