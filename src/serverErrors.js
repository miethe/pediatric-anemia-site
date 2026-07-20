import { RangeUnitMismatchError } from './ranges/registry.js';
import { UnitRejectionError } from './units.js';

/** Build the public HTTP status and body for an error without exposing internal error metadata. */
export function shapeServerError(error) {
  const status = error.statusCode || (error.code === 'ENOENT' ? 404 : 400);
  const body = { error: status === 404 ? 'Not found' : error.message };

  if (error instanceof UnitRejectionError || error instanceof RangeUnitMismatchError) {
    body.code = error.code;
    body.details = error.details;
  }

  return { status, body };
}
