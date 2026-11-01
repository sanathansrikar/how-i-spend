# Contributing / Working Agreement

Solo project, but run like a team project.

## Branching
- `main` is always deployable. No direct commits after the foundation work.
- One branch per unit of work, branched from `main`:
  `feat/<scope>-<short-desc>`, `fix/...`, `chore/...`, `docs/...`, `refactor/...`, `test/...`
- Merge via pull request (squash or `--no-ff`), then delete the branch.

## Commits — Conventional Commits
`<type>(<scope>): <imperative summary, <= 72 chars>`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore`.
Scopes: `backend`, `frontend`, `db`, `infra`, `ci`, `docs`, or a feature name (`expenses`, `auth`).

Rules: one logical change per commit; the body explains *why*, not *what*;
the tree builds and tests pass at every commit.

## Quality gates
- Backend: `ruff` (lint + format), `mypy`, `pytest`
- Frontend: `eslint`, `prettier`, `tsc --noEmit`, `vitest`
- CI runs all of the above on every PR.

## Decisions
Significant technical decisions are recorded in `docs/adr/`.
