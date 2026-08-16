"""Per-whale state tracker and market-level ATR estimator."""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Deque

from feed import Whale


@dataclass
class WhaleTrack:
    whale_id: str
    side: str
    history: Deque[tuple[float, float, float, float]] = field(
        default_factory=lambda: deque(maxlen=2000)
    )  # (ts, size_usd, mark, hwm)
    peak_size_usd: float = 0.0
    arm_streak: int = 0  # consecutive polls with ARM conditions satisfied

    def update(self, w: Whale) -> None:
        best = w.hwm
        if w.side == "LONG":
            best = max(best, w.mark_price)
        else:
            best = min(best, w.mark_price)
        self.history.append((w.ts, w.size_usd, w.mark_price, best))
        self.peak_size_usd = max(self.peak_size_usd, w.size_usd)

    def latest(self):
        return self.history[-1] if self.history else None

    def size_change_pct(self, window_seconds: float) -> float | None:
        if not self.history:
            return None
        now = self.history[-1][0]
        cutoff = now - window_seconds
        base = None
        for ts, sz, _, _ in self.history:
            if ts >= cutoff:
                base = sz
                break
        if base is None or base == 0:
            return None
        return abs(self.history[-1][1] - base) / base * 100.0

    def net_reduction_pct(self, window_seconds: float) -> float:
        if not self.history:
            return 0.0
        now_ts, now_sz, _, _ = self.history[-1]
        cutoff = now_ts - window_seconds
        window_peak = 0.0
        for ts, sz, _, _ in self.history:
            if ts >= cutoff:
                window_peak = max(window_peak, sz)
        if window_peak == 0:
            return 0.0
        return max(0.0, (window_peak - now_sz) / window_peak * 100.0)

    def retrace_from_hwm_pct(self) -> float | None:
        latest = self.latest()
        if not latest:
            return None
        _, _, mark, hwm = latest
        if hwm == 0:
            return None
        if self.side == "LONG":
            return max(0.0, (hwm - mark) / hwm * 100.0)
        return max(0.0, (mark - hwm) / hwm * 100.0)


class AtrEstimator:
    """Rolling ATR% estimate from mark-price polls (simple, no need for OHLC)."""

    def __init__(self, window: int = 60):
        self.prices: Deque[float] = deque(maxlen=window)

    def update(self, price: float) -> None:
        self.prices.append(price)

    def atr_pct(self) -> float | None:
        if len(self.prices) < 10:
            return None
        diffs = [abs(self.prices[i] - self.prices[i - 1])
                 for i in range(1, len(self.prices))]
        avg_diff = sum(diffs) / len(diffs)
        return avg_diff / self.prices[-1] * 100.0
