// cPanel Passenger startup file. Each process resolves the selected release once.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const selected = path.join(__dirname, 'current');
const managed = fs.existsSync(selected);
const release = managed ? fs.realpathSync(selected) : __dirname;
if (managed) {
  const releases = fs.realpathSync(path.join(__dirname, 'releases')) + path.sep;
  if (!release.startsWith(releases)) throw new Error('Invalid selected release.');
}
process.chdir(release);
require(path.join(release, 'node_modules/@next/env')).loadEnvConfig(release);

function validateConfiguration() {
  const environment = process.env.SITE_ENV || 'development';
  if (!['development', 'staging', 'production'].includes(environment)) throw new Error('Invalid SITE_ENV.');
  const marker = path.join(release, '.release-environment');
  if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').trim() !== environment) {
    throw new Error('Application environment does not match the built release.');
  }
  if (environment !== 'development') {
    const publicUrl = new URL(process.env.SITE_URL);
    const deployedUrl = new URL(process.env.DEPLOYMENT_URL);
    const graphqlUrl = new URL(process.env.WORDPRESS_GRAPHQL_URL);
    if ([publicUrl, deployedUrl, graphqlUrl].some((url) => url.protocol !== 'https:' || url.username || url.password)) throw new Error('Deployment URLs require HTTPS without embedded credentials.');
    if (!/^\/graphql\/?$/.test(graphqlUrl.pathname) || graphqlUrl.search || graphqlUrl.hash) throw new Error('Use the WPGraphQL /graphql endpoint.');
    if (graphqlUrl.origin === publicUrl.origin || graphqlUrl.origin === deployedUrl.origin) throw new Error('WordPress requires a separate CMS origin.');
    if (environment === 'production' && deployedUrl.origin !== publicUrl.origin) throw new Error('Production deployment must use the public site origin.');
    if (environment === 'staging' && deployedUrl.origin === publicUrl.origin) throw new Error('Staging must use a separate frontend origin.');
    if (environment === 'staging' && process.env.CRM_SIGNUP_ENABLED === 'true' &&
      (process.env.CRM_SIGNUP_STAGING_ALLOWED !== 'true' || process.env.CRM_WORKFLOWS_VERIFIED !== 'true' || !process.env.CRM_TEST_LOCATION_ID || !process.env.CRM_TEST_PRIVATE_TOKEN ||
        process.env.CRM_TEST_LOCATION_ID === process.env.CRM_LOCATION_ID || process.env.CRM_TEST_PRIVATE_TOKEN === process.env.CRM_PRIVATE_TOKEN)) {
      throw new Error('Staging signup requires an explicitly configured CRM test location.');
    }
  }
  const commitFile = path.join(release, '.release-commit');
  if (fs.existsSync(commitFile)) {
    const commit = fs.readFileSync(commitFile, 'utf8').trim();
    if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid release commit.');
    process.env.RELEASE_COMMIT = commit;
  }
}
validateConfiguration();
if (process.argv.includes('--check-config')) process.exit(0);
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
const next = require(path.join(release, 'node_modules/next'));
const application = next({ dev: false, dir: release, hostname: '127.0.0.1', port });
const handler = application.getRequestHandler();
application.prepare().then(() => {
  http.createServer((request, response) => handler(request, response)).listen(port, '127.0.0.1');
}).catch(() => {
  console.error('Unable to start the selected frontend release. Inspect the private application log.');
  process.exit(1);
});
