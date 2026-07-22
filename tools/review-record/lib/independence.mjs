// tools/review-record/lib/independence.mjs — FR-4 reviewer-2 independence (P2-T2, ADR-0004 "no read
// dependency").
//
// ADR-0004's actual, PRIMARY guarantee is structural, not textual: the `clinical-2` scaffold flow
// never reads a sibling `clinical-1` record's decision-bearing fields at all — see
// `lib/chain.mjs`'s `nextChainLink`, which every role (including `clinical-2`) uses identically to
// compute its `previousRecordHash`, and which returns ONLY a sequence number and a hash string,
// never the underlying record object. `lib/verbs/scaffold.mjs`'s `run()` has no code path that ever
// loads a sibling record's `decision`/`rationale`/`reviewerId` into memory when building a
// `clinical-2` draft — that is the enforcement this task's AC calls "structural."
//
// THIS module is a SECOND, SUPPLEMENTARY layer: a heuristic, textual-overlap detector `validate`
// runs over an already-committed (or hand-built fixture) pair of `clinical-1`/`clinical-2` records
// that did NOT necessarily go through `scaffold` at all — e.g. a hand-authored YAML file a human (or
// a future agent) pasted reviewer-1's own rationale text into by hand. It catches exactly that
// shape of violation (the seeded-violation fixture this task's AC names) by looking for verbatim
// substring overlap or an explicit reference to reviewer-1's own `reviewerId`. It is NOT, and does
// not claim to be, a comprehensive dependence detector — a paraphrase, or a record whose author read
// reviewer-1's decision out-of-band without literally copying text into `rationale`, would not be
// caught by this heuristic. Treat a clean result from this module as "no verbatim copy-paste found,"
// never as a positive proof of independent review.

const MIN_SHARED_SUBSTRING_LENGTH = 20;

/**
 * Length of the longest common (contiguous) substring shared by two strings. Simple O(n*m) dynamic
 * program — both inputs here are single free-text `rationale` fields (short, human-authored prose),
 * never large documents, so quadratic time is not a concern.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function longestCommonSubstringLength(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || b.length === 0) return 0;
  let previousRow = new Array(b.length + 1).fill(0);
  let longest = 0;
  for (let i = 1; i <= a.length; i += 1) {
    const currentRow = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        currentRow[j] = previousRow[j - 1] + 1;
        if (currentRow[j] > longest) longest = currentRow[j];
      }
    }
    previousRow = currentRow;
  }
  return longest;
}

/**
 * Heuristic FR-4 check over an already-loaded `clinical-1`/`clinical-2` record pair for one module.
 * Either argument may be `undefined`/`null` (e.g. only one of the pair exists yet, the common case
 * for a module mid-review) — in that case this returns no violations; there is nothing to compare
 * against yet, and "no sibling to depend on" is not itself a violation.
 *
 * @param {object|undefined} clinical1Record parsed `role: clinical-1` record for the same module
 * @param {object|undefined} clinical2Record parsed `role: clinical-2` record for the same module
 * @returns {string[]} human-readable violation messages, empty when clean
 */
export function checkReviewerIndependence(clinical1Record, clinical2Record) {
  const violations = [];
  if (!clinical1Record || !clinical2Record) return violations;

  const c1Rationale = typeof clinical1Record.rationale === 'string' ? clinical1Record.rationale : '';
  const c2Rationale = typeof clinical2Record.rationale === 'string' ? clinical2Record.rationale : '';

  const sharedLength = longestCommonSubstringLength(c1Rationale, c2Rationale);
  if (sharedLength >= MIN_SHARED_SUBSTRING_LENGTH) {
    violations.push(
      `clinical-2 record "${clinical2Record.review_id ?? '(unknown)'}" rationale shares a ` +
        `${sharedLength}-character verbatim substring with clinical-1 record ` +
        `"${clinical1Record.review_id ?? '(unknown)'}" rationale — reviewer-2 independence (FR-4, ` +
        'ADR-0004 "no read dependency") requires clinical-2\'s decision content to be produced ' +
        'without reading clinical-1\'s (heuristic textual-overlap check, not a comprehensive proof).',
    );
  }

  const c1ReviewerId = typeof clinical1Record.reviewerId === 'string' ? clinical1Record.reviewerId : null;
  if (c1ReviewerId && c2Rationale.includes(c1ReviewerId)) {
    violations.push(
      `clinical-2 record "${clinical2Record.review_id ?? '(unknown)'}" rationale references ` +
        `clinical-1 reviewerId "${c1ReviewerId}" directly — reviewer-2 independence (FR-4) forbids ` +
        'a clinical-2 record from naming or otherwise surfacing clinical-1\'s identity or content.',
    );
  }

  return violations;
}
