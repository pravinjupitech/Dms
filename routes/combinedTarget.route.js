// 

// routes/customerTargetRoutes.js
import express from "express";
import {
  setCustomerTarget,
  getSalesPersonTarget,
  getSalesManagerTarget,
  getHierarchyByDatabase,
} from "../controller/combinedTarget.controller.js"

const router = express.Router();

router.post("/customer-target", setCustomerTarget);
router.post("/show-target",getHierarchyByDatabase)
router.post("/sales-person-target", getSalesPersonTarget);
router.get("/sales-manager-target/:salesManagerId/:financialYear", getSalesManagerTarget);

export default router;
