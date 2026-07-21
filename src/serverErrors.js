import { RangeUnitMismatchError } from './ranges/registry.js';
import { UnitRejectionError } from './units.js';
// AgeOutOfSupportedRangeError lives in the anemia module package (modules/anemia/facts.anemia.js),
// not in src/, because ARCH §10 condition 2's scope policy is module-specific (docs/architecture.md
// §2a's module package architecture) — src/evidence.js and src/referenceRanges.js already import
// from modules/anemia/* the same way, so this is not a new layering precedent.
import { AgeOutOfSupportedRangeError } from '../modules/anemia/facts.anemia.js';

/** Build the public HTTP status and body for an error without exposing internal error metadata. */
export function shapeServerError(error) {
  const status = error.statusCode || (error.code === 'ENOENT' ? 404 : 400);
  const body = { error: status === 404 ? 'Not found' : error.message };

  if (
    error instanceof UnitRejectionError
    || error instanceof RangeUnitMismatchError
    || error instanceof AgeOutOfSupportedRangeError
  ) {
    body.code = error.code;
    body.details = error.details;
  }

  return { status, body };
}
