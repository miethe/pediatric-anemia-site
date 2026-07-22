#!/usr/bin/env node
// scripts/evidence/generate-rf-fixture.mjs — P1-T1, multi-bundle-conversion-e1 Phase 1.
//
// Generalizes `scripts/evidence/vendor-rf-bundle.mjs`'s hand-rolled, single-bundle vendoring
// mechanics into a reusable, **bundle-parametrized** fixture generator: given any `rf` (Research
// Foundry) run directory plus a target fixture slug, it emits an EF-shaped `tests/fixtures/rf-
// <slug>/` tree that mirrors `tests/fixtures/rf-cbc-001/`'s exact file inventory — the fixture
// exemplar committed by the earlier evidence-foundry-buildout-v1 plan (task P1-T6) — so every
// future `rf` bundle this program converts gets the same, reviewable shape.
//
// Unlike the legacy `vendor-rf-bundle.mjs` (a EP-3-era, one-off script hard-coded to a single
// `DEFAULT_BUNDLE` constant and a fixed `SOURCE_CARD_TO_KB_ID` map), this generator:
//   - never hard-codes a bundle — it takes `--run-dir` and `--slug` as required arguments;
//   - never invents a converter-specific mapping — the fixture tree it emits is a *mirror* of the
//     `rf` bundle's own declared `evidence_bundle.yaml.artifacts` shape, not a re-projected
//     converter pack;
//   - applies ADR-0002's rights-restricted-by-default disposition per source card (`usage:`
//     block), not per-run;
//   - fails closed (non-zero exit, naming the offending card/file/line) on any source card whose
//     structure it does not recognize, rather than silently skipping it.
//
// What gets copied, and how (mirrors `tests/fixtures/rf-cbc-001/HASH-PROVENANCE.md` §2's own
// worked description of what P1-T6 did by hand):
//   - `evidence_bundle.yaml`, `research_brief.md`, `swarm_plan.yaml`, `claims/claim_ledger.yaml`,
//     `reports/report_draft.md`, `reviews/verification.yaml`, `writebacks/ccdash_event.yaml`, and
//     every `extractions/ext_*.yaml` file are copied byte-for-byte unmodified — HASH-PROVENANCE.md
//     documents (and this generator now mechanically enforces, rather than trusting a human's
//     "verified by direct inspection") that none of these artifact kinds ever carries a verbatim
//     source-article excerpt in the bundles this program processes. If a future bundle's copy of
//     one of these files DOES contain a `quote:`/`passage_locator:` construct, this generator
//     fails closed rather than committing an un-redacted excerpt by accident.
//   - Every `sources/src_*.md` source card is copied with its **rights disposition applied**: per
//     ADR-0002 / D-EP3-4, every passage defaults to the hash+selector-only disposition — the
//     verbatim `quote:` value (both the YAML frontmatter field and its markdown-body "Key
//     evidence" mirror) and any `pediatric_cds.threshold.passage_locator` value that itself embeds
//     a second copy of the excerpt are replaced by
//     `[redacted — content-rights: restricted (usage.allowed_for_public_output=false);
//     sha256:<hash-of-the-exact-original-substring>]` — **unless** that card's own `usage` block
//     positively confirms `allowed_for_public_output: true`, in which case the card is copied
//     unmodified. An absent `usage` block is never read as permission (ADR-0002, D-EP3-4).
//
// This generator does NOT write `HASH-PROVENANCE.md` or a passage-hash ledger — per the parent
// plan's phase table, those are P1-T3..T6's own artifacts (narrative, per-bundle provenance notes
// authored alongside the fixture this script emits), not part of "the fixture tree" this task's
// acceptance criteria compares against `rf-cbc-001`'s file inventory.
//
// Zero network calls. Zero LLM/generative-model invocations. Never writes to `--run-dir` (the
// live `rf` run directory is read-only input, exactly like the `rf-bundle-to-kb-pack` converter's
// own seam invariant 6).

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseYamlDocument, parseYamlFrontmatter, YamlParseError } from '../../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export class FixtureGenerationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FixtureGenerationError';
  }
}

// ADR-0002's fixed placeholder wording (matches `tests/fixtures/rf-cbc-001`'s already-committed
// redactions exactly, byte-for-byte, so this generator reproduces that fixture's known-good
// output when pointed at RF-CBC-001's own run directory).
//
// Exported (along with `matchLabelAt`/`parseQuotedSpan` below) so `scripts/evidence/check-fixture-
// rights-leakage.mjs` (P1-T7, R-4 mitigation) can recognize this exact placeholder shape and parse
// arbitrary quoted spans using the identical decode rules this generator used to produce them,
// rather than re-implementing (and risking drifting from) this parsing logic a second time.
export const REDACTION_PREFIX = '[redacted — content-rights: restricted (usage.allowed_for_public_output=false); sha256:';
export const REDACTION_SUFFIX = ']';

function buildPlaceholder(decodedText) {
  const hash = createHash('sha256').update(decodedText, 'utf8').digest('hex');
  return `"${REDACTION_PREFIX}${hash}${REDACTION_SUFFIX}"`;
}

// The single-file artifacts every `rf` bundle's `evidence_bundle.yaml.artifacts` map declares
// (mirrors `tools/rf-bundle-to-kb-pack/lib/loader.mjs`'s own `SINGLE_FILE_ARTIFACTS` list exactly
// — this generator and the converter that later reads these fixtures must agree on the artifact
// set, so intentionally kept in lockstep rather than re-derived independently).
const SINGLE_FILE_ARTIFACTS = [
  { key: 'research_brief', kind: 'text' },
  { key: 'swarm_plan', kind: 'yaml' },
  { key: 'claim_ledger', kind: 'yaml' },
  { key: 'report', kind: 'text' },
  { key: 'verification', kind: 'yaml' },
  { key: 'ccdash_event', kind: 'yaml' },
];

// ---------------------------------------------------------------------------------------------
// Line-level quote/passage_locator scanner
// ---------------------------------------------------------------------------------------------
//
// Operates on raw file TEXT, one physical line at a time, never reconstructing YAML from a parsed
// AST — this is deliberate: `tests/fixtures/rf-cbc-001/HASH-PROVENANCE.md` §2 documents that only
// the verbatim excerpt fields were changed and "everything else... is copied byte-for-byte
// unmodified." Redacting via raw-text substitution (rather than re-serializing parsed YAML) is the
// only way to keep that guarantee for arbitrary future bundles, since a parsed-and-re-emitted
// document can never be guaranteed to reproduce the original's exact whitespace/quoting/comment
// bytes.
//
// Confirmed against the 5 real `rf` bundles this program's fixtures come from (RF-CBC-001,
// RF-EV-001, RF-CBC-002, RF-KID-001, RF-GRO-002): every `quote:`/`passage_locator:` construct in
// every one of their 54 source cards falls into exactly one of the shapes this scanner recognizes
// (see below); anything else fails closed rather than silently under- or mis-redacting.

const LABELS = ['passage_locator', 'quote']; // longer-prefix-first is irrelevant here (disjoint names) but kept explicit

function isIdentChar(ch) {
  return ch !== undefined && /[A-Za-z0-9_-]/.test(ch);
}

/** Does a recognized `<label>:` token start at `line[i]`? Requires a non-identifier char (or
 * start-of-line) immediately before it, so `quote_limit_notes:`/`source_quote:`-style keys never
 * false-match (defense in depth — those names don't contain the literal substring `quote:`
 * anyway, since `quote:` requires the colon to immediately follow "quote"). */
export function matchLabelAt(line, i) {
  for (const label of LABELS) {
    if (line.startsWith(`${label}:`, i) && !isIdentChar(line[i - 1])) {
      return { label, afterColon: i + label.length + 1 };
    }
  }
  return null;
}

/** Parses one double-quoted scalar starting at `line[start] === '"'`, honoring the same escape
 * subset `tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs` (and the legacy vendor script) support:
 * `\"`, `\\`, `\n`, `\t`, `\/`. Never folds across physical lines — an unterminated quote on this
 * line is a fail-closed error, not a guess that it continues on the next line. */
export function parseQuotedSpan(line, start, context) {
  let i = start + 1;
  let decoded = '';
  const escapeMap = { '"': '"', '\\': '\\', n: '\n', t: '\t', '/': '/' };
  while (i < line.length) {
    const ch = line[i];
    if (ch === '\\') {
      const next = line[i + 1];
      if (!(next in escapeMap)) {
        throw new FixtureGenerationError(`${context}: unsupported escape "\\${next}" in quoted string at column ${i + 1}`);
      }
      decoded += escapeMap[next];
      i += 2;
      continue;
    }
    if (ch === '"') {
      return { raw: line.slice(start, i + 1), decoded, next: i + 1 };
    }
    decoded += ch;
    i += 1;
  }
  throw new FixtureGenerationError(`${context}: unterminated quoted string starting at column ${start + 1} (spans YAML folding this generator does not support)`);
}

/**
 * Redacts (or, if `restricted` is false, passes through unchanged while still validating) every
 * `quote:`/`passage_locator:` construct on a single physical line.
 *
 * Recognized shapes (the complete, closed set observed across all 5 real bundles this program
 * converts — anything else fails closed):
 *   - `quote: "<one excerpt>"` — end of line immediately after the closing quote.
 *   - `quote: "<one excerpt>".` — a single trailing period (markdown-body "Key evidence" bullets
 *     occasionally punctuate the sentence after the closing quote mark).
 *   - `quote: "<excerpt1>"; "<excerpt2>"; "<excerpt3>"...` — one or more excerpts on the same
 *     `quote:` label, separated by exactly `"; "` (a markdown-body bullet citing several
 *     non-contiguous spans of the same source).
 *   - `passage_locator: "<selector prefix + excerpt>"}` — the value ends the enclosing
 *     `threshold: {...}` flow mapping, so a single trailing `}` is expected and preserved.
 *   - `passage_locator: null}` — no excerpt to redact; left untouched.
 */
function redactLine(line, restricted, context) {
  let out = '';
  let i = 0;
  while (i < line.length) {
    const label = matchLabelAt(line, i);
    if (!label) {
      out += line[i];
      i += 1;
      continue;
    }
    out += line.slice(i, label.afterColon);
    let j = label.afterColon;
    const wsStart = j;
    while (j < line.length && (line[j] === ' ' || line[j] === '\t')) j += 1;
    out += line.slice(wsStart, j);

    if (line[j] !== '"') {
      if (label.label === 'passage_locator' && line.startsWith('null', j)) {
        out += 'null';
        i = j + 4;
        continue;
      }
      throw new FixtureGenerationError(`${context}: "${label.label}:" is not followed by a double-quoted string (or, for passage_locator, "null")`);
    }

    const pieces = [];
    while (line[j] === '"') {
      const span = parseQuotedSpan(line, j, context);
      pieces.push(restricted ? buildPlaceholder(span.decoded) : span.raw);
      j = span.next;
      if (line.startsWith('; ', j) && line[j + 2] === '"') {
        pieces.push('; ');
        j += 2;
        continue;
      }
      break;
    }
    out += pieces.join('');

    const rest = line.slice(j);
    const allowed = label.label === 'passage_locator' ? rest === '}' : rest === '' || rest === '.';
    if (!allowed) {
      throw new FixtureGenerationError(
        `${context}: unrecognized trailing content after "${label.label}:" value: ${JSON.stringify(rest)} — this generator's recognized-shape set does not cover this construct`,
      );
    }
    out += rest;
    i = line.length;
  }
  return out;
}

/** Redacts (or validates-and-passes-through) an entire file's text, line by line, preserving the
 * exact line-splitting/joining so any line this function does not touch survives byte-identical. */
function redactText(text, restricted, context) {
  const lines = text.split('\n');
  return lines.map((line, idx) => redactLine(line, restricted, `${context}:${idx + 1}`)).join('\n');
}

/** Fails closed if `text` contains a `quote:`/`passage_locator:` construct anywhere — used for
 * artifact kinds `tests/fixtures/rf-cbc-001/HASH-PROVENANCE.md` §2 documents as verified (by human
 * inspection) to never carry a verbatim excerpt: extraction cards, the claim ledger, the
 * verification record, the report, the research brief, `swarm_plan.yaml`, the CCDash writeback
 * event, and `evidence_bundle.yaml` itself. This generator re-asserts that invariant mechanically
 * for every future bundle rather than trusting it stays true by convention. */
function assertNeverCarriesExcerptField(text, label) {
  const lines = text.split('\n');
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    for (let i = 0; i < line.length; i += 1) {
      if (matchLabelAt(line, i)) {
        throw new FixtureGenerationError(
          `${label}:${idx + 1}: unexpected "quote:"/"passage_locator:" construct — this artifact kind is expected to never carry a verbatim source excerpt, and this generator has no redaction rule for it here`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Source-card structural validation
// ---------------------------------------------------------------------------------------------

function requireNonEmptyString(value, context) {
  if (typeof value !== 'string' || value === '') {
    throw new FixtureGenerationError(`${context}: expected a non-empty string, got ${JSON.stringify(value)}`);
  }
  return value;
}

/** Validates one source card's parsed frontmatter well enough to redact it safely, and to catch
 * an "unmatched source card" (declared id disagrees with, or duplicates, another card's) before
 * any output is written for the bundle. Deliberately does NOT enforce the `pediatric_cds`
 * extension block's presence — that is EF-WP1's eligibility gate's job (P2-T1), a separate,
 * later concern from "can this generator safely mirror and redact this file." */
function validateSourceCard(frontmatter, fileName, seenCardIds) {
  const cardId = requireNonEmptyString(frontmatter.source_card_id, `${fileName}: source_card_id`);
  const expectedId = fileName.replace(/\.md$/, '');
  if (cardId !== expectedId) {
    throw new FixtureGenerationError(
      `unmatched source card: ${fileName} declares source_card_id "${cardId}", expected "${expectedId}" (filename must match the card's own declared id)`,
    );
  }
  if (seenCardIds.has(cardId)) {
    throw new FixtureGenerationError(`unmatched source card: duplicate source_card_id "${cardId}" (already seen in this run directory)`);
  }
  seenCardIds.add(cardId);

  const usage = frontmatter.usage;
  if (usage !== null && usage !== undefined) {
    if (typeof usage !== 'object' || Array.isArray(usage)) {
      throw new FixtureGenerationError(`${fileName}: "usage" is present but is not a mapping`);
    }
    const allowed = usage.allowed_for_public_output;
    if (allowed !== undefined && typeof allowed !== 'boolean') {
      throw new FixtureGenerationError(
        `${fileName}: usage.allowed_for_public_output is present but not a boolean (${JSON.stringify(allowed)}) — refusing to guess a rights disposition from a non-boolean value`,
      );
    }
  }

  const points = frontmatter.extracted_points;
  if (!Array.isArray(points) || points.length === 0) {
    throw new FixtureGenerationError(`unmatched source card: ${fileName} has no extracted_points`);
  }
  for (const point of points) {
    const evidenceId = point?.evidence_id;
    if (typeof evidenceId !== 'string' || !/^ev_\d+$/.test(evidenceId)) {
      throw new FixtureGenerationError(`unmatched source card: ${fileName} has a point with a malformed evidence_id: ${JSON.stringify(evidenceId)}`);
    }
    requireNonEmptyString(point.quote, `${fileName}#${evidenceId}: quote`);
    requireNonEmptyString(point.locator, `${fileName}#${evidenceId}: locator`);
  }

  // Positively confirmed clear only when `usage.allowed_for_public_output === true`. Absence of a
  // `usage` block — or a `usage` block that omits the field, or sets it to anything but the exact
  // boolean `true` — is never read as permission (ADR-0002 / D-EP3-4).
  const restricted = !(usage && usage.allowed_for_public_output === true);
  return { restricted, points };
}

/** Self-audit: after redaction, assert that each restricted point's frontmatter `quote` (and any
 * non-null `threshold.passage_locator`) value was actually replaced by ITS OWN placeholder
 * somewhere in the card's redacted output. This is a second, independent check on top of the
 * line-level scanner above — belt-and-suspenders against a scanner bug silently leaving a known
 * frontmatter excerpt un-redacted.
 *
 * Deliberately a *positive* "the expected placeholder is present" check, not a *negative* "the
 * original text is absent everywhere" check: a source card's point-level `locator` field is
 * intentionally left untouched (ADR-0002: "the human-readable selector is preserved undiminished
 * in the sibling `locator` field"), and for a short excerpt (e.g. a section heading quoted
 * verbatim as its own locator, as several `rf-gro-002`/`rf-ev-001` cards do) that untouched
 * `locator` text can legitimately match the `quote`/`passage_locator` value byte-for-byte. A
 * negative "not found anywhere" check would false-positive on exactly that legitimate case. */
function assertKnownExcerptsRedacted(redactedText, points, fileName) {
  for (const point of points) {
    if (typeof point.quote === 'string' && point.quote !== '') {
      const expected = buildPlaceholder(point.quote);
      if (!redactedText.includes(expected)) {
        throw new FixtureGenerationError(`${fileName}#${point.evidence_id}: expected redaction placeholder for "quote" not found in redacted output — the line-level scanner may not have processed this occurrence`);
      }
    }
    const passageLocator = point?.pediatric_cds?.threshold?.passage_locator;
    if (typeof passageLocator === 'string' && passageLocator !== '') {
      const expected = buildPlaceholder(passageLocator);
      if (!redactedText.includes(expected)) {
        throw new FixtureGenerationError(`${fileName}#${point.evidence_id}: expected redaction placeholder for "threshold.passage_locator" not found in redacted output — the line-level scanner may not have processed this occurrence`);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Bundle discovery + fixture assembly
// ---------------------------------------------------------------------------------------------

function compareCodepoints(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

async function readRequiredFile(resolvedPath, label) {
  let info;
  try {
    info = await stat(resolvedPath);
  } catch (err) {
    if (err.code === 'ENOENT') throw new FixtureGenerationError(`missing required artifact "${label}" — expected at ${resolvedPath}`);
    throw err;
  }
  if (!info.isFile()) throw new FixtureGenerationError(`expected "${label}" to be a file at ${resolvedPath}`);
  return readFile(resolvedPath, 'utf8');
}

/** Resolves `relPath` against `runDir`, rejecting anything that would escape it (mirrors
 * `tools/rf-bundle-to-kb-pack/lib/loader.mjs`'s own `resolveInBounds`) — this generator never
 * follows an `evidence_bundle.yaml.artifacts` entry outside the run directory it was told to
 * read. */
function resolveInBounds(runDir, label, relPath) {
  const resolved = path.resolve(runDir, relPath);
  const relative = path.relative(runDir, resolved);
  if (relative !== '' && (relative.startsWith('..') || path.isAbsolute(relative))) {
    throw new FixtureGenerationError(`artifact "${label}" path "${relPath}" resolves outside the run directory (${runDir})`);
  }
  return resolved;
}

/**
 * Reads `runDir` (a live or mirrored `rf` run directory) and returns the complete fixture tree
 * this generator would emit for `slug`, as a Map of fixture-relative path -> file contents
 * (string). Performs no filesystem writes — callers decide whether/where to write, which is what
 * lets `--check` regenerate in memory and diff against already-committed files without touching
 * disk, and lets a caller run this twice back-to-back to prove determinism.
 *
 * @param {{ runDir: string }} options
 * @returns {Promise<{ files: Map<string,string>, runId: string, sourceCardCount: number, extractedPointCount: number }>}
 */
export async function generateFixture({ runDir }) {
  if (typeof runDir !== 'string' || runDir === '') {
    throw new FixtureGenerationError('generateFixture requires a non-empty "runDir"');
  }
  const resolvedRunDir = path.resolve(runDir);
  const runDirInfo = await stat(resolvedRunDir).catch(() => null);
  if (!runDirInfo || !runDirInfo.isDirectory()) {
    throw new FixtureGenerationError(`--run-dir does not exist or is not a directory: ${resolvedRunDir}`);
  }

  const bundlePath = path.join(resolvedRunDir, 'evidence_bundle.yaml');
  const bundleRaw = await readRequiredFile(bundlePath, 'evidence_bundle.yaml');
  let bundleParsed;
  try {
    bundleParsed = parseYamlDocument(bundleRaw);
  } catch (err) {
    if (err instanceof YamlParseError) throw new FixtureGenerationError(`evidence_bundle.yaml: ${err.message}`);
    throw err;
  }
  assertNeverCarriesExcerptField(bundleRaw, 'evidence_bundle.yaml');

  const artifacts = bundleParsed?.artifacts;
  if (artifacts === null || typeof artifacts !== 'object' || Array.isArray(artifacts)) {
    throw new FixtureGenerationError('evidence_bundle.yaml is missing an "artifacts" map');
  }
  const requiredKeys = [...SINGLE_FILE_ARTIFACTS.map((a) => a.key), 'source_cards_dir', 'extraction_cards_dir'];
  const missingKeys = requiredKeys.filter((key) => typeof artifacts[key] !== 'string' || artifacts[key] === '');
  if (missingKeys.length > 0) {
    throw new FixtureGenerationError(`evidence_bundle.yaml.artifacts is missing (or has an empty) entry for: ${missingKeys.join(', ')}`);
  }

  const runId = typeof bundleParsed.run_id === 'string' && bundleParsed.run_id !== '' ? bundleParsed.run_id : null;
  if (!runId) throw new FixtureGenerationError('evidence_bundle.yaml is missing a non-empty "run_id"');

  const files = new Map();
  files.set('evidence_bundle.yaml', bundleRaw);

  // Single-file artifacts: copied byte-for-byte, guard-scanned for a construct this generator
  // does not know how to redact.
  for (const { key, kind } of SINGLE_FILE_ARTIFACTS) {
    const relPath = artifacts[key];
    const resolvedPath = resolveInBounds(resolvedRunDir, key, relPath);
    const raw = await readRequiredFile(resolvedPath, key);
    if (kind === 'yaml') {
      try {
        parseYamlDocument(raw);
      } catch (err) {
        if (err instanceof YamlParseError) throw new FixtureGenerationError(`${relPath}: ${err.message}`);
        throw err;
      }
    }
    assertNeverCarriesExcerptField(raw, relPath);
    files.set(relPath, raw);
  }

  // Source cards.
  const sourceCardsRel = artifacts.source_cards_dir;
  const sourceCardsDir = resolveInBounds(resolvedRunDir, 'source_cards_dir', sourceCardsRel);
  const sourceCardsDirInfo = await stat(sourceCardsDir).catch(() => null);
  if (!sourceCardsDirInfo || !sourceCardsDirInfo.isDirectory()) {
    throw new FixtureGenerationError(`source_cards_dir does not exist or is not a directory: ${sourceCardsDir}`);
  }
  const sourceCardNames = (await readdir(sourceCardsDir))
    .filter((name) => name.startsWith('src_') && name.endsWith('.md'))
    .sort(compareCodepoints);
  if (sourceCardNames.length === 0) {
    throw new FixtureGenerationError(`no source cards (src_*.md) found in ${sourceCardsDir}`);
  }

  const seenCardIds = new Set();
  let extractedPointCount = 0;
  for (const name of sourceCardNames) {
    const cardPath = path.join(sourceCardsDir, name);
    const raw = await readFile(cardPath, 'utf8');
    let frontmatter;
    try {
      ({ frontmatter } = parseYamlFrontmatter(raw));
    } catch (err) {
      if (err instanceof YamlParseError) throw new FixtureGenerationError(`${name}: ${err.message}`);
      throw err;
    }
    const { restricted, points } = validateSourceCard(frontmatter, name, seenCardIds);
    extractedPointCount += points.length;
    const redacted = redactText(raw, restricted, name);
    if (restricted) assertKnownExcerptsRedacted(redacted, points, name);
    files.set(path.posix.join(sourceCardsRel.replace(/\/?$/, ''), name), redacted);
  }

  // Extraction cards: copied byte-for-byte, guard-scanned like the other non-source artifacts.
  const extractionCardsRel = artifacts.extraction_cards_dir;
  const extractionCardsDir = resolveInBounds(resolvedRunDir, 'extraction_cards_dir', extractionCardsRel);
  const extractionCardsDirInfo = await stat(extractionCardsDir).catch(() => null);
  if (!extractionCardsDirInfo || !extractionCardsDirInfo.isDirectory()) {
    throw new FixtureGenerationError(`extraction_cards_dir does not exist or is not a directory: ${extractionCardsDir}`);
  }
  const extractionCardNames = (await readdir(extractionCardsDir))
    .filter((name) => name.startsWith('ext_') && name.endsWith('.yaml'))
    .sort(compareCodepoints);
  if (extractionCardNames.length === 0) {
    throw new FixtureGenerationError(`no extraction cards (ext_*.yaml) found in ${extractionCardsDir}`);
  }
  for (const name of extractionCardNames) {
    const cardPath = path.join(extractionCardsDir, name);
    const raw = await readFile(cardPath, 'utf8');
    try {
      parseYamlDocument(raw);
    } catch (err) {
      if (err instanceof YamlParseError) throw new FixtureGenerationError(`${name}: ${err.message}`);
      throw err;
    }
    assertNeverCarriesExcerptField(raw, name);
    files.set(path.posix.join(extractionCardsRel.replace(/\/?$/, ''), name), raw);
  }

  return {
    files,
    runId,
    sourceCardCount: sourceCardNames.length,
    extractionCardCount: extractionCardNames.length,
    extractedPointCount,
  };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { runDir: null, slug: null, outDir: null, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--run-dir') out.runDir = argv[(i += 1)];
    else if (arg.startsWith('--run-dir=')) out.runDir = arg.slice('--run-dir='.length);
    else if (arg === '--slug') out.slug = argv[(i += 1)];
    else if (arg.startsWith('--slug=')) out.slug = arg.slice('--slug='.length);
    else if (arg === '--out-dir') out.outDir = argv[(i += 1)];
    else if (arg.startsWith('--out-dir=')) out.outDir = arg.slice('--out-dir='.length);
    else if (arg === '--check') out.check = true;
    else throw new FixtureGenerationError(`unknown argument: ${arg}`);
  }
  if (!out.runDir) throw new FixtureGenerationError('--run-dir is required');
  if (!out.slug || !/^[a-z0-9][a-z0-9-]*$/.test(out.slug)) {
    throw new FixtureGenerationError('--slug is required and must match /^[a-z0-9][a-z0-9-]*$/ (e.g. "ev-001")');
  }
  return out;
}

function firstDiffLines(a, b, contextLines = 3, maxHunks = 3) {
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
      if (aLines[k] === bLines[k]) chunk.push(`  ${k + 1}: ${aLines[k] ?? ''}`);
      else {
        if (aLines[k] !== undefined) chunk.push(`- ${k + 1}: ${aLines[k]}`);
        if (bLines[k] !== undefined) chunk.push(`+ ${k + 1}: ${bLines[k]}`);
      }
    }
    diffs.push(chunk.join('\n'));
    i = j;
  }
  return diffs.join('\n---\n');
}

async function main() {
  const { runDir, slug, outDir, check } = parseArgs(process.argv.slice(2));
  const resolvedOutDir = path.resolve(outDir ?? path.join(REPO_ROOT, 'tests', 'fixtures', `rf-${slug}`));
  const relFromRoot = path.relative(REPO_ROOT, resolvedOutDir);
  if (relFromRoot === '' || relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
    throw new FixtureGenerationError(`refusing to write outside the repository: ${resolvedOutDir}`);
  }

  const { files, runId, sourceCardCount, extractionCardCount, extractedPointCount } = await generateFixture({ runDir });
  const sortedRelPaths = [...files.keys()].sort(compareCodepoints);

  if (check) {
    let allMatch = true;
    for (const relPath of sortedRelPaths) {
      const targetPath = path.join(resolvedOutDir, relPath);
      const next = files.get(relPath);
      let current;
      try {
        current = await readFile(targetPath, 'utf8');
      } catch (err) {
        if (err.code === 'ENOENT') {
          allMatch = false;
          console.error(`generate-rf-fixture --check: ${path.relative(REPO_ROOT, targetPath)} does not exist.`);
          continue;
        }
        throw err;
      }
      if (current === next) {
        console.log(`generate-rf-fixture --check: ${path.relative(REPO_ROOT, targetPath)} matches regenerated output.`);
        continue;
      }
      allMatch = false;
      console.error(`generate-rf-fixture --check: ${path.relative(REPO_ROOT, targetPath)} differs from regenerated output.`);
      const diff = firstDiffLines(current, next);
      console.error(diff ? `First differing hunks:\n${diff}` : '(no line-level diff produced; check byte lengths)');
    }
    if (!allMatch) process.exit(1);
    return;
  }

  await rm(resolvedOutDir, { recursive: true, force: true });
  for (const relPath of sortedRelPaths) {
    const targetPath = path.join(resolvedOutDir, relPath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, files.get(relPath), 'utf8');
  }

  console.log(
    `Generated fixture rf-${slug} (run ${runId}): ${sourceCardCount} source cards, ` +
      `${extractionCardCount} extraction cards, ${extractedPointCount} extracted points -> ` +
      `${path.relative(REPO_ROOT, resolvedOutDir)}/`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(`generate-rf-fixture: ${error.stack ?? error.message}`);
    process.exit(1);
  });
}
