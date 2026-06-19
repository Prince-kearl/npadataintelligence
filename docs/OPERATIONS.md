# Production Operations

## Ownership and environments

Maintain isolated development, staging and production Supabase projects. Production access must use named accounts, MFA and least privilege. Service-role credentials belong only in the Supabase secret store and CI secret store; rotate them after staff changes or suspected exposure.

Every release requires: clean CI, reviewed migrations, a staging smoke test, a recorded rollback owner and confirmation that the malware scanner is healthy.

## Backup and recovery

- Enable daily backups and point-in-time recovery for production. Target RPO: 15 minutes; target RTO: 4 hours.
- Export storage-object inventory daily. Database backups do not contain Storage object bodies, so replicate the private evidence bucket to an encrypted, access-logged recovery location.
- Test restoration quarterly in an isolated project: restore Postgres, restore evidence objects, deploy the matching function/frontend revision, then run RLS and attachment-access tests.
- Before a risky migration, capture a backup and rehearse the migration against a recent sanitized staging restore.
- Roll forward with a corrective migration whenever possible. Never edit an already-applied migration.

Recovery sequence:

1. Declare the recovery window and make production read-only if integrity is uncertain.
2. Restore the database to the chosen point and reconcile later audit/export events.
3. Restore evidence objects and verify hashes/inventory counts.
4. Rotate service credentials, deploy the matching application revision and run smoke/RLS tests.
5. Reopen access only after the incident owner signs off; record data loss and reconciliation work.

## Retention baseline

The records owner must approve changes to these defaults and reconcile them with applicable law and litigation holds.

| Data | Baseline | Disposal |
|---|---:|---|
| Incident records and clean evidence | 7 years after closure | Approved purge with immutable audit record |
| Audit and authentication events | 2 years | Partition expiry/controlled deletion |
| Export-history metadata | 2 years | Scheduled deletion |
| Infected evidence | Immediate quarantine deletion after signature is recorded | Scanner function removes object |
| Abandoned staging submissions | 7 days | Scheduled service-role cleanup after operator review |
| Local browser drafts | Until submission/discard; maximum 7 days operationally | User discard or managed browser-data policy |

Apply legal holds before normal expiry. Purges should be dry-run, reviewed by two people, logged, and followed by storage-inventory reconciliation.

## Monitoring

Alert on scanner failures, evidence remaining `pending` over 15 minutes, repeated authentication failures in provider logs, role/status changes, RLS or function errors, backup failures, unexpected export volume, and staging submissions older than one hour. Monitor Supabase Auth logs as the source of truth for failed login attempts; application auth events intentionally record only JWT-authenticated events.

## Incident response

1. **Triage:** assign severity, incident commander and timeline; preserve Supabase, scanner, CDN and CI logs.
2. **Contain:** suspend affected accounts, revoke sessions, rotate exposed keys, disable exports or scanning ingress if necessary, and restrict network access.
3. **Investigate:** correlate immutable database audit rows with provider logs; inventory accessed incidents/evidence and verify object hashes.
4. **Eradicate:** patch the root cause, review RLS/functions, rotate secrets and scan affected artifacts.
5. **Recover:** restore if required, deploy through staging, run RLS/E2E suites and monitor closely.
6. **Notify:** follow NPA legal/privacy reporting procedures and document scope, decisions and notifications.
7. **Learn:** complete a blameless post-incident review, assign dated actions and add a regression test.

Do not delete suspicious rows or objects during investigation. Preserve them in a restricted evidence location and use reversible containment.

## Malware scanner operations

The scanner endpoint must be private or strongly authenticated, enforce the 10 MB limit, inspect file content rather than trusting MIME/extension, and return only after a completed scan. Test it with the EICAR test file in staging. If the scanner is unavailable, submissions with evidence remain staged; operators should restore the service and have users retry the same submission rather than bypassing scan status.
