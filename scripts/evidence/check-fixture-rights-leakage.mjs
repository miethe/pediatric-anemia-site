#!/usr/bin/env node
// scripts/evidence/check-fixture-rights-leakage.mjs — P1-T7, multi-bundle-conversion-e1 Phase 1
// (Risk R-4 mitigation: "a restricted-rights verbatim passage gets committed to the public repo
// by accident — via a hand-edit, a bad merge, or a future fixture regeneration that forgets the
// rights-restricted default").
//
// This is a standing CI gate, not a one-time check: it re-verifies, on every `npm run validate`
// (and therefore every `npm run check`), that the 4 generator-produced fixture bundles this plan
// added (`tests/fixtures/rf-ev-001/`, `rf-cbc-002/`, `rf-kid-001/`, `rf-gro-002/` — an explicit,
// literal, enumerated list, never a glob/`readdir` over `tests/fixtures/`, matching this plan's
// R-7 anti-glob posture) still carry ONLY the ADR-0002 hash+selector-only redaction placeholder
// for every passage `generate-rf-fixture.mjs` (P1-T1) marked restricted — never the restored
// verbatim article text those source cards' `usage` blocks withhold.
//
// Two independent, hash-based checks (neither ever needs, stores, or prints the actual restricted
// plaintext — only ever a SHA-256 hash of it, both in the registry this gate builds and in any
// failure message it prints):
//
//   1. STRUCTURAL — every `quote:`/`passage_locator:` construct (the exact two labels the
//      generator recognizes and redacts, reusing its own `matchLabelAt`/`parseQuotedSpan`) found
//      anywhere in each fixture's own bundle-content files (i.e. every committed file EXCEPT that
//      fixture's own `HASH-PROVENANCE.md`, which is fixture-derivation *documentation*, not `rf`
//      bundle content, and legitimately contains illustrative `quote: "..."` snippets in prose)
//      must be EXACTLY the ADR-0002 placeholder (`[redacted — content-rights: restricted
//      (usage.allowed_for_public_output=false); sha256:<64-hex>]`) — never restored, paraphrased,
//      or partial plaintext. Every one of these 4 fixtures' own `HASH-PROVENANCE.md` documents
//      "0/N positively confirmed rights-clear" (checked below, §2), so this is a universal
//      invariant for all 4 fixtures today, not a per-card judgment call this gate has to make.
//
//   2. HASH-REGISTRY LEAK SCAN — every placeholder actually committed anywhere in these 4
//      fixtures already records, in plain sight, the SHA-256 hash of the exact original excerpt it
//      withholds. This gate collects that complete hash set (across all 4 fixtures — a superset of
//      "this fixture's own list," so a passage leaking into a *different* fixture than the one it
//      was redacted from is caught too) and decodes EVERY double-quoted span in EVERY committed
//      byte OUTSIDE each fixture's `sources/` directory (extraction cards, the claim ledger, the
//      report, the verification record, the research brief, `swarm_plan.yaml`,
//      `evidence_bundle.yaml`, the CCDash writeback event, and `HASH-PROVENANCE.md` itself),
//      hashing each and checking it against that registry. A match means the exact plaintext a
//      hash was recorded for has reappeared, verbatim, somewhere it is mechanically guaranteed to
//      never legitimately appear (the generator's own `assertNeverCarriesExcerptField` proves none
//      of these artifact kinds ever carries a `quote:`/`passage_locator:` construct, so ANY
//      hash-registry hit there is unambiguous). `sources/src_*.md` files are deliberately excluded
//      from this generic scan — not a coverage gap but a false-positive fix: those files legitimately
//      retain, untouched, a point's human-readable `locator` (and short categorical
//      `threshold.value` strings), which for a *short* excerpt (e.g. a section heading quoted as
//      its own locator) is byte-for-byte identical to the very passage that was redacted elsewhere
//      on the same card — `generate-rf-fixture.mjs`'s own `assertKnownExcerptsRedacted` doc
//      comment calls this out explicitly ("a negative 'not found anywhere' check would
//      false-positive on exactly that legitimate case"). Inside `sources/`, the STRUCTURAL check
//      above is this gate's mechanism instead: it inspects only the `quote:`/`passage_locator:`
//      label positions themselves (never the sibling `locator`/`value` fields), so restoring real
//      plaintext into the ONE field ADR-0002 requires to hold a placeholder is still caught,
//      format-based, with no false-positive risk.
//
// Cross-referenced against each fixture's own `HASH-PROVENANCE.md` (§3 below): this gate also
// parses §1's per-source-card disposition table and asserts every row is `restricted` (not
// silently reinterpreted as `clear` by a future edit) and that the corresponding source card file
// carries at least as many redaction placeholders as that row's declared passage count — a
// best-effort structural tie between the narrative provenance note and the committed bytes, not a
// brittle byte-for-byte prose parse (a parse failure here is reported as a warning, never a
// silent pass, but is not itself fatal — the two hash-based checks above are this gate's binding
// safety mechanism).
//
// Zero network calls. Reads only `git ls-files` (committed bytes, never untracked scratch files)
// and the fixture files themselves.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REDACTION_PREFIX, REDACTION_SUFFIX, matchLabelAt, parseQuotedSpan } from './generate-rf-fixture.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export class RightsLeakageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RightsLeakageError';
  }
}

// Explicit, literal, enumerated fixture list (P1-T7's binding scope) — deliberately never derived
// from a glob/`readdir` over `tests/fixtures/`. `rf-cbc-001` (the earlier, hand-authored exemplar
// from evidence-foundry-buildout-v1) is intentionally out of this list's scope; nothing prevents
// adding it later, but doing so is a deliberate edit to this array, never automatic.
export const FIXTURE_SLUGS = ['ev-001', 'cbc-002', 'kid-001', 'gro-002'];

const HASH_HEX_RE = /^[0-9a-f]{64}$/;
const PROVENANCE_FILE = 'HASH-PROVENANCE.md';

function sha256Hex(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

/** `git ls-files` scoped to `relDir` — "committed bytes" per this gate's own remit, never
 * untracked/scratch content that happens to be sitting in the working tree. Fails closed (throws)
 * rather than returning an empty list on a git-invocation error, so a broken `git` toolchain in CI
 * cannot be mistaken for "zero files, nothing to check." */
function gitLsFiles(relDir) {
  let out;
  try {
    out = execFileSync('git', ['ls-files', '--', relDir], { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (err) {
    throw new RightsLeakageError(`failed to list committed files under "${relDir}" via git ls-files: ${err.message}`);
  }
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Extracts every ADR-0002 placeholder's SHA-256 hash from raw file text via literal substring
 * scanning (never YAML parsing — mirrors the generator's own "operate on raw text" discipline).
 * Returns an array of lowercase hex strings (may contain duplicates if the same excerpt was
 * redacted more than once, e.g. the frontmatter/markdown-body mirror pair the generator itself
 * documents). */
export function extractPlaceholderHashes(text) {
  const hashes = [];
  let idx = text.indexOf(REDACTION_PREFIX);
  while (idx !== -1) {
    const hashStart = idx + REDACTION_PREFIX.length;
    const candidate = text.slice(hashStart, hashStart + 64);
    const afterHash = text.slice(hashStart + 64, hashStart + 64 + REDACTION_SUFFIX.length);
    if (HASH_HEX_RE.test(candidate) && afterHash === REDACTION_SUFFIX) {
      hashes.push(candidate);
    }
    idx = text.indexOf(REDACTION_PREFIX, idx + 1);
  }
  return hashes;
}

function isPlaceholderDecoded(decoded) {
  if (!decoded.startsWith(REDACTION_PREFIX) || !decoded.endsWith(REDACTION_SUFFIX)) return false;
  const hash = decoded.slice(REDACTION_PREFIX.length, decoded.length - REDACTION_SUFFIX.length);
  return HASH_HEX_RE.test(hash);
}

/** STRUCTURAL check (see file banner, item 1). Returns a list of violation records; never throws
 * directly so callers can aggregate every offending location across every file into one failure
 * report, instead of stopping at the first. */
export function findNonPlaceholderLabelValues(text, relPath) {
  const violations = [];
  const lines = text.split('\n');
  for (let li = 0; li < lines.length; li += 1) {
    const line = lines[li];
    for (let i = 0; i < line.length; i += 1) {
      const label = matchLabelAt(line, i);
      if (!label) continue;
      let j = label.afterColon;
      while (j < line.length && (line[j] === ' ' || line[j] === '\t')) j += 1;
      if (line[j] !== '"') {
        if (label.label === 'passage_locator' && line.startsWith('null', j)) continue;
        violations.push({ relPath, line: li + 1, label: label.label, reason: 'value is neither a quoted placeholder nor "null"' });
        continue;
      }
      let k = j;
      while (line[k] === '"') {
        let span;
        try {
          span = parseQuotedSpan(line, k, `${relPath}:${li + 1}`);
        } catch {
          violations.push({ relPath, line: li + 1, label: label.label, reason: 'malformed quoted value (does not parse as a well-formed quoted scalar)' });
          break;
        }
        if (!isPlaceholderDecoded(span.decoded)) {
          violations.push({
            relPath,
            line: li + 1,
            label: label.label,
            reason: `value is not the ADR-0002 redaction placeholder (sha256 of the offending value: ${sha256Hex(span.decoded)})`,
          });
        }
        k = span.next;
        if (line.startsWith('; ', k) && line[k + 2] === '"') {
          k += 2;
          continue;
        }
        break;
      }
    }
  }
  return violations;
}

// A bare `locator:` key (never `passage_locator:`, which the negative-lookbehind-equivalent
// `[^A-Za-z0-9_-]` guards against — the char immediately before "locator" in "passage_locator" is
// an identifier char, so it never matches this) is a second, file-location-independent legitimate
// exception to the hash-registry scan: extraction cards (`extractions/ext_*.yaml`, OUTSIDE
// `sources/`) carry their own `locator` field ("RF's own paraphrase... and `locator` (selector),
// never a quote/verbatim-excerpt field" — HASH-PROVENANCE.md §2) that may legitimately, and
// harmlessly, duplicate a short excerpt's plaintext byte-for-byte, exactly like the `sources/`
// case this scan already excludes wholesale.
const LOCATOR_KEY_RE = /(^|[^A-Za-z0-9_-])locator:\s*$/;

function isLocatorKeyValueAt(line, quoteStart) {
  return LOCATOR_KEY_RE.test(line.slice(0, quoteStart));
}

/** HASH-REGISTRY LEAK SCAN (see file banner, item 2). Decodes every double-quoted span anywhere
 * in `text`, regardless of field/label, and flags any whose SHA-256 is a member of `knownHashes`
 * — i.e. the exact plaintext a placeholder's hash already documents has reappeared verbatim.
 * Skips spans that are themselves the value of a bare `locator:` key (see `LOCATOR_KEY_RE` above)
 * — the one other legitimate, file-location-independent duplication case beyond `sources/` files
 * (which callers exclude from this scan entirely; see `checkFixtureFiles`). */
export function findHashRegistryLeaks(text, relPath, knownHashes) {
  const leaks = [];
  const lines = text.split('\n');
  for (let li = 0; li < lines.length; li += 1) {
    const line = lines[li];
    for (let i = 0; i < line.length; i += 1) {
      if (line[i] !== '"') continue;
      let span;
      try {
        span = parseQuotedSpan(line, i, `${relPath}:${li + 1}`);
      } catch {
        continue; // not a well-formed quoted span at this position — skip, don't fail the scan
      }
      const decoded = span.decoded;
      if (!decoded.startsWith(REDACTION_PREFIX) && !isLocatorKeyValueAt(line, i)) {
        const hash = sha256Hex(decoded);
        if (knownHashes.has(hash)) {
          leaks.push({ relPath, line: li + 1, hash });
        }
      }
      i = Math.max(i, span.next - 1); // resume scanning after this span, not inside it
    }
  }
  return leaks;
}

/** Best-effort parse of HASH-PROVENANCE.md §1's per-source-card disposition table. Never throws —
 * a parse miss returns `{ rows: [], warnings: [...] }` so a documentation-wording difference can
 * never make this gate itself fail (the two hash-based checks above are the binding mechanism);
 * it is reported as a warning so a genuine regression in the note's shape is still visible. */
export function parseDispositionRows(provenanceText) {
  const warnings = [];
  const headingIdx = provenanceText.indexOf('## 1. Content-rights disposition');
  if (headingIdx === -1) {
    warnings.push('could not find "## 1. Content-rights disposition" section');
    return { rows: [], warnings };
  }
  const nextHeadingIdx = provenanceText.indexOf('\n## ', headingIdx + 1);
  const section = nextHeadingIdx === -1 ? provenanceText.slice(headingIdx) : provenanceText.slice(headingIdx, nextHeadingIdx);

  const rows = [];
  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    const cardCell = cells[1];
    const cardMatch = cardCell.match(/^`([^`]+)`$/);
    if (!cardMatch) continue; // header/alignment/"Total" summary rows
    const disposition = cells[cells.length - 1].toLowerCase();
    if (disposition !== 'restricted' && disposition !== 'clear') continue;
    const countCell = cells[cells.length - 2].replace(/\*/g, '');
    const count = Number(countCell);
    if (!Number.isInteger(count)) continue;
    rows.push({ sourceCardId: cardMatch[1], passageCount: count, disposition });
  }
  if (rows.length === 0) {
    warnings.push('found the disposition section but parsed zero source-card rows out of it');
  }
  return { rows, warnings };
}

/**
 * PURE core (no filesystem/git access — exported so `tests/ef-check-fixture-rights-leakage.test.mjs`
 * can exercise every check directly against small, synthetic, in-memory fixture trees, never a real
 * `git`-tracked directory). Runs every check for one fixture given its already-loaded committed
 * files and the GLOBAL hash registry (built across all `FIXTURE_SLUGS`) for the leak scan.
 *
 * @param {string} relDir fixture-relative label for error/violation messages, e.g. `tests/fixtures/rf-ev-001`
 * @param {Array<{relPath: string, text: string}>} fileEntries every committed file's already-read text
 * @param {Set<string>} globalKnownHashes the global redaction-hash registry (see `run()`)
 * @returns {{filesScanned: number, placeholderCount: number, violations: object[], leaks: object[], warnings: string[]}}
 */
export function checkFixtureFiles(relDir, fileEntries, globalKnownHashes) {
  if (fileEntries.length === 0) {
    throw new RightsLeakageError(`"${relDir}" has zero committed files (git ls-files returned nothing) — expected a populated fixture tree`);
  }

  const provenanceRelPath = path.posix.join(relDir, PROVENANCE_FILE);
  if (!fileEntries.some((e) => e.relPath === provenanceRelPath)) {
    throw new RightsLeakageError(`"${relDir}" is missing its required ${PROVENANCE_FILE} (P1-T3..T6's own provenance note)`);
  }

  const violations = [];
  const leaks = [];
  const warnings = [];
  let placeholderCount = 0;
  let provenanceText = '';

  const perCardFileText = new Map(); // sourceCardId -> file text, for the §3 cross-check below

  for (const { relPath, text } of fileEntries) {
    const isProvenanceNote = relPath === provenanceRelPath;
    const isSourceCard = /\/sources\/(src_[^/]+)\.md$/.test(relPath);

    if (isProvenanceNote) {
      provenanceText = text;
    } else {
      // Structural check applies to bundle-content files only — HASH-PROVENANCE.md is
      // fixture-derivation documentation and legitimately contains illustrative `quote: "..."`
      // prose snippets that are not real fixture data (see file banner, item 1).
      violations.push(...findNonPlaceholderLabelValues(text, relPath));
      placeholderCount += extractPlaceholderHashes(text).length;
      if (isSourceCard) {
        const m = relPath.match(/\/sources\/(src_[^/]+)\.md$/);
        perCardFileText.set(m[1], text);
      }
    }

    // Hash-registry leak scan applies to every committed byte EXCEPT `sources/src_*.md` files —
    // see file banner, item 2, for why those files are deliberately excluded from this specific
    // check (legitimate untouched `locator`/`threshold.value` duplication of short excerpts) while
    // still being fully covered by the structural check above.
    if (!isSourceCard) {
      leaks.push(...findHashRegistryLeaks(text, relPath, globalKnownHashes));
    }
  }

  if (placeholderCount === 0) {
    throw new RightsLeakageError(`"${relDir}" carries zero ADR-0002 redaction placeholders across its bundle-content files — expected a rights-restricted fixture with at least one redacted passage`);
  }

  // §3 cross-check against HASH-PROVENANCE.md's own disposition table (best-effort; see
  // parseDispositionRows's own doc comment for why parse misses warn rather than fail).
  const { rows, warnings: parseWarnings } = parseDispositionRows(provenanceText);
  warnings.push(...parseWarnings.map((w) => `${relDir}/${PROVENANCE_FILE}: ${w}`));
  for (const row of rows) {
    if (row.disposition !== 'restricted') {
      warnings.push(`${relDir}: disposition table lists "${row.sourceCardId}" as "${row.disposition}", not "restricted" — this gate's universal placeholder check assumes 100% restricted for this fixture list; verify manually`);
      continue;
    }
    const cardText = perCardFileText.get(row.sourceCardId);
    if (!cardText) {
      warnings.push(`${relDir}: disposition table references "${row.sourceCardId}" but "sources/${row.sourceCardId}.md" is not among the committed files`);
      continue;
    }
    const cardPlaceholderCount = extractPlaceholderHashes(cardText).length;
    if (cardPlaceholderCount < row.passageCount) {
      violations.push({
        relPath: path.posix.join(relDir, 'sources', `${row.sourceCardId}.md`),
        line: 0,
        label: 'disposition-cross-check',
        reason: `HASH-PROVENANCE.md declares ${row.passageCount} restricted passage(s) for this card but only ${cardPlaceholderCount} redaction placeholder(s) were found in the committed file`,
      });
    }
  }

  return {
    filesScanned: fileEntries.length,
    placeholderCount,
    violations,
    leaks,
    warnings,
  };
}

/** Disk/git-backed wrapper around `checkFixtureFiles` for one fixture (`slug`, e.g. `"ev-001"`). */
async function checkFixture(slug, globalKnownHashes) {
  const relDir = path.posix.join('tests/fixtures', `rf-${slug}`);
  const committedRelPaths = gitLsFiles(relDir);
  const fileEntries = await Promise.all(
    committedRelPaths.map(async (relPath) => ({ relPath, text: await readFile(path.join(REPO_ROOT, relPath), 'utf8') })),
  );
  const result = checkFixtureFiles(relDir, fileEntries, globalKnownHashes);
  return { slug, ...result };
}

export async function run() {
  // Build the GLOBAL hash registry first (a superset of "this fixture's own list" — see file
  // banner, item 2) so a passage that leaked into a *different* fixture than the one it was
  // redacted from is caught too, not just same-fixture leaks.
  const globalKnownHashes = new Set();
  for (const slug of FIXTURE_SLUGS) {
    const relDir = path.posix.join('tests/fixtures', `rf-${slug}`);
    for (const relPath of gitLsFiles(relDir)) {
      if (relPath.endsWith(`/${PROVENANCE_FILE}`)) continue; // built from bundle-content files only
      const absPath = path.join(REPO_ROOT, relPath);
      const text = await readFile(absPath, 'utf8');
      for (const hash of extractPlaceholderHashes(text)) globalKnownHashes.add(hash);
    }
  }
  if (globalKnownHashes.size === 0) {
    throw new RightsLeakageError('global redaction-hash registry is empty across all 4 fixtures — expected at least one restricted passage');
  }

  const results = [];
  for (const slug of FIXTURE_SLUGS) {
    results.push(await checkFixture(slug, globalKnownHashes));
  }
  return { results, globalHashCount: globalKnownHashes.size };
}

async function main() {
  let outcome;
  try {
    outcome = await run();
  } catch (err) {
    if (err instanceof RightsLeakageError) {
      console.error(`rights-leakage gate: FAIL — ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  let failed = false;
  for (const result of outcome.results) {
    const label = `rf-${result.slug}`;
    if (result.violations.length > 0) {
      failed = true;
      console.error(`rights-leakage gate: FAIL — ${label}: ${result.violations.length} structural redaction violation(s):`);
      for (const v of result.violations) {
        console.error(`  ${v.relPath}:${v.line} [${v.label}] ${v.reason}`);
      }
    }
    if (result.leaks.length > 0) {
      failed = true;
      console.error(`rights-leakage gate: FAIL — ${label}: ${result.leaks.length} restricted-passage LEAK(S) detected (verbatim text matching a known redaction hash):`);
      for (const l of result.leaks) {
        console.error(`  ${l.relPath}:${l.line} — matches known restricted-passage sha256:${l.hash}`);
      }
    }
    for (const w of result.warnings) {
      console.warn(`rights-leakage gate: warning — ${w}`);
    }
    if (result.violations.length === 0 && result.leaks.length === 0) {
      console.log(`rights-leakage gate: OK — ${label}: ${result.filesScanned} committed files scanned, ${result.placeholderCount} redaction placeholders verified, 0 leaks`);
    }
  }
  console.log(`rights-leakage gate: ${outcome.globalHashCount} known restricted-passage hashes tracked across ${outcome.results.length} fixtures`);

  if (failed) {
    process.exitCode = 1;
  } else {
    console.log('rights-leakage gate: PASS — every quote:/passage_locator: construct inside each '
      + 'fixture\'s sources/ directory is the ADR-0002 placeholder, and no known restricted-passage '
      + 'hash was found in a decoded quoted span outside sources/ (locators and sources/ card files '
      + 'are exempted by design, per the header comment above)');
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((err) => {
    console.error('rights-leakage gate: unexpected error');
    console.error(err);
    process.exitCode = 1;
  });
}
