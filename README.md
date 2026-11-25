# AgentOS

A trust layer for AI agents: signed scoped passports, one enforcement gateway,
human approvals, and a tamper-evident audit log.

## Repo layout

| Path | What it is |
|---|---|
| `db/` | SQL files you paste into the Supabase SQL Editor (no CLI needed) |
| `packages/shared` | Types and constants shared by every app |
| `apps/api` | AgentOS backend / gateway (Express + TypeScript) |
| `apps/mock-store` | Fake merchant catalog the agent shops from |
| `apps/dashboard` | React + Vite + Tailwind dashboard |
| `docs/` | API contracts, architecture, threat model |

## Setup (no Supabase CLI)

1. Create a project at https://supabase.com (region: Mumbai / ap-south-1). Save the DB password.
2. Open **SQL Editor -> New query** and run, in order, one file at a time:
   `db/001_core_tables.sql`, `002_audit_chain.sql`, `003_spend.sql`,
   `004_rls_realtime.sql`, then `db/seed.sql` (seed once; use `reset.sql` first to re-seed).
3. Open **Project Settings -> API** and copy the project URL, `anon` key and `service_role` key.
4. `cp .env.example .env` and fill in the values.
5. `npm install`
6. `npm run keys` and paste the two printed lines into `.env`.
7. **Authentication -> Users -> Add user**: create an approver (email + password, auto-confirm).
8. **Database -> Publications**: confirm `supabase_realtime` includes `audit_log` and `approvals`.
9. `npm run dev`

## Phase 1 checkpoint

- http://localhost:4000/health returns `{ ok: true }`
- http://localhost:4000/health/db returns `ok: true` with agent count and `audit_chain.valid = true`
- http://localhost:4100/products lists the catalog
- http://localhost:5173 shows three green status cards

## Rules of the repo

- The `service_role` key lives only in `apps/api`.
- Every agent action goes through the gateway (Phase 3). No side doors.
- Money is integer paise everywhere (Rs 3,000 = 300000). Convert only for display.
- Change `docs/api-contracts.md` before changing endpoints.
- Change the database by editing the files in `db/`, not by clicking in the Supabase dashboard.

## Phase 2: identity and credentials

Agents now have identities and signed passports (Ed25519 JWTs). Scopes, per-transaction
cap, daily budget, approval threshold, owner and token version are all inside the token.
The database is consulted only for revocation and token version.

| Endpoint | Caller | Purpose |
|---|---|---|
| `POST /agents` | human (Supabase JWT) | Register agent + policy, returns the passport once |
| `GET /agents`, `GET /agents/:id` | human | List / detail (passports are never stored) |
| `PUT /agents/:id/policy` | human | New limits, bumps `token_version`, returns a new passport |
| `POST /agents/:id/passport` | human | Rotate the passport (same limits) |
| `POST /agents/:id/revoke` | human | Kill switch |
| `POST /passports/verify` | agent (passport) | Introspection; becomes pipeline steps 1-2 in Phase 3 |

Owner comes from the verified login, never from the request body.

### Phase 2 checkpoint

```
npm run test:phase2      # crypto checks (offline) + database checks
npm run dev              # in another terminal, then:
npm run try-it           # end-to-end over HTTP (needs TEST_EMAIL / TEST_PASSWORD in .env)
```

Test runs leave rows in the append-only audit log. Run `db/reset.sql` then `db/seed.sql`
before your demo for a clean slate.
