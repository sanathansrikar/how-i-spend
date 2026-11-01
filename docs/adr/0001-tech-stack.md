# ADR 0001: Tech stack and hosting

Status: accepted

## Context
Personal expense tracker (responsive web, later AI insights + voice) used to learn
full-stack and GenAI. Everything must run on free tiers.

## Decision
| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript (Vite), Tailwind, TanStack Query | Mobile-first, fast DX, typed API access |
| Backend | Python 3.13 + FastAPI, Pydantic v2, SQLAlchemy 2, Alembic | Async, auto OpenAPI docs, strong typing, best GenAI ecosystem in Python |
| Database | PostgreSQL 16 | Relational fit for money data |
| Tooling | uv, ruff, mypy, pytest / pnpm-free npm, eslint, prettier, vitest | Industry-standard quality gates |
| Local dev | Docker Compose (Postgres only; apps run natively) | Reproducible DB, fast reload |
| CI | GitHub Actions (free for public repos) | |

## Free hosting (planned, decided at deploy time)
- Database: Neon (free Postgres) or Supabase
- Backend: Render or Fly.io free tier (cold starts acceptable)
- Frontend: Vercel or Cloudflare Pages

## Deferred
AI provider and voice (STT/TTS) stack — to be decided in a later ADR.
The browser Web Speech API is a zero-cost option for first experiments.
