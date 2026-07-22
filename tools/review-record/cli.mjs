#!/usr/bin/env node
// tools/review-record/cli.mjs — entry point for the `review-record` CLI (Evidence Foundry E1,
// OQ-1/OQ-2/FR-1/FR-7). Task P2-T1: scaffold + store layout.
//
// This CLI is the deterministic, offline, git-tracked-file-backed tool for the ADR-0004 five-role
// review-record workflow. See ./README.md for the full internal module boundary (store / chain /
// roster / signature / render) each verb builds on, and which phase-2 task owns which piece.
//
// Verbs (OQ-1):
//   scaffold  — create a schema-valid draft record for a module+role. IMPLEMENTED (P2-T2) — see
//               lib/verbs/scaffold.mjs for the signature-gated write posture (why a synthetic
//               persona's draft prints a preview rather than being written to disk today).
//   validate  — validate one record / a module's full chain. IMPLEMENTED: schema shape + D-4
//               roster resolution + FR-4 reviewer-2 independence heuristic (P2-T2); FR-9/OQ-2
//               two-layer append-only enforcement -- previousRecordHash chain (always) + opt-in
//               --history git-history check (P2-T3); PRD OQ-5 authorship-union + FR-5/FR-6
//               adjudication/release-authorization validity (P2-T4); FR-10/OQ-2 Ed25519 signature
//               verification, TESTKEY- dry-run only, fail-closed on tamper (P2-T5).
//   list      — print per-module review state (records by role, chain linkage, synthetic flags).
//               IMPLEMENTED (P2-T1) — see lib/verbs/list.mjs.
//   render    — read-only static HTML render of a review chain. IMPLEMENTED (P2-T6) — see
//               lib/verbs/render.mjs / lib/render.mjs for the FR-8/FR-31/OQ-3 rendering logic.
//   dry-run   — full five-role synthetic dry-run cycle. IMPLEMENTED (P2-T8) — see
//               lib/verbs/dry-run.mjs for the scaffold -> sign -> chain-validate composition and
//               the expected structural FR-6 non-qualifying terminal state.
//   status    — derived review-chain state + next-expected role/terminal disposition. IMPLEMENTED
//               (Clinical Review Workflow v1, Phase 1, P1-T2, FR-1/FR-27/FR-28/FR-29) — see
//               lib/verbs/status.mjs for the frozen --json shape, the independence-preserving
//               redaction default (FR-27), and the fail-closed `invalid` state (FR-28).
//
// Zero network calls, zero LLM/generative-model invocations, ever (FR-7). No file in this tool
// imports `node:http`, `node:https`, `node:dgram`, `fetch`, or any AI/model SDK — see
// tests/ef-review-record-cli.test.mjs's structural + dynamic checks.

import { run as runScaffold } from './lib/verbs/scaffold.mjs';
import { run as runValidate } from './lib/verbs/validate.mjs';
import { run as runList } from './lib/verbs/list.mjs';
import { run as runRender } from './lib/verbs/render.mjs';
import { run as runDryRun } from './lib/verbs/dry-run.mjs';
import { run as runStatus } from './lib/verbs/status.mjs';
import { CliError, EXIT_OK, EXIT_USAGE } from './lib/errors.mjs';

const VERB_HANDLERS = Object.freeze({
  scaffold: runScaffold,
  validate: runValidate,
  list: runList,
  render: runRender,
  'dry-run': runDryRun,
  status: runStatus,
});

const HELP_TEXT = `review-record — offline, deterministic CLI for the ADR-0004 five-role
review-record workflow (Evidence Foundry E1, OQ-1/OQ-2/FR-1/FR-7).

Usage:
  node tools/review-record/cli.mjs <verb> [options]

Verbs:
  scaffold --module <id> --role <role> --subject <content-hash> --reviewer-id <id>
           --decision <approve|reject|request-changes> --rationale <text>
           [--reviewed-at <iso>] [--supersedes <review_id>] [--root <dir>]
      Build a schema-shaped draft record for one of the five roles. reviewerId must resolve
      against governance/reviewer-roster.yaml (unknown identity / out-of-scope module both fail
      closed, FR-3). If the resolved roster entry is synthetic (the only case that can currently
      exist pre-G1), the draft is PRINTED as a preview and NOT written — it needs a TESTKEY-
      signature (P2-T5/P2-T8) first. IMPLEMENTED (P2-T2).

  validate --module <id> [--root <dir>] [--record <review_id>] [--history]
      Validate a module's committed records. IMPLEMENTED: per-record schema shape, D-4 roster
      resolution, the FR-4 reviewer-2 independence heuristic (P2-T2), the FR-9/OQ-2 two-layer
      append-only check (P2-T3) -- (a) previousRecordHash chain recomputation, ALWAYS run, and
      (b) an opt-in git-history append-only check (--history) that rejects any commit-visible
      mutation or deletion of an existing modules/<id>/reviews/*.yaml path (requires --root to be
      inside a real git working tree) -- PRD OQ-5 authorship-union + FR-5/FR-6 adjudication/
      release-authorization validity (P2-T4), and FR-10/OQ-2 Ed25519 signature verification,
      TESTKEY- dry-run only, fail-closed on tamper (P2-T5, IMPLEMENTED).

  list --module <id> [--root <dir>]
      Print a structured per-module review-record state summary: records by role, informational
      chain-linkage status, synthetic flags. Read-only. IMPLEMENTED (P2-T1).

  render --module <id> [--record <review_id>] [--root <dir>] [--out <dir>]
      Read-only static HTML render of the passage -> decision -> rule -> test chain to
      build/review-render/<module_id>/ (gitignored; --out overrides). NOT a portal: no server,
      database, write path, auth, <script>, or third-party/remote asset. Every page carries the
      unvalidated-research-prototype banner and per-record non-qualifying labels for synthetic
      content; rights-restricted passages (FR-31) render as hash + selector reference blocks,
      never inline text. IMPLEMENTED (P2-T6).

  dry-run [--module <id>] [--subject <content-hash>] [--reviewed-at <iso>] [--root <dir>]
      Full five-role synthetic dry-run cycle (scaffold -> sign -> chain-validate, ADR-0004 role
      order) over ONE subjectContentHash shared by all five records. --module defaults to
      "cbc_suite_v1" (this task's binding scope, FR-11); --subject defaults to a real SHA-256
      computed over the target module's own committed content (lib/subject.mjs) when omitted.
      Resolves five clearly-labeled, synthetic:true, NON-CREDENTIALED personas against
      governance/reviewer-roster.yaml (P2-T8's own added entries for cbc_suite_v1) — see
      lib/verbs/dry-run.mjs's DRY_RUN_PERSONAS. Refuses to run (fails closed) over a module that
      already has any committed review record — append-only, one-time act, never a re-run. The
      final (release-auth) write always trips ONE expected, structural FR-6 non-qualifying
      finding ("this entire record set is synthetic:true") — this is the correct terminal state,
      not a dry-run failure; any OTHER validation finding at any step still fails closed.
      IMPLEMENTED (P2-T8).

  status --module <id> [--root <dir>] [--json] [--history] [--unredacted]
      Derived review-chain state + next-expected role from a module's committed records, computed
      via the ONE shared derived-state library (lib/derived-state.mjs). --json emits the frozen
      shape { moduleId, subjectContentHash, records[], derivedState, nextExpectedRole, blockers[] }
      whose derivedState enum is not-started | in-progress | disputed | structurally-non-qualifying
      | acts-complete-unauthorized | invalid -- NEVER a release-ready-like label (FR-29): the
      all-real terminal state names only that the five-role act set is structurally complete,
      chain-valid, and roster-verified, not that any release authorization occurred. By default,
      reviewerId/decision/rationale of an independence-sensitive sibling record are REDACTED in both
      human and --json output while independence still matters (FR-27); --unredacted lifts this and
      prints a visible warning (adjudicator/release-authorizer use only). status exits non-zero with
      derivedState "invalid" whenever validate would reject the same input (FR-28) -- schema shape,
      D-4 roster resolution, chain break, signature tamper, or (with --history) an append-only
      git-history failure; --history is opt-in, matching validate's own default. IMPLEMENTED
      (Clinical Review Workflow v1, Phase 1, P1-T2).

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
