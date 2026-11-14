#!/usr/bin/env bash
# Dedicated Compose deployment. Does not install Docker or modify host networking.
set -Eeuo pipefail
umask 077

usage() {
  cat <<'USAGE'
Usage: sudo bash setup-vps.sh [options]

  --install-root PATH       Dedicated config directory (default /opt/everfolk-art)
  --data-root PATH          Dedicated storage directory (default /srv/everfolk-art)
  --upload-user USER        Existing Linux user to own incoming/ (no SSH changes)
  --origin-port PORT        Loopback-only port (default 8788)
  --nginx-image REFERENCE   Version tag or digest (default nginx:stable-alpine)
  --tunnel-image REFERENCE  Version tag or digest (default cloudflare/cloudflared:latest)
  --enable-tunnel           Start the optional Cloudflare connector
  --disable-tunnel          Stop this deployment's connector, leaving origin running
  --token-file PATH         Existing token file; never pass tokens on the command line
  --origin-rps NUMBER       Global origin request rate (default 100)
  --origin-burst NUMBER     Global immediate burst allowance (default 200)
  --origin-connections N    Concurrent origin requests (default 128)
  --min-free-gib N          Minimum currently available storage (default 25)
  --reconfigure            Explicitly replace this deployment's changed config
  --refresh-images         Resolve image references again; requires --reconfigure
  --prepare-only           Write and validate config without starting services
  --help                   Show this help

Requires Linux, root, Docker Engine, Docker Compose v2, curl, ss and GNU coreutils.
Configure the Cloudflare public hostname's service as http://origin:8080.
No public TCP ports are opened. Existing services and SSH/firewall rules are untouched.
USAGE
}

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '%s\n' "$*" >&2; }
need_arg() { [[ $# -ge 2 && -n "$2" ]] || fail "Missing value for $1"; }

INSTALL_ROOT=/opt/everfolk-art
DATA_ROOT=
UPLOAD_USER=
ORIGIN_PORT=
NGINX_SOURCE_IMAGE=
CLOUDFLARED_SOURCE_IMAGE=
ORIGIN_RPS=
ORIGIN_BURST=
ORIGIN_CONNECTIONS=
TUNNEL_REQUEST=
TOKEN_FILE=
MIN_FREE_GIB=25
RECONFIGURE=0
REFRESH_IMAGES=0
PREPARE_ONLY=0

while (($#)); do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --install-root) need_arg "$@"; INSTALL_ROOT=$2; shift 2 ;;
    --data-root) need_arg "$@"; DATA_ROOT=$2; shift 2 ;;
    --upload-user) need_arg "$@"; UPLOAD_USER=$2; shift 2 ;;
    --origin-port) need_arg "$@"; ORIGIN_PORT=$2; shift 2 ;;
    --nginx-image) need_arg "$@"; NGINX_SOURCE_IMAGE=$2; shift 2 ;;
    --tunnel-image) need_arg "$@"; CLOUDFLARED_SOURCE_IMAGE=$2; shift 2 ;;
    --origin-rps) need_arg "$@"; ORIGIN_RPS=$2; shift 2 ;;
    --origin-burst) need_arg "$@"; ORIGIN_BURST=$2; shift 2 ;;
    --origin-connections) need_arg "$@"; ORIGIN_CONNECTIONS=$2; shift 2 ;;
    --min-free-gib) need_arg "$@"; MIN_FREE_GIB=$2; shift 2 ;;
    --token-file) need_arg "$@"; TOKEN_FILE=$2; shift 2 ;;
    --enable-tunnel) TUNNEL_REQUEST=1; shift ;;
    --disable-tunnel) TUNNEL_REQUEST=0; shift ;;
    --reconfigure) RECONFIGURE=1; shift ;;
    --refresh-images) REFRESH_IMAGES=1; shift ;;
    --prepare-only) PREPARE_ONLY=1; shift ;;
    *) fail "Unknown option: $1. Use --help." ;;
  esac
done

[[ $(uname -s) == Linux ]] || fail 'This installer targets Linux VPS hosts.'
[[ $EUID -eq 0 ]] || fail 'Run with sudo; container access is equivalent to host administrator access.'
for task_command in docker curl ss realpath mktemp sha256sum df awk sed cmp install find stat; do
  command -v "$task_command" >/dev/null || fail "Required command not found: $task_command"
done
docker compose version >/dev/null || fail 'Install Docker Compose v2 before running setup.'
docker info >/dev/null 2>&1 || fail 'Cannot access Docker Engine. Do not change another service to fix this automatically.'
[[ $REFRESH_IMAGES == 0 || $RECONFIGURE == 1 ]] || fail '--refresh-images requires --reconfigure.'

safe_root() {
  local task_path=$1 task_normalized
  [[ $task_path =~ ^/[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] || fail 'Storage/config paths must be absolute ASCII paths without spaces.'
  task_normalized=$(realpath -m -- "$task_path")
  [[ $task_path == "$task_normalized" ]] || fail "Use the canonical path, without symlinks or dot segments: $task_normalized"
  case "$task_path" in
    /|/bin|/bin/*|/boot|/boot/*|/dev|/dev/*|/etc|/etc/*|/lib|/lib/*|/lib64|/lib64/*|/proc|/proc/*|/run|/run/*|/sys|/sys/*|/usr|/usr/*|/var/lib/docker|/var/lib/docker/*|/opt|/srv|/tmp|/var|/home|/root)
      fail "Refusing unsafe dedicated directory: $task_path" ;;
  esac
}
safe_root "$INSTALL_ROOT"

secure_ancestors() {
  local task_path=$1 task_cursor=/ task_part task_owner task_mode
  local -a task_parts=()
  IFS='/' read -r -a task_parts <<< "$task_path"
  for task_part in "${task_parts[@]}"; do
    [[ -n $task_part ]] || continue
    task_cursor=${task_cursor%/}/$task_part
    [[ -e $task_cursor ]] || continue
    [[ -d $task_cursor && ! -L $task_cursor ]] || fail "Expected a real directory: $task_cursor"
    task_owner=$(stat -c %u -- "$task_cursor")
    task_mode=$(stat -c %a -- "$task_cursor")
    [[ $task_owner == 0 ]] || fail "Directory must be root-owned: $task_cursor"
    (( (8#$task_mode & 0022) == 0 )) || fail "Directory must not be writable by group/other users: $task_cursor"
  done
}
secure_ancestors "$INSTALL_ROOT"

# Read values, never execute a previous .env as shell code.
declare -A previous=()
if [[ -e "$INSTALL_ROOT/runtime.env" ]]; then
  [[ -f "$INSTALL_ROOT/.everfolk-art-runtime-v1" && ! -L "$INSTALL_ROOT/runtime.env" ]] || fail 'Unrecognized existing deployment.'
  [[ $(cat "$INSTALL_ROOT/.everfolk-art-runtime-v1") == .everfolk-art-runtime-v1 ]] || fail 'Unexpected installation marker.'
  while IFS='=' read -r task_key task_value; do
    [[ $task_key =~ ^[A-Z_]+$ ]] || continue
    previous[$task_key]=$task_value
  done < "$INSTALL_ROOT/runtime.env"
fi
DATA_ROOT=${DATA_ROOT:-${previous[EVERFOLK_DATA_ROOT]:-/srv/everfolk-art}}
UPLOAD_USER=${UPLOAD_USER:-${previous[UPLOAD_USER]:-}}
ORIGIN_PORT=${ORIGIN_PORT:-${previous[ORIGIN_PORT]:-8788}}
NGINX_SOURCE_IMAGE=${NGINX_SOURCE_IMAGE:-${previous[NGINX_SOURCE_IMAGE]:-nginx:stable-alpine}}
CLOUDFLARED_SOURCE_IMAGE=${CLOUDFLARED_SOURCE_IMAGE:-${previous[CLOUDFLARED_SOURCE_IMAGE]:-cloudflare/cloudflared:latest}}
ORIGIN_RPS=${ORIGIN_RPS:-${previous[ORIGIN_RPS]:-100}}
ORIGIN_BURST=${ORIGIN_BURST:-${previous[ORIGIN_BURST]:-200}}
ORIGIN_CONNECTIONS=${ORIGIN_CONNECTIONS:-${previous[ORIGIN_CONNECTIONS]:-128}}
ORIGIN_CPUS=${previous[ORIGIN_CPUS]:-1.0}
ORIGIN_MEMORY=${previous[ORIGIN_MEMORY]:-256m}
TUNNEL_CPUS=${previous[TUNNEL_CPUS]:-0.5}
TUNNEL_MEMORY=${previous[TUNNEL_MEMORY]:-256m}
TUNNEL_ENABLED=${TUNNEL_REQUEST:-${previous[TUNNEL_ENABLED]:-0}}
NGINX_IMAGE=${previous[NGINX_IMAGE]:-}
CLOUDFLARED_IMAGE=${previous[CLOUDFLARED_IMAGE]:-}
safe_root "$DATA_ROOT"
secure_ancestors "$DATA_ROOT"
[[ $DATA_ROOT != "$INSTALL_ROOT" && $DATA_ROOT != "$INSTALL_ROOT/"* && $INSTALL_ROOT != "$DATA_ROOT/"* ]] || fail 'Keep data and configuration in separate, non-nested directories.'
if [[ -n ${previous[EVERFOLK_DATA_ROOT]:-} && $DATA_ROOT != "${previous[EVERFOLK_DATA_ROOT]}" ]]; then
  fail 'Changing storage roots requires a separate verified data migration.'
fi
[[ $ORIGIN_PORT =~ ^[1-9][0-9]{3,4}$ && $ORIGIN_PORT -ge 1024 && $ORIGIN_PORT -le 65535 ]] || fail 'Origin port must be 1024..65535, without leading zeros.'
for task_number in "$ORIGIN_RPS" "$ORIGIN_BURST" "$ORIGIN_CONNECTIONS" "$MIN_FREE_GIB"; do
  [[ $task_number =~ ^[1-9][0-9]{0,5}$ ]] || fail 'Rate, connection and storage values must be positive integers, at most six digits.'
done
for task_cpu in "$ORIGIN_CPUS" "$TUNNEL_CPUS"; do
  [[ $task_cpu =~ ^[0-9]+([.][0-9]+)?$ && $task_cpu != 0 && $task_cpu != 0.0 ]] || fail 'Invalid CPU limit in runtime.env.'
done
for task_memory in "$ORIGIN_MEMORY" "$TUNNEL_MEMORY"; do
  [[ $task_memory =~ ^[1-9][0-9]*[mMgG]$ ]] || fail 'Invalid memory limit in runtime.env.'
done
[[ $TUNNEL_ENABLED == 0 || $TUNNEL_ENABLED == 1 ]] || fail 'Invalid tunnel enabled value.'
for task_image in "$NGINX_SOURCE_IMAGE" "$CLOUDFLARED_SOURCE_IMAGE"; do
  [[ $task_image =~ ^[A-Za-z0-9][A-Za-z0-9./:_@-]+$ ]] || fail 'Invalid container image reference.'
done
if [[ -n $UPLOAD_USER ]]; then
  [[ $UPLOAD_USER =~ ^[a-z_][a-z0-9_-]*[$]?$ ]] || fail 'Invalid upload user.'
  id "$UPLOAD_USER" >/dev/null 2>&1 || fail 'The upload user must already exist. Setup never changes SSH access.'
fi
if [[ -n $TOKEN_FILE ]]; then
  [[ -f $TOKEN_FILE && ! -L $TOKEN_FILE ]] || fail 'Token file must be a regular file, not a symlink.'
  task_token_size=$(stat -c %s -- "$TOKEN_FILE")
  [[ $task_token_size -gt 20 && $task_token_size -le 8192 ]] || fail 'Unexpected token file size.'
fi
if [[ $TUNNEL_ENABLED == 1 && -z $TOKEN_FILE ]]; then
  [[ -f "$INSTALL_ROOT/secrets/tunnel-token" && $(stat -c %s -- "$INSTALL_ROOT/secrets/tunnel-token") -gt 20 ]] || fail 'Provide --token-file PATH when first enabling the tunnel.'
fi

owned_directory() {
  local task_dir=$1 task_marker=$2 task_mode=$3
  if [[ -d $task_dir ]]; then
    if [[ -e "$task_dir/$task_marker" ]]; then
      [[ -f "$task_dir/$task_marker" && ! -L "$task_dir/$task_marker" && $(cat "$task_dir/$task_marker") == "$task_marker" ]] || fail "Invalid ownership marker: $task_dir"
    elif [[ -n $(find "$task_dir" -mindepth 1 -maxdepth 1 -print -quit) ]]; then
      fail "Refusing to adopt a nonempty directory without an Everfolk marker: $task_dir"
    fi
  else
    install -d -m "$task_mode" -- "$task_dir"
  fi
}
owned_directory "$INSTALL_ROOT" .everfolk-art-runtime-v1 0700
owned_directory "$DATA_ROOT" .everfolk-art-data-v1 0711

# A fixed Compose project name must never adopt another installation's containers.
task_existing_origin=
while IFS= read -r task_container; do
  [[ -n $task_container ]] || continue
  task_config_label=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$task_container")
  [[ -f "$INSTALL_ROOT/.everfolk-art-runtime-v1" && $task_config_label == "$INSTALL_ROOT/compose.yaml" ]] || fail 'The everfolk-art Compose project belongs to another installation. No containers were changed.'
  task_service_label=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$task_container")
  if [[ $task_service_label == origin ]]; then task_existing_origin=$task_container; fi
done < <(docker ps --all --quiet --filter label=com.docker.compose.project=everfolk-art)
if [[ -n $(ss -H -ltn "( sport = :$ORIGIN_PORT )") ]]; then
  task_port_owner=
  if [[ -n $task_existing_origin ]]; then
    task_port_owner=$(docker inspect --format '{{range (index .NetworkSettings.Ports "8080/tcp")}}{{.HostIp}}:{{.HostPort}}{{end}}' "$task_existing_origin")
  fi
  [[ $task_port_owner == "127.0.0.1:$ORIGIN_PORT" ]] || fail "Port $ORIGIN_PORT is already occupied. Choose another --origin-port; no containers were changed."
fi
for task_child in public public/releases private private/releases .staging incoming; do
  [[ ! -L "$DATA_ROOT/$task_child" ]] || fail "Storage subdirectories must not be symlinks: $task_child"
done
for task_child in public public/releases private private/releases .staging; do
  if [[ -e "$DATA_ROOT/$task_child" ]]; then
    [[ -d "$DATA_ROOT/$task_child" && $(stat -c %u -- "$DATA_ROOT/$task_child") == 0 ]] || fail "Managed storage directory must be root-owned: $task_child"
    task_mode=$(stat -c %a -- "$DATA_ROOT/$task_child")
    (( (8#$task_mode & 0022) == 0 )) || fail "Managed storage must not be group/world writable: $task_child"
  fi
done
if [[ -e "$DATA_ROOT/.everfolk-art-data-v1" ]]; then
  [[ $(stat -c %u -- "$DATA_ROOT/.everfolk-art-data-v1") == 0 ]] || fail 'Storage ownership marker must be root-owned.'
  task_mode=$(stat -c %a -- "$DATA_ROOT/.everfolk-art-data-v1")
  (( (8#$task_mode & 0022) == 0 )) || fail 'Storage ownership marker must not be group/world writable.'
fi
for task_child in bin secrets secrets/tunnel-token nginx.conf compose.yaml; do
  [[ ! -L "$INSTALL_ROOT/$task_child" ]] || fail "Configuration entries must not be symlinks: $task_child"
done
for task_child in runtime.env .everfolk-art-runtime-v1 nginx.conf compose.yaml setup-vps.sh nginx.conf.template; do
  if [[ -e "$INSTALL_ROOT/$task_child" ]]; then
    [[ -f "$INSTALL_ROOT/$task_child" && $(stat -c %u -- "$INSTALL_ROOT/$task_child") == 0 ]] || fail "Existing configuration must be a root-owned regular file: $task_child"
    task_mode=$(stat -c %a -- "$INSTALL_ROOT/$task_child")
    (( (8#$task_mode & 0022) == 0 )) || fail "Existing configuration must not be group/world writable: $task_child"
  fi
done
task_available_kib=$(df -Pk -- "$DATA_ROOT" | awk 'END {print $4}')
((task_available_kib >= MIN_FREE_GIB * 1024 * 1024)) || fail "Less than $MIN_FREE_GIB GiB currently free on the data filesystem."

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
[[ -f $SCRIPT_DIR/compose.yaml && -f $SCRIPT_DIR/nginx.conf.template ]] || fail 'Keep setup-vps.sh beside compose.yaml and nginx.conf.template.'
task_temp=$(mktemp -d /tmp/everfolk-art-setup.XXXXXXXX)
cleanup() {
  if [[ $task_temp == /tmp/everfolk-art-setup.* && -d $task_temp ]]; then rm -rf -- "$task_temp"; fi
}
trap cleanup EXIT

resolve_image() {
  local task_reference=$1 task_digest
  docker pull "$task_reference" >&2
  task_digest=$(docker image inspect --format '{{index .RepoDigests 0}}' "$task_reference")
  [[ $task_digest =~ ^[A-Za-z0-9][A-Za-z0-9./:_-]*@sha256:[0-9a-f]{64}$ ]] || fail 'Docker did not return a repository digest.'
  printf '%s' "$task_digest"
}
if [[ -n ${previous[NGINX_SOURCE_IMAGE]:-} && $NGINX_SOURCE_IMAGE != "${previous[NGINX_SOURCE_IMAGE]}" && $REFRESH_IMAGES == 0 ]]; then
  fail 'Changing the nginx image requires --refresh-images --reconfigure.'
fi
if [[ -n ${previous[CLOUDFLARED_SOURCE_IMAGE]:-} && $CLOUDFLARED_SOURCE_IMAGE != "${previous[CLOUDFLARED_SOURCE_IMAGE]}" && $REFRESH_IMAGES == 0 ]]; then
  fail 'Changing the tunnel image requires --refresh-images --reconfigure.'
fi
if [[ -z $NGINX_IMAGE || $REFRESH_IMAGES == 1 ]]; then NGINX_IMAGE=$(resolve_image "$NGINX_SOURCE_IMAGE"); fi
if [[ -z $CLOUDFLARED_IMAGE || $REFRESH_IMAGES == 1 ]]; then CLOUDFLARED_IMAGE=$(resolve_image "$CLOUDFLARED_SOURCE_IMAGE"); fi
for task_digest in "$NGINX_IMAGE" "$CLOUDFLARED_IMAGE"; do
  [[ $task_digest =~ ^[A-Za-z0-9][A-Za-z0-9./:_-]*@sha256:[0-9a-f]{64}$ ]] || fail 'Invalid locked image digest in runtime.env.'
done

cat > "$task_temp/runtime.env" <<EOF
EVERFOLK_INSTALL_ROOT=$INSTALL_ROOT
EVERFOLK_DATA_ROOT=$DATA_ROOT
UPLOAD_USER=$UPLOAD_USER
ORIGIN_PORT=$ORIGIN_PORT
ORIGIN_CPUS=$ORIGIN_CPUS
ORIGIN_MEMORY=$ORIGIN_MEMORY
TUNNEL_CPUS=$TUNNEL_CPUS
TUNNEL_MEMORY=$TUNNEL_MEMORY
ORIGIN_RPS=$ORIGIN_RPS
ORIGIN_BURST=$ORIGIN_BURST
ORIGIN_CONNECTIONS=$ORIGIN_CONNECTIONS
TUNNEL_ENABLED=$TUNNEL_ENABLED
NGINX_SOURCE_IMAGE=$NGINX_SOURCE_IMAGE
CLOUDFLARED_SOURCE_IMAGE=$CLOUDFLARED_SOURCE_IMAGE
NGINX_IMAGE=$NGINX_IMAGE
CLOUDFLARED_IMAGE=$CLOUDFLARED_IMAGE
EOF
sed -e "s/@@ORIGIN_RPS@@/$ORIGIN_RPS/g" -e "s/@@ORIGIN_BURST@@/$ORIGIN_BURST/g" -e "s/@@ORIGIN_CONNECTIONS@@/$ORIGIN_CONNECTIONS/g" "$SCRIPT_DIR/nginx.conf.template" > "$task_temp/nginx.conf"
cp -- "$SCRIPT_DIR/compose.yaml" "$task_temp/compose.yaml"

# Validate the candidate before replacing live configuration. The image entrypoint
# is bypassed so it cannot attempt to edit its read-only configuration directory.
chmod 0644 "$task_temp/nginx.conf"
docker run --rm --read-only --user 101:101 --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --tmpfs /tmp:rw,noexec,nosuid,size=32m,uid=101,gid=101,mode=0700 \
  --mount "type=bind,source=$task_temp/nginx.conf,target=/etc/nginx/nginx.conf,readonly" \
  --entrypoint nginx "$NGINX_IMAGE" -t -c /etc/nginx/nginx.conf

for task_config in runtime.env nginx.conf compose.yaml; do
  if [[ -e "$INSTALL_ROOT/$task_config" ]] && ! cmp -s -- "$task_temp/$task_config" "$INSTALL_ROOT/$task_config" && [[ $RECONFIGURE == 0 ]]; then
    fail "Existing $task_config differs. Review the change, then use --reconfigure."
  fi
done
if [[ -n $TOKEN_FILE && -e "$INSTALL_ROOT/secrets/tunnel-token" ]] && ! cmp -s -- "$TOKEN_FILE" "$INSTALL_ROOT/secrets/tunnel-token" && [[ $RECONFIGURE == 0 ]]; then
  fail 'Token rotation requires --reconfigure.'
fi

install -d -m 0700 -- "$INSTALL_ROOT/secrets" "$INSTALL_ROOT/bin"
printf '%s\n' .everfolk-art-runtime-v1 > "$INSTALL_ROOT/.everfolk-art-runtime-v1"
printf '%s\n' .everfolk-art-data-v1 > "$DATA_ROOT/.everfolk-art-data-v1"
chmod 0700 "$INSTALL_ROOT"
chmod 0711 "$DATA_ROOT"
install -d -m 0755 -- "$DATA_ROOT/public" "$DATA_ROOT/public/releases"
install -d -m 0700 -- "$DATA_ROOT/private" "$DATA_ROOT/private/releases" "$DATA_ROOT/.staging" "$DATA_ROOT/incoming"
if [[ -n $UPLOAD_USER ]]; then chown "$UPLOAD_USER:$(id -gn "$UPLOAD_USER")" "$DATA_ROOT/incoming"; fi
if [[ -n $TOKEN_FILE ]]; then
  # The containing directory is root-only; the container gets just this readable file.
  install -m 0444 -- "$TOKEN_FILE" "$INSTALL_ROOT/secrets/tunnel-token"
elif [[ ! -e "$INSTALL_ROOT/secrets/tunnel-token" ]]; then
  printf 'not-configured\n' > "$INSTALL_ROOT/secrets/tunnel-token"
  chmod 0444 "$INSTALL_ROOT/secrets/tunnel-token"
fi
for task_config in runtime.env compose.yaml; do install -m 0600 -- "$task_temp/$task_config" "$INSTALL_ROOT/$task_config"; done
install -m 0644 -- "$task_temp/nginx.conf" "$INSTALL_ROOT/nginx.conf"
if [[ $SCRIPT_DIR != "$INSTALL_ROOT" ]]; then
  install -m 0700 -- "$SCRIPT_DIR/setup-vps.sh" "$INSTALL_ROOT/setup-vps.sh"
  install -m 0600 -- "$SCRIPT_DIR/nginx.conf.template" "$INSTALL_ROOT/nginx.conf.template"
fi
if [[ $SCRIPT_DIR != "$INSTALL_ROOT" && -d $SCRIPT_DIR/../bin ]]; then
  for task_tool in verify-release.py publish-release.sh; do
    if [[ -f $SCRIPT_DIR/../bin/$task_tool && ! -L $SCRIPT_DIR/../bin/$task_tool ]]; then
      install -m 0755 -- "$SCRIPT_DIR/../bin/$task_tool" "$INSTALL_ROOT/bin/$task_tool"
    fi
  done
fi

compose() { docker compose --project-name everfolk-art --env-file "$INSTALL_ROOT/runtime.env" -f "$INSTALL_ROOT/compose.yaml" "$@"; }
compose config --quiet
compose run --rm --no-deps origin -t -c /etc/nginx/nginx.conf
if [[ $PREPARE_ONLY == 1 ]]; then
  log "Prepared and syntax-validated $INSTALL_ROOT. No services were started."
  exit 0
fi
task_existing_origin=$(compose ps --all --quiet origin)
if [[ -n $(ss -H -ltn "( sport = :$ORIGIN_PORT )") ]]; then
  task_port_owner=
  if [[ -n $task_existing_origin ]]; then
    task_port_owner=$(docker inspect --format '{{range (index .NetworkSettings.Ports "8080/tcp")}}{{.HostIp}}:{{.HostPort}}{{end}}' "$task_existing_origin")
  fi
  [[ $task_port_owner == "127.0.0.1:$ORIGIN_PORT" ]] || fail "Port $ORIGIN_PORT is already occupied. Choose another --origin-port; existing services were not stopped."
fi
task_up_flags=(-d --wait)
if [[ $RECONFIGURE == 1 ]]; then
  # Bind-mounted files/secrets may have new inodes even when Compose's service
  # definition is unchanged. Recreate only this named project to read them.
  task_up_flags+=(--force-recreate)
fi
if [[ $TUNNEL_ENABLED == 1 ]]; then
  compose --profile tunnel up "${task_up_flags[@]}"
else
  compose --profile tunnel stop tunnel
  compose up "${task_up_flags[@]}" origin
fi
curl --fail --silent --show-error "http://127.0.0.1:$ORIGIN_PORT/healthz"
log "Origin ready on 127.0.0.1:$ORIGIN_PORT. No public listener was opened."
if [[ $TUNNEL_ENABLED == 1 ]]; then
  log 'Configure the Cloudflare hostname service as http://origin:8080 and apply the documented cache rules.'
fi
