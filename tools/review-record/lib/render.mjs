// tools/review-record/lib/render.mjs — read-only static-HTML render core (P2-T6, FR-8/FR-31/OQ-3).
//
// Builds the "Render" module boundary named in this tool's README: everything needed to turn a
// module's already-committed review-record chain (`modules/<id>/reviews/*.yaml`, via `store.mjs`)
// plus its already-committed evidentiary chain (`modules/<id>/traceability-index.json` and
// `modules/<id>/evidence-assertions.json`, when either exists) into ONE self-contained static HTML
// string. This module has no write path of its own — `lib/verbs/render.mjs` is the only caller that
// touches the filesystem for output; everything below either reads already-committed repository
// artifacts or is a pure string-building function.
//
// NOT A PORTAL (FR-8): no server, no database, no write path back into `modules/`, no auth, no
// `<script>` anywhere in the emitted HTML, and — deliberately — no `<a href>` at all, so this output
// can never accidentally reference a third-party/remote URL (the workstream table's own acceptance
// criterion: "grep-test proves zero `<script`, zero external URL references"). Every page carries
// `UNVALIDATED_PROTOTYPE_BANNER` verbatim (the exact, already-reviewed string
// `tools/retro-validate/lib/metrics.mjs` uses for its own report header, P4-T4 precedent — reused
// here rather than re-authored, so this program states its "unvalidated research prototype" posture
// in one consistent voice everywhere it appears) and every `synthetic: true` record's card carries
// `NON_QUALIFYING_RECORD_LABEL` — nothing rendered here is ever readable as a clinical-validity,
// safety, or approval claim (FR-28).
//
// Rights posture (FR-31, ADR-0002, E0 OQ-2 precedent): a passage is inlined as text ONLY when its
// `modules/<id>/evidence-assertions.json` assertion resolves with `displayPolicy:
// "public_short_excerpt"` AND a non-empty `exactPassage` string. Every other case — a
// `hash_and_selector_only` assertion, a `clinician_authenticated_short_excerpt` assertion (this
// static render has no auth layer to gate that audience, so it cannot honor that policy either), or
// no resolvable assertion at all (traceability-index.json references an assertionId this module's
// evidence-assertions.json does not carry) — renders as a hash + selector reference block only,
// never the passage text. This defaults to the MORE restrictive reading whenever the two committed
// artifacts disagree or either is silent, matching this program's "missingness is never treated as
// normal" guardrail rather than assuming an ambiguous case is safe to inline.
//
// Every artifact this module reads is EXISTENCE-GATED, not required: `module.json`,
// `traceability-index.json`, and `evidence-assertions.json` are all optional per module (a brand-new
// module package scaffold, or one that predates P3+, legitimately has none of them yet — mirrors
// `schemas/evidence.schema.json`'s and `schemas/evidence-assertions.schema.json`'s own `minItems: 0`
// relaxations and `scripts/validate-kb.mjs`'s existence-gated per-module checks). Their absence
// renders an explicit "not yet committed" note, never a thrown error and never a silently blank
// section.
//
// QUEUE / TURN-STATE SECTION (Clinical Review Workflow v1, Phase 3, P3-T1, FR-11): every render now
// also carries a module-wide "Review queue & turn state" section naming the five ADR-0004 roles, in
// canonical order, each with a textual reference to its existing committed record (never an
// `<a href>` — this file's `<script>`/`<a href>`-free constraint is unchanged) plus a `NEXT` or
// `TERMINAL` marker. This is DELIBERATELY SOURCED FROM the same primitives Phase 1's shared
// derived-state library treats as authoritative — `resolveEffectiveRoleRecord`/`isAdjudicationRequired`
// (`lib/adjudication.mjs`), which `lib/derived-state.mjs`'s own header names as the ONE
// "effective act"/"adjudication required" reasoning this tool uses (P1-T1/P1-T5) — rather than
// forking a second copy of that turn-taking logic. It is DELIBERATELY NARROWER than `status`'s own
// full derived-state result (`lib/verbs/status.mjs`, P1-T2): it answers only "which role, in
// canonical order, has no effective act yet" from already-loaded record data, and never runs
// schema/roster/signature verification or the release-authorization completeness check (those need
// roster/schema file I/O this render module does not perform). Mirrors this tool's established
// "list's chain-linkage column is informational, not enforcement" posture (README) — a `TERMINAL`
// queue reading is a structural role-presence summary only, never a substitute for `validate`/
// `status`'s fail-closed judgment, and never a release-authorization, approval, or clinical-validity
// claim.
//
// HONESTY-LANGUAGE PASS (Clinical Review Workflow v1, Phase 3, P3-T4, FR-14/R4): the queue section
// carries its own copy of this program's canonical "unvalidated research prototype" / "no clinical
// sign-off exists" boundary sentence (`renderQueueSection`'s honesty paragraph, below) in addition to
// the page-wide `UNVALIDATED_PROTOTYPE_BANNER` already stamped in the header/footer — so the boundary
// statement is never more than the queue section's own paragraph away, even for a caller that reads
// only that one `<section class="queue">` fragment in isolation (e.g. an embedded/narrowed view).
// Wording deliberately reuses `docs/governance/reviewer-runbook.md`'s own "Honesty boundary" section
// phrasing rather than drafting a fourth independent voice for the same fact.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { REVIEW_ROLES, listModuleReviewRecords } from './store.mjs';
import { checkModuleChainLinkage } from './chain.mjs';
import { resolveEffectiveRoleRecord, isAdjudicationRequired } from './adjudication.mjs';
import { ReviewRecordNotFoundError } from './errors.mjs';

/**
 * Verbatim copy of `tools/retro-validate/lib/metrics.mjs`'s `UNVALIDATED_PROTOTYPE_BANNER` (P4-T4)
 * — ONE banner string voice across this program's rendered/reported output, not two independently
 * drafted ones. Do not edit this string here without also revisiting that file; if the two ever
 * need to diverge, that is itself a finding, not a routine edit.
 */
export const UNVALIDATED_PROTOTYPE_BANNER = 'UNVALIDATED RESEARCH PROTOTYPE. This report, and '
  + 'every measure in it, describes deterministic software behavior only. It is not, and must '
  + 'never be read, cited, or represented as, a clinical validity, safety, or regulatory '
  + 'determination of any kind.';

/** Per-record label stamped on every `synthetic: true` record card (FR-11/FR-28). Mirrors the
 * fixture-roster convention (`tests/fixtures/ef-review-record-cli/governance/reviewer-roster.yaml`'s
 * own `"SYNTHETIC -- NOT A CREDENTIALED REVIEWER"` persona names) at the record-card level. */
export const NON_QUALIFYING_RECORD_LABEL = 'SYNTHETIC -- NOT A CREDENTIALED REVIEW ACT. This '
  + 'record exercises the review-record workflow only; it is not evidence that any named, '
  + 'credentialed human clinician reviewed this module, and it can never satisfy a '
  + 'release-authorization validity condition.';

/** Stamped on every rights-restricted passage block (FR-31). */
export const RIGHTS_RESTRICTED_LABEL = 'Rights-restricted passage -- hash + selector reference '
  + 'only (FR-31, ADR-0002). The licensed source text is withheld; nothing in this block is a '
  + 'verbatim or paraphrased excerpt.';

const NOT_A_PORTAL_NOTE = 'Read-only static render -- not a portal. No server, database, write '
  + 'path, or auth; generated only from already-committed repository artifacts (FR-8/OQ-3).';

/** Literal marker text stamped on the queue/turn-state section (P3-T1, FR-11) when a role is
 * awaiting its committed act, or on the section's overall summary line when at least one role's
 * effective act is still outstanding. Kept as a named export so tests assert the exact literal
 * rather than a re-typed copy. */
export const QUEUE_NEXT_MARKER = 'NEXT';

/** Literal marker text stamped on the queue/turn-state section's overall summary line once every
 * required ADR-0004 role has a committed, effective review act on record (structural role-presence
 * only — see this file's header for why this is never a release-authorization/approval claim). */
export const QUEUE_TERMINAL_MARKER = 'TERMINAL';

/**
 * @param {string} rootDir absolute or cwd-relative repo root (or a fixture root standing in for it)
 * @param {string} relPath path segments under `<rootDir>/modules/<moduleId>/`
 * @returns {Promise<object|null>} the parsed JSON document, or `null` if the file does not exist
 */
async function readJsonIfExists(filePath) {
  let raw;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  return JSON.parse(raw);
}

/**
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {Promise<object|null>} parsed `modules/<moduleId>/module.json`, or `null` if absent
 */
export async function loadModuleMeta(rootDir, moduleId) {
  return readJsonIfExists(path.join(rootDir, 'modules', moduleId, 'module.json'));
}

/**
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {Promise<object|null>} parsed `modules/<moduleId>/traceability-index.json`, or `null`
 */
export async function loadTraceabilityIndex(rootDir, moduleId) {
  return readJsonIfExists(path.join(rootDir, 'modules', moduleId, 'traceability-index.json'));
}

/**
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {Promise<object[]>} `modules/<moduleId>/evidence-assertions.json`'s `assertions[]`, or
 *   `[]` when the file is absent or carries no `assertions` array
 */
export async function loadEvidenceAssertions(rootDir, moduleId) {
  const doc = await readJsonIfExists(path.join(rootDir, 'modules', moduleId, 'evidence-assertions.json'));
  return doc && Array.isArray(doc.assertions) ? doc.assertions : [];
}

/**
 * @param {object[]} assertions
 * @returns {Map<string, object>} `assertionId` -> assertion
 */
export function indexAssertionsById(assertions) {
  const map = new Map();
  for (const assertion of assertions) {
    if (assertion && typeof assertion.assertionId === 'string') {
      map.set(assertion.assertionId, assertion);
    }
  }
  return map;
}

/**
 * Loads everything `render` needs for one module in one place: seq-ordered review records + their
 * informational chain-linkage report (`list`'s own primitives, P2-T1/T3) plus the three optional,
 * existence-gated evidentiary artifacts this file's header describes.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {Promise<{
 *   moduleId: string,
 *   records: { reviewId: string, seq: number, role: string, filePath: string, record: object }[],
 *   linkageByReviewId: Map<string, { ok: boolean, reason: string|null }>,
 *   moduleMeta: object|null,
 *   traceability: object|null,
 *   assertionsById: Map<string, object>,
 * }>}
 */
export async function loadModuleRenderData(rootDir, moduleId) {
  const records = await listModuleReviewRecords(rootDir, moduleId);
  const linkage = checkModuleChainLinkage(records);
  const linkageByReviewId = new Map(linkage.map((entry) => [entry.reviewId, entry]));
  const [moduleMeta, traceability, assertions] = await Promise.all([
    loadModuleMeta(rootDir, moduleId),
    loadTraceabilityIndex(rootDir, moduleId),
    loadEvidenceAssertions(rootDir, moduleId),
  ]);
  return {
    moduleId,
    records,
    linkageByReviewId,
    moduleMeta,
    traceability,
    assertionsById: indexAssertionsById(assertions),
  };
}

/**
 * Fail-closed lookup used by `lib/verbs/render.mjs` for `--record <review_id>`: returns the matching
 * entry or throws `ReviewRecordNotFoundError` — rendering the full module (or a blank page) when a
 * caller asked for one specific, absent record would silently hide the mistake.
 *
 * @param {{ reviewId: string }[]} records
 * @param {string} reviewId
 * @param {string} moduleId only used for the thrown error's message
 * @returns {{ reviewId: string }}
 */
export function selectRecord(records, reviewId, moduleId) {
  const found = records.find((entry) => entry.reviewId === reviewId);
  if (!found) throw new ReviewRecordNotFoundError(reviewId, moduleId);
  return found;
}

/**
 * Minimal, dependency-free HTML-text escaper — this tool ships zero runtime dependencies (this
 * tool's README, "No `yaml`/JSON-Schema npm dependency" design decision) and has no reason to pull
 * one in just for this. Escapes the five characters that matter for both element text content and
 * double-quoted attribute values, so every call site below is safe to use in either position.
 *
 * @param {*} value coerced to a string first (`String(value)`) so `null`/numbers/etc. never throw
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLE = [
  'body{font-family:Georgia,"Times New Roman",serif;max-width:960px;margin:0 auto;padding:1.5rem;',
  'line-height:1.5;color:#1a1a1a;background:#fff;}',
  '.banner{background:#3a2a00;color:#fff8e6;border:1px solid #7a5a00;padding:0.75rem 1rem;',
  'font-weight:bold;font-size:0.95rem;}',
  'h1{font-size:1.5rem;margin-top:1.5rem;}',
  'h2{font-size:1.2rem;border-bottom:1px solid #ccc;padding-bottom:0.25rem;margin-top:2rem;}',
  'h3{font-size:1.05rem;margin-bottom:0.25rem;}',
  '.subtitle{color:#444;font-style:italic;}',
  '.record{border:1px solid #ccc;border-radius:4px;padding:0.75rem 1rem;margin:0.75rem 0;}',
  '.record-synthetic{border-color:#7a5a00;background:#fffaf0;}',
  '.non-qualifying{font-weight:bold;color:#7a5a00;}',
  '.role-badge{font-size:0.8rem;color:#555;font-weight:normal;}',
  'dl{display:grid;grid-template-columns:12rem 1fr;gap:0.15rem 0.75rem;margin:0.5rem 0;}',
  'dt{font-weight:bold;}',
  'dd{margin:0;}',
  '.rule{border:1px solid #ccc;border-radius:4px;padding:0.75rem 1rem;margin:0.75rem 0;}',
  '.rule-meta{color:#444;font-size:0.9rem;}',
  '.passage{border-left:3px solid #999;padding:0.5rem 0.75rem;margin:0.5rem 0;}',
  '.passage-restricted{border-left-color:#7a5a00;background:#fffaf0;}',
  '.restricted-label{font-weight:bold;color:#7a5a00;margin:0 0 0.25rem 0;}',
  '.passage-text{font-style:italic;margin:0 0 0.25rem 0;}',
  '.passage-meta{color:#444;font-size:0.85rem;margin:0;}',
  '.tests{margin:0.25rem 0;padding-left:1.25rem;}',
  '.empty{color:#666;font-style:italic;}',
  'code{background:#f0f0f0;padding:0 0.2rem;}',
  '.queue-roles{list-style:decimal;padding-left:1.5rem;margin:0.5rem 0;}',
  '.queue-role{border:1px solid #ccc;border-radius:4px;padding:0.5rem 0.75rem;margin:0.5rem 0;}',
  '.queue-role h3{margin:0 0 0.25rem 0;font-size:1rem;}',
  '.queue-role-next{border-color:#7a5a00;background:#fffaf0;}',
  '.queue-role-committed{border-color:#3a6b3a;}',
  '.queue-marker{font-weight:bold;}',
  '.queue-marker-terminal{color:#3a6b3a;}',
].join('');

/**
 * @param {object} passageRef one `traceability-index.json` rule's `passages[]` entry
 *   (`{ assertionId, rfClaimId, passageId, exactPassageSha256, sourceId }`)
 * @param {Map<string, object>} assertionsById
 * @returns {string} an HTML fragment for one passage — inline text XOR a rights-restricted block,
 *   never both, per this file's header
 */
function renderPassage(passageRef, assertionsById) {
  const assertion = assertionsById.get(passageRef.assertionId) ?? null;
  const sourceId = escapeHtml(passageRef.sourceId ?? assertion?.sourceId ?? '(unknown source)');
  const locatorRaw = typeof assertion?.locator?.raw === 'string' ? escapeHtml(assertion.locator.raw) : null;
  const hash = escapeHtml(
    assertion?.exactPassageSha256
      ?? passageRef.exactPassageSha256
      ?? passageRef.passageId
      ?? '(no hash on file)',
  );

  const canInlineText = assertion?.displayPolicy === 'public_short_excerpt'
    && typeof assertion.exactPassage === 'string'
    && assertion.exactPassage.length > 0;

  if (canInlineText) {
    return [
      '<div class="passage passage-inline">',
      `<p class="passage-text">&ldquo;${escapeHtml(assertion.exactPassage)}&rdquo;</p>`,
      `<p class="passage-meta">Source: ${sourceId}${locatorRaw ? ` &mdash; ${locatorRaw}` : ''} `
        + `(displayPolicy: public_short_excerpt; hash: <code>${hash}</code>)</p>`,
      '</div>',
    ].join('');
  }

  return [
    '<div class="passage passage-restricted">',
    `<p class="restricted-label">${escapeHtml(RIGHTS_RESTRICTED_LABEL)}</p>`,
    '<dl class="passage-meta">',
    `<dt>Source</dt><dd>${sourceId}</dd>`,
    `<dt>Passage hash</dt><dd><code>${hash}</code></dd>`,
    locatorRaw ? `<dt>Selector</dt><dd>${locatorRaw}</dd>` : '',
    '</dl>',
    '</div>',
  ].join('');
}

/**
 * @param {object|null} traceability parsed `traceability-index.json`, or `null` if not committed
 * @param {Map<string, object>} assertionsById
 * @returns {string} an HTML fragment for the whole rule -> passage -> test chain, sorted by
 *   `ruleId` for deterministic byte-for-byte re-render regardless of the source file's own key order
 */
function renderRuleChain(traceability, assertionsById) {
  const rules = traceability && typeof traceability.rules === 'object' && traceability.rules !== null
    ? traceability.rules
    : null;
  if (!rules || Object.keys(rules).length === 0) {
    return '<p class="empty">No committed traceability-index.json rule chain for this module yet.</p>';
  }

  return Object.keys(rules)
    .sort()
    .map((ruleId) => {
      const rule = rules[ruleId] ?? {};
      const passages = Array.isArray(rule.passages) ? rule.passages : [];
      const tests = Array.isArray(rule.testRefs) ? rule.testRefs : [];
      const testItems = tests
        .map((t) => `<li><code>${escapeHtml(t.file ?? '(unknown file)')}</code> &mdash; `
          + `${escapeHtml(t.testName ?? '(unnamed test)')}</li>`)
        .join('');
      return [
        '<section class="rule">',
        `<h3>${escapeHtml(ruleId)}</h3>`,
        `<p class="rule-meta">outputType: ${escapeHtml(rule.outputType ?? '(unknown)')}`
          + ` &middot; category: ${escapeHtml(rule.category ?? '(unknown)')}`
          + ` &middot; safetyClass: ${escapeHtml(rule.safetyClass ?? '(unknown)')}`
          + ` &middot; reviewStatus: ${escapeHtml(rule.reviewStatus ?? '(unknown)')}</p>`,
        '<h4>Evidence passages</h4>',
        passages.length
          ? passages.map((p) => renderPassage(p, assertionsById)).join('')
          : '<p class="empty">No passages recorded for this rule.</p>',
        '<h4>Tests</h4>',
        tests.length ? `<ul class="tests">${testItems}</ul>` : '<p class="empty">No committed test references.</p>',
        '</section>',
      ].join('');
    })
    .join('');
}

/**
 * @param {{ reviewId: string, record: object }} entry
 * @param {{ ok: boolean, reason: string|null }|undefined} linkage
 * @returns {string} an HTML fragment for one record card
 */
function renderRecordCard(entry, linkage) {
  const rec = entry.record ?? {};
  const synthetic = rec.synthetic === true;
  const linkageText = linkage
    ? (linkage.ok ? 'ok' : `BROKEN &mdash; ${escapeHtml(linkage.reason ?? '')}`)
    : 'unknown';
  return [
    `<article class="record${synthetic ? ' record-synthetic' : ''}">`,
    `<h3>${escapeHtml(entry.reviewId)} <span class="role-badge">${escapeHtml(rec.role ?? '(missing)')}</span></h3>`,
    synthetic ? `<p class="non-qualifying">${escapeHtml(NON_QUALIFYING_RECORD_LABEL)}</p>` : '',
    '<dl>',
    `<dt>Reviewer</dt><dd>${escapeHtml(rec.reviewerId ?? '(missing)')}</dd>`,
    `<dt>Decision</dt><dd>${escapeHtml(rec.decision ?? '(missing)')}</dd>`,
    `<dt>Rationale</dt><dd>${escapeHtml(rec.rationale ?? '(missing)')}</dd>`,
    `<dt>Reviewed at</dt><dd>${escapeHtml(rec.reviewedAt ?? '(missing)')}</dd>`,
    `<dt>Subject content hash</dt><dd><code>${escapeHtml(rec.subjectContentHash ?? '(missing)')}</code></dd>`,
    `<dt>Previous record hash</dt><dd><code>${escapeHtml(rec.previousRecordHash ?? 'null')}</code></dd>`,
    `<dt>Supersedes</dt><dd>${escapeHtml(rec.supersedes ?? 'null')}</dd>`,
    `<dt>Chain linkage (informational only, see P2-T3 for enforcement)</dt><dd>${linkageText}</dd>`,
    `<dt>Signature key id</dt><dd>${escapeHtml(rec.signature?.keyId ?? 'null')}</dd>`,
    '</dl>',
    '</article>',
  ].join('');
}

/**
 * Computes the five-role queue/turn-state view the render's new section needs (P3-T1, FR-11).
 * REUSES, rather than reimplements, the P1-T1/P1-T5 derived-state primitives
 * (`resolveEffectiveRoleRecord`/`isAdjudicationRequired`, `lib/adjudication.mjs`) that
 * `lib/derived-state.mjs`'s own header already names as the ONE authoritative "effective act"/
 * "adjudication required" reasoning in this tool — this function does not fork a second copy of
 * either. See this file's header for why it is deliberately narrower than `status`'s own full
 * derived-state result (`lib/verbs/status.mjs`, P1-T2): a pure, I/O-free, role-presence-only
 * summary, never a substitute for `validate`/`status`'s fail-closed judgment.
 *
 * @param {{ reviewId: string, seq: number, role: string, record: object }[]} allRecords the full
 *   module record set (`loadModuleRenderData`'s own `records`, unfiltered by any `--record`
 *   narrowing — the queue view is inherently module-wide, like the rule-chain section below)
 * @returns {{
 *   roles: { role: string, reviewId: string|null, isNext: boolean }[],
 *   terminal: boolean,
 *   nextExpectedRole: string|null,
 * }} `roles` — one entry per `REVIEW_ROLES`, in canonical order. `terminal` — true once every
 *   required role (FR-26's conditional `adjudication` requirement included, via
 *   `isAdjudicationRequired`) has an effective act on record. `nextExpectedRole` — `null` when
 *   `terminal` is true, else the one role awaiting its committed act.
 */
export function computeQueueState(allRecords) {
  const effectiveByRole = new Map();
  for (const role of REVIEW_ROLES) {
    const effective = resolveEffectiveRoleRecord(allRecords, role);
    if (effective) effectiveByRole.set(role, effective);
  }

  let nextExpectedRole = null;
  if (!effectiveByRole.has('clinical-1')) {
    nextExpectedRole = 'clinical-1';
  } else if (!effectiveByRole.has('clinical-2')) {
    nextExpectedRole = 'clinical-2';
  } else if (!effectiveByRole.has('lab')) {
    nextExpectedRole = 'lab';
  } else if (isAdjudicationRequired(allRecords) && !effectiveByRole.has('adjudication')) {
    nextExpectedRole = 'adjudication';
  } else if (!effectiveByRole.has('release-auth')) {
    nextExpectedRole = 'release-auth';
  }

  const terminal = nextExpectedRole === null;

  const roles = REVIEW_ROLES.map((role) => {
    const effective = effectiveByRole.get(role);
    return {
      role,
      reviewId: effective ? effective.reviewId : null,
      isNext: role === nextExpectedRole,
    };
  });

  return { roles, terminal, nextExpectedRole };
}

/**
 * Renders the "Review queue & turn state" section (P3-T1, FR-11): an `<h2>`-headed section
 * carrying, for each of the five ADR-0004 roles (each its own `<h3>` — semantic headings for
 * screen-reader navigation, this task's own acceptance criterion), a textual reference to its
 * existing committed record (never an `<a href>`) when present, or an explicit "not yet committed"
 * note when absent — plus a `QUEUE_NEXT_MARKER`/`QUEUE_TERMINAL_MARKER` summary line. Module-wide,
 * like the rule-chain section below — never narrowed by a `--record` filter, since turn-taking is a
 * whole-module concept.
 *
 * @param {{ reviewId: string, seq: number, role: string, record: object }[]} allRecords
 * @returns {string}
 */
function renderQueueSection(allRecords) {
  const { roles, terminal, nextExpectedRole } = computeQueueState(allRecords);

  const summary = terminal
    ? `<p class="queue-marker queue-marker-terminal">${QUEUE_TERMINAL_MARKER} &mdash; every ` +
      'required ADR-0004 role (FR-26\'s conditional adjudication requirement included) has a ' +
      'committed, effective review act on record for this module. Structural role-presence only ' +
      '&mdash; NOT a release-authorization, approval, or clinical-validity determination; see the ' +
      'Review records section below for each act\'s own chain-linkage and synthetic status.</p>'
    : `<p class="queue-marker">${QUEUE_NEXT_MARKER}: ${escapeHtml(nextExpectedRole)}</p>`;

  const roleItems = roles.map((entry) => {
    let body;
    let itemClass;
    if (entry.isNext) {
      itemClass = 'queue-role-next';
      body = `<p>${QUEUE_NEXT_MARKER} &mdash; awaiting this role's committed review act.</p>`;
    } else if (entry.reviewId) {
      itemClass = 'queue-role-committed';
      body = `<p>Committed review act: <code>${escapeHtml(entry.reviewId)}</code> (see Review ` +
        'records below).</p>';
    } else {
      itemClass = 'queue-role-pending';
      body = '<p class="empty">Not yet committed.</p>';
    }
    return [
      `<li class="queue-role ${itemClass}">`,
      `<h3>${escapeHtml(entry.role)}</h3>`,
      body,
      '</li>',
    ].join('');
  }).join('');

  return [
    '<section class="queue">',
    '<h2>Review queue &amp; turn state</h2>',
    '<p class="subtitle">Structural role-by-role act presence only, reusing the P1-T1/P1-T5 ' +
      'derived-state primitives (FR-11) &mdash; informational, not a substitute for `validate`/' +
      '`status`\'s fail-closed checks.</p>',
    '<p class="subtitle">This program remains an unvalidated research prototype: no clinical ' +
      'sign-off exists for any module rendered here, and the reviewer roster stays ' +
      'synthetic-only until gate G1 clears (see the banner above for the full boundary ' +
      'statement).</p>',
    summary,
    '<ol class="queue-roles">',
    roleItems,
    '</ol>',
    '</section>',
  ].join('');
}

/**
 * Assembles ONE self-contained HTML document string. Pure — never touches the filesystem
 * (`lib/verbs/render.mjs` is the only writer). Deterministic over identical inputs: no wall-clock
 * timestamp, random id, or non-reproducible value appears anywhere in the output, so re-rendering
 * the same committed artifacts twice produces byte-identical bytes (the workstream table's own
 * acceptance criterion).
 *
 * @param {{
 *   moduleId: string,
 *   moduleMeta: object|null,
 *   records: { reviewId: string, record: object }[],
 *   linkageByReviewId: Map<string, object>,
 *   traceability: object|null,
 *   assertionsById: Map<string, object>,
 *   recordFilter?: string|null,
 * }} data
 * @returns {string} a full `<!doctype html>` document, newline-terminated
 */
export function renderModuleHtml({
  moduleId,
  moduleMeta,
  records,
  linkageByReviewId,
  traceability,
  assertionsById,
  recordFilter = null,
}) {
  const titleBase = typeof moduleMeta?.title === 'string' && moduleMeta.title.length > 0
    ? moduleMeta.title
    : moduleId;
  const pageTitle = `Review record render — ${titleBase} (${moduleId})`;

  const recordEntries = recordFilter
    ? records.filter((entry) => entry.reviewId === recordFilter)
    : records;

  const recordsHtml = recordEntries.length
    ? recordEntries.map((entry) => renderRecordCard(entry, linkageByReviewId.get(entry.reviewId))).join('')
    : '<p class="empty">No committed review records found under modules/&lt;module_id&gt;/reviews/.</p>';

  const banner = `<p>${escapeHtml(UNVALIDATED_PROTOTYPE_BANNER)}</p>`;

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(pageTitle)}</title>`,
    `<style>${STYLE}</style>`,
    '</head>',
    '<body>',
    `<header class="banner">${banner}</header>`,
    '<main>',
    `<h1>${escapeHtml(titleBase)} <span class="role-badge">${escapeHtml(moduleId)}</span></h1>`,
    `<p class="subtitle">${escapeHtml(NOT_A_PORTAL_NOTE)}</p>`,
    renderQueueSection(records),
    '<section class="records">',
    `<h2>Review records${recordFilter ? ` — ${escapeHtml(recordFilter)}` : ''}</h2>`,
    recordsHtml,
    '</section>',
    '<section class="chain">',
    '<h2>Passage &rarr; decision &rarr; rule &rarr; test chain</h2>',
    renderRuleChain(traceability, assertionsById),
    '</section>',
    '</main>',
    `<footer class="banner">${banner}</footer>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
