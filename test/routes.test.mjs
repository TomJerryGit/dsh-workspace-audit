import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const home = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-audit-routes-'));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-audit-route-fixture-'));
process.env.DSH_HOME = home;
await fs.mkdir(path.join(home, 'storages'), { recursive: true });
await fs.cp(path.join(here, 'fixtures', 'basic'), root, { recursive: true });
execFileSync('git', ['init', '-q'], { cwd: root });
execFileSync('git', ['config', 'user.email', 'routes@example.com'], { cwd: root });
execFileSync('git', ['config', 'user.name', 'Routes'], { cwd: root });
execFileSync('git', ['add', '-A', '-f'], { cwd: root });
execFileSync('git', ['commit', '-q', '-m', 'routes'], { cwd: root });
await fs.writeFile(path.join(home, 'storages', 'workspace.json'), JSON.stringify({ tables: { workspaces: { a: { path: root, sessionIds: [] } } } }));
const mod = await import('../index.js');
const routes = new Map();
const fakeCtx = {
  effect(fn) { fn(); return () => {}; },
  get() { return undefined; },
  webServer: { register({ path: name, handler }) { routes.set(name, handler); } },
};
mod.apply(fakeCtx);

function response() {
  return {
    statusCode: 0,
    body: '',
    headers: {},
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    end(chunk) { this.body += chunk ? String(chunk) : ''; },
  };
}

async function request(routePath, method = 'GET', token = '', body, url) {
  const handler = routes.get(routePath);
  assert.ok(handler, 'route registered: ' + routePath);
  const payload = body === undefined ? '' : JSON.stringify(body);
  const req = Object.assign(Readable.from(payload ? [Buffer.from(payload)] : []), {
    method,
    url: url || routePath,
    headers: { 'x-workspace-audit-token': token, 'content-type': 'application/json' },
    socket: { remoteAddress: '127.0.0.1' },
  });
  const res = response();
  await handler(req, res);
  let parsed = null;
  try { parsed = res.body ? JSON.parse(res.body) : null; } catch (error) { parsed = res.body; }
  return { status: res.statusCode, json: parsed };
}

const authPath = '/api/workspace-audit/auth';
const startPath = '/api/workspace-audit/scan/start';
const statusPath = '/api/workspace-audit/scan/status';
const cancelPath = '/api/workspace-audit/scan/cancel';
const settingsPath = '/api/workspace-audit/settings';
const baselinePath = '/api/workspace-audit/baseline';
const healthPath = '/api/workspace-audit/health';

test('routes: auth, health, settings and baseline', async () => {
  const auth = await request(authPath);
  assert.equal(auth.status, 200);
  const token = auth.json.token;
  assert.ok(token.length > 10);

  const health = await request(healthPath, 'GET', token);
  assert.equal(health.status, 200);
  const pkg = JSON.parse(await fs.readFile(path.join(here, '..', 'package.json'), 'utf8'));
  assert.equal(health.json.version, pkg.version);
  assert.ok(health.json.memoryMB.rss > 0);

  const settings = await request(settingsPath, 'GET', token);
  assert.equal(settings.status, 200);
  assert.ok(Array.isArray(settings.json.workspaces));

  const saved = await request(baselinePath, 'POST', token, { workspaces: [{ path: root, score: 50, riskIds: ['dirty'] }] });
  assert.equal(saved.status, 200);
  const baseline = await request(baselinePath, 'GET', token);
  assert.equal(baseline.json.workspaces.length, 1);
  const cleared = await request(baselinePath, 'POST', token, { action: 'clear' });
  assert.equal(cleared.json.baseline.workspaces.length, 0);
});

test('routes: background scan start/status/cancel', async () => {
  const auth = await request(authPath);
  const token = auth.json.token;
  const started = await request(startPath, 'POST', token, {});
  assert.equal(started.status, 202);
  assert.ok(started.json.jobId);
  assert.equal(started.json.total, 1);
  const cancelled = await request(cancelPath, 'POST', token, { jobId: started.json.jobId });
  assert.equal(cancelled.status, 200);
  let status = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    status = await request(statusPath, 'GET', token, undefined, statusPath + '?jobId=' + started.json.jobId);
    if (status.json.state !== 'running') break;
  }
  assert.ok(['done', 'cancelled'].includes(status.json.state));
  assert.ok(Array.isArray(status.json.result.workspaces));
});

test('source keeps Git fsmonitor hardening', async () => {
  const source = await fs.readFile(path.join(here, '..', 'index.js'), 'utf8');
  assert.match(source, /core\.fsmonitor=false/);
  assert.match(source, /core\.untrackedCache=false/);
  assert.match(source, /GIT_TERMINAL_PROMPT/);
});

after(async () => {
  await fs.rm(root, { recursive: true, force: true }).catch(() => {});
  await fs.rm(home, { recursive: true, force: true }).catch(() => {});
});
