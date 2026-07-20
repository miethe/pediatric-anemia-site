#!/usr/bin/env node
// vendor-rf-bundle.mjs — EP-3, D-EP3-5. Operator-run.
//
// Reads a live Research Foundry run directory (default: the RF-EV-001 bundle mirrored on this
// operator's laptop) and writes a *vendored, deterministic* input pack to
// `evidence-packs/rf-ev-001/pack.json`, plus a MANIFEST.json recording the run id and a sha256 of
// every upstream file consumed. `scripts/evidence/build-evidence-pack.mjs` — which IS CI-safe —
// reads only that vendored pack.
//
// Why two scripts (not one converter): the RF bundle lives outside this repo, so a converter that
// reads it directly cannot be re-run in CI and cannot prove byte-identical output. The vendor step
// is manual by design. See docs/project_plans/implementation_plans/infrastructure/
// wave0-safety-foundation-v1/ep3-passage-design.md D-EP3-5.
//
// This script never mints a passage record — that is build-evidence-pack.mjs's job.
//
// This script strips the verbatim `quote:` field from every extracted point. Per D-EP3-4, REG-002
// has not cleared verbatim reuse of AAP/AAFP guideline text; the WHO card itself declares
// `allowed_for_public_output: false`. The pack MUST NOT carry those strings, so the rights question
// cannot be re-opened by accident downstream.
//
// EP3-T5: this script also reads evidence-packs/rf-ev-001/fidelity-findings.json (an independent
// cross-family audit, mechanically applied — see that file's header comment) and withholds the
// `summary` text of every passage the audit flagged `near-verbatim-span-pending-rights` (finding
// EP3T5-F01), replacing it with the file's fixed `withholdPlaceholder` string BEFORE it ever
// reaches pack.json. That flag means the RF bundle's own `summary` field, despite being described
// as a paraphrase, shares an 8-13-word contiguous span with rights-restricted source text. The
// withholding happens here, not in build-evidence-pack.mjs, so the restricted text never sits in
// any committed file, vendored or built.
//
// This file also hand-rolls a small YAML-subset parser for the specific frontmatter shape the RF
// source cards actually use. Adding a `yaml` dependency to a zero-dependency repo for the sake of
// six files would change the supply-chain posture for no gain the pinned schema does not already
// give us; the parser fails closed on any construct it does not recognize.

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_BUNDLE = '/Users/miethe/dev/homelab/development/research-foundry/runs/rf_run_20260717_rf_ev_001_pediatric_cds_backfill';
const PACK_DIR = path.join(REPO_ROOT, 'evidence-packs', 'rf-ev-001');
const FIDELITY_FINDINGS_PATH = path.join(PACK_DIR, 'fidelity-findings.json');

// D-EP3-5: this 1:1 mapping is asserted in the vendor script (not inferred at build time). Any
// unmatched card or unmatched KB id fails loudly, non-zero exit, named ids. Order matches the
// design record's table so the emitted pack ordering is stable and reviewable at a glance.
const SOURCE_CARD_TO_KB_ID = new Map([
  ['src_20260718_rfev001_00', 'AAP2026_IDA'],
  ['src_20260718_rfev001_01', 'WHO2024_HB'],
  ['src_20260718_rfev001_02', 'BLOOD2022_PED_ANEMIA'],
  ['src_20260718_rfev001_03', 'CDC2025_LEAD'],
  ['src_20260718_rfev001_04', 'FDA2026_CDS'],
  ['src_20260718_rfev001_05', 'BSH2020_G6PD'],
]);

// A minimal, deliberate per-source surveillance query. Not derivable from any single extracted
// point — it is a source-level standing question ("has this guideline been superseded?"), the
// converter's responsibility to assert. Every value below is the plain question the design record
// example illustrates ("WHO haemoglobin cutoffs anaemia guideline update after 2024"), specialised
// per source.
const SURVEILLANCE_QUERY_BY_KB_ID = new Map([
  ['AAP2026_IDA', 'AAP iron deficiency and iron deficiency anemia clinical report update after 2026'],
  ['WHO2024_HB', 'WHO haemoglobin cutoffs anaemia guideline update after 2024'],
  ['BLOOD2022_PED_ANEMIA', 'Anemia in the pediatric patient (Blood 2022) update or successor review after 2022'],
  ['CDC2025_LEAD', 'CDC blood lead reference value and recommended actions update after 2025-08-21'],
  ['FDA2026_CDS', 'FDA Clinical Decision Support Software final guidance update after 2026-01-29'],
  ['BSH2020_G6PD', 'BSH laboratory diagnosis of G6PD deficiency guideline update after 2020'],
]);

// ----- YAML-subset parser -------------------------------------------------------------------

// The RF cards use YAML 1.2 but only a small subset: block mappings, block lists,
// double- and single-quoted scalars, plain scalars, and single-line flow mappings/lists. This
// parser handles exactly that subset. Any other construct — folded/literal scalars, anchors,
// aliases, multi-line flow, tags, `>`/`|` — raises rather than silently guessing. That fail-closed
// stance matches scripts/lib/json-schema-lite.mjs's own posture: silently ignoring an unknown YAML
// construct in a clinical-passage locator would be exactly the class of bug this codebase's
// guardrails exist to prevent.

function parseYamlFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error('YAML frontmatter delimiter (---) not found');
  const lines = match[1].split(/\r?\n/);
  const [value, nextLine] = parseBlockAt(lines, 0, 0);
  // Consume trailing blank lines only; anything else is a parser bug or unexpected content.
  for (let i = nextLine; i < lines.length; i++) {
    if (lines[i].trim() !== '' && !lines[i].trim().startsWith('#')) {
      throw new Error(`unexpected trailing content in frontmatter at line ${i + 1}: ${lines[i]}`);
    }
  }
  return value;
}

function skipBlankLines(lines, i) {
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed.startsWith('#')) i++;
    else break;
  }
  return i;
}

function indentOf(line) {
  return line.match(/^ */)[0].length;
}

function readOptionalChildBlock(lines, startLine, parentIndent) {
  // A "child block" of a key:value pair whose value line is empty. The child may be:
  //   - A nested block mapping — indented strictly more than the parent (indent > parentIndent).
  //   - A nested block list — its dash may sit at the same indent as the parent key.
  //   - Absent entirely (null) — the next line is at parentIndent or less, meaning our key had
  //     a genuinely null value and the following line is the parent's next sibling key.
  const first = skipBlankLines(lines, startLine);
  if (first >= lines.length) return [null, first];
  const line = lines[first];
  const indent = indentOf(line);
  const body = line.slice(indent);
  if (indent < parentIndent) return [null, startLine];
  if (body.startsWith('- ') || body === '-') {
    // Same-indent or deeper list is legal; we require indent >= parentIndent (already checked).
    return parseBlockList(lines, first, indent);
  }
  if (indent > parentIndent) {
    return parseBlockMapping(lines, first, indent);
  }
  // Same indent and not a list dash → this is our sibling, not our child.
  return [null, startLine];
}

function parseBlockAt(lines, startLine, minIndent) {
  const first = skipBlankLines(lines, startLine);
  if (first >= lines.length) return [null, first];
  const line = lines[first];
  const indent = indentOf(line);
  if (indent < minIndent) return [null, startLine];
  const rest = line.slice(indent);
  if (rest.startsWith('- ') || rest === '-') return parseBlockList(lines, first, indent);
  return parseBlockMapping(lines, first, indent);
}

function parseBlockMapping(lines, startLine, indent) {
  const obj = {};
  let i = startLine;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) { i++; continue; }
    const currentIndent = indentOf(raw);
    if (currentIndent < indent) break;
    if (currentIndent > indent) throw new Error(`unexpected indent at line ${i + 1}: expected ${indent}, got ${currentIndent}`);
    const body = raw.slice(indent);
    if (body.startsWith('- ') || body === '-') break;
    const colonMatch = body.match(/^([A-Za-z_][\w\-]*)\s*:(?:[ \t]+(.*))?$/);
    if (!colonMatch) throw new Error(`expected "key: value" at line ${i + 1}: ${raw}`);
    const key = colonMatch[1];
    const valueText = colonMatch[2];
    if (valueText === undefined || valueText === '') {
      // Peek the next non-empty line to decide whether an actual child block follows: a nested
      // block mapping requires strictly greater indent; a nested block list may sit at the same
      // indent as its parent key (the YAML rule the RF cards use for `extracted_points:`).
      const [child, nextI] = readOptionalChildBlock(lines, i + 1, indent);
      obj[key] = child;
      i = nextI;
    } else {
      const parsed = parseInlineValue(valueText, 0);
      const trailing = valueText.slice(parsed.next).replace(/\s*(#.*)?$/, '');
      if (trailing !== '') throw new Error(`trailing content after value at line ${i + 1}: ${JSON.stringify(trailing)}`);
      obj[key] = parsed.value;
      i++;
    }
  }
  return [obj, i];
}

function parseBlockList(lines, startLine, indent) {
  const arr = [];
  let i = startLine;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) { i++; continue; }
    const currentIndent = indentOf(raw);
    if (currentIndent < indent) break;
    if (currentIndent > indent) throw new Error(`unexpected indent inside list at line ${i + 1}`);
    const body = raw.slice(indent);
    if (!(body.startsWith('- ') || body === '-')) break;
    // The dash occupies two columns; keys inside a mapping item align at indent+2.
    const afterDash = body.slice(2);
    const kvMatch = afterDash.match(/^([A-Za-z_][\w\-]*)\s*:(?:[ \t]+(.*))?$/);
    if (kvMatch) {
      const item = {};
      const key = kvMatch[1];
      const valueText = kvMatch[2];
      if (valueText === undefined || valueText === '') {
        const [child, nextI] = readOptionalChildBlock(lines, i + 1, indent + 2);
        item[key] = child;
        i = nextI;
      } else {
        const parsed = parseInlineValue(valueText, 0);
        const trailing = valueText.slice(parsed.next).replace(/\s*(#.*)?$/, '');
        if (trailing !== '') throw new Error(`trailing content after list item value at line ${i + 1}`);
        item[key] = parsed.value;
        i++;
      }
      // Now consume subsequent lines at indent+2 as further keys of this same item.
      while (i < lines.length) {
        const l = lines[i];
        const t = l.trim();
        if (t === '' || t.startsWith('#')) { i++; continue; }
        const ci = indentOf(l);
        if (ci < indent + 2) break;
        if (ci > indent + 2) throw new Error(`unexpected indent inside list item at line ${i + 1}`);
        const b = l.slice(indent + 2);
        if (b.startsWith('- ') || b === '-') throw new Error(`unexpected list item inside mapping at line ${i + 1}`);
        const km = b.match(/^([A-Za-z_][\w\-]*)\s*:(?:[ \t]+(.*))?$/);
        if (!km) throw new Error(`expected "key: value" at line ${i + 1}: ${l}`);
        const k = km[1];
        const vt = km[2];
        if (vt === undefined || vt === '') {
          const [child, nextI] = readOptionalChildBlock(lines, i + 1, indent + 2);
          item[k] = child;
          i = nextI;
        } else {
          const parsed = parseInlineValue(vt, 0);
          const trailing = vt.slice(parsed.next).replace(/\s*(#.*)?$/, '');
          if (trailing !== '') throw new Error(`trailing content after value at line ${i + 1}`);
          item[k] = parsed.value;
          i++;
        }
      }
      arr.push(item);
    } else {
      // Scalar list item: `- <scalar>`
      const parsed = parseInlineValue(afterDash, 0);
      const trailing = afterDash.slice(parsed.next).replace(/\s*(#.*)?$/, '');
      if (trailing !== '') throw new Error(`trailing content after list scalar at line ${i + 1}`);
      arr.push(parsed.value);
      i++;
    }
  }
  return [arr, i];
}

function parseInlineValue(s, start) {
  let i = start;
  while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
  if (i >= s.length) return { value: null, next: i };
  const c = s[i];
  if (c === '"') return parseDoubleQuoted(s, i);
  if (c === "'") return parseSingleQuoted(s, i);
  if (c === '{') return parseFlowMapping(s, i);
  if (c === '[') return parseFlowList(s, i);
  return parsePlainScalar(s, i);
}

function parseDoubleQuoted(s, start) {
  if (s[start] !== '"') throw new Error('parseDoubleQuoted: expected "');
  let i = start + 1;
  let out = '';
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\') {
      const next = s[i + 1];
      if (next === '"') { out += '"'; i += 2; continue; }
      if (next === '\\') { out += '\\'; i += 2; continue; }
      if (next === 'n') { out += '\n'; i += 2; continue; }
      if (next === 't') { out += '\t'; i += 2; continue; }
      if (next === '/') { out += '/'; i += 2; continue; }
      throw new Error(`unsupported escape \\${next} in double-quoted string at position ${i}`);
    }
    if (ch === '"') return { value: out, next: i + 1 };
    out += ch;
    i++;
  }
  throw new Error('unterminated double-quoted string');
}

function parseSingleQuoted(s, start) {
  if (s[start] !== "'") throw new Error("parseSingleQuoted: expected '");
  let i = start + 1;
  let out = '';
  while (i < s.length) {
    const ch = s[i];
    if (ch === "'") {
      if (s[i + 1] === "'") { out += "'"; i += 2; continue; }
      return { value: out, next: i + 1 };
    }
    out += ch;
    i++;
  }
  throw new Error('unterminated single-quoted string');
}

function parsePlainScalar(s, start) {
  let i = start;
  while (i < s.length && s[i] !== ',' && s[i] !== '}' && s[i] !== ']') i++;
  const raw = s.slice(start, i).trimEnd();
  return { value: interpretPlain(raw), next: start + raw.length + (s.slice(start).length - raw.length - (s.length - i)) };
}

function interpretPlain(raw) {
  if (raw === '' || raw === 'null' || raw === '~') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+$/.test(raw)) return Number.parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return Number.parseFloat(raw);
  return raw;
}

function parseFlowMapping(s, start) {
  if (s[start] !== '{') throw new Error('parseFlowMapping: expected {');
  let i = start + 1;
  const obj = {};
  while (i < s.length) {
    while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
    if (s[i] === '}') return { value: obj, next: i + 1 };
    const keyResult = parseFlowKey(s, i);
    i = keyResult.next;
    while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
    if (s[i] !== ':') throw new Error(`expected ':' in flow mapping at position ${i}: ${s.slice(i, i + 20)}`);
    i++;
    while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
    const valueResult = parseInlineValue(s, i);
    obj[keyResult.value] = valueResult.value;
    i = valueResult.next;
    while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
    if (s[i] === ',') { i++; continue; }
    if (s[i] === '}') return { value: obj, next: i + 1 };
    throw new Error(`expected ',' or '}' in flow mapping at position ${i}`);
  }
  throw new Error('unterminated flow mapping');
}

function parseFlowKey(s, start) {
  if (s[start] === '"') return parseDoubleQuoted(s, start);
  if (s[start] === "'") return parseSingleQuoted(s, start);
  let i = start;
  while (i < s.length && /[A-Za-z0-9_\-]/.test(s[i])) i++;
  if (i === start) throw new Error(`expected flow-mapping key at position ${start}: ${s.slice(start, start + 20)}`);
  return { value: s.slice(start, i), next: i };
}

function parseFlowList(s, start) {
  if (s[start] !== '[') throw new Error('parseFlowList: expected [');
  let i = start + 1;
  const arr = [];
  while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
  if (s[i] === ']') return { value: arr, next: i + 1 };
  while (i < s.length) {
    const valueResult = parseInlineValue(s, i);
    arr.push(valueResult.value);
    i = valueResult.next;
    while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
    if (s[i] === ',') { i++; while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++; continue; }
    if (s[i] === ']') return { value: arr, next: i + 1 };
    throw new Error(`expected ',' or ']' in flow list at position ${i}`);
  }
  throw new Error('unterminated flow list');
}

// ----- Locator parsing ----------------------------------------------------------------------

// Documented per D-EP3 field map: page/section/table/figure parsed from the free-text `locator`
// by these regexes; anything unparsed is null. `raw` always preserves the source text so nothing
// is lost.

const PAGE_RE_ROMAN_ARABIC = /\bpp?\.\s*([xvi]+(?:[-–][xvi]+)?|\d+(?:[-–]\d+)?)/i;
const PAGE_RE_WORD = /(?:^|[,;\s(])Page\s+(\d+)\b/;
const TABLE_RE = /\b(Table\s+[IVXivx\d]+[a-z]?)/;
const FIGURE_RE = /\b(Figure\s+\d+)/;
// Section forms actually seen: `Section 'X'`, `Section IV(3)`, `Section 1 (What ...)`,
// `Section II (Background)`, `Page N, 'X'`. Ordered here from most specific → most permissive.
// The `(?=[\s,;)]|$)` lookahead on the quoted variants rejects a match whose closing quote is
// followed by another word character — that guards against locators like `Section 'If the
// patient's BLL is ...'` where an embedded apostrophe would otherwise make `[^']+` stop early
// and capture a truncated section name. Design record: "unparsed → null" is the correct fallback.
const SECTION_RE_QUOTED_SINGLE = /Section\s+'([^']+)'(?=[\s,;)]|$)/;
const SECTION_RE_PAGE_QUOTED = /Page\s+\d+,\s*'([^']+)'(?=[\s,;)]|$)/;
const SECTION_RE_ROMAN = /\bSection\s+([IVX]+(?:\s*\([^)]+\))*)/;
const SECTION_RE_NUMBERED = /\bSection\s+(\d+)\s*\(([^)]+)\)/;

function parseLocator(raw) {
  const roman = raw.match(PAGE_RE_ROMAN_ARABIC);
  const word = raw.match(PAGE_RE_WORD);
  const page = roman ? roman[1] : (word ? word[1] : null);
  const table = raw.match(TABLE_RE)?.[1] ?? null;
  const figure = raw.match(FIGURE_RE)?.[1] ?? null;
  let section = null;
  const qs = raw.match(SECTION_RE_QUOTED_SINGLE);
  if (qs) section = qs[1];
  else {
    const pq = raw.match(SECTION_RE_PAGE_QUOTED);
    if (pq) section = pq[1];
    else {
      const nm = raw.match(SECTION_RE_NUMBERED);
      if (nm) section = `${nm[1]} (${nm[2]})`;
      else {
        const rm = raw.match(SECTION_RE_ROMAN);
        if (rm) section = rm[1];
      }
    }
  }
  return { raw, page, section, table, figure };
}

// ----- Sex parsing --------------------------------------------------------------------------

// D-EP3 field map: `applicability.sex` parsed from `population` when it names a sex, else null.
// The RF cards say "both sexes", "male", "female", or say nothing about sex. We only assert a
// single sex when the source clearly does; the common "both sexes" case is recorded as null so a
// downstream reader cannot confuse breadth for absence.

function parseSexFromPopulation(population) {
  if (population === null || typeof population !== 'string') return null;
  const lower = population.toLowerCase();
  // "hemizygous males" (BSH G6PD Table I) — an explicit single-sex population.
  if (/hemizygous males\b/.test(lower)) return 'male';
  // "menstruating individuals" / "menstruating patients" — a female-restricted population.
  if (/menstruating (individuals|patients)/.test(lower)) return 'female';
  // We deliberately do NOT infer sex from the mere co-occurrence of "male"/"female" — most points
  // that mention both name age bands stratified by sex, which is not a sex restriction.
  return null;
}

// ----- EP3-T5 withholding ---------------------------------------------------------------------

// Reads evidence-packs/rf-ev-001/fidelity-findings.json and returns the fixed placeholder string
// plus the set of "<kbSourceId>#<evidence_id>" passage ids the audit flagged
// `near-verbatim-span-pending-rights` (EP3T5-F01). This is the ONLY finding this script acts on —
// every other flag only suppresses a downstream binding decision (build-evidence-pack.mjs /
// src/evidence.js#isBindableAsSourceSupported), it does not change what text gets vendored.
async function loadWithholdSpec(findingsPath) {
  const findings = JSON.parse(await readFile(findingsPath, 'utf8'));
  const withholdPlaceholder = findings.withholdPlaceholder;
  if (typeof withholdPlaceholder !== 'string' || withholdPlaceholder === '') {
    throw new Error(`${findingsPath}: missing or empty withholdPlaceholder`);
  }
  const withheldPassageIds = new Set();
  for (const finding of findings.findings ?? []) {
    if (finding.flag !== 'near-verbatim-span-pending-rights') continue;
    for (const passageId of finding.passageIds ?? []) withheldPassageIds.add(passageId);
  }
  if (withheldPassageIds.size === 0) {
    throw new Error(`${findingsPath}: no passageIds found for flag "near-verbatim-span-pending-rights"`);
  }
  return { withholdPlaceholder, withheldPassageIds };
}

// ----- IO helpers ---------------------------------------------------------------------------

async function sha256Hex(filePath) {
  const buf = await readFile(filePath);
  return `sha256:${createHash('sha256').update(buf).digest('hex')}`;
}

async function readTrackedFile(filePath, tracker) {
  const digest = await sha256Hex(filePath);
  tracker.push({ path: path.relative(REPO_ROOT_OR_BUNDLE.bundle, filePath), sha256: digest });
  return await readFile(filePath, 'utf8');
}

// A shared holder so readTrackedFile can produce bundle-relative paths without threading a
// context object through every helper.
const REPO_ROOT_OR_BUNDLE = { bundle: null };

// ----- Main --------------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { bundle: DEFAULT_BUNDLE };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--bundle') {
      out.bundle = argv[++i];
    } else if (argv[i].startsWith('--bundle=')) {
      out.bundle = argv[i].slice('--bundle='.length);
    } else {
      throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  if (!out.bundle) throw new Error('--bundle is required');
  return out;
}

async function main() {
  const { bundle } = parseArgs(process.argv.slice(2));
  REPO_ROOT_OR_BUNDLE.bundle = bundle;
  const upstreamFiles = [];
  const { withholdPlaceholder, withheldPassageIds } = await loadWithholdSpec(FIDELITY_FINDINGS_PATH);
  const matchedWithheldIds = new Set();

  // Read run.json for the run id — we don't guess it from the directory name.
  const runJsonPath = path.join(bundle, 'run.json');
  const runJsonText = await readTrackedFile(runJsonPath, upstreamFiles);
  const runJson = JSON.parse(runJsonText);
  const runId = runJson.run_id;
  if (!runId) throw new Error(`run.json missing run_id at ${runJsonPath}`);

  // Discover source cards. Order: by filename ascending, which gives us the src_..._00 → 05
  // sequence and matches the design record's mapping table order.
  const sourcesDir = path.join(bundle, 'sources');
  const entries = (await readdir(sourcesDir)).filter((n) => n.endsWith('.md')).sort();
  if (entries.length !== SOURCE_CARD_TO_KB_ID.size) {
    throw new Error(`expected ${SOURCE_CARD_TO_KB_ID.size} source cards in ${sourcesDir}, found ${entries.length}: ${entries.join(', ')}`);
  }

  const packSources = [];
  const seenCardIds = new Set();
  const cardReviewDates = new Set();
  for (const filename of entries) {
    const filePath = path.join(sourcesDir, filename);
    const text = await readTrackedFile(filePath, upstreamFiles);
    const frontmatter = parseYamlFrontmatter(text);

    const cardId = frontmatter.source_card_id;
    if (typeof cardId !== 'string' || cardId === '') {
      throw new Error(`source_card_id missing in ${filename}`);
    }
    if (seenCardIds.has(cardId)) throw new Error(`duplicate source_card_id "${cardId}"`);
    seenCardIds.add(cardId);

    if (typeof frontmatter.created_at !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(frontmatter.created_at)) {
      throw new Error(`created_at missing or malformed in ${filename}`);
    }
    cardReviewDates.add(frontmatter.created_at.slice(0, 10));

    const kbSourceId = SOURCE_CARD_TO_KB_ID.get(cardId);
    if (!kbSourceId) {
      throw new Error(
        `no KB source id mapped for source_card_id "${cardId}" in ${filename}; expected one of: ${[...SOURCE_CARD_TO_KB_ID.keys()].join(', ')}`,
      );
    }

    const surveillanceQuery = SURVEILLANCE_QUERY_BY_KB_ID.get(kbSourceId);
    if (!surveillanceQuery) throw new Error(`no surveillance query configured for KB source "${kbSourceId}"`);

    const points = frontmatter.extracted_points ?? [];
    if (!Array.isArray(points) || points.length === 0) {
      throw new Error(`no extracted_points in ${filename}`);
    }

    const packPassages = [];
    for (const point of points) {
      if (typeof point.evidence_id !== 'string' || !/^ev_\d{3}$/.test(point.evidence_id)) {
        throw new Error(`bad evidence_id in ${filename}: ${JSON.stringify(point.evidence_id)}`);
      }
      if (typeof point.locator !== 'string' || point.locator.trim() === '') {
        throw new Error(`missing locator on ${cardId}#${point.evidence_id}`);
      }
      if (typeof point.summary !== 'string' || point.summary.trim() === '') {
        throw new Error(`missing summary on ${cardId}#${point.evidence_id}`);
      }

      const ped = point.pediatric_cds ?? {};
      const classificationRaw = ped.classification;
      if (typeof classificationRaw !== 'string' || classificationRaw === '') {
        throw new Error(`missing pediatric_cds.classification on ${cardId}#${point.evidence_id}`);
      }
      // D-EP3 field map: `source_supported_fact` → source-supported / source-supported-fact.
      // Anything else drops the point to a proposal sentinel — but the vendor script does not
      // mint sentinels; that is build-evidence-pack.mjs's job. Here we just record the mapped
      // classification and let the build step decide.
      const status = classificationRaw === 'source_supported_fact' ? 'source-supported' : 'implementation-proposal';
      const evidenceGrade = classificationRaw === 'source_supported_fact' ? 'source-supported-fact' : classificationRaw.replace(/_/g, '-');

      const applicability = {
        age: typeof ped.population === 'string' && ped.population !== '' ? ped.population : null,
        sex: parseSexFromPopulation(ped.population),
        assay: typeof ped.assay_method === 'string' && ped.assay_method !== '' ? ped.assay_method : null,
      };

      const lifecycle = ped.lifecycle ?? {};
      const supersedes = typeof lifecycle.supersedes === 'string' && lifecycle.supersedes !== '' ? lifecycle.supersedes : null;

      // EP3-T5 (EP3T5-F01): withhold at vendor time, before this summary ever reaches pack.json.
      const passageId = `${kbSourceId}#${point.evidence_id}`;
      const isWithheld = withheldPassageIds.has(passageId);
      if (isWithheld) matchedWithheldIds.add(passageId);
      const summary = isWithheld ? withholdPlaceholder : point.summary;

      const passage = {
        // D-EP3-4: the passage record MUST NOT carry the verbatim `quote:` field. The pack does
        // not receive it either. This is enforced by construction here: we simply do not read
        // point.quote onto the output object.
        evidenceId: point.evidence_id,
        status,
        sourceLocator: parseLocator(point.locator),
        summary,
        evidenceGrade,
        applicability,
        supersedes,
      };
      packPassages.push(passage);
    }

    packSources.push({
      kbSourceId,
      sourceCardId: cardId,
      surveillanceQuery,
      passages: packPassages,
    });
  }

  // Confirm every KB id in the mapping was hit.
  const hitKbIds = new Set(packSources.map((s) => s.kbSourceId));
  for (const kbId of SOURCE_CARD_TO_KB_ID.values()) {
    if (!hitKbIds.has(kbId)) {
      throw new Error(`KB source id "${kbId}" not covered by any source card in ${sourcesDir}`);
    }
  }

  // EP3-T5: fail loudly (not silently) if fidelity-findings.json names a withheld passage id that
  // no source card actually produced — a stale/typo'd id in the findings file must not silently
  // leave restricted text un-withheld.
  if (matchedWithheldIds.size !== withheldPassageIds.size) {
    const unmatched = [...withheldPassageIds].filter((id) => !matchedWithheldIds.has(id));
    throw new Error(`fidelity-findings.json names withheld passage id(s) not produced by any source card: ${unmatched.join(', ')}`);
  }

  if (cardReviewDates.size !== 1) {
    throw new Error(`source cards report ${cardReviewDates.size} distinct created_at dates: ${[...cardReviewDates].sort().join(', ')}. The vendor script requires a single review date for the whole pack.`);
  }
  const reviewDate = [...cardReviewDates][0];

  // Deterministic pack.
  const pack = {
    schemaVersion: '1',
    runId,
    // Every passage inherits its record-level `reviewDate` from the pack, taken from the
    // RF source cards' shared `created_at` day.
    reviewDate,
    sources: packSources.map((source) => ({
      kbSourceId: source.kbSourceId,
      sourceCardId: source.sourceCardId,
      surveillanceQuery: source.surveillanceQuery,
      passages: source.passages.map((passage) => ({
        evidenceId: passage.evidenceId,
        status: passage.status,
        sourceLocator: {
          raw: passage.sourceLocator.raw,
          page: passage.sourceLocator.page,
          section: passage.sourceLocator.section,
          table: passage.sourceLocator.table,
          figure: passage.sourceLocator.figure,
        },
        summary: passage.summary,
        evidenceGrade: passage.evidenceGrade,
        applicability: {
          age: passage.applicability.age,
          sex: passage.applicability.sex,
          assay: passage.applicability.assay,
        },
        supersedes: passage.supersedes,
      })),
    })),
  };

  const manifest = {
    schemaVersion: '1',
    runId,
    bundlePath: bundle,
    upstreamFiles: upstreamFiles
      .slice()
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((entry) => ({ path: entry.path, sha256: entry.sha256 })),
  };

  await mkdir(PACK_DIR, { recursive: true });
  await writeFile(
    path.join(PACK_DIR, 'pack.json'),
    JSON.stringify(pack, null, 2) + '\n',
    'utf8',
  );
  await writeFile(
    path.join(PACK_DIR, 'MANIFEST.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );

  const totalPoints = pack.sources.reduce((n, s) => n + s.passages.length, 0);
  console.log(`Vendored RF-EV-001 pack: ${pack.sources.length} sources, ${totalPoints} extracted points → ${path.relative(REPO_ROOT, PACK_DIR)}/`);
}

main().catch((error) => {
  console.error(`vendor-rf-bundle: ${error.stack ?? error.message}`);
  process.exit(1);
});
