from __future__ import annotations

import sys
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402


class _HtmlResponse:
    status = 200

    def __init__(self, body: bytes = b"") -> None:
        self.body = body
        self.headers = Message()
        self.headers["Content-Type"] = "text/html; charset=utf-8"

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return self.body


class AutoBotMarketClientTests(unittest.TestCase):
    def test_market_html_contract_keeps_successful_offers_without_status_note(self) -> None:
        html = """
        <article class="item">
          <div class="item-head">
            <div><div class="item-index">7</div><div class="item-title">Щебень 20-40</div></div>
            <span class="tag">Материалы</span>
          </div>
          <div class="meta">
            <span class="tag">Кол-во: 12</span>
            <span class="tag">Ед.: м3</span>
            <span class="tag">Смета за ед.: 2 500 руб.</span>
            <span class="tag">Смета всего: 30 000 руб.</span>
            <span class="tag">Рынок: 1 890; 2 050</span>
          </div>
          <div class="offers">
            <div class="offer">
              <div class="offer-top">
                <div class="offer-title"><a href="https://supplier.example/scheben">Щебень с доставкой</a></div>
                <div class="num">1 890 руб.</div>
              </div>
              <div class="offer-snippet">Цена за кубический метр</div>
            </div>
          </div>
        </article>
        """

        rows = server.parse_market_view_html(html, "material")

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["positionIndex"], 7)
        self.assertEqual(rows[0]["estimateUnitPrice"], 2500)
        self.assertEqual(rows[0]["marketPrice"], 1890)
        self.assertEqual(rows[0]["offers"][0]["url"], "https://supplier.example/scheben")
        self.assertEqual(rows[0]["offers"][0]["price"], 1890)

    @patch("server.urllib.request.urlopen")
    def test_market_fetch_uses_internal_docker_url_and_encodes_path(self, urlopen) -> None:
        urlopen.return_value = _HtmlResponse()
        with (
            patch.object(server, "PMBI_AUTOBOT_INTERNAL_URL", "http://autobot:8765"),
            patch.object(server, "PMBI_AUTOBOT_BASE_URL", "http://127.0.0.1:8765"),
        ):
            rows = server.fetch_autobot_market_rows("estimate/with space", "material type")

        self.assertEqual(rows, [])
        request = urlopen.call_args.args[0]
        self.assertEqual(
            request.full_url,
            "http://autobot:8765/estimates/estimate%2Fwith%20space/market-view?market_type=material%20type",
        )
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 20)

    @patch("server.urllib.request.urlopen")
    def test_market_fetch_falls_back_to_public_url_outside_docker(self, urlopen) -> None:
        urlopen.return_value = _HtmlResponse()
        with (
            patch.object(server, "PMBI_AUTOBOT_INTERNAL_URL", ""),
            patch.object(server, "PMBI_AUTOBOT_BASE_URL", "http://127.0.0.1:8765"),
        ):
            server.fetch_autobot_market_rows("estimate-1", "work")

        self.assertEqual(
            urlopen.call_args.args[0].full_url,
            "http://127.0.0.1:8765/estimates/estimate-1/market-view?market_type=work",
        )

    @patch("server.urllib.request.urlopen")
    def test_market_fetch_fails_fast_when_autobot_is_not_configured(self, urlopen) -> None:
        with (
            patch.object(server, "PMBI_AUTOBOT_INTERNAL_URL", ""),
            patch.object(server, "PMBI_AUTOBOT_BASE_URL", ""),
            self.assertRaisesRegex(server.AutoBotUnavailableError, "autobot_not_configured"),
        ):
            server.fetch_autobot_market_rows("estimate-1", "work")

        urlopen.assert_not_called()


if __name__ == "__main__":
    unittest.main()
