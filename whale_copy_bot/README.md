# Whale Copy Bot (Hyperliquid, no paid API)

Copy the **side**, never copy the **timing**. Enter LATE (whale has stopped filling and price has retraced against them), exit EARLY (net whale-size reduction ≥ 1% → EMERGENCY EXIT).

Feed = Hyperliquid public `/info` endpoint. No Moon Dev, no keys.

## Files
- `config.py` — thresholds
- `feed.py` — `HyperliquidWhaleFeed` (public) + `MockFeed` (offline)
- `state.py` — per-whale history, HWM, net-vs-gross reduction, ATR estimator
- `strategy.py` — HUNT → ARM → RIDE → EXIT + guardrails
- `executor.py` — Paper + Hyperliquid live
- `scripts/refresh_watchlist.py` — auto-fills `watchlist.txt` from HL leaderboard
- `watchlist.txt` — one HL address per line

## Setup
```bash
pip install requests hyperliquid-python-sdk eth-account
python scripts/refresh_watchlist.py --top 50 --symbol BTC --min-usd 30000000
```

## Run
```bash
python main.py --mode feed-check       # verify feed
python main.py --mode paper            # simulated PnL on MockFeed
export HL_WALLET=0x...; export HL_PRIVATE_KEY=...
python main.py --mode live --min-usd 30000000
```

## Guardrails baked in
- ≥ `min_position_usd` whale size ($30M)
- Whale must be quiet for `fill_quiet_seconds`
- Price must retrace ≥ `retrace_pct_from_hwm` against them
- **`entry_confirm_ticks`**: conditions must hold N polls in a row (no single-tick fakeouts)
- **ATR% band**: skip dead or chaotic tape
- **Net (not gross) reduction**: whale re-shorting 5%+ in churn with flat net size ≠ exit
- **`max_concurrent_trades`**: cap simultaneous exposure
- **Cooldown** after every losing trade
- **Daily loss circuit-breaker** halts new entries
- TP / SL / liq-proximity / max-hold safety nets

## Discipline
Run in this order: `feed-check` for at least an hour → `paper` for a full week → `live` only after the paper log is clean. Then re-tune one parameter at a time.
