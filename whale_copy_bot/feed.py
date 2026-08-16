"""Moon Dev liquidation feed abstraction.

The real endpoint publishes positions close to liquidation. We only care about
whales (>= min_position_usd) on `symbol`. Every poll returns a list of Whale
snapshots with: id, side (LONG/SHORT), size_usd, entry_price, mark_price,
liq_price, hwm (best price whale has ever seen for their side), timestamp.
"""
from __future__ import annotations

import time
import random
from dataclasses import dataclass
from typing import Iterable, Protocol


@dataclass
class Whale:
    whale_id: str
    symbol: str
    side: str                 # "LONG" or "SHORT"
    size_usd: float
    entry_price: float
    mark_price: float
    liq_price: float
    hwm: float                # best price seen from whale's perspective (long: high, short: low)
    ts: float


class Feed(Protocol):
    def poll(self) -> list[Whale]: ...


class MoonDevFeed:
    def __init__(self, endpoint: str, api_key: str, symbol: str, min_usd: float):
        import requests
        self._requests = requests
        self.endpoint = endpoint
        self.api_key = api_key
        self.symbol = symbol
        self.min_usd = min_usd

    def poll(self) -> list[Whale]:
        r = self._requests.get(
            self.endpoint,
            params={"symbol": self.symbol},
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=5,
        )
        r.raise_for_status()
        out: list[Whale] = []
        for row in r.json().get("positions", []):
            if float(row["size_usd"]) < self.min_usd:
                continue
            if row["symbol"] != self.symbol:
                continue
            out.append(Whale(
                whale_id=row["id"],
                symbol=row["symbol"],
                side=row["side"].upper(),
                size_usd=float(row["size_usd"]),
                entry_price=float(row["entry_price"]),
                mark_price=float(row["mark_price"]),
                liq_price=float(row["liq_price"]),
                hwm=float(row.get("hwm", row["entry_price"])),
                ts=float(row.get("ts", time.time())),
            ))
        return out


class MockFeed:
    """Deterministic-ish mock for feed-check / paper mode without network."""

    def __init__(self, symbol: str = "BTC", size_usd: float = 135_000_000):
        self.symbol = symbol
        self._id = "whale-mock-1"
        self._side = "SHORT"
        self._entry = 68_000.0
        self._hwm = 68_500.0     # short's best price = higher
        self._size = size_usd
        self._mark = 68_400.0
        self._liq = 72_000.0
        self._t0 = time.time()

    def poll(self) -> list[Whale]:
        elapsed = time.time() - self._t0
        # simulate: whale stops filling after 30s; price then drifts down
        drift = -min(elapsed, 300) * 0.5
        self._mark = 68_400.0 + drift + random.uniform(-20, 20)
        # gross churn: whale re-shorts a bit but net size stable
        churn = random.uniform(-0.002, 0.002)
        self._size *= (1 + churn)
        return [Whale(self._id, self.symbol, self._side, self._size,
                      self._entry, self._mark, self._liq, self._hwm, time.time())]
