import type { Decision } from "@agentos/shared";
import { supabase } from "../../supabase";

export interface AuditEntry {
  agentId: string | null;
  action: string;
  decision: Decision;
  reason?: string | null;
  payload?: Record<string, unknown>;
}

/** Every append goes through the SQL function so the hash chain stays valid. */
export async function audit(entry: AuditEntry) {
  const { error } = await supabase.rpc("append_audit", {
    p_agent: entry.agentId,
    p_action: entry.action,
    p_decision: entry.decision,
    p_reason: entry.reason ?? null,
    p_payload: entry.payload ?? {},
  });
  if (error) throw new Error(`audit append failed: ${error.message}`);
}
