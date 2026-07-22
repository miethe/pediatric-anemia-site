// tests/ef-retro-identifier-denylist.test.mjs -- unit coverage for
// tools/retro-validate/lib/identifier-denylist.mjs (P4 fix cycle, Codex second-opinion review,
// ADR-0006 hardening). This file proves the module's own behavior in isolation, pure-function
// style (no corpus fixtures, no I/O) -- integration-level proof against real seeded corpus
// fixtures (both BLOCKER-shaped classes, plus the schema-vs-denylist-layer split) lives in
// tests/ef-retro-corpus.test.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';

import { scanForIdentifiers, IDENTIFIER_DENYLIST_TEST_HOOKS } from '../tools/retro-validate/lib/identifier-denylist.mjs';

const { normalizeKey, IDENTIFIER_KEY_DENYLIST, PHI_MARKER_PATTERNS } = IDENTIFIER_DENYLIST_TEST_HOOKS;

// -------------------------------------------------------------------------------------------
// scanForIdentifiers: clean input produces zero violations.
// -------------------------------------------------------------------------------------------

test('scanForIdentifiers returns [] for a document with no identifier-shaped keys or PHI markers', () => {
  const document = {
    schemaVersion: 1,
    corpusId: 'clean-corpus',
    description: 'A perfectly ordinary synthetic fixture corpus description with no markers.',
    sourceAttestation: { ref: 'synthetic-note-001', provenanceClass: 'synthetic' },
    cases: [
      {
        caseId: 'case-001',
        provenance: 'synthetic',
        input: { patient: { ageMonths: 12 }, cbc: { hemoglobin: 9.5 }, history: { excessCowMilk: true } },
        tags: ['regression'],
      },
    ],
  };
  assert.deepEqual(scanForIdentifiers(document), []);
});

// -------------------------------------------------------------------------------------------
// Identifier-shaped-key denylist: exact match after normalization, not substring.
// -------------------------------------------------------------------------------------------

const KEY_VARIANTS = ['dob', 'DOB', 'dateOfBirth', 'date_of_birth', 'DATE-OF-BIRTH', 'Date Of Birth'];
for (const key of KEY_VARIANTS) {
  test(`identifier-shaped key variant "${key}" is caught regardless of casing/separator convention`, () => {
    const violations = scanForIdentifiers({ [key]: '2015-01-01' });
    assert.ok(violations.length > 0, `expected key "${key}" to be denylisted`);
    assert.ok(violations.some((v) => v.path === `$.${key}`), `expected a violation naming path "$.${key}", got: ${JSON.stringify(violations)}`);
  });
}

test('identifier-shaped-key match is EXACT (normalized), never a substring/`includes` match', () => {
  // "historyOfPresentIllness" contains no denylisted substring; "nameOfMedication" DOES contain
  // "name" as a substring but must NOT trigger, because the whole normalized key ("nameofmedication")
  // does not exactly equal any denylist entry.
  const violations = scanForIdentifiers({ historyOfPresentIllness: true, nameOfMedication: 'ferrous sulfate' });
  assert.deepEqual(violations, [], 'a legitimate key merely containing a denylisted substring must not be flagged');
});

test('every entry in IDENTIFIER_KEY_DENYLIST is itself already normalized (lowercase, alphanumeric only)', () => {
  for (const entry of IDENTIFIER_KEY_DENYLIST) {
    assert.equal(entry, normalizeKey(entry), `denylist entry "${entry}" must already be in normalized form`);
  }
});

test('a key that normalizes to a denylisted entry is caught at any nesting depth', () => {
  const violations = scanForIdentifiers({ cases: [{ input: { patient: { mrn: 'MRN-1' } } }] });
  assert.ok(violations.some((v) => v.path === '$.cases[0].input.patient.mrn'));
});

// -------------------------------------------------------------------------------------------
// PHI-marker value patterns: one positive + one negative example per pattern.
// -------------------------------------------------------------------------------------------

const PHI_MARKER_CASES = [
  { id: 'ssn-like-value', positive: 'value 123-45-6789 embedded', negative: 'value 2026-07-21 is a date, not SSN-shaped' },
  { id: 'mrn-marker', positive: 'MRN: A1234567', negative: 'no medical record marker here at all' },
  { id: 'dob-marker', positive: 'DOB: 2015-03-14', negative: 'no birth-date marker present' },
  { id: 'patient-name-marker', positive: "Patient's Name: Jane Doe", negative: 'patient presented with anemia' },
  { id: 'ssn-marker', positive: 'SSN: 000-00-0000', negative: 'this string has no social security marker' },
  { id: 'phone-like-value', positive: 'call 555-123-4567 for follow-up', negative: 'schemaVersion 1.2.3 is not phone-shaped' },
  { id: 'email-like-value', positive: 'contact jane.doe@example.com', negative: 'no at-sign in this string' },
  { id: 'street-address-marker', positive: '123 Fixture Street, Testville', negative: '123 is just a case number, no street suffix' },
];

for (const { id, positive, negative } of PHI_MARKER_CASES) {
  test(`PHI-marker pattern "${id}": positive example is caught`, () => {
    const violations = scanForIdentifiers({ description: positive });
    assert.ok(
      violations.some((v) => v.message.includes(id)),
      `expected pattern "${id}" to match ${JSON.stringify(positive)}, got: ${JSON.stringify(violations)}`,
    );
  });

  test(`PHI-marker pattern "${id}": negative example is NOT caught by this pattern`, () => {
    const violations = scanForIdentifiers({ description: negative });
    assert.ok(
      !violations.some((v) => v.message.includes(id)),
      `expected pattern "${id}" to NOT match ${JSON.stringify(negative)}, got: ${JSON.stringify(violations)}`,
    );
  });
}

test('sanity: PHI_MARKER_PATTERNS covers every id exercised above, and vice versa', () => {
  const declaredIds = new Set(PHI_MARKER_PATTERNS.map((p) => p.id));
  const exercisedIds = new Set(PHI_MARKER_CASES.map((c) => c.id));
  assert.deepEqual([...declaredIds].sort(), [...exercisedIds].sort());
});

// -------------------------------------------------------------------------------------------
// Recursive walk correctness: arrays, deep nesting, path reporting.
// -------------------------------------------------------------------------------------------

test('walks arrays with index-annotated paths', () => {
  const violations = scanForIdentifiers({ cases: [{ tags: ['a'] }, { tags: ['MRN: 123456'] }] });
  assert.ok(violations.some((v) => v.path === '$.cases[1].tags[0]' && v.message.includes('mrn-marker')));
});

test('null and undefined values do not throw and produce no violations', () => {
  assert.deepEqual(scanForIdentifiers({ description: null, sourceRef: undefined }), []);
});

test('a document that is itself a bare string is scanned at the root path', () => {
  const violations = scanForIdentifiers('DOB: 2015-01-01');
  assert.ok(violations.some((v) => v.path === '$'));
});

test('a single string value can trigger multiple distinct PHI-marker patterns at once', () => {
  const violations = scanForIdentifiers({ description: 'Patient Name: Jane Doe, MRN: 1234567, DOB: 2015-01-01' });
  const matchedIds = new Set();
  for (const v of violations) {
    for (const { id } of PHI_MARKER_PATTERNS) {
      if (v.message.includes(id)) matchedIds.add(id);
    }
  }
  assert.ok(matchedIds.has('patient-name-marker'));
  assert.ok(matchedIds.has('mrn-marker'));
  assert.ok(matchedIds.has('dob-marker'));
});

// -------------------------------------------------------------------------------------------
// Zero network / zero LLM (consistency with the rest of this tool's structural proof).
// -------------------------------------------------------------------------------------------

test('identifier-denylist.mjs imports no network or AI/model-SDK module (structural)', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const modulePath = fileURLToPath(new URL('../tools/retro-validate/lib/identifier-denylist.mjs', import.meta.url));
  const source = await readFile(modulePath, 'utf8');
  const forbidden = [
    /^\s*import\b[^;]*from\s+['"](?:node:)?http['"]/m,
    /^\s*import\b[^;]*from\s+['"](?:node:)?https['"]/m,
    /^\s*import\b[^;]*from\s+['"]@anthropic-ai\/[^'"]*['"]/m,
    /^\s*import\b[^;]*from\s+['"]openai['"]/m,
  ];
  for (const pattern of forbidden) {
    assert.ok(!pattern.test(source), `identifier-denylist.mjs matches forbidden pattern ${pattern}`);
  }
});
