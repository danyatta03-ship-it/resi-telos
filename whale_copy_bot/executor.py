"""Order executors: paper (in-memory) and Hyperliquid live.

Only long/short market entries and reduce-only market exits are needed.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol


log = logging.getLogger(__name__)


@dataclass
class Position:
    symbol: str
    side: str          # LONG / SHORT
    size_usd: float
    entry_price: float


class Executor(Protocol):
    def open(self, symbol: str, side: str, size_usd: float, price: float) -> Position: ...
    def close(self, pos: Position, price: float, reason: str) -> float: ...


class PaperExecutor:
    def __init__(self) -> None:
        self.realized_pnl = 0.0

    def open(self, symbol, side, size_usd, price):
        log.info("[PAPER] OPEN %s %s $%.0f @ %.2f", side, symbol, size_usd, price)
        return Position(symbol, side, size_usd, price)

    def close(self, pos, price, reason):
        direction = 1 if pos.side == "LONG" else -1
        pnl = direction * (price - pos.entry_price) / pos.entry_price * pos.size_usd
        self.realized_pnl += pnl
        log.info("[PAPER] CLOSE %s @ %.2f (%s) pnl=$%.2f cumul=$%.2f",
                 pos.side, price, reason, pnl, self.realized_pnl)
        return pnl


class HyperliquidExecutor:
    """Wraps hyperliquid-python-sdk. Kept thin; only used in --mode live."""

    def __init__(self, wallet: str, private_key: str):
        # Imported lazily so paper mode has no hard dep.
        from hyperliquid.exchange import Exchange
        from hyperliquid.utils import constants
        from eth_account import Account
        acct = Account.from_key(private_key)
        self.exchange = Exchange(acct, constants.MAINNET_API_URL, account_address=wallet)

    def open(self, symbol, side, size_usd, price):
        is_buy = side == "LONG"
        sz = size_usd / price
        r = self.exchange.market_open(symbol, is_buy, sz)
        log.info("[LIVE] OPEN response: %s", r)
        return Position(symbol, side, size_usd, price)

    def close(self, pos, price, reason):
        r = self.exchange.market_close(pos.symbol)
        log.info("[LIVE] CLOSE (%s) response: %s", reason, r)
        return 0.0
