#!/usr/bin/env bash
set -euo pipefail
umask 077

die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
usage() { printf 'Usage: backup.sh [--config /etc/everfolk-art/backup.env] [backup|init|check|check-full|snapshots]\n'; }
config=/etc/everfolk-art/backup.env
action=backup
while (($#)); do
  case "$1" in
    --config) (($# >= 2)) || die '--config needs a path'; config=$2; shift 2 ;;
    backup|init|check|check-full|snapshots) action=$1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; die "Unknown argument: $1" ;;
  esac
done
[[ $EUID -eq 0 ]] || die 'Run with sudo; configuration and source archives are root-owned.'
command -v restic >/dev/null || die 'Install restic using your operating system package manager.'
command -v flock >/dev/null || die 'flock is required.'
protected_path() {
  local task_path=$1 task_cursor task_mode
  [[ $task_path == /* && $(realpath -e -- "$task_path") == "$task_path" ]] || die 'Use a canonical absolute path without symlinks.'
  task_cursor=$task_path
  while :; do
    [[ $(stat -c %u -- "$task_cursor") == 0 ]] || die "Path must be root-owned: $task_cursor"
    task_mode=$(stat -c %a -- "$task_cursor")
    (( (8#$task_mode & 0022) == 0 )) || die "Path must not be group/world writable: $task_cursor"
    [[ $task_cursor == / ]] && break
    task_cursor=$(dirname -- "$task_cursor")
  done
}
protected_path "$config"
[[ -f $config && ! -L $config ]] || die 'Configuration must be a regular file, not a symlink.'
[[ $(stat -c %u "$config") == 0 && $(stat -c %a "$config") == 600 ]] || die 'Configuration must be root-owned and mode 0600.'
# Configuration is intentionally executable shell, writable only by root.
set -a
source "$config"
set +a
[[ -n ${RESTIC_REPOSITORY:-} && -n ${RESTIC_PASSWORD_FILE:-} ]] || die 'Set RESTIC_REPOSITORY and RESTIC_PASSWORD_FILE.'
case "$RESTIC_REPOSITORY" in
  sftp:*|s3:*|b2:*|azure:*|gs:*|rclone:*|rest:https:*) ;;
  *) die 'Use an independent remote backup repository (SFTP, S3, B2, Azure, GS, rclone, or HTTPS REST).' ;;
esac
protected_path "$RESTIC_PASSWORD_FILE"
[[ -f $RESTIC_PASSWORD_FILE && ! -L $RESTIC_PASSWORD_FILE ]] || die 'Password file must be a regular file.'
[[ $(stat -c %u "$RESTIC_PASSWORD_FILE") == 0 && $(stat -c %a "$RESTIC_PASSWORD_FILE") == 600 ]] || die 'Password file must be root-owned and mode 0600.'
root=${ART_DATA_ROOT:-/srv/everfolk-art}
[[ $root =~ ^/[A-Za-z0-9_/-]+$ && $root != / && $root != */../* && $root != */.. ]] || die 'Invalid ART_DATA_ROOT.'
[[ -d $root && ! -L $root && $(realpath -e "$root") == "$root" ]] || die 'Data root must be a canonical directory without symlink components.'
protected_path "$root"
[[ -d $root/public/releases && -d $root/private/releases ]] || die 'Published release directories are missing.'
[[ ! -L $root/.backup.lock ]] || die 'Backup lock must not be a symlink.'
if [[ -e $root/.backup.lock ]]; then
  [[ -f $root/.backup.lock && $(stat -c %u "$root/.backup.lock") == 0 ]] || die 'Existing backup lock must be a root-owned regular file.'
fi
exec 9>"$root/.backup.lock"
flock -n 9 || die 'Another artwork backup is running.'
case "$action" in
  init) restic init ;;
  backup)
    restic backup --tag everfolk-art "$root/public/releases" "$root/private/releases"
    restic snapshots --latest 1 --tag everfolk-art
    ;;
  check) restic check --read-data-subset=5% ;;
  check-full) restic check --read-data ;;
  snapshots) restic snapshots --tag everfolk-art ;;
esac
# No automatic forget/prune: retention is a separate, reviewed operation.
