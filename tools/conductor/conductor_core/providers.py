"""Direct (automatic) seats: local model servers and keyless OpenAI-compatible
endpoints. No cloud API key required for any of these.

Ollama      : http://localhost:11434      (default)
LM Studio   : http://localhost:1234       (OpenAI-compatible, no key needed)
llama.cpp   : http://localhost:8080       (OpenAI-compatible, no key needed)
"""

import ipaddress
import json
import socket
import urllib.error
import urllib.parse
import urllib.request

NUM_CTX = 8192   # ask Ollama for a window big enough that the top of the prompt is not cut off


class ProviderError(RuntimeError):
    pass


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):  # a local model server never needs to bounce us elsewhere
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def validate_endpoint(url):
    """Seat endpoints must be plain http(s) to this machine or a private LAN address.

    Blocks file://, public hosts, link-local/cloud-metadata addresses, credentials in
    the URL, and redirects (see _NoRedirect). Returns the cleaned URL ('' stays '').
    """
    url = (url or "").strip()
    if not url:
        return ""
    p = urllib.parse.urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise ProviderError("Endpoint must look like http://localhost:11434 (http or https only).")
    if p.username or p.password or p.query or p.fragment:
        raise ProviderError("Endpoint must not contain credentials, a query string or a fragment.")
    try:
        infos = socket.getaddrinfo(p.hostname, p.port or 80, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise ProviderError(f"Cannot resolve endpoint host '{p.hostname}'.")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if ip.is_link_local or not (ip.is_loopback or ip.is_private):
            raise ProviderError(
                f"Endpoint host {p.hostname} ({ip}) is not local. Only this machine and private "
                "LAN addresses are allowed for seats."
            )
    return url.rstrip("/")


def _post_json(url, payload, timeout=240, headers=None):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with _OPENER.open(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise ProviderError(f"{url} -> HTTP {e.code}: {e.read()[:200].decode('utf-8', 'ignore')}")
    except urllib.error.URLError as e:
        raise ProviderError(f"{url} unreachable: {e.reason}")
    except Exception as e:  # noqa: BLE001
        raise ProviderError(str(e))


def chat_ollama(endpoint, model, prompt, system=None):
    endpoint = validate_endpoint(endpoint or "http://localhost:11434")
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    out = _post_json(
        f"{endpoint}/api/chat",
        {"model": model or "llama3.2", "messages": msgs, "stream": False,
         "options": {"num_ctx": NUM_CTX}},
    )
    return (out.get("message") or {}).get("content", "")


def chat_openai_compatible(endpoint, model, prompt, system=None, api_key=None):
    endpoint = validate_endpoint(endpoint or "http://localhost:1234")
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    out = _post_json(
        f"{endpoint}/v1/chat/completions",
        {"model": model or "", "messages": msgs, "stream": False},
        headers=headers,
    )
    try:
        return out["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        raise ProviderError("unexpected response shape from the model server")


def list_ollama_models(endpoint="http://localhost:11434"):
    try:
        endpoint = validate_endpoint(endpoint or "http://localhost:11434")
        with _OPENER.open(f"{endpoint}/api/tags", timeout=5) as r:
            data = json.loads(r.read().decode("utf-8"))
        return [m.get("name") for m in data.get("models", [])]
    except Exception:  # noqa: BLE001
        return []


def generate(seat, prompt):
    kind = (seat.get("kind") or "bridge").lower()
    if kind == "ollama":
        return chat_ollama(seat.get("endpoint"), seat.get("model"), prompt)
    if kind in ("openai_compatible", "lmstudio", "llamacpp"):
        return chat_openai_compatible(seat.get("endpoint"), seat.get("model"), prompt)
    raise ProviderError(
        f"Seat {seat.get('id')} is a bridge seat ({seat.get('name')}): copy the prompt into the "
        "app/browser tab yourself, then paste the reply back into the capture box."
    )
