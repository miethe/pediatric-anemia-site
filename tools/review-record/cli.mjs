#!/usr/bin/env node
// tools/review-record/cli.mjs — entry point for the `review-record` CLI (Evidence Foundry E1,
// OQ-1/OQ-2/FR-1/FR-7). Task P2-T1: scaffold + store layout.
//
// This CLI is the deterministic, offline, git-tracked-file-backed tool for the ADR-0004 five-role
// review-record workflow. See ./README.md for the full internal module boundary (store / chain /
// roster / signature / render) each verb builds on, and which phase-2 task owns which piece.
//
// Verbs (OQ-1):
//   scaffold  — create a schema-valid draft record for a module+role. NOT YET IMPLEMENTED (P2-T2).
//   validate  — validate one record / a module's full chain. NOT YET IMPLEMENTED (P2-T3..T5, added
//               incrementally: chain / adjudication / signature).
//   list      — print per-module review state (records by role, chain linkage, synthetic flags).
//               IMPLEMENTED (P2-T1, this task) — see lib/verbs/list.mjs.
//   render    — read-only static HTML render of a review chain. NOT YET IMPLEMENTED (P2-T6).
//   dry-run   — full five-role synthetic dry-run cycle. NOT YET IMPLEMENTED (P2-T8).
//
// Zero network calls, zero LLM/generative-model invocations, ever (FR-7). No file in this tool
// imports `node:http`, `node:https`, `node:dgram`, `fetch`, or any AI/model SDK — see
// tests/ef-review-record-cli.test.mjs's structural + dynamic checks.

import { run as runScaffold } from './lib/verbs/scaffold.mjs';
import { run as runValidate } from './lib/verbs/validate.mjs';
import { run as runList } from './lib/verbs/list.mjs';
import { run as runRender } from './lib/verbs/render.mjs';
import { run as runDryRun } from './lib/verbs/dry-run.mjs';
import { CliError, EXIT_OK, EXIT_USAGE } from './lib/errors.mjs';

const VERB_HANDLERS = Object.freeze({
  scaffold: runScaffold,
  validate: runValidate,
  list: runList,
  render: runRender,
  'dry-run': runDryRun,
});

const HELP_TEXT = `review-record — offline, deterministic CLI for the ADR-0004 five-role
review-record workflow (Evidence Foundry E1, OQ-1/OQ-2/FR-1/FR-7).

Usage:
  node tools/review-record/cli.mjs <verb> [options]

Verbs:
  scaffold --module <id> --role <role> --subject <content-hash>
      Create a schema-valid draft record for one of the five roles. NOT YET IMPLEMENTED — lands
      in P2-T2 (roster resolution + reviewer-2 structural independence).

  validate [--record <path>] [--module <id>] [--history]
      Validate one record, or a module's full chain. NOT YET IMPLEMENTED — chain checking lands in
      P2-T3, adjudicator/authorship checking in P2-T4, signature verification in P2-T5.

  list --module <id> [--root <dir>]
      Print a structured per-module review-record state summary: records by role, informational
      chain-linkage status, synthetic flags. Read-only. IMPLEMENTED (P2-T1).

  render --module <id> [--record <review_id>]
      Read-only static HTML render of a review chain to build/review-render/ (gitignored).
      NOT YET IMPLEMENTED — lands in P2-T6.

  dry-run --module <id> --subject <content-hash>
      Full five-role synthetic dry-run cycle (scaffold -> sign -> chain-validate). NOT YET
      IMPLEMENTED — lands in P2-T8.

Global:
  -h, --help    Show this help and exit 0.

This CLI makes zero network calls and invokes no LLM/generative model at any point. No task or
agent gate (G0-G4) is cleared, advanced, or asserted by any command below.
`;

/**
 * Minimal, dependency-free `--flag value` / `--bool-flag` parser (matches
 * `tools/rf-bundle-to-kb-pack/cli.mjs`'s own parser exactly — this repo's established convention).
 * Kebab-case flag names convert to camelCase keys (`--run-dir` -> `runDir`). A flag followed by
 * another flag (or by nothing) is treated as boolean `true` rather than consuming the next token.
 *
 * @param {string[]} argv arguments after the verb
 * @returns {Record<string, string | boolean>}
 */
export function parseFlags(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new CliError(`unexpected positional argument "${token}"`, EXIT_USAGE);
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
 * Runs a single verb handler and maps its outcome to a process exit code. Every thrown
 * `CliError` (or subclass, e.g. `NotImplementedError`) forwards its own fixed `exitCode` verbatim;
 * any other thrown value (a genuine bug, not a taxonomy-mapped failure) falls back to `EXIT_USAGE`.
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
    if (err instanceof CliError) {
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
    return err instanceof CliError ? err.exitCode : EXIT_USAGE;
  }

  return dispatchVerb(handler, options);
}

// Only run when invoked directly (`node cli.mjs ...`), not when imported (e.g. by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
