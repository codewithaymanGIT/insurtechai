import { Router } from "express";
import { parseApplicantProfile } from "../validation";
import { assessRisk } from "../../engine/riskEngine";
import { assessFraud } from "../../engine/fraudEngine";
import { calculatePremium } from "../../engine/premiumEngine";
import { asyncHandler } from "../middleware/errorHandler";

export const premiumRouter = Router();

// POST /api/premium/calculate — premium only, no persistence (used by live
// recalculation in the UI, e.g. the What-If Simulator's non-committal preview)
premiumRouter.post(
  "/calculate",
  asyncHandler(async (req, res) => {
    const applicant = parseApplicantProfile(req.body);
    const risk = assessRisk(applicant);
    const fraud = assessFraud(applicant);
    const premium = calculatePremium(applicant, risk, fraud);
    res.json({ risk, fraud, premium });
  }),
);

export default premiumRouter;
