from __future__ import annotations

import functools
import json
import time
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable, Optional


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class ArgusGrid:
    def __init__(self, token: str, base_url: str = "https://argusgrid.hrudainirmal.in") -> None:
        self.token = token
        self.base_url = base_url.rstrip("/")

    def ingest_run(self, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/api/ingest/runs",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
        )
        urllib.request.urlopen(request, timeout=5).read()

    def trace(
        self,
        node_id: str,
        name: Optional[str] = None,
        external_id: Optional[str] = None,
        cost_usd: Optional[float] = None,
        tokens: Optional[int] = None,
    ) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        def decorator(function: Callable[..., Any]) -> Callable[..., Any]:
            @functools.wraps(function)
            def wrapper(*args: Any, **kwargs: Any) -> Any:
                started_at = _iso_now()
                started = time.perf_counter()
                status = "success"

                try:
                    return function(*args, **kwargs)
                except Exception:
                    status = "failed"
                    raise
                finally:
                    finished_at = _iso_now()
                    latency_ms = int((time.perf_counter() - started) * 1000)
                    payload: dict[str, Any] = {
                        "nodeId": node_id,
                        "externalId": external_id,
                        "status": status,
                        "startedAt": started_at,
                        "finishedAt": finished_at,
                        "costUsd": cost_usd,
                        "tokens": tokens,
                        "steps": [
                            {
                                "name": name or function.__name__,
                                "status": status,
                                "latencyMs": latency_ms,
                                "toolName": "python-sdk",
                            }
                        ],
                    }
                    try:
                        self.ingest_run({key: value for key, value in payload.items() if value is not None})
                    except Exception:
                        # Telemetry must not break the user's automation.
                        pass

            return wrapper

        return decorator


__all__ = ["ArgusGrid"]
