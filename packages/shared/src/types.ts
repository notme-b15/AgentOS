import type { SCOPES, DENIAL_REASONS } from "./constants";

export type Scope = (typeof SCOPES)[number];
export type DenialReason = keyof typeof DENIAL_REASONS;
export type AgentStatus = "active" | "revoked";
export type Decision = "allowed" | "blocked" | "pending";

/** Everything the gateway needs to enforce lives INSIDE the signed token. */
export interface PassportClaims {
  sub: string;                 // agent id
  scopes: Scope[];
  max_per_txn: number;         // paise
  daily_budget: number;        // paise
  approval_threshold: number;  // paise
  owner: string;
  ver: number;                 // must match agents.token_version
  jti?: string;
  iss?: string;
  iat?: number;
  exp?: number;
}

export interface Product {
  id: string;
  name: string;
  merchant: string;
  price_paise: number;
  description: string;
}

export type GatewayResponse =
  | { ok: true; result: unknown }
  | { ok: false; reason: DenialReason; detail?: string; approval_id?: string };

export interface AuditRow {
  id: number;
  agent_id: string | null;
  action: string;
  decision: Decision;
  reason: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  prev_hash: string;
  hash: string;
}

export interface Policy {
  agent_id: string;
  scopes: Scope[];
  max_per_txn: number;         // paise
  daily_budget: number;        // paise
  approval_threshold: number;  // paise
  updated_at: string;
}

export interface Agent {
  id: string;
  name: string;
  owner: string;
  status: AgentStatus;
  token_version: number;
  created_at: string;
}
