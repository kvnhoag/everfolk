#!/usr/bin/env python3
"""Add an immutable artwork route to an existing Caddy Compose deployment."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import yaml
from yaml.nodes import MappingNode, ScalarNode, SequenceNode


def run(args, **kwargs):
    return subprocess.run(args, check=True, text=True, capture_output=True, **kwargs).stdout


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def protected(path):
    path = Path(path)
    require(path.is_absolute() and path.resolve() == path and not path.is_symlink(), 'Use a canonical protected path: ' + str(path))
    for p in [path, *path.parents]:
        info = p.stat()
        require(info.st_uid == 0 and not (info.st_mode & 0o022), 'Root-owned non-writable path required: ' + str(p))


def get(node, key):
    require(isinstance(node, MappingNode), 'Expected YAML mapping')
    return next((v for k, v in node.value if k.value == key), None)


def scalar(value, tag='str'):
    return ScalarNode('tag:yaml.org,2002:' + tag, value)


def put(node, key, value):
    for i, (k, _) in enumerate(node.value):
        if k.value == key:
            node.value[i] = (k, value)
            return
    node.value.append((scalar(key), value))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Apply validated routing; default only prepares candidates')
    parser.add_argument('--app-root', default='/opt/everfolk/app')
    parser.add_argument('--install-root', default='/opt/everfolk-art')
    parser.add_argument('--hostname', default='everfolk.life')
    parser.add_argument('--caddy-container', default='app-caddy-1')
    parser.add_argument('--origin-container', default='everfolk-art-origin-1')
    parser.add_argument('--media-network', default='everfolk-art_artwork')
    parser.add_argument('--project', default='app')
    parser.add_argument('--release-id')
    parser.add_argument('--manifest-sha256')
    args = parser.parse_args()
    require(os.geteuid() == 0, 'Run as root on the VPS')
    if args.apply:
        require(args.release_id and re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', args.release_id), 'Apply requires a published --release-id')
        require(args.manifest_sha256 and re.fullmatch(r'[0-9a-f]{64}', args.manifest_sha256), 'Apply requires the trusted --manifest-sha256')
    require(re.fullmatch(r'[a-z0-9.-]+', args.hostname), 'Invalid hostname')
    for name in [args.caddy_container, args.origin_container, args.media_network, args.project]:
        require(re.fullmatch(r'[A-Za-z0-9_.-]+', name), 'Invalid Docker name')
    app = Path(args.app_root); install = Path(args.install_root)
    for p in [app, install, app/'Caddyfile', app/'docker-compose.yml', app/'docker-compose.override.yml']:
        protected(p)
    require((install/'.everfolk-art-runtime-v1').read_text().strip() == '.everfolk-art-runtime-v1', 'Unrecognized artwork install')
    caddyfile = app/'Caddyfile'; override = app/'docker-compose.override.yml'
    labels = json.loads(run(['docker', 'inspect', '--format', '{{json .Config.Labels}}', args.caddy_container]))
    require(labels.get('com.docker.compose.project') == args.project and labels.get('com.docker.compose.service') == 'caddy', 'Selected container does not own the expected Caddy service')
    mounts = json.loads(run(['docker', 'inspect', '--format', '{{json .Mounts}}', args.caddy_container]))
    require(any(m.get('Type') == 'bind' and m.get('Source') == str(caddyfile) and m.get('Destination') == '/etc/caddy/Caddyfile' for m in mounts), 'Caddy bind mount does not match the selected app root')
    old_caddy = caddyfile.read_text(); old_override = override.read_text()
    inspect = json.loads(run(['docker', 'inspect', '--format', '{{json .NetworkSettings.Networks}}', args.caddy_container]))
    origin_nets = json.loads(run(['docker', 'inspect', '--format', '{{json .NetworkSettings.Networks}}', args.origin_container]))
    require(args.media_network in origin_nets, 'Origin is not in the declared media network')
    compose = ['docker', 'compose', '--project-name', args.project, '--project-directory', str(app), '-f', str(app/'docker-compose.yml')]
    effective = json.loads(run([*compose, '-f', str(override), 'config', '--format', 'json']))
    require('caddy' in effective['services'], 'Expected existing caddy service')
    require(effective.get('name') == args.project, 'Unexpected app Compose project')
    yaml_root = yaml.compose(old_override)
    services = get(yaml_root, 'services'); caddy_node = get(services, 'caddy')
    require(caddy_node is not None, 'Caddy service must be declared in the existing override')
    names = list(effective['services']['caddy'].get('networks', {'default': None}))
    require('artwork_origin' not in names or effective.get('networks', {}).get('artwork_origin', {}).get('name') == args.media_network, 'Conflicting artwork_origin network')
    if 'artwork_origin' not in names:
        names.append('artwork_origin')
    # Preserve any non-default network attachment options from the effective config.
    current_nets = effective['services']['caddy'].get('networks', {'default': None})
    network_text = yaml.safe_dump({n: current_nets.get(n) for n in names})
    put(caddy_node, 'networks', yaml.compose(network_text))
    nets = get(yaml_root, 'networks')
    if nets is None:
        nets = MappingNode('tag:yaml.org,2002:map', []); put(yaml_root, 'networks', nets)
    put(nets, 'artwork_origin', yaml.compose('external: true\nname: ' + args.media_network + '\n'))
    new_override = yaml.serialize(yaml_root)
    upstream = args.origin_container + ':8080'
    host_block = re.search(r'^' + re.escape(args.hostname) + r'\s*\{(.*?)^\}', old_caddy, re.M | re.S)
    require(host_block is not None, 'Expected hostname block is absent')
    if 'handle /releases/*' in host_block.group(1):
        require('reverse_proxy ' + upstream in host_block.group(1), 'An unrelated release route already exists in this hostname')
        new_caddy = old_caddy
    else:
        block = re.search(r'^' + re.escape(args.hostname) + r'\s*\{([^{}]*)^\}', old_caddy, re.M | re.S)
        require(block is not None, 'Expected a simple existing hostname block; review complex configurations manually')
        body = block.group(1)
        proxies = list(re.finditer(r'(?m)^[ \t]*reverse_proxy[ \t]+[^\n{}]+$', body))
        require(len(proxies) == 1, 'Expected one existing game reverse proxy')
        existing = proxies[0].group().strip()
        replacement = '\thandle /releases/* {\n\t\treverse_proxy ' + upstream + '\n\t}\n\thandle {\n\t\t' + existing + '\n\t}'
        body = body[:proxies[0].start()] + replacement + body[proxies[0].end():]
        new_caddy = old_caddy[:block.start(1)] + body + old_caddy[block.end(1):]
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + str(os.getpid())
    backup = install/'integration-backups'/stamp
    backup.mkdir(parents=True, mode=0o700)
    os.chmod(backup.parent, 0o700)
    (backup/'Caddyfile.before').write_text(old_caddy)
    (backup/'docker-compose.override.before.yml').write_text(old_override)
    candidate = backup/'Caddyfile.candidate'; candidate.write_text(new_caddy)
    compose_candidate = backup/'docker-compose.override.candidate.yml'; compose_candidate.write_text(new_override)
    validated = json.loads(run([*compose, '-f', str(compose_candidate), 'config', '--format', 'json']))
    require(validated['networks']['artwork_origin']['name'] == args.media_network, 'Candidate network resolution mismatch')
    require(set(current_nets).issubset(validated['services']['caddy']['networks']), 'Existing app network would be lost')
    for service, baseline in effective['services'].items():
        if service != 'caddy':
            require(validated['services'].get(service) == baseline, 'Candidate would change unrelated service: ' + service)
    before_caddy = {k: v for k, v in effective['services']['caddy'].items() if k != 'networks'}
    after_caddy = {k: v for k, v in validated['services']['caddy'].items() if k != 'networks'}
    require(before_caddy == after_caddy, 'Candidate would change Caddy beyond its network attachment')
    require(set(validated['services']['caddy']['networks']) == set(current_nets) | {'artwork_origin'}, 'Unexpected Caddy network delta')
    temporary = '/tmp/everfolk-art-caddy-' + stamp
    connected = False; applied = False
    try:
        run(['docker', 'cp', str(candidate), args.caddy_container + ':' + temporary])
        run(['docker', 'exec', args.caddy_container, 'caddy', 'validate', '--config', temporary, '--adapter', 'caddyfile'])
        print(json.dumps({'backup': str(backup), 'upstream': upstream, 'candidateValidated': True, 'apply': args.apply}), flush=True)
        if not args.apply:
            return
        require(caddyfile.read_text() == old_caddy and override.read_text() == old_override, 'App configuration changed during validation; retry after review')
        if args.media_network not in inspect:
            run(['docker', 'network', 'connect', args.media_network, args.caddy_container]); connected = True
        # In-place write preserves the existing file bind-mount inode inside Caddy.
        applied = True
        with override.open('w') as f:
            f.write(new_override); f.flush(); os.fsync(f.fileno())
        with caddyfile.open('w') as f:
            f.write(new_caddy); f.flush(); os.fsync(f.fileno())
        run(['docker', 'exec', args.caddy_container, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
        code = run(['curl', '--resolve', args.hostname + ':443:127.0.0.1', '--max-time', '20', '-sS', '-o', '/dev/null', '-w', '%{http_code}', 'https://' + args.hostname + '/']).strip()
        require(code == '200', 'Homepage check returned ' + code)
        media_url = 'https://' + args.hostname + '/releases/' + args.release_id + '/manifest.json'
        response = subprocess.run(['curl', '--resolve', args.hostname + ':443:127.0.0.1', '--max-time', '20', '-fsS', media_url], check=True, capture_output=True).stdout
        require(hashlib.sha256(response).hexdigest() == args.manifest_sha256, 'HTTPS artwork manifest does not match trusted release')
        print('Artwork manifest hash verified through HTTPS; existing game homepage remains HTTP 200.', flush=True)
    except Exception:
        if applied:
            override.write_text(old_override); caddyfile.write_text(old_caddy)
            rollback = subprocess.run(['docker', 'exec', args.caddy_container, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'], capture_output=True)
            if rollback.returncode:
                print('ROLLBACK RELOAD FAILED: restore from ' + str(backup) + ' and reload Caddy manually.', file=sys.stderr)
        if connected:
            rollback = subprocess.run(['docker', 'network', 'disconnect', args.media_network, args.caddy_container], capture_output=True)
            if rollback.returncode:
                print('Rollback left the Caddy artwork network attachment; inspect it manually.', file=sys.stderr)
        raise
    finally:
        subprocess.run(['docker', 'exec', args.caddy_container, 'rm', '-f', '--', temporary], capture_output=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('Caddy integration failed: ' + str(exc), file=sys.stderr)
        raise SystemExit(1)