import { Router } from "express";
import { DENIAL_REASONS } from "@agentos/shared";
import { asyncHandler } from "../../middleware/errors";
import { bearerToken } from "../../middleware/humanAuth";
import { authenticatePassport } from "./service";

export const passportsRouter = Router();

// Introspection for development and for the Phase 2 checkpoint.
// In Phase 3 the same function becomes steps 1-2 of the gateway pipeline.
passportsRouter.post("/verify", asyncHandler(async (req, res) => {
  const result = await authenticatePassport(bearerToken(req.headers.authorization));
  if (!result.ok) {
    return res.status(401).json({
      valid: false, reason: result.reason, detail: DENIAL_REASONS[result.reason],
    });
  }
  res.json({ valid: true, claims: result.claims });
}));
