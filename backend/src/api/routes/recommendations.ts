import { Router } from "express";
import { parseApplicantProfile } from "../validation";
import { assessRisk } from "../../engine/riskEngine";
import { assessFraud } from "../../engine/fraudEngine";
import { calculatePremium } from "../../engine/premiumEngine";
import { generateRecommendations } from "../../engine/recommendationEngine";
import { asyncHandler } from "../middleware/errorHandler";

export const recommendationsRouter = Router();

// POST /api/recommendations — Premium Optimizer: every applicable lever,
// genuinely re-simulated, ranked by savings-per-effort.
recommendationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const applicant = parseApplicantProfile(req.body);
    const risk = assessRisk(applicant);
    const fraud = assessFraud(applicant);
    const premium = calculatePremium(applicant, risk, fraud);
    const recommendations = generateRecommendations(applicant, premium.finalPremium);
    res.json({ currentPremium: premium.finalPremium, recommendations });
  }),
);

export default recommendationsRouter;
