# TASK_003 — Admin Login and Protected Shell

## Scope

TASK_003 adds the admin login experience, a same-origin Next.js authentication
BFF, in-memory client authentication state, protected dashboard routing, and a
responsive admin shell. It does not add Countries, Courses, Leads, CMS, media,
SEO, CRUD, public/student authentication, or any other business module.

## Route structure

- `/` redirects to `/dashboard`.
- `/login` is the public Super Admin sign-in page.
- `/dashboard` is protected by the client authentication boundary.
- `/api/v1/admin/auth/login`, `/refresh`, `/logout`, and `/me` are explicit
  same-origin Next.js Route Handlers.

The API routes live below `src/app/api/v1/admin/auth/`; protected UI uses an
App Router route group and a client-side protected boundary so no sensitive
dashboard content is server-rendered before authentication is confirmed.

## BFF design

The browser calls only same-origin admin routes. Each approved Route Handler
forwards to the matching NestJS endpoint using server-only `API_BASE_URL`,
allowlisted headers, bounded JSON parsing, an upstream timeout, safe envelope
handling, and a safe request ID. The BFF is not a general reverse proxy.
`ADMIN_APP_ORIGIN` is validated when an Origin header is present, and browser
POST requests require `x-universta-admin-client: web`.

The BFF relays backend status, safe JSON envelopes, request IDs, cache-control,
and all backend Set-Cookie headers. It never returns upstream stack traces,
request bodies, passwords, tokens, cookie values, or the server-only API URL.
Upstream failures become `AUTH_SERVICE_UNAVAILABLE` with HTTP 502.

## Authentication state lifecycle

The client auth provider exposes `initializing`, `authenticated`, and
`unauthenticated`. On initial load it calls same-origin refresh, then `/me`,
and stores the access token and authenticated user only in memory. A failed
refresh or `/me` call clears the session and sends protected views to login.
Logout clears state even if the BFF is unavailable and prevents the shell from
remaining visually authenticated.

## Access-token storage policy

The access token exists only in a module-level in-memory auth store and React
state. It is not written to localStorage, sessionStorage, IndexedDB, cookies,
URLs, server component props, rendered HTML, logs, screenshots, or traces.

## Refresh-cookie handling

The NestJS HttpOnly refresh cookie is sent by the browser to same-origin BFF
refresh/logout handlers and is forwarded server-to-server only where required.
The BFF relays its security attributes and never reads or exposes the value to
client JavaScript. Login and refresh relay rotated cookies; logout relays the
backend clearing cookie.

## Route-protection model

`AuthProvider` owns session initialization and a protected boundary controls
the dashboard shell. Initializing renders an accessible loading page,
authenticated renders the shell, and unauthenticated navigates to
`/login?returnTo=...`. Return paths are restricted to internal absolute paths,
reject `/login`, encoded/external/protocol-relative URLs, and are normalized
to `/dashboard` when unsafe. No unsigned login cookie or proxy-only security
boundary is used; future API data remains bearer-authorized by NestJS.

## Login UX

The login screen presents Universta branding, Super Admin context, labelled
email/password fields, password visibility control, browser-compatible
autocomplete, client validation, generic safe errors, a pending state, and
accessible live feedback. Email is trimmed/lowercased and passwords are never
trimmed. No sign-up, forgot-password, default credentials, social login, or
unsupported claims are shown.

## Dashboard shell

The protected shell contains a skip link, persistent desktop sidebar, active
Dashboard navigation, top header, authenticated user/role display, logout,
mobile navigation, and an empty foundation workspace. Future Countries,
Courses, Leads, Content, Media, SEO, and Settings items are disabled buttons,
not links, and are labelled as planned/Soon. No invented operational metrics
are shown.

## Responsive behavior

The desktop sidebar remains visible. At mobile/tablet widths the navigation is
closed by default and opens as an accessible dialog-style drawer. Escape,
backdrop click, route navigation, and the close button dismiss it; focus is
trapped while open, body scrolling is managed, and focus returns to the menu
trigger. Layouts avoid horizontal overflow and controls remain touch-friendly.

## Accessibility

Semantic `nav`, `aside`, `header`, `main`, labels, buttons, focus-visible
styles, live regions, dialog semantics, keyboard Escape handling, skip
navigation, and disabled-state announcements are included. Color contrast and
responsive spacing follow the existing Universta palette.

## Security controls

Server-only BFF configuration, same-origin requests, allowlisted proxy paths
and headers, Origin/client-header validation, no-store responses, bounded
login bodies, timeout handling, request IDs, cookie relay, memory-only access
tokens, generic errors, no raw upstream errors, and admin security headers are
implemented. CSP/nonces remain a deployment-hardening task because a safe
policy requires deployment-specific asset and font decisions.

## Test plan

- Vitest/Testing Library tests cover login validation and UX, auth lifecycle,
  memory-only token behavior, refresh single-flight/authFetch, redirect safety,
  protected rendering, logout, and responsive navigation.
- BFF handler tests cover allowlisted forwarding, cookie relay, safe errors,
  request IDs, no-store, Origin/client-header rejection, and sensitive-data
  redaction.
- Playwright Chromium tests run against the real API and admin servers with
  CI-only seeded credentials. They cover login, refresh-cookie persistence,
  reload, logout, unauthenticated protection, generic invalid login, storage
  checks, and mobile navigation. Credentials are not logged or captured.

## Acceptance criteria

- The browser uses only the four same-origin BFF auth paths.
- Access tokens remain memory-only and refresh cookies remain HttpOnly.
- `/dashboard` is protected and `/login` handles safe return paths.
- Login, refresh, `/me`, logout, errors, loading, and expiry have safe UX.
- Desktop and mobile shells are accessible and contain no business modules.
- Admin unit and browser E2E tests, existing API tests, lint, build, and CI pass.
- Prisma schema/migrations and the approved Countries Listing HTML are unchanged.
- No credentials, tokens, traces, screenshots, Docker files, or business CRUD
  implementation are committed.

## Explicitly prohibited scope

Countries CRUD, Courses, Leads, CMS, media management, SEO modules, public or
student authentication, student dashboards, business APIs, schema changes,
migrations, Docker, Node/MySQL version changes, generic proxying, fake metrics,
and TASK_004 are outside this task.
