# Phase 3 — Authentication and outbox processing

## Authentication controls

- Access tokens now carry an explicit token type, issuer, audience and unique JWT ID.
- The global guard validates token type, required claims, issuer, audience and ACTIVE status.
- Password-reset PINs use a cryptographically secure random generator.
- Previous unconsumed reset PINs are invalidated before a new PIN is issued.
- Invalid PIN attempts are counted and the PIN is consumed at the configured limit.
- Successful password reset revokes all outstanding refresh tokens.
- Sensitive public auth routes have endpoint-specific rate limits.
- Auth token issuance and password-reset responsibilities were split from the main auth service.

## Outbox and resource controls

- The outbox worker is a persistent process with bounded polling, batches and controlled shutdown.
- Multiple workers claim rows with `FOR UPDATE SKIP LOCKED` semantics to avoid concurrent delivery of the same pending row.
- Stale worker locks are recovered and retry delays use bounded exponential backoff with jitter.
- Provider response bodies and arbitrary headers are no longer persisted in error metadata.
- Outbox payloads returned by administration endpoints redact PIN, token, password and secret fields.

## Delivery guarantee

Email dispatch is **at least once**, not exactly once. A process failure after the provider accepts a message but before the database records success can still cause a retry. Exactly-once delivery is not claimed because SendGrid does not provide an end-to-end transaction with PostgreSQL. Consumers and templates must therefore tolerate duplicate delivery where practical.

## Remaining control

The built-in Nest throttler stores counters in process memory. Before horizontal scaling, replace it with a shared Redis-backed throttling store or enforce equivalent limits at the ingress/WAF layer.
