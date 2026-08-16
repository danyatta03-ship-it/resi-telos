"""Whale copy bot entrypoint (Hyperliquid public API, no Moon Dev needed).

Usage:
    python main.py --mode feed-check
    python main.py --mode paper
    python main.py --mode live
"""
from __future__ import annotations

import argparse
import logging
import os
import time

from config import Config
from executor import HyperliquidExecutor, PaperExecutor
from feed import Feed, HyperliquidWhaleFeed, MockFeed
from strategy import WhaleStrategy


def build_feed(cfg: Config, use_mock: bool) -> Feed:
    if use_mock:
        return MockFeed(symbol=cfg.symbol)
    return HyperliquidWhaleFeed(cfg.symbol, cfg.min_position_usd, cfg.watchlist_path)


def build_executor(cfg: Config):
    if cfg.mode == "live":
        return HyperliquidExecutor(cfg.hyperliquid_wallet, cfg.hyperliquid_private_key)
    return PaperExecutor()


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
    log.info("Starting %s (symbol=%s, min=$%.0fM)",
             cfg.mode, cfg.symbol, cfg.min_position_usd / 1e6)
    try:
        while True:
            for w in feed.poll():
                strat.on_whale(w)
            time.sleep(cfg.poll_seconds)
    except KeyboardInterrupt:
        log.info("Interrupted by user.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["feed-check", "paper", "live"], default="feed-check")
    ap.add_argument("--symbol", default="BTC")
    ap.add_argument("--min-usd", type=float, default=30_000_000)
    ap.add_argument("--watchlist", default="whale_copy_bot/watchlist.txt")
    args = ap.parse_args()

    cfg = Config(
        mode=args.mode,
        symbol=args.symbol,
        min_position_usd=args.min_usd,
        watchlist_path=args.watchlist,
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
    else:
        run_loop(cfg)


if __name__ == "__main__":
    main()
