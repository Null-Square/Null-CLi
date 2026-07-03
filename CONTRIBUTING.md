# Contributing

Contributions should keep the public boundary intact.

Good contributions:

- CLI and documentation polish that improves public usability.
- Clear run summaries, evidence trails, reports, and local artifact handling.
- New scanner parsers for public artifact formats.
- Public skills with conservative testing guidance.
- Report formatting improvements.
- Compliance readiness mappings with clear non-certification language.
- Tests for parsers, schemas, and CLI behavior.

Avoid:

- Non-public orchestration logic.
- Aggressive exploit automation.
- External callback infrastructure.
- Credential attacks.
- Customer traces or private benchmark data.

Use [docs/public-boundary.md](docs/public-boundary.md) as the source of truth:
public, commodity, user-visible behavior is allowed; closed NullSquare harness
logic, managed-platform internals, and non-public decision paths are not.

## Development

Requires Node.js >= 20.

```bash
npm install
npm run build        # compile TypeScript to dist/
npm run verify       # build + unit tests
npm run test:e2e     # build + end-to-end CLI test
node dist/cli/index.js --help
```

Run the CLI locally without publishing:

```bash
npm run cli -- agent run --target https://example.com --dry-run
```

## Pull requests

- Keep changes scoped and covered by tests where practical.
- Never commit real targets, credentials, API keys, or `.null/` run output (all git-ignored).
- Ensure `npm run verify` passes before opening a PR.
- Describe how a reviewer can validate the change (see the PR template).

## Reporting security issues

Do not open public issues for vulnerabilities — follow [SECURITY.md](SECURITY.md).
