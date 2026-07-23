import { assessPediatricAnemia } from './engine.js';
// P4-02/P4-03 (spa-module-switcher-v1, phase-3-5-ui.md) — assessModule is engine.js's existing
// module-generic sibling of assessPediatricAnemia (P2-02, additive, not a replacement). A SEPARATE
// import statement, deliberately not merged into the line above: R-3/smoke-browser-unit-
// rejection.mjs:132 greps for the EXACT literal `import { assessPediatricAnemia } from
// './engine.js'` — adding a second name inside those braces would break that regex. Two import
// statements from the same specifier is valid ES module syntax.
import { assessModule } from './engine.js';
import { EVIDENCE, KNOWLEDGE_BASE_VERSION, sourceRightsPosition } from './evidence.js';
import { initializeAlgorithmExplorer } from './algorithmExplorer.js';
import { toTri } from './facts/tristate.js';
// P3-01..P3-07 (spa-module-switcher-v1, phase-3-5-ui.md) — module switcher seam. P1/P2 exports
// (frozen, side-effect-free) are binding contracts; this file is their first real caller.
import { MODULE_IDS, DEFAULT_MODULE_ID, isRegisteredModule, getModule } from './modules/registry.js';
import { MODULE_MANIFESTS } from './moduleManifests.js';
import { isModuleSelectable } from './moduleEligibility.js';
import { loadModuleKb } from './moduleKbLoaders.js';
import {
  PANEL_HEADER,
  HONESTY_BOUNDARY_DISCLOSURE,
  EVIDENCE_STALENESS_DISCLOSURE,
  UNSIGNED_STUB_SUBTITLE,
  getStatusSentence,
  deriveApprovedByClause,
  UNKNOWN_STATUS_SENTINEL,
  // Phase 4 (P4-01..P4-07) — the four showModuleRefusal() reason derivations, one per SQ-3 §4
  // case (FR-15/FR-16/FR-18) plus the P4-07 unregistered-id case (FR-21).
  deriveEvidenceUnavailableReason,
  deriveNotYetImplementedReason,
  deriveKbLoadFailureReason,
  deriveUnregisteredModuleReason,
} from './moduleStatusVocabulary.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const form = $('#assessment-form');

let rules = [];
let candidates = {};
let currentAudit = null;
let suppressResetHandler = false;

// P3-05 — the SPA's one client-selectable-module state variable. Read from `?module=` on load
// (readModuleIdFromUrl, below) and written back via history.replaceState on explicit selection
// (writeModuleUrlParam). Never persisted to localStorage/sessionStorage/a cookie (FR-24).
let activeModuleId = DEFAULT_MODULE_ID;

// P3-03 — cache of { rules, candidates } COUNTS ONLY, keyed by moduleId, for the switcher panel's
// row renderer. Populated by loadModuleRowCounts() below. Deliberately NOT populated through
// src/moduleKbLoaders.js#loadModuleKb — that function is reserved for the ACTIVE-MODULE
// assessment-KB-load path and must only ever be invoked for a module passing isModuleSelectable
// (see loadActiveModuleKb below, AC-11 groundwork). This cache never feeds `rules`/`candidates`
// (the variables assessPediatricAnemia/assessModule actually consume) and is never read by any
// assess() call — it exists solely so every one of the four rows can honestly display its OWN
// rule/candidate counts (FR-3), including the three modules whose KB this app never loads.
let moduleRowCounts = Object.create(null);

// Fail-closed rejection codes handled by showInputRejection() below — docs/architecture.md §10
// conditions 1 (UNIT_REJECTED, src/units.js/src/ranges/registry.js) and 2
// (AGE_OUT_OF_SUPPORTED_RANGE, modules/anemia/facts.anemia.js). Both share the same thrown-error
// shape (name/code/statusCode/details) so the browser path handles them identically: a clear "no
// assessment produced" placeholder state, never a partial/stale result.
const INPUT_REJECTION_CODES = new Set(['UNIT_REJECTED', 'AGE_OUT_OF_SUPPORTED_RANGE']);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function field(name) {
  return form.elements.namedItem(name);
}

function value(name, fallback = '') {
  const element = field(name);
  if (!element || element instanceof RadioNodeList) return fallback;
  return element.value || fallback;
}

function numeric(name) {
  const raw = value(name);
  if (raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function checked(name) {
  const element = field(name);
  return Boolean(element && !(element instanceof RadioNodeList) && element.checked);
}

function checkedValues(name) {
  return $$(`input[name="${CSS.escape(name)}"]:checked`, form).map((element) => element.value);
}

const symptomNames = [
  'hemodynamicInstability', 'respiratoryDistress', 'syncope', 'alteredMentalStatus',
  'chestPain', 'heartFailureSigns', 'activeMajorBleeding', 'fever', 'neurologicSymptoms',
  'renalSymptoms', 'jaundice', 'darkUrine', 'fatigue', 'pallor',
];

const historyNames = [
  'excessCowMilk', 'cowMilkBefore12Months', 'lowIronDiet', 'vegetarianOrVegan',
  'foodInsecurity', 'pica', 'prematurity', 'malabsorption', 'heavyMenstrualBleeding',
  'giBloodLoss', 'recurrentEpistaxis', 'frequentBloodDonation', 'otherBloodLoss',
  'inflammatoryBowelDisease', 'rheumatologicDisease', 'chronicInfection',
  'otherInflammatoryDisease', 'chronicKidneyDisease', 'liverDisease', 'thyroidDisease',
  'recentViralIllness', 'malariaTravelOrResidence', 'familyThalassemia', 'familySickleCell',
  'familyHemoglobinopathy', 'knownSickleCellDisease', 'knownHereditarySpherocytosis',
  'knownThalassemiaMajor', 'otherChronicHemolyticDisease', 'oxidantMedicationOrFavaExposure',
  'macrocytosisAssociatedMedication', 'leadExposureRisk', 'congenitalAnomalies',
  'thumbOrRadiusAnomaly', 'shortStature', 'abnormalSkinPigmentation', 'microcephaly',
  'priorAdequateIronTrialNoResponse', 'adherenceVerified', 'ongoingBloodLossKnown',
];

const examNames = ['splenomegaly', 'hepatomegaly', 'lymphadenopathy', 'petechiae', 'unexplainedBruising'];

const immediateSafetyNames = [
  'hemodynamicInstability', 'respiratoryDistress', 'syncope', 'alteredMentalStatus',
  'chestPain', 'heartFailureSigns', 'activeMajorBleeding', 'neurologicSymptoms',
];

const specializedLabNames = [
  'indirectBilirubinStatus', 'ldhStatus', 'haptoglobinStatus', 'datStatus',
  'bloodLeadLevel', 'leadSpecimen', 'hbA2Status', 'g6pdStatus', 'b12Status',
  'folateStatus', 'copperStatus', 'creatinineStatus', 'tshStatus', 'liverTestsStatus',
];

function booleans(names) {
  return Object.fromEntries(names.map((name) => [name, checked(name)]));
}

function buildInput() {
  return {
    patient: {
      ageMonths: numeric('ageMonths'),
      sexAtBirth: value('sexAtBirth') || null,
      menstruating: checked('menstruating'),
      recentTransfusion: checked('recentTransfusion'),
      highAltitude: checked('highAltitude'),
    },
    cbc: {
      hemoglobin: numeric('hemoglobin'),
      mcv: numeric('mcv'),
      rdw: numeric('rdw'),
      rbc: numeric('rbc'),
      wbc: numeric('wbc'),
      anc: numeric('anc'),
      platelets: numeric('platelets'),
      rbcInterpretation: value('rbcInterpretation', 'unknown'),
      localRanges: {
        hbLower: numeric('hbLower'),
        mcvLower: numeric('mcvLower'),
        mcvUpper: numeric('mcvUpper'),
        rdwUpper: numeric('rdwUpper'),
        wbcLower: numeric('wbcLower'),
        ancLower: numeric('ancLower'),
        plateletsLower: numeric('plateletsLower'),
      },
      localFlags: {
        leukopenia: checked('leukopenia'),
        neutropenia: checked('neutropenia'),
        thrombocytopenia: checked('thrombocytopenia'),
        thrombocytosis: checked('thrombocytosis'),
      },
    },
    reticulocytes: {
      response: value('reticResponse', 'unknown'),
      absolute: numeric('absoluteRetic'),
    },
    symptoms: booleans(symptomNames),
    history: booleans(historyNames),
    exam: booleans(examNames),
    labs: {
      ferritin: numeric('ferritin'),
      ferritinStatus: value('ferritinStatus', 'unknown'),
      crpStatus: value('crpStatus', 'unknown'),
      tsatStatus: value('tsatStatus', 'unknown'),
      tibcStatus: value('tibcStatus', 'unknown'),
      ironStatus: value('ironStatus', 'unknown'),
      stfrFerritinIndex: numeric('stfrFerritinIndex'),
      indirectBilirubinStatus: value('indirectBilirubinStatus', 'unknown'),
      ldhStatus: value('ldhStatus', 'unknown'),
      haptoglobinStatus: value('haptoglobinStatus', 'unknown'),
      datStatus: value('datStatus', 'unknown'),
      bloodLeadLevel: numeric('bloodLeadLevel'),
      leadSpecimen: value('leadSpecimen', 'unknown'),
      hbA2Status: value('hbA2Status', 'unknown'),
      hbBartNewbornScreen: checked('hbBartNewbornScreen'),
      alphaGlobinTestingPositive: checked('alphaGlobinTestingPositive'),
      betaGlobinTestingPositive: checked('betaGlobinTestingPositive'),
      sicklingHemoglobinDetected: checked('sicklingHemoglobinDetected'),
      g6pdStatus: value('g6pdStatus', 'unknown'),
      g6pdTestDuringAcuteHemolysis: checked('g6pdTestDuringAcuteHemolysis'),
      g6pdTestSoonAfterTransfusion: checked('g6pdTestSoonAfterTransfusion'),
      b12Status: value('b12Status', 'unknown'),
      folateStatus: value('folateStatus', 'unknown'),
      copperStatus: value('copperStatus', 'unknown'),
      creatinineStatus: value('creatinineStatus', 'unknown'),
      tshStatus: value('tshStatus', 'unknown'),
      liverTestsStatus: value('liverTestsStatus', 'unknown'),
    },
    smear: checkedValues('smear'),
  };
}

function citeChips(ids = []) {
  return [...new Set(ids)]
    .filter((id) => EVIDENCE[id])
    .map((id) => `<a class="chip citation" href="${escapeHtml(EVIDENCE[id].url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(EVIDENCE[id].title)}">${escapeHtml(id)}</a>`)
    .join('');
}

function list(items, className = '') {
  if (!items?.length) return '';
  return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function humanize(value) {
  if (value === null || value === undefined || value === '') return 'Indeterminate';
  return String(value)
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAge(ageMonths) {
  if (!Number.isFinite(ageMonths)) return 'Not entered';
  if (ageMonths < 24) return `${ageMonths} month${ageMonths === 1 ? '' : 's'}`;
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  return months ? `${years}y ${months}m` : `${years} year${years === 1 ? '' : 's'}`;
}

function meaningful(name) {
  const current = value(name);
  return current !== '' && current !== 'unknown';
}

function anyChecked(names) {
  return names.some((name) => checked(name));
}

function updateWorkflowState(coreComplete) {
  const sectionState = {
    'step-patient': coreComplete,
    'step-safety': Boolean($('#safety-reviewed-no-flags')?.checked || anyChecked(immediateSafetyNames)),
    'step-iron': meaningful('reticResponse') || numeric('ferritin') !== null || meaningful('crpStatus') || meaningful('tsatStatus'),
    'step-specialized': specializedLabNames.some((name) => numeric(name) !== null || meaningful(name))
      || checked('hbBartNewbornScreen') || checked('alphaGlobinTestingPositive')
      || checked('betaGlobinTestingPositive') || checked('sicklingHemoglobinDetected'),
    'step-history': anyChecked(historyNames),
    'step-smear': checkedValues('smear').length > 0 || anyChecked(examNames),
  };

  $$('.workflow-step').forEach((button) => {
    button.classList.toggle('complete', Boolean(sectionState[button.dataset.stepTarget]));
  });
}

function updateCaseUi() {
  const age = numeric('ageMonths');
  const hemoglobin = numeric('hemoglobin');
  const mcv = numeric('mcv');
  const retic = value('reticResponse', 'unknown');
  const coreCount = [age, hemoglobin, mcv].filter((item) => item !== null).length;
  const coreComplete = coreCount === 3;
  const safetyCount = immediateSafetyNames.filter((name) => checked(name)).length;

  let depth = coreCount * 18;
  if (value('sexAtBirth')) depth += 5;
  if (numeric('rdw') !== null) depth += 5;
  if (retic !== 'unknown') depth += 10;
  if (numeric('ferritin') !== null) depth += 8;
  if (meaningful('crpStatus') || meaningful('tsatStatus') || meaningful('tibcStatus')) depth += 5;
  if (anyChecked(historyNames) || anyChecked(examNames) || checkedValues('smear').length || specializedLabNames.some((name) => meaningful(name) || numeric(name) !== null)) depth += 13;
  depth = Math.min(100, depth);

  const completionBar = $('#completion-bar');
  if (completionBar) completionBar.style.width = `${depth}%`;
  if ($('#completion-label')) $('#completion-label').textContent = coreComplete ? 'Ready to run' : 'Core inputs incomplete';
  if ($('#completion-detail')) {
    $('#completion-detail').textContent = coreComplete
      ? `Input depth ${depth}%. Additional context can improve discrimination.`
      : `Enter ${3 - coreCount} remaining core value${3 - coreCount === 1 ? '' : 's'}: age, hemoglobin, and MCV.`;
  }

  if ($('#snapshot-title')) $('#snapshot-title').textContent = coreComplete ? 'Core inputs ready' : 'Ready for case data';
  if ($('#snapshot-subtitle')) {
    $('#snapshot-subtitle').textContent = safetyCount
      ? `${safetyCount} immediate safety finding${safetyCount === 1 ? '' : 's'} selected; assessment will surface escalation rules.`
      : coreComplete
        ? 'Run the assessment to classify morphology and generate an evidence-linked differential.'
        : 'Enter de-identified findings to build a deterministic, evidence-linked assessment.';
  }
  if ($('#case-snapshot')) {
    $('#case-snapshot').innerHTML = `
      <div><span>Age</span><strong>${escapeHtml(formatAge(age))}</strong></div>
      <div><span>Hemoglobin</span><strong>${hemoglobin === null ? 'Not entered' : `${escapeHtml(hemoglobin)} g/dL`}</strong></div>
      <div><span>MCV</span><strong>${mcv === null ? 'Not entered' : `${escapeHtml(mcv)} fL`}</strong></div>
      <div><span>Reticulocytes</span><strong>${escapeHtml(humanize(retic))}</strong></div>`;
  }

  updateWorkflowState(coreComplete);
}

function renderClassification(result) {
  const c = result.classification;
  const hbDisplay = c.hemoglobin === null ? 'Not entered' : `${c.hemoglobin} g/dL`;
  const hbLimit = c.hemoglobinLowerLimit === null ? 'No limit' : `${c.hemoglobinLowerLimit} g/dL`;
  const mcvDisplay = c.mcv === null ? 'Not entered' : `${c.mcv} fL`;
  const mcvRange = c.mcvLowerLimit === null || c.mcvUpperLimit === null
    ? 'No range'
    : `${c.mcvLowerLimit}–${c.mcvUpperLimit} fL`;
  const sourceLabels = {
    LOCAL_LAB: 'Local laboratory',
    AAP2026_IDA: 'AAP pediatric fallback',
    WHO2024_HB: 'WHO hemoglobin guidance'
  };
  const source = sourceLabels[c.thresholdSource] || c.thresholdSource || 'Unavailable';
  const classificationEvidence = c.thresholdSource === 'LOCAL_LAB'
    ? ['WHO2024_HB']
    : ['AAP2026_IDA', 'WHO2024_HB'];

  return `
    <div class="card result-header">
      <div class="result-headline">
        <div>
          <h2>Assessment summary</h2>
          <p>${escapeHtml(result.meta.status)} · ${escapeHtml(result.meta.knowledgeBaseVersion)}</p>
        </div>
        <div class="result-actions">
          <button class="button ghost" type="button" data-result-action="print">Print</button>
          <button class="button secondary" type="button" data-result-action="audit">Audit JSON</button>
        </div>
      </div>
      <div class="classification-grid">
        <div class="metric metric-primary"><span>Anemia</span><strong>${escapeHtml(humanize(c.anemiaStatus))}</strong></div>
        <div class="metric"><span>Hemoglobin</span><strong>${escapeHtml(hbDisplay)}</strong><small>Lower limit ${escapeHtml(hbLimit)}</small></div>
        <div class="metric metric-primary"><span>Morphology</span><strong>${escapeHtml(humanize(c.morphology))}</strong></div>
        <div class="metric"><span>MCV</span><strong>${escapeHtml(mcvDisplay)}</strong><small>Range ${escapeHtml(mcvRange)}</small></div>
        <div class="metric"><span>Reticulocytes</span><strong>${escapeHtml(humanize(c.reticulocyteResponse))}</strong></div>
        <div class="metric"><span>Range source</span><strong>${escapeHtml(source)}</strong><small>${escapeHtml(c.ageBand || '')}</small></div>
      </div>
      <div class="citation-chips">${citeChips(classificationEvidence)}</div>
    </div>`;
}

function renderAlerts(alerts) {
  const body = alerts.length
    ? alerts.map((item) => `
      <article class="alert-card ${escapeHtml(item.severity)}">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.detail)}</p>
        ${list(item.actions)}
        <div class="citation-chips">${citeChips(item.evidence)}</div>
      </article>`).join('')
    : '<div class="alert-clear"><strong>No urgent rule triggered</strong><span>This is not a clinical clearance; only supplied data were evaluated.</span></div>';
  return `<section class="card result-section"><h3>Safety and escalation</h3>${body}</section>`;
}

function renderCandidates(candidatesList) {
  const body = candidatesList.length
    ? candidatesList.map((item) => `
      <article class="candidate-card">
        <div class="candidate-head">
          <h4><span class="rank">#${item.rank}</span>${escapeHtml(item.label)}</h4>
          <span class="level-badge">${escapeHtml(humanize(item.level))}</span>
        </div>
        <p class="candidate-summary">${escapeHtml(item.summary)}</p>
        ${list(item.supportingFindings)}
        ${item.cautions?.length ? `<div class="cautions"><strong>Cautions</strong>${list(item.cautions)}</div>` : ''}
        <details>
          <summary>Confirmatory questions / next steps</summary>
          ${list(item.nextSteps)}
        </details>
        <div class="rule-chips">${item.matchedRules.map((id) => `<span class="chip">${escapeHtml(id)}</span>`).join('')}</div>
        <div class="citation-chips">${citeChips(item.evidence)}</div>
      </article>`).join('')
    : '<p class="empty-state">No diagnostic pattern rule matched yet. Complete the adaptive questions or enter local reference ranges.</p>';

  return `<section class="card result-section"><h3>Ranked pattern differential <span class="section-count">${candidatesList.length}</span></h3><p class="section-help">Ordering is deterministic rule priority, not a probability or diagnosis.</p>${body}</section>`;
}

function renderQuestions(questions) {
  const body = questions.length
    ? questions.map((item) => `
      <article class="question-card">
        <strong>${escapeHtml(item.prompt)}</strong>
        <span>${escapeHtml(item.why)}</span>
        <div class="citation-chips">${citeChips(item.evidence)}</div>
      </article>`).join('')
    : '<p class="empty-state">No additional question rule triggered.</p>';
  return `<section class="card result-section"><h3>Highest-yield next questions</h3>${body}</section>`;
}

function renderNotes(notes) {
  if (!notes.length) return '';
  const body = notes.map((item) => `
    <article class="note-card">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.detail)}</span>
      <div class="citation-chips">${citeChips(item.evidence)}</div>
    </article>`).join('');
  return `<section class="card result-section"><h3>Interpretive notes</h3>${body}</section>`;
}

function renderLimitations(limitations) {
  return `<section class="card result-section"><h3>Limits of this output</h3>${list(limitations, 'limitation-list')}</section>`;
}

function renderUnitAssumptions(result) {
  const fields = result.provenance?.unitsAssumed;
  if (!Array.isArray(fields) || fields.length === 0) return '';
  return `
    <aside class="unit-assumption-notice" role="note" aria-label="Default units applied">
      <strong>Documented default units applied</strong>
      <span>The following supplied values were interpreted using their documented default unit:</span>
      <ul>${fields.map((fieldName) => `<li><code>${escapeHtml(fieldName)}</code></li>`).join('')}</ul>
    </aside>`;
}

function renderResult(result) {
  $('#results-placeholder').hidden = true;
  const container = $('#results');
  container.hidden = false;
  container.innerHTML = `<div class="result-stack">
    ${renderClassification(result)}
    ${renderUnitAssumptions(result)}
    ${renderAlerts(result.alerts)}
    ${renderCandidates(result.rankedDifferential)}
    ${renderQuestions(result.nextQuestions)}
    ${renderNotes(result.interpretiveNotes)}
    ${renderLimitations(result.limitations)}
  </div>`;
  $('.results-column')?.scrollTo({ top: 0, behavior: 'smooth' });
}

// EPR2-T6 (R-P2 resilience, FR-WP2-07): rights-position label rendered via
// src/evidence.js#sourceRightsPosition, which degrades a legacy-shape source (or one with no
// determined license.status) to "rights position unassessed" rather than throwing or being
// silently omitted — an omitted label would read to a clinician as "nothing to worry about",
// which is exactly the false "unrestricted" reading this task exists to prevent.
function renderEvidence() {
  const entries = Object.values(EVIDENCE).sort((a, b) => b.year - a.year || a.id.localeCompare(b.id));
  $('#evidence-list').innerHTML = entries.map((entry) => `
    <article id="evidence-${escapeHtml(entry.id)}" class="card evidence-card">
      <span class="priority-pill ${(entry.priority ?? '').includes('foundational') ? 'foundational' : ''}">${escapeHtml(entry.priority)}</span>
      <h3>${escapeHtml(entry.title)}</h3>
      <p class="meta">${escapeHtml(entry.organization)} · ${escapeHtml(entry.journal)} · ${entry.doi ? `DOI ${escapeHtml(entry.doi)}` : ''}</p>
      <p class="meta rights-position">Rights position: ${escapeHtml(sourceRightsPosition(entry))}</p>
      ${list(entry.supports)}
      ${entry.recencyNote ? `<p class="meta"><strong>Recency note:</strong> ${escapeHtml(entry.recencyNote)}</p>` : ''}
      <a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer">Open authoritative source</a>
    </article>`).join('');
}

function ruleDescription(rule) {
  const output = rule.output ?? {};
  if (output.type === 'candidate') {
    return `Adds ${output.level} support to “${candidates[output.candidateId]?.label ?? output.candidateId}” (+${output.points ?? 0} deterministic priority points).`;
  }
  if (output.type === 'alert') return `${humanize(output.severity)} alert: ${output.title}`;
  if (output.type === 'question') return `Adaptive question: ${output.prompt}`;
  if (output.type === 'note') return `Interpretive note: ${output.title}`;
  return output.type ?? 'Unknown output';
}

function renderRules(filterText = '') {
  const normalized = filterText.trim().toLowerCase();
  const filtered = rules.filter((rule) => {
    const haystack = `${rule.id} ${rule.category} ${ruleDescription(rule)} ${(rule.evidence ?? []).join(' ')}`.toLowerCase();
    return !normalized || haystack.includes(normalized);
  });
  $('#rule-count').textContent = `${rules.length} deterministic rules; ${Object.keys(candidates).length} merged diagnostic patterns. Showing ${filtered.length}.`;
  $('#rule-list').innerHTML = filtered.map((rule) => `
    <article class="rule-row">
      <div class="rule-row-head"><div><code>${escapeHtml(rule.id)}</code> <span class="category">${escapeHtml(rule.category)}</span></div><div class="citation-chips">${citeChips(rule.evidence)}</div></div>
      <p>${escapeHtml(ruleDescription(rule))}</p>
    </article>`).join('');
}

function switchTab(tabName, { syncHash = true } = {}) {
  const validTabs = new Set($$('.tab-panel').map((panel) => panel.id));
  const resolvedTab = validTabs.has(tabName) ? tabName : 'assessment';
  $$('.tab-button').forEach((button) => {
    const active = button.dataset.tab === resolvedTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  $$('.tab-panel').forEach((panel) => {
    const active = panel.id === resolvedTab;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
  // P3-06 (FR-23/R-7) — preserve window.location.search (carries `?module=`) while updating only
  // the hash. The prior form, `replaceState(null, '', `#${resolvedTab}`)`, silently discarded the
  // query string on every tab switch. Hash-routing behaviour below this line is unchanged.
  if (syncHash && window.location.hash !== `#${resolvedTab}`) {
    window.history.replaceState(null, '', `${window.location.search}#${resolvedTab}`);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =================================================================================================
// P3-01..P3-07 — module switcher: header dropdown (mockup variant B, D-7 operator override) +
// main-column status banner + `?module=` URL state.
//
// D-6 allow-list corollary (decisions-block.md §0 D-6): the row/banner renderer below may read
// ONLY these MODULE_MANIFESTS fields — id, title, status, knowledgeBaseVersion,
// evidenceReviewedThrough, approvedBy(.length). Every other manifest field (clinicalContentHash,
// governanceHash, validationRunId, supersedes, releasedAt, and every CBC/growth/kidney-specific
// extension field such as module_topic/intended_hcp_users/evidence_policy) is structurally
// unreachable through getManifestView() below, not merely unused by convention — a future call
// site cannot accidentally leak one without changing this one function. `manifest.approvedBy`
// (the raw array) is read ONLY to hand to moduleStatusVocabulary.js's own exported
// deriveApprovedByClause() (FR-9's sanctioned derivation), never rendered or exposed directly.
function getManifestView(moduleId) {
  const manifest = MODULE_MANIFESTS[moduleId];
  if (!manifest) return null;
  return {
    id: manifest.id,
    title: manifest.title || moduleId,
    status: manifest.status,
    knowledgeBaseVersion: manifest.knowledgeBaseVersion,
    evidenceReviewedThrough: manifest.evidenceReviewedThrough,
    approvedByClause: deriveApprovedByClause(manifest.approvedBy),
  };
}

// FR-17-shaped reason text for a not-selectable row/banner: the verbatim canonical sentence for a
// real enum status, or (defensively; not reachable with today's four real manifests) a
// structural — never clinical-capability — fallback for a status outside the closed enum.
function moduleStatusReasonText(status) {
  const sentence = getStatusSentence(status);
  return sentence === UNKNOWN_STATUS_SENTINEL
    ? `Manifest status "${status}" is not a recognized value in the closed enum; this module cannot be assessed.`
    : sentence;
}

// P3-03 count-only fetch — literal fetch() specifiers only (never template-built: R-4/FR-36), one
// pair per registered module. Deliberately separate from src/moduleKbLoaders.js#loadModuleKb,
// which stays reserved for the active-module assessment-KB-load path and is only ever invoked for
// a module passing isModuleSelectable (loadActiveModuleKb, below). This function's results are
// read-only display counts: they are never assigned to `rules`/`candidates` and never reach
// assessPediatricAnemia/assessModule/assess.
const MODULE_ROW_COUNT_FETCHERS = Object.freeze({
  anemia: () => Promise.all([
    fetch('./modules/anemia/rules.json'),
    fetch('./modules/anemia/candidates.json'),
  ]),
  cbc_suite_v1: () => Promise.all([
    fetch('./modules/cbc_suite_v1/rules.json'),
    fetch('./modules/cbc_suite_v1/candidates.json'),
  ]),
  growth_suite_v1: () => Promise.all([
    fetch('./modules/growth_suite_v1/rules.json'),
    fetch('./modules/growth_suite_v1/candidates.json'),
  ]),
  kidney_suite_v1: () => Promise.all([
    fetch('./modules/kidney_suite_v1/rules.json'),
    fetch('./modules/kidney_suite_v1/candidates.json'),
  ]),
});

async function loadModuleRowCounts() {
  await Promise.all(MODULE_IDS.map(async (moduleId) => {
    const fetchPair = MODULE_ROW_COUNT_FETCHERS[moduleId];
    if (!fetchPair) return; // R-P2: an id with no count fetcher simply omits its counts line.
    try {
      const [rulesResponse, candidatesResponse] = await fetchPair();
      if (!rulesResponse.ok || !candidatesResponse.ok) return;
      const rulesJson = await rulesResponse.json();
      const candidatesJson = await candidatesResponse.json();
      moduleRowCounts[moduleId] = {
        rules: Array.isArray(rulesJson) ? rulesJson.length : 0,
        candidates: candidatesJson && typeof candidatesJson === 'object' ? Object.keys(candidatesJson).length : 0,
      };
    } catch {
      // R-P2 handling: never invent a placeholder count. Leave this moduleId absent from
      // moduleRowCounts so the row renderer omits the counts line entirely.
    }
  }));
  renderModuleSwitcher();
}

// P3-GATE fix 1 (CRITICAL, D-1 / SQ-3 F9) — mechanical not-yet-implemented capability detection,
// reusable as-is by P4-03 (FR-16 Case 2). Never checks a module-id literal: SQ-3 F9's whole point
// is that cbc_suite_v1 is not-implemented IN EFFECT (modules/cbc_suite_v1/index.js:35,38 delegates
// every hook to the anemia module, so it returns anemia's real classification shape under a CBC
// label) but has no honest "not yet implemented" self-report the way growth/kidney do — an id
// check would have to special-case cbc_suite_v1 by name, which is exactly the kind of
// module-id-shaped branch this codebase's generic-engine posture forbids.
//
// Two tiers, preferential first:
//   1. Module-descriptor capability read: `hooks.notYetImplemented === true`, a static flag a
//      future module MAY declare directly on its exported descriptor without this function ever
//      having to invoke that module's own hooks. None of today's 4 real modules declare it, so
//      this tier is currently always a miss — reserved for a module that wants to self-report
//      without a runtime call.
//   2. Fallback: call `summarize(deriveFacts({}))` and check EITHER `notYetImplemented === true`
//      (modules/growth_suite_v1/index.js:46-51) OR `status === 'not_yet_implemented'`
//      (modules/kidney_suite_v1/index.js:37-42) — the two honest self-report shapes that exist in
//      this repo today. Wrapped defensively: a hook that throws on an empty input is treated as
//      "cannot determine" (false), never as "implemented" (fail toward suppressing the line, not
//      toward showing a possibly-borrowed one).
//
// cbc_suite_v1's delegated summarize() returns anemia's real classification object (anemiaStatus/
// hemoglobin/morphology/...) — neither shape above — so this correctly returns false for it.
function moduleReportsNotYetImplemented(hooks) {
  if (!hooks) return false;
  if (hooks.notYetImplemented === true) return true; // tier 1
  try {
    const summary = hooks.summarize(hooks.deriveFacts({})); // tier 2
    return summary?.notYetImplemented === true || summary?.status === 'not_yet_implemented';
  } catch {
    return false;
  }
}

// One row's markup for the dropdown panel — identical template for both structural groups; group
// placement is decided by the caller from isModuleSelectable(moduleId) (P2-03), computed once.
function moduleRowMarkup(moduleId) {
  const view = getManifestView(moduleId);
  const selectable = isModuleSelectable(moduleId);
  const isActive = moduleId === activeModuleId;
  const currentAttr = isActive ? ' aria-current="true"' : '';

  // R-P2: a MODULE_IDS entry absent from the manifest map (drift, not reachable with today's
  // four real manifests) still renders — in the not-selectable group (isModuleSelectable() is
  // false with no manifest) — with an FR-17-shaped reason, never silently dropped.
  if (!view) {
    const reason = `No published manifest is registered for module "${escapeHtml(moduleId)}"; it cannot be assessed.`;
    return `<button type="button" class="module-row module-row--inert" data-module-id="${escapeHtml(moduleId)}" disabled aria-disabled="true"${currentAttr} aria-label="${escapeHtml(moduleId)}. ${reason}">
      <span class="module-row-main"><strong class="module-row-title">${escapeHtml(moduleId)}</strong></span>
      <span class="module-row-meta"><span class="module-row-reason">${reason}</span></span>
      <span class="module-row-lock" aria-hidden="true">&#128274;</span>
    </button>`;
  }

  let hooks = null;
  try {
    hooks = getModule(moduleId);
  } catch {
    hooks = null;
  }
  const engineLabel = hooks?.manifest?.engineLabel ?? '';
  const counts = moduleRowCounts[moduleId];
  const countsLine = counts
    ? `${counts.rules} rule${counts.rules === 1 ? '' : 's'} · ${counts.candidates} pattern${counts.candidates === 1 ? '' : 's'}`
    : '';
  const subtitle = view.status === 'unsigned-stub' ? UNSIGNED_STUB_SUBTITLE : '';
  const reason = moduleStatusReasonText(view.status);

  // FR-3: "for scaffolds the row also shows the module's own limitations() notice text." Derived
  // from the module's own deriveFacts({})/limitations(facts) hooks — never invented prose. Wrapped
  // defensively (never crash the row renderer); on failure the line is simply omitted (R-P2).
  //
  // P3-GATE fix 1 (CRITICAL, D-1 / SQ-3 F9): render this line ONLY when the module SELF-REPORTS
  // not-yet-implemented via moduleReportsNotYetImplemented() above (growth_suite_v1/
  // kidney_suite_v1 do — their limitations() text is genuinely their own, authored against their
  // own inert facts). cbc_suite_v1 delegates every hook to the anemia module
  // (modules/cbc_suite_v1/index.js:35,38), so calling its limitations() here would render
  // ANEMIA'S fact-shaped caveat ("Built-in CBC reference intervals are not validated for this
  // age...") under the CBC Suite label — a masquerade indistinguishable from "CBC evaluated
  // something," the exact hazard D-1/FR-4 exists to close (SQ-3 F9). Suppressing it is not a
  // silent omission: the vocabulary status sentence rendered below ("No assessment can be
  // produced from this module") already carries the true, honest statement for cbc_suite_v1.
  let limitationText = '';
  if (!selectable && hooks && moduleReportsNotYetImplemented(hooks)) {
    try {
      const facts = hooks.deriveFacts({});
      const items = hooks.limitations(facts);
      if (Array.isArray(items) && items.length) limitationText = items[0];
    } catch {
      limitationText = '';
    }
  }

  const accessibleNameParts = [`${view.title}.`, `Status ${view.status}.`];
  if (!selectable) accessibleNameParts.push(reason);
  const accessibleName = escapeHtml(accessibleNameParts.join(' '));

  const bodyMarkup = `
    <span class="module-row-main">
      <strong class="module-row-title">${escapeHtml(view.title)}</strong>
      <span class="status-chip" data-module-status="${escapeHtml(view.status)}">${escapeHtml(view.status)}</span>
      ${subtitle ? `<span class="module-row-subtitle">${escapeHtml(subtitle)}</span>` : ''}
    </span>
    <span class="module-row-meta">
      ${engineLabel ? `<span class="module-row-engine-label">${escapeHtml(engineLabel)}</span>` : ''}
      ${countsLine ? `<span class="module-row-counts">${escapeHtml(countsLine)}</span>` : ''}
      ${limitationText ? `<span class="module-row-limitation">${escapeHtml(limitationText)}</span>` : ''}
      ${!selectable ? `<span class="module-row-reason">${escapeHtml(reason)}</span>` : ''}
    </span>
    ${!selectable ? '<span class="module-row-lock" aria-hidden="true">&#128274;</span>' : ''}`;

  if (selectable) {
    return `<button type="button" class="module-row module-row--selectable" data-module-id="${escapeHtml(moduleId)}"${currentAttr} aria-label="${accessibleName}">${bodyMarkup}</button>`;
  }
  // FR-37(a): a real `disabled` + `aria-disabled` attribute — a non-focusable, non-activatable
  // state assistive technology reports as unavailable, not merely a dimmed look. FR-37(b): the
  // reason is both visible text (module-row-reason above) AND part of the accessible name
  // (aria-label) — never conveyed by colour/opacity/hatching alone.
  //
  // NOTE (P3-07 boundary, do not mistake this for the security gate): `disabled` is a
  // PRESENTATION guarantee only — a devtools user can delete the attribute from this element.
  // The real gate is the isModuleSelectable() predicate re-checked INSIDE selectModule()/the
  // submit and load-example handlers below (AC-11), not this attribute.
  return `<button type="button" class="module-row module-row--inert" data-module-id="${escapeHtml(moduleId)}" disabled aria-disabled="true"${currentAttr} aria-label="${accessibleName}">${bodyMarkup}</button>`;
}

function renderModuleSwitcherRows() {
  const selectableList = $('#module-row-list-selectable');
  const notSelectableList = $('#module-row-list-not-selectable');
  if (!selectableList || !notSelectableList) return;
  const selectableIds = [];
  const notSelectableIds = [];
  // Group membership computed ONCE per id, from the single P2-03 predicate — no second,
  // divergent eligibility check anywhere in this file.
  for (const moduleId of MODULE_IDS) {
    (isModuleSelectable(moduleId) ? selectableIds : notSelectableIds).push(moduleId);
  }
  selectableList.innerHTML = selectableIds.map(moduleRowMarkup).join('');
  notSelectableList.innerHTML = notSelectableIds.map(moduleRowMarkup).join('');
}

function renderModuleSwitcherCollapsedControl() {
  const label = $('#module-switcher-active-label');
  if (!label) return;
  const view = getManifestView(activeModuleId);
  if (!view) {
    // Minimal, honest fallback for an id with no registered manifest (only reachable via a
    // hand-edited `?module=`; readModuleIdFromUrl never substitutes anemia for it). P4-01/P4-07
    // ADD the full FR-21 refusal (showModuleRefusal(), naming the requested id) in the RESULTS
    // area (#results-placeholder) — a separate DOM region from this collapsed control. This
    // banner-area fallback is not replaced by that; both together are the complete picture.
    label.innerHTML = `<span class="module-switcher-active-title">Unregistered module: ${escapeHtml(activeModuleId)}</span>`;
    return;
  }
  label.innerHTML = `<span class="module-switcher-active-title">${escapeHtml(view.title)}</span>
    <span class="status-chip" data-module-status="${escapeHtml(view.status)}">${escapeHtml(view.status)}</span>`;
  const toggle = $('#module-switcher-toggle');
  if (toggle) {
    toggle.setAttribute('aria-label', `Clinical module selector. Current module: ${view.title}, status ${view.status}. Activate to change module.`);
  }
}

function renderModuleSwitcher() {
  const header = $('#module-switcher-panel-header');
  if (header) header.textContent = PANEL_HEADER; // FR-2/D-3 — verbatim, by identifier, never inline.
  renderModuleSwitcherCollapsedControl();
  renderModuleSwitcherRows();
}

function renderModuleStatusBanner() {
  const banner = $('#module-status-banner');
  if (!banner) return;
  const view = getManifestView(activeModuleId);
  if (!view) {
    // Same fallback boundary as renderModuleSwitcherCollapsedControl() above — P4-01/P4-07 ADD
    // the full FR-21 refusal in the results area (#results-placeholder), a separate DOM region;
    // this banner-area fallback is unchanged by that.
    $('#module-status-title').textContent = `Unregistered module: ${activeModuleId}`;
    $('#module-status-chip').textContent = '';
    $('#module-status-subtitle').hidden = true;
    $('#module-status-sentence').textContent = `No published manifest is registered for "${activeModuleId}".`;
    $('#module-status-approved-by').textContent = '';
    $('#module-status-kb-meta').textContent = '';
    $('#module-status-honesty').textContent = HONESTY_BOUNDARY_DISCLOSURE;
    return;
  }

  $('#module-status-title').textContent = view.title;
  // FR-7 — the primary chip is manifest.status rendered verbatim from the closed enum.
  $('#module-status-chip').textContent = view.status;
  $('#module-status-chip').dataset.moduleStatus = view.status;

  // FR-10 — the human-readable subtitle renders ONLY where status === 'unsigned-stub'.
  const subtitleEl = $('#module-status-subtitle');
  if (view.status === 'unsigned-stub') {
    subtitleEl.textContent = UNSIGNED_STUB_SUBTITLE;
    subtitleEl.hidden = false;
  } else {
    subtitleEl.textContent = '';
    subtitleEl.hidden = true;
  }

  // FR-8 — the full canonical per-status sentence, referenced by identifier, rendered verbatim.
  $('#module-status-sentence').textContent = moduleStatusReasonText(view.status);

  // FR-9 — the universal approvedBy clause, for every module including anemia, computed live via
  // moduleStatusVocabulary.js#deriveApprovedByClause (never a hardcoded string independent of the
  // manifest's actual approvedBy content).
  $('#module-status-approved-by').textContent = view.approvedByClause;

  // FR-34 — the staleness non-enforcement disclosure renders adjacent to evidenceReviewedThrough,
  // in the panel, never a tooltip.
  const kbMeta = $('#module-status-kb-meta');
  kbMeta.innerHTML = `Knowledge base <strong>${escapeHtml(view.knowledgeBaseVersion ?? 'unspecified')}</strong> `
    + `· Evidence reviewed through <strong>${escapeHtml(view.evidenceReviewedThrough ?? 'unspecified')}</strong>. `
    + `${escapeHtml(EVIDENCE_STALENESS_DISCLOSURE)}`;

  // FR-13 — the honesty-boundary disclosure, in the panel, never a tooltip, verbatim.
  $('#module-status-honesty').textContent = HONESTY_BOUNDARY_DISCLOSURE;
}

// P3-05 (FR-20) — read `?module=` on load, validate with isRegisteredModule(). Absent ->
// DEFAULT_MODULE_ID. An unregistered id is deliberately NOT substituted with DEFAULT_MODULE_ID
// here (D-4 "never a silent fallback to anemia") — it is returned as-is so the caller can render
// the (interim, P3-scoped) fallback state above; the full FR-21 named refusal is P4-07.
function readModuleIdFromUrl() {
  const requested = new URLSearchParams(window.location.search).get('module');
  if (!requested) return DEFAULT_MODULE_ID;
  // FR-20/FR-21 (P3-05) — validate with isRegisteredModule() (src/modules/registry.js:75), the
  // canonical, single source of registration truth. This must be THIS function, never a proxy
  // for it (e.g. Object.hasOwn(MODULE_MANIFESTS, requested)) — the registry, not the manifest
  // map, is what "registered" means. A registered id is returned as-is even if it later turns
  // out ineligible (isModuleSelectable() decides that separately, downstream) — that path is
  // intentional (an inert, registered module like cbc_suite_v1 must still select its row and
  // banner, no assessment). An UNREGISTERED id is ALSO returned as-is: it is never silently
  // substituted with DEFAULT_MODULE_ID (D-4 "never a silent fallback to anemia") — it is what
  // drives the P3-scoped honest interim placeholder in renderModuleSwitcherCollapsedControl()/
  // renderModuleStatusBanner() below. The full FR-21 refusal naming the requested id is P4-07's.
  if (isRegisteredModule(requested)) return requested;
  console.warn(`?module=${requested} failed isRegisteredModule() — this id is not registered. `
    + 'Rendering the P3-scoped interim placeholder, never substituting DEFAULT_MODULE_ID; '
    + 'P4-07 owns the full FR-21 named refusal.');
  return requested;
}

// P3-05/P3-06 (FR-22) — writes `?module=<id>` via history.replaceState while PRESERVING the
// current `#tab` hash (the same query<->hash symmetry P3-06 gives switchTab above). No
// localStorage/sessionStorage/cookie is read or written anywhere in this file (FR-24).
function writeModuleUrlParam(moduleId) {
  const url = new URL(window.location.href);
  url.searchParams.set('module', moduleId);
  window.history.replaceState(null, '', `${url.search}${window.location.hash}`);
}

// AC-11 groundwork — disables (functionally, not just visually) the controls that would otherwise
// let a clinician attempt an assessment against an ineligible active module. This is presentation;
// the real gate is the isModuleSelectable() guard re-checked inside the handlers themselves below.
// Phase 4: this is now called ONLY on the activateModule() success path (module selectable, KB
// loaded) — every refusal branch below disables the same three controls itself, explicitly,
// inside showModuleRefusal(), rather than relying on this function's `isModuleSelectable`-only
// logic (which would leave them ENABLED for Case 2's contradictory selectable-but-not-implemented
// state).
function updateAssessmentEnablement() {
  const selectable = isModuleSelectable(activeModuleId);
  const submitButton = $('#run-assessment');
  if (submitButton) submitButton.disabled = !selectable;
  const loadExampleButton = $('#load-example');
  if (loadExampleButton) loadExampleButton.disabled = !selectable;
  const exampleSelect = $('#example-select');
  if (exampleSelect) exampleSelect.disabled = !selectable;
}

function updateNavCounts() {
  if ($('#nav-rule-count')) $('#nav-rule-count').textContent = String(rules.length);
  if ($('#nav-pattern-count')) $('#nav-pattern-count').textContent = String(Object.keys(candidates).length);
}

// P4-GATE fix 4 (TOCTOU hardening, latent — codex + karen findings) — a module-scoped monotonic
// load-generation counter. There was no request-generation guard around the awaits in
// activateModule()/loadActiveModuleKb(): with a future second selectable module, a STALE in-flight
// load (module A, started first, still awaiting its fetch) could resolve AFTER a NEWER load
// (module B, started second, already resolved and already wrote `rules`/`candidates`) and
// overwrite B's fresher state with A's stale one — invisible today only because exactly one module
// is ever selectable, not because the code prevented it.
//
// `activateModule()` captures `moduleLoadGeneration` (after incrementing it) at entry; every await
// boundary downstream of that point re-checks `isCurrentLoadGeneration(generation)` before
// performing any further `rules`/`candidates`/DOM state write, and abandons (returns without
// writing) the instant it detects a newer generation has superseded it. This is the SAME class of
// fix as loadExample()/submit's `moduleAtStart` snapshot-and-recheck below — both close the same
// underlying hazard (a stale async continuation writing over fresher state) using the pattern that
// fits each call shape (a monotonic counter here, since activateModule can start again before a
// prior call's `moduleId` argument would even be comparable in the way `activeModuleId` is).
let moduleLoadGeneration = 0;
function isCurrentLoadGeneration(generation) {
  return generation === moduleLoadGeneration;
}

// KB loading for the ACTIVE module only, honoring src/moduleKbLoaders.js#loadModuleKb's
// documented caller contract: resetState() synchronously clears rules/candidates to []/{} before
// any fetch is issued. loadModuleKb itself is invoked ONLY when isModuleSelectable(activeModuleId)
// — never for an inert/unregistered active module (AC-11). Called ONLY from activateModule()
// below, always after every synchronously-detectable refusal case (FR-21/FR-17/FR-16) has already
// passed, so isModuleSelectable(activeModuleId) is already guaranteed true by every real caller —
// the check below is kept anyway as defence in depth, not load-bearing from this file's own call
// site.
//
// `generation` (P4-GATE fix 4) is the snapshot activateModule() captured BEFORE this function's
// first await; every await below it re-checks `isCurrentLoadGeneration(generation)` before writing
// `rules`/`candidates`/nav counts, abandoning silently (no state write at all) the instant a newer
// activation has superseded this one — resetState() itself needs no such check: it always runs
// synchronously, before this function's own first await, so nothing could have superseded it yet
// (JS run-to-completion: no other event can interleave mid-synchronous-execution).
//
// Returns `true` iff the KB genuinely loaded (a real rules/candidates payload was parsed) AND this
// generation is still current; `false` for every failure mode (ineligible active module,
// network/HTTP failure, malformed JSON, or superseded-by-a-newer-load) — the caller (activateModule)
// treats a plain `false` as FR-18 (Case 4) and refuses UNLESS it separately detects its own
// generation has also gone stale, in which case it abandons instead (see activateModule below).
async function loadActiveModuleKb(generation) {
  if (!isModuleSelectable(activeModuleId)) {
    rules = [];
    candidates = {};
    updateNavCounts();
    return false;
  }
  try {
    const [rulesResponse, candidatesResponse] = await loadModuleKb(activeModuleId, () => {
      rules = [];
      candidates = {};
    });
    if (!isCurrentLoadGeneration(generation)) return false; // superseded while awaiting the fetch pair
    if (!rulesResponse.ok || !candidatesResponse.ok) {
      rules = [];
      candidates = {};
      updateNavCounts();
      return false;
    }
    const rulesJson = await rulesResponse.json();
    if (!isCurrentLoadGeneration(generation)) return false; // superseded while awaiting rules.json()
    const candidatesJson = await candidatesResponse.json();
    if (!isCurrentLoadGeneration(generation)) return false; // superseded while awaiting candidates.json()
    rules = rulesJson;
    candidates = candidatesJson;
    updateNavCounts();
    return true;
  } catch {
    if (!isCurrentLoadGeneration(generation)) return false; // superseded; do not clobber the newer module's state
    rules = [];
    candidates = {};
    updateNavCounts();
    return false;
  }
}

// Phase 4 (FR-16 / SQ-3 §4.2, F5-F7) — re-checks moduleReportsNotYetImplemented() (built in P3,
// reused here as instructed, never reimplemented) for the GIVEN moduleId and, if it self-reports
// not-yet-implemented, returns the ready-to-render FR-16 reason string; otherwise returns null.
// Called from TWO kinds of site: (a) activateModule() below, "at selection time," so the refusal
// renders BEFORE any render attempt is even possible; (b) defensively, again, inside
// submit/loadExample()/the algorithm explorer's onUseCase — so a contradictory
// selectable-but-not-implemented module can never reach renderClassification (F6/F7: `"undefined
// g/dL"`, false `Indeterminate`) even if reached by a path other than activateModule().
function notYetImplementedRefusalReason(moduleId) {
  let hooks = null;
  try {
    hooks = getModule(moduleId);
  } catch {
    return null; // unregistered id — FR-21's concern, not this one
  }
  if (!moduleReportsNotYetImplemented(hooks)) return null;
  const view = getManifestView(moduleId);
  return deriveNotYetImplementedReason(view ? view.title : moduleId);
}

// FR-15 / SQ-3 §4.1 (Case 1) — src/evidence/registry.js#accessorsFor (reached via
// src/engine.js:assess()'s ruleAudit mapping) throws this EXACT, source-coupled message for a
// moduleId with no evidence-accessor entry. Matched narrowly (message prefix + the quoted
// moduleId) so only THIS specific failure routes to the FR-15 refusal — every other thrown error
// still propagates as a genuinely unexpected error (never mis-swallowed into a false "module
// refusal" reading, and never silently treated as success).
function isEvidenceRegistryMissError(error, moduleId) {
  return typeof error?.message === 'string'
    && error.message.startsWith('src/evidence/registry.js: unknown module')
    && error.message.includes(`"${moduleId}"`);
}

// P4-01 (FR-14/FR-19) — the distinct THIRD state: refusal. NEVER showInputRejection (reserved for
// garden-variety clinician data-entry errors — wrong units, out-of-range age — on a real,
// selectable module) and NEVER routed through INPUT_REJECTION_CODES: no refusal reason code is
// ever added to that Set, and this function is its own, separate DOM branch with its own heading.
//
// INVARIANT ORDER IS LOAD-BEARING (P4-06 seam, D-4/FR-19) — do not reorder the numbered steps:
//   1. currentAudit = null
//   2. #results hidden
//   3. #results-placeholder shown
//   4. refreshAuditView() (re-renders the audit panel against the now-null currentAudit)
//   5. submit + load-example + example-select + audit copy/download ALL explicitly disabled —
//      not merely inherited from refreshAuditView()'s/updateAssessmentEnablement()'s own internal
//      logic, so this function's guarantee holds regardless of what called it or in what order
//      (activateModule() below already disables these before ever calling this function too —
//      that is belt-and-braces, not a substitute for the explicit disabling here, because
//      showModuleRefusal is ALSO called directly from submit/loadExample()'s reactive Case-1/
//      Case-2 catch paths, where nothing upstream has disabled anything yet)
//   6. the reason rendered as its own heading/body — never the heading "Check the entered units",
//      never showInputRejection's DOM branch
// Every step runs synchronously, in this exact order, in one turn — no await/setTimeout/
// requestAnimationFrame/queueMicrotask/promise boundary appears anywhere in this function.
//
// The MODULE SELECTOR is deliberately untouched: nothing here disables #module-switcher-toggle or
// its panel, so a clinician can always switch back to a working module (FR-19 "module selector
// stays usable").
function showModuleRefusal(moduleId, reason) {
  currentAudit = null;                                               // 1
  $('#results').hidden = true;                                        // 2
  $('#results-placeholder').hidden = false;                            // 3
  refreshAuditView();                                                   // 4
  if ($('#run-assessment')) $('#run-assessment').disabled = true;         // 5a
  if ($('#load-example')) $('#load-example').disabled = true;              // 5b
  if ($('#example-select')) $('#example-select').disabled = true;           // 5c
  $('#copy-audit').disabled = true;                                          // 5d
  $('#download-audit').disabled = true;                                       // 5e
  const view = getManifestView(moduleId);
  const label = view ? view.title : moduleId;
  $('#results-placeholder').innerHTML = `
    <h2>No assessment produced — ${escapeHtml(label)}</h2>
    <p>${escapeHtml(reason)}</p>`;                                             // 6
}

// P4-01/P4-06 (SEAM TASK, R-P3) — the single choke point where the ACTIVE module changes. Every
// refusal case decidable BEFORE a KB fetch (FR-21 unregistered, FR-17 registered-but-ineligible,
// FR-16 hooks-not-implemented) is decided HERE, in this one function, so the banner and any
// refusal render can never observably interleave with a stale prior result — there is no second
// code path that also reassigns `activeModuleId`. FR-18 (KB fetch failure) is necessarily decided
// AFTER the one `await` in this function, since it depends on that fetch's own outcome.
async function activateModule(moduleId) {
  // P4-GATE fix 4 (TOCTOU hardening) — claim a new load generation FIRST, synchronously, before
  // anything else in this function runs. See isCurrentLoadGeneration()'s header comment
  // (immediately above loadActiveModuleKb) for the full rationale.
  const generation = ++moduleLoadGeneration;
  activeModuleId = moduleId;

  // FR-19 shared invariants — unconditional, BEFORE any refusal/success branching.
  // P4-06 SEAM — SOURCE ORDER IS LOAD-BEARING, do not reorder:
  //   currentAudit=null -> #results hidden -> #results-placeholder shown -> audit-download
  //   disabled -> assessment controls disabled -> banner/switcher write.
  // No await/setTimeout/requestAnimationFrame/queueMicrotask/promise boundary sits between the
  // audit-disable lines and the banner/switcher write below: every statement from here through
  // renderModuleStatusBanner() runs synchronously, in one turn, with zero promise boundaries
  // between them. The only `await` anywhere in this function is loadActiveModuleKb() further
  // down, reached (if at all) strictly AFTER the banner has already been written for the NEW
  // module — so there is no tick in which a PRIOR module's result is visible beneath the NEW
  // module's banner, and no tick in which the prior audit stays downloadable after the banner has
  // already changed.
  currentAudit = null;
  $('#results').hidden = true;
  $('#results-placeholder').hidden = false;
  $('#copy-audit').disabled = true;
  $('#download-audit').disabled = true;
  if ($('#run-assessment')) $('#run-assessment').disabled = true;
  if ($('#load-example')) $('#load-example').disabled = true;
  if ($('#example-select')) $('#example-select').disabled = true;
  renderModuleSwitcher();
  renderModuleStatusBanner();

  // FR-21 (P4-07) — `?module=` fails isRegisteredModule() entirely. Distinct from Case 3 (FR-17,
  // registered but ineligible): quotes the literal requested id verbatim, since there is no
  // manifest/title to substitute. Never a silent fallback to DEFAULT_MODULE_ID (D-4) — the id
  // stays exactly what was requested, both in `activeModuleId` and in the refusal text.
  if (!isRegisteredModule(moduleId)) {
    rules = [];
    candidates = {};
    updateNavCounts();
    showModuleRefusal(moduleId, deriveUnregisteredModuleReason(moduleId));
    return;
  }

  // FR-17 / SQ-3 §4.3 (Case 3) — registered but manifest.status !== READY_STATUS. Reached only
  // via a hand-edited `?module=` in practice (the P2-03 predicate already keeps every UI row for
  // such a module inert/disabled) — kept as defence in depth. Verbatim enum status plus the
  // canonical vocabulary sentence; never downgraded to a warning (build-static.mjs already
  // warns-instead-of-exits for non-default modules, so this browser check is the only remaining
  // enforcement point).
  if (!isModuleSelectable(moduleId)) {
    rules = [];
    candidates = {};
    updateNavCounts();
    const view = getManifestView(moduleId);
    showModuleRefusal(moduleId, moduleStatusReasonText(view ? view.status : ''));
    return;
  }

  // FR-16 / SQ-3 §4.2 (Case 2) — hooks self-report not-yet-implemented, detected BEFORE any
  // render attempt. renderClassification() is unreachable here: the only callers of renderResult
  // are submit/loadExample()/the algorithm explorer's onUseCase, and this same reason function is
  // re-checked, defensively, inside every one of them too (F6/F7 prevention in depth).
  const notImplementedReason = notYetImplementedRefusalReason(moduleId);
  if (notImplementedReason) {
    rules = [];
    candidates = {};
    updateNavCounts();
    showModuleRefusal(moduleId, notImplementedReason);
    return;
  }

  // Success path — the only `await` in this function. FR-18 / SQ-3 §4.4 (Case 4) is decided by
  // its own outcome: loadModuleKb's SQ-3 §4.4 reset-before-fetch ordering contract already
  // guarantees rules/candidates are []/{} before the fetch is even issued (src/moduleKbLoaders.js)
  // and again on any failure (loadActiveModuleKb() above), so a fetch failure here can never leave
  // a prior module's KB in memory or on screen.
  const loaded = await loadActiveModuleKb(generation);
  // P4-GATE fix 4 (TOCTOU hardening) — re-check currency on THIS side too (belt-and-braces
  // alongside loadActiveModuleKb's own internal checks): a `false` return can mean either a
  // genuine FR-18 failure OR that a newer activateModule() call has already superseded this one.
  // Only the FIRST is a real refusal; the second must do nothing at all — a newer call has already
  // written its own correct banner/results state, and rendering a refusal for the OLD moduleId now
  // would incorrectly overwrite it.
  if (!isCurrentLoadGeneration(generation)) return;
  if (!loaded) {
    const view = getManifestView(moduleId);
    showModuleRefusal(moduleId, deriveKbLoadFailureReason(view ? view.title : moduleId));
    return;
  }
  updateAssessmentEnablement();
  // P4-GATE fix 3 (explorer init leak, codex finding) — see initializeAlgorithmExplorerIfEligible()
  // below for why this call is gated and why it is safe to invoke here on every successful
  // activation (not just the very first one at page load).
  initializeAlgorithmExplorerIfEligible().catch((error) => console.error(error));
}

// P4-GATE fix 3 (explorer init leak, reachable today — codex finding) — src/algorithmExplorer.js
// (untouchable this phase) ends initializeAlgorithmExplorer() by unconditionally running
// `assessPediatricAnemia` against its FIRST worked example case (src/algorithmExplorer.js:621),
// using whatever `rules`/`candidates` it was handed, with no eligibility awareness of its own.
// On load of `?module=growth_suite_v1`, activateModule() correctly refuses (rules=[]/
// candidates={}), but the PRIOR src/app.js code still called initializeAlgorithmExplorer({ rules,
// candidates, ... }) unconditionally right afterward — computing a real anemia walkthrough (a
// genuine `assessPediatricAnemia` result over a real anemia example input, just against an empty
// rule set) under an ineligible module's active context. That is a D-1-shaped masquerade: the
// #algorithm tab would silently show anemia-algorithm output while growth_suite_v1 is "active."
//
// Fix (app.js-only, as instructed — src/algorithmExplorer.js stays untouched): only ever call
// initializeAlgorithmExplorer() when the ACTIVE module is genuinely the selectable default —
// `isModuleSelectable(activeModuleId) && activeModuleId === DEFAULT_MODULE_ID`. Both conditions
// are checked, not merely the id equality, so a hypothetical future state where `anemia` itself
// somehow failed eligibility could never slip through on the id check alone. Deferred, not merely
// skipped: this helper is called BOTH from initialize() (page load) and from the success tail of
// activateModule() above (every later successful activation) — so if the page loads on an
// ineligible module and the clinician subsequently switches to anemia (today the only selectable
// module), the explorer initializes THEN, the first time the condition is actually met.
// initializeAlgorithmExplorer() is itself idempotent
// (`if (!explorer || explorer.dataset.initialized === 'true') return;`, set to `'true'` before its
// own fetch even resolves), so calling this wrapper repeatedly — including on every subsequent
// anemia activation after the first successful one — is always safe and cheap: every call after
// the first real attempt short-circuits inside algorithmExplorer.js without a network request.
//
// P5-01 (a later phase) owns the FULL #algorithm tab degradation (hiding/disabling the tab itself
// for non-anemia modules with explicit copy) — this fix closes the narrower, reachable-TODAY
// init-time computation leak; it is not a substitute for P5-01's later, more complete tab-level
// treatment.
async function initializeAlgorithmExplorerIfEligible() {
  if (!(isModuleSelectable(activeModuleId) && activeModuleId === DEFAULT_MODULE_ID)) return;
  try {
    await initializeAlgorithmExplorer({
      rules,
      candidates,
      // AC-11 (P3-tracked item, closed in an earlier fix) — the one remaining assessPediatricAnemia
      // call site in src/app.js with no isModuleSelectable(activeModuleId) guard. The algorithm
      // explorer is anemia-shaped end to end and out of scope to touch (src/algorithmExplorer.js is
      // untouchable this phase; P5-01 degrades/hides the #algorithm tab entirely for non-anemia
      // modules), so this callback still only ever calls the literal `assessPediatricAnemia` form
      // — never assessModule — but it must not run at all against an ineligible or
      // not-yet-implemented active module, matching the same two guards submit/loadExample() apply.
      onUseCase: (input) => {
        if (!isModuleSelectable(activeModuleId)) return;
        const notImplementedReason = notYetImplementedRefusalReason(activeModuleId);
        if (notImplementedReason) {
          showModuleRefusal(activeModuleId, notImplementedReason);
          return;
        }
        populateFromInput(input);
        const result = assessPediatricAnemia(input, rules, candidates);
        currentAudit = { input, result };
        renderResult(result);
        refreshAuditView();
        switchTab('assessment');
      },
    });
  } catch (error) {
    console.error(error);
    const explorerError = $('#algorithm-step-map');
    if (explorerError) {
      explorerError.innerHTML = `<div class="algorithm-error"><strong>Algorithm explorer could not be loaded.</strong><span>${escapeHtml(error.message)}</span></div>`;
    }
  }
}

function closeModuleSwitcher() {
  const panel = $('#module-switcher-panel');
  const toggle = $('#module-switcher-toggle');
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function openModuleSwitcher() {
  const panel = $('#module-switcher-panel');
  const toggle = $('#module-switcher-toggle');
  if (!panel) return;
  panel.hidden = false;
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
}

function toggleModuleSwitcher() {
  const panel = $('#module-switcher-panel');
  if (!panel) return;
  if (panel.hidden) openModuleSwitcher();
  else closeModuleSwitcher();
}

// Row activation handler.
//
// P4-GATE fix 2 (forced-activation, AC-4's resilience clause / P6-011 item (7)): a forced click on
// an ineligible row — e.g. a devtools user strips the row button's `disabled` attribute and clicks
// CBC Suite anyway — must NOT be a silent no-op. The specified expected outcome is the REFUSAL
// STATE ("selecting an ineligible module must swap the banner and clear results atomically"; "the
// expected result is the refusal state, never an assessment"), exactly what the `?module=`
// hand-edit path already produces via activateModule()'s own FR-17 branch. The prior version of
// this handler early-returned on `!isModuleSelectable(moduleId)` BEFORE ever reaching
// activateModule() — a genuine, silent no-op for that forced-click case, not a refusal.
//
// Fix: this handler no longer re-derives eligibility itself (no `isModuleSelectable`/`disabled`-
// attribute read here at all) — it forwards ANY requested moduleId to activateModule(), which is
// the SOLE decision-maker (its own isRegisteredModule()/isModuleSelectable() checks, FR-17/FR-21
// branches). This does not weaken AC-11: activateModule() still gates every loadActiveModuleKb()/
// assess-reaching path internally, ahead of any state write — the guard simply now lives in ONE
// place (activateModule) instead of being duplicated (and, as this bug showed, able to diverge)
// between this handler and that function.
async function selectModule(moduleId) {
  if (moduleId !== activeModuleId) {
    writeModuleUrlParam(moduleId);
    await activateModule(moduleId);
  }
  closeModuleSwitcher();
  $('#module-switcher-toggle')?.focus();
}

function initializeModuleSwitcher() {
  const toggle = $('#module-switcher-toggle');
  const panel = $('#module-switcher-panel');
  const switcherRoot = $('#module-switcher');
  if (!toggle || !panel || !switcherRoot) return;

  toggle.addEventListener('click', () => toggleModuleSwitcher());

  panel.addEventListener('click', (event) => {
    const row = event.target.closest('[data-module-id]');
    if (!row || row.disabled) return;
    selectModule(row.dataset.moduleId).catch(showFatalError);
  });

  // FR-37 — Escape dismisses the expanded panel and returns focus to the toggle (keyboard-nav
  // requirement re-read for a disclosure widget, decisions-block §11/D-7).
  switcherRoot.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      closeModuleSwitcher();
      toggle.focus();
    }
  });

  // Click outside the control closes the panel — standard disclosure-widget behavior, additive
  // to (not a replacement for) the Escape handler above.
  document.addEventListener('click', (event) => {
    if (!panel.hidden && !switcherRoot.contains(event.target)) closeModuleSwitcher();
  });
}
// =================================================================================================

function refreshAuditView() {
  const code = $('#audit-json code') ?? $('#audit-json');
  const text = currentAudit ? JSON.stringify(currentAudit, null, 2) : 'No assessment has been run.';
  code.textContent = text;
  $('#copy-audit').disabled = !currentAudit;
  $('#download-audit').disabled = !currentAudit;
}

function setSimpleField(name, val) {
  const element = field(name);
  if (!element) return;
  if (element instanceof RadioNodeList) return;
  if (element.type === 'checkbox') element.checked = toTri(val) === 'true';
  else element.value = val ?? '';
}

function populateFromInput(input) {
  suppressResetHandler = true;
  form.reset();
  suppressResetHandler = false;
  const p = input.patient ?? {};
  const cbc = input.cbc ?? {};
  const lr = cbc.localRanges ?? {};
  const lf = cbc.localFlags ?? {};
  const retic = input.reticulocytes ?? {};
  const labs = input.labs ?? {};

  Object.entries({
    ageMonths: p.ageMonths, sexAtBirth: p.sexAtBirth, menstruating: p.menstruating,
    recentTransfusion: p.recentTransfusion, highAltitude: p.highAltitude,
    hemoglobin: cbc.hemoglobin, mcv: cbc.mcv, rdw: cbc.rdw, rbc: cbc.rbc,
    wbc: cbc.wbc, anc: cbc.anc, platelets: cbc.platelets,
    rbcInterpretation: cbc.rbcInterpretation,
    hbLower: lr.hbLower, mcvLower: lr.mcvLower, mcvUpper: lr.mcvUpper,
    rdwUpper: lr.rdwUpper, wbcLower: lr.wbcLower, ancLower: lr.ancLower,
    plateletsLower: lr.plateletsLower,
    leukopenia: lf.leukopenia, neutropenia: lf.neutropenia,
    thrombocytopenia: lf.thrombocytopenia, thrombocytosis: lf.thrombocytosis,
    reticResponse: retic.response, absoluteRetic: retic.absolute,
    ...labs,
  }).forEach(([name, val]) => setSimpleField(name, val));

  for (const [name, val] of Object.entries(input.symptoms ?? {})) setSimpleField(name, val);
  for (const [name, val] of Object.entries(input.history ?? {})) setSimpleField(name, val);
  for (const [name, val] of Object.entries(input.exam ?? {})) setSimpleField(name, val);
  for (const smearValue of input.smear ?? []) {
    const element = $(`input[name="smear"][value="${CSS.escape(smearValue)}"]`, form);
    if (element) element.checked = true;
  }
  const hasImmediateFlag = immediateSafetyNames.some(
    (name) => toTri(input.symptoms?.[name]) === 'true',
  );
  if ($('#safety-reviewed-no-flags')) $('#safety-reviewed-no-flags').checked = !hasImmediateFlag;
  updateCaseUi();
}

async function loadExample() {
  // AC-11 groundwork — re-check the P2-03 predicate INSIDE the handler, not just via the
  // `#load-example` button's `disabled` attribute (updateAssessmentEnablement). This is the guard
  // that actually prevents an inert active module's data from being run through the anemia engine
  // and misattributed as that module's assessment (SQ-3 F1/F2); the button state is presentation.
  if (!isModuleSelectable(activeModuleId)) return;
  // Phase 4 (FR-16, Case 2 defensive re-check) — see notYetImplementedRefusalReason()'s own
  // header comment for why this is checked again here even though activateModule() already
  // checks it at selection time.
  const notImplementedReason = notYetImplementedRefusalReason(activeModuleId);
  if (notImplementedReason) {
    showModuleRefusal(activeModuleId, notImplementedReason);
    return;
  }
  // P4-GATE fix 4 (TOCTOU hardening, codex + karen findings) — snapshot the active module BEFORE
  // any await in this function. `activeModuleId`/`rules`/`candidates` are shared mutable globals;
  // if the clinician switches modules while this example fetch/json/assess chain is in flight
  // (activateModule() runs its OWN, unrelated invariant-clearing sequence the instant that
  // happens), a stale continuation here must never assess module B's data/rules against a
  // response object that was really fetched/derived for module A — and must never render a
  // refusal for the OLD module over top of the NEW module's already-correct, already-rendered
  // state. Every state-mutating step below re-asserts `activeModuleId === moduleAtStart` first and
  // silently no-ops (never a refusal — the NEW module's own activation already rendered whatever
  // is correct) on a mismatch.
  const moduleAtStart = activeModuleId;
  try {
    const selected = $('#example-select').value;
    if (!selected) {
      form.reset();
      return;
    }
    const response = await fetch(`./examples/${selected}.json`);
    if (activeModuleId !== moduleAtStart) return; // superseded while awaiting the example fetch
    if (!response.ok) throw new Error(`Unable to load example: ${selected}`);
    const input = await response.json();
    if (activeModuleId !== moduleAtStart) return; // superseded while awaiting response.json()
    populateFromInput(input);
    // R-3 (smoke-browser-unit-rejection.mjs) pins the literal `assessPediatricAnemia(input, rules,
    // candidates)` call shape below — never rewritten. `assessModule` is the module-generic
    // sibling (P2-02) for any OTHER selectable module; today only DEFAULT_MODULE_ID ('anemia') is
    // ever selectable (D-1), so this ternary's second branch is reachable-in-principle,
    // exercised-in-practice-by-none-of-today's-real-modules — future-proofing, not dead weight.
    // Dispatches on `moduleAtStart`, the snapshot, never the (possibly since-changed) live
    // `activeModuleId` — assessing consistently as whatever module was active when this call began.
    const result = moduleAtStart === DEFAULT_MODULE_ID
      ? assessPediatricAnemia(input, rules, candidates)
      : assessModule(moduleAtStart, input, rules, candidates);
    if (activeModuleId !== moduleAtStart) return; // superseded between the assess call and here
    currentAudit = { input, result };
    renderResult(result);
    refreshAuditView();
  } catch (error) {
    if (activeModuleId !== moduleAtStart) return; // superseded; a newer activation owns the screen now
    if (INPUT_REJECTION_CODES.has(error.code)) {
      showInputRejection(error);
      return;
    }
    // P4-02 (FR-15, Case 1) — an evidence-registry miss for the active module routes to the
    // distinct THIRD state instead of the generic "Application error" showFatalError would have
    // produced (the pre-Phase-4 behaviour for this exact throw).
    if (isEvidenceRegistryMissError(error, moduleAtStart)) {
      const view = getManifestView(moduleAtStart);
      showModuleRefusal(moduleAtStart, deriveEvidenceUnavailableReason(view ? view.title : moduleAtStart));
      return;
    }
    throw error;
  }
}

function downloadJson() {
  if (!currentAudit) return;
  const blob = new Blob([JSON.stringify(currentAudit, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `pediatric-anemia-assessment-${new Date().toISOString().replaceAll(':', '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function initialize() {
  // P3-05/P4-01 — resolve + activate the module from `?module=` (absent -> DEFAULT_MODULE_ID)
  // BEFORE any other UI wiring. activateModule() is the single P4-06 choke point: it performs
  // every synchronously-decidable refusal check (FR-21/FR-17/FR-16) ahead of any KB fetch, writes
  // the banner/switcher for whichever module this turns out to be, and — only on the success path
  // — loads that module's KB (FR-18 decided by that load's own outcome).
  await activateModule(readModuleIdFromUrl());
  if (activeModuleId === DEFAULT_MODULE_ID && rules.length === 0) {
    // Preserves the original, more actionable diagnostic for the common default-path failure mode
    // (opening index.html directly via file:// instead of serving it over HTTP) — the same
    // condition the pre-P3 hardcoded fetch used to throw on directly. activateModule() will
    // already have rendered the generic FR-18 module-scoped refusal into #results-placeholder for
    // this exact case; the throw below (caught at the bottom of this file by
    // `initialize().catch(showFatalError)`) overwrites it with this more specific, more
    // actionable message for the single most common real-world failure mode — both are honest,
    // this one is just more useful here. Every OTHER module/failure combination keeps
    // activateModule()'s own FR-18 refusal untouched, letting the rest of the app still finish
    // initializing instead of hard-aborting.
    throw new Error('Unable to load the local rule knowledge base. Serve the directory over HTTP rather than opening index.html directly.');
  }

  renderEvidence();
  renderRules();
  refreshAuditView();

  initializeModuleSwitcher();
  loadModuleRowCounts().catch((error) => console.error(error));

  // P4-GATE fix 3 — only initializes when the ACTIVE module is genuinely the selectable default;
  // see initializeAlgorithmExplorerIfEligible()'s own header comment for the full rationale
  // (codex's "explorer init leak" finding) and why this same call is safely repeatable from
  // activateModule()'s success path too.
  await initializeAlgorithmExplorerIfEligible();

  $$('.tab-button').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
  $$('.workflow-step').forEach((button) => button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.stepTarget);
    if (!target) return;
    if (target.tagName === 'DETAILS') target.open = true;
    $$('.workflow-step').forEach((item) => item.classList.toggle('active', item === button));
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  $('#rule-filter').addEventListener('input', (event) => renderRules(event.target.value));
  $('#load-example').addEventListener('click', () => loadExample().catch(showFatalError));

  form.addEventListener('input', updateCaseUi);
  form.addEventListener('change', updateCaseUi);
  $('#safety-reviewed-no-flags')?.addEventListener('change', (event) => {
    if (event.target.checked) {
      immediateSafetyNames.forEach((name) => {
        const element = field(name);
        if (element && !(element instanceof RadioNodeList)) element.checked = false;
      });
    }
    updateCaseUi();
  });
  immediateSafetyNames.forEach((name) => {
    const element = field(name);
    element?.addEventListener('change', () => {
      if (element.checked && $('#safety-reviewed-no-flags')) $('#safety-reviewed-no-flags').checked = false;
      updateCaseUi();
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    // AC-11 groundwork — same predicate re-check as loadExample() above, inside the handler
    // itself, not just via the `#run-assessment` button's `disabled` attribute. Prevents the
    // misattributed-assessment failure mode (SQ-3 F1/F2) if the guard is ever reached despite the
    // button being disabled (e.g. a devtools user re-enabling it — see moduleRowMarkup()'s
    // `disabled`-is-presentation comment; this predicate check is the actual gate, AC-11).
    if (!isModuleSelectable(activeModuleId)) return;
    // Phase 4 (FR-16, Case 2 defensive re-check) — see notYetImplementedRefusalReason()'s own
    // header comment.
    const notImplementedReason = notYetImplementedRefusalReason(activeModuleId);
    if (notImplementedReason) {
      showModuleRefusal(activeModuleId, notImplementedReason);
      return;
    }
    // P4-GATE fix 4 (TOCTOU hardening, codex + karen findings) — snapshot before any await, same
    // pattern as loadExample() (see its matching comment for the full rationale). submit's own
    // body has no `await` today (buildInput()/assess() are both synchronous, and JS run-to-
    // completion means nothing can interleave mid-handler) — this is symmetry/future-proofing
    // guarding the SAME shared `activeModuleId`/`rules`/`candidates` globals loadExample() guards,
    // not a currently-reachable race in THIS function as written; it costs nothing and closes the
    // gap immediately the moment an await is ever added here.
    const moduleAtStart = activeModuleId;
    const input = buildInput();
    try {
      // R-3 pins the literal `assessPediatricAnemia(input, rules, candidates)` call shape below —
      // see loadExample()'s matching comment for why the ternary's second branch exists, and for
      // why this dispatches on `moduleAtStart` rather than the live `activeModuleId`.
      const result = moduleAtStart === DEFAULT_MODULE_ID
        ? assessPediatricAnemia(input, rules, candidates)
        : assessModule(moduleAtStart, input, rules, candidates);
      if (activeModuleId !== moduleAtStart) return; // superseded between the assess call and here
      currentAudit = { input, result };
      renderResult(result);
      refreshAuditView();
    } catch (error) {
      if (activeModuleId !== moduleAtStart) return; // superseded; a newer activation owns the screen now
      if (INPUT_REJECTION_CODES.has(error.code)) { showInputRejection(error); return; }
      // P4-02 (FR-15, Case 1) — see loadExample()'s matching comment.
      if (isEvidenceRegistryMissError(error, moduleAtStart)) {
        const view = getManifestView(moduleAtStart);
        showModuleRefusal(moduleAtStart, deriveEvidenceUnavailableReason(view ? view.title : moduleAtStart));
        return;
      }
      throw error;
    }
  });

  form.addEventListener('reset', () => {
    if (suppressResetHandler) return;
    window.setTimeout(() => {
      currentAudit = null;
      $('#results').hidden = true;
      $('#results-placeholder').hidden = false;
      refreshAuditView();
      updateCaseUi();
    }, 0);
  });

  $('#results').addEventListener('click', (event) => {
    const action = event.target.closest('[data-result-action]')?.dataset.resultAction;
    if (action === 'print') window.print();
    if (action === 'audit') switchTab('audit');
  });

  $('#copy-audit').addEventListener('click', async () => {
    if (!currentAudit) return;
    await navigator.clipboard.writeText(JSON.stringify(currentAudit, null, 2));
    const button = $('#copy-audit');
    const original = button.textContent;
    button.textContent = 'Copied';
    window.setTimeout(() => { button.textContent = original; }, 1200);
  });
  $('#download-audit').addEventListener('click', downloadJson);

  window.addEventListener('hashchange', () => switchTab(window.location.hash.slice(1), { syncHash: false }));
  updateCaseUi();
  switchTab(window.location.hash.slice(1) || 'assessment', { syncHash: false });
  document.title = `Pediatric Anemia Decision Support — KB ${KNOWLEDGE_BASE_VERSION}`;
}

function showFatalError(error) {
  console.error(error);
  $('#results-placeholder').innerHTML = `<h2>Application error</h2><p>${escapeHtml(error.message)}</p>`;
}

// Renders one <li> per rejection detail. Unit rejections (docs/architecture.md §10 condition 1)
// and age-scope rejections (condition 2) carry differently-shaped detail records, so each is
// formatted on its own terms rather than forcing one generic shape.
function formatRejectionDetail(error, detail) {
  if (error.code === 'AGE_OUT_OF_SUPPORTED_RANGE') {
    const supported = detail.supportedAgeMonths;
    const range = supported ? `${escapeHtml(String(supported.min))}–${escapeHtml(String(supported.max))}` : 'unknown';
    return `<li>Age <strong>${escapeHtml(String(detail.ageMonths))} months</strong> is outside the supported `
      + `${range} month range, and no local CBC reference limits (hemoglobin/MCV) were supplied to cover it.</li>`;
  }
  return `<li><strong>${escapeHtml(detail.field)}</strong>: entered "${escapeHtml(detail.providedUnit)}", expected ${escapeHtml(detail.expectedUnit)}</li>`;
}

function showInputRejection(error) {
  currentAudit = null;
  $('#results').hidden = true;
  $('#results-placeholder').hidden = false;
  const details = Array.isArray(error.details) ? error.details : [];
  const heading = error.code === 'AGE_OUT_OF_SUPPORTED_RANGE'
    ? 'No assessment produced — age outside supported range'
    : 'Check the entered units';
  $('#results-placeholder').innerHTML = `
    <h2>${heading}</h2>
    <p>${escapeHtml(error.message)}</p>
    <ul>${details.map((detail) => formatRejectionDetail(error, detail)).join('')}</ul>`;
  refreshAuditView();
}

initialize().catch(showFatalError);
