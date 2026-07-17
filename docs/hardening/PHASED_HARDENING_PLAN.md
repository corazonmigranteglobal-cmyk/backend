# Production hardening plan

All changes are isolated in `HARDENING` and require review before merging into `main`.

## Execution rules

- Preserve public contracts unless a verified security or integrity defect requires a documented change.
- Do not invent business rules. Missing critical policy becomes an explicit blocker.
- New and modified code identifiers use precise English names.
- Manual source files stay below 300 lines; files above 220 lines require a cohesion review.
- A phase is complete only when its evidence is recorded.

## Phases

1. **Baseline and inventory:** repository tree, dependencies, modules, workflows and reproducible gates.
2. **Repository and supply-chain hygiene:** remove credentials, dumps, archives and generated artifacts; pin Yarn; add CI prevention.
3. **Configuration and lifecycle:** validated environment, bounded pools/timeouts, graceful shutdown and readiness.
4. **API security:** OWASP ASVS 5.0 and API Top 10 controls, authentication, authorization, object ownership and resource limits.
5. **Files and external providers:** upload validation, bounded memory, cleanup, timeouts, retries and redacted logs.
6. **Booking and scheduling:** IANA time zones, UTC instants, RFC 5545 interoperability, concurrency and valid state transitions.
7. **News, blog and CMS:** editorial workflow, stored-XSS prevention, slugs, publication visibility, subscriptions and bounded queries.
8. **Accounting:** decimal money, ISO 4217 codes, balanced entries, atomic posting, reversals and immutable audit evidence.
9. **Clean Code and efficiency:** split oversized responsibilities, remove unbounded operations, review timers/listeners and use English identifiers.
10. **Release evidence:** OpenAPI, tests, CI, runbooks, backup/restore evidence, residual-risk register and production checklist.

## Release gate

The branch is reviewable when secrets and forbidden artifacts are absent, quality gates are reproducible, critical domain invariants have tests, operational runbooks exist, and every residual risk has a severity and action.
