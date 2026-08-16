"""Replay historical whale snapshots through the strategy.

Input CSV schema (one row per snapshot, sorted by ts):
    ts,whale_id,symbol,side,size_usd,entry_price,mark_price,liq_price

Best-price/HWM is computed on the fly. Use `record.py` to build a CSV by
polling the live HL feed for hours/days, or provide your own historical dump.
"""
from __future__ import annotations

import argparse
import csv
import logging
import statistics
import time
from pathlib import Path

from config import Config
from executor import PaperExecutor
from feed import Whale
from strategy import WhaleStrategy


log = logging.getLogger("backtest")


def _rows(path: str):
    with open(path) as f:
        for row in csv.DictReader(f):
            yield Whale(
                whale_id=row["whale_id"],
                symbol=row["symbol"],
                side=row["side"].upper(),
                size_usd=float(row["size_usd"]),
                entry_price=float(row["entry_price"]),
                mark_price=float(row["mark_price"]),
                liq_price=float(row.get("liq_price") or 0),
                hwm=float(row.get("mark_price")),
                ts=float(row["ts"]),
            )


def _monkeypatch_time(current: list[float]):
    """Point time.time() at the CSV's timestamp so aging/cooldowns replay correctly."""
    import time as _t
    _real = _t.time
    _t.time = lambda: current[0]  # type: ignore
    return lambda: setattr(_t, "time", _real)


def run(cfg: Config) -> None:
    executor = PaperExecutor()
    strat = WhaleStrategy(cfg, executor)
    path = cfg.backtest_csv
    if not Path(path).exists():
        raise SystemExit(f"CSV not found: {path}. Build one with record.py.")

    current = [0.0]
    restore = _monkeypatch_time(current)
    try:
        n = 0
        for w in _rows(path):
            current[0] = w.ts
            strat.on_whale(w)
            n += 1
    finally:
        restore()

    _report(executor, n)


def _report(ex: PaperExecutor, snapshots: int) -> None:
    pnls = [t["pnl"] for t in ex.trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]
    total = sum(pnls)
    print(f"\n--- Backtest report ---")
    print(f"snapshots replayed : {snapshots}")
    print(f"trades             : {len(pnls)}")
    if not pnls:
        return
    print(f"win rate           : {len(wins) / len(pnls) * 100:.1f}%")
    print(f"total PnL          : ${total:,.2f}")
    print(f"avg PnL/trade      : ${statistics.mean(pnls):,.2f}")
    if len(pnls) > 1:
        print(f"stdev PnL/trade    : ${statistics.pstdev(pnls):,.2f}")
    print(f"best / worst       : ${max(pnls):,.2f} / ${min(pnls):,.2f}")
    if losses:
        pf = sum(wins) / abs(sum(losses)) if sum(losses) else float("inf")
        print(f"profit factor      : {pf:.2f}")
    exit_reasons: dict[str, int] = {}
    for t in ex.trades:
        exit_reasons[t["reason"].split()[0]] = exit_reasons.get(t["reason"].split()[0], 0) + 1
    print(f"exit reasons       : {exit_reasons}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="whale_copy_bot/data/history.csv")
    ap.add_argument("--symbol", default="BTC")
    ap.add_argument("--min-usd", type=float, default=30_000_000)
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
    cfg = Config(mode="backtest", symbol=args.symbol,
                 min_position_usd=args.min_usd, backtest_csv=args.csv)
    run(cfg)


if __name__ == "__main__":
    main()
