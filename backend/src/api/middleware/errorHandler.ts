import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { tr } from "../../i18n";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function asyncHandler(fn: (req: Request, res: Response) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: tr("Request payload failed validation."),
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }
  const bodyErr = err as { type?: string; status?: number };
  if (bodyErr?.type === "entity.parse.failed") {
    res.status(400).json({ error: "BAD_JSON", message: tr("Request body isn't valid JSON.") });
    return;
  }
  if (bodyErr?.type === "entity.too.large") {
    res.status(413).json({ error: "TOO_LARGE", message: tr("Request body is too large.") });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: "API_ERROR", message: err.message });
    return;
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "INTERNAL_ERROR", message: tr("An unexpected error occurred.") });
}
