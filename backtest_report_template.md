# Terminal Edge — Trading Bot Backtest Report Template

---

## Report Metadata

| Field              | Value                          |
|--------------------|--------------------------------|
| **Backtest ID**    | `{{backtest_id}}`              |
| **Bot Name**       | `{{bot_name}}`                 |
| **Strategy**       | `{{strategy_name}}`            |
| **Exchange**       | `{{exchange}}`                 |
| **Symbol**         | `{{symbol}}`                   |
| **Timeframe**      | `{{timeframe}}`                |
| **Period**         | `{{start_date}}` → `{{end_date}}` |
| **Initial Capital**| $`{{initial_capital}}`         |
| **Generated At**   | `{{report_timestamp}}`         |

---

## Performance Summary

| Metric                  | Value              |
|-------------------------|--------------------|
| **Total PnL (USD)**     | $`{{total_pnl}}`   |
| **Total PnL (%)**       | `{{total_pnl_pct}}`% |
| **Sharpe Ratio**        | `{{sharpe_ratio}}`  |
| **Sortino Ratio**       | `{{sortino_ratio}}` |
| **Max Drawdown (%)**    | `{{max_drawdown_pct}}`% |
| **Max Drawdown (USD)**  | $`{{max_drawdown_usd}}` |
| **Win Rate**            | `{{win_rate}}`%     |
| **Profit Factor**       | `{{profit_factor}}` |
| **Total Trades**        | `{{total_trades}}`  |
| **Avg Trade Duration**  | `{{avg_trade_duration}}` |
| **Avg Win (USD)**       | $`{{avg_win}}`      |
| **Avg Loss (USD)**      | $`{{avg_loss}}`     |
| **Largest Win (USD)**   | $`{{largest_win}}`  |
| **Largest Loss (USD)**  | $`{{largest_loss}}` |
| **Total Fees (USD)**    | $`{{total_fees}}`   |

---

## Monthly Breakdown

| Month     | Trades | PnL (USD) | PnL (%) | Win Rate | Max DD (%) |
|-----------|--------|-----------|---------|----------|------------|
| 2025-01   |        |           |         |          |            |
| 2025-02   |        |           |         |          |            |
| 2025-03   |        |           |         |          |            |
| 2025-04   |        |           |         |          |            |
| 2025-05   |        |           |         |          |            |
| 2025-06   |        |           |         |          |            |
| 2025-07   |        |           |         |          |            |
| 2025-08   |        |           |         |          |            |
| 2025-09   |        |           |         |          |            |
| 2025-10   |        |           |         |          |            |
| 2025-11   |        |           |         |          |            |
| 2025-12   |        |           |         |          |            |

---

## Risk Analysis

| Metric                      | Value              |
|-----------------------------|--------------------|
| **Value at Risk (95%)**     | $`{{var_95}}`      |
| **Expected Shortfall (95%)**| $`{{es_95}}`       |
| **Max Consecutive Losses**  | `{{max_consec_losses}}` |
| **Max Consecutive Wins**    | `{{max_consec_wins}}`   |
| **Recovery Factor**         | `{{recovery_factor}}`   |
| **Calmar Ratio**            | `{{calmar_ratio}}`      |

---

## Trade Log (Sample — First 20 Trades)

| # | Timestamp           | Side | Qty      | Entry Price | Exit Price | PnL (USD) | Duration  | Signal     |
|---|---------------------|------|----------|-------------|------------|-----------|-----------|------------|
| 1 |                     |      |          |             |            |           |           |            |
| 2 |                     |      |          |             |            |           |           |            |
| 3 |                     |      |          |             |            |           |           |            |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

> Full trade log available at: `{{full_trade_log_url}}`

---

## Backtest Configuration

```json
{
  "bot_id": "{{bot_id}}",
  "strategy": "{{strategy_name}}",
  "parameters": {
    "// strategy-specific params here": ""
  },
  "risk_limits": {
    "max_position_usd": "{{max_position_usd}}",
    "daily_loss_limit_usd": "{{daily_loss_limit_usd}}",
    "max_drawdown_pct": "{{max_drawdown_pct}}"
  },
  "data_source": "{{data_source}}",
  "slippage_model": "{{slippage_model}}",
  "commission_model": "{{commission_model}}"
}
```

---

## Disclaimers

- **Past performance does not guarantee future results.**
- Backtest results use historical data and may not account for slippage, liquidity, or market impact.
- This report is generated automatically and is not financial advice.
- Live trading requires signed trading addendum and mandatory paper-trade validation period.
