"""Whale copy bot entrypoint.

Usage:
    python main.py --mode feed-check
    python main.py --mode paper
    python main.py --mode live     # requires HL creds + MoonDev key in env
"""
from __future__ import annotations

import argparse
import logging
import os
import time

from config import Config
from executor import HyperliquidExecutor, PaperExecutor
from feed import Feed, MockFeed, MoonDevFeed
from strategy import WhaleStrategy


def build_feed(cfg: Config) -> Feed:
    if cfg.mode == "live" and cfg.moon_dev_api_key:
        return MoonDevFeed(cfg.moon_dev_endpoint, cfg.moon_dev_api_key,
                           cfg.symbol, cfg.min_position_usd)
    return MockFeed(symbol=cfg.symbol)


def build_executor(cfg: Config):
    if cfg.mode == "live":
        return HyperliquidExecutor(cfg.hyperliquid_wallet, cfg.hyperliquid_private_key)
    return PaperExecutor()


def run_feed_check(cfg: Config) -> None:
    feed = build_feed(cfg)
    log = logging.getLogger("feed-check")
    for i in range(10):
        whales = feed.poll()
        log.info("tick %d: %d whales >= $%.0fM",
                 i, len(whales), cfg.min_position_usd / 1e6)
        for w in whales:
            log.info("  %s %s size=$%.2fM entry=%.2f mark=%.2f hwm=%.2f liq=%.2f",
                     w.whale_id, w.side, w.size_usd / 1e6,
                     w.entry_price, w.mark_price, w.hwm, w.liq_price)
        time.sleep(cfg.poll_seconds)


def run_loop(cfg: Config) -> None:
    feed = build_feed(cfg)
    executor = build_executor(cfg)
    strat = WhaleStrategy(cfg, executor)
    log = logging.getLogger(cfg.mode)
    log.info("Starting %s loop (symbol=%s, min=$%.0fM)",
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
    args = ap.parse_args()

    cfg = Config(
        mode=args.mode,
        symbol=args.symbol,
        min_position_usd=args.min_usd,
        hyperliquid_wallet=os.getenv("HL_WALLET", ""),
        hyperliquid_private_key=os.getenv("HL_PRIVATE_KEY", ""),
        moon_dev_api_key=os.getenv("MOONDEV_API_KEY", ""),
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
