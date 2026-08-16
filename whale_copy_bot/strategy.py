"""HUNT -> ARM -> RIDE -> EXIT with extra guardrails to reduce mistakes.

Extras vs baseline:
- entry_confirm_ticks: ARM conditions must persist N polls in a row
- ATR% band filter: skip dead or chaotic tape
- max_concurrent_trades cap
- Portfolio-level cooldown after a losing trade
- Daily loss circuit-breaker
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from enum import Enum, auto

from config import Config
from executor import Executor, Position
from feed import Whale
from state import AtrEstimator, WhaleTrack


log = logging.getLogger(__name__)


class Phase(Enum):
    HUNT = auto()
    ARM = auto()
    RIDE = auto()
    DONE = auto()


@dataclass
class Trade:
    whale_id: str
    phase: Phase = Phase.HUNT
    position: Position | None = None
    opened_at: float = 0.0
    entry_price: float = 0.0
    whale_liq: float = 0.0


class WhaleStrategy:
    def __init__(self, cfg: Config, executor: Executor):
        self.cfg = cfg
        self.executor = executor
        self.tracks: dict[str, WhaleTrack] = {}
        self.trades: dict[str, Trade] = {}
        self.atr = AtrEstimator()
        # portfolio guards
        self.cooldown_until: float = 0.0
        self.day_start_ts: float = time.time()
        self.day_realized_pnl: float = 0.0

    def _track(self, w: Whale) -> WhaleTrack:
        t = self.tracks.get(w.whale_id)
        if t is None:
            t = WhaleTrack(whale_id=w.whale_id, side=w.side)
            self.tracks[w.whale_id] = t
        return t

    def _size_usd_for_entry(self, price: float, stop_price: float) -> float:
        cfg = self.cfg
        risk_usd = cfg.account_equity_usd * cfg.risk_per_trade_pct / 100.0
        stop_dist_pct = abs(price - stop_price) / price
        if stop_dist_pct <= 0:
            return 0.0
        notional = risk_usd / stop_dist_pct
        return min(notional, cfg.account_equity_usd * cfg.leverage_cap)

    def _active_trades(self) -> int:
        return sum(1 for t in self.trades.values() if t.phase is Phase.RIDE)

    def _new_entries_allowed(self) -> bool:
        cfg = self.cfg
        now = time.time()
        # daily rollover
        if now - self.day_start_ts >= 24 * 3600:
            self.day_start_ts = now
            self.day_realized_pnl = 0.0
        if self.day_realized_pnl <= -cfg.account_equity_usd * cfg.daily_loss_stop_pct / 100.0:
            return False
        if now < self.cooldown_until:
            return False
        if self._active_trades() >= cfg.max_concurrent_trades:
            return False
        return True

    def on_whale(self, w: Whale) -> None:
        cfg = self.cfg
        self.atr.update(w.mark_price)
        track = self._track(w)
        track.update(w)
        trade = self.trades.setdefault(w.whale_id, Trade(whale_id=w.whale_id))

        if trade.phase is Phase.DONE:
            return

        # EMERGENCY EXIT + managed exits when in position
        if trade.phase is Phase.RIDE and trade.position:
            net_red = track.net_reduction_pct(cfg.reduction_window_seconds)
            if net_red >= cfg.net_reduction_exit_pct:
                self._exit(trade, w.mark_price, f"EMERGENCY: whale net-reduced {net_red:.2f}%")
                return
            self._check_managed_exits(trade, w)
            return

        # HUNT
        if trade.phase is Phase.HUNT:
            if w.size_usd < cfg.min_position_usd:
                return
            log.info("HUNT: %s %s $%.1fM qualified", w.whale_id, w.side, w.size_usd / 1e6)
            trade.phase = Phase.ARM
            return

        # ARM
        if trade.phase is Phase.ARM:
            if not self._new_entries_allowed():
                track.arm_streak = 0
                return
            atr = self.atr.atr_pct()
            if atr is None or atr < cfg.min_atr_pct or atr > cfg.max_atr_pct:
                track.arm_streak = 0
                return
            quiet = track.size_change_pct(cfg.fill_quiet_seconds)
            if quiet is None or quiet > cfg.fill_quiet_delta_pct:
                track.arm_streak = 0
                return
            retrace = track.retrace_from_hwm_pct()
            if retrace is None or retrace < cfg.retrace_pct_from_hwm:
                track.arm_streak = 0
                return
            track.arm_streak += 1
            if track.arm_streak < cfg.entry_confirm_ticks:
                return
            self._enter(trade, w)

    def _enter(self, trade: Trade, w: Whale) -> None:
        cfg = self.cfg
        stop = (w.mark_price * (1 - cfg.stop_loss_pct / 100.0)
                if w.side == "LONG"
                else w.mark_price * (1 + cfg.stop_loss_pct / 100.0))
        size_usd = self._size_usd_for_entry(w.mark_price, stop)
        if size_usd <= 0:
            trade.phase = Phase.DONE
            return
        pos = self.executor.open(w.symbol, w.side, size_usd, w.mark_price)
        trade.position = pos
        trade.entry_price = w.mark_price
        trade.opened_at = time.time()
        trade.whale_liq = w.liq_price
        trade.phase = Phase.RIDE
        log.info("RIDE: entered %s $%.0f @ %.2f (stop %.2f)",
                 w.side, size_usd, w.mark_price, stop)

    def _check_managed_exits(self, trade: Trade, w: Whale) -> None:
        cfg = self.cfg
        pos = trade.position
        assert pos
        px = w.mark_price
        direction = 1 if pos.side == "LONG" else -1
        pnl_pct = direction * (px - trade.entry_price) / trade.entry_price * 100.0

        if pnl_pct >= cfg.take_profit_pct:
            self._exit(trade, px, f"TP {pnl_pct:.2f}%")
            return
        if pnl_pct <= -cfg.stop_loss_pct:
            self._exit(trade, px, f"SL {pnl_pct:.2f}%")
            return
        if trade.whale_liq > 0:
            dist_pct = abs(px - trade.whale_liq) / trade.whale_liq * 100.0
            if dist_pct <= cfg.liq_buffer_pct:
                self._exit(trade, px, f"LIQ proximity {dist_pct:.2f}%")
                return
        if time.time() - trade.opened_at >= cfg.max_hold_seconds:
            self._exit(trade, px, "MAX_HOLD")

    def _exit(self, trade: Trade, price: float, reason: str) -> None:
        assert trade.position
        pnl = self.executor.close(trade.position, price, reason)
        trade.phase = Phase.DONE
        trade.position = None
        self.day_realized_pnl += pnl
        if pnl < 0:
            self.cooldown_until = time.time() + self.cfg.cooldown_after_loss_min * 60
            log.info("Cooldown until %.0f (loss $%.2f)", self.cooldown_until, pnl)
