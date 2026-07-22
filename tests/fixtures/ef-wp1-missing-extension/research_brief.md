# Synthetic Research Brief (EF-WP1 test fixture)

This is a synthetic, test-only research brief for `tests/fixtures/ef-wp1-missing-extension/`. It
is not derived from a real `rf` run. It exists solely so that
`tools/rf-bundle-to-kb-pack/lib/loader.mjs` has a well-formed `research_brief` artifact to
resolve while `tests/ef-wp1-eligibility.test.mjs` exercises the EF-WP1 structural pre-flight gate
(`tools/rf-bundle-to-kb-pack/lib/eligibility.mjs`).
