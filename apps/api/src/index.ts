import express from "express";
import cors from "cors";
import { config } from "./config";
import { supabase } from "./supabase";
import { errorHandler } from "./middleware/errors";
import { agentsRouter } from "./modules/agents/routes";
import { passportsRouter } from "./modules/credentials/routes";

const app = express();
app.use(cors());
app.use(express.json());

// Process is alive
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "agentos-api" });
});

// Database + SQL functions reachable (remove or protect before the demo)
app.get("/health/db", async (_req, res) => {
  const agents = await supabase.from("agents").select("id", { count: "exact" }).limit(1);
  if (agents.error) {
    return res.status(500).json({
      ok: false, step: "agents table",
      http_status: agents.status,
      error: agents.error.message,
      code: agents.error.code,
      details: agents.error.details,
      hint: "Did you run db/001_core_tables.sql and the grant block?",
    });
  }
  const chain = await supabase.rpc("verify_audit_chain");
  if (chain.error) {
    return res.status(500).json({
      ok: false, step: "verify_audit_chain()",
      error: chain.error.message,
      hint: "Did you run db/002 to db/004 in order?",
    });
  }
  res.json({ ok: true, agents: agents.count, audit_chain: chain.data });
});

app.use("/agents", agentsRouter);       // human-facing (Supabase Auth JWT)
app.use("/passports", passportsRouter); // passport introspection

app.use(errorHandler);

app.listen(config.API_PORT, () => {
  console.log(`AgentOS API listening on http://localhost:${config.API_PORT}`);
});
