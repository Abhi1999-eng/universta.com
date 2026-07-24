# TASK_003 — Admin Login and Protected Shell Implementation Report

## Scope completed

Implemented the Super Admin admin login screen, explicit same-origin Next.js
authentication BFF, memory-only client authentication layer, protected
dashboard shell, responsive navigation, frontend unit tests, and real
Chromium browser E2E coverage. Countries, Courses, Leads, CMS, media, SEO,
CRUD, public/student authentication, and other business modules remain
deferred.

## Files changed

- `apps/admin/src/app/`: App Router login/protected routes, root redirect,
  provider wiring, branding/fonts, and security headers.
- `apps/admin/src/app/api/v1/admin/auth/`: the four explicit BFF handlers for
  login, refresh, logout, and `/me`.
- `apps/admin/src/features/auth/`: API envelope types, client auth state,
  single-flight refresh, `authFetch`, return-path validation, login UI, and
  lifecycle/unit tests.
- `apps/admin/src/features/shell/`: responsive shell, drawer behavior,
  disabled planned navigation, truthful dashboard content, and tests.
- `apps/admin/src/lib/server/auth-proxy.ts` and tests: server-only allowlisted
  proxy and safe response/cookie handling.
- `apps/admin/e2e/`, `playwright.config.ts`, `vitest.config.ts`, and test setup.
- `.github/workflows/ci.yml`, admin package files, lockfile, README, setup and
  architecture documentation, and this report.
- `docs/development/TASK_003_ADMIN_LOGIN_SHELL.md` records the pre-implementation
  scope, architecture, controls, test plan, and acceptance criteria.

## Dependencies

Added to the admin workspace:

- `server-only` for server-only BFF enforcement.
- `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`,
  `@testing-library/jest-dom`, and `@testing-library/user-event`.
- `@playwright/test` for Chromium browser E2E.

The admin workspace React runtime is aligned to the existing installed React
19 line for a single React renderer in tests. Node.js and MySQL versions were
not changed.

## Routes

Admin UI routes:

- `/` → `/dashboard`
- `/login`
- `/dashboard`

Same-origin BFF routes:

- `POST /api/v1/admin/auth/login`
- `POST /api/v1/admin/auth/refresh`
- `POST /api/v1/admin/auth/logout`
- `GET /api/v1/admin/auth/me`

The browser calls only these same-origin BFF paths. No unrestricted reverse
proxy or direct browser-to-NestJS auth request is used.

## BFF design and cookie relay

The server-only helper uses `API_BASE_URL`, `ADMIN_APP_ORIGIN`, a five-second
upstream timeout, `cache: no-store`, bounded login JSON, allowlisted headers,
safe request IDs, and exact upstream paths. Login, refresh, and logout require
`x-universta-admin-client: web`; an Origin header, when supplied, must match
`ADMIN_APP_ORIGIN`.

Only the configured refresh cookie is forwarded for refresh/logout, and only a
Bearer authorization header is forwarded to `/me`. Host, Connection,
Content-Length, arbitrary cookies, arbitrary paths, and arbitrary client
headers are not forwarded. Backend status, safe envelopes, request IDs,
Cache-Control, and all Set-Cookie headers are relayed. Invalid upstream JSON or
network failures become a safe HTTP 502 `AUTH_SERVICE_UNAVAILABLE` envelope.

The backend HttpOnly, SameSite, Secure, Path, and expiry cookie attributes are
preserved without exposing the refresh value to JavaScript or JSON.

## Client auth state and token policy

`AuthProvider` exposes `initializing`, `authenticated`, and `unauthenticated`.
Initial load performs same-origin refresh followed by `/me`; refresh and `/me`
failures clear state and protected views redirect to login. The access token is
held only in module memory and React state. It is not persisted in local or
session storage, IndexedDB, cookies, URLs, server component props, rendered
HTML, logs, traces, or screenshots.

`authFetch` attaches the current bearer token, shares one refresh promise for
concurrent 401s, retries the original request once, and redirects safely to
login if refresh fails. The backend remains the source of authorization truth.

## Login and dashboard behavior

The login page has Universta branding, Super Admin context, accessible labels,
email/password autocomplete, password visibility toggle, client validation,
focus management, pending/disabled submission state, Enter submission, live
generic errors, and no credential hints or unsupported links. Email is
trimmed/lowercased; passwords are not trimmed.

The dashboard shell provides a skip link, semantic navigation, persistent
desktop sidebar, mobile drawer, top header, account email, SUPER_ADMIN role,
logout, and a truthful empty workspace. Countries, Courses, Leads, Content,
Media, SEO, and Settings are disabled buttons labelled Soon rather than links.
No invented metrics are shown.

Mobile navigation is closed by default, traps focus, closes on Escape,
backdrop click, close action, and navigation, manages body scroll, and restores
focus to the menu trigger.

## Security headers and accessibility

The admin Next config sets `X-Content-Type-Options: nosniff`, strict
`Referrer-Policy`, restrictive `Permissions-Policy`, and `X-Frame-Options:
DENY`. Authentication responses use `Cache-Control: no-store`. A deployment
specific CSP/nonces policy is documented as future hardening rather than
adding a potentially broken policy.

Semantic landmarks, visible labels, live regions, focus-visible controls,
keyboard Escape handling, skip navigation, dialog semantics, disabled states,
and responsive touch targets are covered in the UI and tests.

## Tests and verification

- Admin unit tests: 6 suites, 37 tests passed.
- Admin Playwright Chromium E2E: 3 tests passed against real API/admin
  servers and the seeded local Super Admin without printing credentials.
- Browser coverage includes dashboard redirect, valid login, authenticated
  email/role, HttpOnly cookie, reload refresh, storage token absence, logout,
  post-logout protection, generic invalid login, mobile drawer, no-store BFF
  responses, request IDs, and no console/request failures in the happy path.
- Existing API unit and E2E suites remain part of the root and CI gates.

Final CI status is recorded in the task handoff after the branch workflow
completes.

## Schema, migration, and prohibited-scope confirmation

No Prisma schema or migration changed. The approved
`design/reference/final-countries-list.html` remains unchanged. No Docker
files, real credentials, seeded passwords, access/refresh tokens, Playwright
traces, or screenshots are tracked. No Countries, Courses, Leads, CMS, media,
SEO, or CRUD implementation was added.

## Audit and known limitations

`npm audit` and `npm audit --omit=dev` are rerun for this task and recorded in
`docs/DEPENDENCY_AUDIT.md`. Existing framework/tooling findings remain under
review; `npm audit fix --force` is not used. Playwright test credentials are
CI/local-only environment values and are unavailable to the browser bundle.

The admin BFF intentionally supports only the four auth routes. Business API
proxying, authenticated admin data fetching, Countries UI/CRUD, and all other
business modules are deferred to later tasks. TASK_004 is not started.
