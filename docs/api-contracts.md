# API contracts (v0, update before changing code)

All money is integer paise. Agent calls carry `Authorization: Bearer <passport>`.
Human (dashboard) write calls carry the Supabase Auth JWT.

| Method | Path | Caller | Purpose |
|---|---|---|---|
| GET | /health | anyone | Process alive |
| GET | /health/db | anyone (Phase 1 only) | DB + SQL functions reachable |
| POST | /agents | human | Register agent + policy, returns agent and passport |
| GET | /agents, /agents/:id | human | List / detail |
| PUT | /agents/:id/policy | human | Change limits, bumps token_version, returns new passport |
| POST | /agents/:id/revoke | human | Kill switch |
| POST | /gateway/execute | agent | `{ action, params }` through the pipeline |
| GET | /transactions | human | History |
| GET | /approvals | human | Pending and decided |
| POST | /approvals/:id/decide | human | `{ decision: "approved" \| "denied" }` |
| GET | /audit | human | Log entries |
| GET | /audit/verify | human | Runs verify_audit_chain() |

## Gateway response shape

```json
{ "ok": true, "result": { } }
{ "ok": false, "reason": "exceeds_per_txn_limit", "detail": "800000 > 500000" }
{ "ok": false, "reason": "pending_approval", "approval_id": "uuid" }
```

## Mock store (port 4100)

| Method | Path | Purpose |
|---|---|---|
| GET | /products?query= | Search catalog |
| GET | /products/:id | One product (gateway uses this for the real price) |
