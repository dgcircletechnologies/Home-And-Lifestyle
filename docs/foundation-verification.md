> Historical foundation report. The later email activation/JWT phase is documented in [activation verification](activation-verification.md).

# Foundation verification — 17 November 2026

Initial Git status was clean. Read root instructions, project brief, existing source/configuration, domain schemas and schema audit. Next dev subsequently generated `frontend/AGENTS.md`; its bundled Next environment/authentication guidance was reviewed. No existing `.env` file was changed, no existing database was migrated, and no existing Docker volume was removed.

## Passed

- Backend: `npm run prisma:format`, `npm run prisma:validate`, `npm run typecheck`, `npm run lint`, `npm run build`.
- `TEST_DATABASE_URL=<isolated database> npm test`: 3 tests passed, including a comprehensive real HTTP integration test. Covered strict registration/privilege rejection, password hashing and safe responses, valid/invalid login, absent/invalid/expired sessions, customer/admin separation, current role changes, disabled/deleted identities, CSRF/CORS/preflight, rate limits, immediate logout revocation, hashed session persistence, and admin CLI repeatability/no promotion/no reset.
- All three migrations deployed to new ephemeral PostgreSQL **17.12**, loopback port 55439, database `foundation_test`. `prisma migrate diff --from-config-datasource --to-schema prisma --exit-code` reported no difference.
- Existing `npm run prisma:test` passed against another fresh database, `prisma_schema_test_foundation`. Historical catalogue data/constraints and commerce relations remained valid. Original migrations and catalogue helper were unchanged.
- Frontend: `NEXT_PUBLIC_API_URL=http://localhost:3001/api npm run typecheck`, `npm run lint`, and production `npm run build` with the same public URL passed.
- `npm test` in frontend: **5 Playwright tests passed**, using Chromium, actual frontend on port 3100, backend on 3101 and isolated PostgreSQL. Included real customer registration/login/reload/admin denial/logout, CLI-created administrator login and protected API data, initialization without protected content, 401 state clearing and 403 session preservation. Shared client tests covered URL normalization, safe return destinations, empty responses, multipart, validation errors, non-JSON server errors, cancellation and network errors.
- Live outage experiment: paused only the disposable PostgreSQL container; `/api/health/live` returned 200 and `/api/health/ready` returned 503. Unpausing restored readiness to 200 without restarting the backend.
- `docker compose config --quiet`, `git diff --check` passed.
- `npm audit --omit=dev` reported zero production dependency advisories in both apps. Installation reported moderate advisories in development tooling (9 backend, 7 frontend); no forced major upgrades were performed.

Intermediate checks caught test-tool setup issues (browser download still in progress, a Next route-announcer selector collision, and missing public URL during type generation). These were resolved and final runs above passed. No failing check is being reported as passed.

## Limits and operator actions

- The existing Compose PostgreSQL service was inspected read-only; its public schema listed no tables at inspection time. Its persistent volume and migration state were not changed. Review it and back it up before applying migrations; use the README workflow. Existing application containers need rebuilding to install the added dependencies. Docker configuration validated, but final images were not rebuilt or redeployed during this change.
- Tests ran locally over HTTP with development cookies. Real production HTTPS/domain/proxy infrastructure, secure-cookie browser behavior there, and multi-instance rate limiting have not been verified. Same-site frontend/API hosting is required; the current limiter is per process and proxy trust is off.
- Email ownership verification, recovery, profile linking, other staff permissions and all commerce workflows remain outside scope. No production administrator was created.
- Disposable test backend/database were stopped after verification. Existing project services and volumes were preserved.
