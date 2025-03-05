import express from "express"
import { addPlan, viewPlan } from "../controller/planRequest.controller.js";
const router=express.Router();

router.post("/add-request",addPlan);
router.get("/view-request",viewPlan)
export default router;