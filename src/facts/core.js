export const finite = (value) => Number.isFinite(Number(value)) && value !== '' && value !== null;
export const num = (value) => (finite(value) ? Number(value) : null);
export const isTrue = (value) => value === true;
export const statusIs = (value, expected) => String(value ?? '').toLowerCase() === expected;
export const includes = (values, item) => Array.isArray(values) && values.includes(item);

export function countTrue(values) {
  return values.filter(Boolean).length;
}
