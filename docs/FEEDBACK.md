# Feedback guide

## Where to report

- Bug: GitHub issue template
- Feature: GitHub issue template
- Security: private advisory (`SECURITY.md`)
- Plugin market listing: dshplugin/dsh-plugin-hub issue #751

## What to include

- plugin version, DSH version, OS, Git availability
- offline or online mode
- workspace type and approximate size
- command/output or screenshot, with secrets removed
- whether the issue reproduces after a fresh scan

## Triage rules

| Priority | Examples |
|---|---|
| P0 | token exposure, unintended file write, unsafe Git config execution |
| P1 | crash, install failure, scan hangs, wrong P0 verdict |
| P2 | false positive/negative, missing rule, export issue |
| P3 | wording, layout, extra metric |

## Market observation metrics

- npm weekly downloads
- GitHub stars / forks / issues
- Hub issue state and comments
- install failures reported
- top repeated false positives
- share of users enabling network checks

No telemetry is collected by the plugin; all metrics are public registry/GitHub data or user-reported.
