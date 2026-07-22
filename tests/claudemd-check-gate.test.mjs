// tests/claudemd-check-gate.test.mjs — EPR5-T5 (FR-WP5-07).
//
// Doc-truth check: CLAUDE.md's documented `npm run check` composition must stay byte-identical to
// package.json's `scripts.check` — the authoritative source (EP-R0 owns package.json; CLAUDE.md is
// EP-R5's, and the doc moves to match the code, never the reverse). This test fails on drift instead
// of letting the doc silently go stale again.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const REPO_ROOT = new URL('../', import.meta.url);

test('CLAUDE.md gate-before-commit composition matches package.json scripts.check verbatim', async () => {
  const [claudeMd, pkgRaw] = await Promise.all([
    readFile(new URL('CLAUDE.md', REPO_ROOT), 'utf8'),
    readFile(new URL('package.json', REPO_ROOT), 'utf8'),
  ]);
  const pkg = JSON.parse(pkgRaw);
  const authoritative = pkg.scripts && pkg.scripts.check;
  assert.ok(
    typeof authoritative === 'string' && authoritative.length > 0,
    'package.json scripts.check must exist and be non-empty',
  );

  // Extract the backtick-quoted composition string following "(= `...`)" on the
  // "Gate before commit" line in CLAUDE.md.
  const match = claudeMd.match(
    /\*\*Gate before commit:\*\* `npm run check` \(= `([^`]+)`\)/,
  );
  assert.ok(
    match,
    'CLAUDE.md must contain a "**Gate before commit:** `npm run check` (= `<composition>`)" line',
  );
  const documented = match[1];

  assert.equal(
    documented,
    authoritative,
    'CLAUDE.md\'s documented npm run check composition has drifted from package.json\'s ' +
      'scripts.check (the authoritative source). Update CLAUDE.md — never package.json — to match.',
  );
});
