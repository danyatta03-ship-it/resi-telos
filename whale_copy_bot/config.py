from dataclasses import dataclass
from typing import Literal


@dataclass
class Config:
    mode: Literal["feed-check", "paper", "backtest", "live"] = "feed-check"
    exchange: Literal["bybit", "hyperliquid"] = "bybit"

    # HUNT
    symbol: str = "BTC"
    min_position_usd: float = 30_000_000
    poll_seconds: float = 3.0
    watchlist_path: str = "whale_copy_bot/watchlist.txt"

    # ARM
    fill_quiet_seconds: float = 60.0
    fill_quiet_delta_pct: float = 0.25
    retrace_pct_from_hwm: float = 0.40
    entry_confirm_ticks: int = 3
    min_atr_pct: float = 0.15
    max_atr_pct: float = 3.0

    # RIDE / risk
    account_equity_usd: float = 10_000.0
    risk_per_trade_pct: float = 0.5
    leverage_cap: float = 5.0
    take_profit_pct: float = 1.5
    stop_loss_pct: float = 0.8
    liq_buffer_pct: float = 2.0
    max_hold_seconds: float = 4 * 60 * 60
    max_concurrent_trades: int = 2

    # EXIT
    net_reduction_exit_pct: float = 1.0
    reduction_window_seconds: float = 300.0

    # Portfolio safety
    daily_loss_stop_pct: float = 2.0
    cooldown_after_loss_min: float = 30.0

    # Exchange creds (populate from env)
    bybit_api_key: str = ""
    bybit_api_secret: str = ""
    bybit_testnet: bool = False
    bybit_quote: str = "USDT"
    hyperliquid_wallet: str = ""
    hyperliquid_private_key: str = ""

    # Backtest
    backtest_csv: str = "whale_copy_bot/data/history.csv"

    logfile: str = "whale_bot.log"
