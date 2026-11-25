import { Router } from "express";
import { asyncHandler } from "../../middleware/errors";
import { requireHuman, type Human } from "../../middleware/humanAuth";
import {
  getAgent, listAgents, registerAgent, revokeAgent, rotatePassport, updatePolicy,
} from "./service";

export const agentsRouter = Router();
agentsRouter.use(requireHuman); // every route here needs a logged-in human

const human = (res: { locals: Record<string, unknown> }) => res.locals.human as Human;

// Owner always comes from the verified session, never from the request body
agentsRouter.post("/", asyncHandler(async (req, res) => {
  const out = await registerAgent(human(res).email, req.body);
  res.status(201).json({
    ...out,
    note: "The passport is shown once and is not stored. Keep it secret.",
  });
}));

agentsRouter.get("/", asyncHandler(async (_req, res) => {
  res.json(await listAgents());
}));

agentsRouter.get("/:id", asyncHandler(async (req, res) => {
  res.json(await getAgent(req.params.id));
}));

agentsRouter.put("/:id/policy", asyncHandler(async (req, res) => {
  res.json(await updatePolicy(req.params.id, human(res).email, req.body));
}));

agentsRouter.post("/:id/passport", asyncHandler(async (req, res) => {
  res.json(await rotatePassport(req.params.id, human(res).email, req.body));
}));

agentsRouter.post("/:id/revoke", asyncHandler(async (req, res) => {
  res.json(await revokeAgent(req.params.id, human(res).email));
}));
