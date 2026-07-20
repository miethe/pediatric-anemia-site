// Structural coverage check for the findings register — arc-clinical-council-adoption-v1 P4-V1
// final cleanup, C6.
//
// WHY THIS FILE EXISTS: three findings this cycle fell out of cross-referencing that depended on
// someone noticing rather than on a mechanical check — R7 (listed for cross-reference, never
// dispatched as a fix), the destroyed-uncommitted-file incident, and F4/R13 (raised by the
// general-pediatrics lens, never carried into this register's R-numbering, absent entirely until a
// final cleanup pass found it). This test does not re-run a manual reconciliation; it derives the
// authoritative finding-ID sets from machine-readable/structural sources and asserts the register
// accounts for every one of them, so a future omission fails `npm run check` instead of depending on
// someone noticing.
//
// SCOPE, STATED PRECISELY — read this before trusting what "coverage" means below:
//
//   AXIS 1 (canonical PAC-P4T2-* IDs) is a full, sound, bidirectional coverage property. The matrix
//   JSON (docs/safety/hazard-control-matrix.json) is the source of truth for these IDs (mirrored from
//   `finding`, `productIntegration.finding`, `coverageFinding` on every row, the same fields
//   tests/hazard-control-matrix.test.mjs already asserts are internally consistent). This test derives
//   that ID set live from the JSON — never restates it — and asserts every one is cited in the
//   register, and that the register cites no PAC-P4T2-* ID absent from the matrix (catches typos and
//   phantom cross-references in both directions).
//
//   AXIS 2 (R<n> reviewer-item labels) is NOT and CANNOT be a full coverage property from inside this
//   repository. R-numbers are ordinal labels a reviewing lens assigns to its own findings during a
//   review pass; that raw per-lens finding list is never persisted anywhere machine-readable in this
//   repository (verified: no F1..F4-style enumeration for general-pediatrics-reviewer, or any other
//   P4-V1 lens, exists outside this register's own prose — grepped for it before writing this test).
//   That is exactly how F4 was lost: it never became a token anywhere this test could derive an
//   independent expectation from. What CAN be checked mechanically, and is checked below, is a weaker
//   but real property: internal self-consistency of the register's OWN two record-keeping surfaces —
//   the "### Register" summary table (plus its "referenced not duplicated" list) versus the full
//   write-up sections / "Repo-side landing locations" bullets elsewhere in the document. An R-number
//   that is declared in one surface and silently dropped from the other now fails a test. An R-number
//   that is never declared on EITHER surface — F4's actual failure mode — is invisible to this check
//   by construction, because there is nothing to derive an expectation from. Closing that residual gap
//   requires either (a) a small structured, machine-readable anchor added to the register itself
//   (e.g. a per-lens finding inventory block), authored by the register's own owner, or (b) persisting
//   raw per-lens review output somewhere machine-readable. Neither is something this task is
//   authorized to add to the register (file ownership) or invent the content of (clinical-content-
//   adjacent, reviewer-process authority this repository task does not hold). See the final report for
//   the precise anchor shape recommended to the register owner.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MATRIX_PATH = 'docs/safety/hazard-control-matrix.json';
const REGISTER_PATH = '.claude/findings/arc-clinical-council-adoption-v1-findings.md';

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const matrix = await readJson(MATRIX_PATH);
const registerText = await readText(REGISTER_PATH);

// --- AXIS 1: canonical PAC-P4T2-* IDs, derived from the matrix JSON, never restated -------------

/** Every PAC-P4T2-* findingId the matrix JSON itself carries, across all three finding-bearing
 * fields on every row. This is a LIVE derivation from the manifest, not a hardcoded list — if a
 * future P4-T2 remediation adds/removes/renumbers a finding, this set moves with it automatically. */
function canonicalIdsFromMatrix(manifest) {
  const ids = [];
  for (const row of manifest.rows) {
    if (row.finding) ids.push(row.finding.findingId);
    if (row.productIntegration && row.productIntegration.finding) {
      ids.push(row.productIntegration.finding.findingId);
    }
    if (row.coverageFinding) ids.push(row.coverageFinding.findingId);
  }
  return ids;
}

/** Every well-formed PAC-P4T2-NNN token appearing anywhere in the register's prose. */
function canonicalIdsCitedInRegister(text) {
  return [...new Set(text.match(/PAC-P4T2-\d{3}/g) || [])];
}

function diffCanonicalCoverage(matrixIds, registerIds) {
  const matrixSet = new Set(matrixIds);
  const registerSet = new Set(registerIds);
  return {
    missingFromRegister: [...matrixSet].filter((id) => !registerSet.has(id)),
    phantomInRegister: [...registerSet].filter((id) => !matrixSet.has(id)),
  };
}

test('AXIS 1: every PAC-P4T2-* finding ID produced by hazard-control-matrix.json is cited in the findings register', () => {
  const matrixIds = canonicalIdsFromMatrix(matrix);
  assert.ok(matrixIds.length > 0, 'sanity: the matrix must actually carry at least one finding for this test to mean anything');
  const registerIds = canonicalIdsCitedInRegister(registerText);
  const { missingFromRegister, phantomInRegister } = diffCanonicalCoverage(matrixIds, registerIds);
  assert.deepEqual(
    missingFromRegister,
    [],
    `matrix carries finding ID(s) never cited anywhere in the register: ${missingFromRegister.join(', ')}`,
  );
  assert.deepEqual(
    phantomInRegister,
    [],
    `register cites PAC-P4T2-* ID(s) that do not exist anywhere in the matrix — typo or phantom cross-reference: ${phantomInRegister.join(', ')}`,
  );
});

test('AXIS 1 NEGATIVE (discrimination proof, matrix-side): a matrix finding ID with no register citation is detected', () => {
  const matrixIds = [...canonicalIdsFromMatrix(matrix), 'PAC-P4T2-999'];
  const registerIds = canonicalIdsCitedInRegister(registerText);
  const { missingFromRegister } = diffCanonicalCoverage(matrixIds, registerIds);
  assert.deepEqual(missingFromRegister, ['PAC-P4T2-999']);
});

test('AXIS 1 NEGATIVE (discrimination proof, register-side): a register citation absent from the matrix is detected as phantom', () => {
  const matrixIds = canonicalIdsFromMatrix(matrix);
  const registerIds = [...canonicalIdsCitedInRegister(registerText), 'PAC-P4T2-888'];
  const { phantomInRegister } = diffCanonicalCoverage(matrixIds, registerIds);
  assert.deepEqual(phantomInRegister, ['PAC-P4T2-888']);
});

test('AXIS 1 NEGATIVE (discrimination proof, real removal): stripping an actual PAC-P4T2-006 citation out of the loaded register text is detected', () => {
  const matrixIds = canonicalIdsFromMatrix(matrix);
  assert.ok(matrixIds.includes('PAC-P4T2-006'), 'sanity: the ID this proof removes must actually be in the live matrix');
  const mutatedRegisterText = registerText.replaceAll('PAC-P4T2-006', 'PAC-P4T2-XXX');
  const registerIds = canonicalIdsCitedInRegister(mutatedRegisterText);
  const { missingFromRegister } = diffCanonicalCoverage(matrixIds, registerIds);
  assert.deepEqual(missingFromRegister, ['PAC-P4T2-006'], 'removing every citation of a real finding ID from the register text must be caught');
});

// --- AXIS 2: R<n> reviewer-item labels — internal register self-consistency only -----------------
//
// See the file-header SCOPE note: this is a weaker, register-internal property, not independent
// verification against a per-lens source of truth (none exists in this repository).

const REGISTER_HEADING = '### Register\n';
const R_TOKEN = /(R\d+(?:\([a-z]\))?)/;

/** Splits the register document into the "### Register" section body (the summary table plus its
 * trailing "referenced not duplicated" paragraph) and everything else. Both halves are derived by
 * locating the actual heading text live in the file, not by assuming a line number. */
function splitRegisterSection(text) {
  const startIdx = text.indexOf(REGISTER_HEADING);
  assert.ok(startIdx !== -1, 'the register no longer has a "### Register" heading — this test cannot locate the summary table it depends on; re-scope this test if the register was restructured');
  const bodyStart = startIdx + REGISTER_HEADING.length;
  const nextHeadingIdx = text.indexOf('\n### ', bodyStart);
  assert.ok(nextHeadingIdx !== -1, 'no heading found after "### Register" — cannot bound the section');
  return {
    registerSection: text.slice(bodyStart, nextHeadingIdx),
    restOfDocument: text.slice(0, startIdx) + text.slice(nextHeadingIdx),
  };
}

/** R-number tokens that lead a markdown table row cell, e.g. "| R2(b) | ..." -> "R2(b)". */
function extractTableRowRNumbers(sectionText) {
  const ids = [];
  const re = new RegExp('^\\|\\s*' + R_TOKEN.source + '(?:\\s|\\|)');
  for (const line of sectionText.split('\n')) {
    const m = line.match(re);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/** R-number tokens bold-emphasized anywhere in the given text, e.g. "**R1** (product-integration...)"
 * or "**R2(b) blocked-release-state cross-check...**" -> "R1", "R2(b)". Covers both the "referenced
 * not duplicated" declaration list and every "Repo-side landing locations" bullet / inline
 * cross-reference paragraph, since all of them use this same bold-lead-in convention in this file. */
function extractBoldRNumbers(text) {
  const ids = [];
  const re = new RegExp('\\*\\*' + R_TOKEN.source + '(?:\\s|\\*)', 'g');
  let m;
  while ((m = re.exec(text))) ids.push(m[1]);
  return ids;
}

/** R-number tokens that head a "### R<n> ..." section, e.g. "### R13 [MEDIUM, ...]" -> "R13". */
function extractHeadingRNumbers(text) {
  const ids = [];
  const re = new RegExp('^### ' + R_TOKEN.source + '(?:\\s|$)', 'gm');
  let m;
  while ((m = re.exec(text))) ids.push(m[1]);
  return ids;
}

/** The R-numbers the "### Register" section itself declares as tracked: every row of its summary
 * table, plus every R-number bold-mentioned in its "referenced not duplicated, owned by parallel
 * agents" paragraph. */
function declaredRNumbers(registerSection) {
  return new Set([...extractTableRowRNumbers(registerSection), ...extractBoldRNumbers(registerSection)]);
}

/** The R-numbers that resolve to an actual explanation OUTSIDE the "### Register" declaration
 * section itself: either a full "### R<n> ..." write-up, or a bold-led cross-reference / landing-
 * location mention (the "Repo-side landing locations" bullets and the R1/R2(b) inline
 * cross-reference paragraphs both use this convention). Deliberately excludes the declaration
 * section's own text so that merely being named in the table/list does not count as its own
 * resolution. */
function resolvedRNumbers(restOfDocument) {
  return new Set([...extractHeadingRNumbers(restOfDocument), ...extractBoldRNumbers(restOfDocument)]);
}

test('AXIS 2: every R-number declared in the "### Register" section (table rows + referenced-not-duplicated list) resolves to an explanation elsewhere in the document', () => {
  const { registerSection, restOfDocument } = splitRegisterSection(registerText);
  const declared = declaredRNumbers(registerSection);
  assert.ok(declared.size > 0, 'sanity: the Register section must declare at least one R-number for this test to mean anything');
  const resolved = resolvedRNumbers(restOfDocument);
  const unresolved = [...declared].filter((id) => !resolved.has(id));
  assert.deepEqual(
    unresolved,
    [],
    `R-number(s) declared in the "### Register" section but with no "### R<n>" write-up or bold cross-reference found anywhere else in the document: ${unresolved.join(', ')}`,
  );
});

test('AXIS 2 sanity: the declared R-number set matches what a direct read of the document currently shows (R1..R13, R2 as "R2(b)")', () => {
  const { registerSection } = splitRegisterSection(registerText);
  const declared = declaredRNumbers(registerSection);
  const expected = new Set(['R1', 'R2(b)', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13']);
  assert.deepEqual(declared, expected, 'the set of R-numbers this register declares as tracked has changed — this is not a failure by itself, but confirm the change was intentional (a new/removed R-item), not a formatting regression that silently broke extraction');
});

test('AXIS 2 NEGATIVE (discrimination proof, real removal): deleting the "### R13" write-up section from a mutated copy is detected as unresolved', () => {
  const { registerSection, restOfDocument } = splitRegisterSection(registerText);
  const declared = declaredRNumbers(registerSection);
  assert.ok(declared.has('R13'), 'sanity: R13 must actually be declared in the live register for this proof to mean anything');

  // Remove only the "### R13 ..." heading line so the write-up section no longer registers as a
  // resolution, without touching any other content (simulates the write-up being dropped while the
  // summary-table row survives).
  const mutatedRestOfDocument = restOfDocument.replace(/^### R13\b.*$/m, '### (R13 write-up removed for discrimination proof)');
  const resolved = resolvedRNumbers(mutatedRestOfDocument);
  const unresolved = [...declared].filter((id) => !resolved.has(id));
  assert.deepEqual(unresolved, ['R13'], 'removing the R13 write-up heading must be caught as an unresolved declared R-number');
});

test('AXIS 2 known blind spot, documented not asserted-away: an R-number removed from BOTH the declaration section and its write-up (the actual F4 failure mode) produces zero declared entries and passes — this is the residual gap AXIS 2 cannot close without an external anchor', () => {
  const { registerSection, restOfDocument } = splitRegisterSection(registerText);
  // Simulate F4/R13 never having been recorded anywhere at all: strip R13 from the declaration
  // section (as if its table row and its "referenced not duplicated" mention never existed) AND
  // from the rest of the document (as if its write-up never existed).
  const mutatedSection = registerSection.replace(/\|\s*R13[^|]*\|[^\n]*\n?/, '');
  const mutatedRest = restOfDocument.replace(/^### R13\b.*$/m, '');
  const declared = declaredRNumbers(mutatedSection);
  assert.ok(!declared.has('R13'), 'R13 must be fully absent from the simulated declaration section');
  const resolved = resolvedRNumbers(mutatedRest);
  const unresolved = [...declared].filter((id) => !resolved.has(id));
  // The point being demonstrated: because R13 was never declared, there is nothing for AXIS 2 to
  // flag as unresolved — the check is vacuously satisfied. A finding erased from every surface at
  // once, rather than dropped from just one, is invisible to a register-internal consistency check
  // by construction. This is the residual gap the file header and final report describe.
  assert.deepEqual(unresolved, [], 'documents the known blind spot: total omission from both surfaces is not, and cannot be, caught by an internal-consistency check alone');
});
