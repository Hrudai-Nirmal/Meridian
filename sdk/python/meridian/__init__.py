from __future__ import annotations

import functools
import json
import time
import urllib.request
import warnings
from datetime import datetime, timezone
from typing import Any, Callable, Optional
from urllib.parse import urlparse


DEFAULT_BASE_URL = "https://meridian.hrudainirmal.in"
DEFAULT_TIMEOUT = 5.0
VALID_STATUSES = {"success", "degraded", "failed", "running", "queued"}


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _validate_non_empty_string(value: str, field_name: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Meridian {field_name} is required.")


def _normalize_base_url(base_url: str) -> str:
    _validate_non_empty_string(base_url, "base_url")
    parsed_url = urlparse(base_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError("Meridian base_url must be a valid HTTP(S) URL.")
    return base_url.rstrip("/")


def _normalize_timeout(timeout: float) -> float:
    if not isinstance(timeout, (int, float)) or timeout <= 0:
        raise ValueError("Meridian timeout must be positive.")
    return timeout


def _validate_run_payload(payload: dict[str, Any]) -> None:
    if not isinstance(payload, dict):
        raise ValueError("Meridian run payload must be a dictionary.")

    node_id = payload.get("nodeId")
    started_at = payload.get("startedAt")
    status = payload.get("status", "success")

    _validate_non_empty_string(node_id, "nodeId")
    _validate_non_empty_string(started_at, "startedAt")

    if status not in VALID_STATUSES:
        raise ValueError("Meridian status must be one of success, degraded, failed, running, or queued.")

    steps = payload.get("steps")
    if isinstance(steps, list) and len(steps) > 100:
        raise ValueError("Meridian steps cannot contain more than 100 items.")


class Meridian:
    """Client for sending workflow telemetry to Meridian."""

    def __init__(
        self,
        token: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        on_error: Optional[Callable[[Exception], None]] = None,
    ) -> None:
        """Initialize a client with a project ingestion token."""
        _validate_non_empty_string(token, "token")
        self.token = token
        self.base_url = _normalize_base_url(base_url)
        self.timeout = _normalize_timeout(timeout)
        self.on_error = on_error

    def ingest_run(self, payload: dict[str, Any]) -> None:
        """Send one workflow run payload to Meridian."""
        _validate_run_payload(payload)
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
        urllib.request.urlopen(request, timeout=self.timeout).read()

    def trace(
        self,
        node_id: str,
        name: Optional[str] = None,
        external_id: Optional[str] = None,
        cost_usd: Optional[float] = None,
        tokens: Optional[int] = None,
    ) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        """Decorate a callable and report its execution without changing its result."""
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
                    except Exception as error:  # noqa: BLE001 - SDK telemetry must not break user code.
                        # Telemetry must not break the user's automation.
                        if self.on_error:
                            try:
                                self.on_error(error)
                            except Exception:
                                pass
                        else:
                            warnings.warn(f"Meridian telemetry delivery failed: {error}", RuntimeWarning, stacklevel=2)

            return wrapper

        return decorator


__all__ = ["Meridian"]
