# Docker Runbook

This repository can run together with the neighboring `../code/auto_bot` project.

## First Start

1. Copy `.env.docker.example` to `.env` in this CRM repository.
2. Put the real CRM admin password into `PMBI_ADMIN_PASSWORD` and `PMBI_CRM_PASSWORD`.
3. If you switch CRM auth to Clerk, also fill:
   `PMBI_PUBLIC_BASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
   `CLERK_JWT_KEY`, and `CLERK_ADMIN_EMAILS`.
4. Start both services:

```powershell
docker compose up --build
```

Open:

- CRM: `http://127.0.0.1:8080/login`
- AutoBot: `http://127.0.0.1:8765`

With Clerk enabled, users sign in through Clerk on `/login`, while CRM roles and
project permissions still stay in the local SQLite database.

Inside Docker, AutoBot talks to CRM through `http://crm:8080`.

The compose file does not read `../code/auto_bot/.env` automatically. Put the
AutoBot values you need for Docker, such as Telegram tokens, into this CRM
repository's `.env`.

## Data

Data stays on disk:

- CRM SQLite and documents: `./data`
- AutoBot tenders, downloads, reports: `../code/auto_bot/data`

## Useful Commands

```powershell
docker compose up -d --build
docker compose logs -f crm
docker compose logs -f autobot
docker compose down
```

If the CRM already has `data/INITIAL_ADMIN.txt`, use the password from that file
or set a known admin password before the first database initialization.
