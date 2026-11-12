import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dependencyHealth, githubHealth, grade, parseGitHubRemote, renderHandover, renderReport, scanWorkspace } from '../index.js';

const here = path.dirname(fileURLToPath(import.meta.url));

async function fixtureCopy() {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-audit-test-'));
  await fs.cp(path.join(here, 'fixtures', 'basic'), target, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: target });
  execFileSync('git', ['config', 'user.email', 'fixture@example.com'], { cwd: target });
  execFileSync('git', ['config', 'user.name', 'Fixture'], { cwd: target });
  execFileSync('git', ['add', '-A', '-f'], { cwd: target });
  execFileSync('git', ['commit', '-q', '-m', 'fixture'], { cwd: target });
  return target;
}

test('scans a fixture workspace and identifies risks', async () => {
  const root = await fixtureCopy();
  try {
    const result = await scanWorkspace({ path: root, title: 'fixture' });
    assert.equal(result.markers.readme, true);
    assert.equal(result.markers.license, true);
    assert.equal(result.markers.ci, true);
    assert.equal(result.testFiles, 1);
    await fs.writeFile(path.join(root, '.env.local'), 'DEMO=untracked\n');
    const withUntracked = await scanWorkspace({ path: root, title: 'fixture' }, { noCache: true });
    assert.ok(withUntracked.secretFiles.includes('.env.local'));
    assert.ok(result.secretFiles.includes('.env'));
    assert.ok(result.workflows.some((workflow) => workflow.pullRequest && workflow.selfHosted));
    assert.ok(result.risks.some((risk) => risk.severity === 'P0'));
    assert.ok(result.todo >= 1);
    assert.ok(result.commands.includes('npm install'));
    assert.equal(result.projectType, 'app');
    assert.ok(Array.isArray(result.deductions));
    assert.ok(result.score <= 59, 'P0 must cap the score at 59');
    assert.ok(result.rawScore >= result.score);
    assert.equal(result.github, null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('workspace config ignores and accepts risks', async () => {
  const root = await fixtureCopy();
  try {
    await fs.writeFile(path.join(root, '.workspace-audit.json'), JSON.stringify({
      ignore: ['dangerous-exec'],
      accept: [{ rule: 'self-hosted-pr', reason: 'internal runner', until: '2030-01-01' }],
    }));
    const result = await scanWorkspace({ path: root, title: 'fixture' }, { noCache: true });
    assert.ok(result.ignoredRisks.some((risk) => risk.id === 'dangerous-exec'));
    assert.ok(result.acceptedRisks.some((risk) => risk.id === 'self-hosted-pr'));
    assert.equal(result.risks.some((risk) => risk.id === 'self-hosted-pr'), false, 'accepted risk should not stay active');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('renders a markdown report with risks and dependencies', async () => {  const root = await fixtureCopy();
  try {
    const result = await scanWorkspace({ path: root, title: 'fixture' });
    const report = renderReport([result]);
    assert.match(report, /## fixture/);
    assert.match(report, /Score:/);
    assert.match(report, /P0/);
    assert.match(report, /Dependencies:/);
    assert.match(report, /Debugging:/);
    const handover = renderHandover([result]);
    assert.match(handover, /START HERE/);
    assert.match(handover, /Run and test/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('parses GitHub remotes and grades', () => {
  assert.deepEqual(parseGitHubRemote('git@github.com:owner/repo.git'), { owner: 'owner', repo: 'repo' });
  assert.deepEqual(parseGitHubRemote('https://github.com/owner/repo'), { owner: 'owner', repo: 'repo' });
  assert.equal(parseGitHubRemote('https://example.com/owner/repo'), null);
  assert.equal(grade(90), 'A');
  assert.equal(grade(70), 'B');
  assert.equal(grade(55), 'C');
  assert.equal(grade(10), 'D');
});

test('dependency health is offline by default', async () => {
  const root = await fixtureCopy();
  try {
    const result = await dependencyHealth(root);
    assert.ok(result.manifests.includes('package.json'));
    assert.deepEqual(result.lockfiles, []);
    assert.equal(result.vulnerabilities.status, 'offline');
    assert.equal(await githubHealth({ remote: 'https://github.com/owner/repo' }, { online: false }), null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('github health separates issues/PRs and classifies protection', async () => {
  const originalFetch = globalThis.fetch;
  const response = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (name) => headers[name.toLowerCase()] ?? null }, json: async () => body });
  globalThis.fetch = async (url) => {
    if (String(url).includes('/search/issues') && String(url).includes('is%3Aissue')) return response(200, { total_count: 3 });
    if (String(url).includes('/search/issues') && String(url).includes('is%3Apr')) return response(200, { total_count: 1 });
    if (String(url).endsWith('/releases/latest')) return response(200, { tag_name: 'v1.2.3', name: 'v1.2.3', published_at: '2026-01-01T00:00:00Z' });
    if (String(url).includes('/protection')) return response(404, {});
    if (String(url).includes('/repos/test-owner/health-repo')) return response(200, { open_issues_count: 4, stargazers_count: 1, archived: false, default_branch: 'main', permissions: {} });
    return response(404, {});
  };
  try {
    const result = await githubHealth({ remote: 'https://github.com/test-owner/health-repo', branch: 'main' }, { online: true });
    assert.equal(result.status, 'ok');
    assert.equal(result.openIssues, 3);
    assert.equal(result.openPRs, 1);
    assert.equal(result.latestRelease, 'v1.2.3');
    assert.equal(result.branchProtected, 'unprotected');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('github rate limit is not reported as unprotected', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 403, headers: { get: (name) => name.toLowerCase() === 'x-ratelimit-remaining' ? '0' : null }, json: async () => ({}) });
  try {
    const result = await githubHealth({ remote: 'https://github.com/rate-limit/audit', branch: 'main' }, { online: true });
    assert.equal(result.status, 'rate_limited');
    assert.equal(result.branchProtected, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
