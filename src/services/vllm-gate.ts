// vLLM's --api-key leaves /invocations and other routes open, and would also lock /v1/models, the
// node's readiness probe. So vLLM loads this middleware: every request needs `Bearer <password>`,
// except /v1/models + /health (readiness), /docs + /openapi.json (the API docs link on the manage
// page) and CORS preflight. If it cannot load, vLLM does not start.
const MIDDLEWARE = `import hmac, os

PW = os.environ["SERVICE_PASSWORD"]
if not PW:
    raise SystemExit("SERVICE_PASSWORD is empty")
KEY = ("Bearer " + PW).encode()
OPEN = ("/v1/models", "/health", "/docs", "/openapi.json")


class Gate:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        auth = dict(scope.get("headers", [])).get(b"authorization", b"")
        if scope["type"] == "lifespan" or scope.get("method") == "OPTIONS" or scope["path"] in OPEN or hmac.compare_digest(auth, KEY):
            return await self.app(scope, receive, send)
        if scope["type"] == "websocket":
            return await send({"type": "websocket.close"})
        await send({"type": "http.response.start", "status": 401, "headers": []})
        await send({"type": "http.response.body", "body": b""})
`;

// Replaces the image ENTRYPOINT (`vllm serve`), so it is repeated here.
const SCRIPT = `mkdir -p /tmp/ocean && cat > /tmp/ocean/ocean_gate.py <<'EOF'
${MIDDLEWARE}EOF
PYTHONPATH=/tmp/ocean exec vllm serve "$@" --middleware ocean_gate.Gate`;

export const VLLM_GATE_ENTRYPOINT: string[] = ['bash', '-c', SCRIPT, 'gate'];
