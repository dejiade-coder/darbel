# Darbel Frontend

Next.js 14 (App Router) + TypeScript + Tailwind + shadcn-style primitives.

Phase 1 frontend: login, MFA, password setup, dashboard shell, users / roles / audit / settings.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env to point at your backend
npm run dev
```

Frontend listens on port 3000. Backend is expected at `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000/api/v1`).

## Architectural decisions worth noting

### 1. Tokens live in HTTP-only cookies, never in JavaScript
- Access token: HTTP-only cookie `darbel_at`, max-age = JWT TTL
- Refresh token: HTTP-only cookie `darbel_rt`, max-age = 7 days
- Challenge token (during MFA / forced password change): HTTP-only cookie `darbel_ch`, max-age = 5 min

This means:
- XSS in the frontend cannot exfiltrate tokens. There is no `localStorage`, no `document.cookie` reads.
- All API calls go through **Server Actions** or **server-side fetches**, which add the `Authorization` header server-side using the cookie.
- The trade-off: no direct client-side `fetch()` to the backend from React components. That is intentional. The wins on security outweigh the indirection.

### 2. Auth gating is layered
- **Edge middleware** (`src/middleware.ts`): fast cookie-presence check, redirects anonymous users away from `/dashboard`.
- **Dashboard layout** (`src/app/dashboard/layout.tsx`): authoritative check — calls `/users/me` and redirects on 401.
- **Backend** (every API call): the real authorization happens here via JWT verification + `@Permissions` decorators + RLS policies.

The frontend's job is rendering, not authorization. The backend is the source of truth.

### 3. Token refresh is transparent and server-side
`apiFetch` in `src/lib/api/server-client.ts` automatically attempts a single silent refresh on 401, retries once, and only then surfaces the error. If the refresh fails, all auth cookies are cleared.

### 4. Permission-aware UI
The sidebar (`src/components/layout/sidebar.tsx`) reads permissions from the access-token claims and hides links the user cannot use. This is for UX — the backend still rejects unauthorized requests independently.

### 5. Design language
Restrained, institutional. Newsreader (display, serif) + IBM Plex Sans (body) + IBM Plex Mono (codes/IDs/dates). Deep teal accent against a parchment background. Tighter radii. No purple gradients, no shimmer effects, no playful illustrations. This is a compliance system.

## Pages delivered in Phase 1

| Route | Purpose | Auth |
|---|---|---|
| `/login` | Email + password sign-in | Public |
| `/mfa-challenge` | TOTP verification step | Challenge cookie |
| `/setup-password` | Forced first-login password change | Challenge cookie |
| `/dashboard` | Welcome + console cards + session info | Authenticated |
| `/dashboard/users` | Searchable, paginated user list | Authenticated + `user.view` |
| `/dashboard/roles` | System & tenant roles with permission breakdown | Authenticated + `role.view` |
| `/dashboard/audit` | Filterable audit log viewer | Authenticated + `audit.view` |
| `/dashboard/settings` | Profile, password change, MFA enrol/disable | Authenticated |

## Open items (carried into Phase 2)

1. **User invite flow.** `/dashboard/users/new` is referenced from the Users page but the form is not built — it will land in Phase 2 alongside the registration module which has similar form patterns.
2. **User detail page.** `/dashboard/users/[id]` is referenced but not built. Phase 2.
3. **Tenant switcher** for the Super Admin (Branddarrow). Currently each user belongs to one tenant and that is what they see. Cross-tenant impersonation for support is a Phase 2+ concern.
4. **i18n.** UI is English-only. The data model already supports per-jurisdiction settings; adding a translation layer is a future concern.
5. **Real branding.** Logo is a placeholder shield icon. Replace `ShieldCheck` lucide icon with the Darbel mark when delivered.

## Frontend file map

```
src/
├── app/
│   ├── layout.tsx                  Root layout, fonts
│   ├── globals.css                 Design tokens, base styles
│   ├── page.tsx                    Root redirect (login vs dashboard)
│   ├── login/                      Sign-in
│   ├── mfa-challenge/              MFA step
│   ├── setup-password/             Forced first-login change
│   └── dashboard/
│       ├── layout.tsx              Auth-gated shell
│       ├── page.tsx                Overview
│       ├── actions.ts              Logout
│       ├── users/page.tsx          List
│       ├── roles/page.tsx          Catalogue
│       ├── audit/page.tsx          Log viewer
│       └── settings/               Account management
├── components/
│   ├── ui/                         Buttons, inputs, cards, badges, alerts
│   └── layout/                     AuthShell, Sidebar, TopBar, PageHeader
├── lib/
│   ├── utils.ts                    cn(), date helpers
│   ├── api/
│   │   ├── server-client.ts        apiFetch with refresh-token rotation
│   │   └── types.ts                Response contracts
│   └── auth/
│       ├── session.ts              Cookie management
│       └── claims.ts               JWT claim reader (no verification)
├── middleware.ts                   Edge-level redirect gate
└── ...
```
