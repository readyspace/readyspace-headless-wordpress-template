import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Execute the actual rollback control flow inside a temporary account tree.
// Only the /home/account guard is relocated. Host services, network and Linux
// utility semantics are stubbed; no cPanel account or application is contacted.
const source = fs.readFileSync(path.join(process.cwd(), 'scripts/rollback.sh'), 'utf8');
const currentCommit = 'a'.repeat(40), previousCommit = 'b'.repeat(40);
function runRollback(mode: 'success' | 'restart-failure' | 'termination' | 'unhealthy') {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'readyspace-rollback-')));
  const account = path.join(directory, 'account');
  const app = path.join(account, 'apps', 'site');
  const current = path.join(app, 'releases', 'current-build');
  const previous = path.join(app, 'releases', 'previous-build');
  const bin = path.join(directory, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(path.join(app, 'tmp'), { recursive: true });
  for (const [release, commit] of [[current, currentCommit], [previous, previousCommit]]) {
    fs.mkdirSync(path.join(release, '.next'), { recursive: true });
    fs.mkdirSync(path.join(release, 'node_modules', '@next', 'env'), { recursive: true });
    fs.writeFileSync(path.join(release, '.release-commit'), commit);
    fs.writeFileSync(path.join(release, '.release-environment'), 'production');
    fs.writeFileSync(path.join(release, '.next', 'BUILD_ID'), 'synthetic-build');
    fs.writeFileSync(path.join(release, 'app.js'), `// ${commit}\nprocess.exit(0);\n`);
    fs.writeFileSync(path.join(release, 'node_modules', '@next', 'env', 'index.js'), `exports.loadEnvConfig = () => { process.env.DEPLOYMENT_URL = 'https://site.example'; };`);
  }
  fs.symlinkSync(current, path.join(app, 'current'));
  fs.writeFileSync(path.join(app, 'app.js'), fs.readFileSync(path.join(current, 'app.js')));
  fs.writeFileSync(path.join(app, '.previous-release'), previous + '\n');
  const script = path.join(directory, 'rollback.sh');
  const relocated = source.replaceAll('"/home/$(id -un)/"', JSON.stringify(account + '/'));
  assert.notEqual(relocated, source, 'Account path guard must be relocated for local tests');
  fs.writeFileSync(script, relocated);
  const wrapper = (name: string, code: string) => {
    fs.writeFileSync(path.join(bin, name), `#!${process.execPath}\n${code}\n`, { mode: 0o755 });
  };
  wrapper('flock', 'process.exit(0);');
  wrapper('sleep', 'process.exit(0);');
  wrapper('mv', `const fs = require('node:fs'); const args = process.argv.slice(2).filter(value => !value.startsWith('-')); fs.renameSync(args[0], args[1]);`);
  wrapper('touch', `const fs = require('node:fs'); const marker = ${JSON.stringify(path.join(directory, 'injected-once'))};
    if (!fs.existsSync(marker) && ['restart-failure', 'termination'].includes(process.env.ROLLBACK_TEST_MODE)) {
      fs.writeFileSync(marker, 'injected');
      if (process.env.ROLLBACK_TEST_MODE === 'restart-failure') process.exit(42);
      process.kill(process.ppid, 'SIGTERM'); setTimeout(() => process.exit(0), 50);
    } else { for (const value of process.argv.slice(2)) fs.closeSync(fs.openSync(value, 'a')); }`);
  wrapper('curl', `const fs = require('node:fs'); const app = ${JSON.stringify(app)};
    const selected = fs.realpathSync(app + '/current');
    const commit = fs.readFileSync(selected + '/.release-commit', 'utf8').trim();
    const args = process.argv.slice(2); const output = args[args.indexOf('-o') + 1];
    const ok = !(process.env.ROLLBACK_TEST_MODE === 'unhealthy' && commit === ${JSON.stringify(previousCommit)});
    fs.writeFileSync(output, JSON.stringify({ok, commit}));`);
  try {
    const result = spawnSync('/bin/bash', [script, app, 'https://site.example/api/health', currentCommit], {
      encoding: 'utf8', timeout: 15000,
      env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, ROLLBACK_TEST_MODE: mode },
    });
    return {
      ...result, selected: fs.realpathSync(path.join(app, 'current')),
      bootstrap: fs.readFileSync(path.join(app, 'app.js'), 'utf8'),
      pointer: fs.readFileSync(path.join(app, '.previous-release'), 'utf8').trim(),
      expectedSelected: mode === 'success' ? previous : current,
      expectedPointer: mode === 'success' ? current : previous,
    };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test('rollback selects and verifies the prior release before replacing recovery history', () => {
  const result = runRollback('success');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.selected, result.expectedSelected);
  assert.equal(result.pointer, result.expectedPointer);
  assert.match(result.bootstrap, new RegExp(previousCommit));
});
for (const mode of ['restart-failure', 'termination', 'unhealthy'] as const) {
  test(`rollback recovers original pointer, bootstrap and history after ${mode}`, () => {
    const result = runRollback(mode);
    assert.notEqual(result.status, 0, result.stdout);
    assert.equal(result.signal, null, 'Termination must become a handled nonzero exit');
    assert.equal(result.selected, result.expectedSelected, result.stderr);
    assert.equal(result.pointer, result.expectedPointer);
    assert.match(result.bootstrap, new RegExp(currentCommit));
    assert.match(result.stderr, /original serving commit recovered/);
  });
}
