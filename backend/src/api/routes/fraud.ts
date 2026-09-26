import { Router } from "express";
import { parseApplicantProfile } from "../validation";
import { assessFraud } from "../../engine/fraudEngine";
import { asyncHandler } from "../middleware/errorHandler";

export const fraudRouter = Router();

// POST /api/fraud/analyze — standalone anomaly check (e.g. analyst re-running
// fraud detection on an edited profile without a full risk/premium re-run)
fraudRouter.post(
  "/analyze",
  asyncHandler(async (req, res) => {
    const applicant = parseApplicantProfile(req.body);
    const fraud = assessFraud(applicant);
    res.json(fraud);
  }),
);

export default fraudRouter;
