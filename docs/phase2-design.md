# Phase 2 design — Registration module

**Date:** 2026-05-23
**Status:** Design locked, ready for implementation
**Predecessor:** Phase 1 tagged `v0.1.0-phase1` (commit `27521bb`)

This document captures the six structural decisions for Phase 2 of Darbel — the Registration module. It is the contract between design and implementation: every choice below was made deliberately, with tradeoffs named, before any code was written.

---

## Phase 2 in one paragraph

A Registrar in a tenant office creates a handler record for a person seeking certification (food workers, barbers, hairdressers, creche workers — anyone whose work involves close physical contact with food or people). The Registrar uploads required documents, records the payment, and the system allocates a tenant-scoped UID. The handler now exists in the tenant's records, ready for Phase 3's medical screening workflow.

---

## Decision 1 — Handler identity scope

**Strictly tenant-scoped. Handlers as subjects, not users.**

- `handlers` table has `tenant_id NOT NULL`, RLS-enforced (same shape as `users` RLS)
- No cross-tenant handler visibility at any layer — search, lookup, or verification
- Inspectors verifying a UID only see results within their own tenant's records
- Handlers do **not** have user accounts in Phase 2 — they cannot log in
- The `HANDLER` role from Phase 1's seed remains in the schema but is unassigned
- Certificate delivery (Phase 3) goes via email, WhatsApp, or print — never login
- Tenants own all handler data end-to-end; Branddarrow is platform operator only
- "Shopping for a pass" risk (handler fails at tenant A, retries at tenant B) acknowledged and accepted; mitigation deferred indefinitely unless regulators require it

### Implications for the data model

- `handlers.tenant_id` is the RLS scoping column
- Handler fields: name, phone, email, WhatsApp (consent-captured), DOB, address, photo reference
- No password, MFA, or session fields
- Each tenant operates its own handler registry; no shared identity service

---

## Decision 2 — UID generation scheme

**Format: `[3-char tenant prefix]-[6-char random Base32]-[1-char checksum]`**

```
Example:    BBH-K7MZ4Q-X
Length:     10 chars total (8 alphanumeric + 2 dashes)
Capacity:   32^6 ≈ 1.07 billion combinations per tenant
```

- Tenant prefix is chosen by the tenant at onboarding, immutable thereafter, must be uppercase A-Z, must not collide with another tenant's prefix
- **Branddarrow's prefix: `BBH`**
- Random part uses RFC 4648 Base32 alphabet (A-Z, 2-7) — excludes confusable characters 0, 1, 8, 9
- Checksum is computed over `tenantPrefix + randomPart`, single Base32 character
- Generated cryptographically via `crypto.randomBytes()`, never sequentially
- Collision strategy: catch unique-constraint violation on insert, retry up to 3 times, then raise
- UID is allocated **at payment approval**, never before (see Decision 4)

### Schema additions

```sql
tenants.uid_prefix    VARCHAR(3) UNIQUE NOT NULL  -- e.g. 'BBH'
handlers.uid          VARCHAR(10) UNIQUE          -- nullable until payment approval
                                                  -- format: 'BBH-K7MZ4Q-X'
```

### Service

`backend/src/modules/registration/uid.service.ts`

```typescript
generateUid(tenantPrefix: string): Promise<string>
verifyUid(uid: string): { valid: boolean; tenantPrefix?: string }
```

---

## Decision 3 — Documents architecture

### 3a — Storage

**MinIO self-hosted** for Nigerian data residency. Set up once per environment by the DBA/operator. Phase 2 v1 includes the runbook for MinIO installation; the application reads bucket credentials from environment variables.

### 3b — Required documents

For Phase 2 v1, kept lean:

| Slot | Required | Notes |
|---|---|---|
| `photograph` | Yes | Used on certificate (Phase 3) |
| `government_id` | Yes | National ID, voter card, or driver's license |
| `prior_certificate` | Optional | From another tenant if applicable |

Trade-specific document requirements deferred to Phase 2.1 after operational feedback.

### 3c — Data model

```sql
CREATE TABLE handler_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),  -- RLS scope
    handler_id      UUID NOT NULL REFERENCES handlers(id),
    document_type   VARCHAR(40) NOT NULL,
    storage_key     TEXT NOT NULL,
    original_filename TEXT,
    mime_type       VARCHAR(80) NOT NULL,
    size_bytes      BIGINT NOT NULL,
    sha256_hash     CHAR(64) NOT NULL,
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    superseded_by   UUID REFERENCES handler_documents(id),
    superseded_at   TIMESTAMPTZ,
    notes           TEXT
);
```

Supersedence pattern means documents are never deleted, only marked replaced. Audit trail stays intact.

### 3d — Upload security

- **Backend-mediated only.** Never accept client-to-MinIO direct uploads.
- Size limit: **5 MB**
- MIME allowlist: `image/jpeg`, `image/png`, `application/pdf` (no SVG — script risk)
- Server-side image re-encoding to strip metadata and ensure parseable bytes
- SHA-256 hash recorded for tamper detection
- Access via short-lived (5-minute) pre-signed URLs, never permanent URLs

### 3e — Storage key naming

```
darbel/{tenant_id}/handlers/{handler_id}/{document_type}/{uuid}.{ext}
```

Grouping by tenant enables per-tenant backup/restore. Per-handler grouping helps cleanup. Trailing UUID prevents collisions on supersedence.

---

## Decision 4 — Payment recording

### 4a — State machine

```
                  ┌─────────┐
                  │ PENDING │  (Registrar created)
                  └────┬────┘
                       │
              ┌────────┴────────┐
              ↓                 ↓
       ┌──────────┐      ┌──────────┐
       │ APPROVED │      │ REJECTED │
       └────┬─────┘      └──────────┘
            │
            ↓
       ┌──────────┐
       │ REFUNDED │
       └──────────┘
```

The `CHECKBOX_PAID` tenant model (from Phase 1) allows `PENDING → APPROVED` by the Registrar directly, with mandatory `justification` text if above the configured threshold. The `FINANCE_APPROVAL` model requires Finance Officer to make the transition.

### 4b — Payment record schema

```sql
CREATE TABLE payments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenants(id),
    handler_id         UUID NOT NULL REFERENCES handlers(id),
    registration_id    UUID NOT NULL REFERENCES registrations(id),
    amount             NUMERIC(14,2) NOT NULL,
    currency           CHAR(3) NOT NULL DEFAULT 'NGN',
    method             VARCHAR(20) NOT NULL,  -- CASH, BANK_TRANSFER, POS, CARD, GATEWAY, OTHER
    reference_number   VARCHAR(120),
    status             VARCHAR(20) NOT NULL,  -- PENDING, APPROVED, REJECTED, REFUNDED
    recorded_by        UUID NOT NULL REFERENCES users(id),
    recorded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by        UUID REFERENCES users(id),
    approved_at        TIMESTAMPTZ,
    rejected_reason    TEXT,
    refunded_by        UUID REFERENCES users(id),
    refunded_at        TIMESTAMPTZ,
    refund_reason      TEXT,
    justification      TEXT
);
```

### 4c — Cardinality

**One payment per registration. No partial payments.**

- Handler pays the full fee or no registration happens
- Registration sits in `PENDING_PAYMENT` until paid in full
- UID is allocated only on payment approval (Decision 4c-i)
- A handler abandoning a registration mid-flow → row auto-VOIDs after 7 days; Registrar can VOID earlier (Decision 4c-ii)
- Refund cascades: refunding an approved payment auto-voids the registration and revokes the certificate (Decision 4c-iii)
- Renewals are new registrations with new payments, not updates to existing rows

---

## Decision 5 — Trade categories

### 5a — Configurability

**Categories per jurisdiction. Fees per tenant.**

- Lagos has one canonical category list, defined and managed by the platform (Branddarrow)
- Each tenant sets their own fee for each category via a tenant-scoped overrides table
- Validity periods remain platform-set (regulatory consistency)

### 5b — Category schema

```sql
CREATE TABLE trade_categories (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction_id       UUID NOT NULL REFERENCES jurisdictions(id),
    code                  VARCHAR(40) NOT NULL,
    display_name          VARCHAR(120) NOT NULL,
    sector                VARCHAR(20) NOT NULL,  -- FOOD, PERSONAL_CARE, CHILDCARE
    description           TEXT,
    validity_period_days  INT NOT NULL DEFAULT 365,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (jurisdiction_id, code)
);

CREATE TABLE trade_category_fees (
    tenant_id          UUID NOT NULL REFERENCES tenants(id),
    trade_category_id  UUID NOT NULL REFERENCES trade_categories(id),
    fee_amount         NUMERIC(14,2) NOT NULL,
    currency           CHAR(3) NOT NULL DEFAULT 'NGN',
    effective_from     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by         UUID NOT NULL REFERENCES users(id),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, trade_category_id)
);
```

If no `trade_category_fees` row exists for a `(tenant, category)`, that category is unbookable for that tenant until TENANT_ADMIN sets a fee.

### 5c — Lagos seed (10 categories)

| Code | Display Name | Sector |
|---|---|---|
| `STREET_VENDOR` | Street Food Vendor | FOOD |
| `RESTAURANT_COOK` | Restaurant Cook | FOOD |
| `HOTEL_KITCHEN` | Hotel Kitchen Staff | FOOD |
| `BAKERY_WORKER` | Bakery Worker | FOOD |
| `CATERING_SERVICE` | Catering Service Personnel | FOOD |
| `MEAT_PROCESSOR` | Meat Processor / Butcher | FOOD |
| `FOOD_VENDOR` | Food Vendor (generic) | FOOD |
| `BARBER` | Barber | PERSONAL_CARE |
| `HAIRDRESSER` | Hairdresser | PERSONAL_CARE |
| `CRECHE_WORKER` | Creche Worker | CHILDCARE |

Validity periods placeholder = 365 days. `MEAT_PROCESSOR` placeholder = 180 days. Real values set before launch by Branddarrow in consultation with Lagos State.

### 5d — A note on naming

The `handlers` table name predates the scope expansion to personal-care and childcare. The migration includes an explicit `COMMENT ON TABLE handlers` clarifying that scope. Future engineers should not assume "handler" means food.

### 5e — Management

- **Categories** — platform-level only (Branddarrow Super Admin). New permission: `category.manage`.
- **Fees** — TENANT_ADMIN within their own tenant. New permission: `trade.set_fee`.
- **Validity periods** — platform-level only (regulatory consistency).

---

## Decision 6 — Phase 2 v1 scope and build order

### In scope for v1

| Area | Deliverables |
|---|---|
| Database | Migrations for trade_categories, trade_category_fees, handlers, handler_documents, registrations, payments; updated permissions; updated role grants |
| Backend services | UID generation; document upload via MinIO; payment state machine; registration lifecycle |
| Backend API | Endpoints for category fee management, handler create, document upload, payment record, payment approve |
| Frontend | TENANT_ADMIN — category fee management page; Registrar — handler creation form, document upload, payment recording; Finance Officer — payment approval queue |
| Verification | Smoke test extended to cover registration flow end-to-end |

### Deferred to v1.1

- Handler search and listing
- Handler edit / update / deactivate
- Document supersedence UI
- Payment refund flow
- Batch operations

### Deferred to Phase 3

- Certificate PDF generation
- Public certificate verification within tenant (Inspector UI)
- WhatsApp / Email / Print delivery of certificates
- Medical test recording and result entry
- Lab technician blind-submit pattern

### Build order — vertical slices

Each slice ships independently with backend migrations, services, endpoints, frontend pages, integration tests, and a passing smoke test before the next slice begins.

1. **Slice 1 — Trade categories foundation.** Migration with the 10 Lagos categories. TENANT_ADMIN endpoint to set fees. Frontend page to manage fees. Smoke test confirms category fees set and read correctly.

2. **Slice 2 — Handler creation.** `handlers` table migration. Registrar endpoint to create a handler (no documents or payment yet). Frontend page for handler creation form. Smoke test creates a handler.

3. **Slice 3 — UID generation.** UID service with collision retry and checksum verification. Wired into handler lifecycle (allocated on payment approval). Unit tests cover format, collision, and verification.

4. **Slice 4 — Document upload.** MinIO setup runbook. `handler_documents` migration. Backend upload endpoint with size, MIME, and re-encoding validation. Frontend upload UI. Smoke test uploads a JPEG to a handler.

5. **Slice 5 — Payment recording.** `payments` and `registrations` table migrations. Registrar records payment. Finance Officer approves. State machine enforced in backend. Smoke test exercises the FINANCE_APPROVAL flow.

6. **Slice 6 — End-to-end registration.** All previous slices combined into one Registrar workflow. Smoke test does: create handler → upload docs → record payment → approve → confirm UID issued.

---

## Implementation notes

### Permissions to add

```
category.manage            (platform-level, Branddarrow Super Admin)
trade.set_fee              (tenant-level, TENANT_ADMIN)
handler.create             (already declared in Phase 1 seed, becomes active)
handler.view               (already declared)
handler.update             (already declared, used in v1.1)
handler.deactivate         (already declared, used in v1.1)
payment.record             (already declared)
payment.approve            (already declared)
payment.checkbox_paid      (already declared)
payment.refund             (already declared, used in v1.1)
payment.view               (already declared)
```

All permission codes were seeded in Phase 1 forward-compatibly. Phase 2 grants them to the appropriate roles.

### Role assignments (in addition to Phase 1)

| Role | New permissions in v1 |
|---|---|
| SUPER_ADMIN | `category.manage` |
| TENANT_ADMIN | `trade.set_fee`, plus already-implied handler/payment view access |
| REGISTRAR | (already has handler.create, handler.view, handler.update, payment.record, payment.view from Phase 1 seed) |
| FINANCE_OFFICER | (already has payment.* from Phase 1 seed) |

### Migration strategy

Phase 2 migrations follow the Prisma-managed pattern established in Phase 1:

- Schema changes start in `schema.prisma`
- Generated via `npx prisma migrate dev --name <descriptive>`
- Hand-edited to add RLS policies and seed data
- Committed alongside the code that depends on them
- Smoke test extended to cover the new functionality before merging

### Testing discipline

The smoke test at `docs/migration-history/darbel-v2-patch/scripts/smoke-test.js` is extended per slice. Phase 1's lesson: integration testing catches what type-checking cannot. Every slice gets new smoke test coverage before the slice ships.

---

## What this design deliberately is not

- **Not a multi-payment system.** A handler pays the full fee or doesn't register. Simpler operationally, fewer edge cases, no partial-payment audit ambiguity.
- **Not a cross-tenant identity system.** Each tenant manages their own handlers. No global registry, no identity matching, no cross-tenant lookup.
- **Not a self-service handler portal.** Handlers don't log in. Registrars register them.
- **Not a public certificate verification platform.** Inspectors verify within their tenant only. No anonymous nationwide UID lookup.

These choices simplify Phase 2 meaningfully. If regulators or operators later demand any of them, they become Phase 3+ work with explicit requirements and consent frameworks.

---

## How to resume

When you next sit down to Darbel, the prompt is:

> Start Phase 2 v1, Slice 1 — Trade categories foundation. Repo: github.com/dejiade-coder/darbel. Phase 2 design at docs/phase2-design.md.

I will read this document and we begin Slice 1.
