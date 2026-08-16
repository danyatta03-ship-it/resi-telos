"""Whale position feed backed by Hyperliquid's PUBLIC info API.

No third-party paid service required. Hyperliquid publishes per-address
`clearinghouseState` and `allMids` on its public `/info` endpoint, so if we
keep a watchlist of addresses we can compute each whale's:
  - side / size / entry / mark / liq_price
  - HWM (best price ever observed for their side, from our own polling)

The watchlist is a plain text file (one address per line). You can seed it
with well-known HL whales, or with the top N addresses from the public
leaderboard (see scripts/refresh_watchlist.py).
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


HL_INFO_URL = "https://api.hyperliquid.xyz/info"


@dataclass
class Whale:
    whale_id: str            # HL wallet address
    symbol: str
    side: str                # "LONG" or "SHORT"
    size_usd: float
    entry_price: float
    mark_price: float
    liq_price: float
    hwm: float               # best price seen from whale's perspective
    ts: float


class Feed(Protocol):
    def poll(self) -> list[Whale]: ...


def _load_watchlist(path: str) -> list[str]:
    p = Path(path)
    if not p.exists():
        return []
    return [ln.strip() for ln in p.read_text().splitlines()
            if ln.strip() and not ln.startswith("#")]


class HyperliquidWhaleFeed:
    """Polls HL public info API for a watchlist of addresses."""

    def __init__(self, symbol: str, min_usd: float, watchlist_path: str):
        import requests
        self._requests = requests
        self.symbol = symbol
        self.min_usd = min_usd
        self.watchlist = _load_watchlist(watchlist_path)
        # persistent HWM across polls (keyed by whale+side)
        self._hwm: dict[tuple[str, str], float] = {}
        if not self.watchlist:
            raise RuntimeError(
                f"Empty watchlist at {watchlist_path}. "
                "Add HL wallet addresses (one per line) or run scripts/refresh_watchlist.py."
            )

    def _post(self, payload: dict) -> dict:
        r = self._requests.post(HL_INFO_URL, json=payload, timeout=8)
        r.raise_for_status()
        return r.json()

    def _mark_price(self) -> float | None:
        mids = self._post({"type": "allMids"})
        v = mids.get(self.symbol)
        return float(v) if v is not None else None

    def poll(self) -> list[Whale]:
        mark = self._mark_price()
        if mark is None:
            return []
        out: list[Whale] = []
        now = time.time()
        for addr in self.watchlist:
            try:
                st = self._post({"type": "clearinghouseState", "user": addr})
            except Exception:
                continue
            for ap in st.get("assetPositions", []):
                pos = ap.get("position", {})
                if pos.get("coin") != self.symbol:
                    continue
                szi = float(pos.get("szi", 0))       # signed size in coin units
                if szi == 0:
                    continue
                side = "LONG" if szi > 0 else "SHORT"
                notional = abs(szi) * mark
                if notional < self.min_usd:
                    continue
                entry = float(pos.get("entryPx") or mark)
                liq = float(pos.get("liquidationPx") or 0)
                key = (addr, side)
                prev = self._hwm.get(key)
                if prev is None:
                    self._hwm[key] = mark
                elif side == "LONG":
                    self._hwm[key] = max(prev, mark)
                else:
                    self._hwm[key] = min(prev, mark)
                out.append(Whale(
                    whale_id=addr, symbol=self.symbol, side=side,
                    size_usd=notional, entry_price=entry, mark_price=mark,
                    liq_price=liq, hwm=self._hwm[key], ts=now,
                ))
        return out


class MockFeed:
    """Deterministic-ish mock for feed-check / paper without network.

    Simulates a large short getting slowly bled by a downward drift, with
    gross-churn buybacks that leave net size flat -- to prove the strategy
    doesn't fire EMERGENCY EXIT on churn.
    """

    def __init__(self, symbol: str = "BTC", size_usd: float = 135_000_000):
        import random
        self._random = random
        self.symbol = symbol
        self._id = "whale-mock-1"
        self._side = "SHORT"
        self._entry = 68_000.0
        self._hwm = 68_500.0
        self._size = size_usd
        self._mark = 68_400.0
        self._liq = 72_000.0
        self._t0 = time.time()

    def poll(self) -> list[Whale]:
        elapsed = time.time() - self._t0
        drift = -min(elapsed, 300) * 0.5
        self._mark = 68_400.0 + drift + self._random.uniform(-20, 20)
        churn = self._random.uniform(-0.002, 0.002)
        self._size *= (1 + churn)
        return [Whale(self._id, self.symbol, self._side, self._size,
                      self._entry, self._mark, self._liq, self._hwm, time.time())]
