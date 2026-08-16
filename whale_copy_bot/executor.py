"""Order executors: paper, Hyperliquid, and Bybit (perp / USDT linear)."""
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
        self.trades: list[dict] = []

    def open(self, symbol, side, size_usd, price):
        log.info("[PAPER] OPEN %s %s $%.0f @ %.2f", side, symbol, size_usd, price)
        return Position(symbol, side, size_usd, price)

    def close(self, pos, price, reason):
        direction = 1 if pos.side == "LONG" else -1
        pnl = direction * (price - pos.entry_price) / pos.entry_price * pos.size_usd
        self.realized_pnl += pnl
        self.trades.append({
            "symbol": pos.symbol, "side": pos.side, "size_usd": pos.size_usd,
            "entry": pos.entry_price, "exit": price, "pnl": pnl, "reason": reason,
        })
        log.info("[PAPER] CLOSE %s @ %.2f (%s) pnl=$%.2f cumul=$%.2f",
                 pos.side, price, reason, pnl, self.realized_pnl)
        return pnl


class HyperliquidExecutor:
    def __init__(self, wallet: str, private_key: str):
        from hyperliquid.exchange import Exchange
        from hyperliquid.utils import constants
        from eth_account import Account
        acct = Account.from_key(private_key)
        self.exchange = Exchange(acct, constants.MAINNET_API_URL, account_address=wallet)

    def open(self, symbol, side, size_usd, price):
        sz = size_usd / price
        r = self.exchange.market_open(symbol, side == "LONG", sz)
        log.info("[HL] OPEN response: %s", r)
        return Position(symbol, side, size_usd, price)

    def close(self, pos, price, reason):
        r = self.exchange.market_close(pos.symbol)
        log.info("[HL] CLOSE (%s) response: %s", reason, r)
        return 0.0


class BybitExecutor:
    """Bybit v5 unified account, linear (USDT-margined) perps.

    symbol convention: bot uses 'BTC' -> Bybit uses 'BTCUSDT'.
    """

    def __init__(self, api_key: str, api_secret: str, testnet: bool = False,
                 category: str = "linear", quote: str = "USDT"):
        from pybit.unified_trading import HTTP
        self.session = HTTP(api_key=api_key, api_secret=api_secret, testnet=testnet)
        self.category = category
        self.quote = quote

    def _bybit_symbol(self, sym: str) -> str:
        return sym if sym.endswith(self.quote) else f"{sym}{self.quote}"

    def open(self, symbol, side, size_usd, price):
        bsym = self._bybit_symbol(symbol)
        qty = round(size_usd / price, 3)
        r = self.session.place_order(
            category=self.category, symbol=bsym,
            side="Buy" if side == "LONG" else "Sell",
            orderType="Market", qty=str(qty),
        )
        log.info("[BYBIT] OPEN %s qty=%s response=%s", bsym, qty, r)
        return Position(symbol, side, size_usd, price)

    def close(self, pos, price, reason):
        bsym = self._bybit_symbol(pos.symbol)
        qty = round(pos.size_usd / pos.entry_price, 3)
        r = self.session.place_order(
            category=self.category, symbol=bsym,
            side="Sell" if pos.side == "LONG" else "Buy",
            orderType="Market", qty=str(qty), reduceOnly=True,
        )
        log.info("[BYBIT] CLOSE %s (%s) response=%s", bsym, reason, r)
        # Bybit doesn't return realized PnL synchronously; caller can query it later.
        return 0.0
