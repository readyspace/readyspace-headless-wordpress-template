#!/usr/bin/env bash
# Run on the owning Linux cPanel account after reviewing the exact commit.
set -euo pipefail
umask 077
[[ $# == 6 ]] || { printf '%s\n' 'Usage: deploy.sh staging|production CHECKOUT APP_ROOT PRIVATE_ENV_FILE HEALTH_URL REVIEWED_COMMIT'; exit 2; }
environment=$1 checkout=$2 app_root=$3 env_file=$4 health_url=$5 reviewed=$6
case "$environment" in staging) branch=staging ;; production) branch=main ;; *) printf '%s\n' 'Only staging or production may be deployed'; exit 2 ;; esac
[[ "$reviewed" =~ ^[a-f0-9]{40}$ ]] || { printf '%s\n' 'An exact reviewed 40-character commit is required'; exit 2; }
account_home="/home/$(id -un)"
checkout="$(realpath "$checkout")"
app_root="$(realpath -m "$app_root")"
env_file_original=$env_file
env_file="$(realpath "$env_file")"
[[ "$app_root" == "$account_home/"* && "$checkout" == "$account_home/"* && "$env_file" == "$account_home/"* ]] || { printf '%s\n' 'Use absolute paths belonging to the signed-in cPanel account'; exit 2; }
[[ "$app_root" != *'/public_html' && "$app_root" != *'/public_html/'* && "$checkout" != *'/public_html' && "$checkout" != *'/public_html/'* && "$env_file" != *'/public_html/'* ]] || { printf '%s\n' 'Application, checkout and secrets must stay outside public_html'; exit 2; }
[[ -f "$env_file" && ! -L "$env_file_original" ]] || { printf '%s\n' 'Private server environment file is missing or a symlink'; exit 2; }
[[ "$(stat -c %u "$env_file")" == "$(id -u)" && "$(stat -c %a "$env_file")" == 600 ]] || { printf '%s\n' 'The private environment file must be owned by this account with mode 600'; exit 2; }
for dependency in git node npm curl flock tar; do command -v "$dependency" >/dev/null || { printf 'Missing host dependency: %s\n' "$dependency"; exit 2; }; done
node -e 'const major=Number(process.versions.node.split(".")[0]); process.exit(major>=22 && major<25 ? 0 : 1)' || { printf '%s\n' 'Activate a supported cPanel Node 22-24 environment before deployment'; exit 2; }
[[ "$(git -C "$checkout" branch --show-current)" == "$branch" ]] || { printf '%s\n' 'Checkout branch does not match the deployment environment'; exit 2; }
[[ -z "$(git -C "$checkout" status --porcelain)" ]] || { printf '%s\n' 'Commit or remove checkout changes before deployment'; exit 2; }
[[ "$env_file" != "$checkout/"* && "$env_file" != "$app_root/releases/"* ]] || { printf '%s\n' 'Keep the persistent environment file outside checkouts and releases'; exit 2; }
[[ "$app_root" != "$checkout" && "$app_root" != "$checkout/"* && "$checkout" != "$app_root/"* ]] || { printf '%s\n' 'Use separate checkout and application directories'; exit 2; }
mkdir -p "$app_root/releases" "$app_root/tmp" "$app_root/public"
[[ ! -L "$app_root" && ! -L "$app_root/releases" ]] || { printf '%s\n' 'Application and release directories cannot be symlinks'; exit 2; }
app_root="$(realpath "$app_root")"
# The web server may traverse the app root and public alias, never private releases.
chmod 711 "$app_root"
chmod 755 "$app_root/public"
chmod 700 "$app_root/releases"
exec 9>"$app_root/.deployment.lock"
flock -n 9 || { printf '%s\n' 'Another release operation is running'; exit 1; }
git -C "$checkout" fetch origin "$branch"
git -C "$checkout" pull --ff-only origin "$branch"
[[ "$(git -C "$checkout" rev-parse HEAD)" == "$reviewed" && "$(git -C "$checkout" rev-parse "origin/$branch")" == "$reviewed" ]] || { printf '%s\n' 'Pulled branch differs from the exact reviewed commit; review it before retrying'; exit 1; }
release="$app_root/releases/$(date -u +%Y%m%d%H%M%S)-${reviewed:0:12}-$$"
mkdir "$release"
git -C "$checkout" archive "$reviewed" | tar -x -C "$release"
cp "$env_file" "$release/.env.production"
chmod 600 "$release/.env.production"
printf '%s\n' "$reviewed" > "$release/.release-commit"
printf '%s\n' "$environment" > "$release/.release-environment"
cd "$release"
export NODE_ENV=production
npm ci --include=dev --no-audit --no-fund
node app.js --check-config
node - "$environment" "$health_url" <<'NODE'
require('@next/env').loadEnvConfig(process.cwd());
const [environment, target] = process.argv.slice(2);
const expected = new URL(process.env.DEPLOYMENT_URL);
const health = new URL(target);
if (process.env.SITE_ENV !== environment || health.origin !== expected.origin || health.protocol !== 'https:' || health.username || health.password || health.pathname !== '/api/health' || health.hash) throw new Error('Deployment environment and HTTPS health URL must match the private configuration.');
NODE
npm run typecheck
npm test
npm run build

verify_health() {
  local target=$1 expected=$2 attempt
  for attempt in 1 2 3 4; do
    if curl --fail --silent --show-error --connect-timeout 3 --max-time 8 "$target" -o "$app_root/.health-response" 2>/dev/null &&
      node - "$app_root/.health-response" "$expected" <<'NODE'
const fs = require('node:fs');
try { const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); process.exit(value.ok === true && value.commit === process.argv[3] ? 0 : 1); } catch { process.exit(1); }
NODE
    then return 0; fi
    sleep 1
  done
  return 1
}
candidate_pid='' previous='' switched=0
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  set +e
  if [[ -n "$candidate_pid" ]]; then kill "$candidate_pid" 2>/dev/null || true; wait "$candidate_pid" 2>/dev/null || true; fi
  if [[ "$status" != 0 && "$switched" == 1 ]]; then
    if [[ -n "$previous" ]]; then
      if ln -s "$previous" "$app_root/.recover-$$" &&
        mv -Tf "$app_root/.recover-$$" "$app_root/current" &&
        cp "$previous/app.js" "$app_root/.bootstrap-recover-$$" &&
        mv -f "$app_root/.bootstrap-recover-$$" "$app_root/app.js" &&
        touch "$app_root/tmp/restart.txt" &&
        verify_health "${health_url%%\?*}?ready=1" "$(cat "$previous/.release-commit")"; then
        printf '%s\n' 'Release verification failed; the previous serving commit is verified again' >&2
      else
        printf '%s\n' 'Previous release selected but serving recovery is unverified. Use the cPanel app Restart control and verify its commit' >&2
      fi
    else
      [[ ! -L "$app_root/current" ]] || rm "$app_root/current"
      touch "$app_root/tmp/restart.txt"
      printf '%s\n' 'First-release verification failed; no release remains selected. Preserve the existing site routing and inspect private logs' >&2
    fi
  fi
  rm -f "$app_root/.health-response"
  rm -f "$app_root/.previous-next-$$"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# The temporary candidate is the only child process this script may stop.
candidate_port=$((35000 + $$ % 20000))
PORT="$candidate_port" node "$release/app.js" > "$release/.candidate.log" 2>&1 &
candidate_pid=$!
verify_health "http://127.0.0.1:$candidate_port/api/health?ready=1" "$reviewed" || { printf '%s\n' 'Candidate readiness failed before release selection'; exit 1; }
kill "$candidate_pid" 2>/dev/null || true
wait "$candidate_pid" 2>/dev/null || true
candidate_pid=''
if [[ -L "$app_root/current" ]]; then
  previous="$(realpath "$app_root/current")"
  [[ "$previous" == "$app_root/releases/"* && -f "$previous/.release-commit" && -f "$previous/app.js" ]] || { printf '%s\n' 'Existing release pointer is invalid'; exit 1; }
elif [[ -e "$app_root/current" ]]; then
  printf '%s\n' 'The existing current path must be a managed symlink'; exit 1
fi
if [[ -n "$previous" && -d "$previous/.next/static" ]]; then cp -an "$previous/.next/static/." "$release/.next/static/"; fi
if [[ -n "$previous" ]]; then printf '%s\n' "$previous" > "$release/.prior-release"; fi
switched=1
cp "$release/app.js" "$app_root/.bootstrap-next-$$"
mv -f "$app_root/.bootstrap-next-$$" "$app_root/app.js"
ln -s "$release" "$app_root/.current-next-$$"
mv -Tf "$app_root/.current-next-$$" "$app_root/current"
touch "$app_root/tmp/restart.txt"
verify_health "${health_url%%\?*}?ready=1" "$reviewed" || { printf '%s\n' 'Hosted readiness or serving commit mismatch; restoring previous release'; exit 1; }
if [[ -n "$previous" ]]; then
  printf '%s\n' "$previous" > "$app_root/.previous-next-$$"
  mv -f "$app_root/.previous-next-$$" "$app_root/.previous-release"
fi
switched=0
printf 'Verified %s serving commit: %s\n' "$environment" "$reviewed"
