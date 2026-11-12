# API

Base path: `/api/workspace-audit`

All protected routes require header:

```text
x-workspace-audit-token: <token>
```

Get the token from the loopback-only auth endpoint.

## GET /auth

Returns `{ token }`. Rejects non-loopback requests with 403.

## POST /scan/start

Starts a background scan. Returns HTTP 202:

```json
{ "jobId": "...", "total": 9 }
```

## GET /scan/status?jobId=...

Returns:

```json
{
  "jobId": "...",
  "state": "running|done|cancelled|error",
  "progress": { "completed": 4, "total": 9 },
  "result": null,
  "error": null
}
```

When finished, `result` contains workspaces, failures, report, reportEn, handover, handoverEn, baseline, and settings.

## POST /scan/cancel

Body `{ "jobId": "..." }`. Requests cancellation. In-flight workspace scans finish; no new workspaces start.

## GET /scan

Synchronous legacy scan for compatibility; prefer the job API.

## GET /history

Returns the last 30 score snapshots.

## GET /baseline

Returns the saved baseline.

## POST /baseline

Body:

```json
{
  "workspaces": [
    { "path": "D:\\Project", "score": 80, "riskIds": ["dirty"], "dimensions": {} }
  ]
}
```

Use `{ "action": "clear" }` to clear.

## GET /settings

Returns `{ settings, workspaces }`.

## POST /settings

- Add roots: `{ "add": "D:\\Project" }`
- Add multiple: `{ "roots": ["D:\\A", "D:\\B"] }`
- Toggle network: `{ "online": true }`

## GET /health

Returns plugin uptime, memory, job/cache counts, history and baseline sizes.
