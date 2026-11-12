# Market observation

Started: 2026-11-12  
Release: v1.1.0

## Launch baseline

| Metric | Value |
|---|---|
| npm latest | 1.0.0 |
| market index | https://tomjerrygit.github.io/dsh-workspace-audit/index.json |
| GitHub release | v1.0.0 |
| GitHub stars / forks | 0 / 0 |
| GitHub open issues | 0 |
| Plugin hub submission | open (#751) |
| Hub comments | 7 (maintainer updates) |
| npm download stats | not available yet / 0 |
| Browser smoke | passing |
| Soak | 20 iterations, heap +2MB |

No telemetry is collected. All metrics come from public registries/GitHub or user reports.

## Weekly checklist

1. `node scripts/market-check.mjs`
2. `npm view @tomjerrygit/dsh-workspace-audit version dist-tags`
3. Check npm downloads:
   `https://api.npmjs.org/downloads/point/last-week/@tomjerrygit%2Fdsh-workspace-audit`
4. Check GitHub:
   - stars / forks
   - new issues
   - open PRs
   - release downloads (if assets)
5. Check plugin hub issue #751 state and comments.
6. Reproduce any reported install failure in a clean profile.
7. Verify market index still returns 1.2.0.
8. Run `node --test test/audit.test.mjs test/routes.test.mjs test/integration.test.mjs` and `node test/browser-smoke.mjs` before cutting a patch.

## What to watch

- install failures / activation errors
- scan hangs or memory growth on very large workspaces
- false P0 reports
- false negatives around secrets, self-hosted runners, GitHub states
- reports that users cannot understand
- requests for rules that should be configurable rather than hardcoded

## Triage

| Priority | Response |
|---|---|
| P0 security/data loss | private advisory, patch release within days |
| P1 crash / install / scan hang | reproduce, add fixture, patch release |
| P2 false positive/negative | add to backlog, fix with a test |
| P3 wording/layout | batch in next minor |

## Iteration triggers

Start v1.1 planning when any of these is true:

- a P0/P1 issue is confirmed
- 3+ reports of the same false positive
- install failure affects a supported platform
- users ask for the same configurable rule
- soak or browser smoke regresses

Until then, do not add features for the sake of activity. Fix trust and installability first.

## Feedback channels

- GitHub issue templates: bug report / feature request
- Private security advisories
- Plugin hub issue #751
- README and `docs/FEEDBACK.md`
