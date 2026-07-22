// tools/rf-bundle-to-kb-pack/lib/traceability-index.mjs — traceability index (P5-T4,
// evidence-foundry-buildout Phase 5, `02 §4.16`).
//
// Builds the `source -> passage -> claim -> decision -> rule -> test -> output` index for the 4
// `cbc_suite_v1` slice rules, entirely from artifacts this repo already has committed —
// `modules/cbc_suite_v1/{rules.json, rule-provenance.json, evidence-assertions.json,
// evidence.json}`, the P4 generated test corpus (`tests/ef-cbc_suite_v1-*.test.mjs`), and the
// upstream `rf` claim ledger fixture named by `rule-provenance.json`'s own `rfProvenance.
// fixturePath` (`tests/fixtures/rf-cbc-001/claims/claim_ledger.yaml`). It invents no new clinical
// content — every edge is a cross-reference already recorded somewhere in those files.
//
// Two module-boundary pieces, one file:
//   1. `buildTraceabilityIndex(inputs)` — PURE, no I/O — assembles the index document from
//      already-parsed inputs. Directly unit-testable against synthetic fixtures.
//   2. `loadTraceabilityIndexInputs(...)` / `generateTraceabilityIndex(...)` — the I/O wrapper that
//      reads the real committed module content + test corpus + claim ledger and calls (1).
//   3. `queryTraceabilityByOutput` / `queryTraceabilityBySource` — the two `02 §4.16` bidirectional
//      queries this task's own acceptance criteria name. Both are pure functions over an already-
//      built index (no I/O), so they can be exercised directly in tests without re-reading disk.
//
// `02 §4.16`'s required graph edges, and where each is resolved below:
//   Source -> Passage         evidence-assertions.json (sourceId, passageId, exactPassageSha256)
//   Passage -> Claim          evidence-assertions.json (rfClaimId)
//   Claim -> Decision         modules/<id>/authoring-decisions.yaml / rule-provenance.json
//                             (`basis.rfClaimIds` / `basis.decisionId`) -- an `inference` claim's
//                             own parent claims are resolved via the claim ledger's
//                             `inference_basis.from_claims` (`02 §4.16`: "inference cites parent
//                             claims"), never re-derived or guessed.
//   Decision -> Rule          rule-provenance.json (`ruleId`, `basis.decisionId`) -- exactly one
//                             decision per rule, matching `02 §4.16`'s 1:1 cardinality rule.
//   Rule -> Test              discovered by scanning the P4 generated test corpus
//                             (`tests/ef-<moduleId>-*.test.mjs`) for rule-ID references -- P4's own
//                             `rule-provenance.json.testIds` is still `[]` (an already-flagged,
//                             honest E0 gap; see README "Known Gotchas"), so this index resolves the
//                             edge independently rather than trusting an empty field.
//   Rule -> Output            rules.json (`output.type`; `output.candidateId` for `type: "candidate"`
//                             rules -- the engine renders those under the candidate id, not the
//                             rule id; see tests/ef-cbc_suite_v1-positive.test.mjs).
//
// Zero network calls, zero LLM/generative-model invocations, ever (FR-10) -- this file imports only
// `node:fs/promises`, `node:path`, `node:url`, and this converter's own `./yaml-lite.mjs`.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseYamlDocument } from './yaml-lite.mjs';
import { UsageError } from './errors.mjs';

// This file lives at tools/rf-bundle-to-kb-pack/lib/traceability-index.mjs -- 3 directories below
// the repository root. Used only as the default base for locating the generated test corpus
// (`tests/`); every other input path is supplied explicitly by the caller (or derived from
// `rule-provenance.json`'s own recorded `rfProvenance.fixturePath`), never hard-coded twice.
export const DEFAULT_REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

/** A requested output id or source id has no corresponding node in the index. Exit 1 (usage): this
 * is a caller/query error, never a converter-internal defect. */
export class TraceabilityNotFoundError extends UsageError {
  constructor(kind, id) {
    super(`traceability index has no ${kind} node for ${JSON.stringify(id)}`);
    this.kind = kind;
    this.id = id;
  }
}

/**
 * Resolves ONE already-eligible `rfClaimId` (as cited by a rule-provenance `basis.rfClaimIds`
 * entry) down to the set of `claim_ledger.yaml` claim ids that actually carry a resolvable source
 * passage -- itself, if it is a `supported` claim; its `inference_basis.from_claims` parents
 * (recursively -- `02 §4.16`: "inference cites parent claims"), if it is an `inference` claim; or
 * nothing at all if the claim id is unknown to the ledger (never silently invented). Guards against
 * a cyclic `from_claims` graph with a `seen` set -- defensive only; this fixture's ledger has none.
 *
 * @param {string} claimId
 * @param {Map<string, object>} claimsById `claim_ledger.yaml.claims[]`, keyed by `claim_id`
 * @param {Set<string>} [seen] cycle guard, internal
 * @returns {string[]} sorted, deduped leaf claim ids
 */
export function expandClaimIdToLeafClaims(claimId, claimsById, seen = new Set()) {
  if (seen.has(claimId)) return [];
  seen.add(claimId);

  const claim = claimsById.get(claimId);
  if (!claim) return [];

  if (claim.status === 'inference') {
    const fromClaims = claim.inference_basis?.from_claims;
    if (!Array.isArray(fromClaims) || fromClaims.length === 0) return [];
    const leaves = new Set();
    for (const parentId of fromClaims) {
      for (const leaf of expandClaimIdToLeafClaims(parentId, claimsById, seen)) {
        leaves.add(leaf);
      }
    }
    return [...leaves].sort();
  }

  return [claimId];
}

/**
 * Scans the P4 generated test corpus (`tests/ef-<moduleId>-*.test.mjs`) for every `test(...)` block
 * that references a given rule id anywhere in its body, and records `{ file, testName }` for each
 * hit -- a structural, deterministic discovery of the `Rule -> Test` edge, independent of
 * `rule-provenance.json`'s still-empty `testIds` field. A rule mentioned only in a "must NOT fire"
 * assertion still counts as covered -- `02 §4.16` requires "positive and negative tests," and a
 * negative assertion is exactly that.
 *
 * @param {string} testsDir absolute path to this repo's `tests/` directory
 * @param {string} moduleId e.g. "cbc_suite_v1"
 * @param {string[]} ruleIds the rule ids to search for
 * @returns {Promise<Map<string, Array<{ file: string, testName: string }>>>} ruleId -> sorted,
 *   deduped test references
 */
export async function scanRuleTestCoverage(testsDir, moduleId, ruleIds) {
  const pattern = new RegExp(`^ef-${moduleId}-.*\\.test\\.mjs$`);
  const entries = await readdir(testsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const coverage = new Map(ruleIds.map((ruleId) => [ruleId, []]));
  // Matches a `test('name', ...)` / `test("name", ...)` / `` test(`name`, ...) `` call opener;
  // tolerates an escaped quote inside the name but nothing more exotic (this repo's test names are
  // plain sentences, never containing the unescaped delimiter they are wrapped in).
  const testOpenerRe = /\btest\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g;

  for (const file of files) {
    const raw = await readFile(path.join(testsDir, file), 'utf8');
    const openers = [];
    let match;
    testOpenerRe.lastIndex = 0;
    while ((match = testOpenerRe.exec(raw))) {
      openers.push({ start: match.index, name: match[2] });
    }
    for (let i = 0; i < openers.length; i += 1) {
      const start = openers[i].start;
      const end = i + 1 < openers.length ? openers[i + 1].start : raw.length;
      const body = raw.slice(start, end);
      for (const ruleId of ruleIds) {
        if (body.includes(ruleId)) {
          coverage.get(ruleId).push({ file, testName: openers[i].name });
        }
      }
    }
  }

  for (const [ruleId, refs] of coverage) {
    refs.sort((a, b) => (a.file === b.file ? a.testName.localeCompare(b.testName) : a.file.localeCompare(b.file)));
    coverage.set(ruleId, refs);
  }
  return coverage;
}

/**
 * Assembles the full traceability index document (`02 §4.16`) for one module's already-committed
 * content. PURE -- no I/O, no filesystem/network access -- every value is copied or cross-referenced
 * from its inputs; nothing is invented. Deterministic: identical inputs always produce
 * byte-identical (after `JSON.stringify(..., null, 2)`) output (seam invariant 13) -- every
 * collection is explicitly sorted before being written into the result.
 *
 * @param {{
 *   moduleId: string,
 *   rulesDoc: Array<object>,               modules/<id>/rules.json
 *   ruleProvenanceDoc: object,              modules/<id>/rule-provenance.json
 *   evidenceAssertionsDoc: object,          modules/<id>/evidence-assertions.json
 *   evidenceDoc: object,                    modules/<id>/evidence.json
 *   claimsById: Map<string, object>,        claim_ledger.yaml claims[], keyed by claim_id
 *   testCoverageByRuleId: Map<string, Array<{ file: string, testName: string }>>,
 * }} inputs
 * @returns {object} the traceability index document
 */
export function buildTraceabilityIndex(inputs) {
  const {
    moduleId,
    rulesDoc,
    ruleProvenanceDoc,
    evidenceAssertionsDoc,
    evidenceDoc,
    claimsById,
    testCoverageByRuleId,
  } = inputs;

  const rulesById = new Map((rulesDoc ?? []).map((rule) => [rule.id, rule]));
  const sourceIds = new Set((evidenceDoc?.sources ?? []).map((source) => source.id));

  const assertionsByClaimId = new Map();
  for (const assertion of evidenceAssertionsDoc?.assertions ?? []) {
    const list = assertionsByClaimId.get(assertion.rfClaimId) ?? [];
    list.push(assertion);
    assertionsByClaimId.set(assertion.rfClaimId, list);
  }

  const ruleEntries = [];
  const sourceAccumulators = new Map(); // sourceId -> { claimIds: Set, ruleIds: Set, outputIds: Set, testRefs: Map }

  const getSourceAccumulator = (sourceId) => {
    if (!sourceAccumulators.has(sourceId)) {
      sourceAccumulators.set(sourceId, {
        claimIds: new Set(),
        ruleIds: new Set(),
        outputIds: new Set(),
        testRefs: new Map(), // `${file}\n${testName}` -> { file, testName }
      });
    }
    return sourceAccumulators.get(sourceId);
  };

  for (const entry of [...(ruleProvenanceDoc?.entries ?? [])].sort((a, b) => a.ruleId.localeCompare(b.ruleId))) {
    const { ruleId } = entry;
    const rule = rulesById.get(ruleId) ?? null;
    const outputType = rule?.output?.type ?? null;
    const outputId = outputType === 'candidate' ? rule.output.candidateId : ruleId;

    const directClaimIds = entry.basis?.rfClaimIds ?? [];
    const leafClaimIds = new Set();
    for (const claimId of directClaimIds) {
      for (const leaf of expandClaimIdToLeafClaims(claimId, claimsById)) {
        leafClaimIds.add(leaf);
      }
    }

    const assertions = [...leafClaimIds]
      .flatMap((claimId) => assertionsByClaimId.get(claimId) ?? [])
      .sort((a, b) => a.assertionId.localeCompare(b.assertionId));

    const passages = assertions.map((assertion) => ({
      assertionId: assertion.assertionId,
      rfClaimId: assertion.rfClaimId,
      passageId: assertion.passageId,
      exactPassageSha256: assertion.exactPassageSha256,
      sourceId: assertion.sourceId,
    }));

    const ruleSourceIds = [...new Set(assertions.map((assertion) => assertion.sourceId))].sort();
    const testRefs = testCoverageByRuleId.get(ruleId) ?? [];

    ruleEntries.push({
      ruleId,
      outputId,
      outputType,
      category: rule?.category ?? null,
      safetyClass: rule?.safetyClass ?? null,
      decisionId: entry.basis?.decisionId ?? null,
      reviewStatus: entry.reviewStatus ?? null,
      reviewBy: entry.reviewBy ?? null,
      claimIds: [...directClaimIds].sort(),
      leafClaimIds: [...leafClaimIds].sort(),
      evidenceAssertionIds: passages.map((p) => p.assertionId),
      passages,
      sourceIds: ruleSourceIds,
      testRefs,
    });

    for (const passage of passages) {
      const acc = getSourceAccumulator(passage.sourceId);
      acc.claimIds.add(passage.rfClaimId);
      acc.ruleIds.add(ruleId);
      acc.outputIds.add(outputId);
      for (const ref of testRefs) acc.testRefs.set(`${ref.file}\n${ref.testName}`, ref);
    }
  }

  const rules = Object.fromEntries(ruleEntries.map((entry) => [entry.ruleId, entry]));

  const sources = Object.fromEntries(
    [...sourceIds]
      .sort()
      .filter((sourceId) => sourceAccumulators.has(sourceId))
      .map((sourceId) => {
        const acc = sourceAccumulators.get(sourceId);
        return [
          sourceId,
          {
            sourceId,
            claimIds: [...acc.claimIds].sort(),
            ruleIds: [...acc.ruleIds].sort(),
            outputIds: [...acc.outputIds].sort(),
            testRefs: [...acc.testRefs.values()].sort((a, b) =>
              a.file === b.file ? a.testName.localeCompare(b.testName) : a.file.localeCompare(b.file),
            ),
          },
        ];
      }),
  );

  return {
    schemaVersion: '1.0',
    moduleId,
    description:
      'source -> passage -> claim -> decision -> rule -> test -> output traceability index ' +
      '(evidence-foundry-buildout P5-T4, 02 doc section 4.16). Generated deterministically from ' +
      'already-committed module content; carries no clinical validity, safety, or sign-off claim ' +
      'of its own. Regenerate via scripts/evidence/build-cbc-traceability-index.mjs.',
    rules,
    sources,
  };
}

/**
 * Reads every input `buildTraceabilityIndex` needs from disk. `claim_ledger.yaml` is located via
 * `rule-provenance.json`'s OWN recorded `rfProvenance.fixturePath` (never a second, independently
 * hard-coded fixture path) so this loader cannot silently drift from what the module's committed
 * provenance record already says its evidentiary source is.
 *
 * @param {{ moduleDir: string, repoRoot?: string }} options
 * @returns {Promise<Parameters<typeof buildTraceabilityIndex>[0]>}
 */
export async function loadTraceabilityIndexInputs({ moduleDir, repoRoot = DEFAULT_REPO_ROOT }) {
  if (typeof moduleDir !== 'string' || moduleDir === '') {
    throw new UsageError('loadTraceabilityIndexInputs requires a non-empty "moduleDir" option');
  }

  const readJson = async (filename) => {
    const filePath = path.join(moduleDir, filename);
    try {
      return JSON.parse(await readFile(filePath, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new UsageError(
          `traceability-index requires modules/<id>/${filename} to already exist at ${filePath}`,
        );
      }
      throw err;
    }
  };

  const rulesDoc = await readJson('rules.json');
  const ruleProvenanceDoc = await readJson('rule-provenance.json');
  const evidenceAssertionsDoc = await readJson('evidence-assertions.json');
  const evidenceDoc = await readJson('evidence.json');

  const moduleId = ruleProvenanceDoc.moduleId;
  const fixturePath = ruleProvenanceDoc.rfProvenance?.fixturePath;
  if (typeof fixturePath !== 'string' || fixturePath === '') {
    throw new UsageError(
      `${path.join(moduleDir, 'rule-provenance.json')} is missing rfProvenance.fixturePath -- ` +
        'traceability-index needs it to locate claim_ledger.yaml',
    );
  }
  const claimLedgerPath = path.join(repoRoot, fixturePath, 'claims', 'claim_ledger.yaml');
  let claimLedgerRaw;
  try {
    claimLedgerRaw = await readFile(claimLedgerPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new UsageError(`claim_ledger.yaml not found at ${claimLedgerPath}`);
    }
    throw err;
  }
  const claimLedgerParsed = parseYamlDocument(claimLedgerRaw);
  const claimsById = new Map((claimLedgerParsed.claims ?? []).map((claim) => [claim.claim_id, claim]));

  const ruleIds = (ruleProvenanceDoc.entries ?? []).map((entry) => entry.ruleId).sort();
  const testsDir = path.join(repoRoot, 'tests');
  const testCoverageByRuleId = await scanRuleTestCoverage(testsDir, moduleId, ruleIds);

  return {
    moduleId,
    rulesDoc,
    ruleProvenanceDoc,
    evidenceAssertionsDoc,
    evidenceDoc,
    claimsById,
    testCoverageByRuleId,
  };
}

/**
 * Loads inputs from disk and builds the index in one call -- the function
 * `scripts/evidence/build-cbc-traceability-index.mjs` (and this task's own tests) use to (re)produce
 * `modules/<id>/traceability-index.json`.
 *
 * @param {{ moduleDir: string, repoRoot?: string }} options
 * @returns {Promise<object>} the traceability index document
 */
export async function generateTraceabilityIndex(options) {
  const inputs = await loadTraceabilityIndexInputs(options);
  return buildTraceabilityIndex(inputs);
}

// =================================================================================================
// `02 §4.16` bidirectional queries -- this task's own binding acceptance criteria name exactly these
// two. Both are pure functions over an already-built index (no I/O), so a caller (or a test) can
// exercise them directly against a loaded/generated index.
// =================================================================================================

/**
 * Query (1): "Given a rendered [output], show rule, decision, claims, passages, sources, [and]
 * review date." `outputId` may be a rule id (alerts/notes/questions render under their own rule id)
 * OR a candidate id (candidate-type rules render under `output.candidateId` instead -- see
 * `tests/ef-cbc_suite_v1-positive.test.mjs`'s own `entry.id === 'benign-ethnic-neutropenia-
 * differential-pattern'` assertion). Throws `TraceabilityNotFoundError` (a dangling/unknown output
 * id) rather than returning an empty or partial result.
 *
 * @param {object} index a `buildTraceabilityIndex()` result
 * @param {string} outputId
 * @returns {object} the matching `index.rules[...]` entry (ruleId, decisionId, claimIds,
 *   leafClaimIds, evidenceAssertionIds, passages, sourceIds, reviewBy, ...)
 */
export function queryTraceabilityByOutput(index, outputId) {
  for (const rule of Object.values(index.rules)) {
    if (rule.ruleId === outputId || rule.outputId === outputId) return rule;
  }
  throw new TraceabilityNotFoundError('output', outputId);
}

/**
 * Query (2): "Given a source [correction], list claims, rules, tests, [and] outputs potentially
 * affected." Throws `TraceabilityNotFoundError` for a source id the index has no node for (rather
 * than returning an empty result indistinguishable from "this source affects nothing").
 *
 * @param {object} index a `buildTraceabilityIndex()` result
 * @param {string} sourceId
 * @returns {object} the matching `index.sources[sourceId]` entry (claimIds, ruleIds, outputIds,
 *   testRefs)
 */
export function queryTraceabilityBySource(index, sourceId) {
  const entry = index.sources[sourceId];
  if (!entry) throw new TraceabilityNotFoundError('source', sourceId);
  return entry;
}
