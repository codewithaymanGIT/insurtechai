import { Router } from "express";
import { parseApplicantProfile } from "../validation";
import { runFullAssessment } from "../../engine/assess";
import { explainRiskFactors } from "../../engine/advisor";
import { asyncHandler } from "../middleware/errorHandler";
import { db } from "../../db/client";
import * as schema from "../../db/schema";

export const riskRouter = Router();

// POST /api/risk-assessment: full pipeline. Works without an account; when the
// visitor is signed in, the estimate is also saved to their own history.
// Visitor data is never written to the sample-portfolio tables.
riskRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const applicant = parseApplicantProfile(req.body);
    const result = runFullAssessment(applicant);
    const explanation = explainRiskFactors(result);

    const response = { ...result, explanation };

    let savedId: string | null = null;
    // ?save=0: recalculating an existing estimate (e.g. to show it in another language)
    if (req.user && req.query.save !== "0") {
      const row = await db
        .insert(schema.savedAssessments)
        .values({
          userId: req.user.id,
          insuranceType: applicant.policy.insuranceType,
          riskScore: result.risk.riskScore,
          finalPremium: result.premium.finalPremium,
          applicantJson: JSON.stringify(applicant),
          resultJson: JSON.stringify(response),
          createdAt: new Date().toISOString(),
        })
        .returning({ id: schema.savedAssessments.id })
        .get();
      savedId = row.id;
    }

    res.status(201).json({ ...response, savedId });
  }),
);

export default riskRouter;
