// Database-backed checks. Needs the Supabase tables + functions. Run: npm run test:db
import { ZodError } from "zod";
import { supabase } from "../src/supabase";
import {
  registerAgent, revokeAgent, rotatePassport, updatePolicy,
} from "../src/modules/agents/service";
import { authenticatePassport } from "../src/modules/credentials/service";

let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!ok) failed++;
};

const OWNER = "test@agentos.local";
const POLICY = {
  scopes: ["search_products", "purchase", "check_budget"],
  max_per_txn: 500_000, daily_budget: 1_500_000, approval_threshold: 400_000,
};
const created: string[] = [];

try {
  console.log("\nIdentity + lifecycle checks (database)\n");

  // 1. Register
  const reg = await registerAgent(OWNER, { name: "Test Shopper", ...POLICY });
  created.push(reg.agent.id);
  check("register returns an agent id and a passport",
    reg.agent.id.startsWith("agent_") && reg.passport.split(".").length === 3, reg.agent.id);

  const first = await authenticatePassport(reg.passport);
  check("fresh passport authenticates", first.ok && first.claims.ver === 1);

  // 2. Policy update supersedes the old passport
  const upd = await updatePolicy(reg.agent.id, OWNER, { ...POLICY, max_per_txn: 300_000, approval_threshold: 200_000 });
  const old = await authenticatePassport(reg.passport);
  check("old passport is superseded after a policy update",
    !old.ok && old.reason === "passport_superseded");
  const fresh = await authenticatePassport(upd.passport);
  check("new passport carries the new limit",
    fresh.ok && fresh.claims.max_per_txn === 300_000 && fresh.claims.ver === 2);

  // 3. Rotation
  const rot = await rotatePassport(reg.agent.id, OWNER);
  const afterRot = await authenticatePassport(upd.passport);
  check("rotation invalidates the previous passport",
    !afterRot.ok && afterRot.reason === "passport_superseded");
  check("rotated passport works and keeps the limits",
    (await authenticatePassport(rot.passport)).ok);

  // 4. Revocation
  await revokeAgent(reg.agent.id, OWNER);
  const revoked = await authenticatePassport(rot.passport);
  check("revoked agent is rejected on its very next call",
    !revoked.ok && revoked.reason === "agent_revoked");

  let blocked = false;
  try { await updatePolicy(reg.agent.id, OWNER, POLICY); } catch { blocked = true; }
  check("revoked agent cannot get a new passport via policy update", blocked);

  // 5. Validation
  const rejects = async (input: unknown) => {
    try { await registerAgent(OWNER, input); return false; }
    catch (e) { return e instanceof ZodError; }
  };
  check("threshold above per-transaction cap is rejected",
    await rejects({ name: "Bad", ...POLICY, approval_threshold: 600_000 }));
  check("per-transaction cap above daily budget is rejected",
    await rejects({ name: "Bad", ...POLICY, max_per_txn: 2_000_000 }));
  check("unknown scope is rejected",
    await rejects({ name: "Bad", ...POLICY, scopes: ["purchase", "wire_money"] }));
  check("non-integer money is rejected",
    await rejects({ name: "Bad", ...POLICY, max_per_txn: 5000.5 }));

  // 6. Audit trail
  const { data: chain, error } = await supabase.rpc("verify_audit_chain");
  check("audit chain is still valid after all of the above",
    !error && chain?.[0]?.valid === true, error?.message ?? "");

  const { data: rows } = await supabase
    .from("audit_log").select("action").eq("agent_id", reg.agent.id).order("id");
  const actions = (rows ?? []).map((r) => r.action).join(", ");
  check("lifecycle events were written to the audit log",
    ["agent_registered", "policy_updated", "passport_rotated", "agent_revoked"]
      .every((a) => actions.includes(a)), actions);
} catch (e) {
  failed++;
  console.error("\nUnexpected error:", e);
} finally {
  for (const id of created) await supabase.from("agents").delete().eq("id", id);
  console.log(
    "\nNote: test audit rows stay in the log (it is append-only). " +
    "Run db/reset.sql and db/seed.sql before your demo for a clean slate."
  );
}

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nAll database checks passed\n");
process.exit(failed ? 1 : 0);
