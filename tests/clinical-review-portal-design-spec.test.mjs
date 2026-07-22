// tests/clinical-review-portal-design-spec.test.mjs — clinical-review-workflow P4-T3 (FR-15/FR-17).
//
// THE DOCS-TRUTH INVARIANT THIS PROVES: the portal design spec
// (`docs/project_plans/design-specs/clinical-review-portal-workflow.md`) stays `maturity: shaping`
// — this is the plan's own binding acceptance criterion for P4-T3 ("confirm the portal section's
// `maturity` field stays `shaping` — never promoted by this task") and the Tier-3 karen milestone
// gate (P4-GATE2) re-checks it independently. This suite also proves the spec's Phase 4 content
// additions actually happened: the four required portal-promotion-framework elements are present
// and the CONCEPT-ONLY mockup asset is linked — so a future edit that silently drops one of them,
// or flips `maturity` to `committed`, fails this suite rather than being noticed only by eye.
//
// WHY A GREP/FRONTMATTER-STYLE TEST, NOT A FULL MARKDOWN/YAML PARSER. This mirrors
// `tests/portal-concept-assets-manifest.test.mjs`'s own justification: no YAML/markdown-table
// library is introduced for a handful of docs-truth checks over one file. Frontmatter is parsed
// with a minimal line-oriented scanner sufficient for this file's flat `key: value` fields.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(
  REPO_ROOT,
  'docs/project_plans/design-specs/clinical-review-portal-workflow.md',
);
const FRAMEWORK_PATH = '.claude/worknotes/clinical-review-workflow/friction-observations.md';
const MOCKUP_ASSET_PATH =
  'docs/project_plans/design-specs/assets/clinical-review-portal-concept-v2.png';
const MOCKUP_MANIFEST_PATH = 'docs/project_plans/design-specs/assets/asset-manifest.md';

/**
 * Extract the value of a single flat `key: value` frontmatter field from a design-spec's leading
 * `---`-delimited YAML block. Deliberately narrow: this file's frontmatter has no nested `maturity`
 * key anywhere else, so a simple anchored-line match is sufficient and fails loudly (returns
 * `undefined`) rather than guessing if the shape ever changes.
 */
function readFrontmatterField(fileText, fieldName) {
  const frontmatterMatch = fileText.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(frontmatterMatch, 'expected a leading --- frontmatter block in the design spec');
  const frontmatterBlock = frontmatterMatch[1];
  const fieldMatch = frontmatterBlock.match(new RegExp(`^${fieldName}:\\s*(.+)$`, 'm'));
  return fieldMatch ? fieldMatch[1].trim() : undefined;
}

let specText;

test('setup: read the portal design spec', () => {
  specText = readFileSync(SPEC_PATH, 'utf8');
  assert.ok(specText.length > 0, `expected non-empty content at ${SPEC_PATH}`);
});

test('P4-T3 acceptance criterion: maturity stays "shaping" — never promoted by this task', () => {
  const maturity = readFrontmatterField(specText, 'maturity');
  assert.equal(
    maturity,
    'shaping',
    `expected the design spec's frontmatter maturity field to remain "shaping" (found: ${maturity}) — ` +
      'promoting it is an explicit human decision (see the spec\'s own "Promotion Trigger" section), ' +
      'never a side effect of integrating the P4-T1 framework or the P4-T2 mockups',
  );
});

test('the design spec still starts at draft status (unchanged by this task)', () => {
  // Regression guard alongside maturity: this task integrates content, it does not advance the
  // spec's review-status posture either.
  const status = readFrontmatterField(specText, 'status');
  assert.equal(status, 'draft');
});

test('portal section links the P4-T1 framework document as the single source of truth', () => {
  assert.ok(
    specText.includes(FRAMEWORK_PATH),
    `expected the design spec to reference ${FRAMEWORK_PATH}`,
  );
});

test('portal section names all four required framework elements (FR-15)', () => {
  const frameworkSectionMatch = specText.match(
    /## Portal-Promotion Decision Framework \(OQ-8\)\n([\s\S]*?)\n## /,
  );
  assert.ok(
    frameworkSectionMatch,
    'expected a "## Portal-Promotion Decision Framework (OQ-8)" section',
  );
  const frameworkSection = frameworkSectionMatch[1];

  const requiredElementMarkers = [
    /friction-metric categories/i,
    /observation-log format/i,
    /promotion threshold/i,
    /pending human ratification/i,
    /authorized human decision-owner/i,
    /decision-record template/i,
  ];
  for (const marker of requiredElementMarkers) {
    assert.ok(
      marker.test(frameworkSection),
      `expected the "Portal-Promotion Decision Framework" section to mention ${marker} (element coverage check)`,
    );
  }
});

test('framework section names the decision-owner as a role, never a person or an agent', () => {
  const frameworkSectionMatch = specText.match(
    /## Portal-Promotion Decision Framework \(OQ-8\)\n([\s\S]*?)\n## /,
  );
  assert.ok(frameworkSectionMatch);
  const frameworkSection = frameworkSectionMatch[1];
  assert.match(frameworkSection, /platform-engineering lead/i);
  assert.match(frameworkSection, /never an autonomous agent/i);
});

test('design spec links the CONCEPT-ONLY mockup asset and its manifest', () => {
  assert.ok(
    specText.includes(MOCKUP_ASSET_PATH),
    `expected the design spec to reference ${MOCKUP_ASSET_PATH}`,
  );
  assert.ok(
    specText.includes(MOCKUP_MANIFEST_PATH),
    `expected the design spec to reference ${MOCKUP_MANIFEST_PATH}`,
  );
  assert.match(
    specText,
    /CONCEPT ONLY.{0,3}NOT COMMITTED/,
    'expected the mockup section to restate the watermark string',
  );
});

test('honesty boundary: the mockup section explicitly disclaims being a build commitment', () => {
  const mockupSectionMatch = specText.match(/## Concept Mockups \(CONCEPT-ONLY\)\n([\s\S]*?)\n## /);
  assert.ok(mockupSectionMatch, 'expected a "## Concept Mockups (CONCEPT-ONLY)" section');
  const mockupSection = mockupSectionMatch[1];
  assert.match(mockupSection, /not a specification, not a schedule/i);
  assert.match(mockupSection, /maturity.*stays.*shaping/i);
});
