// Source-asserted UI contract: this file reads markup/text and does not execute
// DOM-dependent src/app.js. It catches registry/markup or option-vocabulary drift.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = readFileSync(path.join(root, 'src/app.js'), 'utf8');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');

function namesFromRegistry(constant) {
  const match = appSource.match(new RegExp(`const ${constant} = \\[([\\s\\S]*?)\\];`));
  assert.ok(match, `${constant} registry must exist`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

const booleanMapNames = [
  ...namesFromRegistry('symptomNames'),
  ...namesFromRegistry('historyNames'),
  ...namesFromRegistry('examNames'),
].sort();
const stateRegistryNames = [
  ...booleanMapNames,
  ...namesFromRegistry('patientBooleanNames'),
  ...namesFromRegistry('specializedBooleanNames'),
  ...namesFromRegistry('localFlagNames'),
  'smearReviewed',
].sort();

const quadControls = [...html.matchAll(/<select class="quad-select" name="([^"]+)">([\s\S]*?)<\/select>/g)];
const localFlagControls = [...html.matchAll(/<select class="local-flag-select" name="([^"]+)">([\s\S]*?)<\/select>/g)];
const allStateControls = [...quadControls, ...localFlagControls];
const markupNames = allStateControls.map((match) => match[1]).sort();
const expectedOptions = [
  ['true', 'Present'],
  ['false', 'Absent'],
  ['unknown', 'Unknown'],
  ['', 'Not assessed'],
];

test('every booleanMap registry field has exactly one four-state control, and no extras exist', () => {
  const booleanMapMarkupNames = quadControls
    .map((match) => match[1])
    .filter((name) => booleanMapNames.includes(name))
    .sort();
  assert.equal(booleanMapNames.length, 59);
  assert.deepEqual(booleanMapMarkupNames, booleanMapNames);
});

test('every interpretation-bearing boolean has one four-state control', () => {
  assert.equal(stateRegistryNames.length, 73);
  assert.deepEqual(markupNames, stateRegistryNames);
  assert.equal(new Set(markupNames).size, markupNames.length);
});

test('every four-state control uses the human-approved label and option order', () => {
  for (const [, name, options] of allStateControls) {
    const actual = [...options.matchAll(/<option value="([^"]*)"(?: selected)?>([^<]+)<\/option>/g)]
      .map((item) => [item[1], item[2]]);
    assert.deepEqual(actual, expectedOptions, `${name} must preserve the four-state vocabulary`);
  }
});

test('the UI delegates serialization and durable capture to distinct layers', () => {
  assert.match(appSource, /symptoms:\s*triFields\(symptomNames\)/);
  assert.match(appSource, /history:\s*triFields\(historyNames\)/);
  assert.match(appSource, /exam:\s*triFields\(examNames\)/);
  assert.match(appSource, /\.\.\.triFields\(patientBooleanNames\)/);
  assert.match(appSource, /\.\.\.triFields\(specializedBooleanNames\)/);
  assert.match(appSource, /localFlags:\s*triFields\(localFlagNames\)/);
  assert.doesNotMatch(appSource, /smearReviewed:\s*fieldStateValue\('smearReviewed'\)/);
  assert.match(appSource, /smearReviewed:\s*captureStateFromControlValue\(field\('smearReviewed'\)/);
  assert.match(appSource, /smear:\s*checkedValues\('smear'\)/);
  assert.doesNotMatch(appSource, /smear:\s*isPresent\(fieldStateValue\('smearReviewed'\)\)/);
  assert.match(appSource, /schemaVersion:\s*'questionnaire-capture\/v1'/);
  assert.match(appSource, /JSON\.stringify\(captureEnvelope\(\)\)\s*!==\s*JSON\.stringify\(currentAudit\.capture\)/);
  assert.match(appSource, /Focus order updated:/);
});

test('local CBC flags omit untouched controls and smear review remains capture-envelope-only', () => {
  for (const name of namesFromRegistry('localFlagNames')) {
    assert.match(
      html,
      new RegExp(`<select class="local-flag-select" name="${name}">[\\s\\S]*?<option value="" selected>Not assessed</option>`),
    );
  }
  assert.match(html, /<select class="quad-select" name="smearReviewed">[\s\S]*?<option value="" selected>Not assessed<\/option>/);
  assert.match(appSource, /localFlags:\s*triFields\(localFlagNames\)/);
  assert.match(html, /does not enable, disable, or change morphology input/);
});
