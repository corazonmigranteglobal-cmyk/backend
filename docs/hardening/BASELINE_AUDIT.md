# Baseline audit — 2026-07-17

Base commit: `83343f146895a786043cd099acc2375900cfeb2d`.

## Verified repository facts

- Stack: NestJS 11, TypeScript strict mode, Sequelize 6, PostgreSQL, Redis, SendGrid and Google Cloud Storage.
- Package manager used by the Dockerfile: Yarn Classic 1.22.22.
- The recursive Git tree contained 377 entries and was not truncated.
- A Google service-account JSON with a private key was tracked under `secrets/`.
- A PostgreSQL dump, a project ZIP and generated Yarn PnP artifacts were tracked.
- `yarn install --frozen-lockfile --non-interactive` completed successfully in the audit environment.
- The pre-existing secret scanner correctly failed on the tracked credential.
- The pre-existing `lint` command used `--fix`, which made a verification command mutate source files.
- `src/config/configuration.ts` exceeded the 300-line manual-file limit.
- `src/modules/files/files.service.ts`, `src/modules/scheduling/scheduling.service.ts` and several other services require a responsibility review because their sizes materially exceed the project threshold.

## Initial severity

| Severity | Finding | Immediate action |
|---|---|---|
| Critical | Versioned cloud private key | Remove from branch, revoke/rotate externally and purge history. |
| High | Versioned database dump and project archive | Remove and keep backups/releases in controlled external storage. |
| High | No branch-specific immutable hardening gate | Add CI for hygiene, secret scan, lint, typecheck, tests, build and dependency audit. |
| Medium | Lint command mutates files | Separate `lint` and `lint:fix`. |
| Medium | Oversized configuration and domain services | Split by responsibility with tests in later phases. |

## Evidence limitations

A local combined lint/test command was interrupted by the audit sandbox after dependency installation. GitHub Actions on `HARDENING` is the authoritative repeatable environment for subsequent quality-gate evidence. This report does not claim that build or tests pass until those checks complete.
