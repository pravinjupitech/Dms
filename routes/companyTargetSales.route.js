import e from "express";
const router = e.Router();

import {
  getCompanySalesTarget,
  upsertCompanySalesTarget,
} from "../controller/companyTargetSales.controller.js";

router.get("/", getCompanySalesTarget);
router.post("/upsert", upsertCompanySalesTarget);

export default router;