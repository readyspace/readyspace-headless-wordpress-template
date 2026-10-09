#!/usr/bin/env bash
# Frontend release reversal only. Does not change CMS data, DNS or CRM state.
set -euo pipefail
umask 077
[[ $# == 3 ]] || { printf '%s\n' 'Usage: rollback.sh APP_ROOT HTTPS_HEALTH_URL EXPECTED_CURRENT_COMMIT'; exit 2; }
app_root=$1 health_url=$2 expected_current=$3
[[ "$expected_current" =~ ^[a-f0-9]{40}$ && "$app_root" == "/home/$(id -un)/"* && "$app_root" != *'/public_html/'* && ! -L "$app_root" ]] || { printf '%s\n' 'Use the owning cPanel application directory and exact current commit'; exit 2; }
app_root="$(realpath "$app_root")"
[[ "$app_root" == "/home/$(id -un)/"* && "$app_root" != *'/public_html' && "$app_root" != *'/public_html/'* ]] || { printf '%s\n' 'Resolved application directory must remain private to this cPanel account'; exit 2; }
exec 9>"$app_root/.deployment.lock"
flock -n 9 || { printf '%s\n' 'Another release operation is running'; exit 1; }
current="$(realpath "$app_root/current")"
previous="$(cat "$app_root/.previous-release")"
for release in "$current" "$previous"; do
  [[ "$release" == "$app_root/releases/"* && "$(realpath "$release")" == "$release" && -f "$release/.release-commit" && -f "$release/.next/BUILD_ID" && -f "$release/app.js" ]] || { printf '%s\n' 'A rollback release is missing, unbuilt or outside this application'; exit 1; }
done
[[ "$(cat "$current/.release-commit")" == "$expected_current" ]] || { printf '%s\n' 'A different release is selected; stop and review before rollback'; exit 1; }
[[ "$(cat "$current/.release-environment")" == "$(cat "$previous/.release-environment")" ]] || { printf '%s\n' 'Rollback cannot cross deployment environments'; exit 1; }
rollback_commit="$(cat "$previous/.release-commit")"
[[ "$rollback_commit" =~ ^[a-f0-9]{40}$ ]] || exit 1
(cd "$previous" && node app.js --check-config)
node - "$previous" "$health_url" <<'NODE'
require(process.argv[2] + '/node_modules/@next/env').loadEnvConfig(process.argv[2]);
const health = new URL(process.argv[3]);
if (health.protocol !== 'https:' || health.username || health.password || health.pathname !== '/api/health' || health.origin !== new URL(process.env.DEPLOYMENT_URL).origin) throw new Error('Health URL does not match the rollback environment.');
NODE
select_release() {
  local release=$1
  cp "$release/app.js" "$app_root/.bootstrap-rollback-$$" || return 1
  mv -f "$app_root/.bootstrap-rollback-$$" "$app_root/app.js" || return 1
  ln -s "$release" "$app_root/.rollback-next-$$" || return 1
  mv -Tf "$app_root/.rollback-next-$$" "$app_root/current" || return 1
  touch "$app_root/tmp/restart.txt" || return 1
}
verify_health() {
  local commit=$1 attempt
  for attempt in 1 2 3 4; do
    if curl --fail --silent --show-error --connect-timeout 3 --max-time 8 "${health_url%%\?*}?ready=1" -o "$app_root/.rollback-health" 2>/dev/null &&
      node - "$app_root/.rollback-health" "$commit" <<'NODE'
const fs = require('node:fs');
try { const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); process.exit(value.ok === true && value.commit === process.argv[3] ? 0 : 1); } catch { process.exit(1); }
NODE
    then return 0; fi
    sleep 1
  done
  return 1
}
switched=0 accepted=0
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  set +e
  if [[ "$status" != 0 && "$switched" == 1 && "$accepted" == 0 ]]; then
    if select_release "$current" && verify_health "$expected_current"; then
      printf '%s\n' 'Rollback failed or was interrupted; original serving commit recovered' >&2
    else
      printf '%s\n' 'Original release recovery unverified. Use cPanel Restart and verify the commit' >&2
    fi
  fi
  rm -f "$app_root/.rollback-health" "$app_root/.previous-next-$$"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
switched=1
select_release "$previous"
if ! verify_health "$rollback_commit"; then
  printf '%s\n' 'Rollback readiness failed; recovering the original release' >&2
  exit 1
fi
printf '%s\n' "$current" > "$app_root/.previous-next-$$"
mv -f "$app_root/.previous-next-$$" "$app_root/.previous-release"
accepted=1
printf 'Verified rollback serving commit: %s\n' "$rollback_commit"
