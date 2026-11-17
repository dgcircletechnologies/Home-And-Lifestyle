# Home & Lifestyle

Next.js 16 / React 19, NestJS 12, PostgreSQL 17, Prisma 7, Node 24.13.0 and npm. Customer registration, email activation, JWT login, refresh and explicit CUSTOMER/ADMIN access are implemented. Commerce schemas are preserved; commerce workflows remain outside this phase.

## One configuration source

All settings live in root `.env`. Copy `.env.example` only if `.env` does not already exist; preserve existing secrets. The backend and Prisma load it from source and compiled entry points. Explicit process variables take precedence. The frontend loads only `FRONTEND_PORT` and `NEXT_PUBLIC_API_URL`, never SMTP/database/admin/JWT secrets. Next determines its own development/production mode.

Generate a **new** JWT secret only for a new environment, then place it in root `.env` (never commit it):

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

| Setting | Purpose/default |
| --- | --- |
| `FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT` | 5007, 9007, 5437 |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | PostgreSQL service credentials/database |
| `DATABASE_URL` | Host Prisma/backend connection at localhost:5437; URL-encode credentials |
| `DOCKER_DATABASE_URL` | Same database/credentials at postgres:5432 inside Compose |
| `NODE_ENV` | Backend development/test/production |
| `NEXT_PUBLIC_API_URL` | Public browser API URL, http://localhost:9007/api; embedded during frontend build |
| `CORS_ORIGINS` | Exact frontend origins, comma-separated, no trailing slashes; localhost:5007 locally; HTTPS in production |
| `FRONTEND_URL` | Trusted activation-link origin, http://localhost:5007; HTTPS in production |
| `JWT_SECRET` | Required random hex secret, at least 32 bytes; no fallback |
| `JWT_ISSUER`, `JWT_AUDIENCE` | Required issuer and audience identifiers |
| `JWT_ACCESS_SECONDS` | 900 (15 minutes), maximum 3600 |
| `REFRESH_DAYS` | 7, absolute session expiry, maximum 30 |
| `ACTIVATION_HOURS` | 24, maximum 168 |
| `RESEND_COOLDOWN_SECONDS`, `RESEND_HOURLY_LIMIT` | 60 seconds and 5 activation emails/hour/address, including initial signup |
| `LOGIN_ACCOUNT_LIMIT` | 10 attempts/address/15 minutes with backoff after 5; stored in PostgreSQL |
| `AUTH_IP_LIMIT` | 60 auth mutations/IP/15 minutes, per process |
| `STORE_NAME`, `MAIL_FROM` | Email branding and valid sender address |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Host SMTP transport, locally localhost:1027 / false; true means implicit TLS |
| `SMTP_USER`, `SMTP_PASSWORD` | Optional together for authenticated SMTP; server-only |
| `DOCKER_SMTP_HOST`, `DOCKER_SMTP_PORT` | SMTP inside Docker; mailpit:1025 locally; set to provider host/port for real delivery |
| `MAILPIT_SMTP_PORT`, `MAILPIT_UI_PORT` | Local sandbox ports 1027 and 8027 |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`, `ADMIN_CONFIRM_VERIFIED` | One-time trusted CLI inputs; never browser variables |

Backend startup validates auth configuration. Production SMTP requires TLS (STARTTLS if not implicit TLS). Real provider delivery also requires a sender/domain approved by your provider. No activation-link logging fallback exists. No production email credentials were configured by this task.

## Local Docker startup

```sh
docker compose config --quiet
docker compose up -d postgres mailpit
docker compose build backend frontend
# Read-only migration inspection:
docker compose run --rm backend npx prisma migrate status
# On your confirmed development database, after reviewing migrations:
docker compose run --rm backend npx prisma migrate deploy
docker compose up -d backend frontend
```

Mailpit has a `mail` profile and starts when explicitly named. It is a local sandbox, not a production mail relay. Its unauthenticated SMTP/UI ports bind only to loopback. Do not expose it publicly. The example sender is a `.test` address for this inbox only.

- Store: http://localhost:5007
- Backend readiness: http://localhost:9007/api/health/ready
- Test inbox: http://localhost:8027

Never reset an existing database or remove its volume. Review `_prisma_migrations`, back up data and reconcile drift before applying migrations. The new activation migration refuses canonical email collisions; resolve any conflicts explicitly rather than merging accounts. It preserves records, adds verification/refresh/throttle storage, leaves existing accounts unverified and revokes legacy opaque sessions. See [schema notes](backend/prisma/README.md).

For host development, run `npm ci` in each app; start only PostgreSQL/Mailpit via Compose, then run `npm run dev` from backend and frontend in separate terminals. Both load root settings; Prisma works directly from `backend/`. Do not simultaneously run host apps and Docker apps on the same ports. Docker images are development/watch images, not production manifests.

## Verify the customer flow

1. Open `/register`, enter full name, email and a unique 15–128-character password, then confirm it. No phone or address is required.
2. The generic acknowledgement offers resend. Registration creates **no session**.
3. Try `/login` before activation: a correct password yields “Please verify your email before signing in.” A wrong password always yields “Email or password is incorrect.”
4. Open the email in Mailpit. Its link uses `/activate#token=…`; opening it alone changes nothing. The page removes the fragment from visible history and requires an explicit **Verify email** POST, protecting links from mail scanners/prefetchers. It uses `Referrer-Policy: no-referrer`, has no third-party analytics, and holds the secret only in temporary memory.
5. After verification, select Sign in. Activation never logs in automatically. You can activate in another browser/device.
6. Sign in, visit `/account`, reload, and try `/admin` as a customer (denied). Logout clears local auth, notifies other tabs and immediately revokes the server session. Other devices remain signed in.
7. Used/expired/invalid links offer resend. Resend uses generic responses, server-enforced limits and a frontend countdown; use the latest email. A duplicate registration never changes the existing account or invalidates its link.

Password policy supports spaces, Unicode, paste and password managers without composition rules or trimming. The limit is 15–128 Unicode code points. New hashes use Argon2id (64 MiB, time cost 3, parallelism 1); legacy scrypt hashes (N=32768, r=8, p=1) are accepted and upgraded only after an eligible successful login. HIBP Pwned Passwords range checks disclose only the first five SHA-1 hex characters with response padding, not the password/full hash. The SHA-1 is only for lookup, not storage. Password-check outages fail closed with a retryable 503; there is no bypass environment flag.

Email uses trimmed original spelling for display/delivery and a trimmed, lowercase whole-address key for lookup/uniqueness. Dots and plus suffixes are preserved. The migration inspects conflicts before normalizing existing keys; historical casing already discarded by the foundation cannot be recovered. No existing commerce profile is automatically attached to a new identity.

## Sessions, permissions and delivery

Access JWTs use explicit HS256, issuer, audience, subject, session ID, random jti, issued/expiry times and `at+jwt`/access purpose. Verification rejects wrong algorithms, purpose, issuer, audience and malformed/expired claims. Tokens contain no private profile data. Browser access tokens live only in memory and travel as Bearer headers; there is no localStorage/sessionStorage token persistence.

The opaque refresh credential has 32 random bytes and is stored only as a digest in PostgreSQL, with historical consumed hashes retained for reuse detection. The HttpOnly cookie is host-only, SameSite=Lax, Path=/api/auth, Secure in production (`__Secure-hl_refresh`; `hl_refresh` locally). Frontend/API must share the same site with HTTPS in production. Refresh rotation is atomic and never extends the original absolute expiry. A consumed credential used within five seconds yields 409 with **no credentials**; older reuse revokes the family. This short overlap is a deliberate concurrency tolerance. Web Locks serialize refresh/login/logout across tabs, with a single promise in each tab and BroadcastChannel logout notifications. Browsers without Web Locks use in-tab serialization and one retry on a rotation conflict; they have weaker cross-tab coordination and should be validated before support is promised.

Page reload refreshes once then loads `/auth/me`. A protected request rejected by the access guard with `ACCESS_INVALID` may refresh and retry once; business/network failures are never blindly replayed. Logout invalidates in-flight frontend results before waiting for the session lock and revokes the current family using the latest cookie. An old JWT immediately fails server session checks; no logout-all is provided. If the logout network request fails, local state remains cleared and the UI reports that server sign-out failed—retry it before treating server revocation as confirmed.

Every protected request loads the current user/session. Unverified, disabled/deleted, expired or revoked credentials are denied. CUSTOMER and ADMIN routes require explicit roles; ADMIN does not inherit CUSTOMER permissions. Account data is resolved from authenticated identity, not a client-provided user ID. No public admin creation or hidden email bypass exists.

Activation records bind digest, user, canonical email, purpose, creation/expiry and consumed/revoked state. Verification consumes exactly once, invalidates remaining links and never unblocks an account. Resend serializes per user and invalidates previous outstanding links atomically. Email calls run **after** the database transaction. SMTP gets three bounded attempts with sanitized failure logging. Failure preserves the pending account for resend and never claims confirmed delivery. There was no existing durable queue; delivery here is synchronous and bounded. A process crash after commit may lose the attempt; resend recovers it. Raw links exist transiently in request/mail memory, not token tables or an unencrypted outbox.

CORS uses an explicit allowlist. All auth mutations require an allowed Origin **and** `X-CSRF-Protection: 1`, including refresh, logout and login. Helmet, 16 KiB JSON limits, strict schemas, no-store responses and safe errors remain enabled. Proxy trust is off and IP limiting is process-local; production proxy topology/shared rate storage need deployment-specific configuration. Periodically remove expired sessions (cascades refresh history), expired/revoked activation records older than their retention window, and stale throttle rows. Expiry checks do not depend on cleanup.

## API contract

All endpoints use `/api`. No ORM objects or raw refresh/activation credentials are returned. Errors are `{ error: { status, code, message, fields? } }`.

| Endpoint | Request | Response/access |
| --- | --- | --- |
| `POST /auth/register` | `{ name, email, password }` | 202 generic `{ message, resendAfterSeconds }`; public, no cookie/token |
| `POST /auth/verify-email` | `{ token }` | 200 `{ message }`; public single use, no session |
| `POST /auth/resend-activation` | `{ email }` | 202 generic acknowledgement; public |
| `POST /auth/login` | `{ email, password }` | 200 `{ user, accessToken, expiresIn }` plus refresh cookie |
| `POST /auth/refresh` | Empty body; refresh cookie | Same safe login response and rotated cookie |
| `GET /auth/me` | Bearer access JWT | `{ id, name, email, role, emailVerifiedAt }`; CUSTOMER/ADMIN |
| `POST /auth/logout` | Empty body; refresh cookie | Idempotent 204, family revocation, matching cookie clear |
| `GET /account` / `GET /admin` | Bearer access JWT | Own safe identity; CUSTOMER / ADMIN respectively |
| `GET /health/live` / `GET /health/ready` | None | Public 200; readiness 503 if required DB tables unavailable |

Relevant codes: `VALIDATION_ERROR`/`PASSWORD_COMPROMISED`/`ACTIVATION_INVALID` (400), `INVALID_CREDENTIALS`/`ACCESS_INVALID`/`REFRESH_INVALID` (401), `EMAIL_NOT_VERIFIED`/`ACCOUNT_UNAVAILABLE` (403), `REFRESH_CONFLICT` (409), `LOGIN_THROTTLED` (429), `PASSWORD_CHECK_UNAVAILABLE` (503). Generic 403 permissions/CSRF and IP-limit 429 responses use the shared safe error convention. Password confirmation exists only in the frontend.

## Trusted administrator provisioning

```sh
cd backend
npm run build
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -p 'Admin name: ' ADMIN_NAME
read -r -s -p 'Admin password: ' ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
# Set only after the operator has independently confirmed ownership of the address:
export ADMIN_CONFIRM_VERIFIED=true
npm run admin:create
unset ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD ADMIN_CONFIRM_VERIFIED
```

New administrators are explicitly marked verified by this trusted operator action. An existing active ADMIN is unchanged if already verified; an unverified ADMIN is marked verified only with the explicit confirmation flag, without changing its password. Existing customers, conflicting commerce profiles, disabled/deleted admins are rejected; no silent promotion or reset. For Docker, pass these four variables via `docker compose run --rm -e ... backend ...` after exporting them. No production admin is created automatically. Recovery/social sign-in/MFA are out of scope.

## Checks

```sh
# backend/
npm run prisma:validate
npm run typecheck
npm run lint
npm test
# Against a separate NEW empty loopback database named auth_upgrade_test_*:
# TEST_DATABASE_URL=<isolated URL> npm run prisma:test:auth
# frontend/
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm test
```

Backend HTTP tests require `TEST_DATABASE_URL` pointing to a migrated isolated loopback database named `foundation_test*`; without it, DB integration is explicitly skipped. SMTP integration expects a local test Mailpit on SMTP 1028 / UI 8028 and `SMTP_PORT=1028`. Fixtures use random identities and remain for inspection. The test process mocks only the password range lookup for deterministic API tests; password-policy tests separately exercise range/rejection/failure behavior.

Browser tests start Next on 3100. Run the backend separately on 3101 against the disposable database with `CORS_ORIGINS` and `FRONTEND_URL` set to http://localhost:3100, SMTP port 1028. The real browser flow uses the live HIBP lookup and the local SMTP inbox. Provision a test admin with the CLI and pass `TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD` to Playwright. Browser test credentials never enter frontend bundles. Do not use a real customer database or real delivery provider for tests. See [activation verification report](docs/activation-verification.md) for actual results and limitations.

Design references: [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [email verification](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html), [password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [JWT best practices, RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html), and [HIBP range API](https://haveibeenpwned.com/API/v3#PwnedPasswords).
