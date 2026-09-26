import { Router } from "express";
import { getDashboardRows, getAllClaims } from "../../db/repository";
import {
  computeKpis, riskDistribution, premiumDistribution, claimsByMonth,
  riskVsPremium, customerSegmentation, geographicRisk, fraudTrends,
} from "../../services/dashboardService";
import { asyncHandler } from "../middleware/errorHandler";

export const dashboardRouter = Router();

// GET /api/dashboard — everything the Portfolio Analytics Dashboard needs in
// one call, computed live from the current database contents.
dashboardRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [rows, claims] = await Promise.all([getDashboardRows(), getAllClaims()]);

    res.json({
      kpis: computeKpis(rows, claims),
      riskDistribution: riskDistribution(rows),
      premiumDistribution: premiumDistribution(rows),
      claimsByMonth: claimsByMonth(claims),
      riskVsPremium: riskVsPremium(rows),
      customerSegments: customerSegmentation(rows),
      geographicRisk: geographicRisk(rows),
      fraudTrends: fraudTrends(rows),
    });
  }),
);

export default dashboardRouter;
