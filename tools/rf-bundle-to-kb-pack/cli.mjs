#!/usr/bin/env node
// tools/rf-bundle-to-kb-pack/cli.mjs — entry point for the `rf-bundle-to-kb-pack` converter
// (EF-WP0). Design/scaffold task P2-T1 (FR-6, 02 §4.1, 02 §4.5).
//
// This CLI is the deterministic, offline bridge from a verified `rf` (Research Foundry) evidence
// bundle to a staged CDS "kb-pack" authoring proposal. See ./README.md for the full module
// boundary this file dispatches to, the seam-invariant contract every verb must uphold, and the
// zero-runtime-dependency design decision this converter follows.
//
// Verbs (02 §4.5):
//   inspect  — read-only summary of a run's eligibility/hashes; emits no pack output. (P2-T6)
//   verify   — structural pre-check of a staged pack (or, this phase, of loader output). (P2-T7)
//   propose  — assembles the full staged kb-pack proposal (pack-provenance.json, evidence.json,
//              evidence-assertions.json, candidates.json, rule-proposals.json, rules.json,
//              rule-provenance.json) by wiring together the hand-authored P3-T1..T6 content
//              behind the same loader -> hashing -> eligibility pipeline inspect/verify use, plus
//              the seam-invariant-8 conflict-visibility guard. See lib/verbs/propose.mjs. (P3-T7)
//   batch    — runs inspect -> verify -> propose over the literal, hand-enumerated 4-pair list in
//              lib/batch.mjs's BATCH_PAIRS — never a directory glob or a "process everything under
//              runs/" pattern (multi-bundle-conversion-e1 Phase 2, row P2-T3, FR-5, R-7 mitigation).
//              Halts on the first pair that fails, naming it explicitly. See lib/batch.mjs.
//
//   aggregate — read-only rollup of the 4 named pairs' own per-bundle conversion-report.json (plus
//              each pair's committed unresolved.json / staged candidate-scaffolds.json, when
//              present) into one top-level multi-bundle-conversion-report.json under --out-base
//              (multi-bundle-conversion-e1 Phase 2, row P2-T4, FR-5). Never drives inspect/verify/
//              propose itself; every one of the 4 named pairs always gets a section, with explicit
//              0/[] defaults for whatever has not been produced yet (R-P2). See
//              lib/multi-bundle-report.mjs.
//
// Zero network calls, zero LLM/generative-model invocations, ever (FR-10, 02 §2.3 items 13-15).
// Never mutates the `rf` run directory (seam invariant 6).

import { run as runInspect } from './lib/verbs/inspect.mjs';
import { run as runVerify } from './lib/verbs/verify.mjs';
import { run as runPropose } from './lib/verbs/propose.mjs';
import { run as runBatch } from './lib/batch.mjs';
import { run as runAggregate } from './lib/multi-bundle-report.mjs';
import { ConverterError, EXIT_OK, EXIT_USAGE } from './lib/errors.mjs';

const VERB_HANDLERS = Object.freeze({
  inspect: runInspect,
  verify: runVerify,
  propose: runPropose,
  batch: runBatch,
  aggregate: runAggregate,
});

const HELP_TEXT = `rf-bundle-to-kb-pack — deterministic converter from a verified rf evidence bundle
to a staged CDS knowledge-base pack proposal (EF-WP0, 02 §4).

Usage:
  node tools/rf-bundle-to-kb-pack/cli.mjs <verb> [options]

Verbs:
  inspect --run-dir <dir> --module <module.json path>
      Read-only summary: artifact list, hashes, per-claim eligibility. Emits no pack output.

  verify --pack <dir> --rule-schema <schema path>
      Structural pre-check. Phase 2: validates loader/eligibility output only (no pack exists
      until Phase 3's propose runs).

  propose --run-dir <dir> --module <module.json path> --decisions <authoring-decisions.yaml>
          --out <build/kb-pack/... dir>
      Assembles a full staged kb-pack proposal at --out. Fails closed (governance exit) if any
      drafted rule proposal is grounded solely by a mixed/contradicted claim (seam invariant 8).

  batch [--rule-schema <schema path>] [--out-base <dir>]
      Runs inspect -> verify -> propose, in that order, for each of the 4 named
      {fixture, module} pairs hand-enumerated in lib/batch.mjs's BATCH_PAIRS (never a glob or a
      "process everything under runs/" pattern -- R-7 mitigation). Halts on the first pair whose
      any stage fails, naming the pair explicitly; already-succeeded pairs' output is untouched.

  aggregate [--out-base <dir>]
      Read-only rollup of the 4 named pairs' own conversion-report.json (plus unresolved.json /
      candidate-scaffolds.json, when present) into multi-bundle-conversion-report.json under
      --out-base. Every named pair always gets a section; a pair with no propose output yet is
      reported "not_available" with every count at its defined 0/[] default (R-P2). Never runs
      inspect/verify/propose itself -- always exits 0.

Global:
  -h, --help    Show this help and exit 0.

Exit codes (02 §5.2): 0 ok · 1 usage · 2 schema · 3 governance · 4 unsupported · 5 budget ·
6 adapter · 7 human-review. Codes 3 and 7 are never treated as ordinary failures.

This tool makes zero network calls and invokes no LLM/generative model at any point.
`;

/**
 * Minimal, dependency-free `--flag value` / `--bool-flag` parser. Kebab-case flag names are
 * converted to camelCase keys (`--run-dir` -> `runDir`). A flag followed by another flag (or by
 * nothing) is treated as a boolean `true` rather than consuming the next token as its value.
 *
 * @param {string[]} argv arguments after the verb
 * @returns {Record<string, string | boolean>}
 */
export function parseFlags(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new ConverterError(`unexpected positional argument "${token}"`, EXIT_USAGE);
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
 * Runs a single verb handler and maps its outcome to a process exit code (P2-T5, FR-11, 02 §5.2).
 * This is the converter's ONLY generic-error handler — no other catch site in this tool may
 * re-map a thrown `ConverterError`'s `exitCode`. A `ConverterError` (or subclass, e.g.
 * `GovernanceError`/`HumanReviewError`) always forwards its own fixed code verbatim; any other
 * thrown value (a genuine bug, not a taxonomy-mapped failure state) falls back to `EXIT_USAGE`
 * since none of the 8 taxonomy states is a natural fit for an unclassified crash.
 *
 * Exported (rather than inlined in `main`) specifically so P2-T5's error-taxonomy tests can drive
 * it with a synthetic handler and assert that GOVERNANCE (3) and HUMAN_REVIEW (7) reach this
 * function's `ConverterError` branch — never the generic `EXIT_USAGE` fallback below it — without
 * needing Phase 3's real verb logic to exist yet.
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
    // ConverterError subclasses (lib/errors.mjs) carry their own fixed exit code — forwarded
    // verbatim. GOVERNANCE (3) and HUMAN_REVIEW (7) MUST reach this point unaltered and MUST NOT
    // be remapped here; P2-T5 owns the tests proving that.
    if (err instanceof ConverterError) {
      process.stderr.write(`${err.name}: ${err.message}\n`);
      return err.exitCode;
    }
    // Unclassified/programmer error: no natural fit among the 8 taxonomy states, so this falls
    // back to USAGE (1) rather than inventing a 9th code.
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
    return err instanceof ConverterError ? err.exitCode : EXIT_USAGE;
  }

  return dispatchVerb(handler, options);
}

// Only run when invoked directly (`node cli.mjs ...`), not when imported (e.g. by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
