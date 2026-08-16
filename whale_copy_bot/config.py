from dataclasses import dataclass
from typing import Literal


@dataclass
class Config:
    mode: Literal["feed-check", "paper", "live"] = "feed-check"

    # HUNT (whale qualification)
    symbol: str = "BTC"
    min_position_usd: float = 30_000_000
    poll_seconds: float = 3.0
    watchlist_path: str = "whale_copy_bot/watchlist.txt"

    # ARM (entry gating -- err on the side of missing trades)
    fill_quiet_seconds: float = 60.0
    fill_quiet_delta_pct: float = 0.25
    retrace_pct_from_hwm: float = 0.40
    entry_confirm_ticks: int = 3          # NEW: ARM conditions must hold N polls in a row
    min_atr_pct: float = 0.15             # NEW: skip if volatility too dead
    max_atr_pct: float = 3.0              # NEW: skip if chaotic

    # RIDE / risk
    account_equity_usd: float = 10_000.0
    risk_per_trade_pct: float = 0.5
    leverage_cap: float = 5.0
    take_profit_pct: float = 1.5
    stop_loss_pct: float = 0.8
    liq_buffer_pct: float = 2.0
    max_hold_seconds: float = 4 * 60 * 60
    max_concurrent_trades: int = 2        # NEW

    # EXIT
    net_reduction_exit_pct: float = 1.0
    reduction_window_seconds: float = 300.0

    # Portfolio safety (NEW)
    daily_loss_stop_pct: float = 2.0      # halt for the day if realized PnL <= -2%
    cooldown_after_loss_min: float = 30.0 # pause new entries N min after each losing trade

    # Live-only
    hyperliquid_wallet: str = ""
    hyperliquid_private_key: str = ""

    logfile: str = "whale_bot.log"
