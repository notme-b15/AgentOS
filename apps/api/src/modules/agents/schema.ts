import { z } from "zod";
import { SCOPES } from "@agentos/shared";

const money = z.number().int().positive(); // integer paise
const ttl = z.number().int().min(1).max(7 * 24 * 3600).default(2 * 60 * 60);

const policyFields = z.object({
  scopes: z
    .array(z.enum(SCOPES))
    .min(1)
    .refine((a) => new Set(a).size === a.length, "duplicate scopes"),
  max_per_txn: money,
  daily_budget: money,
  approval_threshold: money,
});

type Limits = { max_per_txn: number; daily_budget: number; approval_threshold: number };

// Keeps limits coherent: threshold <= per-transaction cap <= daily budget
function limitChecks(p: Limits, ctx: z.RefinementCtx) {
  if (p.approval_threshold > p.max_per_txn) {
    ctx.addIssue({ code: "custom", path: ["approval_threshold"], message: "must be <= max_per_txn" });
  }
  if (p.max_per_txn > p.daily_budget) {
    ctx.addIssue({ code: "custom", path: ["max_per_txn"], message: "must be <= daily_budget" });
  }
}

export const registerSchema = policyFields
  .extend({ name: z.string().trim().min(1).max(80), ttl_seconds: ttl })
  .superRefine(limitChecks);

export const policyUpdateSchema = policyFields
  .extend({ ttl_seconds: ttl })
  .superRefine(limitChecks);

export const rotateSchema = z.object({ ttl_seconds: ttl });
