import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { PASSPORT_ISSUER, SCOPES, type DenialReason, type PassportClaims } from "@agentos/shared";
import { getKeys } from "../../crypto/keys";
import { supabase } from "../../supabase";

export const DEFAULT_TTL_SECONDS = 2 * 60 * 60;

/** A token can be validly SIGNED yet malformed, so claims are checked too. */
const claimsSchema = z.object({
  sub: z.string().min(1),
  scopes: z.array(z.enum(SCOPES)),
  max_per_txn: z.number().int().nonnegative(),
  daily_budget: z.number().int().nonnegative(),
  approval_threshold: z.number().int().nonnegative(),
  owner: z.string(),
  ver: z.number().int().positive(),
  jti: z.string().optional(),
  iss: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export interface PassportAgent { id: string; owner: string; token_version: number }
export interface PassportPolicy {
  scopes: string[];
  max_per_txn: number;
  daily_budget: number;
  approval_threshold: number;
}

/** Sign a passport. Scopes and limits are baked INTO the token. */
export async function issuePassport(
  agent: PassportAgent,
  policy: PassportPolicy,
  ttlSeconds = DEFAULT_TTL_SECONDS
) {
  const { priv } = await getKeys();
  const token = await new SignJWT({
    scopes: policy.scopes,
    max_per_txn: policy.max_per_txn,
    daily_budget: policy.daily_budget,
    approval_threshold: policy.approval_threshold,
    owner: agent.owner,
    ver: agent.token_version,
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
    .setSubject(agent.id)
    .setIssuer(PASSPORT_ISSUER)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(priv);

  return { token, expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString() };
}

/** Cryptographic check only: signature, issuer, expiry, claim shape. No database. */
export async function verifyPassport(token: string): Promise<PassportClaims> {
  const { pub } = await getKeys();
  const { payload } = await jwtVerify(token, pub, {
    issuer: PASSPORT_ISSUER,
    algorithms: ["EdDSA"],
  });
  return claimsSchema.parse(payload) as PassportClaims;
}

export type AuthResult =
  | { ok: true; claims: PassportClaims }
  | { ok: false; reason: DenialReason };

/**
 * Steps 1 and 2 of the gateway pipeline (reused in Phase 3):
 *   1. signature + expiry + claim shape  -> from the token itself
 *   2. agent still active, token version current -> the ONLY database lookup
 * Fails closed: any unexpected error is a denial.
 */
export async function authenticatePassport(token: string): Promise<AuthResult> {
  let claims: PassportClaims;
  try {
    claims = await verifyPassport(token);
  } catch {
    return { ok: false, reason: "invalid_or_expired_token" };
  }

  const { data: agent, error } = await supabase
    .from("agents")
    .select("status, token_version")
    .eq("id", claims.sub)
    .maybeSingle();

  if (error) return { ok: false, reason: "internal_error" };
  if (!agent || agent.status !== "active") return { ok: false, reason: "agent_revoked" };
  if (agent.token_version !== claims.ver) return { ok: false, reason: "passport_superseded" };

  return { ok: true, claims };
}
