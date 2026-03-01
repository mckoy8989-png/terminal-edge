# Terminal Edge — Complete Product Specification

> **Version:** 2.0 | **Date:** 2026-03-01 | **Status:** Draft
> **Classification:** Internal / Confidential
> **Business Model:** Solo operator service storefront (quote-first + fixed-price packages)

---

## 1. Product Summary & Personas

### Executive Summary

Terminal Edge is a professional services storefront where customers browse, order, and receive delivery of four service categories: **(A)** custom website development, **(B)** AI workflow & agent building, **(C)** bots (trading, scraping, monitoring, automation), and **(D)** custom applications. The site operates as a one-person agency — customers land on a Webflow-inspired storefront, browse service packages (some fixed-price, some requiring a custom quote), place orders or submit quote requests, and the operator (Dawayne) builds and delivers the work. The backend includes a full order management system, quote/invoice workflow, Stripe payment processing, a client portal for order tracking, and an admin dashboard for the operator. Behind the scenes, the platform retains enterprise-grade infrastructure for the actual service delivery: sandboxed bot execution, AI workflow engines, trading bot risk management, and security guardrails.

### Personas

#### Persona 1: Sam — Nontechnical SMB Owner
- **Role:** Owner of a 15-person e-commerce business
- **Goals:** Hire someone to build a website and set up automated workflows — without needing to understand the tech
- **Success Metrics:** Website delivered on time and on budget; working automation within 2 weeks of delivery; clear communication throughout
- **Pain Points:** Doesn't know where to start; burned by freelancers before; wants a single provider for website + automation

#### Persona 2: Maya — Agency / Marketing Manager
- **Role:** Marketing manager at a mid-size company
- **Goals:** Commission a scraping bot to monitor competitor pricing; order a custom dashboard app for her team
- **Success Metrics:** Bot running reliably within 1 week; data accuracy > 95%; responsive support from the operator
- **Pain Points:** Internal dev team is too busy; needs someone who understands both the tech and the business use case

#### Persona 3: Dev — Technical Founder / Dev Lead
- **Role:** CTO of a crypto trading startup
- **Goals:** Commission a custom trading bot with backtesting, risk controls, and paper-trade validation before going live
- **Success Metrics:** Bot Sharpe ratio > 1.5; full audit trail; kill-switch functionality; delivered with documentation
- **Pain Points:** Doesn't trust generic marketplace bots; needs custom work with proper risk guardrails and ongoing support

---

## 2. Complete MVP Specification

### Feature Prioritization (MoSCoW)

#### Must Have (MVP)
- Public storefront: service catalog with categories (Websites, AI Workflows, Bots, Custom Apps)
- Service detail pages with descriptions, pricing (fixed or "request quote"), portfolio samples
- Customer registration / login (email + password)
- Order placement: fixed-price checkout via Stripe; quote-request form for custom work
- Quote workflow: operator creates quote → customer reviews → accepts & pays → order begins
- Client portal: order status tracking (pending, in progress, review, delivered, complete)
- Messaging system: per-order thread between customer and operator
- Stripe payments: checkout for fixed-price; invoice for quotes; refunds
- Admin dashboard: incoming orders, quote requests, order management, revenue overview
- Operator delivery: upload deliverables (files, links, credentials) per order
- Email notifications: order confirmation, quote sent, status updates, delivery ready
- Responsive design (mobile-first, Webflow-inspired aesthetic)

#### Should Have (v1.1)
- Customer reviews & ratings (post-delivery)
- Portfolio / case study pages
- Service add-ons and upsells at checkout
- Recurring service subscriptions (e.g., monthly bot monitoring)
- Client portal: revision requests with tracked rounds
- Analytics dashboard for operator (revenue, conversion, popular services)
- SEO optimization (meta tags, sitemap, structured data)

#### Could Have (v1.2+)
- Referral / affiliate program
- Blog / content marketing section
- Multi-currency support
- White-label client portals
- Zapier/webhook integrations for order events
- Mobile companion app for operator

### Service Categories & Pricing Model

| Category            | Pricing Model                   | Examples                                                   |
|---------------------|----------------------------------|------------------------------------------------------------|
| **Website Dev**     | Fixed packages + custom quotes  | Landing Page ($500), Business Site ($2,000), E-commerce ($5,000+) |
| **AI Workflows**    | Custom quotes                   | Chatbot setup, document processor, data pipeline           |
| **Bots**            | Fixed packages + custom quotes  | Price Monitor ($300), Trading Bot ($2,000+), Scraper ($500) |
| **Custom Apps**     | Custom quotes                   | Internal tools, dashboards, mobile apps                    |

### Customer Account Model
- Customers register with email/password; no multi-tenant complexity.
- Each customer can have multiple orders (one-time or recurring).
- Order lifecycle: `quote_requested` → `quoted` → `accepted` → `paid` → `in_progress` → `in_review` → `revision` → `delivered` → `completed`
- Customer sees their orders, messages, invoices, and delivered files in the client portal.
- Operator (Dawayne) has a single admin account with full access to all orders and customers.

---

## 3. Architecture & Tech Decisions

### Architecture Diagram (Description)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PUBLIC STOREFRONT (Client-Facing)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Service     │  │  Order /     │  │  Client      │              │
│  │  Catalog     │  │  Quote Flow  │  │  Portal      │              │
│  │  (Next.js)   │  │  + Checkout  │  │  (Dashboard) │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼──────────────────┼──────────────────┼─────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API LAYER (Backend)                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Auth     │  │ Orders & │  │ Payments │  │ Messaging│           │
│  │ Service  │  │ Quotes   │  │ (Stripe) │  │ Service  │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                           │                                         │
│                    ┌──────┴──────┐                                  │
│                    │ Admin Panel │ (Operator Dashboard)             │
│                    └──────┬──────┘                                  │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              DELIVERY INFRASTRUCTURE (Operator-Side)                 │
│  ┌─────────────┐  ┌─────────────────┐  ┌──────────────┐           │
│  │ Workflow    │  │ Bot Sandbox     │  │ n8n Runtime  │           │
│  │ DAG Runner  │  │ (Docker/seccomp)│  │ (Managed)    │           │
│  │             │  │ ┌─────────────┐ │  │              │           │
│  │             │  │ │Trading Bot  │ │  │              │           │
│  │             │  │ │Scraping Bot │ │  │              │           │
│  │             │  │ │Custom Agent │ │  │              │           │
│  │             │  │ └─────────────┘ │  │              │           │
│  └──────┬──────┘  └────────┬────────┘  └──────────────┘           │
└─────────┼──────────────────┼────────────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Postgres │  │ Redis    │  │ Qdrant   │  │ S3/GCS   │           │
│  │          │  │ (Cache/  │  │ (Vector  │  │ (File    │           │
│  │          │  │  Queue)  │  │  Search) │  │  Storage)│           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LLM PROVIDERS                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                         │
│  │ OpenAI   │  │ Anthropic│  │ Local    │                         │
│  │ Adapter  │  │ Adapter  │  │ (Ollama) │                         │
│  └──────────┘  └──────────┘  └──────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Architecture Notes
- **Storefront** is the public-facing Next.js app — service catalog, order flow, client portal.
- **API Layer** handles auth, orders, quotes, payments, messaging, and the admin panel.
- **Delivery Infrastructure** is operator-side tooling used to fulfill orders (bot runners, workflow engines, n8n). Customers never interact with this directly.
- **Admin Panel** is Dawayne's control center for managing orders, sending quotes, uploading deliverables, and monitoring bots.

### Sandbox Model (User Code & Bots)
- **Runtime:** Short-lived Docker containers (or Firecracker microVMs for enterprise).
- **Security:** seccomp profiles (whitelist safe syscalls), read-only rootfs, no Docker socket mount.
- **Resources:** cgroups enforce CPU (0.5 core default), memory (512Mi), PID limit (64), timeout (300s).
- **Network:** Egress proxy (Squid/Envoy) with domain allowlist; block access to internal network, metadata APIs.
- **Cleanup:** Containers destroyed after execution; ephemeral storage only.

### Hybrid LLM Support
- **Cloud Adapters:** OpenAI, Anthropic — unified interface via adapter pattern.
- **Local Runner:** Ollama integration for self-hosted quantized models (Llama, Mistral).
- **Usage Accounting:** Every LLM call logged to `usage_records` with token count, model, latency.
- **Routing:** Tenant config determines cloud vs. local; fallback chain on timeout/error.
- **Cost Controls:** Per-tenant token budgets; auto-switch to cheaper model at 80% quota.

---

## 4. Core Modules & APIs

> See `api_spec.md` for full REST endpoint details, request/response examples, GraphQL snippets, and webhook contracts.

### Module Summary

| Module              | Responsibilities                                                          |
|---------------------|---------------------------------------------------------------------------|
| **Auth**            | Customer registration/login, admin login, JWT tokens                      |
| **Service Catalog** | Public service listings, categories, pricing, portfolio samples           |
| **Orders**          | Order placement, quote requests, status tracking, delivery management     |
| **Quotes**          | Operator creates/sends quotes, customer accepts/declines, converts to order |
| **Payments**        | Stripe checkout (fixed-price), Stripe invoicing (quotes), refunds         |
| **Messaging**       | Per-order conversation thread between customer and operator               |
| **Client Portal**   | Customer dashboard: orders, messages, invoices, delivered files            |
| **Admin Panel**     | Operator dashboard: order queue, quotes, revenue, customer management     |
| **Bot Manager**     | Operator-side: bot CRUD, lifecycle (start/stop/kill), deployment          |
| **Workflow Engine** | Operator-side: DAG runner, n8n integration, execution for client projects |
| **Observability**   | Logging, metrics, alerting (for delivered bots and operator infrastructure)|

---

## 5. Data Model

> See `schema.sql` for full CREATE TABLE statements with indexes, foreign keys, and RLS policy notes.

**Core Tables:** tenants, users, projects, templates, workflows, workflow_nodes, workflow_runs, bots, bot_runs, trade_orders, scrape_jobs, backtests, usage_records, payments, audit_logs.

---

## 6. AI Workflow & Bot Engine Design

### Node Types Supported

| Node Type          | Description                                          | Inputs              | Outputs                  |
|--------------------|------------------------------------------------------|----------------------|--------------------------|
| `llm`              | Call LLM (cloud or local) with structured output     | prompt, context      | structured JSON response |
| `code`             | Execute sandboxed JavaScript/Python code             | code, variables      | return value             |
| `webhook`          | Listen for or send HTTP webhooks                     | URL, headers, body   | response                 |
| `api`              | Make external API calls                              | URL, method, params  | response                 |
| `condition`        | Branch based on expression evaluation                | expression, data     | true/false routing       |
| `vector_retrieval` | Search vector DB for similar embeddings              | query, collection    | matched documents        |
| `trade_action`     | Place paper or live trade orders (with risk check)   | exchange, symbol, side | order result           |
| `browser_scrape`   | Scrape web page via headless browser                 | URL, selectors       | extracted content        |

### Execution Model

- **DAG Runner:** Topological sort of workflow nodes; parallel execution of independent branches.
- **Step Persistence:** Each node result persisted to `workflow_runs.node_results` JSONB on completion.
- **Retries & Backoff:** Configurable per node (default: 3 retries, exponential backoff 1s/2s/4s).
- **Circuit Breakers:** Per-node failure threshold (5 failures in 60s → circuit open for 300s).
- **Idempotency:** `idempotency_key` on workflow_runs prevents duplicate executions.

### Precision Rails

| Control                   | Implementation                                                         |
|---------------------------|------------------------------------------------------------------------|
| Structured Output         | JSON Schema defined per LLM node; response validated before passing downstream |
| Confidence Thresholds     | LLM nodes can set minimum confidence; below threshold → fallback path  |
| Dual-Run Compare          | Optional: run same prompt on 2 models; compare outputs; flag divergence |
| Deterministic Options     | `temperature=0`, `function_calling=true` enforced for critical paths   |
| Schema Violation Alerts   | Metric: `ai.schema_violation_rate`; alert at >5% in 1-hour window     |

### Productivity Rails

| Feature                 | Description                                                         |
|-------------------------|---------------------------------------------------------------------|
| Versioned Templates     | Workflows saved with version numbers; rollback to any prior version |
| Workspace Sandboxes     | Test workflows against sandbox data without affecting production    |
| One-Click Promote       | Deploy from sandbox → production with confirmation dialog           |
| Testing Harness         | In-canvas test runner: define inputs, expected outputs, run assertions |

---

## 7. Bot Classes (Full Spec)

### 7.1 Trading Bots

**CCXT Adapter Design:**
- Unified exchange interface via CCXT library (supports 100+ exchanges).
- Adapter layer normalizes market data, order types, and balance queries.
- WebSocket feed handler for real-time orderbook, trades, and ticker data.
- Connection pool with automatic reconnection and heartbeat monitoring.

**Execution Manager:**
- Order lifecycle: create → risk check → submit → monitor → fill/cancel.
- Support for market, limit, and stop orders.
- Position tracking with real-time PnL calculation.

**Risk Manager:**
- **Max Position Size:** Configurable per bot (e.g., $500 max per position).
- **Daily Loss Limit:** Absolute USD amount; kill-switch triggers on breach.
- **Max Drawdown:** Percentage-based circuit breaker (e.g., 5% from peak equity).
- **Trade Frequency Cap:** Max orders per minute to prevent runaway loops.
- **All checks logged** to `trade_orders.risk_check_details` JSONB.

**Backtest & Paper Trade:**
- Historical data loader from exchange or CSV import.
- Strategy replay engine with configurable slippage and commission models.
- Paper trade mode uses simulated fills at market price ± slippage.
- Mandatory minimum paper-trade period: 30 days before live trading enabled.

**Immutable Audit Ledger:**
- `trade_orders` table is append-only (UPDATE/DELETE revoked in production).
- Every order records: risk check result, consent status, addendum version.
- WORM storage archival for regulatory compliance.

**Kill-Switch:**
- API endpoint: `POST /bots/:id/kill-switch`
- Cancels all open orders, terminates container, snapshots state.
- Can be triggered: manually (admin/owner), automatically (risk manager), via API.

**Legal Notice & Consent Flow:**
- Users must sign trading addendum before enabling live trading.
- Addendum version tracked per trade order.
- No-withdrawal API keys enforced: platform validates exchange key permissions.
- Disclaimer: "Past performance does not guarantee future results."

### 7.2 Scraping Bots

**Scheduler:** Cron-based scheduling with timezone support; min interval 60s.
**Proxy Pool:** Rotating residential/datacenter proxies; geo-targeting; auto-rotation on 429/ban.
**Headless Pool:** Playwright browser pool (Chromium); max 5 concurrent pages per bot.
**robots.txt:** Parsed and enforced by default; admin override requires signed waiver.
**PII Detection/Redaction:** NER model + regex patterns detect emails, phones, SSNs, addresses; auto-redacted before storage.
**Dedupe/Normalizer:** Content fingerprinting (SimHash); schema normalization to JSON/CSV output.

### 7.3 Automation Agents / n8n Compatibility

- **Import:** Parse n8n workflow JSON; map n8n node types to internal node types; flag unsupported nodes.
- **Export:** Convert internal DAG to n8n-compatible JSON format.
- **Runtime Options:** (1) Run n8n flows inside Terminal Edge orchestrator natively, or (2) delegate to managed n8n runtime per tenant.
- **Sync:** Bidirectional status sync between n8n runtime and Terminal Edge dashboard.

### 7.4 Local LLM Agents

- **Dockerized Runner:** Ollama container with GPU passthrough.
- **Model Support:** Quantized models (GGUF): Llama 3, Mistral, Phi, CodeLlama.
- **Embedding Storage:** Generate embeddings locally; store in Qdrant collections (per-tenant isolation).
- **Vector Search:** Semantic search across stored embeddings; used by `vector_retrieval` workflow node.
- **Usage Accounting:** Local model calls tracked same as cloud calls for quota purposes.

### 7.5 Marketplace Packaging

| Component        | Description                                                   |
|------------------|---------------------------------------------------------------|
| Template         | Workflow/bot definition as versioned JSONB payload            |
| Runbook          | Markdown documentation: setup, configuration, expected behavior |
| Pricing          | Free or paid (price_cents); platform takes 20% commission     |
| Review & Vetting | Automated security scan + manual admin review before publish  |
| Ratings          | 1-5 star rating system; minimum 3 installs before featured    |

---

## 8. Guardrails & Compliance

### AI Guardrails

| Control                     | Implementation                                                       |
|-----------------------------|----------------------------------------------------------------------|
| **Prompt Firewall**         | Input scanning with regex + ML classifier for injection patterns     |
| **Injection Detection**     | Pattern matching for "ignore instructions", role-play attacks, encoding tricks |
| **Output Schema Enforcement** | JSON Schema validation on every LLM response; reject non-conforming |
| **Extract/Poisoning Detection** | Monitor for unusual data patterns in LLM context; flag cross-tenant references |
| **Token Rate Caps**         | Per-tenant, per-minute token limits; burst allowance with cooldown   |
| **Sampling Controls**       | Enforce `temperature=0` for critical paths; configurable per node    |

### Security (OWASP + Platform)

| Control                    | Implementation                                                |
|----------------------------|---------------------------------------------------------------|
| Input Validation           | Zod/Joi schemas on all API inputs; parameterized queries only |
| Authentication             | JWT with RS256; 15-min access tokens; 7-day refresh tokens    |
| JWT Rotation               | Refresh tokens rotated on use; old tokens invalidated         |
| CSRF Protection            | SameSite cookies + CSRF tokens for state-changing requests    |
| Rate Limiting              | Per-IP and per-tenant limits via Redis sliding window         |
| Short-Lived Credentials    | Exchange API keys encrypted at rest; decrypted in-memory only |
| Secrets Vault              | HashiCorp Vault or AWS Secrets Manager for all sensitive data |
| Network Egress Proxy       | Squid proxy for sandbox containers; domain allowlist enforced |
| Security Headers           | HSTS, X-Content-Type-Options, X-Frame-Options, CSP           |
| Dependency Scanning        | Trivy + npm audit in CI; Snyk for continuous monitoring       |

### Financial / Legal Controls

| Control                            | Implementation                                                |
|------------------------------------|---------------------------------------------------------------|
| No-Withdrawal API Keys             | Validate exchange key permissions; reject withdrawal-capable keys |
| Mandatory Paper-Trade Period       | Minimum 30 days paper trading before live trading enabled     |
| Signed Trading Addendum            | DocuSign or in-app signing; version tracked per order         |
| Automated Spend Caps               | Per-tenant monthly trade volume caps; billing hold on breach  |
| Risk Circuit Breakers              | Daily loss limit, max drawdown, trade frequency caps          |
| Billing Hold                       | Auto-suspend trading on payment failure or dispute            |

### Data Governance

| Control                | Implementation                                                |
|------------------------|---------------------------------------------------------------|
| PII Detection          | NER model + regex on scrape outputs; real-time scanning       |
| Auto-Redaction         | PII replaced with `[REDACTED]` before storage                 |
| Retention Policies     | Usage records: 90 days hot, 2 years cold. Audit logs: 7 years |
| WORM Logs              | trade_orders and audit_logs: append-only, immutable            |
| Data Encryption        | AES-256 at rest (Postgres TDE); TLS 1.3 in transit            |

---

## 9. Red-Team & Safety Testing Matrix

> See `red_team_tests.csv` for full test matrix (14 test cases across AI, trading, scraping, orchestration).

**Coverage areas:**
- AI: prompt injection, data exfiltration, output poisoning, token exhaustion
- Trading: exchange spoofing, excessive loss, withdrawal key abuse
- Scraping: trap pages, PII leakage, large-scale extraction
- Orchestration: container escape, resource bombs, JWT manipulation, workflow infinite loops

---

## 10. Stress Testing & Chaos Plan

### Load Scenarios

| Scenario                | Target                  | Acceptance Threshold        |
|-------------------------|-------------------------|-----------------------------|
| Concurrent Users        | 10,000 simultaneous     | p99 API response < 500ms   |
| Workflows/sec           | 500 workflow executions  | p99 < 2s end-to-end        |
| LLM Calls/min           | 1,000 calls             | p99 < 10s (including LLM)  |
| Trades/sec              | 100 order submissions   | p99 < 200ms to exchange    |
| Scraping Jobs/hour      | 5,000 jobs              | 95% completion rate        |
| Bot Containers Active   | 500 simultaneous        | CPU utilization < 80%      |

### Tools & Scripts

| Tool                     | Purpose                                                 |
|--------------------------|---------------------------------------------------------|
| **k6**                   | HTTP load testing for API endpoints                     |
| **Locust**               | Distributed load testing with Python scripts            |
| **Custom Market Simulator** | Simulated exchange feeds for trading bot stress tests |
| **Chaos Monkey**         | Random worker container termination                     |
| **Toxiproxy**            | Network fault injection (latency, partition, bandwidth) |

### Chaos Tests

| Test                      | Method                                          | Expected Recovery              |
|---------------------------|-------------------------------------------------|--------------------------------|
| Worker Kill               | Kill 50% of worker containers simultaneously    | Auto-scale within 30s; no lost jobs |
| DB Failover               | Force Postgres primary failover to replica       | App reconnects within 5s; zero data loss |
| Network Partition          | Isolate worker network from DB for 60s          | Jobs queued in Redis; drain after recovery |
| LLM Timeout               | Inject 30s latency on LLM provider responses    | Circuit breaker opens; fallback to local model |
| Proxy Pool Exhaustion     | Block all proxy IPs simultaneously               | Scrape jobs fail gracefully; retry with backoff |
| Redis Crash               | Kill Redis instance                              | Queue rebuilt from persistent storage; <10s recovery |

### Acceptance Thresholds for Launch

| Metric              | Threshold        |
|----------------------|-----------------|
| API p99 Latency      | < 500ms         |
| Workflow p99 Latency  | < 5s           |
| Queue Depth (steady)  | < 1000 jobs    |
| Recovery Time (any)   | < 60s          |
| Data Loss             | 0              |
| Error Rate            | < 0.1%         |

---

## 11. Observability, Metrics & Alerting

### Key Metrics

| Category    | Metric                          | Source          |
|-------------|----------------------------------|-----------------|
| Business    | MRR, ARR, churn rate            | Stripe + DB     |
| Business    | Active tenants, daily active users | Auth service  |
| AI          | Token usage per tenant/model    | Usage records   |
| AI          | Schema violation rate           | Guardrail logs  |
| AI          | LLM latency (p50/p95/p99)      | Prometheus      |
| Trading     | Bot PnL (per bot, per tenant)   | Trade orders    |
| Trading     | Risk events / kill-switch count | Risk manager    |
| Workflows   | Execution success/failure rate  | Workflow runs   |
| Workflows   | Avg duration, queue wait time   | Prometheus      |
| Scraping    | Completion rate, PII detection rate | Scrape jobs  |
| Platform    | API latency (p50/p95/p99)       | API gateway     |
| Platform    | Container utilization           | cAdvisor        |

### Alerts & Automations

| Alert                              | Condition                                  | Action                                  |
|------------------------------------|--------------------------------------------|-----------------------------------------|
| `trading.daily_loss_limit`         | Bot PnL < -daily_loss_limit               | Auto kill-switch; notify tenant + ops   |
| `trading.anomalous_volume`         | Volume > 5x rolling 24h average           | Auto-throttle; flag for review          |
| `ai.token_quota_warning`           | Usage > 80% of monthly quota              | Notify tenant; suggest upgrade          |
| `ai.token_quota_exceeded`          | Usage > 100% of monthly quota             | Block LLM calls; notify tenant          |
| `ai.schema_violation_spike`        | Violation rate > 5% in 1h window          | Alert AI team; review prompt/schema     |
| `workflow.high_failure_rate`       | Failure rate > 10% in 1h window           | Alert platform ops                      |
| `security.sandbox_escape`          | Blocked syscall detected in container      | Kill container; alert security team     |
| `billing.payment_failed`           | Stripe payment failure                     | 3-day grace; then suspend tenant        |
| `platform.p99_latency_high`       | API p99 > 1s for 5 consecutive minutes    | Alert SRE; auto-scale if possible       |
| `platform.error_rate_high`        | Error rate > 1% for 5 minutes             | Alert SRE                               |

### Dashboard List (Grafana)

| Dashboard               | Key Panels                                                    |
|--------------------------|--------------------------------------------------------------|
| **Platform Overview**    | Active users, API requests/sec, error rate, p99 latency       |
| **Revenue & Billing**   | MRR trend, new subscriptions, churn, ARPU                     |
| **AI Usage**             | Token consumption by model, schema violation rate, latency    |
| **Trading Operations**  | Active bots, total PnL, risk events, kill-switch activations  |
| **Workflow Engine**      | Executions/min, success rate, avg duration, queue depth        |
| **Scraping**             | Active jobs, completion rate, PII detections, proxy health     |
| **Infrastructure**       | CPU, memory, disk, container count, DB connections, Redis ops |
| **Security**             | Auth failures, rate limit hits, sandbox alerts, audit events   |

### Sentry Integration
- Error tracking for API, worker, and frontend applications.
- Alert rules: new error spike > 10 occurrences in 5min → Slack + PagerDuty.

---

## 12. CI/CD & Infra-as-Code

> See `ci.yml` for the full GitHub Actions pipeline.
> See `docker-compose.yml` for the dev stack configuration.

### CI Pipeline Stages
1. **Lint & Format** — ESLint, Prettier
2. **Unit & Integration Tests** — Jest/Vitest with Postgres + Redis services
3. **Security Scan** — npm audit + Trivy filesystem scan
4. **Build** — TypeScript compilation, asset bundling
5. **Docker Build & Push** — Multi-service images (API, Worker) to GHCR
6. **Image Scan** — Trivy container scan (CRITICAL/HIGH = block)

---

## 13. Security Checklist for SOC 2 Readiness

### Required Controls & Evidence

| # | Control Area                    | Requirement                                              | Evidence                                    |
|---|----------------------------------|----------------------------------------------------------|---------------------------------------------|
| 1 | Access Control                   | RBAC with least privilege; MFA for admin accounts        | IAM policies, MFA enrollment logs           |
| 2 | Authentication                   | Strong password policy; JWT rotation                     | Auth service config, token rotation logs    |
| 3 | Access Logging                   | Log all authentication events                            | audit_logs table, CloudWatch/Loki           |
| 4 | Change Control                   | All changes via PR with review; no direct prod commits   | GitHub branch protection rules, PR history  |
| 5 | Code Review                      | Minimum 1 reviewer for all PRs                           | PR approval logs                            |
| 6 | Vulnerability Management         | Automated dependency scanning in CI                      | Trivy/Snyk scan results, remediation SLA    |
| 7 | Encryption at Rest               | AES-256 for database, object storage                     | Postgres TDE config, S3 bucket policy       |
| 8 | Encryption in Transit            | TLS 1.3 for all connections                              | Certificate configs, SSL Labs report        |
| 9 | Data Retention                   | Defined retention policies per data type                 | Policy document, automated cleanup scripts  |
| 10| Incident Response                | Documented IR plan with runbooks                         | operator_runbook.md, IR test results        |
| 11| Disaster Recovery                | Regular DR tests; RTO < 4h, RPO < 1h                    | DR test reports, backup verification logs   |
| 12| Backup & Recovery                | Automated daily backups with tested restore              | Backup configs, restore test logs           |
| 13| Network Security                 | Firewall rules; VPC isolation; egress proxy for sandboxes| Security group configs, proxy logs          |
| 14| Vendor Management                | Security assessment for 3rd-party services               | Vendor questionnaires (Stripe, AWS, etc.)   |
| 15| Employee Security                | Background checks; security training                     | Training completion records                 |
| 16| Monitoring & Alerting            | 24/7 monitoring with defined alert thresholds            | Grafana dashboards, PagerDuty schedules     |
| 17| Physical Security                | Cloud provider SOC 2 reports (inherited)                 | AWS/GCP SOC 2 Type II reports               |
| 18| Privacy                          | GDPR/CCPA compliance; PII handling procedures            | Privacy policy, DPA templates, PII scan logs|
| 19| Business Continuity              | BCP document with tested failover procedures             | BCP document, failover test results         |
| 20| Audit Trail Integrity            | WORM storage for critical audit logs                     | Immutability config, integrity check logs   |

---

## 14. Deliverables

All deliverables are provided as separate files in this directory:

| ID | File                          | Description                                    |
|----|-------------------------------|------------------------------------------------|
| A  | `schema.sql`                  | Full CREATE TABLE statements for core tables   |
| B  | `api_spec.md`                 | REST endpoints + example payloads              |
| C  | `docker-compose.yml`          | Dev stack: Postgres, Redis, n8n, Qdrant, etc.  |
| D  | `sample_n8n_flow.json`        | Scrape → LLM → Embed → Paper Trade flow       |
| E  | `red_team_tests.csv`          | 14 red-team test cases                         |
| F  | `task-list.csv`               | 8-sprint roadmap with ticket details           |
| G  | `backtest_report_template.md` | Trading bot backtest report skeleton            |
| H  | `operator_runbook.md`         | Incident: abnormal trading losses              |
| —  | `ci.yml`                      | GitHub Actions CI pipeline                     |
| —  | `product_spec.md`             | This file (full specification)                 |

---

## 15. Acceptance Criteria & Launch Checklist

### Minimum Automated Test Coverage

| Area                  | Minimum Coverage | Type                        |
|-----------------------|------------------|-----------------------------|
| Auth Module           | 90%              | Unit + Integration          |
| Billing Module        | 85%              | Unit + Integration          |
| Workflow Engine       | 85%              | Unit + Integration + E2E    |
| Bot Manager           | 85%              | Unit + Integration          |
| Trading Risk Manager  | 95%              | Unit + Property-based       |
| AI Guardrails         | 90%              | Unit + Fuzz                 |
| API Endpoints         | 80%              | Integration                 |
| Frontend (critical paths) | 70%          | E2E (Playwright)            |

### Load Test Pass Levels

| Test                  | Pass Criteria                    |
|-----------------------|----------------------------------|
| API Load (10K users)  | p99 < 500ms, error rate < 0.1%   |
| Workflow Load (500/s) | p99 < 5s, zero lost jobs         |
| Trading Load (100/s)  | p99 < 200ms, zero duplicate orders |
| Scraping Load (5K/hr) | 95% completion, PII scan 100%   |

### Guardrail Verifications

| Guardrail                     | Verification Method                               | Pass Criteria |
|-------------------------------|---------------------------------------------------|---------------|
| Prompt Injection Defense      | Run RT-01, RT-02, RT-03 test cases                | 100% detected |
| Output Schema Enforcement     | Submit 100 malformed LLM responses                | 100% rejected |
| Trading Kill-Switch           | Trigger via API, risk manager, admin panel         | <5s to full stop |
| PII Auto-Redaction            | Process 1000 records with known PII               | 100% redacted |
| Sandbox Isolation             | Run RT-11, RT-12 escape/bomb tests                | 100% contained |
| Multi-Tenant Isolation        | Cross-tenant data access attempts                 | 100% blocked  |

### Red-Team Remediation Sign-Off

All 14 red-team test cases (see `red_team_tests.csv`) must be:
1. Executed in staging environment
2. Detection confirmed working
3. Rollback actions validated
4. Results documented and signed off by: Security Lead, Engineering Lead, Compliance Officer

### Launch Checklist

| # | Item                                           | Owner           | Status |
|---|------------------------------------------------|-----------------|--------|
| 1 | All P0 features implemented and tested         | Engineering     | ☐      |
| 2 | Test coverage meets minimums (see above)       | QA              | ☐      |
| 3 | Load tests pass all thresholds                 | SRE             | ☐      |
| 4 | All 14 red-team tests pass                     | Security        | ☐      |
| 5 | AI guardrails verified                         | AI Team         | ☐      |
| 6 | Trading kill-switch tested (3 trigger methods) | Engineering     | ☐      |
| 7 | PII detection pipeline validated               | Compliance      | ☐      |
| 8 | SOC 2 evidence items collected (20/20)         | Compliance      | ☐      |
| 9 | DR test completed successfully                 | SRE             | ☐      |
| 10| Monitoring dashboards operational              | SRE             | ☐      |
| 11| Alert routing verified (PagerDuty/Slack)       | SRE             | ☐      |
| 12| Legal: Terms of Service published              | Legal           | ☐      |
| 13| Legal: Trading addendum template approved      | Legal           | ☐      |
| 14| Legal: Privacy policy published                | Legal           | ☐      |
| 15| DNS + CDN + SSL configured                     | Infrastructure  | ☐      |
| 16| Stripe production keys configured              | Engineering     | ☐      |
| 17| Feature flags reviewed (no dev flags in prod)  | Engineering     | ☐      |
| 18| Operator runbooks reviewed by ops team         | SRE             | ☐      |
| 19| On-call rotation established                   | SRE             | ☐      |
| 20| Go/No-Go sign-off from all stakeholders        | All Leads       | ☐      |
