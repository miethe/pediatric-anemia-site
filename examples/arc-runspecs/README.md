# ARC RunSpec fixtures

Reviewed `CouncilRunSpec` inputs for `pediatric-anemia-clinical-review-council`,
kept in this repository because the **targets** live here even though ARC run
records always live in the `agentic-research` checkout.

They live under `examples/` beside the other synthetic fixtures rather than under
`docs/`, because they are executable inputs handed to a tool — not prose — and
they are not product code, so they belong with the repository's other example
inputs.

| Fixture | Target class | Target |
|---|---|---|
| `local-profile-charter-repository-artifact.runspec.yaml` | `repository_artifact` | `docs/clinical/local-profile-charter-contract.md` |
| `local-profile-negative-cases-synthetic-scenario.runspec.yaml` | `synthetic_scenario_specification` | `tests/fixtures/local-profile/negative-cases.json` |
| `spike-006-kb-integrity-governance.runspec.yaml` | `repository_artifact` | `docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md` |
| `spike-005-rq2-decision-function.runspec.yaml` | `repository_artifact` | `docs/project_plans/SPIKEs/spike-005-semantic-diff-classification.md` |

The third and fourth fixtures are not dry-run demos: both were **executed** on 2026-07-19/20 to close
the `council-review` pass their own SPIKEs' exit criteria require.

- SPIKE-006 / OQ-8 (exit criterion (2), Method step 4) — run bundle
  `agentic-research/runs/2026-07-19-spike-006-kb-integrity-governance/`.
- SPIKE-005 / OQ-7 (exit criterion (2), Method step 5) — run bundle
  `agentic-research/runs/2026-07-19-spike-005-rq2-decision-function/`. Verdict: pediatric council
  recommendation `rejected` for RQ2's decision function *as written*; scorecard
  `pause_and_validate`; 5 critical and 15 high findings accepted, 2 rejected, 1 dissent preserved,
  1 seat abstention preserved.

Both bind `target_sha256` to the **pre-amendment** SPIKE at commit `e69d307`, which is what was
reviewed; the amendments each run produced land afterwards, so re-review requires a fresh digest.
Neither verdict is clinical validation or credentialed approval. Note that the shipped `arc` shim
does not resolve `pediatric-anemia-clinical-review-council`; scaffold with `uv run arc` from the
`agentic-research` checkout.

All four validate against `repo:agentic-research/schemas/council-run-spec.schema.json`,
bind the council by name and the evidence manifest by digest, and contain **no
absolute path**. Targets are named with the portable
`repo:pediatric-anemia-site/<relative-path>` locator (ARC ADR-0004), which
resolves through an operator-local approved-roots registry on whichever machine
runs `arc`.

## Prerequisite (once per machine, human-approved)

```bash
arc roots add pediatric-anemia-site "$PEDIATRIC_REPO"
```

## Running them

See "Reproduce the dry run end to end" in
[`../../docs/project_plans/expansion/03-arc-clinical-council-handoff.md`](../../docs/project_plans/expansion/03-arc-clinical-council-handoff.md).

The AOS dispatch rules for these specs are in
[`../../docs/project_plans/expansion/04-aos-arc-invocation-contract.md`](../../docs/project_plans/expansion/04-aos-arc-invocation-contract.md).

## What a dry run does and does not do

`arc run --dry-run` previews and schema-validates the spec. **It does not resolve
the target**: an unregistered alias, a wrong `target_sha256`, and an absolute
target all still report `ok: true` at preview. Fail-closed target resolution
happens at skeleton creation (`arc run` without `--dry-run`), before any run
directory is committed. Treat a green dry run as "the spec parses", not "the
target resolves".

Neither path executes a reviewer. Nothing here produces a finding, a scorecard
verdict, a credentialed review, a clinical validation, or a certification.
