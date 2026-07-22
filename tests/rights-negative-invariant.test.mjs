// tests/rights-negative-invariant.test.mjs — EPR3-T1 / FR-WP3-09 / AC-WP3-NEGATIVE (D1).
//
// THE NEGATIVE INVARIANT: the archive is provenance, not text.
//
// This test is a *positive structural check over the working tree*. It asserts that this repository
// contains no third-party source document, no reproduced table, no figure/image/brand asset beyond a
// frozen first-party list, and no captured field carrying a verbatim span beyond what the
// `passageFidelity` policy already permits.
//
// WHY IT LANDS FIRST. Every later capture task in EP-R3 (EPR3-T5 atomic backfill, EPR3-T6 numerics
// re-capture, EPR3-T8 guideline-recommendation capture) writes captured content. Git history is
// unrecoverable: once restricted third-party expression is committed it cannot be removed from the
// history of a shared branch by any action available to this project. Prevention is therefore the
// only control that actually works, and it has to exist before the first write, not after it.
//
// ---------------------------------------------------------------------------------------------
// THIS IS A NO-REGRESSION GATE, NOT A CLEAN-SLATE GATE.
// ---------------------------------------------------------------------------------------------
//
// `docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md` (the independent EP3-T5 passage-fidelity
// audit) already recorded 11 pre-existing near-verbatim spans — normalized longest shared contiguous
// runs of 8-13 words (and four shorter ~7-word runs) against restricted source text, all sitting
// under `passageFidelity: "paraphrase"`. No task in the rights-aware-evidence-capture feature
// re-authors them; that work is deferred as **DEF-R5**
// (`docs/project_plans/design-specs/near-verbatim-span-reauthoring.md`). An absolute "no near-verbatim
// span anywhere" assertion would therefore fail on day one and be disabled within a week, which is
// worse than no gate at all.
//
// So the 11 audit-enumerated passages are carried on a **named, frozen allowlist**
// (`NEAR_VERBATIM_PASSAGE_ALLOWLIST` below). THE ALLOWLIST MAY ONLY SHRINK, NEVER GROW. Adding an
// entry is a reviewable diff that must cite a plan amendment; there is no circumstance in which a
// newly-authored capture belongs on it. A test below asserts every entry still resolves to a live
// passage, so a re-authored (or deleted) span must be actively removed from the list rather than
// left as stale debt. DEF-R5 closes when the allowlist is empty.
//
// Current state note (verified at authoring time): all 11 allowlisted passages are presently
// `passageFidelity: "withheld"` — `scripts/evidence/vendor-rf-bundle.mjs` replaced `exactPassage`
// with the fixed placeholder before the record was minted, so the restricted text is not in the tree
// today. The allowlist is consequently *inert but not obsolete*: the passages still carry the
// `near-verbatim-span-pending-rights` flag, and if that withholding is ever lifted (e.g. on a REG-002
// clearance this project does not have) the spans return. Removing an entry means the underlying
// finding was resolved, not merely that the text is currently hidden.
//
// ---------------------------------------------------------------------------------------------
// RESIDUAL GAP R-1 — **OPEN, NOT CLOSED**.
// ---------------------------------------------------------------------------------------------
//
// Prohibited-excerpt detection is **not deterministic** and this test does not make it so. The only
// sound way to prove a captured string is not a near-verbatim reproduction is to diff it against the
// source text — and the source text is exactly what this repository is forbidden to hold. What this
// test actually enforces is a set of *proxies*:
//
//   - structural facts that ARE decidable (file types, magic bytes, `passageFidelity` values,
//     prohibited field names, table-shaped blobs, audit-flag membership); and
//   - a *quoted-run budget*, which catches text that announces itself as a quotation but cannot see
//     an unquoted reproduction of source phrasing at all.
//
// A capture that silently re-uses 12 words of source phrasing without quote marks passes this test.
// That gap is real, is not closed here, and is only closed by an independent fidelity audit of the
// kind that produced the 11 allowlisted spans in the first place. Do not read a green run of this
// test as evidence that no near-verbatim span exists. It is evidence that no *detectable* one was
// introduced. R-1 stays open.
//
// Determinism: no `Date.now()`, no `new Date()`, no `localeCompare()` (locale-dependent — see the
// LOW finding in the EP3-T5 audit). All ordering uses an explicit codepoint comparator.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------------------------
// Frozen allowlists. Each entry is a declared, reviewable exception. All three MAY ONLY SHRINK.
// ---------------------------------------------------------------------------------------------

/**
 * DEF-R5 — the 11 pre-existing near-verbatim spans enumerated by
 * `docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md` (HIGH finding #1, tracked as
 * `EP3T5-F01` / `RF-EP3T5-F01-NEAR-VERBATIM-001`). Nothing in this feature re-authors them.
 *
 * MAY ONLY SHRINK, NEVER GROW. Removing an entry requires the span to have been re-authored and
 * re-verified per the DEF-R5 design spec. Adding one requires a plan amendment and is, for any
 * newly-authored capture, simply wrong.
 */
const NEAR_VERBATIM_PASSAGE_ALLOWLIST = Object.freeze([
  // 8-13 word shared contiguous spans (FDA #ev_004 is the 13-word case):
  'FDA2026_CDS#ev_002',
  'FDA2026_CDS#ev_003',
  'FDA2026_CDS#ev_004',
  'FDA2026_CDS#ev_005',
  'BSH2020_G6PD#ev_003',
  'BSH2020_G6PD#ev_005',
  'BSH2020_G6PD#ev_007',
  // shorter (~7 word) shared spans:
  'AAP2026_IDA#ev_005',
  'CDC2025_LEAD#ev_001',
  'CDC2025_LEAD#ev_003',
  'BSH2020_G6PD#ev_002',
]);

/**
 * Binary / document-shaped files that are permitted to exist in the tree. Every entry is
 * **first-party**: authored by this project or by the operator's own Agentic-OS programme. NOT ONE
 * of these is a third-party source document, and no third-party source document may ever be added.
 *
 * MAY ONLY SHRINK. A new entry here is the exact failure mode D1 exists to prevent; if a task
 * believes it needs one, that is an escalation, not an edit.
 */
const FIRST_PARTY_BINARY_ALLOWLIST = Object.freeze([
  // First-party site brand asset (this project's own favicon).
  'assets/favicon.svg',
  // First-party programme documents authored by this project (own commercialization package).
  'docs/project_plans/pediatric-cds-commercialization-package-2026-07-16/Pediatric_Anemia_CDS_Current_App_Specification.docx',
  'docs/project_plans/pediatric-cds-commercialization-package-2026-07-16/Pediatric_Anemia_CDS_Current_App_Specification.pdf',
  'docs/project_plans/pediatric-cds-commercialization-package-2026-07-16/Pediatric_CDS_Commercialization_Strategy.docx',
  'docs/project_plans/pediatric-cds-commercialization-package-2026-07-16/Pediatric_CDS_Commercialization_Strategy.pdf',
  // First-party Agentic-OS specification (Research Foundry rights governance spec, operator-authored).
  'docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0.docx',
  // First-party AI-generated CONCEPT-ONLY watermarked portal mockup (operator-directed gpt-5.6 image
  // tool), ratified by implementation plan P4-T2 (PRs #23/#25); adjudication recorded in
  // .claude/findings/clinical-review-workflow-findings.md (CRW-F1).
  'docs/project_plans/design-specs/assets/clinical-review-portal-concept-v2.png',
]);

/**
 * Pre-existing quoted runs in capture-surface JSON that exceed the quoted-run budget below.
 * Keyed `<repo-relative file>::<json path>`. Every entry is annotated with why it is not retained
 * third-party expression.
 *
 * MAY ONLY SHRINK. This is a second no-regression concession, adjacent to DEF-R5 but not named by
 * it; the plan enumerated the 11 passage IDs, not these field-level anchors.
 */
const QUOTED_RUN_ALLOWLIST = Object.freeze([
  // First-party quotation: quotes this project's OWN internal ARC review note, not a third-party
  // source. Kept because the reviewer's exact wording is the point of the note.
  'rights/rights-records.json::records[6].review.notes',
]);

// ---------------------------------------------------------------------------------------------
// Policy constants
// ---------------------------------------------------------------------------------------------

/** `passageFidelity` values this project is permitted to write. `verbatim` is not one of them. */
const PERMITTED_PASSAGE_FIDELITY = Object.freeze(['paraphrase', 'withheld']);

/** The audit-flag that marks a near-verbatim span. Membership is gated by the allowlist above. */
const NEAR_VERBATIM_FLAG = 'near-verbatim-span-pending-rights';

/**
 * Quoted-run budget, in words.
 *
 * A locator ANCHOR legitimately quotes a short run of source text so a human can find the passage
 * again — that is addressable provenance (D1 permits it) and it is marked as a quotation. A
 * capture BODY quoting source text is retained expression (D1 forbids it). So the budget is tight
 * everywhere and merely non-zero in anchor positions.
 *
 * The body threshold is 8 because 8 words is where the EP3-T5 audit's own disqualifying spans start.
 */
const MAX_QUOTED_RUN_WORDS_BODY = 7;
const MAX_QUOTED_RUN_WORDS_ANCHOR = 20;

/** Final JSON path segments that are locator/bibliographic anchors rather than capture bodies. */
const ANCHOR_FIELDS = Object.freeze(new Set([
  'raw', 'locator', 'sourceLocator', 'section', 'table', 'figure', 'page',
  'supersedes', 'title', 'journal', 'component', 'age', 'sex', 'assay',
]));

/**
 * Field names that would hold retained third-party expression by construction. None may appear in a
 * capture surface, whatever its value.
 */
const PROHIBITED_FIELD_NAMES = Object.freeze(new Set([
  'quote', 'quotes', 'quotation', 'verbatim', 'verbatimText', 'verbatim_text',
  'verbatim_excerpt', 'verbatimExcerpt', 'excerpt', 'excerpts', 'exactQuote', 'exact_quote',
  'fullText', 'full_text', 'sourceText', 'source_text', 'rawText', 'raw_text',
  'bodyText', 'body_text', 'ocrText', 'ocr_text', 'pageImage', 'page_image',
  // reproduced-table shapes
  'tableRows', 'table_rows', 'tableData', 'table_data', 'cells', 'reproducedTable', 'reproduced_table',
]));

/** File extensions that are documents, images, archives, media, or fonts. */
const BINARY_EXTENSIONS = Object.freeze(new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
  '.rtf', '.epub', '.mobi', '.azw', '.azw3', '.djvu', '.pages', '.numbers', '.key',
  '.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.webp', '.heic', '.svg', '.ico',
  '.mp3', '.mp4', '.wav', '.mov', '.avi', '.webm', '.m4a',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.bin', '.dat', '.db', '.sqlite', '.sqlite3',
]));

/** Magic-byte prefixes, so an extension-less or mis-named document is still caught. */
const MAGIC_PREFIXES = Object.freeze([
  { name: 'PDF', bytes: [0x25, 0x50, 0x44, 0x46] },                 // %PDF
  { name: 'ZIP/OOXML', bytes: [0x50, 0x4b, 0x03, 0x04] },           // PK..  (docx/xlsx/pptx/epub)
  { name: 'PNG', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { name: 'JPEG', bytes: [0xff, 0xd8, 0xff] },
  { name: 'GIF', bytes: [0x47, 0x49, 0x46, 0x38] },
  { name: 'GZIP', bytes: [0x1f, 0x8b] },
  { name: 'RTF', bytes: [0x7b, 0x5c, 0x72, 0x74, 0x66] },           // {\rtf
  { name: 'OLE2 (legacy Office)', bytes: [0xd0, 0xcf, 0x11, 0xe0] },
]);

/** Directories excluded from the tree walk: VCS internals, installed deps, generated build output. */
const EXCLUDED_DIRS = Object.freeze(new Set(['.git', 'node_modules', 'dist', 'coverage', '.venv']));

/**
 * Capture surfaces — the JSON trees that hold captured, source-derived content. The tree walk covers
 * the whole repository; these are additionally content-scanned.
 */
const CAPTURE_SURFACE_ROOTS = Object.freeze(['modules', 'rights', 'evidence-packs']);

// ---------------------------------------------------------------------------------------------
// Pure detectors. Every one takes an in-memory model so a seeded fixture runs through exactly the
// same code path as the real repository — a detector that only ever sees good input is untested.
// ---------------------------------------------------------------------------------------------

/** Deterministic, locale-independent string ordering (never `localeCompare`). */
function byCodepoint(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function wordCount(text) {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Extract quoted runs from a string. Straight and curly double quotes are unambiguous. Single quotes
 * only count when neither delimiter abuts a letter, so `AAP's` and `module's` are not mistaken for a
 * quotation — an apostrophe-driven false positive is how a gate like this gets switched off.
 *
 * @returns {string[]} the quoted runs, in order of appearance.
 */
export function extractQuotedRuns(text) {
  const patterns = [
    /"([^"]{2,}?)"/g,
    /“([^”]{2,}?)”/g,
    /(?<![\p{L}\p{N}])'([^']{2,}?)'(?![\p{L}\p{N}])/gu,
    /(?<![\p{L}\p{N}])‘([^’]{2,}?)’(?![\p{L}\p{N}])/gu,
  ];
  const runs = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) runs.push(match[1]);
  }
  return runs;
}

/**
 * Does this string look like a reproduced table (rather than a per-value atom)?
 * Markdown pipe rows, tab-delimited rows, or a repeated multi-column run.
 */
export function looksLikeReproducedTable(text) {
  const lines = text.split(/\r?\n/);
  const pipeRows = lines.filter((line) => (line.match(/\|/g) || []).length >= 2).length;
  if (pipeRows >= 2) return 'markdown/pipe table rows';
  const tabRows = lines.filter((line) => (line.match(/\t/g) || []).length >= 2).length;
  if (tabRows >= 2) return 'tab-delimited table rows';
  const gapRows = lines.filter((line) => (line.match(/ {3,}\S/g) || []).length >= 2).length;
  if (gapRows >= 3) return 'column-aligned table rows';
  return null;
}

/**
 * Flatten a parsed JSON document into `{ jsonPath, key, value }` records for every string leaf, and
 * collect every object key seen.
 */
export function flattenJson(value, jsonPath = '', out = { strings: [], keys: [] }) {
  if (typeof value === 'string') {
    const key = jsonPath.split('.').pop()?.replace(/\[\d+\]$/, '') ?? '';
    out.strings.push({ jsonPath: jsonPath.replace(/^\./, ''), key, value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => flattenJson(item, `${jsonPath}[${index}]`, out));
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value).sort(byCodepoint)) {
      out.keys.push({ jsonPath: `${jsonPath}.${key}`.replace(/^\./, ''), key });
      flattenJson(value[key], `${jsonPath}.${key}`, out);
    }
  }
  return out;
}

/**
 * The capture-surface detector.
 *
 * @param {{path: string, json: unknown}[]} docs
 * @param {{quotedRunAllowlist?: readonly string[]}} [options]
 * @returns {string[]} violations, sorted deterministically. Empty means clean.
 */
export function scanCaptureSurfaces(docs, options = {}) {
  const quotedRunAllowlist = new Set(options.quotedRunAllowlist ?? QUOTED_RUN_ALLOWLIST);
  const violations = [];

  for (const doc of docs) {
    const { strings, keys } = flattenJson(doc.json);

    for (const { jsonPath, key } of keys) {
      if (PROHIBITED_FIELD_NAMES.has(key)) {
        violations.push(`${doc.path}::${jsonPath}: prohibited field name "${key}" — a capture surface may not carry retained source expression or a reproduced table structure`);
      }
    }

    for (const { jsonPath, key, value } of strings) {
      if (key === 'passageFidelity' && !PERMITTED_PASSAGE_FIDELITY.includes(value)) {
        violations.push(`${doc.path}::${jsonPath}: passageFidelity "${value}" is not permitted (allowed: ${PERMITTED_PASSAGE_FIDELITY.join(', ')}) — REG-002 has cleared no verbatim reuse`);
      }

      const tableShape = looksLikeReproducedTable(value);
      if (tableShape) {
        violations.push(`${doc.path}::${jsonPath}: looks like a reproduced table (${tableShape}) — numerics are captured as per-value atoms with locators, never as a reproduced table`);
      }

      const budget = ANCHOR_FIELDS.has(key) ? MAX_QUOTED_RUN_WORDS_ANCHOR : MAX_QUOTED_RUN_WORDS_BODY;
      for (const run of extractQuotedRuns(value)) {
        const words = wordCount(run);
        if (words <= budget) continue;
        if (quotedRunAllowlist.has(`${doc.path}::${jsonPath}`)) continue;
        violations.push(`${doc.path}::${jsonPath}: quoted run of ${words} words exceeds the ${ANCHOR_FIELDS.has(key) ? 'anchor' : 'body'} budget of ${budget} — a locator may anchor on a short quoted run; a capture body may not retain source expression`);
      }
    }
  }

  return violations.sort(byCodepoint);
}

/**
 * The working-tree detector.
 *
 * @param {{path: string, bytes: Uint8Array}[]} files
 * @param {{binaryAllowlist?: readonly string[]}} [options]
 * @returns {string[]} violations, sorted deterministically.
 */
export function scanWorkingTree(files, options = {}) {
  const allowed = new Set(options.binaryAllowlist ?? FIRST_PARTY_BINARY_ALLOWLIST);
  const violations = [];

  for (const file of files) {
    if (allowed.has(file.path)) continue;
    const extension = path.extname(file.path).toLowerCase();
    if (BINARY_EXTENSIONS.has(extension)) {
      violations.push(`${file.path}: document/image/archive file (${extension}) is not on the first-party allowlist — the archive is provenance, not third-party documents, tables, figures, or brand assets`);
      continue;
    }
    for (const magic of MAGIC_PREFIXES) {
      if (magic.bytes.every((byte, index) => file.bytes[index] === byte)) {
        violations.push(`${file.path}: ${magic.name} magic bytes on a non-allowlisted file — a source document may not be smuggled in under a text-looking extension`);
        break;
      }
    }
  }

  return violations.sort(byCodepoint);
}

/**
 * The near-verbatim no-regression detector: every passage the fidelity audit flags as near-verbatim
 * must be on the frozen allowlist, and every allowlist entry must still resolve to a live passage.
 *
 * @param {{id: string, reviewFlags?: unknown}[]} passages
 * @param {readonly string[]} allowlist
 */
export function scanNearVerbatimFlags(passages, allowlist) {
  const allowed = new Set(allowlist);
  const violations = [];
  const seen = new Set();

  for (const passage of passages) {
    const flags = Array.isArray(passage?.reviewFlags) ? passage.reviewFlags : [];
    if (!flags.includes(NEAR_VERBATIM_FLAG)) continue;
    seen.add(passage.id);
    if (!allowed.has(passage.id)) {
      violations.push(`${passage.id}: NEW near-verbatim span — not on the frozen DEF-R5 allowlist. The allowlist may only shrink; a newly-authored capture never belongs on it. Re-author the passage with independent syntax and word order.`);
    }
  }

  const passageIds = new Set(passages.map((p) => p?.id));
  for (const id of allowlist) {
    if (!passageIds.has(id)) {
      violations.push(`${id}: allowlisted span no longer resolves to a passage — remove the entry rather than leaving stale debt (DEF-R5 step 3).`);
    }
  }

  return violations.sort(byCodepoint);
}

// ---------------------------------------------------------------------------------------------
// Working-tree loading (deterministic: explicit exclusions, codepoint-sorted, no wall-clock input)
// ---------------------------------------------------------------------------------------------

function listFiles(absoluteDir, relativeDir = '') {
  const entries = readdirSync(absoluteDir, { withFileTypes: true })
    .slice()
    .sort((a, b) => byCodepoint(a.name, b.name));
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const relative = relativeDir === '' ? entry.name : `${relativeDir}/${entry.name}`;
    const absolute = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files.push(...listFiles(absolute, relative));
    } else if (entry.isFile()) {
      files.push({ path: relative, absolute });
    }
  }
  return files;
}

let treeFiles;
let captureDocs;
let allPassages;

test('working tree and capture surfaces load', () => {
  treeFiles = listFiles(REPO_ROOT).map((file) => ({
    path: file.path,
    bytes: readFileSync(file.absolute).subarray(0, 8),
  }));
  assert.ok(treeFiles.length > 100, 'expected the tree walk to find the repository, not an empty directory');

  captureDocs = [];
  for (const root of CAPTURE_SURFACE_ROOTS) {
    for (const file of listFiles(path.join(REPO_ROOT, root), root)) {
      if (!file.path.endsWith('.json')) continue;
      captureDocs.push({ path: file.path, json: JSON.parse(readFileSync(file.absolute, 'utf8')) });
    }
  }
  assert.ok(captureDocs.length > 0, 'expected at least one capture-surface JSON document');

  const evidence = JSON.parse(readFileSync(path.join(REPO_ROOT, 'modules', 'anemia', 'evidence.json'), 'utf8'));
  allPassages = evidence.sources.flatMap((source) => source.passages ?? []);
  assert.equal(allPassages.length, 41, 'expected the 41 known passages — update this test deliberately if the corpus changes');
});

// ---------------------------------------------------------------------------------------------
// The invariant, over the real repository
// ---------------------------------------------------------------------------------------------

test('D1: no third-party source document, reproduced table dump, figure, image, or brand asset exists anywhere in the working tree', () => {
  const violations = scanWorkingTree(treeFiles);
  assert.deepEqual(violations, [], `working-tree violations:\n${violations.join('\n')}`);
});

test('D1: no capture surface carries a verbatim span, a prohibited excerpt field, or a reproduced table', () => {
  const violations = scanCaptureSurfaces(captureDocs);
  assert.deepEqual(violations, [], `capture-surface violations:\n${violations.join('\n')}`);
});

test('no passage anywhere is passageFidelity "verbatim" (REG-002 has cleared no verbatim reuse)', () => {
  for (const passage of allPassages) {
    assert.ok(
      PERMITTED_PASSAGE_FIDELITY.includes(passage.passageFidelity),
      `${passage.id}: passageFidelity "${passage.passageFidelity}" is not permitted`,
    );
  }
});

test('DEF-R5 no-regression: every near-verbatim-flagged passage is on the frozen allowlist, and every allowlist entry still resolves', () => {
  const violations = scanNearVerbatimFlags(allPassages, NEAR_VERBATIM_PASSAGE_ALLOWLIST);
  assert.deepEqual(violations, [], `near-verbatim allowlist violations:\n${violations.join('\n')}`);
});

test('the frozen allowlist is exactly the 11 spans the EP3-T5 audit enumerated, and may only shrink', () => {
  assert.ok(
    NEAR_VERBATIM_PASSAGE_ALLOWLIST.length <= 11,
    `the allowlist has grown to ${NEAR_VERBATIM_PASSAGE_ALLOWLIST.length} entries. It may only shrink. ` +
    'Adding an entry requires a plan amendment; a newly-authored capture never belongs on it.',
  );
  assert.equal(new Set(NEAR_VERBATIM_PASSAGE_ALLOWLIST).size, NEAR_VERBATIM_PASSAGE_ALLOWLIST.length,
    'the allowlist must not contain duplicates');
  assert.ok(Object.isFrozen(NEAR_VERBATIM_PASSAGE_ALLOWLIST), 'the allowlist must be frozen at module scope');
});

test('the frozen allowlist is cross-checked against the audit finding it comes from (EP3T5-F01), not just asserted', () => {
  const findings = JSON.parse(readFileSync(path.join(REPO_ROOT, 'evidence-packs', 'rf-ev-001', 'fidelity-findings.json'), 'utf8'));
  const flagged = findings.findings
    .filter((finding) => finding.flag === NEAR_VERBATIM_FLAG)
    .flatMap((finding) => finding.passageIds)
    .sort(byCodepoint);
  assert.ok(flagged.length > 0, 'expected the fidelity-findings file to still name the near-verbatim finding');
  for (const id of flagged) {
    assert.ok(NEAR_VERBATIM_PASSAGE_ALLOWLIST.includes(id),
      `${id} is named by the audit finding but missing from the frozen allowlist — the two must agree`);
  }
});

// ---------------------------------------------------------------------------------------------
// Seeded fixtures — the detectors must actually fire. AC-WP3-NEGATIVE cases (a)-(d).
// ---------------------------------------------------------------------------------------------

test('AC-WP3-NEGATIVE (a): a binary/PDF-like source asset fails', () => {
  const pdfBytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
  const byExtension = scanWorkingTree([{ path: 'docs/sources/aap-2026-ida.pdf', bytes: pdfBytes }]);
  assert.ok(byExtension.some((v) => v.includes('aap-2026-ida.pdf')), 'a .pdf source document must fail');

  // and the same document renamed to look like text is still caught, by magic bytes
  const byMagic = scanWorkingTree([{ path: 'docs/sources/aap-2026-ida.notes.md', bytes: pdfBytes }]);
  assert.ok(byMagic.some((v) => v.includes('PDF magic bytes')), 'a mis-named source document must fail on magic bytes');

  const docxBytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
  assert.ok(scanWorkingTree([{ path: 'rights/who-2024-terms.txt', bytes: docxBytes }]).length > 0,
    'an OOXML/zip document must fail whatever its extension');

  // a figure/image is equally prohibited
  assert.ok(scanWorkingTree([{ path: 'docs/figures/who-fig-1.png', bytes: new Uint8Array(8) }]).length > 0,
    'a reproduced figure must fail');
});

test('AC-WP3-NEGATIVE (b): a passage with passageFidelity "verbatim" fails', () => {
  const violations = scanCaptureSurfaces([{
    path: 'modules/anemia/evidence.json',
    json: { sources: [{ passages: [{ id: 'X#ev_001', passageFidelity: 'verbatim', exactPassage: 'anything' }] }] },
  }]);
  assert.ok(violations.some((v) => v.includes('passageFidelity "verbatim"')), 'passageFidelity "verbatim" must fail');
});

test('AC-WP3-NEGATIVE (c): a new asset directory holding a table dump fails', () => {
  // as a file in the tree ...
  const csvBytes = Uint8Array.from(Buffer.from('age,hb\n6-24mo,110\n', 'utf8'));
  assert.ok(scanWorkingTree([{ path: 'assets/tables/aap-table-1.xlsx', bytes: csvBytes }]).length > 0,
    'a spreadsheet table dump in a new asset directory must fail');

  // ... and as a reproduced table smuggled into a capture-surface string
  const violations = scanCaptureSurfaces([{
    path: 'rights/table-dump.json',
    json: {
      notes: '| Age | Hb | MCV |\n| --- | --- | --- |\n| 6-24 mo | 11.0 | 70 |',
    },
  }]);
  assert.ok(violations.some((v) => v.includes('reproduced table')), 'a pipe-table dump in a captured field must fail');

  const tabViolations = scanCaptureSurfaces([{
    path: 'rights/table-dump.json',
    json: { notes: 'Age\tHb\tMCV\n6-24 mo\t11.0\t70\n2-5 y\t11.5\t73' },
  }]);
  assert.ok(tabViolations.some((v) => v.includes('reproduced table')), 'a tab-delimited table dump must fail');

  // and a reproduced-table *structure* is caught by field name
  const structural = scanCaptureSurfaces([{
    path: 'rights/table-dump.json',
    json: { tableRows: [['6-24 mo', 11.0], ['2-5 y', 11.5]] },
  }]);
  assert.ok(structural.some((v) => v.includes('prohibited field name')), 'a reproduced-table structure must fail');
});

test('AC-WP3-NEGATIVE (d): a NEW near-verbatim span in a passage not on the allowlist fails', () => {
  // (d.1) audit-flag route — the detector the no-regression gate rests on
  const passages = [
    { id: 'FDA2026_CDS#ev_002', reviewFlags: [NEAR_VERBATIM_FLAG] }, // allowlisted, tolerated
    { id: 'WHO2024_HB#ev_009', reviewFlags: [NEAR_VERBATIM_FLAG] },  // NEW — must fail
  ];
  const allowlist = ['FDA2026_CDS#ev_002'];
  const violations = scanNearVerbatimFlags(passages, allowlist);
  assert.equal(violations.length, 1, `expected exactly one violation, got:\n${violations.join('\n')}`);
  assert.ok(violations[0].includes('WHO2024_HB#ev_009') && violations[0].includes('NEW near-verbatim span'));

  // (d.2) a stale allowlist entry fails too — the list must shrink, not rot
  const stale = scanNearVerbatimFlags([{ id: 'FDA2026_CDS#ev_002', reviewFlags: [NEAR_VERBATIM_FLAG] }],
    ['FDA2026_CDS#ev_002', 'GONE#ev_001']);
  assert.ok(stale.some((v) => v.includes('GONE#ev_001') && v.includes('no longer resolves')),
    'an allowlist entry with no live passage must fail');

  // (d.3) text route — a quoted run of source phrasing in a capture body
  const textual = scanCaptureSurfaces([{
    path: 'modules/anemia/evidence.json',
    json: {
      exactPassage: 'The guideline states "in most otherwise healthy children without evidence of acute infection or chronic disease" the value applies.',
    },
  }]);
  assert.ok(textual.some((v) => v.includes('exceeds the body budget')), 'a long quoted run in a capture body must fail');

  // ... and the allowlist is honoured, so the gate is no-regression rather than clean-slate
  const allowlisted = scanCaptureSurfaces(
    [{ path: 'x.json', json: { notes: 'he said "one two three four five six seven eight nine ten"' } }],
    { quotedRunAllowlist: ['x.json::notes'] },
  );
  assert.deepEqual(allowlisted, [], 'an allowlisted quoted run must be tolerated');
});

test('the quoted-run detector does not fire on apostrophes (a false-positive-prone gate gets switched off)', () => {
  assert.deepEqual(extractQuotedRuns("AAP's own sources[] enumerates the module's six sources"), [],
    'possessive apostrophes must not be read as quotation delimiters');
  assert.deepEqual(extractQuotedRuns('he said "hello there"'), ['hello there']);
  assert.deepEqual(extractQuotedRuns("the paragraph beginning 'Screening to identify children'"),
    ['Screening to identify children']);
});

test('determinism: both tree detectors return byte-identical output across repeated runs', () => {
  assert.deepEqual(scanWorkingTree(treeFiles), scanWorkingTree(treeFiles));
  assert.deepEqual(scanCaptureSurfaces(captureDocs), scanCaptureSurfaces(captureDocs));
  assert.deepEqual(
    scanNearVerbatimFlags(allPassages, NEAR_VERBATIM_PASSAGE_ALLOWLIST),
    scanNearVerbatimFlags(allPassages, NEAR_VERBATIM_PASSAGE_ALLOWLIST),
  );
});

test('R-1 is recorded as OPEN, not closed: this file states the limits of what it proves', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const header = self.slice(0, self.indexOf('import test'));
  assert.ok(header.includes('RESIDUAL GAP R-1'), 'the header must name residual gap R-1');
  assert.ok(/R-1[\s\S]{0,200}OPEN, NOT CLOSED/.test(header) || header.includes('R-1 stays open'),
    'the header must record R-1 as open');
  assert.ok(header.includes('not deterministic'),
    'the header must state that prohibited-excerpt detection is not deterministic');
  assert.ok(header.includes('MAY ONLY SHRINK, NEVER GROW'),
    'the header must state the allowlist-may-only-shrink rule');
});
