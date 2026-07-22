// tests/portal-concept-assets-manifest.test.mjs — clinical-review-workflow P4-T2 (FR-17, risk R6).
//
// THE DOCS-TRUTH INVARIANT THIS PROVES: every image file that lives under
// `docs/project_plans/design-specs/assets/` has a companion manifest entry
// (`docs/project_plans/design-specs/assets/asset-manifest.md`) recording, verbatim, the
// "CONCEPT ONLY — NOT COMMITTED" watermark string that must be baked into the rendered image.
//
// WHY A GREP-STYLE TEST, NOT PIXEL VERIFICATION. The plan's own P4-T2 acceptance criteria say this
// explicitly: "a companion manifest entry per asset records the watermark string (verified by a
// docs-truth grep test, since pixel-OCR is out of scope)." This suite therefore never opens the PNG
// bytes — it only proves the manifest's plain-text claim exists, is well-formed, and stays in sync
// (in both directions) with what actually sits in the assets directory. The watermark's presence
// inside the rendered image itself was verified once, by hand, by the P4-T2 executing agent (see the
// manifest's own per-asset "Notes" column) — that human/agent verification step is out of reach of an
// automated test and is not what this file claims to prove.
//
// FAIL-CLOSED ON BOTH DIRECTIONS:
//   (a) an image file with no matching manifest row — a future asset dropped in without a manifest
//       update must fail, not silently pass;
//   (b) a manifest row naming a file that no longer exists on disk — stale manifest drift must also
//       fail, not linger unnoticed;
//   (c) a non-image, non-manifest file sitting in the directory unaccounted for — this directory is
//       scoped to CONCEPT-ONLY mockups plus their manifest, nothing else.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS_DIR = path.join(REPO_ROOT, 'docs/project_plans/design-specs/assets');
const MANIFEST_FILENAME = 'asset-manifest.md';
const MANIFEST_PATH = path.join(ASSETS_DIR, MANIFEST_FILENAME);

/** The exact watermark banner text FR-17 / risk R6 require baked into every mockup image. */
const WATERMARK_STRING = 'CONCEPT ONLY — NOT COMMITTED';

/** Recognized image extensions this directory is permitted to hold (case-insensitive). */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

/**
 * Parse the manifest's asset table into a `Map<filename, watermarkCellText>`.
 *
 * The manifest is a plain markdown table; each data row looks like:
 *   | `some-file.png` | `CONCEPT ONLY — NOT COMMITTED` | ... |
 * Header/separator rows (no backtick-wrapped first cell) are skipped. This is a deliberately
 * simple, line-oriented parser — no YAML/markdown-table library is introduced for a single
 * docs-truth check.
 */
function parseManifestAssetTable(manifestText) {
  const entries = new Map();
  for (const rawLine of manifestText.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
    if (cells.length === 0) continue;
    const firstCellMatch = cells[0].match(/^`([^`]+)`$/);
    if (!firstCellMatch) continue; // header row, separator row, or a non-file first cell
    const filename = firstCellMatch[1];
    const watermarkCell = cells[1] ?? '';
    entries.set(filename, watermarkCell);
  }
  return entries;
}

test('the watermark constant this suite checks against matches the plan/dispatch text verbatim (em dash, not hyphen)', () => {
  // Regression guard: a hyphen substituted for the em dash, or any other character drift, must fail
  // loudly here rather than silently passing a looser check below.
  assert.equal(WATERMARK_STRING, 'CONCEPT ONLY — NOT COMMITTED');
});

test('asset-manifest.md exists alongside the images it documents', () => {
  const dirEntries = readdirSync(ASSETS_DIR);
  assert.ok(
    dirEntries.includes(MANIFEST_FILENAME),
    `expected ${MANIFEST_FILENAME} under ${ASSETS_DIR} — every image asset needs a companion manifest entry`,
  );
});

test('every image file under design-specs/assets/ has a manifest row naming the watermark string', () => {
  const dirEntries = readdirSync(ASSETS_DIR, { withFileTypes: true });
  const imageFiles = dirEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()));

  assert.ok(imageFiles.length > 0, 'expected at least one image file under design-specs/assets/ (found none — is the fixture path stale?)');

  const manifestText = readFileSync(MANIFEST_PATH, 'utf8');
  const manifestEntries = parseManifestAssetTable(manifestText);

  for (const imageFile of imageFiles) {
    assert.ok(
      manifestEntries.has(imageFile),
      `image file "${imageFile}" has no matching row in ${MANIFEST_FILENAME} — every asset must be recorded`,
    );
    const watermarkCell = manifestEntries.get(imageFile);
    assert.ok(
      watermarkCell.includes(WATERMARK_STRING),
      `manifest row for "${imageFile}" does not record the watermark string verbatim (got: ${JSON.stringify(watermarkCell)})`,
    );
  }
});

test('the manifest carries no stale entry pointing at a deleted or renamed asset', () => {
  const dirEntries = new Set(readdirSync(ASSETS_DIR));
  const manifestText = readFileSync(MANIFEST_PATH, 'utf8');
  const manifestEntries = parseManifestAssetTable(manifestText);

  for (const filename of manifestEntries.keys()) {
    assert.ok(
      dirEntries.has(filename),
      `manifest row references "${filename}", which does not exist under ${ASSETS_DIR} — remove or correct the stale row`,
    );
  }
});

test('design-specs/assets/ holds only recognized image files and the manifest itself (no unaccounted-for content)', () => {
  const dirEntries = readdirSync(ASSETS_DIR, { withFileTypes: true });
  for (const entry of dirEntries) {
    if (!entry.isFile()) continue;
    if (entry.name === MANIFEST_FILENAME) continue;
    const extension = path.extname(entry.name).toLowerCase();
    assert.ok(
      IMAGE_EXTENSIONS.has(extension),
      `unexpected file "${entry.name}" in ${ASSETS_DIR} — this directory holds only CONCEPT-ONLY mockup images plus ${MANIFEST_FILENAME}`,
    );
  }
});

test('the manifest restates the honesty boundary (unvalidated research prototype)', () => {
  const manifestText = readFileSync(MANIFEST_PATH, 'utf8');
  assert.match(
    manifestText,
    /unvalidated research prototype/i,
    `${MANIFEST_FILENAME} must restate the project's honesty boundary`,
  );
});
