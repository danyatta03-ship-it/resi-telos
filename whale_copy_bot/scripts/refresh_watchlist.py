"""Refresh watchlist.txt with top N Hyperliquid perp traders by open interest.

Usage: python scripts/refresh_watchlist.py --top 50 --symbol BTC --min-usd 30000000
"""
import argparse
import sys
from pathlib import Path

import requests

HL_INFO = "https://api.hyperliquid.xyz/info"


def fetch_leaderboard(top: int) -> list[str]:
    r = requests.post(HL_INFO, json={"type": "leaderboard"}, timeout=10)
    r.raise_for_status()
    rows = r.json().get("leaderboardRows", [])
    rows = sorted(rows, key=lambda x: float(x.get("accountValue", 0)), reverse=True)
    return [row["ethAddress"] for row in rows[:top]]


def filter_by_position(addrs: list[str], symbol: str, min_usd: float) -> list[str]:
    mids = requests.post(HL_INFO, json={"type": "allMids"}, timeout=10).json()
    mark = float(mids.get(symbol, 0))
    if mark == 0:
        return []
    out = []
    for a in addrs:
        try:
            st = requests.post(HL_INFO,
                               json={"type": "clearinghouseState", "user": a},
                               timeout=8).json()
        except Exception:
            continue
        for ap in st.get("assetPositions", []):
            pos = ap.get("position", {})
            if pos.get("coin") != symbol:
                continue
            if abs(float(pos.get("szi", 0))) * mark >= min_usd:
                out.append(a)
                break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=50)
    ap.add_argument("--symbol", default="BTC")
    ap.add_argument("--min-usd", type=float, default=30_000_000)
    ap.add_argument("--out", default="whale_copy_bot/watchlist.txt")
    args = ap.parse_args()

    top_addrs = fetch_leaderboard(args.top)
    if not top_addrs:
        print("Leaderboard empty — API shape may have changed.", file=sys.stderr)
        sys.exit(1)
    qualified = filter_by_position(top_addrs, args.symbol, args.min_usd)
    Path(args.out).write_text("\n".join(qualified) + "\n")
    print(f"Wrote {len(qualified)} addresses to {args.out}")


if __name__ == "__main__":
    main()
