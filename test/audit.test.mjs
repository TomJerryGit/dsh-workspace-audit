import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dependencyHealth, grade, parseGitHubRemote, renderReport, scanWorkspace } from '../index.js';

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
    assert.ok(result.secretFiles.includes('.env'));
    assert.ok(result.workflows.some((workflow) => workflow.pullRequest && workflow.selfHosted));
    assert.ok(result.risks.some((risk) => risk.severity === 'P0'));
    assert.ok(result.todo >= 1);
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.equal(result.github, null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('renders a markdown report with risks and dependencies', async () => {
  const root = await fixtureCopy();
  try {
    const result = await scanWorkspace({ path: root, title: 'fixture' });
    const report = renderReport([result]);
    assert.match(report, /## fixture/);
    assert.match(report, /Score:/);
    assert.match(report, /P0/);
    assert.match(report, /Dependencies:/);
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

test('dependency health reports manifests and lockfiles', async () => {
  const root = await fixtureCopy();
  try {
    const result = await dependencyHealth(root);
    assert.ok(result.manifests.includes('package.json'));
    assert.deepEqual(result.lockfiles, []);
    assert.ok(['skipped', 'checked', 'error'].includes(result.vulnerabilities.status));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
