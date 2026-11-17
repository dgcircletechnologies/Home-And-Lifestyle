# Email activation and JWT verification — 17 November 2026

The working tree already contained the completed foundation and root-environment changes. Those changes were extended in place. No commerce endpoint, unrelated schema rewrite, framework change, account deletion, database reset or default administrator was introduced.

## Delivered

- `backend/src/auth/`: strict contracts, Argon2id with legacy scrypt verification/upgrade, HIBP prefix-based password screening, SMTP HTML/plain-text email, activation/resend, explicit JWT validation, database-backed refresh rotation/reuse detection, account backoff and current-state authorization.
- `backend/src/admin-bootstrap.ts`: explicit trusted operator email-verification confirmation; no public admin route, silent promotion or password reset.
- `backend/prisma/auth/user.prisma` and `20261117010000_email_activation_jwt`: verification state/display email, activation records, revocation/refresh history and account throttle storage. Existing canonical email uniqueness is preserved and reinforced; conflicts stop migration.
- `frontend/src/features/auth/`, `src/lib/api.ts`, new `/activate` and `/check-email` routes: registration confirmation, resend countdown, fragment capture/removal, explicit verification POST, memory-only access tokens, renewal, safe redirects, role guards and cross-tab logout/refresh coordination.
- Root `.env` / `.env.example`, Compose and README: server-only JWT/SMTP settings, local Mailpit, trusted frontend URL, policy and API contracts. Existing secrets were preserved; a new random local JWT signing secret was added only because none existed.

## Executed checks

- Backend format, Prisma validate/generate, type-check, lint and build passed.
- Backend test runner: **14 passed, zero failed/skipped** with an isolated PostgreSQL 17.12 database `foundation_test_activation` and Mailpit v1.27.8.
- Tested unverified CUSTOMER signup without session/cookie/secret response, unexpected-field rejection, salted Argon2id, canonical duplicates under concurrency, no credential overwrite, strict pre-verification login behavior, atomic parallel activation, repeat/expired/revoked/old-email/disabled/deleted token rejection, resend cooldown/hourly/concurrent limits and blocked-account suppression.
- Tested access claims, tampered/unsigned/wrong-algorithm/wrong-purpose/wrong-audience/wrong-issuer/expired credentials, activation/refresh token substitution, explicit CUSTOMER/ADMIN permissions, current role/status enforcement, absolute refresh expiry, atomic rotation, short overlap conflicts, older reuse revocation, logout with refresh cookie or valid access JWT, repeat logout and other-device preservation.
- Tested CSRF, allowed/disallowed CORS, preflight, no-store, per-address login throttling and per-IP limits. SMTP tests checked trusted fragment links, escaped names, safe delivery failure, preserved pending accounts and successful subsequent resend.
- Live HIBP range lookup passed. Deterministic backend tests mock that lookup but separately test the real range-request construction, compromised rejection and failure-closed behavior. Browser registration and CLI admin creation used the live range service.
- Frontend lint, type-check and production build passed. **5 Playwright tests passed** using Chromium and the real isolated API/SMTP inbox, including: signup → inspect mail → opening without activation → rejected login → explicit activation in a separate browser context → login → account → reload → customer admin denial → access-guard renewal → multi-tab reload → logout racing a delayed refresh. Admin login used an explicitly verified CLI-created administrator.
- Reopening a link on the same page initially exposed a hash-navigation edge case; fixed and retested. An early refresh-count assertion also needed to account for React Strict Mode's aborted requests. Final browser runs passed.
- Local production-shaped registration page was inspected at 390px width: accessible fields visible and no horizontal overflow; screenshot inspected.
- `npm run prisma:test:auth` passed on a separate empty `auth_upgrade_test_activation` database: canonical collisions refuse migration without deleting data; legacy display address/password/role preserved; existing users remain unverified; old sessions revoked.
- Existing `npm run prisma:test` passed on a separate empty `prisma_schema_test_activation` database, preserving catalogue and commerce contracts.
- All migrations deployed in the disposable database, then Prisma database-to-schema diff reported **no difference**. SQL-only checks were also exercised by the migration tests.
- The existing local development database was inspected read-only first: zero users and zero canonical conflict groups. A restricted backup was saved at `/tmp/hl-before-email-activation.dump` before applying the additive migration. Host and Docker Prisma status subsequently reported **up to date**. No volume was reset or removed.
- Docker images rebuilt; frontend, backend and local Mailpit restarted. Registration page, readiness and inbox returned HTTP 200 on ports 5007, 9007 and 8027. Compose config and `git diff --check` passed.
- Backend production dependency audit reported zero advisories. Existing development-tooling moderate advisories were not addressed by unrelated forced upgrades.

## Limits and explicit design choices

- **External mailbox delivery is unverified.** SMTP delivery to the local inbox is verified. Configure a real provider/sender in root `.env` before expecting public email delivery.
- Production HTTPS/Secure-cookie/proxy deployment is not exercised locally. Same-site frontend/API hosting is required. Per-IP limiting is currently per process with proxy trust disabled; database account/resend limits are shared.
- Refresh overlap: consumed credentials within five seconds receive 409 and no tokens, allowing coordinated concurrent browsers to recover; older replay revokes the family. Web Locks and BroadcastChannel were tested in Chromium. Older browsers without Web Locks have only in-tab locking and a bounded conflict retry.
- SMTP delivery is synchronous with three bounded attempts, outside transactions. There was no existing durable queue. Process failure between commit and delivery can lose that attempt; resend recovers pending accounts. No raw-token outbox was introduced.
- Existing accounts are not silently verified. Trusted admin provisioning requires `ADMIN_CONFIRM_VERIFIED=true` after out-of-band ownership confirmation. No production admin was created.
- Password recovery, social sign-in, MFA, automatic commerce-profile linking and all commerce modules remain out of scope.
- Disposable API/database/inbox services were stopped after verification. Normal development services remain available. The backup is retained; temporary test credentials were removed.

Follow the root README for environment variables, endpoint bodies/error codes/cookies, migration/admin commands and the exact local customer verification sequence.
