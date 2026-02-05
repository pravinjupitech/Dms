import express from "express";
import { getCompanyTarget, getSalesManagerTarget, saveCompanyTarget } from "../controller/companyTarget.controller.js";
const router=express.Router();

router.post("/save-company-target",saveCompanyTarget)
router.get("/get-company-target/:fyear/:database",getCompanyTarget)
router.get("/get-salesmanager-target/:fyear/:salesManagerId",getSalesManagerTarget)

export default router;