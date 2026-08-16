# Whale Copy Bot

Copy the **side**, never copy the **timing**. Enter LATE (after whale finishes filling and price retraces against them), exit EARLY (net 1% reduction in whale size → EMERGENCY EXIT).

## Files
- `config.py` — all thresholds in one place
- `feed.py` — `MoonDevFeed` (live) and `MockFeed` (offline sim of a $135M short)
- `state.py` — per-whale rolling history: HWM, quiet-fill detection, net-reduction (ignores gross churn)
- `strategy.py` — HUNT → ARM → RIDE → EXIT state machine
- `executor.py` — `PaperExecutor` and `HyperliquidExecutor`
- `main.py` — entrypoint

## Run
```bash
pip install requests hyperliquid-python-sdk eth-account

# 1. Feed sanity check
python main.py --mode feed-check

# 2. Paper (mock feed, in-memory PnL)
python main.py --mode paper

# 3. Live — only after logs look clean
export MOONDEV_API_KEY=...
export HL_WALLET=0x...
export HL_PRIVATE_KEY=...
python main.py --mode live --min-usd 30000000
```

## Guardrails baked in
- Only whales ≥ `min_position_usd` ($30M default)
- Must be quiet for `fill_quiet_seconds` (whale stopped filling)
- Must have retraced ≥ `retrace_pct_from_hwm` against the whale
- Net reduction, not gross: 5.87% gross churn in 10 min with flat net size = no exit
- Position sizing by risk-per-trade% and stop distance; leverage cap
- TP / SL / liq-proximity / max-hold safety nets

## Notes
- Moon Dev endpoint URL is a placeholder — set the real one in `config.py`
- Never commit secrets. `HL_PRIVATE_KEY` from env only
- Test flow: `feed-check` first, then `paper` for at least a full session, `live` only after
