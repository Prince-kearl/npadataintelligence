# NPA Incident & Field Data Intelligence System

Secure incident collection, evidence handling, lifecycle review, mapping, analytics and export for the National Petroleum Authority.

## Architecture

- React 18, TypeScript and Vite
- Supabase Auth, Postgres/RLS, Storage, Realtime and Edge Functions
- Server-authoritative incident submission and lifecycle RPCs
- Private evidence quarantine with mandatory external malware scanning
- Vitest, pgTAP and Playwright verification

The browser controls presentation only. Authorization, active-account enforcement, lifecycle transitions and scan state are enforced by Postgres policies/functions.

## Local setup

Requirements: Node 22, npm 10+, Docker and the Supabase CLI.

```sh
cp .env.example .env.local
npm ci
supabase start
supabase db reset
npm run dev
```

Populate `.env.local` from `supabase status -o env`. Never commit environment files or service-role keys.

## Verification

```sh
npm run lint
npm test
npm run build
npm run test:rls
npm run test:e2e
npm audit --audit-level=high
```

Role-based browser tests require `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. The service key is used only by test setup.

## Deployment

1. Create separate Supabase projects for staging and production.
2. Enable database backups/PITR and configure approved SMTP, allowed redirect URLs, MFA and signup controls.
3. Apply migrations with `supabase db push --project-ref <ref>`.
4. Configure Edge Function secrets:

   ```sh
   supabase secrets set MALWARE_SCANNER_URL=https://scanner.internal/v1/scan
   supabase secrets set MALWARE_SCANNER_API_KEY=...
   ```

   The scanner must accept multipart field `file` and return JSON shaped as
   `{ "clean": true|false, "signature": "optional", "engine": "optional" }`.
   Missing or unavailable scanning fails closed: evidence remains unreadable and the incident cannot finalize.

5. Deploy `log-auth-event`, `scan-attachment`, `admin-invite-user` and `admin-user-actions`, then deploy the frontend with production `VITE_` values.
6. Run the smoke, RLS and role suites against staging before promotion.

Detailed operational procedures are in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Security model

- Pending and suspended users cannot access operational records.
- Users cannot change their own approval state or email identity.
- Analysts/admins transition incidents only through allowed server-side state changes.
- Audit records are trigger or service generated; clients cannot insert them.
- Evidence is private and readable only after a clean server-side scan.
- Submission IDs, deterministic evidence paths and staged finalization make retries idempotent.

Report security defects privately to the system owner; do not place incident data or credentials in public issues.
