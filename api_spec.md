# Terminal Edge — API Specification (v2)

> Base URL: `https://api.terminaledge.io/api/v1`
> Auth: Bearer JWT in `Authorization` header (except public catalog and auth endpoints).
> All responses use envelope: `{ "data": ..., "meta": { "request_id": "...", "timestamp": "..." } }`
> Two roles: `customer` (registered clients) and `admin` (operator — Dawayne).

---

## 1. Auth Module

### POST `/auth/register`
Register a new customer account.

**Request:**
```json
{
  "email": "alice@acme.com",
  "password": "S3cur3P@ss!",
  "display_name": "Alice Chen",
  "company": "Acme Corp",
  "phone": "+15551234567"
}
```

**Response (201):**
```json
{
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "alice@acme.com",
      "display_name": "Alice Chen",
      "role": "customer"
    },
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
    "expires_in": 900
  }
}
```

### POST `/auth/login`
**Request:**
```json
{
  "email": "alice@acme.com",
  "password": "S3cur3P@ss!"
}
```

**Response (200):**
```json
{
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
    "expires_in": 900,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "alice@acme.com",
      "role": "customer"
    }
  }
}
```

### POST `/auth/refresh`
**Request:** `{ "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g..." }`

**Response (200):**
```json
{
  "data": {
    "access_token": "eyJuZXcgdG9rZW4...",
    "refresh_token": "bmV3IHJlZnJlc2g...",
    "expires_in": 900
  }
}
```

### POST `/auth/logout`
**Response (200):** `{ "data": { "message": "Logged out" } }`

### GET `/auth/me`
**Response (200):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@acme.com",
    "display_name": "Alice Chen",
    "role": "customer",
    "company": "Acme Corp",
    "phone": "+15551234567"
  }
}
```

---

## 2. Service Catalog (Public)

### GET `/services`
List all active services. **No auth required.**

**Query params:** `?category=bot&page=1&limit=20`

**Response (200):**
```json
{
  "data": [
    {
      "id": "svc-001-uuid",
      "category": "bot",
      "name": "Price Monitoring Bot",
      "slug": "price-monitoring-bot",
      "tagline": "Track competitor prices 24/7 with automated alerts",
      "pricing_model": "fixed",
      "price_cents": 30000,
      "currency": "usd",
      "delivery_days": 5,
      "thumbnail_url": "https://cdn.terminaledge.io/services/price-bot.jpg",
      "avg_rating": 4.8,
      "review_count": 12
    },
    {
      "id": "svc-002-uuid",
      "category": "website",
      "name": "Custom Business Website",
      "slug": "custom-business-website",
      "tagline": "Professional multi-page website tailored to your brand",
      "pricing_model": "quote",
      "price_cents": null,
      "delivery_days": null,
      "thumbnail_url": "https://cdn.terminaledge.io/services/business-site.jpg",
      "avg_rating": 5.0,
      "review_count": 6
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 8 }
}
```

### GET `/services/:slug`
Get service detail page. **No auth required.**

**Response (200):**
```json
{
  "data": {
    "id": "svc-001-uuid",
    "category": "bot",
    "name": "Price Monitoring Bot",
    "slug": "price-monitoring-bot",
    "tagline": "Track competitor prices 24/7 with automated alerts",
    "description": "Full markdown description with features, use cases, FAQ...",
    "pricing_model": "fixed",
    "price_cents": 30000,
    "currency": "usd",
    "features": [
      "Monitor up to 50 URLs",
      "Hourly price checks",
      "Email & Slack alerts",
      "CSV export",
      "30-day data retention"
    ],
    "delivery_days": 5,
    "thumbnail_url": "https://cdn.terminaledge.io/services/price-bot.jpg",
    "gallery_urls": ["https://cdn.terminaledge.io/services/price-bot-1.jpg"],
    "addons": [
      { "id": "addon-001", "name": "Extra 50 URLs", "price_cents": 10000 },
      { "id": "addon-002", "name": "Real-time WebSocket alerts", "price_cents": 15000 }
    ],
    "reviews": [
      { "rating": 5, "title": "Exactly what we needed", "body": "...", "customer": "Sam M.", "date": "2026-02-15" }
    ],
    "portfolio_samples": [
      { "title": "E-commerce Price Tracker", "thumbnail_url": "...", "description": "..." }
    ]
  }
}
```

---

## 3. Orders Module

### POST `/orders`
Place a new order (customer). For fixed-price services, proceeds to checkout. For quote-based, creates a quote request.

**Request (fixed-price):**
```json
{
  "service_id": "svc-001-uuid",
  "requirements": "I need to monitor 30 competitor product pages on Amazon and Walmart. Send alerts to my Slack channel when prices drop more than 10%.",
  "addons": ["addon-001"],
  "payment_method_id": "pm_1234567890"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "ord-001-uuid",
    "order_number": 1,
    "status": "paid",
    "service": "Price Monitoring Bot",
    "total_cents": 40000,
    "estimated_delivery": "2026-03-06",
    "stripe_payment_intent_id": "pi_abc123",
    "created_at": "2026-03-01T21:00:00Z"
  }
}
```

**Request (quote-based):**
```json
{
  "service_id": "svc-002-uuid",
  "requirements": "We need a 5-page business website with contact form, blog, and Stripe integration. Brand colors: navy and gold. Reference site: example.com",
  "requirements_attachments": [
    { "name": "brand-guide.pdf", "url": "https://uploads.terminaledge.io/abc123.pdf" }
  ]
}
```

**Response (201):**
```json
{
  "data": {
    "id": "ord-002-uuid",
    "order_number": 2,
    "status": "quote_requested",
    "service": "Custom Business Website",
    "total_cents": null,
    "message": "Your quote request has been submitted. You'll receive a detailed quote within 24 hours."
  }
}
```

### GET `/orders`
List customer's orders (customer) or all orders (admin).

**Query params:** `?status=in_progress&page=1&limit=20`

### GET `/orders/:id`
Get order details with messages, deliverables, and quote info.

**Response (200):**
```json
{
  "data": {
    "id": "ord-002-uuid",
    "order_number": 2,
    "status": "in_progress",
    "service": { "name": "Custom Business Website", "category": "website" },
    "requirements": "We need a 5-page business website...",
    "total_cents": 250000,
    "estimated_delivery": "2026-03-15",
    "revision_count": 0,
    "max_revisions": 2,
    "delivered_files": [],
    "delivered_links": [],
    "quote": {
      "id": "qt-001-uuid",
      "amount_cents": 250000,
      "line_items": [
        { "description": "5-page responsive website", "amount_cents": 200000 },
        { "description": "Blog integration", "amount_cents": 30000 },
        { "description": "Stripe checkout integration", "amount_cents": 20000 }
      ],
      "accepted_at": "2026-03-02T10:00:00Z"
    },
    "message_count": 5,
    "created_at": "2026-03-01T21:00:00Z"
  }
}
```

### PUT `/orders/:id/status` *(Admin only)*
Update order status.

**Request:**
```json
{ "status": "in_review" }
```

### POST `/orders/:id/deliver` *(Admin only)*
Upload deliverables for an order.

**Request:**
```json
{
  "files": [
    { "name": "website-source.zip", "url": "https://files.terminaledge.io/deliveries/abc.zip", "type": "application/zip" }
  ],
  "links": [
    { "label": "Live Website", "url": "https://acme-corp.com" },
    { "label": "Admin Panel", "url": "https://acme-corp.com/admin" }
  ],
  "message": "Your website is live! Here are the access credentials and source files."
}
```

### POST `/orders/:id/revision`
Customer requests a revision.

**Request:**
```json
{
  "feedback": "The contact form needs a phone number field, and the hero image should be larger on mobile."
}
```

### POST `/orders/:id/complete`
Customer marks order as complete (triggers review prompt).

---

## 4. Quotes Module

### POST `/quotes` *(Admin only)*
Create and send a quote for a quote-requested order.

**Request:**
```json
{
  "order_id": "ord-002-uuid",
  "amount_cents": 250000,
  "line_items": [
    { "description": "5-page responsive website", "amount_cents": 200000 },
    { "description": "Blog integration", "amount_cents": 30000 },
    { "description": "Stripe checkout integration", "amount_cents": 20000 }
  ],
  "notes": "Estimated 10 business days. Includes 2 rounds of revisions.",
  "valid_until": "2026-03-08T23:59:59Z"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "qt-001-uuid",
    "order_id": "ord-002-uuid",
    "status": "sent",
    "amount_cents": 250000,
    "valid_until": "2026-03-08T23:59:59Z"
  }
}
```

### POST `/quotes/:id/accept` *(Customer)*
Customer accepts quote and pays.

**Request:**
```json
{ "payment_method_id": "pm_1234567890" }
```

**Response (200):**
```json
{
  "data": {
    "quote_id": "qt-001-uuid",
    "status": "accepted",
    "order_status": "paid",
    "payment": { "amount_cents": 250000, "status": "succeeded" }
  }
}
```

### POST `/quotes/:id/decline` *(Customer)*
**Request:** `{ "reason": "Budget too high" }`

---

## 5. Messages Module

### GET `/orders/:id/messages`
Get message thread for an order.

### POST `/orders/:id/messages`
Send a message in an order thread.

**Request:**
```json
{
  "body": "Can we change the hero section background to navy blue?",
  "attachments": [
    { "name": "reference.png", "url": "https://uploads.terminaledge.io/xyz.png" }
  ]
}
```

**Response (201):**
```json
{
  "data": {
    "id": "msg-001-uuid",
    "sender_type": "customer",
    "body": "Can we change the hero section background to navy blue?",
    "attachments": [{ "name": "reference.png", "url": "..." }],
    "created_at": "2026-03-03T14:00:00Z"
  }
}
```

---

## 6. Payments Module

### GET `/payments`
List payments for the customer (or all, for admin).

### GET `/payments/:id`
Get payment details with receipt URL.

### POST `/payments/:id/refund` *(Admin only)*
Issue a refund.

**Request:** `{ "reason": "Customer requested cancellation before work started" }`

---

## 7. Reviews Module

### POST `/orders/:id/review` *(Customer, after delivery)*
**Request:**
```json
{
  "rating": 5,
  "title": "Excellent work, delivered on time",
  "body": "Dawayne built exactly what we needed. Communication was great throughout."
}
```

### GET `/services/:slug/reviews`
Public: list reviews for a service.

---

## 8. Admin Endpoints (Operator Only)

### GET `/admin/dashboard`
**Response (200):**
```json
{
  "data": {
    "pending_quotes": 3,
    "active_orders": 7,
    "orders_in_review": 2,
    "revenue_this_month_cents": 1250000,
    "revenue_last_month_cents": 980000,
    "total_customers": 45,
    "avg_rating": 4.9
  }
}
```

### GET `/admin/orders`
All orders with filters: `?status=quote_requested&sort=created_at&order=desc`

### GET `/admin/customers`
List all customers with order counts and total spend.

### PUT `/admin/services/:id`
Update a service listing (description, pricing, active status).

### POST `/admin/services`
Create a new service listing.

---

## 9. Webhook Events

| Event                        | Trigger                                    |
|------------------------------|--------------------------------------------|
| `order.created`              | Customer places an order or quote request  |
| `order.paid`                 | Payment received for an order              |
| `order.status_changed`       | Order status updated by operator           |
| `order.delivered`            | Deliverables uploaded by operator          |
| `order.completed`            | Customer marks order complete              |
| `order.revision_requested`   | Customer requests a revision               |
| `quote.sent`                 | Operator sends a quote                     |
| `quote.accepted`             | Customer accepts and pays a quote          |
| `quote.declined`             | Customer declines a quote                  |
| `message.created`            | New message in order thread                |
| `review.created`             | Customer leaves a review                   |
| `payment.succeeded`          | Stripe payment succeeded                   |
| `payment.failed`             | Stripe payment failed                      |
| `payment.refunded`           | Refund issued                              |
| `bot.started`                | Delivered bot starts running               |
| `bot.stopped`                | Delivered bot stops                        |
| `bot.risk.breached`          | Trading bot risk limit breached            |

**Webhook payload envelope:**
```json
{
  "event": "order.created",
  "timestamp": "2026-03-01T21:00:00Z",
  "data": {
    "order_id": "ord-001-uuid",
    "customer_id": "550e8400-...",
    "service": "Price Monitoring Bot",
    "status": "paid",
    "total_cents": 40000
  },
  "signature": "sha256=abc123..."
}
```
