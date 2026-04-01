# Deploying to Fly.io

This guide walks through deploying Oksskolten on [Fly.io](https://fly.io) with [Turso](https://turso.tech) as the database. Both services offer free tiers that are more than enough for a personal RSS reader.

## Why Fly.io + Turso?

Oksskolten uses SQLite (via libsql), which means it needs a persistent disk. Fly.io's volumes work but are tied to a specific host — if the VM moves, you lose your data. Turso solves this by hosting your libsql database as a managed service. The app already supports Turso out of the box (no code changes needed).

| Component | Service | Free Tier |
|---|---|---|
| App | Fly.io | 3 shared VMs, 256MB each |
| Database | Turso | 9GB storage, 10B row reads/month |
| Search | Meilisearch Cloud (optional) | 10K documents |

## Prerequisites

```bash
brew install flyctl        # Fly.io CLI
brew install tursodatabase/tap/turso  # Turso CLI
```

## 1. Create a Turso Database

```bash
turso auth login
turso db create oksskolten --location nrt   # Tokyo region
turso db tokens create oksskolten
turso db show oksskolten --url              # Copy the libsql:// URL
```

## 2. Set Up Fly.io

```bash
fly auth login
fly apps create oksskolten
```

Create `fly.toml` in the project root:

```toml
app = "oksskolten"
primary_region = "nrt"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false    # Keep running for cron
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

Note: `auto_stop_machines = false` is important — Oksskolten runs a cron job (feed fetching every 5 minutes) that needs the VM to stay alive.

## 3. Set Secrets

```bash
fly secrets set \
  DATABASE_URL=libsql://oksskolten-<your-org>.turso.io \
  TURSO_AUTH_TOKEN=<token> \
  JWT_SECRET=$(openssl rand -hex 32)
```

## 4. Deploy

```bash
fly deploy
```

That's it. Visit `https://oksskolten.fly.dev` and create your account.

## Optional Services

All sidecar services (Meilisearch, RSS Bridge, FlareSolverr) are **optional**. The app runs fine without them — features degrade gracefully:

| Service | Without It | With It |
|---|---|---|
| Meilisearch | No full-text search | Search across all articles |
| RSS Bridge | No feed auto-discovery for non-RSS sites | CSS selector-based feeds |
| FlareSolverr | JS-heavy sites may fail to fetch | Bot bypass via headless browser |

To add Meilisearch later, sign up for [Meilisearch Cloud](https://www.meilisearch.com/cloud) and set:

```bash
fly secrets set MEILI_URL=https://ms-xxx.meilisearch.io MEILI_MASTER_KEY=<key>
```

## Useful Commands

```bash
fly status          # Check app status
fly logs            # Tail logs
fly ssh console     # SSH into the VM
fly secrets list    # List configured secrets
```

## Comparison with Docker Compose

| | Docker Compose (NAS/VPS) | Fly.io + Turso |
|---|---|---|
| Setup | `docker compose up` | `fly deploy` |
| Database | Local SQLite file | Managed Turso |
| Sidecars | All included | Add individually |
| Search | Meilisearch container | Meilisearch Cloud or skip |
| Cost | Hardware/VPS cost | Free tier |
| Backup | Manual | Turso handles it |
| Monitoring | `docker compose logs` | `fly logs` + dashboard |
