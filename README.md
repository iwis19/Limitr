# Limitr 🛡️

API protection and abuse-detection platform with a Spring Boot backend and Angular admin dashboard for monitoring, rule tuning, and enforcement workflows.

---

## Repository Note

Most of the development began locally since a while ago, still maintaining whenever i have time to

---

## Key Features

1. **API Key Protection + Rate Limiting**
   - `ApiProtectionFilter` guards `/api/**` routes with `X-API-KEY` authentication
   - Per-principal fixed-window rate limiting with response headers (`X-RateLimit-*`, `Retry-After`)
   - Supports dynamic limits based on enforcement state
2. **Abuse Detection Layer**
   - Scores principals from behavior signals (rate-limit abuse, failed auth, request spikes, resource enumeration)
   - Uses rolling time windows and cooldown logic to reduce noise
   - Feeds directly into enforcement decisions
3. **Enforcement + Incident Handling**
   - Automatic state progression (`OK` → `WARN` → `THROTTLED` → `TEMP_BANNED`)
   - Temporary bans with expiration + manual ban/unban actions
   - Incident logging + avoid repeated spam records
4. **Admin Dashboard Interface**
   - Angular SPA 
   - Live admin actions for filtering 
   - Rule editing UI for thresholds
5. **Auth + Persistence**
   - JWT-based admin authentication 
   - Spring Data JPA persistence 
   - PostgreSQL primary datastore with H2 profile support

---

## Tech Stack
- **Java 21**
- **Spring Boot 3.5** (Web, Security, Validation, JPA)
- **PostgreSQL** + **H2**
- **Angular 22** + **TypeScript 6**
- **JWT** (`jjwt`)
- Maven, RxJS

---

## Setup

### Prerequisites
- **Java 21**
- **Node.js 22.22.3+, 24.15.0+, or 26.x**
- **npm**
- **Docker Desktop** for PostgreSQL
- **Maven**

### Quick local start (H2)

The fastest complete development setup uses the in-memory H2 profile. It creates
the documented local admin and sample API client automatically.

Terminal 1, from the repository root:

```powershell
cd backend
mvn spring-boot:run "-Dspring-boot.run.profiles=h2"
```

Terminal 2, from the repository root:

```powershell
cd frontend
npm ci
npm start
```

Open `http://localhost:4200`. The Angular development server proxies `/auth`,
`/admin`, and `/api` to the backend at `http://localhost:8080`.

Admin login:
- username: `admin`
- password: `admin12345`

Seeded API client:
- principal id: `local-client`
- API key: `local-free-key`

These are development-only defaults. Override them when testing anything beyond
your local machine.

### PostgreSQL local start

From the repository root, start PostgreSQL:

```powershell
docker compose up -d postgres
docker compose ps
```

The local database is `limitr` with username/password `postgres`/`postgres`, and
its port is bound only to `127.0.0.1`.

Then start the backend from its own directory. Local seeding is explicit because
the secure default is off:

```powershell
cd backend
$env:JWT_SECRET="replace-with-a-long-random-secret-at-least-32-bytes"
$env:APP_SEED_ENABLED="true"
mvn spring-boot:run
```

Start the frontend with the Terminal 2 commands from the quick local setup.

`JWT_SECRET` is required outside the H2 profile. `APP_SEED_ENABLED` defaults to
`false`, and `AUTH_REGISTRATION_MODE` defaults to `bootstrap`. For a separately
hosted frontend, set `CORS_ALLOWED_ORIGINS` to a comma-separated list of its
trusted origins; the default allows only the local Angular development server.

### Admin registration lifecycle
- Public `POST /auth/register` is intended for bootstrap only. In the default `bootstrap` mode it works only until the first admin exists, then it returns `403`.
- Set `AUTH_REGISTRATION_MODE=disabled` to turn off public registration entirely.
- After bootstrap, create additional admins through authenticated `POST /admin/users` requests from an existing admin session.
- Typical production flow: seed or provision the first admin, set `AUTH_REGISTRATION_MODE=disabled`, then manage future admins through the protected admin endpoint.

### Production-like single-origin build

Build the Angular application, copy the exact output into Spring Boot's static
resources, then package the backend:

```powershell
cd frontend
npm ci
npm run build:backend
cd ..
cd backend
mvn clean package
```

Run `target/backend-0.0.1-SNAPSHOT.jar` with PostgreSQL, a unique JWT secret,
non-default database credentials, and explicit provisioning settings. The
packaged backend serves the current SPA and API from `http://localhost:8080`.

The sync script intentionally replaces only
`backend/src/main/resources/static`; it validates the destination before doing
so.

---

## Project Structure
```text
Limitr/
├── backend/
│   ├── src/main/java/com/limitr/
│   │   ├── config/               # Security + API protection filters + data seeding
│   │   ├── controller/           # Auth, admin, sample API, SPA forward controllers
│   │   ├── domain/               # JPA entities + enums
│   │   ├── dto/                  # Request/response payload models
│   │   ├── repository/           # Spring Data repositories
│   │   ├── service/              # Rate limiting, detection, enforcement, auth
│   │   └── LimitrApplication.java
│   ├── src/main/resources/
│   │   ├── application.yml       # Postgres + app config
│   │   ├── application-h2.yml    # H2 local profile config
│   │   └── static/               # Built frontend assets served by backend
│   └── pom.xml
├── frontend/
│   ├── src/app/
│   │   ├── pages/                # login, dashboard, logs, incidents, rules
│   │   ├── services/             # auth + admin API services
│   │   ├── guards/               # auth guard
│   │   ├── interceptors/         # JWT auth header interceptor
│   │   └── shell/                # authenticated app shell layout
│   ├── package.json
│   └── angular.json
├── scripts/
│   └── sync-frontend-to-backend.ps1
└── docker-compose.yml
```

---

## Lessons Learned
- Designing layered API defenses that combine limits, scoring, and enforcement
- Balancing protection with operator visibility through logs and incidents
- Full-stack workflow with aligned control and logics
- Managing JWT auth flow on Angular 
- Iterating on threshold tuning without breaking 

---

## License
MIT
