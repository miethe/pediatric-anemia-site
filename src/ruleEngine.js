import { toTri } from './facts/tristate.js';

const LEVEL_RANK = Object.freeze({
  'meets-defined-pattern': 5,
  'strongly-supported': 4,
  supported: 3,
  possible: 2,
  'not-excluded': 1,
});

const ALERT_RANK = Object.freeze({ emergency: 4, urgent: 3, important: 2, informational: 1 });

function getPath(object, path) {
  if (!path) return object;
  return String(path)
    .split('.')
    .reduce((value, key) => (value === null || value === undefined ? undefined : value[key]), object);
}

function evaluateLeaf(leaf, facts) {
  const actual = getPath(facts, leaf.fact);
  const expected = leaf.value;
  switch (leaf.op ?? 'eq') {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'gt': return Number.isFinite(actual) && actual > expected;
    case 'gte': return Number.isFinite(actual) && actual >= expected;
    case 'lt': return Number.isFinite(actual) && actual < expected;
    case 'lte': return Number.isFinite(actual) && actual <= expected;
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    case 'not-in': return Array.isArray(expected) && !expected.includes(actual);
    case 'includes': return Array.isArray(actual) && actual.includes(expected);
    case 'exists': return actual !== null && actual !== undefined && actual !== '';
    case 'missing': return actual === null || actual === undefined || actual === '';
    case 'truthy': return Boolean(actual);
    case 'falsy': return !actual;
    // Tri-state operators (EP-1 / SPIKE-003). Every one routes through toTri() so that
    // null, '' and an absent path all resolve to 'unknown' exactly as a missing path does —
    // "missingness is never treated as normal" must not depend on how the caller spelled
    // the absence. is-unknown / is-not-assessed are deliberate synonyms.
    case 'is-present': return toTri(actual) === 'true';
    case 'is-absent': return toTri(actual) === 'false';
    case 'is-unknown':
    case 'is-not-assessed': return toTri(actual) === 'unknown';
    default: throw new Error(`Unknown rule operator: ${leaf.op}`);
  }
}

export function evaluateCondition(condition, facts) {
  if (!condition || Object.keys(condition).length === 0) return true;
  if (Array.isArray(condition.all)) {
    return condition.all.every((item) => evaluateCondition(item, facts));
  }
  if (Array.isArray(condition.any)) {
    return condition.any.some((item) => evaluateCondition(item, facts));
  }
  if (condition.not) return !evaluateCondition(condition.not, facts);
  return evaluateLeaf(condition, facts);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function interpolate(text, facts) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path) => {
    const value = getPath(facts, path.trim());
    if (value === null || value === undefined || value === '') return 'not supplied';
    return String(value);
  });
}

function materializeArray(values, facts) {
  return (values ?? []).map((value) => interpolate(value, facts));
}

function mergeCandidate(store, rule, facts, catalog) {
  const output = rule.output;
  const id = output.candidateId;
  const base = catalog[id] ?? { id, label: id, summary: '' };
  const current = store.get(id) ?? {
    ...base,
    level: 'not-excluded',
    score: 0,
    matchedRules: [],
    supportingFindings: [],
    cautions: [],
    nextSteps: [...(base.defaultNextSteps ?? [])],
    evidence: [...(base.evidence ?? [])],
  };

  current.score += Number(output.points ?? 0);
  if ((LEVEL_RANK[output.level] ?? 0) > (LEVEL_RANK[current.level] ?? 0)) {
    current.level = output.level;
  }
  current.matchedRules.push(rule.id);
  current.supportingFindings.push(...materializeArray(output.support, facts));
  current.cautions.push(...materializeArray(output.cautions, facts));
  current.nextSteps.push(...materializeArray(output.nextSteps, facts));
  current.evidence.push(...(rule.evidence ?? []), ...(output.evidence ?? []));
  current.supportingFindings = unique(current.supportingFindings);
  current.cautions = unique(current.cautions);
  current.nextSteps = unique(current.nextSteps);
  current.evidence = unique(current.evidence);
  store.set(id, current);
}

export function runRules(facts, rules, catalog = {}) {
  const candidates = new Map();
  const alerts = [];
  const questions = [];
  const notes = [];
  const audit = [];

  for (const rule of rules) {
    const matched = evaluateCondition(rule.when, facts);
    audit.push({ ruleId: rule.id, matched });
    if (!matched) continue;

    const output = rule.output ?? {};
    if (output.type === 'candidate') {
      mergeCandidate(candidates, rule, facts, catalog);
    } else if (output.type === 'alert') {
      alerts.push({
        id: rule.id,
        severity: output.severity ?? 'important',
        title: interpolate(output.title, facts),
        detail: interpolate(output.detail, facts),
        actions: materializeArray(output.actions, facts),
        evidence: unique([...(rule.evidence ?? []), ...(output.evidence ?? [])]),
      });
    } else if (output.type === 'question') {
      questions.push({
        id: rule.id,
        priority: Number(output.priority ?? 50),
        section: output.section ?? 'additional',
        prompt: interpolate(output.prompt, facts),
        why: interpolate(output.why, facts),
        evidence: unique([...(rule.evidence ?? []), ...(output.evidence ?? [])]),
      });
    } else if (output.type === 'note') {
      notes.push({
        id: rule.id,
        title: interpolate(output.title, facts),
        detail: interpolate(output.detail, facts),
        evidence: unique([...(rule.evidence ?? []), ...(output.evidence ?? [])]),
      });
    }
  }

  const rankedCandidates = [...candidates.values()]
    .sort((a, b) => {
      const levelDiff = (LEVEL_RANK[b.level] ?? 0) - (LEVEL_RANK[a.level] ?? 0);
      if (levelDiff !== 0) return levelDiff;
      if (b.score !== a.score) return b.score - a.score;
      return a.label.localeCompare(b.label);
    })
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  alerts.sort((a, b) => {
    const severityDiff = (ALERT_RANK[b.severity] ?? 0) - (ALERT_RANK[a.severity] ?? 0);
    return severityDiff || a.title.localeCompare(b.title);
  });

  questions.sort((a, b) => a.priority - b.priority || a.prompt.localeCompare(b.prompt));

  return { candidates: rankedCandidates, alerts, questions, notes, audit };
}
