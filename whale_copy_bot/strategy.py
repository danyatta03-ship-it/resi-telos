"""HUNT -> ARM -> RIDE -> EXIT state machine per whale.

Rules (from the video thesis):
- Copy the SIDE, never copy the timing.
- Enter LATE: only after whale stops filling and price retraces against them.
- Exit EARLY: net (not gross) 1% reduction in whale size => EMERGENCY EXIT.
- Also exit on TP, SL, liquidation proximity, or max hold time.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from enum import Enum, auto

from config import Config
from executor import Executor, Position
from feed import Whale
from state import WhaleTrack


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

    def _track(self, w: Whale) -> WhaleTrack:
        t = self.tracks.get(w.whale_id)
        if t is None:
            t = WhaleTrack(whale_id=w.whale_id, side=w.side)
            self.tracks[w.whale_id] = t
        return t

    def _size_usd_for_entry(self, price: float, stop_price: float) -> float:
        risk_usd = self.cfg.account_equity_usd * self.cfg.risk_per_trade_pct / 100.0
        stop_dist_pct = abs(price - stop_price) / price
        if stop_dist_pct <= 0:
            return 0.0
        notional = risk_usd / stop_dist_pct
        return min(notional, self.cfg.account_equity_usd * self.cfg.leverage_cap)

    def on_whale(self, w: Whale) -> None:
        cfg = self.cfg
        track = self._track(w)
        track.update(w)
        trade = self.trades.setdefault(w.whale_id, Trade(whale_id=w.whale_id))

        if trade.phase is Phase.DONE:
            return

        # ---- EMERGENCY EXIT check runs in every phase where we're in a position ----
        if trade.phase is Phase.RIDE and trade.position:
            net_red = track.net_reduction_pct(cfg.reduction_window_seconds)
            if net_red >= cfg.net_reduction_exit_pct:
                self._exit(trade, w.mark_price, f"EMERGENCY: whale net-reduced {net_red:.2f}%")
                return
            self._check_managed_exits(trade, w)
            if trade.phase is Phase.DONE:
                return

        # ---- HUNT: qualify whale ----
        if trade.phase is Phase.HUNT:
            if w.size_usd < cfg.min_position_usd:
                return
            log.info("HUNT: whale=%s %s size=$%.1fM qualified", w.whale_id, w.side, w.size_usd / 1e6)
            trade.phase = Phase.ARM
            return

        # ---- ARM: wait for quiet fill + retracement ----
        if trade.phase is Phase.ARM:
            quiet = track.size_change_pct(cfg.fill_quiet_seconds)
            if quiet is None or quiet > cfg.fill_quiet_delta_pct:
                return  # still filling
            retrace = track.retrace_from_hwm_pct()
            if retrace is None or retrace < cfg.retrace_pct_from_hwm:
                return  # not enough snap-back yet
            self._enter(trade, w)
            return

    def _enter(self, trade: Trade, w: Whale) -> None:
        cfg = self.cfg
        # Stop = adverse move of stop_loss_pct from entry.
        if w.side == "LONG":
            stop = w.mark_price * (1 - cfg.stop_loss_pct / 100.0)
        else:
            stop = w.mark_price * (1 + cfg.stop_loss_pct / 100.0)
        size_usd = self._size_usd_for_entry(w.mark_price, stop)
        if size_usd <= 0:
            log.warning("ARM->RIDE aborted: zero size for whale %s", w.whale_id)
            trade.phase = Phase.DONE
            return
        pos = self.executor.open(w.symbol, w.side, size_usd, w.mark_price)
        trade.position = pos
        trade.entry_price = w.mark_price
        trade.opened_at = time.time()
        trade.whale_liq = w.liq_price
        trade.phase = Phase.RIDE
        log.info("RIDE: entered %s $%.0f @ %.2f (stop %.2f, retrace triggered)",
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
        # liquidation proximity: if price is within buffer of whale liq, get out.
        if trade.whale_liq > 0:
            dist_pct = abs(px - trade.whale_liq) / trade.whale_liq * 100.0
            if dist_pct <= cfg.liq_buffer_pct:
                self._exit(trade, px, f"LIQ proximity {dist_pct:.2f}%")
                return
        if time.time() - trade.opened_at >= cfg.max_hold_seconds:
            self._exit(trade, px, "MAX_HOLD")

    def _exit(self, trade: Trade, price: float, reason: str) -> None:
        assert trade.position
        self.executor.close(trade.position, price, reason)
        trade.phase = Phase.DONE
        trade.position = None
