import express from "express"
import { saveEmergencyInvoice, updateEmergencyInvoice, viewByIdEmergency, viewEmergencyInvoice } from "../controller/emergencyInvoice.controller.js";
const router=express.Router();

router.post("/save-invoice",saveEmergencyInvoice)
router.get("/view-invoice/:database",viewEmergencyInvoice)
router.put("/update-invoice/:id",updateEmergencyInvoice)
router.get("/view-by-id-invoice/:id",viewByIdEmergency)
export default router