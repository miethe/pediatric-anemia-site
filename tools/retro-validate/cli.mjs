#!/usr/bin/env node
// tools/retro-validate/cli.mjs -- entry point for the retrospective validation harness
// (Evidence Foundry E1 Phase 4, P4-T1, FR-19/FR-20, ADR-0006). See ./README.md for the full
// five-module boundary (corpus / boundary / replay / metrics / access-log) this file dispatches
// to, and for the ruling-R6 scope this tool operates under.
//
// This CLI is a deterministic, offline harness that replays a version-pinned CDS engine build
// against a fixtures-only corpus (synthetic + de-identified content ONLY, structurally enforced --
// no real-data input path exists) and emits software-agreement metrics. It is never, and cannot
// be read as, a clinical-validity, safety, or diagnostic-performance claim.
//
// Verbs:
//   check-fixtures  -- structural de-identification boundary gate (FR-20). Real as of P4-T1.
//   run             -- version-pinned deterministic replay (FR-19). Real as of P4-T3.
//   report          -- software-agreement metrics + provenance sidecar (FR-21). Scaffold-only
//                       until P4-T4.
//
// Zero network calls, zero LLM/generative-model invocations, ever -- this tool's only imports are
// Node built-ins, `../../scripts/lib/json-schema-lite.mjs`, and its own `lib/` modules.

import { run as runCheckFixtures } from './lib/verbs/check-fixtures.mjs';
import { run as runRun } from './lib/verbs/run.mjs';
import { run as runReport } from './lib/verbs/report.mjs';
import { RetroValidateError, EXIT_OK, EXIT_USAGE } from './lib/errors.mjs';

const VERB_HANDLERS = Object.freeze({
  'check-fixtures': runCheckFixtures,
  run: runRun,
  report: runReport,
});

const HELP_TEXT = `retro-validate -- deterministic, offline retrospective validation harness for the
pediatric CDS engine (Evidence Foundry E1 Phase 4, FR-19/FR-20/FR-21, ADR-0006).

Usage:
  node tools/retro-validate/cli.mjs <verb> [options]

Verbs:
  check-fixtures --corpus <dir>
      Validates <dir>/corpus.json against the fixture-corpus structural de-identification boundary
      (schemas/fixture-corpus.schema.json). Fail-closed: any identifier-bearing case, any case
      missing its provenance marker, or a corpus missing sourceAttestation is rejected with a
      non-zero exit and no output artifact. Prints a JSON summary on success.

  run --corpus <dir> --candidate-digest <registry digest> --registry <path>
      Real as of P4-T3. Resolves the candidate build EXCLUSIVELY via a registry-entry packDigest
      match (never "current tree" -- an unpinned/unregistered digest, an unregistered moduleId, a
      missing pinned-content directory, or drifted pinned content all fail closed with zero output),
      then replays every corpus case (sorted by caseId) and writes a canonical, timestamp-free
      build/retro-runs/<corpusId>/<digestSlug>/replay-output.json -- byte-identical across two runs
      over identical inputs. See tools/retro-validate/README.md's "Version-pinned replay" section.

  report --corpus <dir> --run <replay output dir> --protocol <protocol doc>
      Scaffold only in this task (P4-T1) -- lands in P4-T4. Will emit agreement-report.json (5
      OQ-5 software-agreement measures) + run-provenance.json.

Access log (FR-22, ADR-0006 audit clause -- P4-T7): every check-fixtures/run/report invocation,
successful or not, appends one structured entry to tools/retro-validate/access-log.jsonl. Optional
flags, never required (an unresolved value is logged explicitly, never silently omitted):
  --actor <id>              Who ran it. Falls back to RETRO_VALIDATE_ACTOR, then "unknown".
  --purpose <text>          Why it was run. Falls back to RETRO_VALIDATE_PURPOSE, then "unspecified".
  --access-log-path <file>  Overrides the log location. Falls back to RETRO_VALIDATE_ACCESS_LOG_PATH,
                             then the default path above. Test/tooling isolation only.

Global:
  -h, --help    Show this help and exit 0.

Exit codes: 0 ok · 1 usage (including an unbuilt verb, or a RegistryError candidate-resolution
failure -- see run above) · 2 boundary (FR-20 rejection, fail-closed).

This tool makes zero network calls and invokes no LLM/generative model at any point. Nothing it
emits is, or may be read as, a clinical-validity, safety, or diagnostic-performance claim.
`;

/**
 * Minimal, dependency-free `--flag value` / `--bool-flag` parser -- same shape as
 * `tools/rf-bundle-to-kb-pack/cli.mjs#parseFlags` (this repo's established E0 CLI convention, see
 * this plan's binding OQ-1 resolution). Kebab-case flag names convert to camelCase keys
 * (`--candidate-digest` -> `candidateDigest`). A flag followed by another flag (or nothing) is
 * treated as a boolean `true` rather than consuming the next token as its value.
 *
 * @param {string[]} argv arguments after the verb
 * @returns {Record<string, string | boolean>}
 */
export function parseFlags(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new RetroValidateError(`unexpected positional argument "${token}"`, EXIT_USAGE);
    }
    const key = token
      .slice(2)
      .replace(/-([a-z0-9])/g, (_match, char) => char.toUpperCase());
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      options[key] = next;
      i += 1;
    } else {
      options[key] = true;
    }
  }
  return options;
}

/**
 * Runs a single verb handler and maps its outcome to a process exit code. This is the harness's
 * ONLY generic-error handler -- a thrown `RetroValidateError` (or subclass) always forwards its
 * own fixed `exitCode` verbatim; any other thrown value (a genuine bug, not a taxonomy-mapped
 * failure) falls back to `EXIT_USAGE` since neither taxonomy state is a natural fit for an
 * unclassified crash.
 *
 * @param {(options: object) => Promise<number | void>} handler a verb's `run` function
 * @param {object} options parsed CLI flags for the verb
 * @returns {Promise<number>} the process exit code
 */
export async function dispatchVerb(handler, options) {
  try {
    const result = await handler(options);
    return typeof result === 'number' ? result : EXIT_OK;
  } catch (err) {
    if (err instanceof RetroValidateError) {
      process.stderr.write(`${err.name}: ${err.message}\n`);
      return err.exitCode;
    }
    process.stderr.write(`internal error: ${err.stack || err.message}\n`);
    return EXIT_USAGE;
  }
}

/**
 * @param {string[]} argv `process.argv.slice(2)`
 * @returns {Promise<number>} the process exit code
 */
export async function main(argv) {
  const [verb, ...rest] = argv;

  if (!verb || verb === '-h' || verb === '--help') {
    process.stdout.write(HELP_TEXT);
    return EXIT_OK;
  }

  const handler = VERB_HANDLERS[verb];
  if (!handler) {
    process.stderr.write(`error: unknown verb "${verb}"\n\n`);
    process.stderr.write(HELP_TEXT);
    return EXIT_USAGE;
  }

  let options;
  try {
    options = parseFlags(rest);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return err instanceof RetroValidateError ? err.exitCode : EXIT_USAGE;
  }

  return dispatchVerb(handler, options);
}

// Only run when invoked directly (`node cli.mjs ...`), not when imported (e.g. by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
