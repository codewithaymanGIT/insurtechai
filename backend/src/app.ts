// The Express app, without listen(), so tests can drive it in-process.
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";

import { riskRouter } from "./api/routes/risk";
import { premiumRouter } from "./api/routes/premium";
import { scenarioRouter } from "./api/routes/scenario";
import { fraudRouter } from "./api/routes/fraud";
import { aiRouter } from "./api/routes/ai";
import { recommendationsRouter } from "./api/routes/recommendations";
import { applicantsRouter } from "./api/routes/applicants";
import { dashboardRouter } from "./api/routes/dashboard";
import { authRouter } from "./api/routes/auth";
import { meRouter } from "./api/routes/me";
import { adminRouter } from "./api/routes/admin";
import { errorHandler } from "./api/middleware/errorHandler";
import { loadSession, requireAuth, checkOrigin } from "./auth/middleware";
import { authConfig, isProduction } from "./auth/config";
import { langMiddleware, tr } from "./i18n";

export const app = express();

// Behind a reverse proxy / PaaS load balancer, trust the first hop so
// req.ip (used for rate limiting) is the visitor's address, not the proxy's.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Google Identity Services, per Google's documented CSP requirements
        scriptSrc: ["'self'", "https://accounts.google.com/gsi/client"],
        frameSrc: ["https://accounts.google.com/gsi/"],
        connectSrc: ["'self'", "https://accounts.google.com/gsi/"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com/gsi/style"],
        imgSrc: ["'self'", "data:", "https://*.googleusercontent.com"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    // Google's sign-in popup needs these two relaxed from helmet's defaults.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);
app.use(cors({ origin: [...authConfig.allowedOrigins], credentials: true }));
// Language first, so rate-limit, body-parser and origin errors are translated too.
app.use(langMiddleware);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
if (process.env.NODE_ENV !== "test") app.use(morgan(isProduction ? "combined" : "dev"));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  message: () => ({ error: "RATE_LIMITED", message: tr("Too many requests. Please slow down.") }),
});

app.use("/api", apiLimiter, checkOrigin, loadSession);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Public: anyone can get an estimate
app.use("/api/risk-assessment", riskRouter);
app.use("/api/premium", premiumRouter);
app.use("/api/scenario", scenarioRouter);
app.use("/api/fraud", fraudRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/ai", aiRouter); // /chat inside requires sign-in
app.use("/api/auth", authRouter);

// Signed-in only
app.use("/api/me", meRouter);
app.use("/api/applicants", requireAuth, applicantsRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);
app.use("/api/admin", adminRouter);

app.use("/api", (req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: tr("No route for {method} {url}", { method: req.method, url: req.originalUrl }) });
});

// In production, serve the built frontend from the same origin so cookies,
// CSP and CORS all stay simple (one deployable service).
const frontendDist = path.resolve(__dirname, "..", "..", "frontend", "dist");
if (isProduction && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: false, maxAge: "1h" }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
}

app.use(errorHandler);

