from __future__ import annotations

import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class AutoBotDeploymentContractTests(unittest.TestCase):
    def test_compose_uses_internal_url_and_declares_healthcheck(self) -> None:
        compose = (PROJECT_ROOT / "docker-compose.yml").read_text(encoding="utf-8")

        self.assertIn("PMBI_AUTOBOT_INTERNAL_URL:", compose)
        self.assertIn("http://autobot:8765", compose)
        self.assertIn("healthcheck:", compose)
        self.assertIn("http://127.0.0.1:8765/healthz", compose)

    def test_example_env_names_the_file_docker_compose_actually_reads(self) -> None:
        example = (PROJECT_ROOT / ".env.docker.example").read_text(encoding="utf-8")

        self.assertIn("Copy to .env ", example)
        self.assertNotIn("Copy to .env.docker", example)


if __name__ == "__main__":
    unittest.main()
