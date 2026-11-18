"""Tiny web service so the Debdabe app can ask the model (testing only).

Standard library only. Endpoints:
  GET  /health      -> {"status": "ok", "model": name}
  GET  /log?key=…   -> every request so far (only with the secret key)
  POST /understand  {"text": "..."} -> {"intent", "confidence", "facts"}
Every request is kept in LOG so you can review what you tried.
"""
import json
import urllib.parse
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LOG = []


def start(predict, model_name, port=8000, log_key=None):
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def _send(self, code, obj):
            body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "content-type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):  # browser CORS check
            self._send(200, {})

        def do_GET(self):
            url = urllib.parse.urlparse(self.path)
            if url.path.rstrip("/") == "/health":
                self._send(200, {"status": "ok", "model": model_name})
            elif url.path.rstrip("/") == "/log" and log_key:
                key = urllib.parse.parse_qs(url.query).get("key", [""])[0]
                if key == log_key:
                    self._send(200, {"count": len(LOG), "requests": LOG})
                else:
                    self._send(403, {"error": "wrong key"})
            else:
                self._send(404, {"error": "not found"})

        def do_POST(self):
            if self.path.rstrip("/") != "/understand":
                self._send(404, {"error": "not found"})
                return
            try:
                n = int(self.headers.get("Content-Length", "0"))
                text = str(json.loads(self.rfile.read(n) or b"{}").get("text", "")).strip()[:1000]
            except (ValueError, json.JSONDecodeError):
                self._send(400, {"error": "send JSON like {\"text\": \"...\"}"})
                return
            if not text:
                self._send(400, {"error": "text is empty"})
                return
            t0 = time.time()
            with lock:
                pred = predict([text])[0]
            pred["ms"] = round((time.time() - t0) * 1000)
            pred["model"] = model_name
            LOG.append({"text": text, **pred})
            self._send(200, pred)

        def log_message(self, *args):  # keep the notebook output quiet
            pass

    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server
