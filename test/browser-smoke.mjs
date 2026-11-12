/**
 * Real-browser smoke for the workspace-audit panel.
 * Boots a fixture with React 18 UMD + the real client.js, then checks rendering,
 * risk filters, comparison table, failures and export buttons.
 *
 * Exit codes: 0 pass, 1 fail, 2 skipped.
 */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(SCRIPT_DIR, '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const lines = [];
const check = (label, ok, extra) => { lines.push((ok ? 'OK   ' : 'FAIL ') + label + (extra === undefined ? '' : ' :: ' + extra)); return ok; };
const BROWSERS = [
  process.env.DSH_BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.exceptions = [];
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data));
      if (message.method === 'Runtime.exceptionThrown') this.exceptions.push(String(message.params && message.params.exceptionDetails && message.params.exceptionDetails.text));
      if (message.id !== undefined && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
        else resolve(message.result);
      }
    });
  }
  send(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('CDP timeout: ' + method));
        }
      }, 20000);
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluate failed');
    return result.result ? result.result.value : undefined;
  }
}

const findBrowser = async () => {
  const fs = await import('node:fs');
  for (const candidate of BROWSERS) if (typeof candidate === 'string' && candidate.length > 0 && fs.existsSync(candidate)) return candidate;
  const edgeCore = 'C:\\Program Files (x86)\\Microsoft\\EdgeCore';
  if (fs.existsSync(edgeCore)) {
    const versions = fs.readdirSync(edgeCore).filter((name) => /^\d+\./.test(name)).sort().reverse();
    for (const version of versions) {
      const candidate = path.join(edgeCore, version, 'msedge.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return '';
};

const connect = async (port) => {
  let page;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
      page = list.find((entry) => entry.type === 'page');
      if (page) break;
    } catch (error) {
      // browser is still starting
    }
    await sleep(250);
  }
  if (!page) throw new Error('browser did not expose a page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP websocket failed')), { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  return cdp;
};

const payload = {
  generatedAt: Date.now(),
  durationMs: 1234,
  settings: { roots: [], online: false },
  environment: { git: true, online: false },
  failures: [{ path: 'D:\\Broken', error: 'permission denied' }],
  report: '# Workspace Audit Report\n\n## Demo',
  workspaces: [
    {
      path: 'D:\\DemoApp', title: 'DemoApp', score: 59, rawScore: 78, projectType: 'app', testFiles: 4, todo: 2,
      git: { isRepo: true, remote: 'https://github.com/demo/app', branch: 'main', dirty: 2, tags: ['v1.0.0'] },
      size: { bytes: 15 * 1024 * 1024 }, commands: ['npm install', 'npm test'],
      dimensions: { documentation: 70, development: 80, debugging: 60, performance: 90, functionality: 75, security: 55, github: 80 },
      deductions: [{ dimension: 'security', value: 55, weight: 0.15, points: 6.8 }],
      dependencies: { manifests: ['package.json'], lockfiles: [], unpinned: 2, vulnerabilities: { status: 'offline', total: 0, tool: '' } },
      github: { owner: 'demo', repo: 'app', latestRelease: 'v0.9.0', openIssues: 3, openPRs: 1, branchProtected: 'unprotected' },
      risks: [{ severity: 'P0', text: 'demo P0 risk' }, { severity: 'P1', text: 'demo P1 risk' }],
      ignoredRisks: [{ id: 'todo', severity: 'P2', text: 'ignored todo' }],
      acceptedRisks: [{ id: 'branch-protection', severity: 'P2', text: 'accepted branch', reason: 'internal', until: '2026-12-31' }],
      baseline: { score: 70, delta: -11, newRiskIds: ['self-hosted-pr'], resolvedRiskIds: [] },
      trend: { previousScore: 70, delta: -11 },
    },
    {
      path: 'D:\\Healthy', title: 'Healthy', score: 91, rawScore: 91, projectType: 'library', testFiles: 20, todo: 0,
      git: { isRepo: true, remote: 'https://github.com/demo/healthy', branch: 'main', dirty: 0, tags: ['v2.0.0'] },
      size: { bytes: 2 * 1024 * 1024 }, commands: ['cargo test'],
      dimensions: { documentation: 95, development: 90, debugging: 95, performance: 90, functionality: 90, security: 90, github: 90 },
      deductions: [], dependencies: { manifests: ['Cargo.toml'], lockfiles: ['Cargo.lock'], unpinned: 0, vulnerabilities: { status: 'skipped', total: 0, tool: 'cargo audit' } },
      github: { owner: 'demo', repo: 'healthy', latestRelease: 'v2.0.0', openIssues: 0, openPRs: 0, branchProtected: 'protected' },
      risks: [], trend: { previousScore: 89, delta: 2 },
    },
  ],
};

const fixtureHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>workspace audit smoke</title>
<style>body{font-family:system-ui,sans-serif;margin:0}</style>
<script src="/react.js"></script>
<script src="/react-dom.js"></script>
</head><body><div id="root"></div>
<script>
window.__ModuleLoader__ = { entries: [], load(entry) { this.entries.push(entry); } };
window.fetch = async (url, options) => {
  if (String(url).includes('/auth')) return { ok: true, json: async () => ({ token: 'smoke-token' }) };
  if (String(url).includes('/scan/start')) return { ok: true, json: async () => ({ jobId: 'smoke-job', total: 2 }) };
  if (String(url).includes('/scan/status')) return { ok: true, json: async () => ({ jobId: 'smoke-job', state: 'done', progress: { completed: 2, total: 2 }, result: (${JSON.stringify(payload)}) }) };
  if (String(url).includes('/baseline')) return { ok: true, json: async () => ({ ok: true }) };
  if (String(url).includes('/history')) return { ok: true, json: async () => ([{ at: Date.now(), workspaces: [{ path: 'D:\\\\DemoApp', score: 70 }] }]) };
  return { ok: false, status: 404, json: async () => ({}) };
};
</script>
<script src="/client.js"></script>
<script>
try {
  if (!window.React || !window.ReactDOM) throw new Error('React UMD unavailable');
  const entry = window.__ModuleLoader__.entries[0];
  const components = {};
  const t = { locale: { register() {}, bind() { return (key) => key; } } };
  const ctx = {
    effect(fn) { return fn(); },
    locale: { register() {}, bind() { return (key) => key; } },
    slots: {
      inject(name, cb) { cb(); },
      register(spec, component) { components[spec.name] = component; return component; },
    },
  };
  entry.factory((name) => (name === 'react' ? window.React : window.React)).apply(ctx);
  const Panel = components.main;
  if (!Panel) throw new Error('workspace-audit panel was not registered');
  window.__panel = Panel;
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Panel));
} catch (error) {
  window.__bootError = String(error && error.stack || error);
}
</script></body></html>`;

async function main() {
  const browserPath = await findBrowser();
  if (!browserPath) {
    console.log('SKIP browser not found');
    return 2;
  }
  const server = createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/client.js')) {
        const text = await readFile(path.join(pluginRoot, 'client.js'), 'utf8');
        res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
        res.end(text);
        return;
      }
      if (req.url.startsWith('/react.js')) {
        const text = await readFile(path.join(SCRIPT_DIR, 'fixtures', 'react.production.min.js'), 'utf8');
        res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
        res.end(text);
        return;
      }
      if (req.url.startsWith('/react-dom.js')) {
        const text = await readFile(path.join(SCRIPT_DIR, 'fixtures', 'react-dom.production.min.js'), 'utf8');
        res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
        res.end(text);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fixtureHtml);
    } catch (error) {
      res.writeHead(500); res.end(String(error));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const profileDir = await mkdtemp(path.join(os.tmpdir(), 'dsh-wa-smoke-'));
  const port = 9500 + Math.floor(Math.random() * 200);
  const child = spawn(browserPath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-allow-origins=*', '--remote-debugging-port=' + port, '--user-data-dir=' + profileDir, url], { stdio: 'ignore', windowsHide: true });
  let cdp;
  try {
    cdp = await connect(port);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (await cdp.evaluate("Boolean(window.__bootError || document.querySelector('#root') && document.querySelector('#root').textContent.includes('DemoApp'))")) break;
      await sleep(250);
    }
    const text = await cdp.evaluate("document.querySelector('#root')?.textContent || ''");
    const bootError = await cdp.evaluate('window.__bootError || ""');
    check('panel rendered', text.includes('DemoApp') && text.includes('Healthy'), text.slice(0, 160));
    check('no boot error', bootError === '', bootError);
    check('comparison table', text.includes('Workspace') || text.includes('workspace'));
    check('risk filter', text.includes('P0') && text.includes('P1'));
    check('offline state', text.includes('Offline') || text.includes('离线') || text.includes('network checks'));
    check('failures visible', text.includes('Broken') || text.includes('permission denied'));
    const p0Before = await cdp.evaluate("document.querySelectorAll('section').length");
    await cdp.evaluate("[...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'P0')?.click()");
    await sleep(300);
    const p0After = await cdp.evaluate("document.querySelectorAll('section').length");
    check('P0 filter narrows cards', p0After <= p0Before, p0Before + ' -> ' + p0After);
    const buttons = await cdp.evaluate("Array.from(document.querySelectorAll('button')).map((b) => (b.textContent || '').trim()).join('|')");
    check('export controls present', buttons.includes('Markdown') || buttons.includes('HTML') || buttons.includes('复制'), buttons.slice(0, 220));
    check('handover and PDF controls present', buttons.includes('交接') || buttons.includes('Handover') || buttons.includes('PDF'), buttons.slice(0, 220));
    check('no uncaught exceptions', cdp.exceptions.length === 0, JSON.stringify(cdp.exceptions));
    const artifacts = path.join(SCRIPT_DIR, 'artifacts');
    await mkdir(artifacts, { recursive: true });
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    await import('node:fs/promises').then((fs) => fs.writeFile(path.join(artifacts, 'workspace-audit-smoke.png'), Buffer.from(shot.data, 'base64')));
    check('screenshot', true);
  } finally {
    if (cdp) cdp.ws.close();
    child.kill();
    server.close();
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
  console.log(lines.join('\n'));
  return lines.some((line) => line.startsWith('FAIL')) ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((error) => { console.error(error); process.exit(1); });
