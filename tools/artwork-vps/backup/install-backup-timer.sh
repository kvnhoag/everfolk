#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $EUID -eq 0 ]] || { printf 'Run with sudo.\n' >&2; exit 1; }
command -v restic >/dev/null || { printf 'Install restic first.\n' >&2; exit 1; }
command -v systemctl >/dev/null || { printf 'systemd is required for the optional timer.\n' >&2; exit 1; }
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
[[ -f /etc/everfolk-art/backup.env ]] || { printf 'Configure /etc/everfolk-art/backup.env first.\n' >&2; exit 1; }
[[ -f /opt/everfolk-art/.everfolk-art-runtime-v1 ]] || { printf 'Run the VPS runtime setup first.\n' >&2; exit 1; }
for task_path in /opt /opt/everfolk-art /opt/everfolk-art/bin /etc/everfolk-art; do
  [[ ! -L $task_path && $(stat -c %u "$task_path") == 0 ]] || { printf 'Unprotected install/config path: %s\n' "$task_path" >&2; exit 1; }
  task_mode=$(stat -c %a "$task_path")
  (( (8#$task_mode & 0022) == 0 )) || { printf 'Writable install/config path: %s\n' "$task_path" >&2; exit 1; }
done
for unit in everfolk-art-backup.service everfolk-art-backup.timer; do
  if [[ -e /etc/systemd/system/$unit ]] && ! grep -q '^# Managed by Everfolk artwork backup$' "/etc/systemd/system/$unit"; then
    printf 'Refusing to overwrite unrelated unit: %s\n' "$unit" >&2; exit 1
  fi
done
install -d -m 0755 /opt/everfolk-art/bin
install -m 0755 "$script_dir/backup.sh" /opt/everfolk-art/bin/backup.sh
cat >/etc/systemd/system/everfolk-art-backup.service <<'EOF'
# Managed by Everfolk artwork backup
[Unit]
Description=Back up Everfolk artwork to independent storage
Wants=network-online.target
After=network-online.target
[Service]
Type=oneshot
ExecStart=/opt/everfolk-art/bin/backup.sh backup
Nice=10
IOSchedulingClass=idle
CPUQuota=50%
MemoryMax=512M
TimeoutStartSec=6h
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
EOF
cat >/etc/systemd/system/everfolk-art-backup.timer <<'EOF'
# Managed by Everfolk artwork backup
[Unit]
Description=Twice daily independent backup of Everfolk artwork
[Timer]
OnCalendar=*-*-* 03,15:20:00 UTC
RandomizedDelaySec=30m
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now everfolk-art-backup.timer
printf 'Enabled twice daily backup timer. Run a manual backup and restore test before relying on it.\n'
