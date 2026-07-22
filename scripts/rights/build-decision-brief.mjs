#!/usr/bin/env node
// scripts/rights/build-decision-brief.mjs — EPR4-T2 (FR-WP4-02, decisions-block D5/D6).
//
// The clean-room decision-brief generator. Per the clean-room workflow doc
// (docs/workflows/clean-room-authoring.md), an agent prepares this brief so a human — the
// clinical adjudicator, the rights reviewer, or both — spends their scarce minutes reading a
// decision-ready summary rather than raw JSON (D5: optimise for clinician minutes, not agent
// minutes).
//
// GIVEN an item or a binding:
//   --item <evidence-item-id>                     a passage id ("<SOURCE>#ev_NNN" or
//                                                  "<SOURCE>#implementation-proposal") or a
//                                                  derived_synthesis id ("SYNTH_...").
//   --binding <entityId> --entity-type <rule|candidate>
//                                                  a rule or candidate id; resolved via its
//                                                  `sourcePassageId` pointer to the passage it
//                                                  currently cites.
// EMITS a brief containing: independently-worded atoms, their structured locators, the item's
// scope/population, the recorded rights position (as recorded — never asserted, inferred, or
// upgraded), and the specific question a human must answer (FR-WP4-02).
//
// DETERMINISM (FR-WP0-07 discipline, carried into this file): every input this generator reads
// is a committed JSON file already on disk, read with no filtering by wall-clock time. The ONLY
// date input is `--as-of` / the `RIGHTS_BRIEF_AS_OF` env var, and even then it is used for
// exactly one purpose — an opt-in `generated_as_of` stamp on the brief, included ONLY when the
// caller explicitly supplies it. Two runs against unchanged input, at different real wall-clock
// times, with the SAME (or no) `--as-of` value, produce byte-identical output. This file never
// reads the system clock via `Date.now` and never constructs a zero-argument `Date`.
//
// CONTAMINATION DISCIPLINE (D1/D5, precursor to EPR4-T3's dedicated gate test
// tests/rights-brief-contamination.test.mjs): this generator draws atom TEXT only from fields
// the evidence-item schema documents as independently worded — `exactPassage` (but ONLY when
// `passageFidelity === "paraphrase"`; a "verbatim" or "withheld" passage's exactPassage is never
// surfaced as brief text — see `buildAtomsForPassage` below), `guideline_recommendation_capture
// .restatement`, `numeric_recapture.atoms[]` (per-value transcribed atoms, D1's rights-safe
// alternative to a reproduced table), and a first-party `derived_synthesis`'s own `method` /
// `divergence_notes`. It never reads `sources[].supports[]` (legacy pre-EP-3 prose) or any
// `sourceLocator.raw` free-text field for atom content. Residual gap R-1
// (tests/rights-negative-invariant.test.mjs) applies here too: this is a structural proxy, not a
// diff against unretained source text, and EPR4-T3's gate — over this generator's OUTPUT, not
// merely this file's construction — is the closing control, referenced and not claimed closed.
//
// D6: this generator never writes anything. It reads modules/<id>/evidence.json,
// modules/<id>/rules.json / candidates.json, and rights/rights-ledger.json + rights-records.json,
// and emits a brief to stdout. It states the recorded rights position AS RECORDED; it never
// asserts, infers, or upgrades a clearance, and it never authors a `CLEARED_*` status, an
// attestation, or an authoritative `derived_synthesis`.
//
// Invoked via the `rights:brief` npm script EP-R0 landed in package.json (EPR0-T6); this file
// supplies that script's target and adds no new npm entry (package.json is EP-R0's barrier).

import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_IDS } from '../../src/modules/registry.js';
import { isBindableAsSourceSupported, passageApplicability } from '../../src/evidence.js';
// Split out per tests/rights-axis-separation.test.mjs's D2 barrier probe — see the "rights
// position" section below for why.
import {
  resolveRightsPositionForSource,
  summarizeRightsRecordStatuses,
  renderRightsPositionSection,
} from './lib/decision-brief-rights-position.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

// --- item-id shape ---------------------------------------------------------------------------

const PASSAGE_ID_PATTERN = /^[A-Z0-9_]+#(ev_[0-9]{3}|implementation-proposal)$/;
const SYNTHESIS_ID_PATTERN = /^SYNTH_[A-Z0-9_]+$/;

/** `"passage" | "synthesis" | null` — null means the id matches neither recognized shape. */
export function classifyItemId(itemId) {
  if (typeof itemId !== 'string') return null;
  if (SYNTHESIS_ID_PATTERN.test(itemId)) return 'synthesis';
  if (PASSAGE_ID_PATTERN.test(itemId)) return 'passage';
  return null;
}

/**
 * Resolves an item id against one module's loaded evidence.json. Returns `null` when the id's
 * shape is recognized but no matching record exists in THIS module (the caller tries the next
 * module, or reports "not found" once every module has been tried).
 */
export function findEvidenceItem(evidenceDoc, itemId) {
  const kind = classifyItemId(itemId);
  if (kind === 'synthesis') {
    const synthesis = (evidenceDoc.derived_syntheses ?? []).find((s) => s.id === itemId);
    return synthesis ? { kind: 'synthesis', synthesis } : null;
  }
  if (kind === 'passage') {
    for (const source of evidenceDoc.sources ?? []) {
      const passage = (source.passages ?? []).find((p) => p.id === itemId);
      if (passage) return { kind: 'passage', source, passage };
    }
    return null;
  }
  return null;
}

function findEntity(entityDoc, entityType, entityId) {
  if (entityType === 'rule') {
    return Array.isArray(entityDoc) ? (entityDoc.find((r) => r.id === entityId) ?? null) : null;
  }
  // candidates.json is a keyed object (id -> candidate), not an array.
  return entityDoc && typeof entityDoc === 'object' ? (entityDoc[entityId] ?? null) : null;
}

function entitySummary(entityType, entity) {
  if (entityType === 'rule') {
    return {
      title: entity.output?.title ?? entity.id,
      description: entity.output?.detail ?? null,
      category: entity.category ?? null,
    };
  }
  return {
    title: entity.label ?? entity.id,
    description: entity.summary ?? null,
    category: entity.category ?? null,
  };
}

// --- rights position (read-only summary; never a clearance) ----------------------------------
//
// `resolveRightsPositionForSource` itself lives in ./lib/decision-brief-rights-position.mjs, NOT
// here (imported above, re-exported below): it reads `overall_status`/`review.review_status`, and
// tests/rights-axis-separation.test.mjs's D2 barrier probe forbids a single file's executable code
// from co-mentioning that rights-authority vocabulary alongside the evidence-item taxonomy axis
// fields (`evidence_item_type` etc.) this file reads throughout `buildAtomsForPassage` and its
// callers below — mirroring scripts/validate-rights.mjs's own split of gates (f)/(g)/(h). This
// file consumes only the opaque `rights_position` object the imported function returns, plus
// `summarizeRightsRecordStatuses`/`renderRightsPositionSection` for the two places (a decision
// question, and the markdown render) that need a rendered STRING drawn from it — never the field
// itself.
export { resolveRightsPositionForSource };

// --- atoms (independently-worded content, never third-party expression) ----------------------

function redactionNote(reason) {
  return `not included in this brief — ${reason}; see structured_locator for provenance`;
}

/**
 * Builds the independently-worded atoms a passage contributes to a brief, plus any explanatory
 * notes (never atom text). `exactPassage` is surfaced ONLY when `passageFidelity === "paraphrase"`
 * — a "withheld" or "verbatim" passage's located text is never reproduced in generated output
 * (D1/D5; see the file header's contamination-discipline note).
 */
export function buildAtomsForPassage(passage) {
  const atoms = [];
  const notes = [];

  if (passage.status === 'implementation-proposal') {
    notes.push(
      'This is the minted implementation-proposal sentinel: no located source passage backs it. '
      + 'There is no source-drawn atom to brief for this item.',
    );
  } else if (passage.passageFidelity === 'paraphrase' && passage.exactPassage) {
    atoms.push({
      kind: 'passage_paraphrase',
      text: passage.exactPassage,
      evidence_item_type: passage.evidence_item_type,
      rights_component_class: passage.rights_component_class,
      judgment_basis: passage.judgment_basis,
      structured_locator: passage.structured_locator,
    });
  } else {
    notes.push(
      `exactPassage: ${redactionNote(`passageFidelity is "${passage.passageFidelity}", not "paraphrase"`)}`,
    );
  }

  if (passage.guideline_recommendation_capture) {
    const g = passage.guideline_recommendation_capture;
    atoms.push({
      kind: 'guideline_recommendation',
      text: g.restatement,
      issuing_body: g.issuing_body,
      scope_or_population: g.scope_or_population,
      evidence_item_type: passage.evidence_item_type,
      rights_component_class: passage.rights_component_class,
      judgment_basis: passage.judgment_basis,
      structured_locator: passage.structured_locator,
    });
  }

  if (passage.numeric_recapture) {
    const nr = passage.numeric_recapture;
    if (nr.resolution === 'per_value_atoms') {
      for (const atom of nr.atoms) {
        atoms.push({
          kind: 'numeric_value',
          text: `${atom.label}: ${atom.value}${atom.unit ? ` ${atom.unit}` : ''}`,
          evidence_item_type: atom.evidence_item_type,
          rights_component_class: atom.rights_component_class,
          judgment_basis: atom.judgment_basis,
          structured_locator: atom.structured_locator,
        });
      }
    } else {
      notes.push(`numeric_recapture: no reported value available — ${nr.reason}`);
    }
  }

  return { atoms, notes };
}

function extractScopeAndPopulation(passage) {
  return {
    applicability: passageApplicability(passage),
    locator_population_or_scope: passage.structured_locator?.population_or_scope ?? null,
    guideline_scope_or_population: passage.guideline_recommendation_capture?.scope_or_population ?? null,
  };
}

// --- decision questions (FR-WP4-02: "the specific question the human must answer") -----------

function buildItemDecisionQuestion({ source, rightsPosition }) {
  const statusList = summarizeRightsRecordStatuses(rightsPosition);
  return 'RIGHTS REVIEW REQUIRED: does the recorded rights position for '
    + `"${source.id}" (joined rights_record status: ${statusList}) permit using this item's `
    + 'atom(s) below in the product, and under what conditions if any? This brief states the rights '
    + 'position exactly as recorded; it makes no clearance determination of its own, and no '
    + 'agent-authored answer to this question is ever binding (D6).';
}

function buildSynthesisDecisionQuestion(synthesis) {
  const s = synthesis.synthesis;
  return `CLINICAL ADJUDICATION REQUIRED: does "${synthesis.id}" fairly and accurately combine its `
    + `${s.input_refs.length} attributed input(s) per the method stated below, and — given `
    + `reproduces_source_arrangement: ${s.reproduces_source_arrangement} — does combining them raise a `
    + 'substantial-similarity concern needing rights review before this candidate may ever be attested? '
    + `This brief can only ever describe a candidate (attestation_status: "${s.attestation.status}"); no `
    + 'agent may mark a synthesis authoritative (D6).';
}

function buildBindingDecisionQuestion({ entityType, entity, summary, passage, itemBrief }) {
  const rightsSummary = itemBrief.rights_position ? summarizeRightsRecordStatuses(itemBrief.rights_position) : 'no joined rights record (coverage gap)';
  const pointerState = passage.status === 'implementation-proposal'
    ? 'the implementation-proposal sentinel (no clinical claim is currently grounded on a located passage)'
    : `a "${passage.status}" passage`;
  return 'CLINICAL + RIGHTS ADJUDICATION REQUIRED: does passage '
    + `"${passage.id}" adequately and accurately support ${entityType} "${entity.id}" `
    + `("${summary.title}") well enough to attest a source-supported binding — AND does the recorded `
    + `rights position (status: ${rightsSummary}) independently permit this use? Both `
    + `sign-offs are required; neither substitutes for the other (D6). Today this ${entityType} points `
    + `at ${pointerState}, and no attestation exists in evidence-packs/passage-attestations.json (the `
    + 'RG-9 seam) to make it source-supported today.';
}

// --- brief assembly ----------------------------------------------------------------------------

function buildPassageItemBrief({ source, passage }, { rightsLedger, rightsRecords }) {
  const { atoms, notes } = buildAtomsForPassage(passage);
  const rightsPosition = resolveRightsPositionForSource(source, rightsLedger, rightsRecords);
  return {
    brief_kind: 'evidence_item',
    item_id: passage.id,
    item_type: 'passage',
    evidence_item_type: passage.evidence_item_type,
    rights_component_class: passage.rights_component_class,
    judgment_basis: passage.judgment_basis,
    status: passage.status,
    passage_fidelity: passage.passageFidelity,
    source: { id: source.id, title: source.title, organization: source.organization, year: source.year },
    atoms,
    scope_and_population: extractScopeAndPopulation(passage),
    not_captured: passage.not_captured ?? [],
    rights_position: rightsPosition,
    notes,
    decision_question: buildItemDecisionQuestion({ source, passage, rightsPosition }),
  };
}

function buildSynthesisItemBrief(synthesis, context, ancestry = new Set()) {
  const { evidenceDoc, rightsLedger, rightsRecords } = context;
  // Cycle guard: `ancestry` is the chain of synthesis ids currently being expanded on this call
  // stack. Real data ships zero derived_syntheses today (D3/D6), so this path is dead code
  // against the committed KB, but a malformed fixture with a self-referential input_refs graph
  // must degrade to "unresolved" rather than recurse forever.
  const nextAncestry = new Set(ancestry).add(synthesis.id);
  const inputs = synthesis.synthesis.input_refs.map((ref) => {
    let resolvedBrief = null;
    const resolved = findEvidenceItem(evidenceDoc, ref.evidence_item_id);
    if (resolved?.kind === 'passage') {
      resolvedBrief = buildPassageItemBrief(resolved, { rightsLedger, rightsRecords });
    } else if (resolved?.kind === 'synthesis' && !nextAncestry.has(resolved.synthesis.id)) {
      resolvedBrief = buildSynthesisItemBrief(resolved.synthesis, context, nextAncestry);
    }
    return {
      contribution: ref.contribution,
      evidence_item_id: ref.evidence_item_id,
      rights_record_id: ref.rights_record_id ?? null,
      resolved: resolvedBrief,
    };
  });

  return {
    brief_kind: 'evidence_item',
    item_id: synthesis.id,
    item_type: 'derived_synthesis',
    evidence_item_type: synthesis.evidence_item_type,
    synthesis: {
      method: synthesis.synthesis.method,
      divergence_notes: synthesis.synthesis.divergence_notes,
      reproduces_source_arrangement: synthesis.synthesis.reproduces_source_arrangement,
      first_party_rights_holder: synthesis.synthesis.first_party_rights_holder,
      attestation_status: synthesis.synthesis.attestation.status,
    },
    inputs,
    atoms: [],
    scope_and_population: null,
    not_captured: [],
    rights_position: null,
    notes: [
      'derived_synthesis items carry no rights_record of their own (RF handoff §9.5, DEF-R4; '
      + 'decisions-block D3/D6) — resolve the rights position of each attributed input above instead.',
    ],
    decision_question: buildSynthesisDecisionQuestion(synthesis),
  };
}

/** `found` is the non-null result of `findEvidenceItem`. */
export function buildItemBrief(found, context) {
  if (found.kind === 'passage') return buildPassageItemBrief(found, context);
  return buildSynthesisItemBrief(found.synthesis, { evidenceDoc: context.evidenceDoc, rightsLedger: context.rightsLedger, rightsRecords: context.rightsRecords });
}

/** `entity` is a resolved rule or candidate record; `found` is its resolved sourcePassageId target. */
export function buildBindingBrief({ entityType, entity, found }, context) {
  const itemBrief = buildPassageItemBrief(found, context);
  const summary = entitySummary(entityType, entity);
  return {
    ...itemBrief,
    brief_kind: 'binding',
    binding: {
      entity_type: entityType,
      entity_id: entity.id,
      title: summary.title,
      category: summary.category,
      description: summary.description,
      cited_sources: entity.evidence ?? [],
      source_passage_id: entity.sourcePassageId,
      currently_bindable_source_supported: isBindableAsSourceSupported(found.passage),
    },
    decision_question: buildBindingDecisionQuestion({
      entityType, entity, summary, passage: found.passage, itemBrief,
    }),
  };
}

// --- --as-of / date plumbing (determinism) ----------------------------------------------------

/**
 * Extracts the raw `--as-of=<value>` / `--as-of <value>` token from argv, falling back to
 * `RIGHTS_BRIEF_AS_OF`. Returns the raw string, or `undefined` when neither is supplied — callers
 * pass this to `resolveAsOfDate` to get a validated `Date` or `null`. Kept separate from date
 * construction so `parseArgs` below can reuse the same argv scan without duplicating validation.
 */
function extractAsOfRaw(argv, env) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--as-of=')) return arg.slice('--as-of='.length);
    if (arg === '--as-of') return argv[i + 1];
  }
  return env.RIGHTS_BRIEF_AS_OF;
}

/**
 * Validates and constructs the `asOf` Date, from an explicit non-empty string ONLY — never a
 * zero-argument `Date` and never a `Date.now` read of the system clock. Returns `null` when no
 * value was supplied (the common case; the brief then carries no `generated_as_of` stamp at all).
 */
export function resolveAsOfDate(raw) {
  if (raw === undefined || raw === '') return null;
  const asOf = new Date(raw);
  if (Number.isNaN(asOf.getTime())) {
    throw new Error(`--as-of value "${raw}" is not a valid ISO 8601 date/time`);
  }
  return asOf;
}

// --- CLI arg parsing -----------------------------------------------------------------------------

const KNOWN_FLAGS = new Set(['--item', '--binding', '--entity-type', '--module', '--as-of', '--format']);

export function parseArgs(argv, env = {}) {
  const opts = {
    item: null, binding: null, entityType: null, module: null, format: 'markdown',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eqIdx = arg.indexOf('=');
    const flag = eqIdx === -1 ? arg : arg.slice(0, eqIdx);
    if (!KNOWN_FLAGS.has(flag)) {
      throw new Error(`unrecognized argument "${arg}"`);
    }
    const value = eqIdx === -1 ? argv[++i] : arg.slice(eqIdx + 1);
    switch (flag) {
      case '--item': opts.item = value; break;
      case '--binding': opts.binding = value; break;
      case '--entity-type': opts.entityType = value; break;
      case '--module': opts.module = value; break;
      case '--as-of': break; // consumed by extractAsOfRaw separately; value token already skipped above
      case '--format': opts.format = value; break;
      default: break;
    }
  }

  if (!opts.item && !opts.binding) {
    throw new Error(
      'exactly one of --item <evidence-item-id> or '
      + '--binding <entityId> --entity-type <rule|candidate> is required',
    );
  }
  if (opts.item && opts.binding) {
    throw new Error('--item and --binding are mutually exclusive');
  }
  if (opts.binding && !opts.entityType) {
    throw new Error('--binding requires --entity-type <rule|candidate>');
  }
  if (opts.entityType && !['rule', 'candidate'].includes(opts.entityType)) {
    throw new Error(`--entity-type must be "rule" or "candidate", got "${opts.entityType}"`);
  }
  if (!['markdown', 'json'].includes(opts.format)) {
    throw new Error(`--format must be "markdown" or "json", got "${opts.format}"`);
  }

  opts.asOfRaw = extractAsOfRaw(argv, env);
  return opts;
}

// --- data loading ----------------------------------------------------------------------------

async function loadEvidenceDoc(rootDir, moduleId) {
  return readJson(path.join(rootDir, 'modules', moduleId, 'evidence.json'));
}

async function loadEntityDoc(rootDir, moduleId, entityType) {
  const filename = entityType === 'rule' ? 'rules.json' : 'candidates.json';
  return readJson(path.join(rootDir, 'modules', moduleId, filename));
}

async function loadRightsJoinData(rootDir) {
  const [rightsLedger, rightsRecords] = await Promise.all([
    readJson(path.join(rootDir, 'rights', 'rights-ledger.json')),
    readJson(path.join(rootDir, 'rights', 'rights-records.json')),
  ]);
  return { rightsLedger, rightsRecords };
}

// --- top-level orchestration (CLI + tests share this) -----------------------------------------

/**
 * Resolves `opts` (from `parseArgs`) against the filesystem at `rootDir` and returns the
 * completed brief object. Pure with respect to the filesystem snapshot it is called against —
 * same files on disk, same `opts`, same result, regardless of when it is called (determinism).
 */
export async function generateDecisionBrief(rootDir, opts) {
  const moduleCandidates = opts.module ? [opts.module] : [...MODULE_IDS];
  const asOfDate = resolveAsOfDate(opts.asOfRaw);
  const { rightsLedger, rightsRecords } = await loadRightsJoinData(rootDir);

  let brief;
  if (opts.item) {
    if (classifyItemId(opts.item) === null) {
      throw new Error(
        `item id "${opts.item}" is not a recognized evidence-item id `
        + '(expected a passage id like "<SOURCE>#ev_001" / "<SOURCE>#implementation-proposal", '
        + 'or a derived_synthesis id like "SYNTH_...")',
      );
    }
    const tried = [];
    for (const moduleId of moduleCandidates) {
      const evidenceDoc = await loadEvidenceDoc(rootDir, moduleId);
      const found = findEvidenceItem(evidenceDoc, opts.item);
      if (found) {
        brief = buildItemBrief(found, { evidenceDoc, rightsLedger, rightsRecords });
        brief.module_id = moduleId;
        break;
      }
      tried.push(moduleId);
    }
    if (!brief) {
      throw new Error(`item id "${opts.item}" was not found in module(s): ${tried.join(', ')}`);
    }
  } else {
    const tried = [];
    for (const moduleId of moduleCandidates) {
      const entityDoc = await loadEntityDoc(rootDir, moduleId, opts.entityType);
      const entity = findEntity(entityDoc, opts.entityType, opts.binding);
      if (entity) {
        if (!entity.sourcePassageId) {
          throw new Error(
            `${opts.entityType} "${opts.binding}" carries no sourcePassageId to brief a binding for`,
          );
        }
        const evidenceDoc = await loadEvidenceDoc(rootDir, moduleId);
        const found = findEvidenceItem(evidenceDoc, entity.sourcePassageId);
        if (!found || found.kind !== 'passage') {
          throw new Error(
            `${opts.entityType} "${opts.binding}"'s sourcePassageId `
            + `"${entity.sourcePassageId}" does not resolve to a known passage`,
          );
        }
        brief = buildBindingBrief(
          { entityType: opts.entityType, entity, found },
          { evidenceDoc, rightsLedger, rightsRecords },
        );
        brief.module_id = moduleId;
        break;
      }
      tried.push(moduleId);
    }
    if (!brief) {
      throw new Error(`${opts.entityType} id "${opts.binding}" was not found in module(s): ${tried.join(', ')}`);
    }
  }

  if (asOfDate) brief.generated_as_of = asOfDate.toISOString();
  return brief;
}

// --- markdown rendering ("one screen per decision", D5 — refined further by EPR4-T6) ----------

function fmtLocator(loc) {
  if (!loc) return '(no structured locator)';
  const parts = [];
  const push = (label, value) => { if (value !== null && value !== undefined) parts.push(`${label}=${value}`); };
  push('source', loc.source);
  push('edition', loc.edition_or_version);
  push('section', loc.section);
  push('table', loc.table);
  push('row', loc.row);
  push('column', loc.column);
  push('assay', loc.assay_or_method);
  push('scope', loc.population_or_scope);
  push('retrieved_at', loc.retrieved_at);
  if (Array.isArray(loc.unresolved_components) && loc.unresolved_components.length > 0) {
    parts.push(`unresolved=[${loc.unresolved_components.join(', ')}]`);
  }
  return parts.length ? parts.join('; ') : '(locator present but empty)';
}

function renderAtom(atom, index) {
  const lines = [`${index + 1}. **[${atom.kind}]** ${atom.text}`];
  lines.push(
    `   - evidence_item_type: ${atom.evidence_item_type} · rights_component_class: `
    + `${atom.rights_component_class} · judgment_basis: ${atom.judgment_basis}`,
  );
  if (atom.issuing_body) {
    const abbr = atom.issuing_body.abbreviation ? ` (${atom.issuing_body.abbreviation})` : '';
    lines.push(`   - issuing_body: ${atom.issuing_body.name}${abbr}`);
  }
  if (atom.scope_or_population) lines.push(`   - scope_or_population: ${atom.scope_or_population}`);
  lines.push(`   - locator: ${fmtLocator(atom.structured_locator)}`);
  return lines.join('\n');
}

export function renderDecisionBriefMarkdown(brief) {
  const lines = [];
  lines.push(`# Decision Brief — ${brief.item_id}`);
  lines.push('');
  lines.push(`**Decision question:** ${brief.decision_question}`);
  lines.push('');

  lines.push('## Item');
  lines.push(`- item_id: ${brief.item_id}`);
  lines.push(`- item_type: ${brief.item_type}`);
  if (brief.module_id) lines.push(`- module: ${brief.module_id}`);
  if (brief.source) lines.push(`- source: ${brief.source.id} — ${brief.source.title} (${brief.source.organization}, ${brief.source.year})`);
  if (brief.status) lines.push(`- status: ${brief.status}`);
  if (brief.passage_fidelity) lines.push(`- passage_fidelity: ${brief.passage_fidelity}`);
  lines.push('');

  if (brief.binding) {
    lines.push('## Binding');
    lines.push(`- entity: ${brief.binding.entity_type} "${brief.binding.entity_id}" — ${brief.binding.title}`);
    if (brief.binding.description) lines.push(`- description: ${brief.binding.description}`);
    lines.push(`- cited_sources: ${brief.binding.cited_sources.join(', ') || '(none)'}`);
    lines.push(`- source_passage_id (current pointer): ${brief.binding.source_passage_id}`);
    lines.push(`- currently_bindable_source_supported: ${brief.binding.currently_bindable_source_supported}`);
    lines.push('');
  }

  if (brief.synthesis) {
    lines.push('## Synthesis');
    lines.push(`- method: ${brief.synthesis.method}`);
    lines.push(`- reproduces_source_arrangement: ${brief.synthesis.reproduces_source_arrangement}`);
    lines.push(`- first_party_rights_holder: ${brief.synthesis.first_party_rights_holder ?? '(unassessed)'}`);
    lines.push(`- attestation_status: ${brief.synthesis.attestation_status}`);
    if (brief.synthesis.divergence_notes.length > 0) {
      lines.push('- divergence_notes:');
      for (const note of brief.synthesis.divergence_notes) lines.push(`  - ${note}`);
    }
    lines.push('');
  }

  if (Array.isArray(brief.inputs) && brief.inputs.length > 0) {
    lines.push('## Attributed inputs');
    brief.inputs.forEach((input, i) => {
      const marker = input.resolved ? '' : ' (unresolved)';
      lines.push(`${i + 1}. [${input.contribution}] ${input.evidence_item_id}${marker}`);
    });
    lines.push('');
  }

  lines.push('## Atoms');
  if (brief.atoms.length === 0) {
    lines.push(Array.isArray(brief.inputs) && brief.inputs.length > 0
      ? '(none for this item directly — see Attributed inputs above)'
      : '(none captured for this item)');
  } else {
    brief.atoms.forEach((atom, i) => lines.push(renderAtom(atom, i)));
  }
  lines.push('');

  lines.push('## Scope / population');
  const sp = brief.scope_and_population;
  if (!sp) {
    lines.push('(not applicable to this item)');
  } else {
    lines.push(`- clinical applicability: ${sp.applicability ? JSON.stringify(sp.applicability) : '(none recorded)'}`);
    lines.push(`- locator population/scope: ${sp.locator_population_or_scope ?? '(not applicable)'}`);
    lines.push(`- guideline-stated scope/population: ${sp.guideline_scope_or_population ?? '(not applicable)'}`);
  }
  lines.push('');

  lines.push('## Recorded rights position (as recorded — this brief makes no clearance determination)');
  // Rendered by ./lib/decision-brief-rights-position.mjs — see the "rights position" section
  // above for why this file never itself reads the rights-authority fields directly.
  lines.push(...renderRightsPositionSection(brief.rights_position));
  lines.push('');

  if (brief.not_captured && brief.not_captured.length > 0) {
    lines.push('## Not captured (D1)');
    for (const entry of brief.not_captured) lines.push(`- ${entry.kind}: ${entry.rationale}`);
    lines.push('');
  }

  if (brief.notes && brief.notes.length > 0) {
    lines.push('## Notes');
    for (const note of brief.notes) lines.push(`- ${note}`);
    lines.push('');
  }

  lines.push('---');
  lines.push(
    '_Generated by scripts/rights/build-decision-brief.mjs. Preparatory material only — '
    + 'establishes no clearance, attestation, or clinical approval (D6). generated_as_of: '
    + `${brief.generated_as_of ?? '(not supplied — this brief carries no wall-clock timestamp)'}._`,
  );
  return `${lines.join('\n')}\n`;
}

// --- thin CLI ------------------------------------------------------------------------------------

/**
 * Realpath-safe "is this module the CLI entry point" check — mirrors scripts/validate-rights.mjs's
 * `resolveIsMain`, including its symlinked-`$TMPDIR` rationale, so this file behaves identically
 * under `node scripts/rights/build-decision-brief.mjs` regardless of checkout path.
 */
function resolveIsMain() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

async function main() {
  try {
    const argv = process.argv.slice(2);
    const opts = parseArgs(argv, process.env);
    const brief = await generateDecisionBrief(root, opts);
    if (opts.format === 'json') {
      process.stdout.write(`${JSON.stringify(brief, null, 2)}\n`);
    } else {
      process.stdout.write(renderDecisionBriefMarkdown(brief));
    }
  } catch (error) {
    console.error(`build-decision-brief: ${error.message}`);
    process.exitCode = 1;
  }
}

if (resolveIsMain()) {
  await main();
}
