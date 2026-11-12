/**
 * dsh-workspace-audit Host half.
 * Read-only, local-first workspace health checks with a Markdown handover report.
 */
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROUTE = '/api/workspace-audit';
const AUTH_PATH = ROUTE + '/auth';
const SCAN_PATH = ROUTE + '/scan';
const START_PATH = ROUTE + '/scan/start';
const STATUS_PATH = ROUTE + '/scan/status';
const CANCEL_PATH = ROUTE + '/scan/cancel';
const SETTINGS_PATH = ROUTE + '/settings';
const HISTORY_PATH = ROUTE + '/history';
const BASELINE_PATH = ROUTE + '/baseline';
const SCAN_JOBS = new Map();
const MAX_WORKSPACES = 20;
const SKIP_NAMES = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache', '.ruff_cache', '.mypy_cache', 'dist', 'build', 'target', '.next', '.nuxt', 'coverage']);
const ARTIFACT_NAMES = new Set(['node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache', '.ruff_cache', '.mypy_cache', 'dist', 'build', 'target', '.next', '.nuxt', 'coverage', 'release-archive', 'test+files', 'BeeOffice-v5.2.3-windows', 'BeeOffice_logs']);
const GITHUB_CACHE = new Map();
const GIT_CACHE = new Map();
let authToken = null;

function resolveDshHome() {
  if (typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim().length > 0) return process.env.DSH_HOME.trim();
  return path.join(os.homedir(), '.dsh');
}

function settingsFile() {
  return path.join(resolveDshHome(), 'workspace-audit', 'settings.json');
}

async function loadSettings() {
  try {
    const raw = JSON.parse(await fs.readFile(settingsFile(), 'utf8'));
    return {
      roots: Array.isArray(raw.roots) ? raw.roots.filter((entry) => typeof entry === 'string').slice(0, 30) : [],
      online: raw.online === true,
    };
  } catch (error) {
    return { roots: [], online: false };
  }
}

function historyFile() {
  return path.join(resolveDshHome(), 'workspace-audit', 'history.json');
}

async function loadHistory() {
  try {
    const raw = JSON.parse(await fs.readFile(historyFile(), 'utf8'));
    return Array.isArray(raw.entries) ? raw.entries.slice(-30) : [];
  } catch (error) {
    return [];
  }
}

async function saveHistory(entries) {
  await fs.mkdir(path.dirname(historyFile()), { recursive: true });
  await fs.writeFile(historyFile(), JSON.stringify({ entries: entries.slice(-30) }, null, 2) + '\n', 'utf8');
}

function baselineFile() {
  return path.join(resolveDshHome(), 'workspace-audit', 'baseline.json');
}

async function loadBaseline() {
  try {
    const raw = JSON.parse(await fs.readFile(baselineFile(), 'utf8'));
    return raw && Array.isArray(raw.workspaces) ? raw : { createdAt: 0, workspaces: [] };
  } catch (error) {
    return { createdAt: 0, workspaces: [] };
  }
}

async function saveBaseline(baseline) {
  await fs.mkdir(path.dirname(baselineFile()), { recursive: true });
  await fs.writeFile(baselineFile(), JSON.stringify(baseline, null, 2) + '\n', 'utf8');
}

const KNOWN_RULES = new Set([
  'no-git', 'dirty', 'no-remote', 'readme', 'ci', 'self-hosted-pr', 'secrets', 'dangerous-exec',
  'artifacts', 'vulns', 'lockfile', 'unpinned', 'release-mismatch', 'archived', 'branch-protection',
  'rate-limit', 'todo',
]);

async function readWorkspaceConfig(root) {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(root, '.workspace-audit.json'), 'utf8'));
    const accept = Array.isArray(raw.accept)
      ? raw.accept
          .filter((entry) => entry && typeof entry.rule === 'string' && KNOWN_RULES.has(entry.rule))
          .slice(0, 100)
          .map((entry) => ({
            rule: entry.rule,
            reason: typeof entry.reason === 'string' ? entry.reason.slice(0, 300) : '',
            until: typeof entry.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.until) ? entry.until : '',
          }))
      : [];
    return {
      projectType: ['app', 'library', 'plugin', 'data'].includes(raw.projectType) ? raw.projectType : '',
      ignore: Array.isArray(raw.ignore) ? raw.ignore.filter((rule) => typeof rule === 'string' && KNOWN_RULES.has(rule)).slice(0, 100) : [],
      accept,
    };
  } catch (error) {
    return { projectType: '', ignore: [], accept: [] };
  }
}

function applySuppressions(risks, config) {
  const now = new Date();
  const ignored = [];
  const accepted = [];
  const active = [];
  const today = now.toISOString().slice(0, 10);
  for (const risk of risks) {
    if (config.ignore.includes(risk.id)) {
      ignored.push(risk);
      continue;
    }
    const acceptance = config.accept.find((entry) => entry.rule === risk.id && (!entry.until || entry.until >= today));
    if (acceptance) {
      accepted.push({ ...risk, reason: acceptance.reason, until: acceptance.until });
      continue;
    }
    active.push(risk);
  }
  return { active, ignored, accepted };
}

async function saveSettings(settings) {
  await fs.mkdir(path.dirname(settingsFile()), { recursive: true });
  await fs.writeFile(settingsFile(), JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function matchesPath(req, expected) {
  try {
    return new URL(req.url || '/', 'http://localhost').pathname === expected;
  } catch (error) {
    return false;
  }
}

function isLoopback(req) {
  const address = String(req.socket && req.socket.remoteAddress || '');
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function requireToken(req, res) {
  const provided = req.headers['x-workspace-audit-token'];
  if (typeof provided === 'string' && authToken !== null && provided === authToken) return true;
  sendJson(res, 401, { error: 'unauthorized' });
  return false;
}

function createAuthRoute() {
  return async (req, res) => {
    if (!matchesPath(req, AUTH_PATH)) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    if (!isLoopback(req)) {
      sendJson(res, 403, { error: 'loopback only' });
      return;
    }
    if (authToken === null) authToken = randomBytes(24).toString('hex');
    sendJson(res, 200, { token: authToken });
  };
}

function createReadRoute(endpoint, build) {
  return async (req, res) => {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'method not allowed' });
      return;
    }
    if (!matchesPath(req, endpoint)) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    if (!requireToken(req, res)) return;
    try {
      sendJson(res, 200, await build(req));
    } catch (error) {
      sendJson(res, 500, { error: String((error && error.message) || error) });
    }
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function discoverWorkspaces(settings) {
  const roots = new Set(settings.roots);
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(resolveDshHome(), 'storages', 'workspace.json'), 'utf8'));
    const table = parsed && parsed.tables && parsed.tables.workspaces;
    for (const workspace of table && typeof table === 'object' ? Object.values(table) : []) {
      if (workspace && typeof workspace.path === 'string' && workspace.path.length > 0) roots.add(workspace.path);
    }
  } catch (error) {
    // workspace registry is optional
  }
  const result = [];
  const seen = new Set();
  const addRoot = (root) => {
    if (result.length >= MAX_WORKSPACES) return;
    const resolved = path.resolve(root);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    result.push({ path: resolved, title: path.basename(resolved) || resolved });
  };
  for (const root of roots) {
    if (result.length >= MAX_WORKSPACES) break;
    try {
      const stat = await fs.stat(root);
      if (!stat.isDirectory()) continue;
    } catch (error) {
      continue;
    }
    addRoot(root);
    // A multi-project container (for example D:\DSTools) is useful as a parent,
    // and its immediate Git repositories are useful as individual workspaces.
    if (!(await fs.stat(path.join(root, '.git')).catch(() => null))) {
      const children = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
      for (const child of children) {
        if (result.length >= MAX_WORKSPACES) break;
        if (!child.isDirectory() || SKIP_NAMES.has(child.name) || child.name.startsWith('.')) continue;
        const gitPath = path.join(root, child.name, '.git');
        const isRepo = await fs.stat(gitPath).catch(() => null);
        if (isRepo) addRoot(path.join(root, child.name));
      }
    }
  }
  return result;
}

async function gitInfo(root, options) {
  const rootStat = await fs.stat(root).catch(() => null);
  const rootMtime = rootStat ? rootStat.mtimeMs : 0;
  const cached = GIT_CACHE.get(root);
  if (cached && cached.rootMtime === rootMtime && Date.now() - cached.at < 60000 && !(options && options.noCache)) return cached.value;
  const run = async (args) => {
    try {
      const result = await execFileAsync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-C', root, ...args], {
        timeout: 8000,
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
      return String(result.stdout || '').trim();
    } catch (error) {
      return '';
    }
  };
  const isRepo = (await run(['rev-parse', '--is-inside-work-tree'])) === 'true';
  if (!isRepo) return { isRepo: false, untracked: [] };
  const remote = await run(['remote', 'get-url', 'origin']);
  const branch = await run(['branch', '--show-current']);
  const status = await run(['status', '--porcelain']);
  const last = await run(['log', '-1', '--format=%h|%ad|%s', '--date=short']);
  const tags = await run(['tag', '--sort=-v:refname']);
  const tracked = await run(['ls-files']);
  const untracked = status
    .split(/\r?\n/)
    .filter((line) => line.startsWith('?? '))
    .map((line) => line.slice(3).trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);
  const value = {
    isRepo: true,
    remote,
    branch,
    dirty: status.length === 0 ? 0 : status.split(/\r?\n/).filter(Boolean).length,
    last,
    tags: tags.split(/\r?\n/).filter(Boolean).slice(0, 5),
    tracked: tracked.length === 0 ? [] : tracked.split(/\r?\n/),
    untracked,
  };
  GIT_CACHE.set(root, { at: Date.now(), value, rootMtime });
  return value;
}

async function commandExists(command) {
  try {
    await execFileAsync(command, ['--version'], { timeout: 5000, windowsHide: true });
    return true;
  } catch (error) {
    return false;
  }
}

async function dependencyHealth(root, options) {
  const online = Boolean(options && options.online === true);
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const names = entries.map((entry) => entry.name);
  const manifests = names.filter((name) => /^(package\.json|pyproject\.toml|requirements.*\.txt|Cargo\.toml|go\.mod|pom\.xml|build\.gradle)$/i.test(name));
  const lockfiles = names.filter((name) => /^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|uv\.lock|Cargo\.lock|go\.sum|gradle\.lockfile)$/i.test(name));
  let unpinned = 0;
  const requirementFile = names.find((name) => /^requirements.*\.txt$/i.test(name));
  if (requirementFile) {
    const text = await fs.readFile(path.join(root, requirementFile), 'utf8').catch(() => '');
    unpinned += (text.match(/^[A-Za-z0-9_.-]+\s*(>=|~=|>)/gm) || []).length;
  }
  const vulnerabilities = { status: online ? 'skipped' : 'offline', total: 0, tool: '', ecosystem: '', reason: online ? '' : 'network checks disabled' };
  if (!online) return { manifests, lockfiles, unpinned, vulnerabilities };
  const audit = async (command, args, parse, tool, ecosystem) => {
    if (!(await commandExists(command))) {
      vulnerabilities.status = 'skipped';
      vulnerabilities.reason = command + ' not installed';
      return;
    }
    try {
      const result = await execFileAsync(command, args, { cwd: root, timeout: 30000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
      vulnerabilities.status = 'checked';
      vulnerabilities.total = parse(String(result.stdout || '')) || 0;
      vulnerabilities.tool = tool;
      vulnerabilities.ecosystem = ecosystem;
    } catch (error) {
      try {
        vulnerabilities.status = 'checked';
        vulnerabilities.total = parse(String(error.stdout || '')) || 0;
        vulnerabilities.tool = tool;
        vulnerabilities.ecosystem = ecosystem;
      } catch (inner) {
        vulnerabilities.status = 'error';
        vulnerabilities.tool = tool;
        vulnerabilities.ecosystem = ecosystem;
        vulnerabilities.reason = 'audit tool failed';
      }
    }
  };
  if (names.includes('package-lock.json')) {
    await audit(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json', '--package-lock-only', '--omit=dev'], (text) => {
      const parsed = JSON.parse(text);
      return Number(parsed.metadata && parsed.metadata.vulnerabilities && parsed.metadata.vulnerabilities.total) || 0;
    }, 'npm audit', 'npm');
  } else if (names.includes('pnpm-lock.yaml')) {
    await audit(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['audit', '--json'], (text) => {
      const parsed = JSON.parse(text);
      return Number(parsed.metadata && parsed.metadata.vulnerabilities && parsed.metadata.vulnerabilities.total) || Object.keys(parsed.advisories || {}).length;
    }, 'pnpm audit', 'pnpm');
  } else if (names.includes('yarn.lock')) {
    await audit(process.platform === 'win32' ? 'yarn.cmd' : 'yarn', ['audit', '--json'], (text) => text.split(/\r?\n/).filter((line) => line.includes('auditAdvisory')).length, 'yarn audit', 'yarn');
  } else if (names.includes('Cargo.lock')) {
    await audit('cargo', ['audit', '--json'], (text) => {
      const parsed = JSON.parse(text);
      return Number(parsed.vulnerabilities && parsed.vulnerabilities.found) || (Array.isArray(parsed.vulnerabilities && parsed.vulnerabilities.list) ? parsed.vulnerabilities.list.length : 0);
    }, 'cargo audit', 'cargo');
  } else if (names.includes('go.sum')) {
    vulnerabilities.status = 'skipped';
    vulnerabilities.ecosystem = 'go';
    vulnerabilities.reason = 'govulncheck integration is not implemented yet';
  } else if (requirementFile) {
    await audit(process.platform === 'win32' ? 'pip-audit.exe' : 'pip-audit', ['-r', requirementFile, '--format', 'json'], (text) => {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.reduce((sum, entry) => sum + (Array.isArray(entry.vulns) ? entry.vulns.length : 0), 0) : 0;
    }, 'pip-audit', 'python');
  }
  return { manifests, lockfiles, unpinned, vulnerabilities };
}

function parseGitHubRemote(remote) {
  const match = String(remote || '').match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  return match ? { owner: match[1], repo: match[2] } : null;
}

async function githubHealth(git, options) {
  if (!options || options.online !== true) return null;
  const parsed = parseGitHubRemote(git.remote);
  if (!parsed) return null;
  const key = parsed.owner.toLowerCase() + '/' + parsed.repo.toLowerCase();
  const cached = GITHUB_CACHE.get(key);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.value;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'dsh-workspace-audit' };
  if (token) headers.authorization = 'Bearer ' + token;
  const request = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      return await fetch(url, { headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
  const rateLimitOf = (res) => {
    const remaining = res && res.headers && typeof res.headers.get === 'function' ? res.headers.get('x-ratelimit-remaining') : null;
    return remaining === null || remaining === undefined ? null : Number(remaining);
  };
  const classify = (res) => {
    if (res.ok) return 'ok';
    const remaining = rateLimitOf(res);
    if (res.status === 403 && remaining === 0) return 'rate_limited';
    if (res.status === 401) return 'unauthorized';
    if (res.status === 404) return 'not_found';
    return 'error';
  };
  const value = { provider: 'github', owner: parsed.owner, repo: parsed.repo, status: 'unknown' };
  try {
    const repoRes = await request('https://api.github.com/repos/' + parsed.owner + '/' + parsed.repo);
    value.status = classify(repoRes);
    value.rateLimit = rateLimitOf(repoRes);
    if (repoRes.ok) {
      const repo = await repoRes.json();
      value.openItems = repo.open_issues_count;
      value.stars = repo.stargazers_count;
      value.archived = repo.archived === true;
      value.pushedAt = repo.pushed_at;
      value.defaultBranch = repo.default_branch;
      value.permissions = repo.permissions || null;
      const issueRes = await request('https://api.github.com/search/issues?q=' + encodeURIComponent('repo:' + parsed.owner + '/' + parsed.repo + ' is:issue is:open') + '&per_page=1');
      const prRes = await request('https://api.github.com/search/issues?q=' + encodeURIComponent('repo:' + parsed.owner + '/' + parsed.repo + ' is:pr is:open') + '&per_page=1');
      if (issueRes.ok) value.openIssues = Number((await issueRes.json()).total_count) || 0;
      if (prRes.ok) value.openPRs = Number((await prRes.json()).total_count) || 0;
      if (value.openIssues === undefined || value.openPRs === undefined) {
        value.searchStatus = 'unavailable';
      }
    }
    if (value.status === 'ok') {
      const releaseRes = await request('https://api.github.com/repos/' + parsed.owner + '/' + parsed.repo + '/releases/latest');
      if (releaseRes.ok) {
        const release = await releaseRes.json();
        value.latestRelease = release.tag_name;
        value.releaseName = release.name;
        value.releasePublishedAt = release.published_at;
      } else {
        value.latestRelease = '';
        if (classify(releaseRes) === 'rate_limited') value.status = 'rate_limited';
      }
      const branch = git.branch || value.defaultBranch || 'main';
      const protectionRes = await request('https://api.github.com/repos/' + parsed.owner + '/' + parsed.repo + '/branches/' + encodeURIComponent(branch) + '/protection');
      value.branchProtected = protectionRes.ok
        ? 'protected'
        : classify(protectionRes) === 'rate_limited'
          ? 'rate_limited'
          : protectionRes.status === 404
            ? 'unprotected'
            : 'unknown';
    }
  } catch (error) {
    value.status = 'error';
  }
  GITHUB_CACHE.set(key, { at: Date.now(), value });
  return value;
}

async function fileSize(file) {
  try {
    return (await fs.stat(file)).size;
  } catch (error) {
    return 0;
  }
}

async function directorySize(root, maxEntries) {
  let total = 0;
  let entries = 0;
  const stack = [root];
  while (stack.length > 0 && entries < maxEntries) {
    const current = stack.pop();
    let items;
    try {
      items = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      continue;
    }
    for (const item of items) {
      if (entries >= maxEntries) break;
      entries += 1;
      const full = path.join(current, item.name);
      if (item.isDirectory()) {
        if (SKIP_NAMES.has(item.name)) continue;
        stack.push(full);
      } else if (item.isFile()) {
        total += await fileSize(full);
      }
    }
  }
  return { total, entries };
}

function isTextFile(name) {
  return /\.(py|js|mjs|cjs|ts|tsx|jsx|json|ya?ml|toml|md|txt|cfg|ini|sh|ps1|bat|cmd|go|rs|c|h|cpp|java|kt|rb|php|sql|css|html)$/i.test(name);
}

function testFilePattern(name) {
  return /(^|\/)(tests?\/|test_[^/]+\.py$|[^/]+\.(test|spec)\.(js|ts|jsx|tsx|mjs)$|.*_test\.(go|rs|py)$)/i.test(name);
}

async function projectProfile(root, entries) {
  const names = entries.map((entry) => entry.name);
  if (names.includes('cordis.patch.yml')) return 'plugin';
  const packageFile = names.includes('package.json') ? await fs.readFile(path.join(root, 'package.json'), 'utf8').catch(() => '') : '';
  if (packageFile.length > 0) {
    try {
      const pkg = JSON.parse(packageFile);
      if (pkg.dsh) return 'plugin';
      const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
      if (scripts.start || scripts.dev || names.includes('Dockerfile')) return 'app';
      if (pkg.main || pkg.exports || pkg.bin) return 'library';
    } catch (error) {
      // fall through to the generic app profile
    }
  }
  if (names.includes('Cargo.toml') && names.includes('src')) return 'library';
  if (names.includes('pyproject.toml')) return 'library';
  if (requirementsLike(names)) return 'app';
  return 'app';
}

function requirementsLike(names) {
  return names.some((name) => /^(requirements.*\.txt|pyproject\.toml|Pipfile)$/i.test(name));
}

const PROJECT_WEIGHTS = {
  app: { documentation: 0.15, development: 0.15, debugging: 0.2, performance: 0.1, functionality: 0.15, security: 0.15, github: 0.1 },
  library: { documentation: 0.2, development: 0.2, debugging: 0.2, performance: 0.05, functionality: 0.1, security: 0.15, github: 0.1 },
  plugin: { documentation: 0.2, development: 0.2, debugging: 0.15, performance: 0.05, functionality: 0.15, security: 0.15, github: 0.1 },
  data: { documentation: 0.2, development: 0.15, debugging: 0.15, performance: 0.15, functionality: 0.1, security: 0.15, github: 0.1 },
};

function scoreWorkspace(dimensions, projectType, risks) {
  const weights = PROJECT_WEIGHTS[projectType] || PROJECT_WEIGHTS.app;
  const weighted = Object.entries(dimensions).reduce((sum, [key, value]) => sum + value * (weights[key] || 0), 0);
  const rawScore = Math.round(weighted);
  const deductions = Object.entries(dimensions)
    .filter(([, value]) => value < 100)
    .map(([dimension, value]) => ({ dimension, value, weight: weights[dimension] || 0, points: Math.round((100 - value) * (weights[dimension] || 0) * 10) / 10 }))
    .sort((left, right) => right.points - left.points)
    .slice(0, 6);
  const hasP0 = risks.some((risk) => risk.severity === 'P0');
  const score = hasP0 ? Math.min(rawScore, 59) : rawScore;
  if (hasP0) deductions.unshift({ dimension: 'P0', value: 0, weight: 1, points: rawScore - score, reason: 'P0 finding caps the total score at 59' });
  return { score, rawScore, deductions, weights, projectType };
}

async function commandHints(root, entries) {
  const names = entries.map((entry) => entry.name);
  const commands = [];
  const packageFile = names.includes('package.json') ? await fs.readFile(path.join(root, 'package.json'), 'utf8').catch(() => '') : '';
  if (packageFile.length > 0) {
    try {
      const pkg = JSON.parse(packageFile);
      const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
      commands.push('npm install');
      if (scripts.test) commands.push('npm test');
      if (scripts.dev) commands.push('npm run dev');
      else if (scripts.start) commands.push('npm start');
      if (scripts.build) commands.push('npm run build');
    } catch (error) {
      commands.push('npm install');
    }
  }
  const requirement = names.find((name) => /^requirements.*\.txt$/i.test(name));
  if (requirement) {
    commands.push('python -m venv .venv', 'pip install -r ' + requirement);
    if (names.some((name) => /^(pytest\.ini|tox\.ini)$/i.test(name)) || names.includes('pyproject.toml')) commands.push('pytest');
  }
  if (names.includes('pyproject.toml') && requirement === undefined) commands.push('pip install -e .');
  if (names.includes('Cargo.toml')) commands.push('cargo test');
  if (names.includes('go.mod')) commands.push('go test ./...');
  if (names.some((name) => /^(docker-compose\.ya?ml|dockerfile)$/i.test(name))) commands.push('docker build .');
  return [...new Set(commands)].slice(0, 8);
}

async function scanWorkspace(workspace, options) {
  const root = workspace.path;
  const git = await gitInfo(root, options);
  const dependencies = await dependencyHealth(root, options);
  const github = await githubHealth(git, options);
  const tracked = Array.isArray(git.tracked) ? git.tracked : [];
  const rootEntries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const commands = await commandHints(root, rootEntries);
  const workspaceConfig = await readWorkspaceConfig(root);
  const projectType = workspaceConfig.projectType || await projectProfile(root, rootEntries);
  const markers = {
    readme: rootEntries.some((entry) => /^readme(\.|$)/i.test(entry.name)),
    license: rootEntries.some((entry) => /^licen[cs]e(\.|$)/i.test(entry.name)),
    gitignore: rootEntries.some((entry) => entry.name === '.gitignore'),
    docker: rootEntries.some((entry) => /^(dockerfile|docker-compose\.ya?ml)$/i.test(entry.name)),
    manifest: rootEntries.some((entry) => /^(package\.json|pyproject\.toml|requirements\.txt|cargo\.toml|go\.mod|pom\.xml|build\.gradle)$/i.test(entry.name)),
    lockfile: rootEntries.some((entry) => /^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|uv\.lock|cargo\.lock|go\.sum)$/i.test(entry.name)),
    tests: rootEntries.some((entry) => /^tests?$/i.test(entry.name)),
    ci: rootEntries.some((entry) => entry.name === '.github'),
    docs: rootEntries.some((entry) => /^docs?$/i.test(entry.name)),
  };
  const artifacts = [];
  for (const entry of rootEntries) {
    if (entry.isDirectory() && ARTIFACT_NAMES.has(entry.name)) {
      const size = await directorySize(path.join(root, entry.name), 5000);
      artifacts.push({ name: entry.name, bytes: size.total });
    }
  }
  const size = await directorySize(root, 20000);
  const sourceFiles = tracked.filter((file) => isTextFile(file) && !file.includes('node_modules/')).slice(0, 400);
  let todo = 0;
  let dangerous = 0;
  const secretFiles = [];
  const secretCandidates = new Set([...tracked, ...(Array.isArray(git.untracked) ? git.untracked : [])]);
  if (!git.isRepo) {
    for (const entry of rootEntries) {
      if (entry.isFile()) secretCandidates.add(entry.name);
    }
  }
  for (const file of [...secretCandidates].slice(0, 3000)) {
    const sourceLike = /\.(py|js|mjs|cjs|ts|tsx|jsx|go|rs|c|h|cpp|java|kt|rb|php|sql)$/i.test(file);
    const basename = path.basename(file).toLowerCase();
    const secretLike = !sourceLike && (
      /(^|\/)\.env(\.|$)/i.test(file) ||
      /\.(pem|key|p12|pfx|jks|keystore)$/i.test(file) ||
      /(^|\/)(secrets?|credentials?)(\.(json|ya?ml|txt|ini|cfg)|$)/i.test(file) ||
      basename === '.npmrc' || basename === '.pypirc'
    );
    if (secretLike) secretFiles.push(file);
  }
  for (const file of sourceFiles) {
    const full = path.join(root, file);
    if (!/\.(py|js|mjs|cjs|ts|tsx|jsx|sh|ps1|bat|cmd|yml|yaml)$/i.test(file)) continue;
    const text = await fs.readFile(full, 'utf8').catch(() => '');
    if (text.length === 0) continue;
    todo += (text.match(/\b(TODO|FIXME|XXX|HACK)\b/g) || []).length;
    dangerous += (text.match(/shell\s*=\s*True|\bexec\s*\(|pickle\.load\s*\(/g) || []).length;
  }
  const readmeEntry = rootEntries.find((entry) => /^readme/i.test(entry.name));
  const readmeText = readmeEntry ? await fs.readFile(path.join(root, readmeEntry.name), 'utf8').catch(() => '') : '';
  const workflowsDir = path.join(root, '.github', 'workflows');
  const workflowFiles = await fs.readdir(workflowsDir, { withFileTypes: true }).catch(() => []);
  const workflows = [];
  for (const file of workflowFiles.filter((entry) => entry.isFile()).slice(0, 30)) {
    const text = await fs.readFile(path.join(workflowsDir, file.name), 'utf8').catch(() => '');
    workflows.push({
      name: file.name,
      pullRequest: /pull_request/.test(text),
      selfHosted: /self-hosted/.test(text),
      permissions: /permissions:/.test(text),
      publish: /npm publish|twine upload|upload-release|gh release|docker push/.test(text),
    });
  }
  const testFiles = tracked.filter((file) => testFilePattern(file)).length;
  const dimensions = {
    documentation: (markers.readme ? 35 : 0) + (markers.docs ? 25 : 0) + (readmeText.length > 4000 ? 20 : readmeText.length > 1000 ? 10 : 0) + (markers.license ? 20 : 0),
    development: (markers.manifest ? 25 : 0) + (dependencies.lockfiles.length > 0 ? 20 : 0) + (markers.gitignore ? 20 : 0) + (markers.ci ? 25 : 0) + (markers.docker ? 10 : 0),
    debugging: Math.min(100, testFiles * 6 + (markers.tests ? 20 : 0) + (markers.ci ? 20 : 0)),
    performance: Math.max(0, 100 - Math.min(80, Math.round(size.total / (1024 * 1024 * 50) * 10)) - (artifacts.length > 0 ? 20 : 0)),
    functionality: (markers.readme ? 30 : 0) + (tracked.length > 50 ? 35 : tracked.length > 10 ? 20 : 0) + (markers.tests ? 20 : 0) + (markers.ci ? 15 : 0),
    security: Math.max(0, 100 - (git.isRepo && git.dirty > 0 ? 15 : 0) - Math.min(40, dangerous * 5) - (workflows.some((wf) => wf.selfHosted && wf.pullRequest) ? 40 : 0) - (secretFiles.length > 0 ? 20 : 0) - (dependencies.vulnerabilities.total > 0 ? 30 : 0)),
    github: (git.isRepo ? 30 : 0) + (git.remote ? 30 : 0) + (git.dirty === 0 ? 20 : 0) + (git.tags && git.tags.length > 0 ? 20 : 0),
  };
  const risks = [];
  if (!git.isRepo) risks.push({ id: 'no-git', severity: 'P2', text: '目录未初始化 Git，无法追踪变更、回滚或协作。', en: 'Directory is not a Git repository; changes cannot be tracked or rolled back.' });
  if (git.isRepo && git.dirty > 0) risks.push({ id: 'dirty', severity: 'P1', text: `工作区有 ${git.dirty} 个未提交变更，发布前需确认。`, en: `${git.dirty} uncommitted changes; confirm before release.` });
  if (git.isRepo && !git.remote) risks.push({ id: 'no-remote', severity: 'P2', text: '仓库没有 origin 远端，缺少异地备份/协作。', en: 'No origin remote; no off-machine backup or collaboration.' });
  if (!markers.readme) risks.push({ id: 'readme', severity: 'P1', text: '缺少 README，后来开发者难以启动项目。', en: 'Missing README; new developers cannot easily start the project.' });
  if (!markers.ci) risks.push({ id: 'ci', severity: 'P1', text: '缺少 CI，测试/构建容易回归。', en: 'Missing CI; tests and builds can regress.' });
  if (workflows.some((wf) => wf.selfHosted && wf.pullRequest)) risks.push({ id: 'self-hosted-pr', severity: 'P0', text: '自托管 Runner 被 pull_request 触发，公开仓库存在不可信代码执行风险。', en: 'A self-hosted runner is triggered by pull_request; untrusted code execution risk on a public repo.' });
  if (secretFiles.length > 0) risks.push({ id: 'secrets', severity: 'P1', text: `发现疑似密钥文件：${secretFiles.slice(0, 5).join(', ')}（只检查了文件名，未读取内容）。`, en: `Suspected secret files: ${secretFiles.slice(0, 5).join(', ')} (filename only; contents not read).` });
  if (dangerous > 10) risks.push({ id: 'dangerous-exec', severity: 'P1', text: `发现 ${dangerous} 处 shell=True/exec/pickle.load 高危模式，需确认输入来源。`, en: `${dangerous} high-risk shell=True/exec/pickle.load patterns; verify input sources.` });
  else if (dangerous > 0) risks.push({ id: 'dangerous-exec', severity: 'P2', text: `发现 ${dangerous} 处 shell=True/exec/pickle.load 模式，建议人工确认。`, en: `${dangerous} shell=True/exec/pickle.load patterns; review manually.` });
  const significantArtifacts = artifacts.filter((item) => item.bytes >= 1024 * 1024);
  if (significantArtifacts.length > 0) {
    const huge = significantArtifacts.some((item) => item.bytes >= 1024 * 1024 * 1024);
    risks.push({ id: 'artifacts', severity: huge ? 'P1' : 'P2', text: `发现构建/缓存目录：${significantArtifacts.map((item) => item.name + ' ' + Math.round(item.bytes / 1024 / 1024) + 'MB').join(', ')}。`, en: `Build/cache directories: ${significantArtifacts.map((item) => item.name + ' ' + Math.round(item.bytes / 1024 / 1024) + 'MB').join(', ')}.` });
  }
  if (dependencies.vulnerabilities.total > 0) risks.push({ id: 'vulns', severity: dependencies.vulnerabilities.total >= 5 ? 'P0' : 'P1', text: `${dependencies.vulnerabilities.tool || '依赖扫描'} 发现 ${dependencies.vulnerabilities.total} 个依赖漏洞。`, en: `${dependencies.vulnerabilities.tool || 'Dependency audit'} found ${dependencies.vulnerabilities.total} dependency vulnerabilities.` });
  if (dependencies.lockfiles.length === 0 && dependencies.manifests.length > 0) risks.push({ id: 'lockfile', severity: 'P2', text: '依赖清单存在但没有检测到锁文件。', en: 'Dependency manifest exists but no lockfile was detected.' });
  if (dependencies.unpinned > 5) risks.push({ id: 'unpinned', severity: 'P2', text: `requirements 中有 ${dependencies.unpinned} 条非精确版本约束。`, en: `${dependencies.unpinned} non-exact version constraints in requirements.` });
  if (github && github.latestRelease && git.tags && git.tags.length > 0 && github.latestRelease !== git.tags[0]) risks.push({ id: 'release-mismatch', severity: 'P2', text: `Git tag ${git.tags[0]} 与 GitHub latest release ${github.latestRelease} 不一致。`, en: `Git tag ${git.tags[0]} differs from GitHub latest release ${github.latestRelease}.` });
  if (github && github.archived === true) risks.push({ id: 'archived', severity: 'P2', text: 'GitHub 仓库已归档（archived）。', en: 'GitHub repository is archived.' });
  if (github && github.branchProtected === 'unprotected') risks.push({ id: 'branch-protection', severity: 'P2', text: 'GitHub 默认分支未检测到保护规则。', en: 'No branch protection detected on the default branch.' });
  if (github && github.status === 'rate_limited') risks.push({ id: 'rate-limit', severity: 'P2', text: 'GitHub API 触发限流，部分健康数据不可用。', en: 'GitHub API rate limit reached; some health data is unavailable.' });
  if (todo > 20) risks.push({ id: 'todo', severity: 'P2', text: `源码中约 ${todo} 处 TODO/FIXME，建议建立清理计划。`, en: `About ${todo} TODO/FIXME markers; consider a cleanup plan.` });
  const config = workspaceConfig;
  const suppression = applySuppressions(risks, config);
  const activeRisks = suppression.active;
  const scoring = scoreWorkspace(dimensions, projectType, activeRisks);
  const finalScore = scoring.score;
  return {
    path: root,
    title: workspace.title,
    commands,
    git,
    markers,
    workflowFiles,
    workflows,
    dependencies,
    github,
    size: { bytes: size.total, scannedEntries: size.entries, artifacts },
    testFiles,
    todo,
    dangerous,
    secretFiles,
    dimensions,
    projectType,
    config,
    weights: scoring.weights,
    deductions: scoring.deductions,
    scoreMethod: 'v2-weighted',
    score: finalScore,
    rawScore: scoring.rawScore,
    risks: activeRisks,
    ignoredRisks: suppression.ignored,
  acceptedRisks: suppression.accepted,
  };
}

function grade(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

const DIMENSION_EN = { documentation: 'Documentation', development: 'Development', debugging: 'Debugging', performance: 'Performance', functionality: 'Functionality', security: 'Security', github: 'GitHub' };

function renderReport(workspaces, locale) {
  const zh = locale === 'zh';
  const lines = [zh ? '# 工作区体检报告' : '# Workspace Audit Report', '', (zh ? '生成时间：' : 'Generated: ') + new Date().toISOString(), ''];
  for (const workspace of workspaces) {
    lines.push(
      `## ${workspace.title}`,
      '',
      (zh ? '- 路径：' : '- Path: ') + '`' + workspace.path + '`',
      (zh ? '- 项目类型：' : '- Project type: ') + (workspace.projectType || 'app'),
      (zh ? '- 评分：' : '- Score: ') + `**${workspace.score}/100 (${grade(workspace.score)})**${workspace.rawScore !== workspace.score ? ' (' + (zh ? 'P0 封顶，原始 ' : 'raw ') + workspace.rawScore + ')' : ''}`,
      (zh ? '- Git：' : '- Git: ') + (workspace.git.isRepo ? workspace.git.branch + ' · ' + (workspace.git.remote || 'no remote') : 'not a repository'),
      (zh ? '- 体积：' : '- Size: ') + Math.round(workspace.size.bytes / 1024 / 1024) + 'MB',
      (zh ? '- 测试文件：' : '- Test files: ') + workspace.testFiles,
      (zh ? '- TODO/FIXME：' : '- TODO/FIXME: ') + workspace.todo,
      '',
    );
    if (Array.isArray(workspace.deductions) && workspace.deductions.length > 0) {
      lines.push(zh ? '### 扣分明细' : '### Score deductions', '');
      for (const deduction of workspace.deductions.slice(0, 5)) lines.push(`- ${deduction.dimension}: ${deduction.points} points${deduction.reason ? ' · ' + deduction.reason : ''}`);
      lines.push('');
    }
    lines.push(zh ? '### 维度' : '### Dimensions', '');
    for (const [key, value] of Object.entries(workspace.dimensions)) lines.push(`- ${zh ? key : (DIMENSION_EN[key] || key)}: ${value}/100`);
    if (Array.isArray(workspace.commands) && workspace.commands.length > 0) lines.push((zh ? '- 命令：' : '- Commands: ') + workspace.commands.map((command) => '`' + command + '`').join(' · '));
    if (workspace.trend && workspace.trend.previousScore !== null) lines.push((zh ? '- 趋势：' : '- Trend: ') + (workspace.trend.delta >= 0 ? '+' : '') + workspace.trend.delta + ' from ' + workspace.trend.previousScore);
    if (workspace.baseline && workspace.baseline.score !== null) lines.push((zh ? '- 相对基线：' : '- vs baseline: ') + (workspace.baseline.delta >= 0 ? '+' : '') + workspace.baseline.delta + (workspace.baseline.newRiskIds.length > 0 ? ' · new: ' + workspace.baseline.newRiskIds.join(', ') : ''));
    if (workspace.dependencies && (workspace.dependencies.manifests.length > 0 || workspace.dependencies.lockfiles.length > 0)) {
      lines.push(`- ${zh ? '依赖' : 'Dependencies'}: manifests=${workspace.dependencies.manifests.join(',') || 'none'}; lockfiles=${workspace.dependencies.lockfiles.join(',') || 'none'}; vulnerabilities=${workspace.dependencies.vulnerabilities.total} (${workspace.dependencies.vulnerabilities.status})`);
    }
    if (workspace.github) lines.push(`- GitHub: ${workspace.github.owner}/${workspace.github.repo}; release=${workspace.github.latestRelease || 'none'}; issues=${workspace.github.openIssues ?? '—'}; PRs=${workspace.github.openPRs ?? '—'}; branchProtected=${workspace.github.branchProtected ?? '—'}`);
    lines.push('', zh ? '### 风险' : '### Risks', '');
    if (workspace.risks.length === 0) lines.push(zh ? '- 未发现阻塞风险。' : '- No blocking risks found.');
    for (const risk of workspace.risks || []) lines.push(`- **${risk.severity}** ${zh ? risk.text : (risk.en || risk.text)}`);
    for (const risk of workspace.acceptedRisks || []) lines.push(`- **${risk.severity}** (${zh ? '已接受' : 'accepted'}) ${zh ? risk.text : (risk.en || risk.text)}`);
    for (const risk of workspace.ignoredRisks || []) lines.push(`- **${risk.severity}** (${zh ? '已忽略' : 'ignored'}) ${zh ? risk.text : (risk.en || risk.text)}`);
    lines.push('');
  }
  return lines.join('\n');
}

function renderHandover(workspaces, locale) {
  const zh = locale === 'zh';
  const lines = [zh ? '# START HERE · 工作区交接说明' : '# START HERE · Workspace Handover', '', (zh ? '由 dsh-workspace-audit 生成：' : 'Generated by dsh-workspace-audit: ') + new Date().toISOString(), ''];
  for (const workspace of workspaces) {
    lines.push(`## ${workspace.title}`, '', (zh ? '- 路径：' : '- Path: ') + '`' + workspace.path + '`', (zh ? '- 类型：' : '- Type: ') + (workspace.projectType || 'app'), (zh ? '- 健康分：' : '- Health score: ') + workspace.score + '/100', '');
    lines.push(zh ? '### 启动与测试' : '### Run and test', '', ...(workspace.commands || []).map((command) => '- `' + command + '`'), '');
    lines.push(zh ? '### 先读什么' : '### Read first', '');
    if (workspace.markers.readme) lines.push(zh ? '- README（项目入口）' : '- README (project entry)');
    if (workspace.markers.docs) lines.push(zh ? '- docs/（架构与运维文档）' : '- docs/ (architecture and operations)');
    if (workspace.markers.ci) lines.push(zh ? '- .github/workflows（CI 流程）' : '- .github/workflows (CI)');
    lines.push('');
    lines.push(zh ? '### 当前风险' : '### Current risks', '');
    if ((workspace.risks || []).length === 0) lines.push(zh ? '- 未发现阻塞风险。' : '- No blocking risks.');
    for (const risk of workspace.risks || []) lines.push(`- **${risk.severity}** ${zh ? risk.text : (risk.en || risk.text)}`);
    for (const risk of workspace.acceptedRisks || []) lines.push(`- **${risk.severity}** (${zh ? '已接受' : 'accepted'}) ${zh ? risk.text : (risk.en || risk.text)}`);
    lines.push('', zh ? '### 注意' : '### Notes', '', zh ? '- 该文档来自静态规则与仓库状态，不是完整架构文档或专业安全审计。' : '- This document comes from static rules and repository state; it is not a complete architecture document or a professional security audit.', '');
  }
  return lines.join('\n');
}

function mapLimit(items, limit, worker, hooks) {
  const results = new Array(items.length);
  let next = 0;
  let completed = 0;
  let cancelled = false;
  const run = async () => {
    while (next < items.length) {
      if (hooks && typeof hooks.shouldCancel === 'function' && hooks.shouldCancel()) {
        cancelled = true;
        break;
      }
      const index = next;
      next += 1;
      try {
        results[index] = { ok: true, value: await worker(items[index]) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
      completed += 1;
      if (hooks && typeof hooks.onProgress === 'function') hooks.onProgress({ completed, total: items.length, index, path: items[index] && items[index].path });
    }
  };
  return Promise.all(Array.from({ length: Math.min(limit, items.length) }, run)).then(() => ({ results, cancelled }));
}

async function runScan(scanOptions) {
  const optionsIn = scanOptions || {};
  const startedAt = Date.now();
  const settings = optionsIn.settings || await loadSettings();
  const options = { online: settings.online === true };
  const discovered = optionsIn.discovered || await discoverWorkspaces(settings);
  const workspaces = [];
  const failures = [];
  const previousEntries = await loadHistory();
  const previous = previousEntries.length > 0 ? previousEntries[previousEntries.length - 1] : null;
  const baseline = await loadBaseline();
  const mapped = await mapLimit(discovered, 3, (workspace) => scanWorkspace(workspace, options), {
    shouldCancel: optionsIn.shouldCancel,
    onProgress: optionsIn.onProgress,
  });
  for (let index = 0; index < mapped.results.length; index += 1) {
    const result = mapped.results[index];
    if (!result) continue;
    if (result.ok) workspaces.push(result.value);
    else failures.push({ path: discovered[index].path, error: String((result.error && result.error.message) || result.error) });
  }
  workspaces.sort((left, right) => left.score - right.score);
  for (const workspace of workspaces) {
    const before = previous && Array.isArray(previous.workspaces) ? previous.workspaces.find((entry) => entry.path === workspace.path) : null;
    workspace.trend = { previousScore: before ? before.score : null, delta: before ? workspace.score - before.score : null };
    const base = Array.isArray(baseline.workspaces) ? baseline.workspaces.find((entry) => entry.path === workspace.path) : null;
    const activeIds = (workspace.risks || []).map((risk) => risk.id);
    const baseIds = base && Array.isArray(base.riskIds) ? base.riskIds : [];
    workspace.baseline = {
      createdAt: baseline.createdAt || null,
      score: base ? base.score : null,
      delta: base ? workspace.score - base.score : null,
      newRiskIds: base ? activeIds.filter((id) => !baseIds.includes(id)) : [],
      resolvedRiskIds: base ? baseIds.filter((id) => !activeIds.includes(id)) : [],
    };
  }
  const currentEntry = {
    at: Date.now(),
    workspaces: workspaces.map((workspace) => ({ path: workspace.path, score: workspace.score, dimensions: workspace.dimensions })),
  };
  if (!mapped.cancelled) await saveHistory([...previousEntries, currentEntry]).catch(() => {});
  return {
    generatedAt: Date.now(),
    durationMs: Date.now() - startedAt,
    settings,
    cancelled: mapped.cancelled === true,
    completed: mapped.results.filter(Boolean).length,
    total: discovered.length,
    environment: { git: await commandExists('git'), online: options.online },
    workspaces,
    failures,
    discovered: discovered.length,
    baseline: { createdAt: baseline.createdAt || null },
    report: renderReport(workspaces, 'zh'),
    reportEn: renderReport(workspaces, 'en'),
    handover: renderHandover(workspaces, 'zh'),
    handoverEn: renderHandover(workspaces, 'en'),
  };
}

function createJobRoutes() {
  const prune = () => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [id, job] of SCAN_JOBS) if (job.finishedAt && job.finishedAt < cutoff) SCAN_JOBS.delete(id);
  };
  return async (req, res) => {
    prune();
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (pathname === START_PATH) {
      if (req.method !== 'POST') { sendJson(res, 405, { error: 'method not allowed' }); return; }
      if (!requireToken(req, res)) return;
      const id = randomBytes(12).toString('hex');
      const settings = await loadSettings();
      const discovered = await discoverWorkspaces(settings);
      const job = { id, state: 'running', startedAt: Date.now(), total: discovered.length, progress: { completed: 0, total: discovered.length }, cancelRequested: false, result: null, error: null, finishedAt: 0 };
      SCAN_JOBS.set(id, job);
      (async () => {
        try {
          const result = await runScan({
            settings,
            discovered,
            shouldCancel: () => job.cancelRequested,
            onProgress: (progress) => { job.progress = progress; },
          });
          job.result = result;
          job.state = result.cancelled ? 'cancelled' : 'done';
        } catch (error) {
          job.error = String((error && error.message) || error);
          job.state = 'error';
        } finally {
          job.finishedAt = Date.now();
        }
      })();
      sendJson(res, 202, { jobId: id, total: job.total });
      return;
    }
    if (pathname === STATUS_PATH) {
      if (req.method !== 'GET') { sendJson(res, 405, { error: 'method not allowed' }); return; }
      if (!requireToken(req, res)) return;
      const id = new URL(req.url || '/', 'http://localhost').searchParams.get('jobId') || '';
      const job = SCAN_JOBS.get(id);
      if (!job) { sendJson(res, 404, { error: 'job not found' }); return; }
      sendJson(res, 200, { jobId: id, state: job.state, progress: job.progress, result: job.state === 'done' || job.state === 'cancelled' ? job.result : null, error: job.error });
      return;
    }
    if (pathname === CANCEL_PATH) {
      if (req.method !== 'POST') { sendJson(res, 405, { error: 'method not allowed' }); return; }
      if (!requireToken(req, res)) return;
      try {
        const body = await readJsonBody(req);
        const job = SCAN_JOBS.get(String(body.jobId || ''));
        if (!job) { sendJson(res, 404, { error: 'job not found' }); return; }
        job.cancelRequested = true;
        sendJson(res, 200, { ok: true, jobId: job.id, state: job.state });
      } catch (error) {
        sendJson(res, 400, { error: 'invalid json' });
      }
      return;
    }
    sendJson(res, 404, { error: 'not found' });
  };
}

function createBaselineRoute() {
  return async (req, res) => {
    if (!matchesPath(req, BASELINE_PATH)) { sendJson(res, 404, { error: 'not found' }); return; }
    if (req.method === 'GET') {
      if (!requireToken(req, res)) return;
      sendJson(res, 200, await loadBaseline());
      return;
    }
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'method not allowed' }); return; }
    if (!requireToken(req, res)) return;
    try {
      const body = await readJsonBody(req);
      if (body.action === 'clear') {
        const baseline = { createdAt: 0, workspaces: [] };
        await saveBaseline(baseline);
        sendJson(res, 200, { ok: true, baseline });
        return;
      }
      const workspaces = Array.isArray(body.workspaces) ? body.workspaces.slice(0, 100).map((workspace) => ({
        path: String(workspace.path || ''),
        score: Number(workspace.score) || 0,
        riskIds: Array.isArray(workspace.riskIds) ? workspace.riskIds.filter((id) => typeof id === 'string') : [],
        dimensions: workspace.dimensions && typeof workspace.dimensions === 'object' ? workspace.dimensions : {},
      })).filter((workspace) => workspace.path.length > 0) : [];
      const baseline = { createdAt: Date.now(), workspaces };
      await saveBaseline(baseline);
      sendJson(res, 200, { ok: true, baseline });
    } catch (error) {
      sendJson(res, 400, { error: 'invalid json' });
    }
  };
}

function createSettingsRoute() {
  return async (req, res) => {
    if (!matchesPath(req, SETTINGS_PATH)) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    if (req.method === 'GET') {
      if (!requireToken(req, res)) return;
      sendJson(res, 200, { settings: await loadSettings(), workspaces: await discoverWorkspaces(await loadSettings()) });
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method not allowed' });
      return;
    }
    if (!requireToken(req, res)) return;
    try {
      const body = await readJsonBody(req);
      const current = await loadSettings();
      const requested = [
        ...(Array.isArray(body.roots) ? body.roots : []),
        ...(typeof body.add === 'string' ? [body.add] : []),
      ];
      const roots = [...new Set([...current.roots, ...requested])]
        .map((entry) => String(entry).trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 30);
      const next = {
        roots,
        online: typeof body.online === 'boolean' ? body.online : current.online,
      };
      await saveSettings(next);
      sendJson(res, 200, { ok: true, settings: next });
    } catch (error) {
      sendJson(res, 400, { error: 'invalid json' });
    }
  };
}

function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: AUTH_PATH, handler: createAuthRoute() }), 'workspace-audit: auth');
  const jobRoutes = createJobRoutes();
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: START_PATH, handler: jobRoutes }), 'workspace-audit: scan start');
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: STATUS_PATH, handler: jobRoutes }), 'workspace-audit: scan status');
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: CANCEL_PATH, handler: jobRoutes }), 'workspace-audit: scan cancel');
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: SCAN_PATH, handler: createReadRoute(SCAN_PATH, () => runScan()) }), 'workspace-audit: scan sync');
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: HISTORY_PATH, handler: createReadRoute(HISTORY_PATH, () => loadHistory()) }), 'workspace-audit: history');
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: BASELINE_PATH, handler: createBaselineRoute() }), 'workspace-audit: baseline');
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: SETTINGS_PATH, handler: createSettingsRoute() }), 'workspace-audit: settings');
}

export { apply, scanWorkspace, discoverWorkspaces, dependencyHealth, githubHealth, parseGitHubRemote, renderReport, renderHandover, grade };
export const inject = ['webServer'];
