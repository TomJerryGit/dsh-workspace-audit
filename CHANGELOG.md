# Changelog

## v1.2.0

- JSON scan export for CI/integrations
- “Report false positive” link prefilled to the GitHub issue template
- HTTP Host integration test (auth → job start → status → report)
- `market:check` script for npm/GitHub/Hub public metrics
- Test count now 15 across unit, route, and integration suites

## v1.1.0

- Detect ignored/nested secret filenames via bounded filesystem scan (still filename-only)
- Project-type detection handles PyQt/PySide desktop apps and pyproject app entry points
- Git cache refreshes dirty status on every scan instead of relying on root mtime
- GitHub Search API status is visible (`rate_limited` / `error` / `unavailable`)
- Dependency audit aggregates npm/pnpm/yarn/cargo/pip results instead of stopping at the first lockfile
- HTML export is fully localized; table headers, dimensions and risk text follow locale
- Accepted/ignored risks adjust mapped dimension points
- Artifact size has a larger performance penalty
- Added route/job/baseline/health tests and a Git fsmonitor hardening regression check
- Health endpoint reads version from package.json
- SECURITY.md included in the npm package
- README explicitly scopes 1.1 stable support to Windows/Linux; macOS remains experimental

## v1.0.0

First stable release.

- Deterministic local workspace health scan (Git, docs, tests, CI, size, security hotspots)
- Read-only Git execution with `core.fsmonitor=false`
- Offline by default; opt-in npm/pnpm/yarn/cargo/pip audits and GitHub API
- P0/P1/P2 findings, project-type weighted scoring, score deductions, P0 score cap
- Nested Git repository discovery, failure/offline/Git availability visibility
- `.workspace-audit.json` ignore/accept rules with expiry and project-type override
- Background scan jobs with progress and cancel
- Baseline snapshots with new/resolved risks
- Chinese/English reports, START_HERE handover, HTML and print-to-PDF exports
- Real-browser smoke test and Windows/Ubuntu CI
- Privacy, compatibility, API, scoring, and release documentation

## v0.7.0

Handover docs, average-score trend chart, HTML/PDF export, bilingual reports.

## v0.6.0

Workspace config ignore/accept, baseline, progress/cancel.

## v0.5.0

Weighted scoring v2, multi-ecosystem audit, GitHub health, browser smoke.

## v0.4.0

Trusted scanner: fsmonitor hardening, untracked secrets, offline default, P0 cap, CI.

## v0.3.0

Onboarding commands, history sparkline, HTML export.

## v0.2.0

Tests/fixtures, dependency/GitHub checks, risk filters, trends.

## v0.1.0

Initial public workspace-audit plugin.
