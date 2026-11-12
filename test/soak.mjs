/** Long-running scanner soak: repeated fixture scans, timing and heap growth. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanWorkspace } from '../index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const iterations = Number(process.env.SOAK_ITERATIONS || 15);
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-audit-soak-'));
try {
  await fs.cp(path.join(here, 'fixtures', 'basic'), root, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'soak@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Soak'], { cwd: root });
  execFileSync('git', ['add', '-A', '-f'], { cwd: root });
  execFileSync('git', ['commit', '-q', '-m', 'soak'], { cwd: root });
  const baseline = process.memoryUsage().heapUsed;
  const times = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = Date.now();
    const result = await scanWorkspace({ path: root, title: 'soak' }, { noCache: true });
    assert.ok(result.score >= 0 && result.score <= 100);
    times.push(Date.now() - started);
  }
  const heapGrowth = process.memoryUsage().heapUsed - baseline;
  const average = times.reduce((sum, value) => sum + value, 0) / times.length;
  console.log(JSON.stringify({ iterations, averageMs: Math.round(average), maxMs: Math.max(...times), heapGrowthMB: Math.round(heapGrowth / 1024 / 1024) }));
  assert.ok(average < 5000, 'average fixture scan should stay under 5s');
  assert.ok(heapGrowth < 100 * 1024 * 1024, 'heap growth should stay under 100MB');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
