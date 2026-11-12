"""Optional local Laya service. No game state settlement or reward authority lives here."""
import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock

MODEL = "convaiinnovations/laya-typed-decisions"
MAX_BYTES = 16_000


def create_server(agent, port):
    lock = Lock()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def respond(self, status, value):
            raw = json.dumps(value, allow_nan=False).encode("utf-8")
            try:
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
            except (BrokenPipeError, ConnectionResetError):
                pass  # The game's bounded timeout may have already returned a fallback.

        def do_GET(self):
            self.respond(200 if self.path == "/healthz" else 404,
                         {"provider": "laya", "ready": self.path == "/healthz"})

        def do_POST(self):
            if self.path != "/v1/systemone":
                return self.respond(404, {"error": "Unknown endpoint."})
            if self.headers.get("Origin"):
                return self.respond(403, {"error": "Server-to-server requests only."})
            self.connection.settimeout(5)
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= MAX_BYTES or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                    raise ValueError()
                request = json.loads(self.rfile.read(size))
                if type(request) is not dict or set(request) != {"model", "state", "questions"} or request["model"] != MODEL:
                    raise ValueError()
                if type(request["state"]) is not str or len(request["state"]) > 8000:
                    raise ValueError()
                questions = request["questions"]
                if type(questions) is not dict or set(questions) != {"npc"}:
                    raise ValueError()
                question = questions["npc"]
                if type(question) is not dict or set(question) != {"type", "instructions", "criteria"} or question["type"] != "choice":
                    raise ValueError()
                criteria = question["criteria"]
                if type(question["instructions"]) is not str or len(question["instructions"]) > 200:
                    raise ValueError()
                if type(criteria) is not dict or not 2 <= len(criteria) <= 10:
                    raise ValueError()
                if list(criteria) != [f"choice_{i}" for i in range(len(criteria))] or any(type(v) is not str or not 0 < len(v) <= 240 for v in criteria.values()):
                    raise ValueError()
            except (ValueError, TypeError, KeyError, TimeoutError):
                return self.respond(422, {"error": "Invalid bounded choice request."})
            if not lock.acquire(blocking=False):
                return self.respond(429, {"error": "Laya is busy. Use a game fallback."})
            try:
                result = agent.system_one(request["state"], questions)
                usage = result["usage"]
                if usage.get("truncated") or usage.get("options"):
                    raise ValueError()
                answer = result["answers"]["npc"]
                selected = {key: answer[key] for key in ("type", "choice", "confidence", "probabilities")}
                self.respond(200, {"model": MODEL, "answers": {"npc": selected}, "usage": {"input_tokens": usage["input_tokens"], "output_tokens": usage["output_tokens"]}})
            except Exception:
                self.respond(503, {"error": "Laya inference did not complete."})
            finally:
                lock.release()

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    return server


def main():
    parser = argparse.ArgumentParser(description="Run the optional loopback-only NPC Laya service")
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--model-path", default=MODEL)
    parser.add_argument("--threads", type=int, choices=range(1, 9), default=2)
    args = parser.parse_args()
    os.environ.setdefault("USE_TF", "0")
    import torch
    import laya
    torch.set_num_threads(args.threads)
    agent = laya.load(args.model_path, device="cpu", revision="reviewed")
    server = create_server(agent, args.port)
    print(f"Laya ready: http://127.0.0.1:{server.server_port}/v1/systemone", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
