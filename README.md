# how-i-spend

A responsive personal expense tracker, with AI insights and voice input/output planned.

> Status: foundation phase. See [docs/adr](docs/adr) for decisions and
> [CONTRIBUTING.md](CONTRIBUTING.md) for the working agreement.

## Structure
```
backend/    FastAPI service (Python)
frontend/   React + TypeScript app (Vite)
docs/adr/   Architecture decision records
```

## Quick start
Prerequisites: Node 22+, Python 3.13+, [uv](https://docs.astral.sh/uv/), Docker.

```bash
docker compose up -d db                      # Postgres on :5432

cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head              # create/upgrade tables
uv run python -m app.db.seed             # optional: sample data (safe to re-run)
uv run uvicorn app.main:app --reload         # API on :8000 (docs at /docs)

cd ../frontend
npm install
npm run dev                                  # App on :5173, proxies /api to :8000
```

Checks: backend `uv run ruff check . && uv run mypy && uv run pytest`;
backend tests need the Postgres container running;
after changing a model: `uv run alembic revision --autogenerate -m "<what changed>"`;
frontend `npm run lint && npm run typecheck && npm test`.

## Your data
Postgres data lives in the `pgdata` Docker volume, so it survives restarts, `docker compose stop`
and `docker compose down`.

**Warning:** `docker compose down -v`, `docker volume rm` and Docker Desktop's "Clean / Purge data"
delete the volume and all your data. Back up first:

```bash
scripts/db-backup.sh                          # writes backups/howispend-<timestamp>.sql (git-ignored)
scripts/db-restore.sh backups/<file>.sql      # replaces ALL current data after a y/N prompt
```
