from dataclasses import dataclass, field
from typing import Literal


@dataclass
class Config:
    # Modes
    mode: Literal["feed-check", "paper", "live"] = "feed-check"

    # HUNT
    symbol: str = "BTC"
    min_position_usd: float = 30_000_000
    poll_seconds: float = 3.0

    # ARM
    fill_quiet_seconds: float = 60.0        # whale must stop adding for this long
    fill_quiet_delta_pct: float = 0.25      # <0.25% size change over the window = quiet
    retrace_pct_from_hwm: float = 0.40      # % adverse move from whale's best price before we enter

    # RIDE / risk
    account_equity_usd: float = 10_000.0
    risk_per_trade_pct: float = 0.5         # % of equity risked per trade
    leverage_cap: float = 5.0
    take_profit_pct: float = 1.5
    stop_loss_pct: float = 0.8
    liq_buffer_pct: float = 2.0             # exit if price within X% of whale liq
    max_hold_seconds: float = 60 * 60 * 4   # 4h max

    # EXIT — whale close detection
    net_reduction_exit_pct: float = 1.0     # net (not gross) reduction of whale size => EMERGENCY EXIT
    reduction_window_seconds: float = 300.0

    # Live-only
    hyperliquid_wallet: str = ""
    hyperliquid_private_key: str = ""       # NEVER commit
    moon_dev_api_key: str = ""
    moon_dev_endpoint: str = "https://api.moondev.example/liq-feed"

    logfile: str = "whale_bot.log"
