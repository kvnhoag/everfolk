#!/usr/bin/env python3
"""Exercise the real Caddy media adapter against isolated loopback mock services."""
import argparse
import http.server
import importlib.util
import json
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
import urllib.request
import urllib.error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--helper', default=str(Path(__file__).resolve().parents[1]/'runtime/pin-media-release.py'))
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('media_pin', args.helper)
    pin = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pin)
    received = []
    class Source(http.server.BaseHTTPRequestHandler):
        def log_message(self, *_): pass
        def do_GET(self):
            received.append({'path': self.path, 'cookie': self.headers.get('cookie'), 'authorization': self.headers.get('authorization')})
            if '?' in self.path:
                status, body = 400, b'QUERY MUST BE STRIPPED'
            elif self.path.endswith('/favicon.svg'):
                status, body = 200, b'<svg xmlns="http://www.w3.org/2000/svg"/>'
            elif self.path.endswith('/assets/timeout.webp'):
                time.sleep(4)  # Exceeds the adapter's real three-second header timeout.
                status, body = 200, b'LATE-MEDIA'
            elif self.path.endswith('/assets/good.webp') or self.path.endswith('/fonts/good.woff2'):
                status, body = 200, b'PUBLIC-MEDIA'
            elif self.path.endswith('/assets/upstream-error.webp'):
                status, body = 503, b'UPSTREAM ERROR'
            elif self.path.endswith('/assets/forbidden.webp'):
                status, body = 403, b'FORBIDDEN'
            else:
                status, body = 404, b'MISSING'
            if self.headers.get('range') == 'bytes=0-2' and status == 200:
                status, body = 206, body[:3]
            self.send_response(status)
            self.send_header('Content-Type', 'image/svg+xml' if self.path.endswith('/favicon.svg') else 'image/webp')
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable' if status in (200, 206) else 'no-store')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Security-Policy', "default-src 'none'")
            self.send_header('ETag', '"source-etag"')
            if status == 206: self.send_header('Content-Range', 'bytes 0-2/12')
            self.send_header('Content-Length', str(len(body)))
            try:
                self.end_headers()
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError): pass
    class App(http.server.BaseHTTPRequestHandler):
        def log_message(self, *_): pass
        def do_GET(self):
            body = json.dumps({'path': self.path, 'cookie': self.headers.get('cookie'), 'authorization': self.headers.get('authorization')}).encode()
            self.send_response(503 if self.path == '/api/app-error' else 200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'public,max-age=999999')
            self.send_header('CDN-Cache-Control', 'public,max-age=999999')
            self.send_header('Set-Cookie', 'test-cookie=should-not-escape')
            self.send_header('CF-Cache-Status', 'HIT')
            self.send_header('Age', '42')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
    source = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Source)
    app = http.server.ThreadingHTTPServer(('127.0.0.1', 0), App)
    for server in [source, app]: threading.Thread(target=server.serve_forever, daemon=True).start()
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1', 0)); port = reservation.getsockname()[1]
    task = 'everfolk-media-test-' + str(time.time_ns())
    container = task
    process = None
    results = []
    try:
        with tempfile.TemporaryDirectory(prefix=task+'-') as directory:
            config = '{\n\tadmin off\n\tauto_https off\n}\nhttp://127.0.0.1:' + str(port) + ' {\n\tbind 127.0.0.1\n' + pin.media_block('test-v1', '127.0.0.1:'+str(source.server_port), '127.0.0.1:'+str(app.server_port)) + '\thandle /api/app-error {\n\t\treverse_proxy 127.0.0.1:'+str(app.server_port)+'\n\t}\n\thandle /simulate-game-transport-error {\n\t\terror "game unavailable" 503\n\t}\n\thandle {\n\t\trespond "UNTOUCHED" 200\n\t}\n}\n'
            path = Path(directory)/'Caddyfile'; path.write_text(config)
            command = ['docker', 'run', '--rm', '--name', container, '--label', 'everfolk.test.owner='+task, '--network', 'host', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '-v', str(path)+':/etc/caddy/Caddyfile:ro', 'caddy:2', 'caddy', 'run', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile']
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            def fetch(suffix, headers=None):
                request = urllib.request.Request('http://127.0.0.1:'+str(port)+suffix, headers=headers or {})
                try:
                    with urllib.request.urlopen(request, timeout=5) as response: return response.status, {key.lower(): value for key, value in response.headers.items()}, response.read()
                except urllib.error.HTTPError as response: return response.code, {key.lower(): value for key, value in response.headers.items()}, response.read()
            deadline = time.monotonic()+15
            while True:
                if process.poll() is not None:
                    out, err = process.communicate(); raise RuntimeError('Test Caddy stopped: '+out+'\n'+err)
                try:
                    if fetch('/')[2] == b'UNTOUCHED': break
                except (OSError, urllib.error.URLError): pass
                if time.monotonic()>deadline: raise RuntimeError('Test Caddy did not become healthy')
                time.sleep(.1)
            status, headers, body = fetch('/assets/good.webp?v=a%20b', {'Cookie':'private=secret', 'Authorization':'Bearer private'})
            assert status == 200 and body == b'PUBLIC-MEDIA', (status, headers, body)
            assert headers.get('cache-control') == pin.CACHE and headers.get('x-everfolk-media-release') == 'test-v1', headers
            assert headers.get('access-control-allow-origin') == '*' and headers.get('content-security-policy') == "default-src 'none'" and headers.get('etag') == '"source-etag"', headers
            assert received[-1] == {'path':'/releases/test-v1/payload/assets/good.webp','cookie':None,'authorization':None}, received[-1]
            results.append('success preserves bytes/MIME/CORS/CSP/ETag; strips query and credentials; bounds alias TTL')
            status, headers, body = fetch('/assets/missing.webp?original=one%20two&again=2', {'Cookie':'private=secret', 'Authorization':'Bearer private'})
            assert status == 200 and json.loads(body) == {'path':'/assets/missing.webp?original=one%20two&again=2','cookie':None,'authorization':None}, (status, headers, body)
            assert headers.get('cache-control') == 'no-store' and headers.get('x-everfolk-media-fallback') == 'app', headers
            assert all(name not in headers for name in ['set-cookie', 'cdn-cache-control', 'cf-cache-status', 'age']), headers
            results.append('404 fallback preserves exact original path/query, strips credentials and forbids caching')
            status, headers, body = fetch('/assets/forbidden.webp')
            assert status == 403 and body == b'FORBIDDEN' and headers.get('cache-control') == 'no-store', (status, headers, body)
            results.append('non-404 errors stay errors with no-store')
            status, headers, body = fetch('/fonts/good.woff2')
            assert status == 200 and body == b'PUBLIC-MEDIA' and headers.get('cache-control') == pin.CACHE
            results.append('fonts use the same external storage adapter')
            status, headers, body = fetch('/favicon.svg?v=icon', {'Cookie':'private=secret', 'Authorization':'Bearer private'})
            assert status == 200 and body == b'<svg xmlns="http://www.w3.org/2000/svg"/>', (status, headers, body)
            assert headers.get('content-type') == 'image/svg+xml' and headers.get('cache-control') == pin.CACHE and headers.get('x-everfolk-media-release') == 'test-v1', headers
            assert received[-1] == {'path':'/releases/test-v1/payload/favicon.svg','cookie':None,'authorization':None}, received[-1]
            assert fetch('/favicon.svg/secret')[2] == b'UNTOUCHED'
            results.append('exact root favicon uses verified external SVG bytes, MIME, release and TTL without matching child paths')
            status, headers, body = fetch('/assets/good.webp', {'Range':'bytes=0-2'})
            assert status == 206 and body == b'PUB' and headers.get('content-range') == 'bytes 0-2/12' and headers.get('cache-control') == pin.CACHE, (status, headers, body)
            results.append('range206 response and byte range survive proxying')
            status, _, body = fetch('/api/private')
            assert status == 200 and body == b'UNTOUCHED'
            results.append('non-media application routes are untouched')
            status, _, body = fetch('/api/app-error')
            assert status == 503 and json.loads(body)['path'] == '/api/app-error'
            status, _, body = fetch('/simulate-game-transport-error')
            assert status == 503 and body == b''
            results.append('non-media upstream and Caddy transport error status/body remain unchanged')
            status, headers, body = fetch('/assets/upstream-error.webp?failure=503')
            assert status == 200 and json.loads(body)['path'] == '/assets/upstream-error.webp?failure=503' and headers.get('cache-control') == 'no-store'
            results.append('upstream503 falls back anonymously with exact URI and no-store')
            before = time.monotonic()
            status, headers, body = fetch('/assets/timeout.webp?original=timed-out')
            assert status == 200 and json.loads(body)['path'] == '/assets/timeout.webp?original=timed-out' and headers.get('cache-control') == 'no-store'
            assert 2.5 <= time.monotonic()-before < 5
            results.append('origin header timeout falls back within the image retry budget')
            source.shutdown(); source.server_close()
            status, headers, body = fetch('/assets/good.webp?transport=down')
            assert status == 200 and json.loads(body)['path'] == '/assets/good.webp?transport=down' and headers.get('cache-control') == 'no-store'
            results.append('origin connection failure falls back anonymously with exact URI and no-store')
            status, headers, body = fetch('/favicon.svg?transport=down', {'Cookie':'private=secret', 'Authorization':'Bearer private'})
            assert status == 200 and json.loads(body) == {'path':'/favicon.svg?transport=down','cookie':None,'authorization':None}, (status, headers, body)
            assert headers.get('cache-control') == 'no-store' and headers.get('x-everfolk-media-fallback') == 'app', headers
            results.append('favicon origin connection failure preserves exact URI and anonymous no-store fallback')
            print(json.dumps({'passed':True,'checks':results}, indent=2), flush=True)
    finally:
        found = subprocess.run(['docker', 'inspect', '--format', '{{index .Config.Labels "everfolk.test.owner"}}', container], capture_output=True, text=True)
        if found.returncode == 0 and found.stdout.strip() == task:
            subprocess.run(['docker', 'rm', '-f', container], capture_output=True)
        if process:
            try: process.communicate(timeout=5)
            except subprocess.TimeoutExpired: raise RuntimeError('Task-owned Docker client did not stop after container cleanup')
        for server in [source, app]: server.shutdown(); server.server_close()


if __name__ == '__main__': main()
