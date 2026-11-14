#!/usr/bin/env python3
"""Pin existing public media URLs to a verified external release; retain app fallback."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

BEGIN = '# BEGIN EVERFOLK MEDIA PIN'
END = '# END EVERFOLK MEDIA PIN'
CACHE = 'public, max-age=300, s-maxage=3600, no-transform'


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, **kwargs)


def protected(path):
    path = Path(path)
    require(path.is_absolute() and path.resolve() == path and not path.is_symlink(), 'Use a canonical protected path: ' + str(path))
    for part in [path, *path.parents]:
        info = part.stat()
        require(info.st_uid == 0 and not info.st_mode & 0o022, 'Root-owned, non-writable path required: ' + str(part))


def media_block(release, origin='everfolk-art-origin-1:8080', app='everfolk:8787'):
    require(re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', release), 'Invalid release ID')
    for upstream in [origin, app]:
        require(re.fullmatch(r'[A-Za-z0-9_.-]+:[0-9]{1,5}', upstream), 'Invalid upstream')
    return f"""	{BEGIN}
	@everfolk_legacy_media {{
		path /assets/* /fonts/*
		method GET HEAD
	}}
	handle @everfolk_legacy_media {{
		reverse_proxy {origin} {{
			# Proxy-scoped rewrite leaves the original URI/query available to fallback.
			rewrite /releases/{release}/payload{{path}}?
			header_up -Cookie
			header_up -Authorization
			header_down -Set-Cookie
			header_down -CDN-Cache-Control
			header_down -Cloudflare-CDN-Cache-Control
			transport http {{
				dial_timeout 2s
				response_header_timeout 3s
			}}
			@media_missing status 404 5xx
			handle_response @media_missing {{
				reverse_proxy {app} {{
					header_up -Cookie
					header_up -Authorization
					header_down Cache-Control "no-store"
					header_down -CDN-Cache-Control
					header_down -Cloudflare-CDN-Cache-Control
					header_down -Expires
					header_down -Set-Cookie
					header_down -CF-Cache-Status
					header_down -Age
					header_down X-Everfolk-Media-Fallback "app"
				}}
			}}
			@media_success status 200 206 304
			handle_response @media_success {{
				header {{
					Cache-Control "{CACHE}"
					X-Everfolk-Media-Release "{release}"
					defer
				}}
				copy_response_headers {{
					exclude Cache-Control CDN-Cache-Control Cloudflare-CDN-Cache-Control Set-Cookie X-Everfolk-Media-Release
				}}
				copy_response
			}}
		}}
	}}
	handle_errors 502 503 504 {{
		@everfolk_media_transport {{
			path /assets/* /fonts/*
			method GET HEAD
		}}
		handle @everfolk_media_transport {{
			reverse_proxy {app} {{
				header_up -Cookie
				header_up -Authorization
				header_down Cache-Control "no-store"
				header_down -CDN-Cache-Control
				header_down -Cloudflare-CDN-Cache-Control
				header_down -Expires
				header_down -Set-Cookie
				header_down -CF-Cache-Status
				header_down -Age
				header_down X-Everfolk-Media-Fallback "app"
			}}
		}}
		# Keep Caddy's default empty error response/status outside public media.
		handle {{
			respond "" {{err.status_code}}
		}}
	}}
	{END}
"""


def render_config(original, hostname, release, origin='everfolk-art-origin-1:8080', app='everfolk:8787'):
    require(re.fullmatch(r'[a-z0-9.-]+', hostname), 'Invalid hostname')
    block = re.search(r'^' + re.escape(hostname) + r'\s*\{(.*?)^\}', original, re.M | re.S)
    require(block is not None, 'Expected hostname block not found')
    body = block.group(1)
    require('handle /releases/*' in body and 'reverse_proxy ' + origin in body, 'Integrate the immutable artwork origin first')
    if BEGIN in body or END in body:
        pattern = r'(?m)^[ \t]*' + re.escape(BEGIN) + r'\n.*?^[ \t]*' + re.escape(END) + r'\n?'
        require(len(re.findall(pattern, body, re.S)) == 1, 'Invalid existing media pin markers')
        body = re.sub(pattern, '', body, flags=re.M | re.S)
    require('@everfolk_legacy_media' not in body and 'handle_errors' not in body, 'Unmanaged media/error routes already exist; review manually')
    insertion = body.find('\thandle /releases/*')
    require(insertion >= 0, 'Expected managed release route indentation')
    body = body[:insertion] + media_block(release, origin, app) + body[insertion:]
    return original[:block.start(1)] + body + original[block.end(1):]


def write_in_place(path, content):
    with path.open('w') as file:
        file.write(content)
        file.flush()
        os.fsync(file.fileno())


def curl(hostname, path, extra=()):
    result = run(['curl', '--resolve', hostname + ':443:127.0.0.1', '--connect-timeout', '5', '--max-time', '25', '-sS', '-D', '-', *extra, 'https://' + hostname + path])
    raw_headers, body = result.stdout.split(b'\r\n\r\n', 1)
    while raw_headers.startswith(b'HTTP/1.1 100'):
        raw_headers, body = body.split(b'\r\n\r\n', 1)
    lines = raw_headers.decode('latin1').splitlines()
    headers = {}
    for line in lines[1:]:
        if ':' in line:
            key, value = line.split(':', 1)
            headers[key.lower()] = value.strip()
    return int(lines[0].split()[1]), headers, body


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Apply; default validates a candidate only')
    parser.add_argument('--release-id', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--hostname', default='everfolk.life')
    parser.add_argument('--app-root', default='/opt/everfolk/app')
    parser.add_argument('--install-root', default='/opt/everfolk-art')
    parser.add_argument('--data-root', default='/srv/everfolk-art')
    parser.add_argument('--caddy-container', default='app-caddy-1')
    parser.add_argument('--origin-container', default='everfolk-art-origin-1')
    parser.add_argument('--app-upstream', default='everfolk:8787')
    parser.add_argument('--media-network', default='everfolk-art_artwork')
    args = parser.parse_args()
    require(os.geteuid() == 0, 'Run as root on the VPS')
    require(re.fullmatch(r'[0-9a-f]{64}', args.manifest_sha256), 'Trusted manifest SHA-256 required')
    require(re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', args.release_id), 'Invalid release ID')
    for name in [args.caddy_container, args.origin_container, args.media_network]:
        require(re.fullmatch(r'[A-Za-z0-9_.-]+', name), 'Invalid Docker name')
    app = Path(args.app_root)
    install = Path(args.install_root)
    data = Path(args.data_root)
    caddyfile = app/'Caddyfile'
    release = data/'public/releases'/args.release_id
    manifest_path = release/'manifest.json'
    for path in [app, install, data, caddyfile, release, manifest_path]:
        protected(path)
    require((install/'.everfolk-art-runtime-v1').read_text().strip() == '.everfolk-art-runtime-v1', 'Unrecognized artwork installation')
    manifest_bytes = manifest_path.read_bytes()
    require(hashlib.sha256(manifest_bytes).hexdigest() == args.manifest_sha256, 'Published manifest does not match the trusted authoring receipt')
    manifest = json.loads(manifest_bytes)
    require(manifest.get('kind') == 'public' and manifest.get('releaseId') == args.release_id, 'Expected immutable public release')
    files = [entry for entry in manifest['files'] if entry['path'].startswith(('assets/', 'fonts/'))]
    require(files and all('..' not in Path(entry['path']).parts and not Path(entry['path']).is_absolute() for entry in files), 'Expected public media paths')
    labels = json.loads(run(['docker', 'inspect', '--format', '{{json .Config.Labels}}', args.caddy_container]).stdout)
    require(labels.get('com.docker.compose.service') == 'caddy' and labels.get('com.docker.compose.project') == 'app', 'Unexpected Caddy container')
    mounts = json.loads(run(['docker', 'inspect', '--format', '{{json .Mounts}}', args.caddy_container]).stdout)
    require(any(m.get('Type') == 'bind' and m.get('Source') == str(caddyfile) and m.get('Destination') == '/etc/caddy/Caddyfile' for m in mounts), 'Unexpected Caddyfile mount')
    for container in [args.caddy_container, args.origin_container]:
        networks = json.loads(run(['docker', 'inspect', '--format', '{{json .NetworkSettings.Networks}}', container]).stdout)
        require(args.media_network in networks, 'Media network not attached to ' + container)
    old = caddyfile.read_text()
    candidate_text = render_config(old, args.hostname, args.release_id, args.origin_container + ':8080', args.app_upstream)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S') + '-media-' + str(os.getpid())
    backup = install/'integration-backups'/stamp
    backup.mkdir(mode=0o700, parents=True)
    os.chmod(backup.parent, 0o700)
    (backup/'Caddyfile.before').write_text(old)
    pin = install/'media-pin.json'
    if pin.exists():
        protected(pin)
        (backup/'media-pin.before.json').write_bytes(pin.read_bytes())
    candidate = backup/'Caddyfile.candidate'
    candidate.write_text(candidate_text)
    remote_candidate = '/tmp/everfolk-' + stamp
    applied = False
    checks = []
    try:
        run(['docker', 'cp', str(candidate), args.caddy_container + ':' + remote_candidate])
        run(['docker', 'exec', args.caddy_container, 'caddy', 'validate', '--config', remote_candidate, '--adapter', 'caddyfile'])
        print(json.dumps({'candidateValidated': True, 'apply': args.apply, 'backup': str(backup), 'release': args.release_id}), flush=True)
        if not args.apply:
            return
        require(caddyfile.read_text() == old, 'Caddyfile changed during validation; retry after review')
        applied = True
        write_in_place(caddyfile, candidate_text)
        run(['docker', 'exec', args.caddy_container, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
        status, _, _ = curl(args.hostname, '/')
        require(status == 200, 'Game homepage health check failed')
        status, _, body = curl(args.hostname, '/releases/' + args.release_id + '/manifest.json')
        require(status == 200 and hashlib.sha256(body).hexdigest() == args.manifest_sha256, 'Versioned release manifest check failed')
        chosen = {}
        for entry in files:
            extension = Path(entry['path']).suffix.lower()
            group = 'font' if entry['path'].startswith('fonts/') else 'audio' if '/audio/' in entry['path'] else extension
            if group not in chosen:
                chosen[group] = entry
        for entry in list(chosen.values())[:12]:
            for suffix in ['', '?everfolk-pin-check=1']:
                status, headers, body = curl(args.hostname, '/' + entry['path'] + suffix)
                require(status == 200 and hashlib.sha256(body).hexdigest() == entry['sha256'], 'Legacy alias hash check failed: ' + entry['path'])
                require(headers.get('cache-control') == CACHE and headers.get('x-everfolk-media-release') == args.release_id, 'Legacy alias policy check failed: ' + entry['path'])
                checks.append({'path': '/' + entry['path'] + suffix, 'status': status, 'shaMatch': True})
        status, headers, _ = curl(args.hostname, '/assets/__everfolk_media_missing_probe__.png?original=preserved')
        require(headers.get('x-everfolk-media-fallback') == 'app' and headers.get('cache-control') == 'no-store', 'Missing-media fallback failed')
        checks.append({'path': 'missing-media-fallback', 'status': status, 'noStore': True})
        audio = next((entry for entry in files if '/audio/' in entry['path'] and Path(entry['path']).suffix.lower() in {'.mp3', '.ogg', '.wav', '.m4a'}), None)
        if audio:
            status, headers, body = curl(args.hostname, '/' + audio['path'], ['-H', 'Range: bytes=0-31'])
            require(status == 206 and body == (release/'payload'/audio['path']).read_bytes()[:32], 'Audio range request failed')
            require(headers.get('content-range', '').startswith('bytes 0-31/') and headers.get('cache-control') == CACHE, 'Audio range policy failed')
            checks.append({'path': audio['path'], 'status': 206, 'rangeBytes': 32})
        record = {'releaseId': args.release_id, 'manifestSha256': args.manifest_sha256, 'publicBaseUrl': 'https://' + args.hostname + '/releases/' + args.release_id + '/payload/', 'appliedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'legacyCacheControl': CACHE, 'fallback': 'anonymous app on source404/5xx or transport502/503/504; no-store', 'backup': str(backup), 'checks': checks}
        temporary_pin = install/('.media-pin-' + str(os.getpid()) + '.tmp')
        with temporary_pin.open('x') as handle:
            os.chmod(temporary_pin, 0o600)
            json.dump(record, handle, indent=2)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        (backup/'verification.json').write_text(json.dumps(record, indent=2) + '\n')
        os.replace(temporary_pin, pin)
        applied = False  # Config and atomic pin now commit together; do not roll back on logging failure.
        print(json.dumps({'passed': True, 'pin': str(pin), 'checks': len(checks), 'backup': str(backup)}), flush=True)
    except Exception:
        if applied:
            write_in_place(caddyfile, old)
            rollback = subprocess.run(['docker', 'exec', args.caddy_container, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'], capture_output=True)
            if rollback.returncode:
                print('ROLLBACK RELOAD FAILED; restore ' + str(backup/'Caddyfile.before') + ' in place and reload Caddy.', file=sys.stderr)
        raise
    finally:
        subprocess.run(['docker', 'exec', args.caddy_container, 'rm', '-f', '--', remote_candidate], capture_output=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Media pin failed: ' + str(error), file=sys.stderr)
        raise SystemExit(1)
