-- =============================================================================
-- Terminal Edge — Service Storefront Database Schema
-- PostgreSQL 15+  |  Solo Operator Storefront + Order/Quote System
-- =============================================================================
-- USAGE:  psql -U terminal_edge -d terminal_edge -f schema.sql
-- SECRETS: None — connection credentials come from env vars.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================== ENUMS ============================================
CREATE TYPE user_role         AS ENUM ('customer','admin');
CREATE TYPE service_category  AS ENUM ('website','ai_workflow','bot','custom_app');
CREATE TYPE pricing_model     AS ENUM ('fixed','quote');
CREATE TYPE order_status      AS ENUM ('quote_requested','quoted','accepted','paid','in_progress','in_review','revision','delivered','completed','cancelled','refunded');
CREATE TYPE quote_status      AS ENUM ('draft','sent','accepted','declined','expired');
CREATE TYPE payment_status    AS ENUM ('pending','succeeded','failed','refunded');
CREATE TYPE message_sender    AS ENUM ('customer','operator');
CREATE TYPE bot_class         AS ENUM ('trading','scraping','monitoring','automation','custom');
CREATE TYPE workflow_status   AS ENUM ('draft','active','paused','archived');
CREATE TYPE run_status        AS ENUM ('pending','running','success','failed','cancelled','timeout');
CREATE TYPE order_side        AS ENUM ('buy','sell');
CREATE TYPE order_type        AS ENUM ('market','limit','stop');
CREATE TYPE trade_order_status AS ENUM ('pending','submitted','filled','partial','cancelled','rejected');

-- ========================== USERS (Customers + Admin) ========================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    display_name    TEXT,
    role            user_role NOT NULL DEFAULT 'customer',
    phone           TEXT,
    company         TEXT,
    avatar_url      TEXT,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);

-- ========================== SERVICES (Catalog) ===============================
CREATE TABLE services (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category        service_category NOT NULL,
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    tagline         TEXT,
    description     TEXT,                                       -- rich text / markdown
    pricing_model   pricing_model NOT NULL DEFAULT 'quote',
    price_cents     INT,                                        -- NULL if quote-based
    currency        TEXT NOT NULL DEFAULT 'usd',
    features        JSONB DEFAULT '[]',                         -- list of included features
    delivery_days   INT,                                        -- estimated delivery time
    thumbnail_url   TEXT,
    gallery_urls    JSONB DEFAULT '[]',                         -- portfolio images
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_active   ON services(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_services_slug     ON services(slug);

-- ========================== SERVICE ADD-ONS ===================================
CREATE TABLE service_addons (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    price_cents     INT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_addons_service ON service_addons(service_id);

-- ========================== ORDERS ===========================================
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number    SERIAL,                                     -- human-readable TE-0001
    customer_id     UUID NOT NULL REFERENCES users(id),
    service_id      UUID NOT NULL REFERENCES services(id),
    status          order_status NOT NULL DEFAULT 'quote_requested',
    requirements    TEXT,                                       -- customer's project brief
    requirements_attachments JSONB DEFAULT '[]',                -- uploaded files
    total_cents     INT,                                        -- final price (set after quote or from fixed)
    currency        TEXT NOT NULL DEFAULT 'usd',
    addons          JSONB DEFAULT '[]',                         -- selected add-ons with prices
    estimated_delivery DATE,
    actual_delivery DATE,
    revision_count  INT DEFAULT 0,
    max_revisions   INT DEFAULT 2,
    delivered_files JSONB DEFAULT '[]',                         -- [{name, url, type}]
    delivered_links JSONB DEFAULT '[]',                         -- [{label, url}]
    notes_internal  TEXT,                                       -- operator-only notes
    stripe_payment_intent_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status   ON orders(status);
CREATE INDEX idx_orders_service  ON orders(service_id);

-- ========================== QUOTES ===========================================
CREATE TABLE quotes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES users(id),
    status          quote_status NOT NULL DEFAULT 'draft',
    amount_cents    INT NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'usd',
    line_items      JSONB NOT NULL DEFAULT '[]',               -- [{description, amount_cents}]
    notes           TEXT,                                       -- operator notes to customer
    valid_until     TIMESTAMPTZ,                               -- quote expiration
    accepted_at     TIMESTAMPTZ,
    stripe_invoice_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quotes_order    ON quotes(order_id);
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_status   ON quotes(status);

-- ========================== PAYMENTS =========================================
CREATE TABLE payments (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id                    UUID NOT NULL REFERENCES orders(id),
    customer_id                 UUID NOT NULL REFERENCES users(id),
    stripe_payment_intent_id    TEXT UNIQUE,
    stripe_invoice_id           TEXT,
    amount_cents                INT NOT NULL,
    currency                    TEXT NOT NULL DEFAULT 'usd',
    status                      payment_status NOT NULL DEFAULT 'pending',
    description                 TEXT,
    receipt_url                 TEXT,
    refund_reason               TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_order    ON payments(order_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_stripe   ON payments(stripe_payment_intent_id);

-- ========================== MESSAGES (Per-Order Thread) =======================
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sender_type     message_sender NOT NULL,
    sender_id       UUID REFERENCES users(id),                 -- NULL if system message
    body            TEXT NOT NULL,
    attachments     JSONB DEFAULT '[]',                        -- [{name, url, type, size}]
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_order ON messages(order_id, created_at);

-- ========================== REVIEWS ==========================================
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID UNIQUE NOT NULL REFERENCES orders(id),
    customer_id     UUID NOT NULL REFERENCES users(id),
    service_id      UUID NOT NULL REFERENCES services(id),
    rating          INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title           TEXT,
    body            TEXT,
    is_public       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_service ON reviews(service_id);

-- ========================== PORTFOLIO (Case Studies) =========================
CREATE TABLE portfolio_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id      UUID REFERENCES services(id),
    title           TEXT NOT NULL,
    description     TEXT,
    thumbnail_url   TEXT,
    gallery_urls    JSONB DEFAULT '[]',
    live_url        TEXT,
    tags            JSONB DEFAULT '[]',
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================== NOTIFICATIONS ====================================
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    type            TEXT NOT NULL,                              -- order_update, quote_received, message, delivery
    title           TEXT NOT NULL,
    body            TEXT,
    link            TEXT,                                       -- in-app deep link
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    email_sent      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at);

-- =============================================================================
-- OPERATOR-SIDE TABLES (Delivery Infrastructure — not customer-facing)
-- =============================================================================

-- ========================== PROJECTS (Internal tracking) =====================
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID REFERENCES orders(id),
    name            TEXT NOT NULL,
    type            service_category NOT NULL,
    description     TEXT,
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_order ON projects(order_id);

-- ========================== WORKFLOWS ========================================
CREATE TABLE workflows (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    order_id        UUID REFERENCES orders(id),
    name            TEXT NOT NULL,
    description     TEXT,
    status          workflow_status NOT NULL DEFAULT 'draft',
    version         INT NOT NULL DEFAULT 1,
    definition      JSONB NOT NULL DEFAULT '{}',
    trigger_config  JSONB DEFAULT '{}',
    n8n_compatible  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workflows_project ON workflows(project_id);
CREATE INDEX idx_workflows_order   ON workflows(order_id);

-- ========================== WORKFLOW NODES ====================================
CREATE TABLE workflow_nodes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    node_type       TEXT NOT NULL,
    label           TEXT,
    config          JSONB NOT NULL DEFAULT '{}',
    position_x      FLOAT DEFAULT 0,
    position_y      FLOAT DEFAULT 0,
    next_nodes      UUID[] DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wnodes_workflow ON workflow_nodes(workflow_id);

-- ========================== WORKFLOW RUNS =====================================
CREATE TABLE workflow_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status          run_status NOT NULL DEFAULT 'pending',
    idempotency_key TEXT UNIQUE,
    trigger_type    TEXT,
    input_payload   JSONB DEFAULT '{}',
    output_payload  JSONB DEFAULT '{}',
    node_results    JSONB DEFAULT '[]',
    error           TEXT,
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    duration_ms     INT,
    retry_count     INT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wruns_workflow ON workflow_runs(workflow_id);

-- ========================== BOTS =============================================
CREATE TABLE bots (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    order_id            UUID REFERENCES orders(id),
    name                TEXT NOT NULL,
    class               bot_class NOT NULL,
    description         TEXT,
    config              JSONB NOT NULL DEFAULT '{}',
    version             INT NOT NULL DEFAULT 1,
    is_active           BOOLEAN NOT NULL DEFAULT FALSE,
    sandbox_image       TEXT DEFAULT 'terminal-edge/bot-runner:latest',
    resource_limits     JSONB DEFAULT '{"cpu":"0.5","memory":"512Mi","timeout_seconds":300}',
    kill_switch         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bots_order ON bots(order_id);
CREATE INDEX idx_bots_class ON bots(class);

-- ========================== BOT RUNS =========================================
CREATE TABLE bot_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id          UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    status          run_status NOT NULL DEFAULT 'pending',
    container_id    TEXT,
    input_payload   JSONB DEFAULT '{}',
    output_payload  JSONB DEFAULT '{}',
    logs_url        TEXT,
    error           TEXT,
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    duration_ms     INT,
    resource_usage  JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bruns_bot ON bot_runs(bot_id);

-- ========================== TRADE ORDERS (Immutable Audit Ledger) =============
CREATE TABLE trade_orders (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id              UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    bot_run_id          UUID REFERENCES bot_runs(id),
    exchange            TEXT NOT NULL,
    symbol              TEXT NOT NULL,
    side                order_side NOT NULL,
    order_type          order_type NOT NULL DEFAULT 'market',
    quantity            NUMERIC(20,8) NOT NULL,
    price               NUMERIC(20,8),
    filled_quantity     NUMERIC(20,8) DEFAULT 0,
    filled_avg_price    NUMERIC(20,8),
    status              trade_order_status NOT NULL DEFAULT 'pending',
    is_paper            BOOLEAN NOT NULL DEFAULT TRUE,
    external_order_id   TEXT,
    risk_check_passed   BOOLEAN NOT NULL DEFAULT TRUE,
    risk_check_details  JSONB DEFAULT '{}',
    fees                NUMERIC(16,8) DEFAULT 0,
    pnl                 NUMERIC(16,8),
    consent_signed      BOOLEAN NOT NULL DEFAULT FALSE,
    addendum_version    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_torders_bot    ON trade_orders(bot_id);
CREATE INDEX idx_torders_symbol ON trade_orders(symbol, created_at);
-- IMPORTANT: Append-only in production. Revoke UPDATE/DELETE.

-- ========================== SCRAPE JOBS ======================================
CREATE TABLE scrape_jobs (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id                  UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    bot_run_id              UUID REFERENCES bot_runs(id),
    target_url              TEXT NOT NULL,
    robots_txt_compliant    BOOLEAN NOT NULL DEFAULT TRUE,
    schedule_cron           TEXT,
    proxy_region            TEXT,
    status                  run_status NOT NULL DEFAULT 'pending',
    result_url              TEXT,
    rows_extracted          INT DEFAULT 0,
    pii_detected            BOOLEAN DEFAULT FALSE,
    pii_redacted            BOOLEAN DEFAULT FALSE,
    deduped                 BOOLEAN DEFAULT FALSE,
    error                   TEXT,
    started_at              TIMESTAMPTZ,
    finished_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sjobs_bot ON scrape_jobs(bot_id);

-- ========================== BACKTESTS ========================================
CREATE TABLE backtests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id          UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    config          JSONB NOT NULL,
    status          run_status NOT NULL DEFAULT 'pending',
    result_summary  JSONB DEFAULT '{}',
    trades_count    INT DEFAULT 0,
    report_url      TEXT,
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_backtests_bot ON backtests(bot_id);

-- ========================== AUDIT LOGS (Append-Only / WORM) ==================
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    action          TEXT NOT NULL,
    resource_type   TEXT,
    resource_id     UUID,
    details         JSONB DEFAULT '{}',
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_action   ON audit_logs(action, created_at);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
-- Revoke UPDATE and DELETE on this table in production.
