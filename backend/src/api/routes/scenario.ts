import { Router } from "express";
import { parseScenarioRequest } from "../validation";
import { runFullAssessment } from "../../engine/assess";
import { asyncHandler } from "../middleware/errorHandler";
import { ScenarioSimulationResult } from "@insurtechai/shared";

export const scenarioRouter = Router();

// POST /api/scenario/simulate — What-If Simulator / Risk Digital Twin core endpoint.
// Runs the SAME engines on baseline vs modified profiles so the comparison is
// a genuine re-simulation, not an interpolation.
scenarioRouter.post(
  "/simulate",
  asyncHandler(async (req, res) => {
    const { baseline, modified } = parseScenarioRequest(req.body);

    const baselineResult = runFullAssessment(baseline);
    const scenarioResult = runFullAssessment(modified);

    const premiumDelta = scenarioResult.premium.finalPremium - baselineResult.premium.finalPremium;
    const response: ScenarioSimulationResult = {
      baseline: baselineResult,
      scenario: scenarioResult,
      riskScoreDelta: scenarioResult.risk.riskScore - baselineResult.risk.riskScore,
      premiumDelta,
      premiumSavingsPercent: Math.round((-premiumDelta / baselineResult.premium.finalPremium) * 1000) / 10,
      riskCategoryChanged: scenarioResult.risk.riskCategory !== baselineResult.risk.riskCategory,
    };

    res.json(response);
  }),
);

export default scenarioRouter;
