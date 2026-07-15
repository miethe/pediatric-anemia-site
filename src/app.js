import { assessPediatricAnemia } from './engine.js';
import { EVIDENCE, KNOWLEDGE_BASE_VERSION } from './evidence.js';
import { initializeAlgorithmExplorer } from './algorithmExplorer.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const form = $('#assessment-form');

let rules = [];
let candidates = {};
let currentAudit = null;
let suppressResetHandler = false;

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

function renderResult(result) {
  $('#results-placeholder').hidden = true;
  const container = $('#results');
  container.hidden = false;
  container.innerHTML = `<div class="result-stack">
    ${renderClassification(result)}
    ${renderAlerts(result.alerts)}
    ${renderCandidates(result.rankedDifferential)}
    ${renderQuestions(result.nextQuestions)}
    ${renderNotes(result.interpretiveNotes)}
    ${renderLimitations(result.limitations)}
  </div>`;
  $('.results-column')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderEvidence() {
  const entries = Object.values(EVIDENCE).sort((a, b) => b.year - a.year || a.id.localeCompare(b.id));
  $('#evidence-list').innerHTML = entries.map((entry) => `
    <article id="evidence-${escapeHtml(entry.id)}" class="card evidence-card">
      <span class="priority-pill ${entry.priority.includes('foundational') ? 'foundational' : ''}">${escapeHtml(entry.priority)}</span>
      <h3>${escapeHtml(entry.title)}</h3>
      <p class="meta">${escapeHtml(entry.organization)} · ${escapeHtml(entry.journal)} · ${entry.doi ? `DOI ${escapeHtml(entry.doi)}` : ''}</p>
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
  if (syncHash && window.location.hash !== `#${resolvedTab}`) {
    window.history.replaceState(null, '', `#${resolvedTab}`);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

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
  if (element.type === 'checkbox') element.checked = Boolean(val);
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
  const hasImmediateFlag = immediateSafetyNames.some((name) => Boolean(input.symptoms?.[name]));
  if ($('#safety-reviewed-no-flags')) $('#safety-reviewed-no-flags').checked = !hasImmediateFlag;
  updateCaseUi();
}

async function loadExample() {
  const selected = $('#example-select').value;
  if (!selected) {
    form.reset();
    return;
  }
  const response = await fetch(`./examples/${selected}.json`);
  if (!response.ok) throw new Error(`Unable to load example: ${selected}`);
  const input = await response.json();
  populateFromInput(input);
  const result = assessPediatricAnemia(input, rules, candidates);
  currentAudit = { input, result };
  renderResult(result);
  refreshAuditView();
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
  const [rulesResponse, candidatesResponse] = await Promise.all([
    fetch('./data/rules.json'),
    fetch('./data/candidates.json'),
  ]);
  if (!rulesResponse.ok || !candidatesResponse.ok) {
    throw new Error('Unable to load the local rule knowledge base. Serve the directory over HTTP rather than opening index.html directly.');
  }
  rules = await rulesResponse.json();
  candidates = await candidatesResponse.json();
  if ($('#nav-rule-count')) $('#nav-rule-count').textContent = String(rules.length);
  if ($('#nav-pattern-count')) $('#nav-pattern-count').textContent = String(Object.keys(candidates).length);

  renderEvidence();
  renderRules();
  refreshAuditView();

  try {
    await initializeAlgorithmExplorer({
      rules,
      candidates,
      onUseCase: (input) => {
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
    const input = buildInput();
    const result = assessPediatricAnemia(input, rules, candidates);
    currentAudit = { input, result };
    renderResult(result);
    refreshAuditView();
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

initialize().catch(showFatalError);
