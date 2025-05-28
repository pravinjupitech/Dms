import express from "express";
import { saveExcelPincode, updatePincode, viewPincode } from "../controller/pincode.controller.js";
const router=express.Router()
import multer from "multer";
const uploads = multer({ dest: "public/ExcelFile/" })

router.post("/save-pincode-excel",uploads.single('file'),saveExcelPincode)
router.get("/view-pincode-list",viewPincode)
router.put("/update-pincode/:id",updatePincode)
export default router;