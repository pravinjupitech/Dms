import express from "express";
import { deleteCompanyTargetById, getCompanyTarget, getSalesManagerTarget, saveCompanyTarget, updateCompanyTarget } from "../controller/companyTarget.controller.js";
const router=express.Router();

router.post("/save-company-target",saveCompanyTarget)
router.get("/get-company-target/:fyear/:database",getCompanyTarget)
router.get("/get-salesmanager-target/:fyear/:salesManagerId",getSalesManagerTarget)
router.delete("/delete-comapany-target/:id",deleteCompanyTargetById)
router.put("/update-target",updateCompanyTarget)
export default router;