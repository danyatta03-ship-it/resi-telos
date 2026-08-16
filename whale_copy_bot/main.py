"""Whale copy bot entrypoint.

Modes:
    feed-check : verify HL public feed
    paper      : simulated PnL on MockFeed
    backtest   : replay recorded CSV
    live       : send real orders (Bybit or Hyperliquid)

Env vars:
    BYBIT_API_KEY, BYBIT_API_SECRET, BYBIT_TESTNET=1
    HL_WALLET, HL_PRIVATE_KEY
"""
from __future__ import annotations

import argparse
import logging
import os
import time

from config import Config
from executor import BybitExecutor, HyperliquidExecutor, PaperExecutor
from feed import Feed, HyperliquidWhaleFeed, MockFeed
from strategy import WhaleStrategy


def build_feed(cfg: Config, use_mock: bool) -> Feed:
    if use_mock:
        return MockFeed(symbol=cfg.symbol)
    return HyperliquidWhaleFeed(cfg.symbol, cfg.min_position_usd, cfg.watchlist_path)


def build_executor(cfg: Config):
    if cfg.mode != "live":
        return PaperExecutor()
    if cfg.exchange == "bybit":
        if not (cfg.bybit_api_key and cfg.bybit_api_secret):
            raise SystemExit("Set BYBIT_API_KEY and BYBIT_API_SECRET for live mode.")
        return BybitExecutor(cfg.bybit_api_key, cfg.bybit_api_secret,
                             testnet=cfg.bybit_testnet, quote=cfg.bybit_quote)
    if cfg.exchange == "hyperliquid":
        if not (cfg.hyperliquid_wallet and cfg.hyperliquid_private_key):
            raise SystemExit("Set HL_WALLET and HL_PRIVATE_KEY for live mode.")
        return HyperliquidExecutor(cfg.hyperliquid_wallet, cfg.hyperliquid_private_key)
    raise SystemExit(f"Unknown exchange: {cfg.exchange}")


def run_feed_check(cfg: Config) -> None:
    feed = build_feed(cfg, use_mock=False)
    log = logging.getLogger("feed-check")
    for i in range(10):
        whales = feed.poll()
        log.info("tick %d: %d whales >= $%.0fM",
                 i, len(whales), cfg.min_position_usd / 1e6)
        for w in whales:
            log.info("  %s %s $%.2fM entry=%.2f mark=%.2f hwm=%.2f liq=%.2f",
                     w.whale_id[:10], w.side, w.size_usd / 1e6,
                     w.entry_price, w.mark_price, w.hwm, w.liq_price)
        time.sleep(cfg.poll_seconds)


def run_loop(cfg: Config) -> None:
    feed = build_feed(cfg, use_mock=(cfg.mode == "paper"))
    executor = build_executor(cfg)
    strat = WhaleStrategy(cfg, executor)
    log = logging.getLogger(cfg.mode)
    log.info("Starting %s on %s (symbol=%s, min=$%.0fM)",
             cfg.mode, cfg.exchange, cfg.symbol, cfg.min_position_usd / 1e6)
    try:
        while True:
            for w in feed.poll():
                strat.on_whale(w)
            time.sleep(cfg.poll_seconds)
    except KeyboardInterrupt:
        log.info("Interrupted by user.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["feed-check", "paper", "backtest", "live"],
                    default="feed-check")
    ap.add_argument("--exchange", choices=["bybit", "hyperliquid"], default="bybit")
    ap.add_argument("--symbol", default="BTC")
    ap.add_argument("--min-usd", type=float, default=30_000_000)
    ap.add_argument("--watchlist", default="whale_copy_bot/watchlist.txt")
    ap.add_argument("--csv", default="whale_copy_bot/data/history.csv",
                    help="Backtest CSV path")
    args = ap.parse_args()

    cfg = Config(
        mode=args.mode,
        exchange=args.exchange,
        symbol=args.symbol,
        min_position_usd=args.min_usd,
        watchlist_path=args.watchlist,
        backtest_csv=args.csv,
        bybit_api_key=os.getenv("BYBIT_API_KEY", ""),
        bybit_api_secret=os.getenv("BYBIT_API_SECRET", ""),
        bybit_testnet=os.getenv("BYBIT_TESTNET", "").lower() in ("1", "true", "yes"),
        hyperliquid_wallet=os.getenv("HL_WALLET", ""),
        hyperliquid_private_key=os.getenv("HL_PRIVATE_KEY", ""),
    )

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
        handlers=[logging.FileHandler(cfg.logfile), logging.StreamHandler()],
    )

    if cfg.mode == "feed-check":
        run_feed_check(cfg)
    elif cfg.mode == "backtest":
        from backtest import run as run_backtest
        run_backtest(cfg)
    else:
        run_loop(cfg)


if __name__ == "__main__":
    main()
