# Credential exposure response runbook

A credential committed to Git must be treated as exposed even after the file is deleted, because historical commits and external clones may retain it.

## Immediate containment

1. Disable or revoke the affected cloud service-account key in the provider console.
2. Create a replacement key only when the runtime still requires that identity.
3. Store the replacement in the deployment platform's secret manager; never in Git, images, logs or tickets.
4. Deploy the replacement and verify the dependent integration with a non-destructive smoke test.
5. Review provider audit logs from the first commit containing the key until revocation.
6. Remove unexpected sessions, keys, grants or resources and escalate any suspicious access.

## Repository remediation

1. Keep the credential file deleted from all active branches.
2. Use an approved history-rewrite procedure (`git filter-repo` or the hosting provider's documented process) from a controlled workstation.
3. Coordinate the rewrite because collaborators must re-clone or carefully reset their local repositories.
4. Invalidate caches and release artifacts that could contain the file.
5. Run the repository hygiene and secret checks before accepting new commits.

## Validation evidence

Record without secret values:

- revoked key identifier or provider incident reference;
- revocation timestamp in UTC;
- replacement deployment identifier;
- smoke-test result;
- audit-log review interval and reviewer;
- history-rewrite completion and branch protection status.

Never paste private-key material into this document.
