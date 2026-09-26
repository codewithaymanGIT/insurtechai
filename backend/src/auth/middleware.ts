import type { Request, Response, NextFunction } from "express";
import { readSession, type SessionUser } from "./sessions";
import { authConfig } from "./config";
import { tr } from "../i18n";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
    }
  }
}

/** Attaches req.user when a valid session cookie is present. Never rejects. */
export function loadSession(req: Request, res: Response, next: NextFunction) {
  readSession(req, res)
    .then((s) => {
      if (s) {
        req.user = s.user;
        req.sessionId = s.sessionId;
      }
      next();
    })
    .catch(next);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "UNAUTHENTICATED", message: tr("Please sign in to continue.") });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "FORBIDDEN", message: tr("You don't have access to this.") });
    return;
  }
  next();
}

/** Rejects state-changing requests whose Origin header is present but not
 * ours. SameSite=Lax cookies already block most cross-site requests; this
 * closes the remaining gaps (e.g. older browsers, same-site subdomains). */
export function checkOrigin(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const origin = req.get("origin");
  if (origin && !authConfig.allowedOrigins.has(origin)) {
    res.status(403).json({ error: "FORBIDDEN_ORIGIN", message: tr("Request origin not allowed.") });
    return;
  }
  next();
}
