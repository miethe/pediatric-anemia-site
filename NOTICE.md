# Notice

This repository is a research prototype and is provided without warranty. It has not been clinically validated, cleared, or approved for diagnosis or treatment. Use in patient care requires independent clinical, regulatory, security, privacy, and quality-system review.

Clinical source copyrights remain with their respective publishers and organizations. This package stores citations and paraphrased rule provenance, not full copyrighted source text.

## Rights and evidence provenance

Every cited source's rights status is tracked in the top-level `rights/` tree
(`rights/rights-records.json`, `rights/rights-failures.json`, `rights/rights-ledger.json`), scoped
against the single declared release context in `rights/release-context.json`
(`commercial: false`, `use_type: internal_research`) — see `docs/architecture.md` §7 for the
substrate as shipped. **No source cited by this repository has been cleared, licensed, or approved
for any use beyond that declared internal-research scope.** Every seeded `rights_record` sits at
`overall_status: UNKNOWN`; no code path in this repository is authorized to write a `CLEARED_*`
status, a human reviewer identity, or any other approval or clearance — that requires a named
rights owner who does not yet exist. The automated checks over this tree (`npm run validate` →
`scripts/validate-rights.mjs`) confirm internal coverage and consistency only; none of them
determines, implies, or records that anything has actually been cleared, licensed, or approved.
