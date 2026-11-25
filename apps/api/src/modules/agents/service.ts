import { randomBytes } from "node:crypto";
import { supabase } from "../../supabase";
import { HttpError } from "../../middleware/errors";
import { issuePassport } from "../credentials/service";
import { audit } from "../audit/service";
import { policyUpdateSchema, registerSchema, rotateSchema } from "./schema";

async function getAgentOrThrow(id: string) {
  const { data, error } = await supabase.from("agents").select("*").eq("id", id).maybeSingle();
  if (error) throw new HttpError(500, "db_error", error.message);
  if (!data) throw new HttpError(404, "agent_not_found");
  return data;
}

async function getPolicyOrThrow(id: string) {
  const { data, error } = await supabase.from("policies").select("*").eq("agent_id", id).maybeSingle();
  if (error) throw new HttpError(500, "db_error", error.message);
  if (!data) throw new HttpError(404, "policy_not_found");
  return data;
}

async function bumpVersion(id: string): Promise<number> {
  const { data, error } = await supabase.rpc("bump_token_version", { p_agent: id });
  if (error || typeof data !== "number") {
    throw new HttpError(500, "db_error", error?.message ?? "bump_token_version returned nothing");
  }
  return data;
}

/** Register an agent + policy and return its FIRST passport (shown once, never stored). */
export async function registerAgent(owner: string, input: unknown) {
  const { name, ttl_seconds, ...policy } = registerSchema.parse(input);
  const id = `agent_${randomBytes(5).toString("hex")}`;

  const ins = await supabase.from("agents").insert({ id, name, owner }).select().single();
  if (ins.error) throw new HttpError(500, "db_error", ins.error.message);

  const pol = await supabase.from("policies").insert({ agent_id: id, ...policy }).select().single();
  if (pol.error) {
    await supabase.from("agents").delete().eq("id", id); // don't leave a half-registered agent
    throw new HttpError(500, "db_error", pol.error.message);
  }

  const { token, expires_at } = await issuePassport(ins.data, pol.data, ttl_seconds);
  await audit({
    agentId: id,
    action: "agent_registered",
    decision: "allowed",
    reason: "ok",
    payload: { owner, name, ...policy, ttl_seconds },
  });
  return { agent: ins.data, policy: pol.data, passport: token, expires_at };
}

export async function listAgents() {
  const { data, error } = await supabase
    .from("agents")
    .select("*, policies(*)")
    .order("created_at", { ascending: false });
  if (error) throw new HttpError(500, "db_error", error.message);
  return data;
}

export async function getAgent(id: string) {
  const agent = await getAgentOrThrow(id);
  const policy = await getPolicyOrThrow(id);
  return { agent, policy };
}

/** New limits => new passport. Bumping token_version kills every older passport. */
export async function updatePolicy(id: string, actor: string, input: unknown) {
  const { ttl_seconds, ...policy } = policyUpdateSchema.parse(input);
  const agent = await getAgentOrThrow(id);
  if (agent.status !== "active") throw new HttpError(409, "agent_revoked");

  const up = await supabase
    .from("policies")
    .upsert({ agent_id: id, ...policy, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (up.error) throw new HttpError(500, "db_error", up.error.message);

  const version = await bumpVersion(id);
  const { token, expires_at } = await issuePassport(
    { ...agent, token_version: version }, up.data, ttl_seconds
  );
  await audit({
    agentId: id,
    action: "policy_updated",
    decision: "allowed",
    reason: "ok",
    payload: { by: actor, ...policy, token_version: version },
  });
  return { agent: { ...agent, token_version: version }, policy: up.data, passport: token, expires_at };
}

/** Same limits, fresh passport. Use when a passport may have leaked. */
export async function rotatePassport(id: string, actor: string, input: unknown = {}) {
  const { ttl_seconds } = rotateSchema.parse(input);
  const agent = await getAgentOrThrow(id);
  if (agent.status !== "active") throw new HttpError(409, "agent_revoked");
  const policy = await getPolicyOrThrow(id);

  const version = await bumpVersion(id);
  const { token, expires_at } = await issuePassport(
    { ...agent, token_version: version }, policy, ttl_seconds
  );
  await audit({
    agentId: id,
    action: "passport_rotated",
    decision: "allowed",
    reason: "ok",
    payload: { by: actor, token_version: version },
  });
  return { agent: { ...agent, token_version: version }, policy, passport: token, expires_at };
}

/** Kill switch: the agent's very next call fails at pipeline step 2. */
export async function revokeAgent(id: string, actor: string) {
  await getAgentOrThrow(id);
  const { data, error } = await supabase
    .from("agents").update({ status: "revoked" }).eq("id", id).select().single();
  if (error) throw new HttpError(500, "db_error", error.message);
  await audit({
    agentId: id,
    action: "agent_revoked",
    decision: "allowed",
    reason: "ok",
    payload: { by: actor },
  });
  return data;
}
