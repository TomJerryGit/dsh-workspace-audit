# Security policy

## Supported versions

Security fixes target the latest `1.x` release.

## Reporting a vulnerability

Please use GitHub private security advisories:

https://github.com/TomJerryGit/dsh-workspace-audit/security/advisories/new

Do not open a public issue with exploit details, tokens, or private repository data.

Useful details:

- plugin version
- DSH version and OS
- whether network checks were enabled
- whether Git was available
- a minimal reproduction without secrets

## Scope

Relevant areas include:

- auth/token exposure
- Git command injection or unsafe repository config handling
- path traversal or unintended file writes
- secret filename handling (contents must never be read)
- network requests beyond documented opt-in checks
- XSS in HTML/report exports

## Out of scope

- Findings that only work after a user manually disables documented safety behavior
- The fact that heuristics can produce false positives
- Issues requiring a compromised local machine
