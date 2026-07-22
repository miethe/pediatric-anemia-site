// tests/notice-architecture-no-clearance.test.mjs — EPR5-T7 (FR-WP5-09, FR-WP5-10).
//
// Mechanical reviewer check: NOTICE.md and docs/architecture.md §7 describe the shipped rights/
// substrate without ever implying a clearance exists. Every occurrence of the words "cleared",
// "licensed", or "approved" in either document must sit inside a sentence that also carries an
// explicit negation marker (e.g. "not", "never", "no", "none") — a bare positive assertion like
// "this source has been cleared" would fail this check even if it were only ever a hypothetical.
//
// This is a coverage/consistency-shaped doc-truth check (D7), not a clearance gate: it never reads
// or cares about any rights_record's actual overall_status — it only proves the prose surrounding
// these three specific words is never affirmative.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const REPO_ROOT = new URL('../', import.meta.url);

const WATCHED_WORDS = /\b(cleared|licensed|approved)\b/gi;
const NEGATION_MARKERS = /\b(not|never|no|none|nobody|nothing|cannot|can't|won't|doesn't|isn't|aren't|without|neither|forbid|forbids|forbidden)\b/i;

/**
 * Returns the sentence (bounded by '.', '!', '?', or a blank line, in either direction) containing
 * the match at `index` in `text`.
 */
function sentenceAround(text, index) {
  const boundaryChars = ['.', '!', '?'];
  let start = 0;
  for (const ch of boundaryChars) {
    const pos = text.lastIndexOf(ch, index);
    if (pos > start - 1) start = Math.max(start, pos + 1);
  }
  const blankBefore = text.lastIndexOf('\n\n', index);
  if (blankBefore + 2 > start) start = blankBefore + 2;

  let end = text.length;
  for (const ch of boundaryChars) {
    const pos = text.indexOf(ch, index);
    if (pos !== -1 && pos < end) end = pos;
  }
  const blankAfter = text.indexOf('\n\n', index);
  if (blankAfter !== -1 && blankAfter < end) end = blankAfter;

  return text.slice(start, end + 1);
}

/**
 * Asserts every whole-word occurrence of "cleared"/"licensed"/"approved" in `text` sits in a
 * sentence carrying a negation marker. Returns the count of occurrences checked (so the caller can
 * assert the check actually exercised something, rather than trivially passing over an empty file).
 */
function assertOnlyNegatedOccurrences(text, label) {
  let match;
  let count = 0;
  WATCHED_WORDS.lastIndex = 0;
  while ((match = WATCHED_WORDS.exec(text))) {
    count += 1;
    const sentence = sentenceAround(text, match.index);
    assert.match(
      sentence,
      NEGATION_MARKERS,
      `${label}: found "${match[0]}" in a sentence with no negation marker — this reads as an ` +
        `affirmative clearance/license/approval claim, which no rights record in this repository ` +
        `supports:\n  "${sentence.trim()}"`,
    );
  }
  return count;
}

test('NOTICE.md never affirms a clearance, license, or approval', async () => {
  const notice = await readFile(new URL('NOTICE.md', REPO_ROOT), 'utf8');
  const count = assertOnlyNegatedOccurrences(notice, 'NOTICE.md');
  assert.ok(count > 0, 'NOTICE.md should describe rights status using cleared/licensed/approved language (in negated form) — none found');
});

test('docs/architecture.md never affirms a clearance, license, or approval', async () => {
  const architecture = await readFile(new URL('docs/architecture.md', REPO_ROOT), 'utf8');
  const count = assertOnlyNegatedOccurrences(architecture, 'docs/architecture.md');
  assert.ok(count > 0, 'docs/architecture.md should describe rights status using cleared/licensed/approved language (in negated form) — none found');
});

test('docs/architecture.md §7 names residual gap R-1 as open', async () => {
  const architecture = await readFile(new URL('docs/architecture.md', REPO_ROOT), 'utf8');
  const section7Start = architecture.indexOf('## 7. Rule-authoring model');
  const section8Start = architecture.indexOf('## 8. FHIR integration proposal');
  assert.ok(section7Start !== -1 && section8Start !== -1 && section7Start < section8Start, 'expected §7 and §8 headers to both exist in order');
  const section7 = architecture.slice(section7Start, section8Start);

  assert.match(section7, /R-1/, '§7 must name residual gap R-1');
  assert.match(
    section7,
    /not fully deterministic|not deterministic/i,
    '§7 must record that prohibited-excerpt detection is not (fully) deterministic',
  );
  assert.match(
    section7,
    /open,\s*not\s*closed/i,
    '§7 must record R-1 explicitly as an open gap, not a closed one',
  );
});
