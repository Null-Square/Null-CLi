# AGENT.md

This file defines how we work in the Null CLI repo.

## Goals

- Maintain a clean, incremental fork of the original CLI.
- Use pnpm workspaces and keep the build reproducible.
- Prioritize small, testable changes with quick validation.

## Tooling

- Node: >= 20
- Package manager: pnpm
- Build: `pnpm -r build`
- Run: `pnpm --filter @null/null-cli start`

## Development Workflow

- Keep changes narrowly scoped; avoid modifying unrelated code.
- Prefer additive changes over destructive ones; provide rollback steps.
- Use compatibility layers temporarily when performing large renames; remove once imports are updated.
- When adding features, update minimal docs and a short usage example.

## Coding Conventions

- TypeScript strict mode; keep types clear and explicit.
- Avoid one-letter variable names; keep functions small and focused.
- Don’t add license headers unless required.
- Keep file names and exported APIs consistent with existing patterns.

## Commit & Branching

- Use clear commit messages describing the change, rationale, and impact.
- Favor short-lived branches; open small PRs.

## Testing & Validation

- Build locally: `pnpm -r build`
- Smoke run: `pnpm --filter @null/null-cli start -- --version`
- If adding behavior, include a quick test or example where feasible.

## Documentation

- Update `README.md` for user-facing changes.
- Add or update docs under `docs/` for deeper topics.
- Keep `NULL.md` in sync with the evolving penetration testing scope.



