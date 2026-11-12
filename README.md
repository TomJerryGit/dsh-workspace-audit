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
- Risks: P0/P1/P2 list, risk filters, project comparison table, score history sparkline, HTML export, and a Markdown handover report

## Tests

```sh
node --test test/audit.test.mjs
```

The test suite uses a self-contained fixture workspace (`test/fixtures/basic`) and checks Git scanning, secret filename detection, workflow risk detection, dependency health, report rendering, GitHub remote parsing, and grading.

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
