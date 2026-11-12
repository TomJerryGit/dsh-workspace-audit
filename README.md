# @tomjerrygit/dsh-workspace-audit

Local-first workspace health audit for DeepSeek Harness. Read-only by design; no code is uploaded and no LLM call is required.

## What it checks

- Git: repository, remote, branch, dirty count, last commit, tags
- Project: README, LICENSE, .gitignore, manifests, lockfiles, tests, docs, CI
- Dependencies: manifests/lockfiles, unpinned requirements, `npm audit`/`pip-audit` when available
- GitHub: latest release vs local tag, open issues, archived state, branch protection (public repos)
- Onboarding: inferred install/test/run commands (`npm test`, `pytest`, `cargo test`, etc.)
- Size: source/scan size and known build/cache directories
- Security hotspots: self-hosted runner triggered by `pull_request`, suspected key filenames (names only), `shell=True`/`exec`/`pickle.load` patterns
- Score v2: weighted by detected project type (app/library/plugin/data), with per-dimension deductions; P0 caps the total at 59.
- Dependency audit is **offline by default**; `npm audit`/`pip-audit`/`pnpm audit`/`yarn audit`/`cargo audit` and GitHub API run only after explicitly enabling network checks.
- Workspace-specific `.workspace-audit.json` supports ignore rules, accepted risks, expiry dates, and project-type overrides.
- Baseline snapshots and background scan jobs with progress/cancel.
- Bilingual (Chinese/English) UI, reports, risk explanations, and handover documents.
- Markdown/HTML/print-to-PDF exports and an average-score trend chart.
- P0 findings cap the overall score at 59 so a high raw score cannot hide a blocking risk.
- Git commands run with `core.fsmonitor=false` and `core.untrackedCache=false`; untracked secret filenames are included.
- Failures, Git availability, scan duration, and offline state are shown in the panel.
- Risks: P0/P1/P2 list, risk filters, project comparison table, score history sparkline, HTML export, and a Markdown handover report

## Documentation

- [Privacy & data flow](docs/PRIVACY.md)
- [Compatibility matrix](docs/COMPATIBILITY.md)
- [API](docs/API.md)
- [Scoring method](docs/SCORING.md)
- [Release checklist](docs/RELEASE.md)
- [Feedback guide](docs/FEEDBACK.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## Workspace configuration

Create `.workspace-audit.json` in a project root:

```json
{
  "projectType": "app",
  "ignore": ["todo", "branch-protection"],
  "accept": [
    { "rule": "self-hosted-pr", "reason": "internal runner only", "until": "2026-12-31" }
  ]
}
```

- `ignore` hides a rule from active risks.
- `accept` keeps the risk in the report but removes it from active risks and the P0 cap.
- `until` is optional; after that date the acceptance expires.
- `projectType` can be `app`, `library`, `plugin`, or `data`.

## Baseline and scan jobs

- **Set baseline** stores the current scores and active risk IDs.
- Later scans show score delta, new risks, and resolved risks.
- Scans start as background jobs; the panel shows completed/total progress and a cancel button.
- Partial results are returned when a scan is cancelled.

## Handover, reports and localization

- **Download handover**: generates `START_HERE.md` with run/test commands, files to read first, and current risks.
- **Markdown / HTML export**: localized report and comparison table.
- **Export PDF**: opens a print-ready report; use the browser's Save as PDF.
- **Average score trend**: chart over saved scan history.
- **Chinese/English**: UI labels, dimensions, risk text, reports, and handover documents follow the browser locale.

## Tests

```sh
node --test test/audit.test.mjs
node test/browser-smoke.mjs
```

The unit suite uses a self-contained fixture workspace (`test/fixtures/basic`) and checks scanning, secrets, workflow risk, dependency health, report rendering, GitHub classification, and grading. The browser smoke boots the real `client.js` with local React UMD files, then checks rendering, risk filters, failures and export controls without network access.

## Install

```sh
dsh plugin --profile web add @tomjerrygit/dsh-workspace-audit
```

Market index:

```text
https://tomjerrygit.github.io/dsh-workspace-audit/index.json
```

## Usage

Open **Workspace Audit** in the left sidebar, add workspace paths if needed, and run the audit. The report can be copied or downloaded as Markdown.

> This is an engineering hygiene check, not a professional security audit. Suspected secret files are reported by filename only; contents are not read.
