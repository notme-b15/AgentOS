import type { RequestHandler } from "express";
import { supabase } from "../supabase";
import { asyncHandler, HttpError } from "./errors";

export interface Human {
  id: string;
  email: string;
}

export function bearerToken(header: string | undefined): string {
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** Dashboard / owner calls: must carry a valid Supabase Auth session JWT. */
export const requireHuman: RequestHandler = asyncHandler(async (req, res, next) => {
  const token = bearerToken(req.headers.authorization);
  if (!token) throw new HttpError(401, "missing_bearer_token");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) throw new HttpError(401, "invalid_human_session");

  res.locals.human = { id: data.user.id, email: data.user.email } satisfies Human;
  next();
});
