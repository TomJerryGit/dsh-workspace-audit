import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const home = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-audit-integration-'));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-audit-integration-fixture-'));
process.env.DSH_HOME = home;
await fs.mkdir(path.join(home, 'storages'), { recursive: true });
await fs.cp(path.join(here, 'fixtures', 'basic'), root, { recursive: true });
execFileSync('git', ['init', '-q'], { cwd: root });
execFileSync('git', ['config', 'user.email', 'integration@example.com'], { cwd: root });
execFileSync('git', ['config', 'user.name', 'Integration'], { cwd: root });
execFileSync('git', ['add', '-A', '-f'], { cwd: root });
execFileSync('git', ['commit', '-q', '-m', 'integration'], { cwd: root });
await fs.writeFile(path.join(home, 'storages', 'workspace.json'), JSON.stringify({ tables: { workspaces: { a: { path: root, sessionIds: [] } } } }));

const mod = await import('../index.js');
const routes = new Map();
mod.apply({
  effect(fn) { fn(); return () => {}; },
  get() { return undefined; },
  webServer: { register({ path: name, handler }) { routes.set(name, handler); } },
});

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  let match = '';
  for (const key of routes.keys()) {
    if (pathname === key || pathname.startsWith(key + '/')) {
      if (key.length > match.length) match = key;
    }
  }
  const handler = routes.get(match);
  if (!handler) { res.writeHead(404); res.end('not found'); return; }
  await handler(req, res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;

test('HTTP integration: auth → start → status → completed scan', async () => {
  const auth = await (await fetch(base + '/api/workspace-audit/auth')).json();
  assert.ok(auth.token.length > 10);
  const headers = { 'x-workspace-audit-token': auth.token, 'content-type': 'application/json' };
  const started = await (await fetch(base + '/api/workspace-audit/scan/start', { method: 'POST', headers, body: '{}' })).json();
  assert.ok(started.jobId);
  let status = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    status = await (await fetch(base + '/api/workspace-audit/scan/status?jobId=' + encodeURIComponent(started.jobId), { headers })).json();
    if (status.state !== 'running') break;
  }
  assert.ok(['done', 'cancelled'].includes(status.state), JSON.stringify(status));
  assert.ok(status.result.workspaces.length >= 1);
  assert.ok(status.result.report.includes('工作区体检报告'));
  assert.ok(status.result.reportEn.includes('Workspace Audit Report'));
  assert.ok(status.result.handover.includes('START HERE'));
});

after(async () => {
  server.close();
  await fs.rm(root, { recursive: true, force: true }).catch(() => {});
  await fs.rm(home, { recursive: true, force: true }).catch(() => {});
});
