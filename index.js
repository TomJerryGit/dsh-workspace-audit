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
const SETTINGS_PATH = ROUTE + '/settings';
const HISTORY_PATH = ROUTE + '/history';
const MAX_WORKSPACES = 20;
const SKIP_NAMES = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache', '.ruff_cache', '.mypy_cache', 'dist', 'build', 'target', '.next', '.nuxt', 'coverage']);
const ARTIFACT_NAMES = new Set(['node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache', '.ruff_cache', '.mypy_cache', 'dist', 'build', 'target', '.next', '.nuxt', 'coverage', 'release-archive', 'test+files', 'BeeOffice-v5.2.3-windows', 'BeeOffice_logs']);
const GITHUB_CACHE = new Map();
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
    return { roots: Array.isArray(raw.roots) ? raw.roots.filter((entry) => typeof entry === 'string').slice(0, 30) : [] };
  } catch (error) {
    return { roots: [] };
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

async function gitInfo(root) {
  const run = async (args) => {
    try {
      const result = await execFileAsync('git', ['-C', root, ...args], { timeout: 8000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
      return String(result.stdout || '').trim();
    } catch (error) {
      return '';
    }
  };
  const isRepo = (await run(['rev-parse', '--is-inside-work-tree'])) === 'true';
  if (!isRepo) return { isRepo: false };
  const remote = await run(['remote', 'get-url', 'origin']);
  const branch = await run(['branch', '--show-current']);
  const status = await run(['status', '--porcelain']);
  const last = await run(['log', '-1', '--format=%h|%ad|%s', '--date=short']);
  const tags = await run(['tag', '--sort=-v:refname']);
  const tracked = await run(['ls-files']);
  return {
    isRepo: true,
    remote,
    branch,
    dirty: status.length === 0 ? 0 : status.split(/\r?\n/).filter(Boolean).length,
    last,
    tags: tags.split(/\r?\n/).filter(Boolean).slice(0, 5),
    tracked: tracked.length === 0 ? [] : tracked.split(/\r?\n/),
  };
}

async function commandExists(command) {
  try {
    await execFileAsync(command, ['--version'], { timeout: 5000, windowsHide: true });
    return true;
  } catch (error) {
    return false;
  }
}

async function dependencyHealth(root) {
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
  const vulnerabilities = { status: 'skipped', total: 0, tool: '' };
  if (names.includes('package-lock.json')) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    if (await commandExists(npmCommand)) {
      try {
        const result = await execFileAsync(npmCommand, ['audit', '--json', '--package-lock-only', '--omit=dev'], { cwd: root, timeout: 30000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
        const parsed = JSON.parse(String(result.stdout || '{}'));
        vulnerabilities.status = 'checked';
        vulnerabilities.total = Number(parsed.metadata && parsed.metadata.vulnerabilities && parsed.metadata.vulnerabilities.total) || 0;
        vulnerabilities.tool = 'npm audit';
      } catch (error) {
        try {
          const parsed = JSON.parse(String(error.stdout || '{}'));
          vulnerabilities.status = 'checked';
          vulnerabilities.total = Number(parsed.metadata && parsed.metadata.vulnerabilities && parsed.metadata.vulnerabilities.total) || 0;
          vulnerabilities.tool = 'npm audit';
        } catch (inner) {
          vulnerabilities.status = 'error';
          vulnerabilities.tool = 'npm audit';
        }
      }
    }
  } else if (requirementFile) {
    const pipAudit = process.platform === 'win32' ? 'pip-audit.exe' : 'pip-audit';
    if (await commandExists(pipAudit)) {
      try {
        const result = await execFileAsync(pipAudit, ['-r', requirementFile, '--format', 'json'], { cwd: root, timeout: 30000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
        const parsed = JSON.parse(String(result.stdout || '[]'));
        vulnerabilities.status = 'checked';
        vulnerabilities.total = Array.isArray(parsed) ? parsed.reduce((sum, entry) => sum + (Array.isArray(entry.vulns) ? entry.vulns.length : 0), 0) : 0;
        vulnerabilities.tool = 'pip-audit';
      } catch (error) {
        vulnerabilities.status = 'error';
        vulnerabilities.tool = 'pip-audit';
      }
    }
  }
  return { manifests, lockfiles, unpinned, vulnerabilities };
}

function parseGitHubRemote(remote) {
  const match = String(remote || '').match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  return match ? { owner: match[1], repo: match[2] } : null;
}

async function githubHealth(git) {
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
  const value = { provider: 'github', owner: parsed.owner, repo: parsed.repo };
  try {
    const repoRes = await request('https://api.github.com/repos/' + parsed.owner + '/' + parsed.repo);
    if (repoRes.ok) {
      const repo = await repoRes.json();
      value.openIssues = repo.open_issues_count;
      value.stars = repo.stargazers_count;
      value.archived = repo.archived === true;
      value.pushedAt = repo.pushed_at;
      value.defaultBranch = repo.default_branch;
      value.permissions = repo.permissions || null;
    } else {
      value.status = repoRes.status;
    }
    const releaseRes = await request('https://api.github.com/repos/' + parsed.owner + '/' + parsed.repo + '/releases/latest');
    if (releaseRes.ok) {
      const release = await releaseRes.json();
      value.latestRelease = release.tag_name;
      value.releaseName = release.name;
      value.releasePublishedAt = release.published_at;
    } else {
      value.latestRelease = '';
    }
    const branch = git.branch || value.defaultBranch || 'main';
    const protectionRes = await request('https://api.github.com/repos/' + parsed.owner + '/' + parsed.repo + '/branches/' + encodeURIComponent(branch) + '/protection');
    value.branchProtected = protectionRes.ok ? true : protectionRes.status === 403 ? 'unknown' : false;
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

async function scanWorkspace(workspace) {
  const root = workspace.path;
  const git = await gitInfo(root);
  const dependencies = await dependencyHealth(root);
  const github = await githubHealth(git);
  const tracked = Array.isArray(git.tracked) ? git.tracked : [];
  const rootEntries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const commands = await commandHints(root, rootEntries);
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
  for (const file of tracked.slice(0, 3000)) {
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
  const score = Math.round(Object.values(dimensions).reduce((sum, value) => sum + value, 0) / 7);
  const risks = [];
  if (!git.isRepo) risks.push({ severity: 'P2', text: '目录未初始化 Git，无法追踪变更、回滚或协作。' });
  if (git.isRepo && git.dirty > 0) risks.push({ severity: 'P1', text: `工作区有 ${git.dirty} 个未提交变更，发布前需确认。` });
  if (git.isRepo && !git.remote) risks.push({ severity: 'P2', text: '仓库没有 origin 远端，缺少异地备份/协作。' });
  if (!markers.readme) risks.push({ severity: 'P1', text: '缺少 README，后来开发者难以启动项目。' });
  if (!markers.ci) risks.push({ severity: 'P1', text: '缺少 CI，测试/构建容易回归。' });
  if (workflows.some((wf) => wf.selfHosted && wf.pullRequest)) risks.push({ severity: 'P0', text: '自托管 Runner 被 pull_request 触发，公开仓库存在不可信代码执行风险。' });
  if (secretFiles.length > 0) risks.push({ severity: 'P1', text: `发现疑似密钥文件：${secretFiles.slice(0, 5).join(', ')}（只检查了文件名，未读取内容）。` });
  if (dangerous > 10) risks.push({ severity: 'P1', text: `发现 ${dangerous} 处 shell=True/exec/pickle.load 高危模式，需确认输入来源。` });
  else if (dangerous > 0) risks.push({ severity: 'P2', text: `发现 ${dangerous} 处 shell=True/exec/pickle.load 模式，建议人工确认。` });
  const significantArtifacts = artifacts.filter((item) => item.bytes >= 1024 * 1024);
  if (significantArtifacts.length > 0) {
    const huge = significantArtifacts.some((item) => item.bytes >= 1024 * 1024 * 1024);
    risks.push({ severity: huge ? 'P1' : 'P2', text: `发现构建/缓存目录：${significantArtifacts.map((item) => item.name + ' ' + Math.round(item.bytes / 1024 / 1024) + 'MB').join(', ')}。` });
  }
  if (dependencies.vulnerabilities.total > 0) risks.push({ severity: dependencies.vulnerabilities.total >= 5 ? 'P0' : 'P1', text: `${dependencies.vulnerabilities.tool || '依赖扫描'} 发现 ${dependencies.vulnerabilities.total} 个依赖漏洞。` });
  if (dependencies.lockfiles.length === 0 && dependencies.manifests.length > 0) risks.push({ severity: 'P2', text: '依赖清单存在但没有检测到锁文件。' });
  if (dependencies.unpinned > 5) risks.push({ severity: 'P2', text: `requirements 中有 ${dependencies.unpinned} 条非精确版本约束。` });
  if (github && github.latestRelease && git.tags && git.tags.length > 0 && github.latestRelease !== git.tags[0]) risks.push({ severity: 'P2', text: `Git tag ${git.tags[0]} 与 GitHub latest release ${github.latestRelease} 不一致。` });
  if (github && github.archived === true) risks.push({ severity: 'P2', text: 'GitHub 仓库已归档（archived）。' });
  if (github && github.branchProtected === false) risks.push({ severity: 'P2', text: 'GitHub 默认分支未检测到保护规则。' });
  if (todo > 20) risks.push({ severity: 'P2', text: `源码中约 ${todo} 处 TODO/FIXME，建议建立清理计划。` });
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
    score,
    risks,
  };
}

function grade(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

function renderReport(workspaces) {
  const lines = ['# Workspace Audit Report', '', `Generated: ${new Date().toISOString()}`, ''];
  for (const workspace of workspaces) {
    lines.push(`## ${workspace.title}`, '', `- Path: \`${workspace.path}\``, `- Score: **${workspace.score}/100 (${grade(workspace.score)})**`, `- Git: ${workspace.git.isRepo ? workspace.git.branch + ' · ' + (workspace.git.remote || 'no remote') : 'not a repository'}`, `- Size: ${Math.round(workspace.size.bytes / 1024 / 1024)}MB`, `- Test files: ${workspace.testFiles}`, `- TODO/FIXME: ${workspace.todo}`, '');
    lines.push('### Dimensions', '');
    for (const [key, value] of Object.entries(workspace.dimensions)) lines.push(`- ${key}: ${value}/100`);
    if (Array.isArray(workspace.commands) && workspace.commands.length > 0) lines.push(`- Commands: ${workspace.commands.map((command) => '`' + command + '`').join(' · ')}`);
    if (workspace.trend && workspace.trend.previousScore !== null) lines.push(`- Trend: ${workspace.trend.delta >= 0 ? '+' : ''}${workspace.trend.delta} from ${workspace.trend.previousScore}`);
    if (workspace.dependencies && (workspace.dependencies.manifests.length > 0 || workspace.dependencies.lockfiles.length > 0)) {
      lines.push(`- Dependencies: manifests=${workspace.dependencies.manifests.join(',') || 'none'}; lockfiles=${workspace.dependencies.lockfiles.join(',') || 'none'}; vulnerabilities=${workspace.dependencies.vulnerabilities.total} (${workspace.dependencies.vulnerabilities.status})`);
    }
    if (workspace.github) lines.push(`- GitHub: ${workspace.github.owner}/${workspace.github.repo}; release=${workspace.github.latestRelease || 'none'}; issues=${workspace.github.openIssues ?? '—'}; branchProtected=${workspace.github.branchProtected ?? '—'}`);
    lines.push('', '### Risks', '');
    if (workspace.risks.length === 0) lines.push('- No blocking risks found.');
    for (const risk of workspace.risks) lines.push(`- **${risk.severity}** ${risk.text}`);
    lines.push('');
  }
  return lines.join('\n');
}

async function runScan() {
  const settings = await loadSettings();
  const discovered = await discoverWorkspaces(settings);
  const workspaces = [];
  const failures = [];
  const previousEntries = await loadHistory();
  const previous = previousEntries.length > 0 ? previousEntries[previousEntries.length - 1] : null;
  for (const workspace of discovered) {
    try {
      workspaces.push(await scanWorkspace(workspace));
    } catch (error) {
      failures.push({ path: workspace.path, error: String((error && error.message) || error) });
    }
  }
  workspaces.sort((left, right) => left.score - right.score);
  for (const workspace of workspaces) {
    const before = previous && Array.isArray(previous.workspaces) ? previous.workspaces.find((entry) => entry.path === workspace.path) : null;
    workspace.trend = { previousScore: before ? before.score : null, delta: before ? workspace.score - before.score : null };
  }
  const currentEntry = {
    at: Date.now(),
    workspaces: workspaces.map((workspace) => ({ path: workspace.path, score: workspace.score, dimensions: workspace.dimensions })),
  };
  await saveHistory([...previousEntries, currentEntry]).catch(() => {});
  return { generatedAt: Date.now(), workspaces, failures, discovered: discovered.length, report: renderReport(workspaces) };
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
      const next = { roots };
      await saveSettings(next);
      sendJson(res, 200, { ok: true, settings: next });
    } catch (error) {
      sendJson(res, 400, { error: 'invalid json' });
    }
  };
}

function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: AUTH_PATH, handler: createAuthRoute() }), 'workspace-audit: auth');
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: SCAN_PATH, handler: createReadRoute(SCAN_PATH, () => runScan()) }), 'workspace-audit: scan');
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: HISTORY_PATH, handler: createReadRoute(HISTORY_PATH, () => loadHistory()) }), 'workspace-audit: history');
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: SETTINGS_PATH, handler: createSettingsRoute() }), 'workspace-audit: settings');
}

export { apply, scanWorkspace, discoverWorkspaces, dependencyHealth, githubHealth, parseGitHubRemote, renderReport, grade };
export const inject = ['webServer'];
