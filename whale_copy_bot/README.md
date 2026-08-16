# Whale Copy Bot

Copy the **side**, never copy the **timing**. Enter LATE (after whale finishes filling + price retraces against them), exit EARLY (net whale-size reduction ≥ 1% → EMERGENCY EXIT).

Feed = Hyperliquid public `/info`. Execution = **Bybit** (default) or Hyperliquid.

## Files
- `config.py` — all thresholds + exchange selection
- `feed.py` — `HyperliquidWhaleFeed` (public) + `MockFeed`
- `state.py` — per-whale history, HWM, net-vs-gross reduction, ATR
- `strategy.py` — HUNT → ARM → RIDE → EXIT + guardrails
- `executor.py` — `PaperExecutor`, `BybitExecutor`, `HyperliquidExecutor`
- `record.py` — record live HL snapshots to CSV
- `backtest.py` — replay CSV through the strategy, print report
- `scripts/refresh_watchlist.py` — auto-fill watchlist from HL leaderboard
- `watchlist.txt` — one HL address per line

## Setup
```bash
pip install requests pybit hyperliquid-python-sdk eth-account
python scripts/refresh_watchlist.py --top 50 --symbol BTC --min-usd 30000000
```

## Bybit API keys
1. Bybit → API Management → Create key (Unified Trading Account, **only "Contract Trade" permission**)
2. Whitelist your IP; do NOT enable withdrawals
3. Export before running:
```bash
export BYBIT_API_KEY=...
export BYBIT_API_SECRET=...
export BYBIT_TESTNET=1     # start on testnet
```

## Workflow (in this order)
```bash
# 1. Verify feed
python main.py --mode feed-check

# 2. Record 4h of whale history for backtesting
python record.py --minutes 240 --out data/history.csv

# 3. Backtest with current config
python main.py --mode backtest --csv data/history.csv

# 4. Paper mode with MockFeed
python main.py --mode paper

# 5. Live on Bybit TESTNET first
python main.py --mode live --exchange bybit

# 6. Live for real (only after testnet log is clean)
unset BYBIT_TESTNET
python main.py --mode live --exchange bybit
```

## Guardrails
- ≥ `min_position_usd` whale size ($30M)
- Quiet-fill window before entry
- Retracement ≥ `retrace_pct_from_hwm` against whale
- `entry_confirm_ticks` — no single-tick fakeouts
- ATR% band — skip dead / chaotic tape
- Net (not gross) reduction — churn doesn't fire EMERGENCY EXIT
- `max_concurrent_trades` cap
- Cooldown after every losing trade
- Daily loss circuit-breaker
- TP / SL / liq-proximity / max-hold safety nets

## Backtest CSV schema
```
ts,whale_id,symbol,side,size_usd,entry_price,mark_price,liq_price
```
Generate with `record.py` or bring your own dump.
