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
- P0 findings cap the overall score at 59 so a high raw score cannot hide a blocking risk.
- Git commands run with `core.fsmonitor=false` and `core.untrackedCache=false`; untracked secret filenames are included.
- Failures, Git availability, scan duration, and offline state are shown in the panel.
- Risks: P0/P1/P2 list, risk filters, project comparison table, score history sparkline, HTML export, and a Markdown handover report

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
