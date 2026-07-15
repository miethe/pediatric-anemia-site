import { assessPediatricAnemia } from './engine.js';
import { deriveFacts } from './facts.js';
import { EVIDENCE } from './evidence.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function humanize(value) {
  return String(value ?? 'unknown')
    .replaceAll('-', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return 'not supplied';
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(digits).replace(/\.0$/, '');
}

function formatSource(id) {
  const source = EVIDENCE[id];
  if (!source) return id || 'unavailable';
  return `${source.organization} ${source.year}`;
}

function evidenceLink(item, { compact = false } = {}) {
  const id = typeof item === 'string' ? item : item?.id;
  const use = typeof item === 'object' ? item?.use : '';
  const source = EVIDENCE[id];
  if (!source) return `<span class="algorithm-source missing">${escapeHtml(id)}</span>`;
  const title = `${source.title}${use ? ` — ${use}` : ''}`;
  return `
    <a class="algorithm-source${compact ? ' compact' : ''}" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(title)}">
      <span class="algorithm-source-id">${escapeHtml(id)}</span>
      <span class="algorithm-source-copy"><strong>${escapeHtml(source.organization)} · ${escapeHtml(source.year)}</strong>${compact ? '' : `<small>${escapeHtml(use || source.title)}</small>`}</span>
      <span aria-hidden="true">↗</span>
    </a>`;
}

function renderEvidence(items = [], options = {}) {
  return `<div class="algorithm-source-list">${items.map((item) => evidenceLink(item, options)).join('')}</div>`;
}

function renderPrinciples(principles = []) {
  const root = $('#algorithm-principles');
  if (!root) return;
  root.innerHTML = principles.map((principle, index) => `
    <article class="algorithm-principle">
      <span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div><strong>${escapeHtml(principle.label)}</strong><p>${escapeHtml(principle.detail)}</p></div>
    </article>`).join('');
}

function renderStepCards(steps = []) {
  const root = $('#algorithm-step-map');
  if (!root) return;
  root.innerHTML = steps.map((step, index) => {
    const firstEquation = step.equations?.[0]?.expression ?? '';
    return `
      <button type="button" class="algorithm-step-card${index === 0 ? ' active' : ''}" data-algorithm-step="${escapeHtml(step.id)}" aria-pressed="${index === 0 ? 'true' : 'false'}" aria-controls="algorithm-step-detail">
        <span class="algorithm-step-number">${escapeHtml(step.number)}</span>
        <span class="algorithm-step-copy">
          <span class="algorithm-step-kicker">Step ${escapeHtml(step.number)} · ${escapeHtml(step.preview)}</span>
          <strong>${escapeHtml(step.title)}</strong>
          <span>${escapeHtml(step.summary)}</span>
          <code>${escapeHtml(firstEquation)}</code>
        </span>
        <span class="algorithm-step-meta">
          <span>${step.inputs?.length ?? 0} data groups</span>
          <span>${step.equations?.length ?? 0} expressions</span>
          <span>${step.examples?.length ?? 0} examples</span>
        </span>
        <span class="algorithm-step-action">Explore step <span aria-hidden="true">→</span></span>
      </button>`;
  }).join('');
}

function renderInputTable(inputs = []) {
  return `
    <div class="algorithm-table-wrap">
      <table class="algorithm-data-table">
        <thead><tr><th>Data point</th><th>Field / unit</th><th>How it changes the branch</th></tr></thead>
        <tbody>${inputs.map((input) => `
          <tr>
            <td><strong>${escapeHtml(input.display)}</strong></td>
            <td><code>${escapeHtml(input.field)}</code><small>${escapeHtml(input.unit)}</small></td>
            <td>${escapeHtml(input.purpose)}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function equationKindLabel(kind) {
  const labels = {
    engine: 'Executed by engine',
    guideline: 'Guideline-derived threshold',
    explanatory: 'Illustrative arithmetic',
    'reference-only': 'Reference only—not executed',
    'implementation-heuristic': 'Transparent implementation heuristic',
  };
  return labels[kind] ?? humanize(kind);
}

function renderEquations(equations = []) {
  return `<div class="algorithm-equation-list">${equations.map((equation) => `
    <article class="algorithm-equation ${escapeHtml(equation.kind)}">
      <div class="algorithm-equation-head"><strong>${escapeHtml(equation.label)}</strong><span>${escapeHtml(equationKindLabel(equation.kind))}</span></div>
      <code>${escapeHtml(equation.expression)}</code>
      <p>${escapeHtml(equation.interpretation)}</p>
    </article>`).join('')}</div>`;
}

function renderExamples(examples = []) {
  return `<div class="algorithm-example-grid">${examples.map((example, index) => `
    <article class="algorithm-example-card">
      <span class="algorithm-example-index">Example ${index + 1}</span>
      <h4>${escapeHtml(example.title)}</h4>
      <dl>
        <div><dt>Data</dt><dd>${escapeHtml(example.data)}</dd></div>
        <div><dt>Evaluation</dt><dd>${escapeHtml(example.evaluation)}</dd></div>
        <div><dt>Result</dt><dd>${escapeHtml(example.result)}</dd></div>
      </dl>
    </article>`).join('')}</div>`;
}

function renderStepDetail(step) {
  const root = $('#algorithm-step-detail');
  if (!root || !step) return;
  root.innerHTML = `
    <article class="algorithm-detail-card" tabindex="-1">
      <header class="algorithm-detail-header">
        <div class="algorithm-detail-title">
          <span class="algorithm-detail-number">${escapeHtml(step.number)}</span>
          <div><p>Detailed decision specification</p><h3>${escapeHtml(step.title)}</h3></div>
        </div>
        <div class="algorithm-detail-counts">
          <span><strong>${step.inputs?.length ?? 0}</strong> input groups</span>
          <span><strong>${step.equations?.length ?? 0}</strong> expressions</span>
          <span><strong>${step.evidence?.length ?? 0}</strong> evidence sources</span>
        </div>
      </header>

      <div class="algorithm-question-callout">
        <span>Clinical question</span>
        <strong>${escapeHtml(step.clinicalQuestion)}</strong>
      </div>

      <div class="algorithm-detail-section">
        <div class="algorithm-section-heading"><div><span>01</span><h4>Data points used</h4></div><p>Exact input fields and their role in this branch.</p></div>
        ${renderInputTable(step.inputs)}
      </div>

      <div class="algorithm-detail-section">
        <div class="algorithm-section-heading"><div><span>02</span><h4>Conditions and equations</h4></div><p>Executed logic is distinguished from reference-only calculations and implementation heuristics.</p></div>
        ${renderEquations(step.equations)}
      </div>

      <div class="algorithm-detail-section algorithm-output-section">
        <div class="algorithm-section-heading"><div><span>03</span><h4>What this step returns</h4></div><p>These outputs become facts or visible artifacts for later stages.</p></div>
        <ul class="algorithm-output-list">${(step.outputs ?? []).map((output) => `<li>${escapeHtml(output)}</li>`).join('')}</ul>
      </div>

      <div class="algorithm-detail-section">
        <div class="algorithm-section-heading"><div><span>04</span><h4>Worked examples</h4></div><p>Examples illustrate deterministic routing; they are not clinical validation cases.</p></div>
        ${renderExamples(step.examples)}
      </div>

      <div class="algorithm-detail-section">
        <div class="algorithm-section-heading"><div><span>05</span><h4>Evidence basis</h4></div><p>Open a source to inspect the clinical premise used by this step.</p></div>
        ${renderEvidence(step.evidence)}
      </div>

      <aside class="algorithm-caveat"><strong>Interpretive boundary</strong><span>${escapeHtml(step.caveat)}</span></aside>
    </article>`;
}

function renderBranches(branches = []) {
  const root = $('#algorithm-branch-grid');
  if (!root) return;
  root.innerHTML = branches.map((branch, index) => `
    <details class="algorithm-branch ${escapeHtml(branch.accent)}"${index === 0 ? ' open' : ''}>
      <summary>
        <span class="algorithm-branch-icon" aria-hidden="true">${branch.id === 'microcytic' ? 'μ' : branch.id === 'normocytic' ? 'N' : 'M'}</span>
        <span><strong>${escapeHtml(branch.title)}</strong><small>${escapeHtml(branch.subtitle)}</small></span>
        <span class="algorithm-branch-toggle">Details</span>
      </summary>
      <div class="algorithm-branch-body">
        <section>
          <h4>Branch sequence</h4>
          <ol>${branch.sequence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
        </section>
        <section>
          <h4>Pattern discriminators</h4>
          <div class="algorithm-table-wrap">
            <table class="algorithm-discriminator-table">
              <thead><tr><th>Pattern</th><th>Findings that add support</th><th>What prevents overcalling it</th></tr></thead>
              <tbody>${branch.discriminators.map((row) => `
                <tr><td><strong>${escapeHtml(row.pattern)}</strong></td><td>${escapeHtml(row.supports)}</td><td>${escapeHtml(row.counterpoints)}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </section>
        <section>
          <h4>Primary sources</h4>
          ${renderEvidence(branch.evidence, { compact: true })}
        </section>
      </div>
    </details>`).join('');
}

function caseSnapshot(input, facts) {
  const items = [
    ['Age', Number.isFinite(facts.patient.ageMonths) ? `${formatNumber(facts.patient.ageMonths, 0)} mo` : null],
    ['Hemoglobin', Number.isFinite(facts.cbc.hb) ? `${formatNumber(facts.cbc.hb)} g/dL` : null],
    ['MCV', Number.isFinite(facts.cbc.mcv) ? `${formatNumber(facts.cbc.mcv)} fL` : null],
    ['RDW', Number.isFinite(facts.cbc.rdw) ? `${formatNumber(facts.cbc.rdw)}%` : null],
    ['Retic response', facts.retic.known ? humanize(facts.retic.response) : 'Unknown'],
    ['Ferritin', Number.isFinite(facts.ferritin.value) ? `${formatNumber(facts.ferritin.value)} ng/mL` : null],
    ['CRP', input.labs?.crpStatus ? humanize(input.labs.crpStatus) : null],
    ['Blood lead', Number.isFinite(facts.lead.value) ? `${formatNumber(facts.lead.value)} µg/dL (${humanize(facts.lead.specimen)})` : null],
    ['ANC', Number.isFinite(facts.cbc.anc) ? formatNumber(facts.cbc.anc) : null],
    ['Platelets', Number.isFinite(facts.cbc.platelets) ? formatNumber(facts.cbc.platelets, 0) : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  return `<div class="algorithm-case-snapshot">${items.map(([label, value]) => `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`).join('')}</div>`;
}

function scopeWalkthrough(result, facts) {
  const alertSummary = result.alerts.length
    ? result.alerts.map((alert) => `${humanize(alert.severity)}: ${alert.title}`).join(' · ')
    : 'No immediate alert rule matched in the supplied example.';
  const localSource = result.classification.thresholdSource === 'LOCAL_LAB'
    ? 'Local laboratory'
    : formatSource(result.classification.thresholdSource);
  return {
    number: 1,
    title: 'Scope and urgency',
    data: `Age ${formatNumber(facts.patient.ageMonths, 0)} months; threshold source ${localSource}; ${facts.cbc.additionalCytopeniaCount} additional cytopenia flag(s).`,
    expression: `6 ≤ ${formatNumber(facts.patient.ageMonths, 0)} < 216 → ${facts.scope.supportedAge ? 'supported general-pediatric scope' : 'fallback scope unavailable'}`,
    result: alertSummary,
    tone: result.alerts.some((alert) => alert.severity === 'emergency') ? 'danger' : result.alerts.length ? 'warning' : 'clear',
    evidence: unique(result.alerts.flatMap((alert) => alert.evidence ?? [])),
  };
}

function anemiaWalkthrough(result, facts) {
  const hb = facts.cbc.hb;
  const lower = facts.thresholds.hbLower;
  const operator = facts.anemia.present ? '<' : facts.anemia.absent ? '≥' : '?';
  const deficit = Number.isFinite(hb) && Number.isFinite(lower) ? Math.max(0, lower - hb) : null;
  return {
    number: 2,
    title: 'Confirm anemia',
    data: `Hemoglobin ${formatNumber(hb)} g/dL; effective lower limit ${formatNumber(lower)} g/dL; source ${formatSource(result.classification.thresholdSource)}.`,
    expression: Number.isFinite(hb) && Number.isFinite(lower)
      ? `${formatNumber(hb)} ${operator} ${formatNumber(lower)}${deficit > 0 ? `; deficit ${formatNumber(deficit)} g/dL` : ''}`
      : 'Hemoglobin or effective lower limit unavailable',
    result: `Anemia ${humanize(facts.anemia.status)}.`,
    tone: facts.anemia.present ? 'warning' : facts.anemia.absent ? 'clear' : 'neutral',
    evidence: ['AAP2026_IDA', 'WHO2024_HB'],
  };
}

function morphologyWalkthrough(facts) {
  const mcv = facts.cbc.mcv;
  const low = facts.thresholds.mcvLower;
  const high = facts.thresholds.mcvUpper;
  let expression = 'MCV or interval unavailable';
  if ([mcv, low, high].every(Number.isFinite)) {
    if (mcv < low) expression = `${formatNumber(mcv)} < ${formatNumber(low)} → microcytic`;
    else if (mcv > high) expression = `${formatNumber(mcv)} > ${formatNumber(high)} → macrocytic`;
    else expression = `${formatNumber(low)} ≤ ${formatNumber(mcv)} ≤ ${formatNumber(high)} → normocytic`;
  }
  const rdw = Number.isFinite(facts.cbc.rdw)
    ? ` RDW ${formatNumber(facts.cbc.rdw)}% is ${facts.morphology.rdwHigh === true ? 'above' : facts.morphology.rdwHigh === false ? 'not above' : 'not classifiable against'} the effective upper limit.`
    : '';
  return {
    number: 3,
    title: 'Classify morphology',
    data: `MCV ${formatNumber(mcv)} fL; interval ${formatNumber(low)}–${formatNumber(high)} fL; RDW ${formatNumber(facts.cbc.rdw)}%.`,
    expression,
    result: `${humanize(facts.morphology.value)} morphology.${rdw}`,
    tone: 'neutral',
    evidence: ['AAP2026_IDA', 'BLOOD2022_PED_ANEMIA'],
  };
}

function reticWalkthrough(facts) {
  let route = 'Reticulocyte response is unknown; the engine requests local interpretation.';
  if (facts.retic.high) route = 'High response → loss/destruction pathway.';
  else if (facts.retic.low) route = 'Low or inappropriately normal response → production-limited pathway.';
  else if (facts.retic.known) route = 'Appropriate response → interpret with morphology, timing, and other findings.';
  return {
    number: 4,
    title: 'Classify marrow response',
    data: `Supplied reticulocyte response: ${humanize(facts.retic.response)}.`,
    expression: `response = ${facts.retic.response || 'unknown'} → deterministic branch mapping`,
    result: route,
    tone: facts.retic.unknown ? 'warning' : 'neutral',
    evidence: ['BLOOD2022_PED_ANEMIA'],
  };
}

function branchWalkthrough(result, facts) {
  const branchMap = {
    microcytic: 'iron / inflammation / globin / lead / rare microcytic rules',
    normocytic: 'reticulocyte-directed loss, hemolysis, renal, inflammation, viral, and marrow rules',
    macrocytic: 'reticulocytosis, nutrient, thyroid, liver, medication, copper, and marrow rules',
    indeterminate: 'cross-morphology and missing-data rules',
  };
  const top = result.rankedDifferential[0];
  const topText = top
    ? `${top.label} (${humanize(top.level)}; ${top.matchedRules.length} matched candidate rule${top.matchedRules.length === 1 ? '' : 's'}).`
    : 'No diagnostic candidate rule matched the supplied data.';
  return {
    number: 5,
    title: 'Apply branch rules',
    data: `Morphology ${humanize(facts.morphology.value)}; reticulocyte response ${humanize(facts.retic.response)}; ${result.provenance.matchedRuleIds.length} total rule outputs matched.`,
    expression: `${facts.morphology.value} → ${branchMap[facts.morphology.value] ?? branchMap.indeterminate}`,
    result: topText,
    tone: top ? 'active' : 'neutral',
    evidence: unique(result.rankedDifferential.flatMap((candidate) => candidate.evidence ?? [])).slice(0, 4),
  };
}

function rankingWalkthrough(result) {
  const top = result.rankedDifferential[0];
  const candidates = result.rankedDifferential.slice(0, 3)
    .map((candidate) => `#${candidate.rank} ${candidate.label} [${humanize(candidate.level)}, score ${candidate.score}]`)
    .join(' · ');
  return {
    number: 6,
    title: 'Rank and expose provenance',
    data: `${result.rankedDifferential.length} candidate pattern(s); ${result.alerts.length} alert(s); ${result.nextQuestions.length} adaptive question(s).`,
    expression: 'levelRank ↓ → score ↓ → label A–Z',
    result: candidates || 'No ranked candidate. Missing-data questions and limitations remain visible.',
    tone: top ? 'active' : 'neutral',
    evidence: unique([...(top?.evidence ?? []), 'FDA2026_CDS']),
  };
}

function renderWalkthrough(input, result, facts, metadata) {
  const root = $('#algorithm-walkthrough');
  if (!root) return;
  const steps = [
    scopeWalkthrough(result, facts),
    anemiaWalkthrough(result, facts),
    morphologyWalkthrough(facts),
    reticWalkthrough(facts),
    branchWalkthrough(result, facts),
    rankingWalkthrough(result),
  ];
  const alerts = result.alerts.length
    ? `<div class="algorithm-case-alerts">${result.alerts.map((alert) => `
        <article class="algorithm-case-alert ${escapeHtml(alert.severity)}"><strong>${escapeHtml(humanize(alert.severity))}: ${escapeHtml(alert.title)}</strong><span>${escapeHtml(alert.detail)}</span></article>`).join('')}</div>`
    : '<div class="algorithm-case-clear"><strong>No escalation alert matched</strong><span>This only reflects the supplied example data.</span></div>';
  const candidates = result.rankedDifferential.length
    ? `<div class="algorithm-case-candidates">${result.rankedDifferential.slice(0, 4).map((candidate) => `
        <article>
          <span class="algorithm-case-rank">#${candidate.rank}</span>
          <div><strong>${escapeHtml(candidate.label)}</strong><small>${escapeHtml(humanize(candidate.level))} · score ${escapeHtml(candidate.score)} · ${candidate.matchedRules.length} matched rule${candidate.matchedRules.length === 1 ? '' : 's'}</small></div>
          <div class="algorithm-mini-sources">${(candidate.evidence ?? []).slice(0, 3).map((id) => evidenceLink(id, { compact: true })).join('')}</div>
        </article>`).join('')}</div>`
    : '<p class="algorithm-empty">No diagnostic candidate matched. Review missing data and limitations.</p>';

  root.innerHTML = `
    <article class="algorithm-case-card">
      <header class="algorithm-case-header">
        <div><p>Engine-executed walkthrough</p><h3>${escapeHtml(metadata.label)}</h3><span>${escapeHtml(metadata.description)}</span></div>
        <span class="algorithm-case-badge">Real example JSON + current rules</span>
      </header>
      ${caseSnapshot(input, facts)}
      <div class="algorithm-walkthrough-steps">${steps.map((step) => `
        <article class="algorithm-walkthrough-step ${escapeHtml(step.tone)}">
          <header><span>${step.number}</span><div><small>Algorithm step</small><strong>${escapeHtml(step.title)}</strong></div></header>
          <dl>
            <div><dt>Data used</dt><dd>${escapeHtml(step.data)}</dd></div>
            <div><dt>Expression</dt><dd><code>${escapeHtml(step.expression)}</code></dd></div>
            <div><dt>Engine result</dt><dd>${escapeHtml(step.result)}</dd></div>
          </dl>
          ${step.evidence.length ? `<footer>${step.evidence.map((id) => evidenceLink(id, { compact: true })).join('')}</footer>` : ''}
        </article>`).join('')}</div>
      <div class="algorithm-case-summary-grid">
        <section><div class="algorithm-section-heading compact"><div><span>!</span><h4>Alerts</h4></div></div>${alerts}</section>
        <section><div class="algorithm-section-heading compact"><div><span>Σ</span><h4>Ranked output</h4></div></div>${candidates}</section>
      </div>
      <aside class="algorithm-caveat"><strong>Example boundary</strong><span>The examples demonstrate engine behavior, not diagnostic accuracy, treatment selection, or clinical validation.</span></aside>
    </article>`;
}

export async function initializeAlgorithmExplorer({ rules, candidates, onUseCase } = {}) {
  const explorer = $('#algorithm-explorer');
  if (!explorer || explorer.dataset.initialized === 'true') return;
  explorer.dataset.initialized = 'true';

  const response = await fetch('./data/algorithm-explainers.json');
  if (!response.ok) throw new Error('Unable to load the algorithm explainer data.');
  const data = await response.json();

  renderPrinciples(data.principles);
  renderStepCards(data.steps);
  renderStepDetail(data.steps[0]);
  renderBranches(data.branches);

  const stepById = new Map(data.steps.map((step) => [step.id, step]));
  $('#algorithm-step-map')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-algorithm-step]');
    if (!button) return;
    const step = stepById.get(button.dataset.algorithmStep);
    if (!step) return;
    $$('.algorithm-step-card', $('#algorithm-step-map')).forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    renderStepDetail(step);
    $('#algorithm-step-detail .algorithm-detail-card')?.focus({ preventScroll: true });
  });

  const select = $('#algorithm-example-select');
  const description = $('#algorithm-example-description');
  const useCaseButton = $('#algorithm-use-case');
  const exampleCache = new Map();
  let currentInput = null;

  if (select) {
    select.innerHTML = data.exampleCases.map((example) => `<option value="${escapeHtml(example.id)}">${escapeHtml(example.label)}</option>`).join('');
  }

  async function loadExample(exampleId) {
    const metadata = data.exampleCases.find((example) => example.id === exampleId) ?? data.exampleCases[0];
    if (!metadata) return;
    const root = $('#algorithm-walkthrough');
    if (root) {
      root.setAttribute('aria-busy', 'true');
      root.innerHTML = '<div class="algorithm-loading"><span aria-hidden="true"></span>Executing the selected example through the current knowledge base…</div>';
    }
    try {
      let input = exampleCache.get(metadata.id);
      if (!input) {
        const exampleResponse = await fetch(`./examples/${metadata.id}.json`);
        if (!exampleResponse.ok) throw new Error(`Unable to load example ${metadata.id}.`);
        input = await exampleResponse.json();
        exampleCache.set(metadata.id, input);
      }
      const result = assessPediatricAnemia(input, rules, candidates);
      const facts = deriveFacts(input);
      currentInput = input;
      if (description) description.textContent = metadata.description;
      if (useCaseButton) useCaseButton.disabled = false;
      renderWalkthrough(input, result, facts, metadata);
    } finally {
      root?.removeAttribute('aria-busy');
    }
  }

  select?.addEventListener('change', () => {
    loadExample(select.value).catch((error) => {
      const root = $('#algorithm-walkthrough');
      if (root) root.innerHTML = `<div class="algorithm-error"><strong>Example could not be evaluated.</strong><span>${escapeHtml(error.message)}</span></div>`;
    });
  });

  useCaseButton?.addEventListener('click', () => {
    if (currentInput && typeof onUseCase === 'function') onUseCase(structuredClone(currentInput));
  });

  await loadExample(data.exampleCases[0]?.id);
}
