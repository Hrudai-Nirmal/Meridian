"""Regression tests for runnable Meridian SDK telemetry examples."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


EXAMPLE_PATH = Path(__file__).resolve().parents[1] / "examples" / "send_test_run.py"
SPEC = importlib.util.spec_from_file_location("send_test_run", EXAMPLE_PATH)
send_test_run = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(send_test_run)


class PythonTelemetryExampleTests(unittest.TestCase):
    def test_validates_required_environment(self) -> None:
        writes: list[str] = []

        exit_code = send_test_run.main(
            env={},
            client_factory=lambda **_kwargs: self.fail("client should not be created"),
            stdout=writes.append,
            stderr=writes.append,
        )

        self.assertEqual(exit_code, 1)
        self.assertIn("MERIDIAN_INGESTION_TOKEN", "".join(writes))
        self.assertIn("MERIDIAN_NODE_ID", "".join(writes))

    def test_sends_safe_synthetic_run(self) -> None:
        calls: list[dict[str, object]] = []

        class FakeClient:
            def __init__(self, **kwargs: object) -> None:
                calls.append({"options": kwargs})

            def ingest_run(self, payload: dict[str, object]) -> None:
                calls.append({"payload": payload})

        exit_code = send_test_run.main(
            env={
                "MERIDIAN_INGESTION_TOKEN": "secret_token_value",
                "MERIDIAN_NODE_ID": "node_123",
                "MERIDIAN_BASE_URL": "https://example.test",
            },
            client_factory=FakeClient,
            stdout=lambda message: calls.append({"message": message}),
            stderr=lambda _message: None,
        )

        self.assertEqual(exit_code, 0)
        self.assertEqual(calls[0]["options"]["token"], "secret_token_value")
        self.assertEqual(calls[0]["options"]["base_url"], "https://example.test")
        self.assertEqual(calls[1]["payload"]["nodeId"], "node_123")
        self.assertEqual(calls[1]["payload"]["status"], "success")
        self.assertEqual(calls[1]["payload"]["steps"][0]["toolName"], "meridian-python-example")
        self.assertNotIn("secret_token_value", calls[-1]["message"])

    def test_builds_bounded_demo_payloads(self) -> None:
        run = send_test_run.build_synthetic_run(
            {
                "MERIDIAN_NODE_ID": "node_123",
                "MERIDIAN_EXTERNAL_ID": "example_001",
            }
        )

        self.assertEqual(run["nodeId"], "node_123")
        self.assertEqual(run["externalId"], "example_001")
        self.assertEqual(run["costUsd"], 0.001)
        self.assertEqual(run["tokens"], 128)
        self.assertEqual(len(run["steps"]), 2)


if __name__ == "__main__":
    unittest.main()
