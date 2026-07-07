"""Runnable Meridian Python telemetry example.

The script sends one synthetic workflow run using env vars so beta users can
verify token/node setup without editing source code.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
import sys
from typing import Callable, Mapping, Optional

from meridian import Meridian


REQUIRED_ENV = ("MERIDIAN_INGESTION_TOKEN", "MERIDIAN_NODE_ID")


def get_required_env(env: Mapping[str, str], key: str) -> str:
    """Return a required env value or raise a setup-focused error."""
    value = env.get(key)
    if value is None or not value.strip():
        raise ValueError(f"Missing {key}.")
    return value


def build_synthetic_run(env: Mapping[str, str]) -> dict[str, object]:
    """Build a small, bounded synthetic run payload for onboarding tests."""
    finished_at = datetime.now(timezone.utc)
    started_at = finished_at - timedelta(milliseconds=1400)

    return {
        "nodeId": get_required_env(env, "MERIDIAN_NODE_ID"),
        "externalId": env.get("MERIDIAN_EXTERNAL_ID") or f"meridian-python-example-{int(finished_at.timestamp() * 1000)}",
        "status": "success",
        "startedAt": started_at.isoformat().replace("+00:00", "Z"),
        "finishedAt": finished_at.isoformat().replace("+00:00", "Z"),
        "costUsd": 0.001,
        "tokens": 128,
        "steps": [
            {
                "name": "Prepare input",
                "status": "success",
                "latencyMs": 350,
                "toolName": "meridian-python-example",
            },
            {
                "name": "Generate response",
                "status": "success",
                "latencyMs": 1050,
                "toolName": "meridian-python-example",
            },
        ],
    }


def main(
    env: Optional[Mapping[str, str]] = None,
    client_factory: Callable[..., Meridian] = Meridian,
    stdout: Callable[[str], object] = sys.stdout.write,
    stderr: Callable[[str], object] = sys.stderr.write,
) -> int:
    """Send one synthetic run and return a process-style exit code."""
    environment = env or os.environ

    try:
        token = get_required_env(environment, "MERIDIAN_INGESTION_TOKEN")
        payload = build_synthetic_run(environment)
        client = client_factory(
            token=token,
            base_url=environment.get("MERIDIAN_BASE_URL", "https://meridian.hrudainirmal.in"),
            timeout=float(environment.get("MERIDIAN_TIMEOUT", "5")),
        )

        client.ingest_run(payload)
        stdout(f"Meridian telemetry test run sent for node {payload['nodeId']} with external id {payload['externalId']}.\n")
        return 0
    except Exception as error:
        setup_hint = " and ".join(REQUIRED_ENV)
        stderr(f"Meridian telemetry example failed. Set {setup_hint}, then retry. {error}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
