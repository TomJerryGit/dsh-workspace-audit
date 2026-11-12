# Compatibility matrix

| Platform | Unit tests | Browser smoke | Real scan | Notes |
|---|---|---|---|---|
| Windows 10 (build 19041) | ✅ | ✅ Edge | ✅ | local verification |
| Windows 11 | expected | expected | expected | not separately tested |
| Ubuntu (GitHub Actions) | ✅ | not run | via CI fixtures | Git required for full scan |
| macOS | not run | not run | not run | treat as untested |

## Runtime

| Component | Tested |
|---|---|
| Node.js | 24.x (local and CI) |
| DeepSeek Harness desktop | 0.2.2-rc.1 local |
| Plugin manifest engines | `dsh >=0.2.0-rc.2` |
| Git | 2.x; full Git checks require it |
| Edge/Chrome | headless Edge/Chrome for browser smoke |

## Degraded modes

- **Git unavailable**: scan continues; Git-dependent checks are skipped and `no-git` risk is reported.
- **Network disabled** (default): npm/pip/pnpm/yarn/cargo audits and GitHub API are skipped; scan stays local.
- **GitHub API unavailable/rate-limited**: status is reported as `rate_limited` or `error`; it is not treated as “unprotected”.
- **Missing audit tool**: dependency status is `skipped`, never “0 vulnerabilities”.
- **Cancelled scan**: partial results are returned; history is not appended for cancelled scans.

## Known untested areas

- macOS filesystem/Git behavior
- very large monorepos (>50k files) beyond the per-workspace scan caps
- private GitHub repositories without a token
- Linux browser smoke

See [PRIVACY.md](PRIVACY.md) and [RELEASE.md](RELEASE.md).
