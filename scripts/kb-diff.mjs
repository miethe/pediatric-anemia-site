#!/usr/bin/env node
// EP5-T3 (wave0-safety-foundation, Phase EP-5, P1-WP5) -- semantic diff classifier for the
// anemia knowledge base.
//
// NORMATIVE SOURCE: docs/project_plans/SPIKEs/spike-005-semantic-diff-classification.md, the
// section "## Amended normative design -- RA-1...RA-9 applied (2026-07-21) -- THIS SUPERSEDES
// RQ2 AS WRITTEN". The original RQ2 decision function (earlier in that document) was REJECTED by
// an adversarial review (ARC-001: it let a softened emergency-alert explanation classify as
// `review`, never `block`) and is NOT implemented here except as historical context. Where this
// file and the amended section disagree, the amended section is right and this file is buggy.
//
// THE SIX NON-NEGOTIABLE PROPERTIES (ARC-028, reaffirmed by the amendment -- a revision may not
// trade these away):
//   1. Combinator skeleton comparison runs BEFORE leaf matching (defeats all/any swap + negation
//      attacks invisible to leaf-multiset comparison) -- see combinatorSkeleton()/diffWhen() Step 0.
//   2. Negation parity is carried on every emitted leaf, never flattened away -- see
//      walkCondition()'s `polarity` field and diffWhen()'s negation-parity pass.
//   3. invariants[] exists, covering at minimum G2 version-omission, the redefined E7 three-way
//      version drift, F2 band continuity, and the renamed unnamed-class-fallback counter -- see
//      computeInvariants().
//   4. FAIL CLOSED: any unknown/unresolved class => tier 'block'. No cosmetic residual bucket
//      exists -- see safetyRelevance()'s final `return` (Rule 7).
//   5. scope.filesNotDiffed and blindSpotWarning are ALWAYS emitted, on every report, including
//      the empty-changeset case -- see classifyKB()'s `scope` field.
//   6. This module never reads a behavior probe's output. crossCheck() is exported as a pure
//      utility for a FUTURE orchestrator script to call with two already-computed reports; the
//      CLI entrypoint in this file never touches probe output.
//
// Zero-dependency (repo constraint): only Node built-ins are imported below.
//
// Determinism: classifyKB() is a pure function of its `base`/`head` snapshot objects (plus the
// optional `testCaseCorpus`). Every array in the returned report is produced via a stable sort
// (see sortChanges()) so re-running against unchanged inputs always yields byte-identical JSON.

import { readFile, stat } from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { LEVEL_RANK, ALERT_RANK } from '../src/ruleEngine.js';

const RULES_FILE = 'modules/anemia/rules.json';
const CANDIDATES_FILE = 'modules/anemia/candidates.json';
const EVIDENCE_FILE = 'modules/anemia/evidence.json';
const RANGES_FILE = 'modules/anemia/reference-ranges.json';
const MODULE_FILE = 'modules/anemia/module.json';
const INDEX_FILE = 'modules/anemia/index.js';

const FILES_DIFFED = Object.freeze([RULES_FILE, CANDIDATES_FILE, EVIDENCE_FILE, RANGES_FILE, MODULE_FILE]);

// RA-8/item 5 of the amendment: regenerated from the actual import graph (ARC-013), traced from
// server.mjs and src/app.js down. 21 files, verified against this worktree's HEAD 2026-07-21.
const FILES_NOT_DIFFED = Object.freeze([
  'src/ruleEngine.js',
  'src/facts/tristate.js',
  'src/facts/core.js',
  'src/facts/registry.js',
  'src/facts.js',
  'modules/anemia/facts.anemia.js',
  'modules/anemia/ranges.js',
  'src/ranges/registry.js',
  'modules/anemia/units.js',
  'modules/anemia/units.json',
  'src/units.js',
  'src/engine.js',
  'src/modules/registry.js',
  INDEX_FILE,
  'src/evidence.js',
  'src/evidence/registry.js',
  'src/governance.js',
  'src/serverErrors.js',
  'src/algorithmExplorer.js',
  'src/app.js',
  'server.mjs',
]);

const BLIND_SPOT_WARNING =
  'Family H (engine/derivation/presentation/API) changes are outside this tool\'s scope. A clean '
  + 'report here does NOT mean behavior is unchanged. This additionally includes '
  + 'scripts/lib/local-applicability.mjs and schemas/reference-range.schema.json (the local '
  + 'laboratory reference-interval / terminology-applicability subsystem) -- not yet wired into '
  + 'the live assess() path as of this classifier\'s authoring, so it poses no live blind spot '
  + 'today, but the scope decision for it must be made BEFORE it becomes a runtime path, not '
  + 'after. See a behavior-probe report (not produced by this script) for the behavioral side.';

// Mirrors schemas/rule.schema.json's `required` array (== its full property set, since that
// schema sets additionalProperties:false and required lists every declared property). Hardcoded
// rather than read from the schema file at call time so classifyKB() stays a pure function with
// no disk I/O; diffKB() (the CLI-facing loader) is the place a future revision could re-derive
// this from the live schema if it drifts.
const DEFAULT_KNOWN_RULE_KEYS = new Set([
  'id', 'category', 'when', 'evidence', 'output',
  'version', 'effectiveDate', 'retireDate', 'owner', 'safetyClass',
  'requiredTestCaseIds', 'changeRationale', 'sourcePassageId', 'clinicalApprovers',
]);

// Mirrors schemas/candidate.schema.json's `required` array, same rationale as above.
const DEFAULT_KNOWN_CANDIDATE_KEYS = new Set([
  'id', 'label', 'category', 'summary', 'defaultNextSteps', 'evidence', 'sourcePassageId',
]);

// Mirrors rule.schema.json's `$defs.{candidate,alert,question,note}Output` property sets.
const KNOWN_OUTPUT_KEYS = {
  candidate: new Set(['type', 'candidateId', 'level', 'points', 'support', 'cautions', 'nextSteps', 'evidence']),
  alert: new Set(['type', 'severity', 'title', 'detail', 'actions', 'evidence']),
  question: new Set(['type', 'priority', 'section', 'prompt', 'why', 'evidence']),
  note: new Set(['type', 'title', 'detail', 'evidence']),
};

// RA-6: the FULL class-id form is normative everywhere -- 'B1 threshold-change', never bare 'B1'.
// FIXED_DANGEROUS / FIXED_COSMETIC below are copied verbatim from the amended section's "Full
// amended function" code block (SPIKE-005 amended section, item 2).
const FIXED_DANGEROUS = new Set([
  'A1 rule-add', 'A2 rule-remove', 'A3 rule-id-change', 'A6 rule-duplicate-id',
  'B1 threshold-change', 'B2 operator-change', 'B3 boolean-value-flip', 'B4 value-type-change',
  'B6 value-set-change', 'B7 fact-repoint', 'B10 combinator-swap', 'B11 negation-change',
  'B14 empty-condition',
  'C1 output-type-change', 'C2 candidate-target-change', 'C8 safety-string-remove',
  'C11 template-binding-change', 'C12 output-evidence-change',
  'D2 candidate-remove', 'D5 default-next-step-remove', 'D9 candidate-key-id-mismatch',
  'E1 evidence-ref-add', 'E2 evidence-ref-remove', 'E3 evidence-repoint', 'E4 evidence-dangling-ref',
  'E5 evidence-record-content-change', 'E8 sourcePassageId-repoint',
  'F1 range-value-change', 'F2 band-boundary-change', 'F3 band-add', 'F4 band-remove',
  'F5 sex-field-transposition', 'F6 units-change', 'F7 range-source-change',
  'G2 version-omission', 'G3 attestation-change', 'G6 protective-test-binding-remove',
  'H1 operator-semantics-change', 'H2 combinator-semantics-change',
  'H3 fact-derivation-threshold-change', 'H4 fact-path-rename', 'H5 range-registry-change',
  'H6 merge-semantics-change', 'H7 ranking-semantics-change', 'H9 engine-output-projection-change',
]);

// RA-5/RA-8: the ONLY survivor -- A5/D7/G5 were removed from FIXED_COSMETIC by this amendment.
const FIXED_COSMETIC = new Set(['B5 value-format-change']);

// ---------------------------------------------------------------------------------------------
// RA-2: sameNumericValue, normative definition. typeof is checked FIRST and unconditionally --
// this is the entire ARC-002 fix (a natural cross-type implementation that checks numeric
// closeness/loose-== before type lets `true` present as "the same numeric value" as `1`).
// ---------------------------------------------------------------------------------------------
export function sameNumericValue(before, after) {
  if (typeof before !== typeof after) return false; // true->1, false->0, 2->"2" all stop HERE
  if (typeof before !== 'number') return false; // only numbers may be format-only-different
  if (!Number.isFinite(before) || !Number.isFinite(after)) return before === after; // NaN/Infinity: exact only
  return before === after; // 2 and 2.0 parse to the identical JS double
}

export function containsTemplate(value) {
  if (typeof value !== 'string') return false;
  return /\{\{\s*[^}]+?\s*\}\}/.test(value);
}

export function extractPlaceholders(value) {
  if (typeof value !== 'string') return [];
  return [...value.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1].trim()).sort();
}

function placeholdersEqual(before, after) {
  const b = extractPlaceholders(before);
  const a = extractPlaceholders(after);
  return b.length === a.length && b.every((v, i) => v === a[i]);
}

// Amended RQ3 Step 1 (replaces the original; Steps 0/2-5 are unchanged, ARC-028 property 2/1).
export function classifyValueChange(before, after) {
  if (typeof before !== typeof after) return 'B4 value-type-change'; // checked FIRST, no exception
  if (typeof before === 'number') {
    return sameNumericValue(before, after) ? 'B5 value-format-change' : 'B1 threshold-change';
  }
  if (typeof before === 'boolean') return 'B3 boolean-value-flip';
  if (Array.isArray(before)) return 'B6 value-set-change';
  return 'B3 boolean-value-flip'; // enum/string change -- original Step1's own fallback bucket
}

function classifyTextEdit(before, after) {
  return placeholdersEqual(before, after) ? 'C10 display-text-change' : 'C11 template-binding-change';
}

// ---------------------------------------------------------------------------------------------
// Generic JSON helpers. Own local canonicalizer (per EP5-T3's brief: do not touch scripts/lib/'s
// canonicalization helpers -- a concurrent task owns those). Only used for contentHash and deep-
// equality here, never for the KB's shipped signing hash.
// ---------------------------------------------------------------------------------------------
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function deepEqual(a, b) {
  return stableStringify(a ?? null) === stableStringify(b ?? null);
}

function arraysEqualAsSets(a = [], b = []) {
  if (a.length !== b.length) return false;
  const as = [...a].sort();
  const bs = [...b].sort();
  return as.every((v, i) => v === bs[i]);
}

function arraysEqualOrdered(a = [], b = []) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function contentHashOf(snapshot) {
  const combined = [snapshot.rules, snapshot.candidates, snapshot.evidence, snapshot.referenceRanges, snapshot.module]
    .map(stableStringify)
    .join(' ');
  return `sha256:${createHash('sha256').update(combined).digest('hex')}`;
}

// Multiset (bag) diff: two occurrences of the same string that survive unchanged are NOT
// reported. An in-place edit of one array element (same length, one value swapped) reports as
// one removed + one added -- this is the RA-1 detection requirement ("compare array fields by
// multiset, not by length").
function multisetDiff(beforeArr = [], afterArr = []) {
  const beforeCounts = new Map();
  for (const v of beforeArr ?? []) beforeCounts.set(v, (beforeCounts.get(v) ?? 0) + 1);
  const afterCounts = new Map();
  for (const v of afterArr ?? []) afterCounts.set(v, (afterCounts.get(v) ?? 0) + 1);
  const removed = [];
  const added = [];
  for (const [v, count] of beforeCounts) {
    for (let i = 0; i < count - (afterCounts.get(v) ?? 0); i += 1) removed.push(v);
  }
  for (const [v, count] of afterCounts) {
    for (let i = 0; i < count - (beforeCounts.get(v) ?? 0); i += 1) added.push(v);
  }
  return { removed, added };
}

function diffStringArray(beforeArr, afterArr, fieldPath, addClass, removeClass) {
  const { removed, added } = multisetDiff(beforeArr ?? [], afterArr ?? []);
  const out = [];
  for (const v of removed) out.push({ class: removeClass, path: fieldPath, before: v, after: null });
  for (const v of added) out.push({ class: addClass, path: fieldPath, before: null, after: v });
  return out;
}

// ---------------------------------------------------------------------------------------------
// RQ3 -- structural walk of the `when` tree. Dual address: a positional path (`addr`, e.g.
// '$.all[2]') and a content key (ancestor-combinator-types + fact + op, position-independent) so
// array reordering doesn't misreport as N removes+adds, and a moved leaf can still be told apart
// from a different leaf with equal content.
// ---------------------------------------------------------------------------------------------
// `addr` is the DISPLAY/reporting address ('$.all[2]', '$.all[3].any[1].not', ...) -- it embeds
// which combinator (all/any/not) sits at each level, because monotonicity and negation-parity
// both genuinely depend on that. `posAddr` is a SEPARATE, combinator-type-agnostic position path
// (just index chain, 'not' transparent) used ONLY for Step 1/Step 3 slot-identity matching below.
// This split matters: Step 0 already reports an all<->any swap as B10; if leaf matching used the
// type-bearing `addr` (or a key derived from ancestor combinator TYPES) for slot identity, every
// leaf under the swapped node would ALSO fail to match (different addr text) and spuriously
// re-report as a B9+B8 remove/add pair on top of the correct B10 -- exactly the "leaf multiset is
// byte-identical" case B10's own grounding says should be QUIET at the leaf level. `key` (content
// identity: fact+op only) intentionally carries no ancestor information at all, so it is stable
// across both a combinator-type swap AND an array reorder -- both must land on Step 2 (B12) or,
// for the swap case, be fully absorbed by Step 1 with nothing left to report.
export function walkCondition(node, addr = '$', posAddr = '$', negations = 0, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out;
  // An empty object (`when: {}`) is B14's "always true" condition, not a bare leaf with an
  // undefined fact -- evaluateCondition() special-cases it (ruleEngine.js) and B14 detection
  // (below, in diffWhen) handles it explicitly. Emitting a spurious {fact:undefined} leaf here
  // would corrupt Step 1-4 leaf matching around every B14 mutation.
  if (!Array.isArray(node) && Object.keys(node).length === 0) return out;
  if (Array.isArray(node.all)) {
    node.all.forEach((child, i) => walkCondition(child, `${addr}.all[${i}]`, `${posAddr}.${i}`, negations, out));
    return out;
  }
  if (Array.isArray(node.any)) {
    node.any.forEach((child, i) => walkCondition(child, `${addr}.any[${i}]`, `${posAddr}.${i}`, negations, out));
    return out;
  }
  if (Object.prototype.hasOwnProperty.call(node, 'not')) {
    walkCondition(node.not, `${addr}.not`, posAddr, negations + 1, out); // posAddr: 'not' is transparent
    return out;
  }
  const fact = node.fact;
  const opExplicit = Object.prototype.hasOwnProperty.call(node, 'op');
  const op = node.op ?? 'eq';
  out.push({
    addr,
    posAddr,
    fact,
    op,
    opExplicit,
    value: node.value,
    polarity: negations % 2,
    key: JSON.stringify([fact, op]),
  });
  return out;
}

// Step 0's "shape" ignores which combinator (all/any) occupies a node -- only arity/nesting -- so
// an all<->any swap with an identical leaf multiset produces an IDENTICAL shape. `not` is
// transparent to this skeleton (negation is tracked separately, on the leaf, by walkCondition).
export function combinatorSkeleton(node, addr = '$') {
  if (node === null || node === undefined || typeof node !== 'object') return { shape: 'L', keys: [] };
  if (Array.isArray(node.all)) {
    const kids = node.all.map((c, i) => combinatorSkeleton(c, `${addr}.all[${i}]`));
    return {
      shape: `${node.all.length}[${kids.map((k) => k.shape).join(',')}]`,
      keys: [{ addr, type: 'all' }, ...kids.flatMap((k) => k.keys)],
    };
  }
  if (Array.isArray(node.any)) {
    const kids = node.any.map((c, i) => combinatorSkeleton(c, `${addr}.any[${i}]`));
    return {
      shape: `${node.any.length}[${kids.map((k) => k.shape).join(',')}]`,
      keys: [{ addr, type: 'any' }, ...kids.flatMap((k) => k.keys)],
    };
  }
  if (Object.prototype.hasOwnProperty.call(node, 'not')) {
    return combinatorSkeleton(node.not, `${addr}.not`);
  }
  return { shape: 'L', keys: [] };
}

function isEmptyCondition(tree) {
  if (tree === null || tree === undefined) return true;
  return typeof tree === 'object' && !Array.isArray(tree) && Object.keys(tree).length === 0;
}

function parseAncestorTokens(addr) {
  const tokens = [];
  const re = /\.(all|any|not)(\[(\d+)\])?/g;
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(addr))) tokens.push({ type: m[1] });
  return tokens;
}

function directParentCombinator(addr) {
  const tokens = parseAncestorTokens(addr).filter((t) => t.type !== 'not');
  return tokens.length ? tokens[tokens.length - 1].type : null;
}

function negationParityOfAddr(addr) {
  return parseAncestorTokens(addr).filter((t) => t.type === 'not').length % 2;
}

// RQ3 Step 4's monotonicity rule: adding to `all` narrows (stricter -- all must hold); adding to
// `any` broadens; removing is the mirror; each enclosing `not` inverts the direction once.
// No direct parent combinator (a bare-leaf `when`, or a leaf living directly under a `not` with
// nothing else) => 'unknown', which Rule 4 of the decision function fails closed on.
function monotonicityForAddOrRemove(addr, kind) {
  const parent = directParentCombinator(addr);
  if (!parent) return 'unknown';
  let base;
  if (parent === 'all') base = kind === 'add' ? 'narrow' : 'broaden';
  else if (parent === 'any') base = kind === 'add' ? 'broaden' : 'narrow';
  else return 'unknown';
  if (negationParityOfAddr(addr) === 1) base = base === 'narrow' ? 'broaden' : 'narrow';
  return base;
}

// A pure reorder (same direct parent type, same negation parity) is semantically neutral for a
// boolean AND/OR combinator -- 'none', per hand-simulation 2's own stated result. A move that
// changes parent type or parity is treated, for direction purposes, as an add at the new slot.
function monotonicityForMove(beforeAddr, afterAddr) {
  const beforeParent = directParentCombinator(beforeAddr);
  const afterParent = directParentCombinator(afterAddr);
  if (beforeParent === afterParent && negationParityOfAddr(beforeAddr) === negationParityOfAddr(afterAddr)) {
    return 'none';
  }
  return monotonicityForAddOrRemove(afterAddr, 'add');
}

function pathFor(addr, suffix = '') {
  return `when${addr.slice(1)}${suffix}`;
}

// RQ3 Steps 0-4, amended at Step 1 only (RA-2). Returns RAW changes (no file/ruleId/tier yet --
// the caller attaches file/ruleId and safetyRelevance() computes tier).
export function diffWhen(beforeTree, headTree) {
  const raw = [];

  // Step 0 -- combinator skeleton BEFORE leaf matching (ARC-028 property 1/2). Catches an
  // all<->any swap and a not-wrap/unwrap even when the leaf multiset is byte-identical.
  const skelB = combinatorSkeleton(beforeTree);
  const skelA = combinatorSkeleton(headTree);
  if (skelB.shape === skelA.shape) {
    for (let i = 0; i < skelB.keys.length; i += 1) {
      if (skelB.keys[i].type !== skelA.keys[i].type) {
        raw.push({
          class: 'B10 combinator-swap',
          leafAddr: skelB.keys[i].addr,
          path: pathFor(skelB.keys[i].addr),
          before: skelB.keys[i].type,
          after: skelA.keys[i].type,
        });
      }
    }
  }

  const beforeLeaves = walkCondition(beforeTree);
  const headLeaves = walkCondition(headTree);

  // Negation parity, matched purely by content key (independent of Steps 1-4 below). "Negation
  // parity is carried on every emitted leaf, never flattened away" (ARC-028 property 2).
  const beforeByKey = new Map();
  for (const l of beforeLeaves) {
    if (!beforeByKey.has(l.key)) beforeByKey.set(l.key, []);
    beforeByKey.get(l.key).push(l);
  }
  const headByKey = new Map();
  for (const l of headLeaves) {
    if (!headByKey.has(l.key)) headByKey.set(l.key, []);
    headByKey.get(l.key).push(l);
  }
  const negationPairKeys = new Set();
  for (const key of new Set([...beforeByKey.keys(), ...headByKey.keys()])) {
    const bList = beforeByKey.get(key) ?? [];
    const hList = headByKey.get(key) ?? [];
    const n = Math.min(bList.length, hList.length);
    for (let i = 0; i < n; i += 1) {
      if (bList[i].polarity !== hList[i].polarity) {
        negationPairKeys.add(key);
        raw.push({
          class: 'B11 negation-change',
          leafAddr: hList[i].addr,
          path: pathFor(hList[i].addr),
          fact: hList[i].fact,
          op: hList[i].op,
          before: bList[i].polarity === 1 ? 'negated' : 'not-negated',
          after: hList[i].polarity === 1 ? 'negated' : 'not-negated',
        });
      }
    }
  }

  // B14 -- the whole condition collapses to {} / null, which evaluateCondition() treats as an
  // unconditional true (fires on every patient, ruleEngine.js).
  if (isEmptyCondition(headTree) && !isEmptyCondition(beforeTree)) {
    raw.push({ class: 'B14 empty-condition', leafAddr: '$', path: 'when', before: beforeTree, after: headTree });
  }

  const usedBefore = new Set();
  const usedHead = new Set();

  function emitValueLevelChanges(b, h) {
    if (!deepEqual(b.value, h.value)) {
      const cls = classifyValueChange(b.value, h.value);
      raw.push({
        class: cls, leafAddr: h.addr, path: pathFor(h.addr, '.value'),
        fact: h.fact, op: h.op, before: b.value, after: h.value,
      });
    }
    // B13 op-omission: the resolved op is unchanged (both sides normalize to the same string) but
    // the literal `op` key's presence flipped -- a schema-invalid-but-tolerated shape (CCF-4).
    if (b.op === h.op && b.opExplicit !== h.opExplicit) {
      raw.push({
        class: 'B13 op-omission', leafAddr: h.addr, path: pathFor(h.addr, '.op'),
        fact: h.fact, before: b.opExplicit ? b.op : undefined, after: h.opExplicit ? h.op : undefined,
      });
    }
  }

  // Step 1 -- posAddr AND key both match (same slot, same fact/op): a pure value/op-presence
  // edit. Uses posAddr (type-agnostic position), NOT the display addr -- see walkCondition()'s
  // comment: a leaf sitting at the same slot under a swapped all<->any must match here with
  // nothing to report, leaving the swap itself to Step 0 alone.
  for (let hi = 0; hi < headLeaves.length; hi += 1) {
    if (usedHead.has(hi)) continue;
    for (let bi = 0; bi < beforeLeaves.length; bi += 1) {
      if (usedBefore.has(bi)) continue;
      if (beforeLeaves[bi].posAddr === headLeaves[hi].posAddr && beforeLeaves[bi].key === headLeaves[hi].key) {
        usedBefore.add(bi); usedHead.add(hi);
        emitValueLevelChanges(beforeLeaves[bi], headLeaves[hi]);
        break;
      }
    }
  }

  // Step 2 -- key matches, addr differs: the same leaf moved. Skip pairs already fully explained
  // by a negation-parity flip above (their addr change is the `.not` wrap/unwrap itself, not a
  // semantic reorder) to avoid double-reporting B11+B12 for the same edit.
  for (let hi = 0; hi < headLeaves.length; hi += 1) {
    if (usedHead.has(hi)) continue;
    for (let bi = 0; bi < beforeLeaves.length; bi += 1) {
      if (usedBefore.has(bi)) continue;
      if (beforeLeaves[bi].key === headLeaves[hi].key) {
        usedBefore.add(bi); usedHead.add(hi);
        const b = beforeLeaves[bi]; const h = headLeaves[hi];
        if (!negationPairKeys.has(b.key)) {
          const dir = monotonicityForMove(b.addr, h.addr);
          raw.push({
            class: 'B12 subtree-move', leafAddr: h.addr, path: pathFor(h.addr),
            fact: h.fact, op: h.op, before: b.addr, after: h.addr, monotonicity: dir,
          });
        }
        emitValueLevelChanges(b, h);
        break;
      }
    }
  }

  // Step 3 -- posAddr matches, key differs: fact or op changed at a stable slot.
  for (let hi = 0; hi < headLeaves.length; hi += 1) {
    if (usedHead.has(hi)) continue;
    for (let bi = 0; bi < beforeLeaves.length; bi += 1) {
      if (usedBefore.has(bi)) continue;
      if (beforeLeaves[bi].posAddr === headLeaves[hi].posAddr) {
        usedBefore.add(bi); usedHead.add(hi);
        const b = beforeLeaves[bi]; const h = headLeaves[hi];
        const factSame = b.fact === h.fact;
        const opSame = b.op === h.op;
        if (factSame && !opSame) {
          raw.push({ class: 'B2 operator-change', leafAddr: h.addr, path: pathFor(h.addr, '.op'), fact: h.fact, before: b.op, after: h.op });
        } else if (!factSame && opSame) {
          raw.push({ class: 'B7 fact-repoint', leafAddr: h.addr, path: pathFor(h.addr, '.fact'), op: h.op, before: b.fact, after: h.fact });
        } else {
          // RQ3 Step 3's explicit override: both fact AND op differ simultaneously -> reported as
          // a remove/add pair, FORCED to block regardless of what Rule 4's monotonicity would
          // otherwise compute (this is a stable-slot identity change, not an ordinary add/remove).
          raw.push({ class: 'B9 leaf-remove', leafAddr: b.addr, path: pathFor(b.addr), fact: b.fact, op: b.op, before: b.value, after: undefined, forceTier: 'block' });
          raw.push({ class: 'B8 leaf-add', leafAddr: h.addr, path: pathFor(h.addr), fact: h.fact, op: h.op, before: undefined, after: h.value, forceTier: 'block' });
        }
        break;
      }
    }
  }

  // Step 4 -- residue: genuinely new or genuinely removed leaves.
  for (let bi = 0; bi < beforeLeaves.length; bi += 1) {
    if (usedBefore.has(bi)) continue;
    const b = beforeLeaves[bi];
    raw.push({
      class: 'B9 leaf-remove', leafAddr: b.addr, path: pathFor(b.addr), fact: b.fact, op: b.op,
      before: b.value, after: undefined, monotonicity: monotonicityForAddOrRemove(b.addr, 'remove'),
    });
  }
  for (let hi = 0; hi < headLeaves.length; hi += 1) {
    if (usedHead.has(hi)) continue;
    const h = headLeaves[hi];
    raw.push({
      class: 'B8 leaf-add', leafAddr: h.addr, path: pathFor(h.addr), fact: h.fact, op: h.op,
      before: undefined, after: h.value, monotonicity: monotonicityForAddOrRemove(h.addr, 'add'),
    });
  }

  return raw;
}

// ---------------------------------------------------------------------------------------------
// RA-9 -- outputIsProtective(), extended to question outputs and sole-contributor candidates.
// Note-type outputs are deliberately NOT extended (RA-9's own text names only questions and
// sole-contributor candidates) -- a scoped, honest omission, not an oversight; see OQ-12.
// ---------------------------------------------------------------------------------------------
export function outputIsProtective(rule, allRules) {
  const o = rule.output;
  if (o.type === 'alert') return true; // all alert rules
  if (o.type === 'question') return true; // RA-9: all question (missing-data) rules
  if (o.type === 'candidate') {
    if ((LEVEL_RANK[o.level] ?? 0) >= 4) return true; // meets-defined-pattern | strongly-supported
    if ((o.cautions ?? []).length > 0) return true;
    if (isSoleContributor(o.candidateId, rule.id, allRules)) return true; // RA-9
    return false;
  }
  return false; // note-type outputs: NOT extended by RA-9, deliberately
}

export function isSoleContributor(candidateId, ruleId, allRules) {
  const contributors = allRules.filter((r) => r.output?.type === 'candidate' && r.output.candidateId === candidateId);
  return contributors.length === 1 && contributors[0].id === ruleId;
}

// RA-9: "wrap it so a throw is treated as block." Every caller uses THIS wrapper, never the raw
// function, so a malformed rule (missing .output, etc.) fails closed rather than throwing out of
// the classifier entirely.
export function outputIsProtectiveSafe(rule, allRules) {
  try {
    return outputIsProtective(rule, allRules);
  } catch {
    return true;
  }
}

// D4/D6 (candidates.json fields) are catalog-level, not rule-level -- "protective" is evaluated
// at the candidate, sourced from the HIGHEST level/cautions any contributing rule currently
// produces for that candidateId (a mechanical extension of outputIsProtective's own candidate
// branch, not a new judgement call).
export function candidateIsProtective(candidateId, allRules) {
  const contributors = allRules.filter((r) => r.output?.type === 'candidate' && r.output.candidateId === candidateId);
  return contributors.some((r) => (LEVEL_RANK[r.output.level] ?? 0) >= 4)
    || contributors.some((r) => (r.output.cautions ?? []).length > 0);
}

function rank(table, value) {
  return table[value] ?? 0;
}

// ---------------------------------------------------------------------------------------------
// Amended safety-relevance decision function (SPIKE-005 amended section, item 2). Copied as
// closely to the normative code block as the surrounding data model allows.
// ---------------------------------------------------------------------------------------------
export function safetyRelevance(change, allRules) {
  // Not part of the amended function's own text -- an internal escape hatch used ONLY by
  // diffWhen()'s Step 3 "both fact and op differ" pair, per that step's own explicit override.
  if (change.forceTier) return { safetyRelevant: true, tier: change.forceTier };

  const c = change.class; // RA-6: always the FULL form

  if (FIXED_DANGEROUS.has(c)) return { safetyRelevant: true, tier: 'block' };
  if (FIXED_COSMETIC.has(c)) return { safetyRelevant: false, tier: 'note' };

  // Rule 3 -- severity/level monotonicity (ARC-028 property 3: LEVEL_RANK/ALERT_RANK are the
  // engine's own frozen objects, imported, not re-derived).
  if (c === 'C3 level-change') {
    return rank(LEVEL_RANK, change.after) < rank(LEVEL_RANK, change.before)
      ? { safetyRelevant: true, tier: 'block' } : { safetyRelevant: true, tier: 'review' };
  }
  if (c === 'C5 severity-change') {
    return rank(ALERT_RANK, change.after) < rank(ALERT_RANK, change.before)
      ? { safetyRelevant: true, tier: 'block' } : { safetyRelevant: true, tier: 'review' };
  }

  // Rule 4 -- condition-shape edits. outputIsProtectiveSafe is RA-9-extended, so this rule
  // inherits the extension for free.
  if (['B8 leaf-add', 'B9 leaf-remove', 'B12 subtree-move'].includes(c)) {
    const dir = change.monotonicity ?? 'unknown';
    if (dir === 'unknown') return { safetyRelevant: true, tier: 'block' };
    const suppresses = dir === 'narrow';
    const rule = allRules.find((r) => r.id === change.ruleId);
    if (suppresses && outputIsProtectiveSafe(rule, allRules)) return { safetyRelevant: true, tier: 'block' };
    return { safetyRelevant: true, tier: 'review' };
  }

  // Rule 5 -- RA-1: protective-output text edits escalate to block, for ANY edit shape.
  if (['C9 safety-string-add', 'C10 display-text-change', 'D4 candidate-summary-change', 'D6 default-next-step-add'].includes(c)) {
    if (containsTemplate(change.before) !== containsTemplate(change.after)) {
      return { safetyRelevant: true, tier: 'block' }; // C11 escalation, redundant safety net
    }
    const protective = ['D4 candidate-summary-change', 'D6 default-next-step-add'].includes(c)
      ? candidateIsProtective(change.candidateId, allRules)
      : outputIsProtectiveSafe(allRules.find((r) => r.id === change.ruleId), allRules);
    return protective ? { safetyRelevant: true, tier: 'block' } : { safetyRelevant: true, tier: 'review' };
  }

  // Rule 6 -- ordering/weighting/searchable-metadata edits. RA-5/RA-8 join A5, D7, and the
  // narrowed G5 (owner only) to this bucket now that they are no longer fixed-cosmetic.
  if ([
    'A4 rule-reorder', 'A5 rule-category-change', 'C4 points-change', 'C6 priority-change',
    'C7 section-change', 'D3 candidate-label-change', 'D7 candidate-category-change',
    'G1 version-bump', 'G5 owner-annotation-change',
  ].includes(c)) {
    return { safetyRelevant: true, tier: 'review' };
  }

  // Rule 7 -- ARC-028 property #1, unconditional: unknown/unresolved class => block. There is no
  // cosmetic residual bucket. This is where B13 op-omission and 'unnamed-class-fallback' land --
  // see this file's header comment and the EP5-T3 report for the B13/M22 discrepancy this
  // produces relative to the (unmodified-by-the-amendment) seeded-mutation table.
  return { safetyRelevant: true, tier: 'block' };
}

// ---------------------------------------------------------------------------------------------
// RA-3/RA-4 -- cosmeticOnly, isClean, crossCheck.
// ---------------------------------------------------------------------------------------------

// PLACEHOLDER (OQ-10, deliberately unresolved -- do not invent a resolution here). Recording a
// clinical approval is itself a fixed-dangerous G3 attestation-change, so the release gate is
// circular by the amendment's own admission. This fails closed: no block-tier change is ever
// treated as approved by this placeholder, which means isClean() can never be true while any
// block-tier entry exists, until a real (non-circular) attestation mechanism replaces this.
function hasRecordedClinicalApprovalPlaceholder(_change) {
  return false;
}

export function cosmeticOnly({ changes, invariants }) {
  const contentOk = changes.every((c) => c.tier === 'note');
  const invariantsOk = invariants.every((inv) => inv.passed !== false);
  return contentOk && invariantsOk;
}

// requiredTestCaseIds resolution (RA-8): an empty array on a protective-or-changed rule FAILS,
// it does not vacuously pass (the original design's `every` over an empty array was trivially
// true for free).
export function resolveRequiredTestCaseIds(rule, testCaseCorpus, changesForThisRule, allRules) {
  const ids = rule.requiredTestCaseIds ?? [];
  const mustBeNonEmpty = outputIsProtectiveSafe(rule, allRules)
    || changesForThisRule.some((c) => c.tier === 'block' || c.tier === 'review');
  if (mustBeNonEmpty && ids.length === 0) {
    return { resolved: false, reason: 'empty requiredTestCaseIds on a protective or changed rule -- does not vacuously pass' };
  }
  const corpus = testCaseCorpus ?? EMPTY_CORPUS;
  return { resolved: ids.every((id) => corpus.has(id)) };
}

export function isClean({ changes, invariants }, baseRules, headRules, testCaseCorpus) {
  const blockEntries = changes.filter((c) => c.tier === 'block');
  const reviewEntries = changes.filter((c) => c.tier === 'review');

  // Block-tier approval gate: inherits OQ-10's circularity via the placeholder above.
  const blockOk = blockEntries.every((c) => hasRecordedClinicalApprovalPlaceholder(c));

  // RA-3: a block/review entry's rule must show a changeRationale EDIT alongside the content
  // edit, not merely presence (presence is already universal -- every rule carries the identical
  // EP-4 backfill string today, so a non-null check would be vacuous).
  const changeRationaleOk = [...blockEntries, ...reviewEntries].every((c) => {
    if (!c.ruleId) return true; // invariants[]-only entries carry no ruleId; N/A
    const headRule = headRules.find((r) => r.id === c.ruleId);
    const baseRule = baseRules.find((r) => r.id === c.ruleId);
    return Boolean(headRule) && headRule.changeRationale !== (baseRule?.changeRationale ?? null);
  });

  const testBindingsOk = headRules.every((rule) => {
    const changesForRule = changes.filter((c) => c.ruleId === rule.id);
    return resolveRequiredTestCaseIds(rule, testCaseCorpus, changesForRule, headRules).resolved;
  });

  const invariantsOk = invariants.every((inv) => inv.passed !== false);

  return blockOk && changeRationaleOk && testBindingsOk && invariantsOk;
}

// RA-4: re-quantified PER ruleId (closes OQ-9) -- one unrelated review-tier edit anywhere in a
// changeset must not disarm the check for every other rule in that same changeset. Exported as a
// pure utility for a FUTURE orchestrator to call with this module's report and a behavior-probe's
// report; this module's own CLI entrypoint never calls it (property 6).
export function crossCheck(kbDiffReport, probeReport) {
  const failures = [];
  const blockTierRuleIds = new Set(
    kbDiffReport.changes.filter((c) => c.tier === 'block' && c.ruleId).map((c) => c.ruleId),
  );
  for (const delta of probeReport?.deltas ?? []) {
    if (['D1', 'D2', 'D3', 'D4'].includes(delta.class) && !blockTierRuleIds.has(delta.ruleId)) {
      failures.push({
        ruleId: delta.ruleId,
        probeDelta: delta.class,
        kbDiffTierForRule: kbDiffReport.changes.find((c) => c.ruleId === delta.ruleId)?.tier ?? 'none-reported',
      });
    }
  }
  if (kbDiffReport.invariants.some((inv) => inv.passed === false) && kbDiffReport.summary.cosmeticOnly === true) {
    failures.push({ ruleId: null, reason: 'invariant failed but cosmeticOnly reported true' });
  }
  return failures;
}

const EMPTY_CORPUS = { has: () => false };

// ---------------------------------------------------------------------------------------------
// Family A + rule-level orchestration (rules.json).
// ---------------------------------------------------------------------------------------------
function structuralSignature(rule) {
  return stableStringify({ when: rule.when, output: rule.output });
}

// RQ3 Step 5: match rules by id first. Any rule present on exactly one side is then re-matched
// against the other side's orphans by structural hash of {when, output}; a match is A3 (rename),
// NOT remove+add and NOT cosmetic.
function pairRules(baseRules, headRules) {
  const baseById = new Map(baseRules.map((r, i) => [r.id, { rule: r, index: i }]));
  const headById = new Map(headRules.map((r, i) => [r.id, { rule: r, index: i }]));

  const matchedIds = [...baseById.keys()].filter((id) => headById.has(id));
  const onlyInBase = [...baseById.keys()].filter((id) => !headById.has(id));
  const onlyInHead = [...headById.keys()].filter((id) => !baseById.has(id));

  const renamed = [];
  const usedBase = new Set();
  const usedHead = new Set();
  for (const bId of onlyInBase) {
    const bSig = structuralSignature(baseById.get(bId).rule);
    for (const hId of onlyInHead) {
      if (usedHead.has(hId)) continue;
      if (structuralSignature(headById.get(hId).rule) === bSig) {
        renamed.push({ baseId: bId, headId: hId });
        usedBase.add(bId); usedHead.add(hId);
        break;
      }
    }
  }

  return {
    matchedIds,
    renamed,
    removedIds: onlyInBase.filter((id) => !usedBase.has(id)),
    addedIds: onlyInHead.filter((id) => !usedHead.has(id)),
    baseById,
    headById,
  };
}

function findDuplicateRuleIds(rules, file) {
  const counts = new Map();
  for (const r of rules) counts.set(r.id, (counts.get(r.id) ?? 0) + 1);
  const out = [];
  for (const [id, count] of counts) {
    if (count > 1) out.push({ class: 'A6 rule-duplicate-id', file, ruleId: id, path: 'id', before: id, after: id });
  }
  return out;
}

function diffEvidenceRefs(baseArr, headArr, resolvableIdsHead) {
  const removed = baseArr.filter((id) => !headArr.includes(id));
  const added = headArr.filter((id) => !baseArr.includes(id));
  const out = [];
  if (removed.length === 1 && added.length === 1) {
    out.push({ class: 'E3 evidence-repoint', before: removed[0], after: added[0] });
  } else {
    for (const id of added) out.push({ class: 'E1 evidence-ref-add', before: null, after: id });
    for (const id of removed) out.push({ class: 'E2 evidence-ref-remove', before: id, after: null });
  }
  for (const id of headArr) {
    if (!resolvableIdsHead.has(id)) out.push({ class: 'E4 evidence-dangling-ref', before: null, after: id });
  }
  return out;
}

function diffRule(baseRule, headRule, headEvidenceIds, knownRuleKeys) {
  const out = [];
  const ruleId = headRule.id;

  for (const key of Object.keys(headRule)) {
    if (!knownRuleKeys.has(key)) {
      out.push({ class: 'A7 unknown-key-add', file: RULES_FILE, ruleId, path: key, before: null, after: headRule[key] });
    }
  }
  // A7's own grounding text: "a key not in rule.schema.json appears on a rule/OUTPUT" -- checked
  // against whichever oneOf branch (candidate/alert/question/note) headRule.output.type selects.
  const outputKnownKeys = KNOWN_OUTPUT_KEYS[headRule.output?.type];
  if (outputKnownKeys) {
    for (const key of Object.keys(headRule.output ?? {})) {
      if (!outputKnownKeys.has(key)) {
        out.push({ class: 'A7 unknown-key-add', file: RULES_FILE, ruleId, path: `output.${key}`, before: null, after: headRule.output[key] });
      }
    }
  }

  if (baseRule.category !== headRule.category) {
    out.push({ class: 'A5 rule-category-change', file: RULES_FILE, ruleId, path: 'category', before: baseRule.category, after: headRule.category });
  }

  out.push(...diffWhen(baseRule.when, headRule.when).map((c) => ({ ...c, file: RULES_FILE, ruleId })));

  const bo = baseRule.output ?? {};
  const ho = headRule.output ?? {};
  if (bo.type !== ho.type) {
    out.push({ class: 'C1 output-type-change', file: RULES_FILE, ruleId, path: 'output.type', before: bo.type, after: ho.type });
  } else if (ho.type === 'candidate') {
    if (bo.candidateId !== ho.candidateId) {
      out.push({ class: 'C2 candidate-target-change', file: RULES_FILE, ruleId, path: 'output.candidateId', before: bo.candidateId, after: ho.candidateId });
    }
    if (bo.level !== ho.level) {
      out.push({ class: 'C3 level-change', file: RULES_FILE, ruleId, path: 'output.level', before: bo.level, after: ho.level });
    }
    if (Number(bo.points ?? 0) !== Number(ho.points ?? 0)) {
      out.push({ class: 'C4 points-change', file: RULES_FILE, ruleId, path: 'output.points', before: bo.points, after: ho.points });
    }
    out.push(...diffStringArray(bo.support, ho.support, 'output.support', 'C9 safety-string-add', 'C8 safety-string-remove').map((c) => ({ ...c, file: RULES_FILE, ruleId })));
    out.push(...diffStringArray(bo.cautions, ho.cautions, 'output.cautions', 'C9 safety-string-add', 'C8 safety-string-remove').map((c) => ({ ...c, file: RULES_FILE, ruleId })));
    out.push(...diffStringArray(bo.nextSteps, ho.nextSteps, 'output.nextSteps', 'C9 safety-string-add', 'C8 safety-string-remove').map((c) => ({ ...c, file: RULES_FILE, ruleId })));
  } else if (ho.type === 'alert') {
    if (bo.severity !== ho.severity) {
      out.push({ class: 'C5 severity-change', file: RULES_FILE, ruleId, path: 'output.severity', before: bo.severity, after: ho.severity });
    }
    if (bo.title !== ho.title) out.push({ class: classifyTextEdit(bo.title, ho.title), file: RULES_FILE, ruleId, path: 'output.title', before: bo.title ?? null, after: ho.title ?? null });
    if (bo.detail !== ho.detail) out.push({ class: classifyTextEdit(bo.detail, ho.detail), file: RULES_FILE, ruleId, path: 'output.detail', before: bo.detail ?? null, after: ho.detail ?? null });
    out.push(...diffStringArray(bo.actions, ho.actions, 'output.actions', 'C9 safety-string-add', 'C8 safety-string-remove').map((c) => ({ ...c, file: RULES_FILE, ruleId })));
  } else if (ho.type === 'question') {
    if (Number(bo.priority ?? 0) !== Number(ho.priority ?? 0)) {
      out.push({ class: 'C6 priority-change', file: RULES_FILE, ruleId, path: 'output.priority', before: bo.priority, after: ho.priority });
    }
    if (bo.section !== ho.section) {
      out.push({ class: 'C7 section-change', file: RULES_FILE, ruleId, path: 'output.section', before: bo.section, after: ho.section });
    }
    // RA-1's own field-list extension (prompt/why == the question-output equivalents of
    // title/detail) so RA-9's extension of outputIsProtective() to questions has a protective-
    // text class to route a question rule's own text into.
    if (bo.prompt !== ho.prompt) out.push({ class: classifyTextEdit(bo.prompt, ho.prompt), file: RULES_FILE, ruleId, path: 'output.prompt', before: bo.prompt ?? null, after: ho.prompt ?? null });
    if (bo.why !== ho.why) out.push({ class: classifyTextEdit(bo.why, ho.why), file: RULES_FILE, ruleId, path: 'output.why', before: bo.why ?? null, after: ho.why ?? null });
  } else if (ho.type === 'note') {
    if (bo.title !== ho.title) out.push({ class: classifyTextEdit(bo.title, ho.title), file: RULES_FILE, ruleId, path: 'output.title', before: bo.title ?? null, after: ho.title ?? null });
    if (bo.detail !== ho.detail) out.push({ class: classifyTextEdit(bo.detail, ho.detail), file: RULES_FILE, ruleId, path: 'output.detail', before: bo.detail ?? null, after: ho.detail ?? null });
  }
  if (bo.type === ho.type && !arraysEqualAsSets(bo.evidence ?? [], ho.evidence ?? [])) {
    out.push({ class: 'C12 output-evidence-change', file: RULES_FILE, ruleId, path: 'output.evidence', before: bo.evidence ?? [], after: ho.evidence ?? [] });
  }

  out.push(...diffEvidenceRefs(baseRule.evidence ?? [], headRule.evidence ?? [], headEvidenceIds).map((c) => ({ ...c, file: RULES_FILE, ruleId, path: c.path ?? 'evidence' })));

  if (baseRule.owner !== headRule.owner) {
    out.push({ class: 'G5 owner-annotation-change', file: RULES_FILE, ruleId, path: 'owner', before: baseRule.owner, after: headRule.owner });
  }

  // RA-8 (see this file's header + EP5-T3 report): the amended prose describes a narrower G6
  // trigger with a "G5-adjacent review" residual for a non-emptying edit, but the amended "Full
  // amended function" code block places G6 unconditionally in FIXED_DANGEROUS with no residual
  // path. Fail-closed reading taken here: EVERY requiredTestCaseIds edit is classified G6 (block)
  // -- this over-blocks a pure-growth edit relative to the prose's carve-out, deliberately.
  const beforeIds = baseRule.requiredTestCaseIds ?? [];
  const afterIds = headRule.requiredTestCaseIds ?? [];
  if (!arraysEqualOrdered(beforeIds, afterIds)) {
    out.push({ class: 'G6 protective-test-binding-remove', file: RULES_FILE, ruleId, path: 'requiredTestCaseIds', before: beforeIds, after: afterIds });
  }

  if (baseRule.sourcePassageId !== headRule.sourcePassageId) {
    out.push({ class: 'E8 sourcePassageId-repoint', file: RULES_FILE, ruleId, path: 'sourcePassageId', before: baseRule.sourcePassageId, after: headRule.sourcePassageId });
  }

  // OQ-15 (amended section, item 7): version/effectiveDate/retireDate/safetyClass remain
  // genuinely unmapped in the taxonomy. Fail-closed reading: route through the honest,
  // observability-only fallback rather than silently ignoring or inventing a class for them.
  for (const field of ['version', 'effectiveDate', 'retireDate', 'safetyClass']) {
    if (baseRule[field] !== headRule[field]) {
      out.push({ class: 'unnamed-class-fallback', file: RULES_FILE, ruleId, path: field, before: baseRule[field] ?? null, after: headRule[field] ?? null });
    }
  }
  if (!arraysEqualAsSets(baseRule.clinicalApprovers ?? [], headRule.clinicalApprovers ?? [])) {
    out.push({ class: 'unnamed-class-fallback', file: RULES_FILE, ruleId, path: 'clinicalApprovers', before: baseRule.clinicalApprovers ?? [], after: headRule.clinicalApprovers ?? [] });
  }
  // changeRationale is deliberately NOT independently classified (RA-8): it is load-bearing for
  // isClean()'s changeRationaleOk gate, and diffing it as its own safety event would penalize the
  // exact action RA-3 exists to require.

  return out;
}

// ---------------------------------------------------------------------------------------------
// Family D (candidates.json).
// ---------------------------------------------------------------------------------------------
function diffCandidates(baseCandidates, headCandidates, headEvidenceIds, knownCandidateKeys) {
  const out = [];
  const baseKeys = Object.keys(baseCandidates ?? {});
  const headKeys = Object.keys(headCandidates ?? {});

  for (const key of headKeys) {
    if (!baseKeys.includes(key)) {
      out.push({ class: 'D1 candidate-add', file: CANDIDATES_FILE, candidateId: key, path: 'id', before: null, after: key });
    }
  }
  for (const key of baseKeys) {
    if (!headKeys.includes(key)) {
      out.push({ class: 'D2 candidate-remove', file: CANDIDATES_FILE, candidateId: key, path: 'id', before: key, after: null });
    }
  }
  for (const [key, obj] of Object.entries(headCandidates ?? {})) {
    if (obj?.id !== key) {
      out.push({ class: 'D9 candidate-key-id-mismatch', file: CANDIDATES_FILE, candidateId: key, path: 'id', before: key, after: obj?.id ?? null });
    }
    for (const k of Object.keys(obj ?? {})) {
      if (!knownCandidateKeys.has(k)) {
        out.push({ class: 'A7 unknown-key-add', file: CANDIDATES_FILE, candidateId: key, path: k, before: null, after: obj[k] });
      }
    }
  }

  for (const key of headKeys) {
    if (!baseKeys.includes(key)) continue;
    const b = baseCandidates[key];
    const h = headCandidates[key];
    if (b.label !== h.label) {
      out.push({ class: 'D3 candidate-label-change', file: CANDIDATES_FILE, candidateId: key, path: 'label', before: b.label, after: h.label });
    }
    if (b.category !== h.category) {
      out.push({ class: 'D7 candidate-category-change', file: CANDIDATES_FILE, candidateId: key, path: 'category', before: b.category, after: h.category });
    }
    if (b.summary !== h.summary) {
      // C11 template-binding-change is not grounded for candidates: mergeCandidate() spreads
      // candidates.json content verbatim, it never runs it through interpolate() -- so a
      // candidate summary can never carry a live {{...}} template. Always D4.
      out.push({ class: 'D4 candidate-summary-change', file: CANDIDATES_FILE, candidateId: key, path: 'summary', before: b.summary ?? null, after: h.summary ?? null });
    }
    out.push(...diffStringArray(b.defaultNextSteps, h.defaultNextSteps, 'defaultNextSteps', 'D6 default-next-step-add', 'D5 default-next-step-remove').map((c) => ({ ...c, file: CANDIDATES_FILE, candidateId: key })));
    if (!arraysEqualAsSets(b.evidence ?? [], h.evidence ?? [])) {
      out.push({ class: 'D8 candidate-evidence-change', file: CANDIDATES_FILE, candidateId: key, path: 'evidence', before: b.evidence ?? [], after: h.evidence ?? [] });
    }
    if (b.sourcePassageId !== h.sourcePassageId) {
      // Scoped extension beyond RA-7's literal text (which names the RULE-level sourcePassageId
      // field): candidate.schema.json's own description says this field "mirrors
      // rule.schema.json's field of the same name and shape" -- E8 applies identically here.
      out.push({ class: 'E8 sourcePassageId-repoint', file: CANDIDATES_FILE, candidateId: key, path: 'sourcePassageId', before: b.sourcePassageId ?? null, after: h.sourcePassageId ?? null });
    }
  }

  // Silently referenced-but-unresolvable evidence ids on a candidate are exactly as dangerous as
  // on a rule (D8 already fires on ANY evidence[] change; this additionally flags a head-state
  // id that never resolves at all, mirroring E4's rule-level check).
  for (const key of headKeys) {
    for (const id of headCandidates[key]?.evidence ?? []) {
      if (!headEvidenceIds.has(id)) {
        out.push({ class: 'unnamed-class-fallback', file: CANDIDATES_FILE, candidateId: key, path: 'evidence', before: null, after: id, note: 'dangling candidate evidence id (no D-family class covers this explicitly)' });
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------------------------
// Family E (evidence.json) -- E5 only. E1-E4 are per-rule (diffEvidenceRefs above); E7 is an
// invariant (computeInvariants); E8 is per-rule/candidate sourcePassageId (above); E6 is retired.
// ---------------------------------------------------------------------------------------------
function diffEvidenceRegistry(baseEvidence, headEvidence) {
  const out = [];
  const baseSources = new Map((baseEvidence?.sources ?? []).map((s) => [s.id, s]));
  const headSources = new Map((headEvidence?.sources ?? []).map((s) => [s.id, s]));
  for (const [id, headSource] of headSources) {
    const baseSource = baseSources.get(id);
    if (!baseSource) {
      // No RQ1 class covers "a whole new source record added to evidence.json" -- honest gap,
      // fails closed via the unnamed fallback rather than silently ignored.
      out.push({ class: 'unnamed-class-fallback', file: EVIDENCE_FILE, path: `sources[${id}]`, before: null, after: id, note: 'new evidence source record (no dedicated RQ1 class)' });
      continue;
    }
    if (!deepEqual(baseSource, headSource)) {
      out.push({ class: 'E5 evidence-record-content-change', file: EVIDENCE_FILE, path: `sources[${id}]`, before: baseSource, after: headSource });
    }
  }
  for (const [id] of baseSources) {
    if (!headSources.has(id)) {
      out.push({ class: 'unnamed-class-fallback', file: EVIDENCE_FILE, path: `sources[${id}]`, before: id, after: null, note: 'evidence source record removed (no dedicated RQ1 class)' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Family F (reference-ranges.json).
// ---------------------------------------------------------------------------------------------
function diffReferenceRanges(baseRanges, headRanges) {
  const out = [];
  if (baseRanges?.source !== headRanges?.source) {
    out.push({ class: 'F7 range-source-change', file: RANGES_FILE, path: 'source', before: baseRanges?.source ?? null, after: headRanges?.source ?? null });
  }
  if (baseRanges?.scope !== headRanges?.scope) {
    out.push({ class: 'F8 range-scope-change', file: RANGES_FILE, path: 'scope', before: baseRanges?.scope ?? null, after: headRanges?.scope ?? null });
  }
  for (const field of ['hb', 'mcv', 'rdw']) {
    const bv = baseRanges?.units?.[field];
    const hv = headRanges?.units?.[field];
    if (bv !== hv) out.push({ class: 'F6 units-change', file: RANGES_FILE, path: `units.${field}`, before: bv ?? null, after: hv ?? null });
  }

  const baseBands = new Map((baseRanges?.ranges ?? []).map((b) => [b.label, b]));
  const headBands = new Map((headRanges?.ranges ?? []).map((b) => [b.label, b]));
  for (const [label, band] of headBands) {
    if (!baseBands.has(label)) out.push({ class: 'F3 band-add', file: RANGES_FILE, path: `ranges[${label}]`, before: null, after: band });
  }
  for (const [label, band] of baseBands) {
    if (!headBands.has(label)) out.push({ class: 'F4 band-remove', file: RANGES_FILE, path: `ranges[${label}]`, before: band, after: null });
  }

  for (const [label, headBand] of headBands) {
    const baseBand = baseBands.get(label);
    if (!baseBand) continue;

    if (baseBand.minMonths !== headBand.minMonths || baseBand.maxMonthsExclusive !== headBand.maxMonthsExclusive) {
      out.push({
        class: 'F2 band-boundary-change', file: RANGES_FILE, path: `ranges[${label}].minMonths/maxMonthsExclusive`,
        before: { minMonths: baseBand.minMonths, maxMonthsExclusive: baseBand.maxMonthsExclusive },
        after: { minMonths: headBand.minMonths, maxMonthsExclusive: headBand.maxMonthsExclusive },
      });
    }

    for (const field of ['hb', 'mcv', 'rdw']) {
      const bv = baseBand.units?.[field];
      const hv = headBand.units?.[field];
      if (bv !== hv) out.push({ class: 'F6 units-change', file: RANGES_FILE, path: `ranges[${label}].units.${field}`, before: bv ?? null, after: hv ?? null });
    }

    const swapped = headBand.female && headBand.male && baseBand.female && baseBand.male
      && deepEqual(headBand.female, baseBand.male) && deepEqual(headBand.male, baseBand.female)
      && !deepEqual(baseBand.female, baseBand.male);
    if (swapped) {
      out.push({ class: 'F5 sex-field-transposition', file: RANGES_FILE, path: `ranges[${label}]`, before: { female: baseBand.female, male: baseBand.male }, after: { female: headBand.female, male: headBand.male } });
    } else {
      for (const sex of ['female', 'male']) {
        for (const field of ['hbLower', 'mcvLower', 'mcvUpper', 'rdwUpper']) {
          const bv = baseBand[sex]?.[field];
          const hv = headBand[sex]?.[field];
          if (bv !== hv) out.push({ class: 'F1 range-value-change', file: RANGES_FILE, path: `ranges[${label}].${sex}.${field}`, before: bv ?? null, after: hv ?? null });
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Family G (module.json) -- per-hunk classes only. G2 version-omission is an invariant (below).
// ---------------------------------------------------------------------------------------------
function diffModuleManifest(baseModule, headModule) {
  const out = [];
  if (baseModule?.knowledgeBaseVersion !== headModule?.knowledgeBaseVersion
    || baseModule?.evidenceReviewedThrough !== headModule?.evidenceReviewedThrough) {
    out.push({
      class: 'G1 version-bump', file: MODULE_FILE, path: 'knowledgeBaseVersion/evidenceReviewedThrough',
      before: { knowledgeBaseVersion: baseModule?.knowledgeBaseVersion ?? null, evidenceReviewedThrough: baseModule?.evidenceReviewedThrough ?? null },
      after: { knowledgeBaseVersion: headModule?.knowledgeBaseVersion ?? null, evidenceReviewedThrough: headModule?.evidenceReviewedThrough ?? null },
    });
  }
  // clinicalContentHash/governanceHash are attestation-adjacent hash fields introduced alongside
  // module.json's signing work (a concurrent EP5-T1 task); tracked here as G3 like the other
  // attestation fields since a hash changing unrecorded is exactly G3's concern.
  for (const field of ['approvedBy', 'validationRunId', 'clinicalContentHash', 'governanceHash', 'status', 'releasedAt', 'supersedes']) {
    const bv = baseModule?.[field];
    const hv = headModule?.[field];
    if (!deepEqual(bv, hv)) {
      out.push({ class: 'G3 attestation-change', file: MODULE_FILE, path: field, before: bv ?? null, after: hv ?? null });
    }
  }
  if (!deepEqual(baseModule?.supportedAgeMonths, headModule?.supportedAgeMonths)) {
    out.push({ class: 'G4 manifest-declarative-change', file: MODULE_FILE, path: 'supportedAgeMonths', before: baseModule?.supportedAgeMonths ?? null, after: headModule?.supportedAgeMonths ?? null });
  }
  for (const field of ['title', 'engineLabel', 'schemaVersion']) {
    if (baseModule?.[field] !== headModule?.[field]) {
      out.push({ class: 'G4 manifest-declarative-change', file: MODULE_FILE, path: field, before: baseModule?.[field] ?? null, after: headModule?.[field] ?? null });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// invariants[] (ARC-028 property 3): G2 version-omission, the redefined E7 three-way drift, F2
// band continuity, and the renamed unnamed-class-fallback counter.
// ---------------------------------------------------------------------------------------------
function computeInvariants({ changes, baseModule, headModule, baseEvidence, headEvidence, headIndexManifest, headReferenceRanges }) {
  const invariants = [];

  const versionUnchanged = (headModule?.knowledgeBaseVersion ?? null) === (baseModule?.knowledgeBaseVersion ?? null);
  const nonCosmeticContentChanges = changes.filter((c) => c.file !== MODULE_FILE && c.tier !== 'note');
  const g2Passed = !(versionUnchanged && nonCosmeticContentChanges.length > 0);
  invariants.push({
    id: 'G2 version-omission',
    passed: g2Passed,
    detail: g2Passed
      ? "module.json's knowledgeBaseVersion moved alongside content changes, or no non-cosmetic content changed."
      : `${nonCosmeticContentChanges.length} non-cosmetic content change(s) landed with knowledgeBaseVersion unchanged -- the release is labelled as an already-approved version.`,
  });

  // RA-7: redefined against the three-way drift that actually exists (module.json,
  // evidence.json, modules/anemia/index.js), evaluated on HEAD only -- a property of the
  // after-state, like G2.
  const triples = [
    { label: 'evidence.json', kbVersion: headEvidence?.knowledgeBaseVersion ?? null, reviewedThrough: headEvidence?.reviewedThrough ?? null },
    { label: 'module.json', kbVersion: headModule?.knowledgeBaseVersion ?? null, reviewedThrough: headModule?.evidenceReviewedThrough ?? null },
    { label: INDEX_FILE, kbVersion: headIndexManifest?.knowledgeBaseVersion ?? null, reviewedThrough: headIndexManifest?.evidenceReviewedThrough ?? null },
  ];
  const kbVersions = new Set(triples.map((t) => t.kbVersion));
  const reviewedThroughs = new Set(triples.map((t) => t.reviewedThrough));
  const e7Passed = kbVersions.size === 1 && reviewedThroughs.size === 1;
  invariants.push({
    id: 'E7 evidence-dual-source-drift',
    passed: e7Passed,
    detail: e7Passed
      ? 'evidence.json, module.json, and modules/anemia/index.js agree on knowledgeBaseVersion/reviewedThrough.'
      : `Version/reviewedThrough split across sources: ${JSON.stringify(triples)}.`,
  });

  const bands = [...(headReferenceRanges?.ranges ?? [])].sort((a, b) => (a.minMonths ?? 0) - (b.minMonths ?? 0));
  const gaps = [];
  for (let i = 0; i < bands.length - 1; i += 1) {
    if (bands[i].maxMonthsExclusive !== bands[i + 1].minMonths) {
      gaps.push(`${bands[i].label ?? i}(maxMonthsExclusive=${bands[i].maxMonthsExclusive}) vs ${bands[i + 1].label ?? i + 1}(minMonths=${bands[i + 1].minMonths})`);
    }
  }
  invariants.push({
    id: 'F2 band-boundary-continuity',
    passed: gaps.length === 0,
    detail: gaps.length === 0
      ? 'reference-ranges.json bands are contiguous, no gap or overlap.'
      : `Discontinuity: ${gaps.join('; ')}.`,
  });

  // Pure observability counter (item 5 of the amendment): under Rule 7's unconditional
  // fail-closed default this can never gate anything (every unresolved class already routes to
  // block) -- so it deliberately carries NO `passed` field, only a count.
  invariants.push({ id: 'unnamed-class-fallback', count: changes.filter((c) => c.class === 'unnamed-class-fallback').length });

  return invariants;
}

// ---------------------------------------------------------------------------------------------
// Report assembly.
// ---------------------------------------------------------------------------------------------
function changeSortKey(c) {
  return [c.file ?? '', c.ruleId ?? '', c.candidateId ?? '', c.class, c.path ?? '', JSON.stringify(c.before ?? null), JSON.stringify(c.after ?? null)].join('');
}

function sortChanges(changes) {
  return [...changes].sort((a, b) => {
    const ka = changeSortKey(a);
    const kb = changeSortKey(b);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });
}

function finalizeChange(raw, headRules) {
  const tierInfo = safetyRelevance(raw, headRules);
  const rule = raw.ruleId ? headRules.find((r) => r.id === raw.ruleId) : null;
  const outputProtective = raw.ruleId
    ? outputIsProtectiveSafe(rule, headRules)
    : raw.candidateId
      ? candidateIsProtective(raw.candidateId, headRules)
      : null;
  return {
    class: raw.class,
    family: /^[A-Z]/.test(raw.class) ? raw.class[0] : null,
    safetyRelevant: tierInfo.safetyRelevant,
    tier: tierInfo.tier,
    file: raw.file ?? null,
    ruleId: raw.ruleId ?? null,
    candidateId: raw.candidateId ?? null,
    path: raw.path ?? null,
    leafAddr: raw.leafAddr ?? null,
    fact: raw.fact ?? null,
    op: raw.op ?? null,
    before: raw.before === undefined ? null : raw.before,
    after: raw.after === undefined ? null : raw.after,
    monotonicity: raw.monotonicity ?? null,
    outputProtective,
  };
}

/**
 * Pure classifier: given already-parsed base/head snapshots, produces the full RQ4 report. No
 * disk I/O -- see diffKB() below for the CLI-facing file/git-ref loader.
 *
 * `base`/`head` shape: { rules: Rule[], candidates: {[id]: Candidate}, evidence: EvidenceFile,
 * referenceRanges: RangesFile, module: ModuleManifest, indexManifest?: {knowledgeBaseVersion,
 * evidenceReviewedThrough} }.
 *
 * `testCaseCorpus` (optional): an object with a `.has(id)` method used to resolve
 * requiredTestCaseIds against real fixtures. Defaults to EMPTY_CORPUS (nothing resolves) --
 * fail-closed for the pure/unit-test path; diffKB() supplies a disk-backed corpus for real runs.
 */
export function classifyKB({ base, head, baseRef = 'base', headRef = 'head', moduleId = 'anemia', testCaseCorpus }) {
  const baseRules = base.rules ?? [];
  const headRules = head.rules ?? [];
  const headEvidenceIds = new Set((head.evidence?.sources ?? []).map((s) => s.id));

  const rawChanges = [];
  rawChanges.push(...findDuplicateRuleIds(baseRules, RULES_FILE));
  rawChanges.push(...findDuplicateRuleIds(headRules, RULES_FILE));

  const pairing = pairRules(baseRules, headRules);
  for (const id of pairing.addedIds) {
    rawChanges.push({ class: 'A1 rule-add', file: RULES_FILE, ruleId: id, path: 'id', before: null, after: id });
  }
  for (const id of pairing.removedIds) {
    rawChanges.push({ class: 'A2 rule-remove', file: RULES_FILE, ruleId: id, path: 'id', before: id, after: null });
  }
  for (const { baseId, headId } of pairing.renamed) {
    rawChanges.push({ class: 'A3 rule-id-change', file: RULES_FILE, ruleId: headId, path: 'id', before: baseId, after: headId });
  }
  for (const id of pairing.matchedIds) {
    const baseEntry = pairing.baseById.get(id);
    const headEntry = pairing.headById.get(id);
    const ruleChanges = diffRule(baseEntry.rule, headEntry.rule, headEvidenceIds, DEFAULT_KNOWN_RULE_KEYS);
    if (ruleChanges.length === 0 && baseEntry.index !== headEntry.index) {
      rawChanges.push({ class: 'A4 rule-reorder', file: RULES_FILE, ruleId: id, path: null, before: baseEntry.index, after: headEntry.index });
    } else {
      rawChanges.push(...ruleChanges);
    }
  }

  rawChanges.push(...diffCandidates(base.candidates ?? {}, head.candidates ?? {}, headEvidenceIds, DEFAULT_KNOWN_CANDIDATE_KEYS));
  rawChanges.push(...diffEvidenceRegistry(base.evidence, head.evidence));
  rawChanges.push(...diffReferenceRanges(base.referenceRanges, head.referenceRanges));
  rawChanges.push(...diffModuleManifest(base.module, head.module));

  const changes = sortChanges(rawChanges.map((raw) => finalizeChange(raw, headRules)));

  const invariants = computeInvariants({
    changes,
    baseModule: base.module,
    headModule: head.module,
    baseEvidence: base.evidence,
    headEvidence: head.evidence,
    baseIndexManifest: base.indexManifest,
    headIndexManifest: head.indexManifest,
    headReferenceRanges: head.referenceRanges,
  });

  const block = changes.filter((c) => c.tier === 'block').length;
  const review = changes.filter((c) => c.tier === 'review').length;
  const note = changes.filter((c) => c.tier === 'note').length;
  const summaryCore = { changes, invariants };
  const cosmetic = cosmeticOnly(summaryCore);
  const clean = isClean(summaryCore, baseRules, headRules, testCaseCorpus ?? EMPTY_CORPUS);

  return {
    schemaVersion: 1,
    moduleId,
    from: { ref: baseRef, knowledgeBaseVersion: base.module?.knowledgeBaseVersion ?? null, contentHash: contentHashOf(base) },
    to: { ref: headRef, knowledgeBaseVersion: head.module?.knowledgeBaseVersion ?? null, contentHash: contentHashOf(head) },
    // Property 5, unconditional: emitted on EVERY report, including an empty changeset, so no
    // reader can mistake a clean structural report for a clean behavioral one.
    scope: { filesDiffed: [...FILES_DIFFED], filesNotDiffed: [...FILES_NOT_DIFFED], blindSpotWarning: BLIND_SPOT_WARNING },
    changes,
    invariants,
    summary: { block, review, note, cosmeticOnly: cosmetic, clean },
  };
}

// ---------------------------------------------------------------------------------------------
// CLI-facing file/git-ref loader. `base` may be a directory OR a git ref (read-only `git show`,
// never a checkout/mutation); `head` per the CLI contract is a directory (a live snapshot dir is
// also tolerated defensively, though not officially supported).
// ---------------------------------------------------------------------------------------------
function gitShow(repoRoot, ref, relPath) {
  return execFileSync('git', ['show', `${ref}:${relPath}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function extractIndexManifest(text) {
  const kbMatch = text.match(/knowledgeBaseVersion:\s*'([^']*)'/);
  const rtMatch = text.match(/evidenceReviewedThrough:\s*'([^']*)'/);
  return {
    knowledgeBaseVersion: kbMatch ? kbMatch[1] : null,
    evidenceReviewedThrough: rtMatch ? rtMatch[1] : null,
  };
}

async function isDirectory(candidate) {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

async function loadSnapshot(spec, repoRoot) {
  const abs = path.isAbsolute(spec) ? spec : path.resolve(repoRoot, spec);
  const dirMode = await isDirectory(abs);
  const read = dirMode
    ? (relPath) => readFile(path.join(abs, relPath), 'utf8')
    : (relPath) => Promise.resolve(gitShow(repoRoot, spec, relPath));

  const [rulesText, candidatesText, evidenceText, rangesText, moduleText, indexText] = await Promise.all([
    read(RULES_FILE), read(CANDIDATES_FILE), read(EVIDENCE_FILE), read(RANGES_FILE), read(MODULE_FILE), read(INDEX_FILE),
  ]);

  return {
    rules: JSON.parse(rulesText),
    candidates: JSON.parse(candidatesText),
    evidence: JSON.parse(evidenceText),
    referenceRanges: JSON.parse(rangesText),
    module: JSON.parse(moduleText),
    indexManifest: extractIndexManifest(indexText),
  };
}

function buildTestCaseCorpus(headAbsDir) {
  return {
    has(id) {
      try {
        return fsSync.existsSync(path.join(headAbsDir, id));
      } catch {
        return false;
      }
    },
  };
}

/** CLI-facing async entrypoint. Resolves base/head (dir or, for base, git ref) and classifies. */
export async function diffKB({ baseSpec, headSpec, repoRoot = process.cwd() }) {
  const base = await loadSnapshot(baseSpec, repoRoot);
  const head = await loadSnapshot(headSpec, repoRoot);
  const headAbs = path.isAbsolute(headSpec) ? headSpec : path.resolve(repoRoot, headSpec);
  const testCaseCorpus = (await isDirectory(headAbs)) ? buildTestCaseCorpus(headAbs) : EMPTY_CORPUS;
  return classifyKB({ base, head, baseRef: baseSpec, headRef: headSpec, testCaseCorpus });
}

// ---------------------------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { base: null, head: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--base') { args.base = argv[i + 1]; i += 1; } else if (a.startsWith('--base=')) { args.base = a.slice('--base='.length); } else if (a === '--head') { args.head = argv[i + 1]; i += 1; } else if (a.startsWith('--head=')) { args.head = a.slice('--head='.length); } else if (a === '--json') { args.json = true; } else {
      throw new Error(`Unrecognized argument: ${a}`);
    }
  }
  if (!args.base || !args.head) {
    throw new Error('Usage: node scripts/kb-diff.mjs --base <dir-or-git-ref> --head <dir> [--json]');
  }
  return args;
}

function printHumanReadable(report) {
  // eslint-disable-next-line no-console
  console.log(`kb-diff: ${report.from.ref} -> ${report.to.ref} (moduleId=${report.moduleId})`);
  // eslint-disable-next-line no-console
  console.log(`  block=${report.summary.block} review=${report.summary.review} note=${report.summary.note} cosmeticOnly=${report.summary.cosmeticOnly} clean=${report.summary.clean}`);
  for (const c of report.changes) {
    // eslint-disable-next-line no-console
    console.log(`  [${c.tier.toUpperCase()}] ${c.class} ${c.ruleId ?? c.candidateId ?? ''} ${c.path ?? ''} (${JSON.stringify(c.before)} -> ${JSON.stringify(c.after)})`);
  }
  for (const inv of report.invariants) {
    const status = inv.passed === undefined ? `count=${inv.count}` : (inv.passed ? 'OK' : 'FAILED');
    // eslint-disable-next-line no-console
    console.log(`  invariant ${inv.id}: ${status}`);
  }
  // eslint-disable-next-line no-console
  console.log(`  filesNotDiffed: ${report.scope.filesNotDiffed.length} file(s) -- ${report.scope.blindSpotWarning}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const report = await diffKB({ baseSpec: args.base, headSpec: args.head, repoRoot });
  if (args.json) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReadable(report);
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`kb-diff: ${error.message}`);
    process.exitCode = 1;
  });
}
