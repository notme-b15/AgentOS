import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

// Express 4 does not catch rejected promises, so wrap async handlers
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ ok: false, error: "validation_failed", issues: err.flatten() });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ ok: false, error: err.code, message: err.message });
  }
  console.error(err);
  res.status(500).json({ ok: false, error: "internal_error" });
};
