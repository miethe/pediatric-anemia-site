// tools/retro-validate/lib/identifier-denylist.mjs -- IDENTIFIER-DENYLIST module (P4 fix cycle,
// Codex second-opinion review, ADR-0006 hardening). Second, independent, procedural layer of the
// FR-20 structural de-identification boundary, called by `lib/boundary.mjs#checkFixtures`
// alongside (never instead of) the schema-validation layer (`schemas/fixture-corpus.schema.json`).
//
// Why a procedural layer exists at all, given `tests/ef-retro-boundary.test.mjs`'s prior
// "schema-enforced, not procedural" posture: a Codex second-opinion review found two BLOCKERs the
// schema alone could not close:
//   (a) `description` (and other free-text fields, e.g. `sourceAttestation.ref`) is necessarily
//       unrestricted prose -- JSON Schema has no way to structurally forbid "this string contains
//       an MRN-shaped or DOB-shaped marker" the way `additionalProperties: false` forbids an
//       unlisted KEY. A corpus author could place `"description": "Patient: Jane Doe, MRN: ..."`
//       and the schema would validate it cleanly.
//   (b) `symptoms`/`history`/`exam` are INTENTIONALLY open-key-name boolean maps (SPIKE-003 RQ4
//       wire-compatibility decision, mirrored from `schemas/patient-input.schema.json`'s own
//       `booleanMap` $def) -- closing them to a fixed key whitelist would break that wire contract
//       for THIS tool's schema too. An identifier-shaped key (e.g. `history.patientName`) with a
//       boolean/tristate VALUE is schema-valid there by design, even though the KEY itself is
//       identifier-shaped and should never appear.
//
// This module is the ONE sanctioned place that implements identifier-shaped-key/PHI-marker
// detection procedurally (a declarative denylist config plus one generic recursive walker) --
// `tests/ef-retro-boundary.test.mjs` pins it to exactly this file, the same "single sanctioned
// exception" pattern this repo already uses for `lib/discordance.mjs`'s cross-import of
// `tools/review-record/lib/adjudication.mjs` (see that file's own header). It is layered ON TOP
// OF, not instead of, the schema's own closed-shape enforcement: `lib/boundary.mjs#checkFixtures`
// runs both checks unconditionally and combines their violations into one fail-closed
// `BoundaryError`.
//
// `scanForIdentifiers(document)` walks the ENTIRE parsed corpus document -- every object key at
// every depth, every array element, every string leaf -- with no dependency on
// `schemas/fixture-corpus.schema.json`'s own shape (a document that fails schema validation is
// still fully walkable and still gets scanned; the two layers are independent, neither is
// short-circuited by the other failing first). Two, independent checks per node:
//
//   1. Identifier-shaped KEY denylist: every object key is normalized (lower-cased,
//      non-alphanumeric characters stripped, so `dateOfBirth`, `date_of_birth`, `DATE-OF-BIRTH`,
//      and `dateofbirth` all normalize identically) and compared for EXACT equality against
//      `IDENTIFIER_KEY_DENYLIST` -- never a substring/`includes` match, so a legitimate clinical
//      fact key that happens to CONTAIN a denylisted token as a substring (there is none in this
//      program's actual vocabulary today, but the exact-match design is deliberate future-proofing)
//      is never a false positive.
//   2. PHI-marker VALUE pattern denylist: every string leaf, anywhere in the document, is tested
//      against `PHI_MARKER_PATTERNS` -- SSN-shaped values, MRN/DOB/SSN/"patient name" prose
//      markers, phone-number-shaped values, email-shaped values, and street-address-shaped
//      markers. This is the layer that closes BLOCKER (a): a `description` (or any other string
//      anywhere) containing "MRN: 123456" or "DOB: 2015-01-01" is rejected fail-closed even though
//      no schema `pattern`/`not` keyword targets that specific free-text field.
//
// Every violation is returned as `{ path, message }`, the same shape
// `scripts/lib/json-schema-lite.mjs#validate` already returns, so `lib/boundary.mjs` can
// concatenate both layers' violations into one combined, human-readable `BoundaryError` detail
// list without a translation step.

const IDENTIFIER_KEY_DENYLIST = new Set([
  // Direct name fields.
  'name', 'patientname', 'firstname', 'lastname', 'fullname', 'middlename',
  'guardianname', 'parentname', 'nextofkin',
  // Medical record number.
  'mrn', 'medicalrecordnumber',
  // Date of birth.
  'dob', 'dateofbirth', 'birthdate',
  // Social security number.
  'ssn', 'socialsecuritynumber',
  // Address.
  'address', 'streetaddress', 'mailingaddress', 'homeaddress',
  // Contact fields.
  'phone', 'phonenumber', 'telephone', 'mobilenumber',
  'email', 'emailaddress',
  'contact', 'contactinfo', 'contactinformation',
]);

/**
 * Normalizes an object key for denylist comparison: lower-cased, every non-alphanumeric
 * character stripped. `dateOfBirth`, `date_of_birth`, `DATE-OF-BIRTH`, and `Date Of Birth` all
 * normalize to `dateofbirth` -- one denylist entry covers every casing/separator convention.
 * @param {string} key
 * @returns {string}
 */
function normalizeKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * PHI-marker patterns applied to every string leaf in the document, independent of which field
 * holds the string. Each is deliberately a MARKER pattern (an identifier-shaped VALUE, or prose
 * naming an identifier field immediately before a value), not an attempt at general-purpose name
 * detection -- free-text natural-language name recognition is out of scope for a deterministic,
 * fail-closed structural check; the field-name denylist above plus these markers are what this
 * tool's own threat model (a synthetic/de-identified fixture author accidentally or carelessly
 * pasting identifier-shaped content into a free-text field) requires.
 */
const PHI_MARKER_PATTERNS = [
  { id: 'ssn-like-value', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { id: 'mrn-marker', re: /\bmrn\b\s*[:#-]?\s*\S/i },
  { id: 'dob-marker', re: /\b(?:dob|date of birth)\b\s*[:#-]?\s*\S/i },
  { id: 'patient-name-marker', re: /\bpatient['’]?s?\s*name\b/i },
  { id: 'ssn-marker', re: /\bssn\b\s*[:#-]?\s*\S/i },
  { id: 'phone-like-value', re: /(?<!\d)\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)/ },
  { id: 'email-like-value', re: /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/ },
  {
    id: 'street-address-marker',
    re: /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,3}\s+(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|lane|ln\.?|court|ct\.?)\b/i,
  },
];

/**
 * Recursively scans `document` for identifier-shaped keys and PHI-marker value patterns,
 * anywhere at any depth. Pure function -- no I/O, no mutation of `document`.
 * @param {unknown} document the parsed corpus document (or any sub-value, for recursive calls)
 * @param {string} [at] the path prefix for violation messages (defaults to `$`, matching
 *   `scripts/lib/json-schema-lite.mjs`'s own root-path convention)
 * @returns {Array<{ path: string, message: string }>} empty when no violation is found
 */
export function scanForIdentifiers(document, at = '$') {
  const violations = [];
  walk(document, at, violations);
  return violations;
}

function walk(node, at, violations) {
  if (node === null || node === undefined) return;

  if (typeof node === 'string') {
    for (const { id, re } of PHI_MARKER_PATTERNS) {
      if (re.test(node)) {
        violations.push({
          path: at,
          message: `value matches PHI-marker pattern "${id}" -- identifier-denylist rejects this fail-closed, independent of the schema check`,
        });
      }
    }
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, `${at}[${index}]`, violations));
    return;
  }

  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (IDENTIFIER_KEY_DENYLIST.has(normalizeKey(key))) {
        violations.push({
          path: `${at}.${key}`,
          message: `identifier-shaped key "${key}" is denylisted -- identifier-denylist rejects this fail-closed, independent of the schema check`,
        });
      }
      walk(value, `${at}.${key}`, violations);
    }
  }
}

/** Exported for tests that want to prove the denylist/pattern set itself, not just the walker. */
export const IDENTIFIER_DENYLIST_TEST_HOOKS = Object.freeze({
  IDENTIFIER_KEY_DENYLIST,
  PHI_MARKER_PATTERNS,
  normalizeKey,
});
