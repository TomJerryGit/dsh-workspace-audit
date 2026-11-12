# Privacy & data flow

## Local by default

- The plugin scans local workspace paths with read-only filesystem access and read-only Git commands.
- No code or repository contents are uploaded.
- Secret detection only inspects **file names**; secret file contents are never read.
- The Host auth token is accepted only from loopback (`127.0.0.1`/`::1`).

## Local data written

| Path | Purpose |
|---|---|
| `$DSH_HOME/workspace-audit/settings.json` | workspace roots and online/offline preference |
| `$DSH_HOME/workspace-audit/history.json` | score snapshots, last 30 scans |
| `$DSH_HOME/workspace-audit/baseline.json` | optional baseline scores/risk IDs |

Project-level `.workspace-audit.json` is read, never written.

## Network checks (opt-in)

Network checks are **off by default**. When the user enables “Allow network checks”, these may run:

| Feature | Endpoint | Data sent |
|---|---|---|
| npm audit | registry.npmjs.org | package/lock metadata |
| pnpm/yarn audit | their registries | package/lock metadata |
| cargo audit | RustSec advisory source | crate metadata |
| pip-audit | vulnerability source | requirement file packages |
| GitHub health | api.github.com | owner/repo, optional token |

No file contents are sent by the audit itself. Disable online checks to keep the scan fully offline.

## AI / LLM

The plugin makes no LLM calls and does not use subagents. Scoring and reports are deterministic heuristics.

## Retention

History and baseline remain until the user clears them or removes the plugin data directory. Uninstalling the plugin does not automatically delete `$DSH_HOME/workspace-audit`. Delete that directory manually if desired.

## Limitations

This is an engineering hygiene check, not a professional security audit. It can produce false positives and false negatives; review findings before acting.
