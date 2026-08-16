"""Refresh watchlist.txt with wallet addresses that currently hold a
large position on Hyperliquid, using PUBLIC data sources.

Discovery pipeline (each source is tried; anything that works is used):
  1. Hypurrscan public API — /positions/{symbol} returns holders sorted by size.
  2. Hyperliquid /info leaderboard endpoint (with timeWindow param).
  3. Manual seed file (whale_copy_bot/seed_addresses.txt) if present.

For every discovered address we then query HL /info clearinghouseState to
verify the position on `--symbol` is >= `--min-usd`. Only qualifying
addresses land in watchlist.txt.

Usage:
    python scripts/refresh_watchlist.py --symbol BTC --min-usd 30000000
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import requests


HL_INFO = "https://api.hyperliquid.xyz/info"
HYPURRSCAN_POSITIONS = "https://api.hypurrscan.io/positions/{symbol}"


def from_hypurrscan(symbol: str, limit: int = 100) -> list[str]:
    try:
        r = requests.get(HYPURRSCAN_POSITIONS.format(symbol=symbol), timeout=10)
        r.raise_for_status()
        data = r.json()
        # Response is a list of {user, coin, szi, ...}; take unique addresses.
        seen: list[str] = []
        for row in data[:limit]:
            addr = row.get("user") or row.get("address")
            if addr and addr not in seen:
                seen.append(addr)
        return seen
    except Exception as e:
        print(f"[hypurrscan] skip: {e}", file=sys.stderr)
        return []


def from_hl_leaderboard(top: int) -> list[str]:
    for payload in (
        {"type": "leaderboard", "timeWindow": "allTime"},
        {"type": "leaderboard", "window": "allTime"},
        {"type": "leaderboard"},
    ):
        try:
            r = requests.post(HL_INFO, json=payload, timeout=10)
            if r.status_code != 200:
                continue
            rows = r.json().get("leaderboardRows", [])
            rows = sorted(rows, key=lambda x: float(x.get("accountValue", 0)), reverse=True)
            return [row["ethAddress"] for row in rows[:top]]
        except Exception:
            continue
    print("[hl-leaderboard] skip: no payload worked (endpoint changed?)", file=sys.stderr)
    return []


def from_seed(path: str) -> list[str]:
    p = Path(path)
    if not p.exists():
        return []
    return [ln.strip() for ln in p.read_text().splitlines()
            if ln.strip() and not ln.startswith("#")]


def qualify(addrs: list[str], symbol: str, min_usd: float) -> list[str]:
    mids = requests.post(HL_INFO, json={"type": "allMids"}, timeout=10).json()
    mark = float(mids.get(symbol, 0))
    if mark == 0:
        print(f"[qualify] no mark price for {symbol}", file=sys.stderr)
        return []
    qualified = []
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
            notional = abs(float(pos.get("szi", 0))) * mark
            if notional >= min_usd:
                qualified.append(a)
                break
    return qualified


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--symbol", default="BTC")
    ap.add_argument("--min-usd", type=float, default=30_000_000)
    ap.add_argument("--top", type=int, default=100)
    ap.add_argument("--seed", default="whale_copy_bot/seed_addresses.txt")
    ap.add_argument("--out", default="whale_copy_bot/watchlist.txt")
    args = ap.parse_args()

    candidates: list[str] = []
    for source_name, addrs in (
        ("hypurrscan", from_hypurrscan(args.symbol, args.top)),
        ("hl-leaderboard", from_hl_leaderboard(args.top)),
        ("seed-file", from_seed(args.seed)),
    ):
        new = [a for a in addrs if a not in candidates]
        if new:
            print(f"[{source_name}] +{len(new)} candidates")
            candidates.extend(new)

    if not candidates:
        print(
            "\nNo candidates found from any source.\n"
            "Fix: create whale_copy_bot/seed_addresses.txt with wallet "
            "addresses (one per line) from any HL explorer (hyperdash.info, "
            "hypurrscan.io, stats.hyperliquid.xyz), then re-run.",
            file=sys.stderr,
        )
        sys.exit(1)

    qualified = qualify(candidates, args.symbol, args.min_usd)
    Path(args.out).write_text("\n".join(qualified) + "\n")
    print(f"\nWrote {len(qualified)} qualified addresses (>= ${args.min_usd/1e6:.0f}M "
          f"on {args.symbol}) to {args.out}")

    if not qualified:
        print(
            f"\nNote: {len(candidates)} candidates scanned but none currently "
            f"hold >= ${args.min_usd/1e6:.0f}M on {args.symbol}. Try lowering "
            "--min-usd, or wait for larger positions to open.",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
