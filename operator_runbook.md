# Terminal Edge — Operator Runbook
## Incident: Abnormal Trading Losses

**Severity:** P1 — Critical
**SLA:** Acknowledge within 5 minutes, mitigate within 15 minutes.

---

## 1. Detection

This incident is triggered when any of the following alerts fire:

| Alert Name                        | Threshold                              | Source         |
|-----------------------------------|----------------------------------------|----------------|
| `trading.daily_loss_limit_breached` | Bot PnL exceeds daily loss limit       | Risk Manager   |
| `trading.drawdown_circuit_breaker`  | Portfolio drawdown > configured max %  | Risk Manager   |
| `trading.anomalous_volume`          | Trade volume 5x above rolling average  | Usage Monitor  |
| `billing.trade_cap_exceeded`        | Tenant trade volume cap exceeded       | Billing Engine |

---

## 2. Immediate Actions (First 5 Minutes)

### Step 1: Activate Kill-Switch

```bash
# Via CLI
curl -X POST https://api.terminaledge.io/api/v1/bots/{BOT_ID}/kill-switch \
  -H "Authorization: Bearer {{ADMIN_TOKEN}}" \
  -H "Content-Type: application/json"

# Via Admin Panel
# Navigate to: Admin → Bots → [Bot Name] → Kill Switch → Confirm
```

**Expected result:** All open orders cancelled, bot container terminated, state snapshot saved.

### Step 2: Verify Kill-Switch Engaged

```bash
# Check bot status
curl https://api.terminaledge.io/api/v1/bots/{BOT_ID} \
  -H "Authorization: Bearer {{ADMIN_TOKEN}}"

# Expected: "status": "killed", "kill_switch": true
```

### Step 3: Freeze Tenant Trading (if multiple bots affected)

```bash
# Suspend all trading bots for tenant
curl -X POST https://api.terminaledge.io/api/v1/admin/tenants/{TENANT_ID}/suspend-trading \
  -H "Authorization: Bearer {{ADMIN_TOKEN}}"
```

---

## 3. Notification (Within 5 Minutes)

| Who                    | Channel           | Message Template                                                |
|------------------------|-------------------|-----------------------------------------------------------------|
| On-call SRE            | PagerDuty         | Auto-triggered by alert                                         |
| Engineering Lead       | Slack #incidents   | "P1: Abnormal trading loss detected. Bot {BOT_ID}, Tenant {TENANT_ID}. Kill-switch engaged." |
| Tenant Account Owner   | Email + In-app    | "Trading activity on your bot {BOT_NAME} has been paused due to unusual losses. Our team is investigating." |
| Compliance Officer     | Email              | "Trading incident logged. Audit trail preserved. Review required." |

---

## 4. State Snapshot (Within 10 Minutes)

### Capture current state before any cleanup:

```bash
# Export bot state
curl https://api.terminaledge.io/api/v1/bots/{BOT_ID}/runs/{LAST_RUN_ID} \
  -H "Authorization: Bearer {{ADMIN_TOKEN}}" > bot_state_snapshot.json

# Export trade ledger
psql $DATABASE_URL -c "
  COPY (
    SELECT * FROM trade_orders
    WHERE bot_id = '{BOT_ID}'
    AND created_at >= now() - interval '24 hours'
    ORDER BY created_at
  ) TO STDOUT WITH CSV HEADER
" > trade_ledger_snapshot.csv

# Export audit logs
psql $DATABASE_URL -c "
  COPY (
    SELECT * FROM audit_logs
    WHERE resource_id = '{BOT_ID}'::uuid
    AND created_at >= now() - interval '24 hours'
    ORDER BY created_at
  ) TO STDOUT WITH CSV HEADER
" > audit_snapshot.csv
```

### Preserve container logs:

```bash
# If container still exists
docker logs {CONTAINER_ID} > container_logs.txt 2>&1

# From log aggregator
# Grafana Loki: query {app="bot-runner", bot_id="{BOT_ID}"} | last 24h
```

### Upload snapshots:

```bash
aws s3 cp bot_state_snapshot.json s3://terminal-edge-incidents/{INCIDENT_ID}/
aws s3 cp trade_ledger_snapshot.csv s3://terminal-edge-incidents/{INCIDENT_ID}/
aws s3 cp audit_snapshot.csv s3://terminal-edge-incidents/{INCIDENT_ID}/
aws s3 cp container_logs.txt s3://terminal-edge-incidents/{INCIDENT_ID}/
```

---

## 5. Root Cause Investigation

### Check these in order:

1. **Risk Manager Bypass?**
   - Query: Did any trades execute without `risk_check_passed = TRUE`?
   ```sql
   SELECT * FROM trade_orders
   WHERE bot_id = '{BOT_ID}' AND risk_check_passed = FALSE
   AND created_at >= now() - interval '24 hours';
   ```

2. **Exchange API Errors?**
   - Check for rejected orders, partial fills, or timeout errors in bot_runs output.

3. **Strategy Bug?**
   - Review the bot config version deployed vs. tested version.
   - Check for recent config changes in audit_logs.

4. **Market Conditions?**
   - Was there a flash crash or extreme volatility event?
   - Cross-reference with exchange historical data.

5. **Sandbox Compromise?**
   - Check container syscall logs for unusual activity.
   - Verify the sandbox image hash matches the approved version.

---

## 6. Recovery Checklist

| Step | Action | Owner | Done? |
|------|--------|-------|-------|
| 1 | Kill-switch confirmed active | SRE | ☐ |
| 2 | All open orders verified cancelled on exchange | SRE | ☐ |
| 3 | State snapshot uploaded to S3 | SRE | ☐ |
| 4 | Tenant notified | Support | ☐ |
| 5 | Compliance officer notified | SRE | ☐ |
| 6 | Root cause identified | Engineering | ☐ |
| 7 | Fix deployed (if bug) | Engineering | ☐ |
| 8 | Post-incident review scheduled | Engineering Lead | ☐ |
| 9 | Tenant trading re-enabled (after review) | Admin | ☐ |
| 10 | Incident report filed | SRE | ☐ |

---

## 7. Post-Incident

- File incident report within 24 hours.
- Schedule post-mortem within 48 hours.
- Update risk manager thresholds if needed.
- Add regression test for the failure mode.
- Update this runbook if new steps are identified.

---

## Key Contacts

| Role                | Name / Alias             | Channel          |
|---------------------|--------------------------|------------------|
| On-call SRE         | `@sre-oncall`            | PagerDuty        |
| Engineering Lead    | `{{ENG_LEAD}}`           | Slack #incidents |
| Compliance Officer  | `{{COMPLIANCE_OFFICER}}` | Email            |
| Legal Counsel       | `{{LEGAL_COUNSEL}}`      | Email            |
| Exchange Liaison    | `{{EXCHANGE_CONTACT}}`   | Direct           |

---

> **IMPORTANT:** Never delete trade_orders or audit_logs rows. These are WORM-protected. Any state changes during incident response must be logged to audit_logs.
