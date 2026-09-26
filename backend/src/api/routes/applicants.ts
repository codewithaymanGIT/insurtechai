import { Router } from "express";
import { z } from "zod";
import { LOCATIONS } from "@insurtechai/shared";
import { listApplicants, getApplicantDetail, countApplicants } from "../../db/repository";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { tr } from "../../i18n";

export const applicantsRouter = Router();

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  insuranceType: z.enum(["HEALTH", "MOTOR", "PROPERTY", "LIFE"]).optional(),
  riskCategory: z.enum(["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"]).optional(),
  location: z.enum(LOCATIONS as unknown as [string, ...string[]]).optional(),
});

// GET /api/applicants: sample-portfolio policies, filterable and paginated
applicantsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const [rows, total] = await Promise.all([listApplicants(q), countApplicants(q)]);
    res.json({ total, limit: q.limit, offset: q.offset, applicants: rows });
  }),
);

// GET /api/applicants/:id
applicantsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const detail = await getApplicantDetail(req.params.id);
    if (!detail) throw new ApiError(404, tr("Policyholder not found."));
    res.json(detail);
  }),
);

export default applicantsRouter;
