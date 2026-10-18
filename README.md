# LevelUp Web

The web version of LevelUp, plus the shared multi-user API that the mobile app can use too.

- `backend/`: Node.js, Express 5, TypeScript 6, Prisma 7 and PostgreSQL
- `frontend/`: Vite 8, React 19, TypeScript 6, TanStack Query and React Router

The two folders are separate npm projects with their own `package-lock.json`, set up the same way as VelocityFit.

## Run it locally

You need Node 22+ and a PostgreSQL database. Use two terminals.

Backend:

```bash
cd backend
npm install
cp .env.example .env        # then set DATABASE_URL
npm run keys                # paste JWT_SECRET, ENCRYPTION_KEY, VAPID_* into .env
npm run db:migrate          # creates the tables
npm run dev                 # tsc -b && node dist/index.js, API on :4000
```

Frontend:

```bash
cd frontend
npm install
npm run dev                 # vite, web on :5173
```

Open http://localhost:5173 and create an account.

| Folder | Command | What it does |
| --- | --- | --- |
| backend | `npm run dev` | Compile and start the API. Re-run it after code changes. |
| backend | `npm run build` / `npm start` | Production build (regenerates the Prisma client) / start the built API. |
| backend | `npm test` | Unit tests. |
| backend | `npm run db:migrate` / `npm run db:deploy` | Create a migration in development / apply migrations in production. |
| frontend | `npm run dev` | Vite dev server with hot reload. |
| frontend | `npm run build` | Typecheck and build to `dist/`. |
| frontend | `npm run lint` | ESLint. |
| frontend | `npm run preview` | Serve the production build locally. |

## Run it with Docker

Put `JWT_SECRET`, `ENCRYPTION_KEY` and, optionally, `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` in a root `.env`. Then:

```bash
docker compose up --build
```

The web app is served on http://localhost:8080. Nginx serves the SPA and proxies `/api` to the API. The API applies migrations on start.

## Using the API from the mobile app

Every route is under `/api`. All routes except `/api/auth/*` need `Authorization: Bearer <accessToken>`.

| Header | Purpose |
| --- | --- |
| `X-Client: mobile` | Login, register and refresh return `refreshToken` in the JSON body instead of setting a cookie. Store it in SecureStore. |
| `X-Timezone: Asia/Kolkata` | The IANA zone used to decide what "today" is. Send it on every request. |

Auth flow:

1. `POST /api/auth/register` with `{ name, email, password, timezone }`, or `POST /api/auth/login` with `{ email, password }`. Either returns `{ user, accessToken, refreshToken, refreshExpiresAt }`.
2. The access token lasts 15 minutes. When a request returns 401, call `POST /api/auth/refresh` with `{ refreshToken }`. Refresh tokens rotate: always save the new one. For 60 seconds after a rotation, refreshing with the previous token returns the same current token instead of failing, so a response lost to a dropped connection (or two tabs refreshing at once) doesn't sign the user out. Older tokens are rejected.
3. `POST /api/auth/logout` with `{ refreshToken }` signs out that device. `POST /api/auth/logout-all` signs out everywhere.

Main endpoints:

- **Today and history:** `GET /today`, `GET /history?days=7`
- **Tasks:** `GET|POST /tasks`, `GET|PUT|DELETE /tasks/:id`, `POST /tasks/:id/pause`, `POST /tasks/:id/toggle`, `PUT /tasks/:id/progress`
- **Projects:** `GET|POST /projects`, `GET|PATCH|DELETE /projects/:id`, `POST /projects/:id/milestones`, `POST /milestones/:id/toggle`, `DELETE /milestones/:id`, `POST /projects/:id/work-logs`, `DELETE /work-logs/:id`
- **Connected apps:** `GET /connections`, `PUT|PATCH|DELETE /connections/:provider`, `POST /sync`
- **Settings:** `GET|PATCH /settings`
- **Web push:** `GET /push/config`, `POST|DELETE /push/subscriptions`, `POST /push/test`

Errors always look like `{ "error": "Human-readable message", "code": "VALIDATION" }`.

XP is awarded only on the server. Awards are idempotent and capped at 100 per day and 400 per week, so re-toggling a task can't farm XP. Connected-app secrets are encrypted at rest and are never returned to clients.

## Scaling

- The API is stateless: JWT access tokens and refresh sessions are stored in Postgres. Run as many replicas as you like behind a load balancer, and set `TRUST_PROXY=1`.
- Scheduled jobs (app sync every 30 minutes, reminders every minute, session cleanup daily) take a lease row in Postgres before running, so only one replica does each run. You can also set `RUN_JOBS=false` on the API replicas and run one extra replica with `RUN_JOBS=true` as a worker.
- Rate limits are kept in memory per instance. Use a Redis store for `express-rate-limit` if you need limits that are global across replicas.
- `DATABASE_POOL_SIZE` × replicas should stay below Postgres's `max_connections`. Put PgBouncer in front for large fleets.
