// End-to-end over HTTP, as a logged-in human. Start the API first (npm run dev).
// Needs in .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const API = process.env.API_URL ?? "http://localhost:4000";
const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anon, TEST_EMAIL: email, TEST_PASSWORD: password } = process.env;
if (!url || !anon || !email || !password) {
  console.error("Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, TEST_EMAIL and TEST_PASSWORD in .env");
  process.exit(1);
}

const sb = createClient(url, anon, { auth: { persistSession: false } });
const { data, error } = await sb.auth.signInWithPassword({ email, password });
if (error || !data.session) { console.error("Login failed:", error?.message); process.exit(1); }
const jwt = data.session.access_token;
console.log(`Logged in as ${email}\n`);

const call = async (method: string, route: string, token?: string, body?: unknown) => {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) as any };
};
const show = (label: string, r: { status: number; json: any }) =>
  console.log(`${label}\n  -> ${r.status} ${JSON.stringify(r.json).slice(0, 220)}\n`);

const policy = {
  scopes: ["search_products", "purchase", "check_budget"],
  max_per_txn: 500_000, daily_budget: 1_500_000, approval_threshold: 400_000,
};

show("1. Register WITHOUT logging in (expect 401)",
  await call("POST", "/agents", undefined, { name: "Intruder", ...policy }));

const reg = await call("POST", "/agents", jwt, { name: "Try-it Shopper", ...policy });
show("2. Register as a human (expect 201 + passport)", { ...reg, json: { ...reg.json, passport: "<hidden>" } });
const id = reg.json.agent.id as string;
const passport = reg.json.passport as string;

show("3. Verify the passport (expect valid, with limits inside)",
  await call("POST", "/passports/verify", passport));

const [h, p, s] = passport.split(".");
const claims = JSON.parse(Buffer.from(p, "base64url").toString());
claims.max_per_txn = 9_999_999_900;
const forged = [h, Buffer.from(JSON.stringify(claims)).toString("base64url"), s].join(".");
show("4. Verify a TAMPERED passport (expect 401)", await call("POST", "/passports/verify", forged));

const upd = await call("PUT", `/agents/${id}/policy`, jwt, { ...policy, max_per_txn: 300_000, approval_threshold: 200_000 });
show("5. Lower the limit (expect new passport)", { ...upd, json: { ...upd.json, passport: "<hidden>" } });
show("6. Old passport after the update (expect passport_superseded)",
  await call("POST", "/passports/verify", passport));
show("7. New passport (expect valid, max_per_txn 300000)",
  await call("POST", "/passports/verify", upd.json.passport));

show("8. Revoke the agent", await call("POST", `/agents/${id}/revoke`, jwt));
show("9. New passport after revoke (expect agent_revoked)",
  await call("POST", "/passports/verify", upd.json.passport));

console.log("Done. Every step above is also in the audit log (db/Table Editor -> audit_log).");
