"""Regression tests for the Meridian Python SDK preview."""

from __future__ import annotations

import unittest
from unittest import mock

from meridian import Meridian


class MeridianSdkTests(unittest.TestCase):
    def test_validates_required_client_and_run_fields(self) -> None:
        with self.assertRaisesRegex(ValueError, "token"):
            Meridian("")

        client = Meridian("token_test", base_url="https://example.test")

        with self.assertRaisesRegex(ValueError, "nodeId"):
            client.ingest_run({"nodeId": "", "status": "success", "startedAt": "2026-07-07T00:00:00Z"})

    def test_ingest_run_uses_timeout_and_authorization_header(self) -> None:
        class FakeResponse:
            def read(self) -> bytes:
                return b'{"ok":true}'

        client = Meridian("token_test", base_url="https://example.test", timeout=1.25)

        with mock.patch("urllib.request.urlopen", return_value=FakeResponse()) as urlopen:
            client.ingest_run(
                {
                    "nodeId": "node_123",
                    "status": "success",
                    "startedAt": "2026-07-07T00:00:00Z",
                }
            )

        request = urlopen.call_args.args[0]
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 1.25)
        self.assertEqual(request.full_url, "https://example.test/api/ingest/runs")
        self.assertEqual(request.get_header("Authorization"), "Bearer token_test")

    def test_trace_reports_delivery_failure_without_changing_result(self) -> None:
        errors: list[Exception] = []
        client = Meridian("token_test", base_url="https://example.test", on_error=errors.append)

        with mock.patch.object(client, "ingest_run", side_effect=RuntimeError("delivery failed")):
            @client.trace(node_id="node_123", name="Demo trace")
            def run_agent() -> str:
                return "handled"

            self.assertEqual(run_agent(), "handled")

        self.assertEqual(len(errors), 1)
        self.assertIn("delivery failed", str(errors[0]))

    def test_trace_ignores_on_error_hook_failure(self) -> None:
        def raise_from_hook(_error: Exception) -> None:
            raise RuntimeError("observer failed")

        client = Meridian("token_test", base_url="https://example.test", on_error=raise_from_hook)

        with mock.patch.object(client, "ingest_run", side_effect=RuntimeError("delivery failed")):
            @client.trace(node_id="node_123", name="Demo trace")
            def run_agent() -> str:
                return "handled"

            self.assertEqual(run_agent(), "handled")


if __name__ == "__main__":
    unittest.main()
