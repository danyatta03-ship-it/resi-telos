"""Per-whale state tracker: rolling size history for quiet-fill and net-reduction checks."""
from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque

from feed import Whale


@dataclass
class WhaleTrack:
    whale_id: str
    side: str
    # (ts, size_usd, mark_price, hwm)
    history: Deque[tuple[float, float, float, float]] = field(default_factory=lambda: deque(maxlen=2000))
    peak_size_usd: float = 0.0

    def update(self, w: Whale) -> None:
        # Update whale's own HWM (best price for their side).
        best = w.hwm
        if w.side == "LONG":
            best = max(best, w.mark_price)
        else:
            best = min(best, w.mark_price)
        self.history.append((w.ts, w.size_usd, w.mark_price, best))
        self.peak_size_usd = max(self.peak_size_usd, w.size_usd)

    def latest(self) -> tuple[float, float, float, float] | None:
        return self.history[-1] if self.history else None

    def size_change_pct(self, window_seconds: float) -> float | None:
        """Absolute % change in size over the trailing window (for quiet detection)."""
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
        """Net (peak-window - now) / peak-window * 100. Ignores gross churn."""
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
        """How far current mark has retraced against the whale from their HWM (%)."""
        latest = self.latest()
        if not latest:
            return None
        _, _, mark, hwm = latest
        if hwm == 0:
            return None
        if self.side == "LONG":
            # adverse = price down from HWM
            return max(0.0, (hwm - mark) / hwm * 100.0)
        else:
            # SHORT adverse for whale = price UP from their HWM (low)
            return max(0.0, (mark - hwm) / hwm * 100.0)
