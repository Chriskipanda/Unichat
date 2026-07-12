# UniChat — Setup Requirements

Software you need installed locally to run this repo. Install each from its official source — no installers are bundled in this repo (GitHub rejects files over 100MB, and several of these tools are 500MB+).

## Required

| Tool | Version used in this repo | Download |
|---|---|---|
| Node.js | 26.x (npm 11.x) | https://nodejs.org/ |
| Flutter SDK | Stable channel (Dart >=3.x) | https://docs.flutter.dev/get-started/install |
| Docker Desktop | Latest (Compose v2) | https://www.docker.com/products/docker-desktop/ |
| Git | Any recent version | https://git-scm.com/downloads |

## Provided via Docker Compose (no separate install needed)

`docker-compose.yml` at the repo root spins these up automatically:

- **PostgreSQL 15** (`postgres:15-alpine`) — core datastore, port 5432
- **Redis 7** (`redis:7-alpine`) — cache/presence/session store, port 6379
- **Redpanda** (Kafka-compatible broker) — event streaming, ports 19092 / 9644
- **NGINX** (`nginx:alpine`) — API gateway, port 80

## Getting started

```bash
# 1. Install Node.js, Flutter, and Docker Desktop from the links above.

# 2. Start backend infrastructure + services
docker compose up -d

# 3. Install JS dependencies per app/service
cd apps/web && npm install
cd apps/web-admin && npm install
cd apps/web-client && npm install
cd apps/web-superadmin && npm install
cd services/<service-name> && npm install   # repeat per service you're working on

# 4. Mobile app
cd apps/mobile
flutter pub get
flutter run
```

## Notes

- Service ports and env vars (DB URLs, JWT secrets, etc.) are pre-filled in `docker-compose.yml` and per-app `.env`/`.env.local` files for local development. These are dev-only values, not production credentials.
- See [README.md](README.md) for the overall architecture and tech stack.
