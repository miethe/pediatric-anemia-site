/**
 * Maps the four clinician-facing questionnaire control states to the existing
 * three-value engine wire model. An empty control value is intentionally
 * omitted from the engine payload; it is represented explicitly only in the
 * capture envelope built by the browser UI.
 */
export function stateFromControlValue(value) {
  if (value === 'true' || value === 'false' || value === 'unknown') return value;
  return undefined;
}

/**
 * Maps an existing engine value back to its four-option control value.
 */
export function controlValueFromState(value) {
  if (value === true || value === 'true') return 'true';
  if (value === false || value === 'false') return 'false';
  if (value === 'unknown') return 'unknown';
  return '';
}

/**
 * Names the capture-layer state without creating a fourth engine wire value.
 */
export function captureStateFromControlValue(value) {
  if (value === 'true') return 'present';
  if (value === 'false') return 'absent';
  if (value === 'unknown') return 'unknown';
  return 'not-assessed';
}

/** Returns true only for an explicitly present value. */
export function isPresent(value) {
  return controlValueFromState(value) === 'true';
}

/** Returns true when the clinician selected any of the three engine values. */
export function isAssessed(value) {
  return controlValueFromState(value) !== '';
}
