/**
 * Converts booleans and absent values to Tri strings; nullish and unrecognized values are unknown.
 * @param {unknown} value
 * @returns {'true' | 'false' | 'unknown'}
 */
export function toTri(value) {
  if (value === 'true' || value === 'false' || value === 'unknown') return value;
  if (value === true) return 'true';
  if (value === false) return 'false';
  return 'unknown';
}

/**
 * Counts only values assessed as present; unknown and missing values are excluded.
 * @param {unknown[]} values
 * @returns {number}
 */
export function countPresent(values) {
  return values.filter((value) => toTri(value) === 'true').length;
}

/**
 * Reports whether any value is unknown, including nullish or unrecognized values.
 * @param {unknown[]} values
 * @returns {boolean}
 */
export function anyUnknown(values) {
  return values.some((value) => toTri(value) === 'unknown');
}

/**
 * Reports whether every value is assessed; nullish or unrecognized values make this false.
 * @param {unknown[]} values
 * @returns {boolean}
 */
export function allAssessed(values) {
  return values.every((value) => toTri(value) !== 'unknown');
}
