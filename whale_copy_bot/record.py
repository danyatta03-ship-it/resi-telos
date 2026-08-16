"""Record live HL whale snapshots to CSV for later backtesting.

Usage:
    python record.py --minutes 240 --out data/history.csv
"""
from __future__ import annotations

import argparse
import csv
import time
from pathlib import Path

from config import Config
from feed import HyperliquidWhaleFeed


COLS = ["ts", "whale_id", "symbol", "side", "size_usd",
        "entry_price", "mark_price", "liq_price"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=60)
    ap.add_argument("--symbol", default="BTC")
    ap.add_argument("--min-usd", type=float, default=30_000_000)
    ap.add_argument("--watchlist", default="whale_copy_bot/watchlist.txt")
    ap.add_argument("--poll", type=float, default=3.0)
    ap.add_argument("--out", default="whale_copy_bot/data/history.csv")
    args = ap.parse_args()

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    feed = HyperliquidWhaleFeed(args.symbol, args.min_usd, args.watchlist)
    end = time.time() + args.minutes * 60

    with open(args.out, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLS)
        writer.writeheader()
        rows = 0
        while time.time() < end:
            for w in feed.poll():
                writer.writerow({
                    "ts": w.ts, "whale_id": w.whale_id, "symbol": w.symbol,
                    "side": w.side, "size_usd": w.size_usd,
                    "entry_price": w.entry_price, "mark_price": w.mark_price,
                    "liq_price": w.liq_price,
                })
                rows += 1
            f.flush()
            time.sleep(args.poll)
    print(f"Recorded {rows} snapshots to {args.out}")


if __name__ == "__main__":
    main()
