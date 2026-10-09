import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const code = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
const defaults = {
  NODE_ENV: 'production', SITE_ENV: 'staging', SITE_URL: 'https://site.example',
  DEPLOYMENT_URL: 'https://staging.site.example', WORDPRESS_GRAPHQL_URL: 'https://cms.site.example/graphql',
};
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'readyspace-bootstrap-'));
  const release = path.join(directory, 'releases', 'verified');
  fs.mkdirSync(path.join(release, 'node_modules', '@next', 'env'), { recursive: true });
  fs.writeFileSync(path.join(release, 'node_modules', '@next', 'env', 'index.js'), 'exports.loadEnvConfig = () => {};');
  fs.writeFileSync(path.join(directory, 'app.js'), code);
  fs.writeFileSync(path.join(release, '.release-environment'), 'staging');
  fs.writeFileSync(path.join(release, '.release-commit'), 'a'.repeat(40));
  fs.symlinkSync(release, path.join(directory, 'current'));
  const run = (overrides: Record<string, string> = {}, check = true) => spawnSync(process.execPath, [path.join(directory, 'app.js'), ...(check ? ['--check-config'] : [])], {
    env: { ...defaults, ...overrides } as NodeJS.ProcessEnv, encoding: 'utf8', timeout: 5000,
  });
  return { directory, release, run, cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

test('Passenger bootstrap checks selected release and environment before starting', () => {
  const f = fixture();
  try {
    assert.equal(f.run().status, 0);
    assert.notEqual(f.run({ SITE_ENV: 'production', DEPLOYMENT_URL: defaults.SITE_URL }).status, 0);
    assert.notEqual(f.run({ WORDPRESS_GRAPHQL_URL: 'https://cms.site.example/wp-json/rankmath/v1/getHead' }).status, 0);
    assert.notEqual(f.run({ WORDPRESS_GRAPHQL_URL: 'https://site.example/graphql' }).status, 0);
    assert.notEqual(f.run({ DEPLOYMENT_URL: defaults.SITE_URL }).status, 0);
    assert.notEqual(f.run({ CRM_SIGNUP_ENABLED: 'true' }).status, 0);
    const isolatedCrm = { CRM_SIGNUP_ENABLED: 'true', CRM_SIGNUP_STAGING_ALLOWED: 'true', CRM_WORKFLOWS_VERIFIED: 'true', CRM_TEST_LOCATION_ID: 'synthetic-test-location', CRM_TEST_PRIVATE_TOKEN: 'synthetic-test-token' };
    assert.equal(f.run(isolatedCrm).status, 0);
    assert.notEqual(f.run({ ...isolatedCrm, CRM_LOCATION_ID: isolatedCrm.CRM_TEST_LOCATION_ID }).status, 0);
    assert.notEqual(f.run({ ...isolatedCrm, CRM_PRIVATE_TOKEN: isolatedCrm.CRM_TEST_PRIVATE_TOKEN }).status, 0);
  } finally { f.cleanup(); }
});

test('Passenger bootstrap rejects pointers outside this application and invalid release commits', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.release, '.release-commit'), 'not-a-commit');
    assert.notEqual(f.run().status, 0);
    fs.unlinkSync(path.join(f.directory, 'current'));
    fs.symlinkSync(os.tmpdir(), path.join(f.directory, 'current'));
    assert.notEqual(f.run().status, 0);
  } finally { f.cleanup(); }
});

test('Passenger bootstrap identifies the resolved release rather than stale host environment', () => {
  const f = fixture();
  try {
    fs.mkdirSync(path.join(f.release, 'node_modules', 'next'));
    fs.writeFileSync(path.join(f.release, 'node_modules', 'next', 'index.js'), `module.exports = (options) => {
      console.log(JSON.stringify({ commit: process.env.RELEASE_COMMIT, directory: options.dir, cwd: process.cwd() }));
      return { getRequestHandler: () => () => {}, prepare: () => Promise.reject(new Error('synthetic stop')) };
    };`);
    const result = f.run({ RELEASE_COMMIT: 'b'.repeat(40) }, false);
    const value = JSON.parse(result.stdout.trim());
    assert.equal(value.commit, 'a'.repeat(40));
    assert.equal(value.directory, fs.realpathSync(f.release));
    assert.equal(value.cwd, fs.realpathSync(f.release));
  } finally { f.cleanup(); }
});
