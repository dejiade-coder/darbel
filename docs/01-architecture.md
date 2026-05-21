# Darbel — Architecture Reference (Phase 1)

**Product:** Darbel
**Owner:** Branddarrow Business Hub
**Phase:** 1 — Foundation
**Version:** 0.1.0

---

## 1. System Identity

Darbel is a multi-tenant SaaS platform for managing food handler compliance: registration, statutory medical screening, certificate issuance, and audit-grade reporting. The platform is operated by Branddarrow Business Hub. Each client organization (state ministry, LGA, private compliance company) is a tenant on the platform.

## 2. Architectural Principles

These are non-negotiable. Every implementation decision must respect them.

1. **Multi-tenancy is structural, not bolted on.** Every domain table carries `tenant_id`. Row-Level Security enforces isolation at the database layer.
2. **Audit is infrastructure, not a feature.** All mutations are captured by database triggers, not application code.
3. **Separation of duties is enforced.** Lab Technicians enter results; Medical Officers approve. Finance Officers handle payments; Registrars never approve their own checkbox-paid registrations above threshold.
4. **Medical data is field-level protected.** Sensitive medical results (HIV in particular) are accessible only to roles with explicit grants, governed by RLS.
5. **Configuration over code.** Jurisdiction, test panels, fee schedules, currency, and certificate templates are database entities — not hard-coded constants.
6. **UID is regulated artifact.** Non-sequential, tamper-evident, verifiable.

## 3. Tenancy Model

- **Tenant** = a client organization that consumes the platform
- **Branddarrow** = the platform operator (a special "system" tenant for Super Admin operations)
- Tenant-1 in production will be the first Lagos client
- Users belong to exactly one tenant
- Cross-tenant access is impossible except for the platform-level Super Admin

## 4. Identity, Roles & Permissions

### Roles (from agreed structure)

| Role Code | Display Name | Tenant-scoped? |
|---|---|---|
| `SUPER_ADMIN` | Super Admin | Platform-level (Branddarrow only) |
| `TENANT_ADMIN` | Tenant Admin | Yes |
| `REGISTRAR` | Registrar | Yes |
| `MEDICAL_OFFICER` | Medical Officer | Yes |
| `LAB_TECHNICIAN` | Lab Technician | Yes |
| `FINANCE_OFFICER` | Finance Officer | Yes |
| `AUDITOR` | Auditor (read-only) | Yes |
| `INSPECTOR` | Inspector / Verifier | Yes |
| `HANDLER` | Handler (self-service) | Yes |

### Permission model

- **Role-Based Access Control (RBAC)** for coarse-grained access: which modules a role can touch
- **Attribute-Based Access Control (ABAC)** via Row-Level Security for fine-grained access: which rows within a module
- Example: A Lab Technician role grants module-level read/write on `medical_tests`; RLS restricts them to tests assigned to their lab.

### Sensitive field gating

Three medical fields are treated as **sensitive**:
- `hiv_result`
- `hepatitis_b_result`
- Any `*_diagnosis_notes`

Access requires the explicit grant `view_sensitive_medical_data`, held by `MEDICAL_OFFICER` and `TENANT_ADMIN` only. `LAB_TECHNICIAN` can write but not read these fields after submission (a "blind submit" pattern that protects handler privacy).

## 5. Module Boundaries

| Module | Owns | Depends On |
|---|---|---|
| `iam` | Users, Roles, Permissions, Sessions, MFA | — |
| `tenants` | Tenants, Tenant Settings, Jurisdictions | — |
| `audit` | Audit log, Change history | All modules write to audit |
| `registration` | Handlers, Trade Categories, Documents | iam, tenants |
| `payments` | Payment records, Fee schedules, Receipts, Refunds | registration |
| `medical` | Test panels, Tests, Results, Approvals | registration |
| `certificates` | Certificates, UIDs, Verification, Renewals | registration, payments, medical |
| `reports` | Reports, Exports, Schedules | All |

## 6. Authentication & Session Strategy

- **Password hashing:** Argon2id (memory: 64MB, iterations: 3, parallelism: 4)
- **Tokens:** JWT access tokens (15 min) + opaque refresh tokens (7 days, rotated on use)
- **MFA:** TOTP (Google Authenticator compatible) required for `SUPER_ADMIN`, `TENANT_ADMIN`, `MEDICAL_OFFICER`, `FINANCE_OFFICER`
- **Session storage:** Refresh tokens persisted in DB for revocation capability
- **Lockout:** 5 failed attempts → 15-minute lockout, audit-logged
- **Password policy:** min 12 chars, complexity required, no reuse of last 5

## 7. Audit Strategy

- Append-only `audit_log` table
- Postgres trigger fires on INSERT/UPDATE/DELETE for every domain table
- Captures: tenant_id, user_id, action, table, record_id, before_state (JSONB), after_state (JSONB), ip_address, user_agent, timestamp
- `audit_log` has no UPDATE or DELETE permissions for any application role
- Separate `sensitive_access_log` table records every READ of sensitive medical fields

## 8. Payment Approval Governance (Locked)

Per Section 2 Pushback 2 of the build plan:

- Tenant chooses model at setup: `FINANCE_APPROVAL` or `CHECKBOX_PAID`
- Only `SUPER_ADMIN` can change a tenant's payment model
- Every checkbox-paid action requires a `justification` field (min 20 chars)
- Configurable threshold: above amount X, checkbox-paid requires second-person confirmation (4-eyes)
- All checkbox-paid records are flagged in reports

## 9. UID Design

- Format: `DBL-{JURISDICTION_CODE}-{YEAR}-{8_CHAR_RANDOM}-{CHECKSUM}`
- Example: `DBL-LAG-2026-K7M9P2QR-7`
- Random component uses cryptographic RNG, base32 alphabet (Crockford, no ambiguous chars)
- Checksum is mod-10 (Luhn-like) for human-typed verification
- Stored with its certificate; the UID is what gets QR-encoded for verification

## 10. Certificate Verification

- Public endpoint: `GET /verify/{uid}` (no auth required)
- Returns: handler name, photo, trade, issue date, expiry, status (valid/expired/revoked)
- Does NOT return: medical results, address, phone, payment data
- Verification is rate-limited per IP

## 11. Data Residency

All production infrastructure must reside in Nigeria. Acceptable providers:
- MainOne Cloud (Lagos)
- Layer3 (Lagos)
- Galaxy Backbone (Abuja)

Development and staging may use any region.

## 12. Compliance Posture

- **NDPR (Nigeria Data Protection Regulation):** Lawful basis = contract performance + legal obligation
- **Sensitive data:** Medical results stored encrypted at rest (column-level encryption for `hiv_result`, `hepatitis_b_result`)
- **Retention:** Handler records retained for 7 years post last activity; medical results 10 years (per Nigerian health record retention norms — confirm with client)
- **Right to access:** Handlers can download their own data via self-service portal
- **Right to erasure:** Subject to legal retention obligations; soft-delete with audit trail

## 13. Out of Scope for Phase 1

- Payment gateway integration (Phase 2)
- Medical test workflow (Phase 3)
- Certificate generation (Phase 3)
- Reporting and exports (Phase 4)
- Public verification portal (Phase 5)

Phase 1 delivers: auth, users, roles, permissions, tenants, audit infrastructure.
