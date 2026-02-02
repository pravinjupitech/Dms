import e from "express";
import { getCompanySalesTarget, upsertCompanySalesTarget } from "../controller/companyTargetSales.controller.js";
const router = e.Router();

router.get("/", getCompanySalesTarget);
router.post("/upsert", upsertCompanySalesTarget);

export default router;
