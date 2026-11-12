# @tomjerrygit/dsh-workspace-audit

Local-first workspace health audit for DeepSeek Harness. Read-only by design; no code is uploaded and no LLM call is required.

## What it checks

- Git: repository, remote, branch, dirty count, last commit, tags
- Project: README, LICENSE, .gitignore, manifests, lockfiles, tests, docs, CI
- Size: source/scan size and known build/cache directories
- Security hotspots: self-hosted runner triggered by `pull_request`, suspected key filenames (names only), `shell=True`/`exec`/`pickle.load` patterns
- Risks: P0/P1/P2 list and a Markdown handover report

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
