# Home & Lifestyle Décor

Local development foundation: independent Next.js and NestJS TypeScript projects, PostgreSQL, and Prisma. The storefront is only a smoke-test page. No business models, migrations, admin, authentication, uploads, checkout or production deployment are included. The existing requirements document is preserved.

## Tools and versions

- Docker Engine/Desktop and Docker Compose v2 or later (verified with Engine 29.9.3 / Compose 5.7.0).
- Both Dockerfiles pin **Node.js 24.13.0 LTS**, Debian bookworm slim. Host checks use Node 24.13.0 and npm 11.6.2; `.nvmrc` records Node.
- Next.js **16.4.6**, React **19.3.1**, NestJS **12.5.0**, TypeScript **5.9.3**. Nest CLI **11.0.24** is retained for compatibility with this Node patch.
- Prisma CLI, client and PostgreSQL adapter **7.10.1**. The backend image includes OpenSSL for Prisma and `procps` for Nest watch-mode process cleanup.
- Official PostgreSQL **17.12**, bookworm image pinned by tag and digest in Compose.

Each app has its own `package.json` and `package-lock.json`. No root npm workspace is used. TypeScript is strict in both apps.

## Start and stop

From the project root, on first setup:

```sh
cp .env.example .env
docker compose config --quiet
docker compose config --services
docker compose up --build -d --wait --wait-timeout 180
```

Keep an existing `.env` instead of overwriting it. The service list must contain `frontend`, `backend`, and `postgres`. No host npm install is needed for Docker: images run `npm ci`.

```sh
docker compose logs -f frontend backend postgres
docker compose ps
curl -i http://localhost:3001/api/health
curl -f http://localhost:3000/
docker compose down
```

Defaults:

| Service | Host URL | Container address |
| --- | --- | --- |
| Frontend | http://localhost:3000 | frontend:3000 |
| Backend health | http://localhost:3001/api/health | backend:3001/api/health |
| PostgreSQL | Not published | postgres:5432 |

Change `FRONTEND_PORT` and `BACKEND_PORT` in `.env` if host ports are occupied. Host ports bind only to `127.0.0.1`; changing them does not change internal ports or URLs.

The backend health response is HTTP **200** with `{"status":"ok","database":"up"}` after a Prisma `SELECT 1`. An unavailable database returns HTTP **503** with `{"status":"unavailable","database":"down"}`. The response deadline is 2.5 seconds, with driver connection/query/statement timeouts of 1.5 seconds. Temporary database outages recover through the connection pool without a backend restart.

The home page fetches health on the server for each request, with caching disabled and a 3.5-second fetch timeout. It shows either `API connection: connected · Database: up` or an unavailable message. The page still returns HTTP 200 during outages. Production builds do not fetch the API.

## Networking and credentials

Compose DNS resolves service names inside containers. NestJS connects to `postgres:5432` using `DATABASE_URL`; Next.js uses server-only `API_INTERNAL_URL=http://backend:3001`. Browsers cannot resolve those hostnames and never make this request directly. No database password or URL is supplied to the frontend, and no `NEXT_PUBLIC_*` setting is needed.

Root `.env` is read by Compose, not baked into either image. Its example credentials are for local development only. Keep `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and the corresponding fields in `DATABASE_URL` synchronized. URL-encode reserved characters in URL credentials (for example, `@` becomes `%40`); use the original unencoded password for `POSTGRES_PASSWORD`. Keep host `postgres` and port `5432` in the Compose URL. Quote values containing `$` with single quotes in `.env` to prevent interpolation.

PostgreSQL initialization variables apply only when its volume is empty. Changing `.env` does not change credentials in an existing database. Use that volume's existing credentials or deliberately administer them through PostgreSQL; do not delete data to resolve a credential mismatch. Backend startup validates required configuration and prints fixed diagnostic messages without echoing credentials.

## Database and Prisma workflow

Open a database shell (the single quotes defer variable expansion to the container):

```sh
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Run `SELECT 1;` and exit with `\q`.

Prisma schema: `backend/prisma/schema.prisma`; CLI configuration: `backend/prisma.config.ts`; reusable Nest provider: `backend/src/prisma.service.ts`. No tables or migrations are needed for this phase. Commit the first business migration with the first persisted feature.

After changing the schema:

```sh
docker compose exec backend npm run prisma:validate
docker compose exec backend npm run prisma:generate
```

Client generation also runs during backend image builds and before development/build/type-check commands. Generated TypeScript lives in ignored `backend/generated/prisma`, outside the `/app/src` mount. Nest compiles it with the application; host production entrypoint is `backend/dist/src/main.js`. The provider disconnects when Nest shuts down.

Both services mount only source folders (the backend also mounts its schema). Container dependencies and generated output remain separate from host files. Source edits reload automatically. After changing a lockfile, package manifest, Dockerfile or other non-mounted configuration:

```sh
docker compose up --build -d --wait --wait-timeout 180
```

The changed manifests invalidate Docker's `npm ci` layer; replacing containers installs the new image's dependencies without a stale dependency volume.

## Persistence

The named `postgres_data` volume uses `/var/lib/postgresql/data`, appropriate for PostgreSQL 17. It survives `docker compose down` and container replacement. Normal startup/shutdown never deletes it.

Only for an intentional deletion of this project's local database:

```sh
docker compose down --volumes
```

Do not use this command in the normal workflow or to fix a configuration error.

## Host static checks

No API or database is needed for these checks:

```sh
(cd frontend && npm ci && npm run lint && npm run typecheck && npm run build)
(cd backend && npm ci && npm run prisma:validate && npm run prisma:generate && npm run lint && npm run typecheck && npm run build)
```

For host-only frontend development, set `API_INTERNAL_URL=http://localhost:3001` when running `npm run dev` in `frontend`. The backend can load a private `backend/.env` with `DATABASE_URL` and optional `PORT` (default 3001). PostgreSQL is intentionally not published by the default Compose configuration; host backend development requires an explicitly configured reachable database. Docker is the documented full-stack workflow.

## Verification and limits

Outage, persistence and reload checks use a separate Compose project and disposable database volume, never the existing project's database:

```sh
FRONTEND_PORT=3100 BACKEND_PORT=3101 docker compose -p decor-foundation-test up --build -d --wait --wait-timeout 180
```

Use that project name and the same port overrides for all subsequent test commands. Stop/start only its `postgres` service to test outage/recovery. For persistence, create a temporary marker table in the test database, recreate its PostgreSQL container without removing the volume, verify the marker, then drop the table. Temporary source edits must be restored after reload checks. To remove only the disposable test stack and data:

```sh
FRONTEND_PORT=3100 BACKEND_PORT=3101 docker compose -p decor-foundation-test down --volumes
```

There is no Git repository metadata in this directory, so Git status/diff checks are unavailable; files can still be reviewed directly. npm reports upstream development-tool dependency advisories; dependency security upgrades are not included in this foundation. These images and example credentials are for local development.

Reference: [Prisma 7 connection pool configuration](https://docs.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool).

Verified locally: both lockfile installs, lint, strict type checks, production builds, Prisma validation/generation, Compose validation, three-service startup, HTTP smoke checks and independent `psql SELECT 1` passed. In the isolated test project, database shutdown returned HTTP 503 in 0.095 seconds while the page stayed HTTP 200; recovery returned HTTP 200 without restarting the backend. A marker survived PostgreSQL container recreation, and both apps served temporary source edits without image rebuilds. All temporary edits/markers were removed and the disposable test volume was deleted.
