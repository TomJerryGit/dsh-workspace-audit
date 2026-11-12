# Scoring method

The score is a **project hygiene score**, not a measure of code quality.

1. The scanner detects a project type: `app`, `library`, `plugin`, or `data`.
2. Each type has a weight set over seven dimensions:
   - documentation
   - development
   - debugging
   - performance
   - functionality
   - security
   - github
3. Dimension points come from deterministic evidence: README/docs/LICENSE, manifests/lockfiles/CI/gitignore, test files, repository size/artifacts, static security patterns, Git metadata.
4. The weighted average is the raw score.
5. If any **active P0** risk remains, the final score is capped at **59**.
6. Ignored rules are removed from active risks. Accepted rules are moved to `acceptedRisks` and do not trigger the P0 cap until expiry.
7. Ignored/accepted rules add back the corresponding dimension points where a mapping exists (for example `self-hosted-pr` → security +40). Expired acceptance no longer applies.

## What the score cannot tell you

- Whether the architecture is sound
- Whether tests are meaningful
- Whether dependencies are license-compatible
- Whether a security finding is exploitable
- Whether a project is valuable

Use it as a triage and handover aid, not as a release gate or security certification.
