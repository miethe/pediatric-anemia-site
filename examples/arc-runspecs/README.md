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

Both validate against `repo:agentic-research/schemas/council-run-spec.schema.json`,
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
