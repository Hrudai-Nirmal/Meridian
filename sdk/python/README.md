# Meridian Python SDK

Python tracing SDK for Meridian workflow telemetry. It sends provider-neutral run data to `/api/ingest/runs` with a project-scoped ingestion token.

## Install

Private beta currently keeps the package in this repository:

```bash
PYTHONPATH=sdk/python python3 -c "from meridian import Meridian; print(Meridian)"
```

Future public install path:

```bash
pip install meridian
```

## Quick Start

```python
import os
from meridian import Meridian

meridian = Meridian(
    token=os.environ["MERIDIAN_INGESTION_TOKEN"],
    timeout=5,
    on_error=lambda error: print(f"Meridian telemetry failed: {error}"),
)

@meridian.trace(node_id=os.environ["MERIDIAN_NODE_ID"], name="Support agent")
def run_automation():
    return handle_task()
```

Trace delivery failures are caught inside the decorator so telemetry does not break the wrapped automation.

## Send A Test Run

```bash
PYTHONPATH=sdk/python \
MERIDIAN_INGESTION_TOKEN="<ingestion-token>" \
MERIDIAN_NODE_ID="<endpoint-node-id>" \
python3 sdk/python/examples/send_test_run.py
```

Optional env values:

- `MERIDIAN_BASE_URL`: defaults to `https://meridian.hrudainirmal.in`.
- `MERIDIAN_EXTERNAL_ID`: overrides the generated example run id.
- `MERIDIAN_TIMEOUT`: delivery timeout in seconds.

The example prints node id and external id only. It never prints the ingestion token.

## Verify Package Readiness

```bash
cd sdk/python
python3 -m unittest discover -s tests
python3 -m pip wheel . --no-deps --wheel-dir /tmp/meridian-python-wheel
```

The wheel includes the typed `meridian` package and `py.typed` marker.

## Compatibility

Deprecated `argusgrid.ArgusGrid` remains for existing preview callers. New code should import `Meridian` from `meridian`.
