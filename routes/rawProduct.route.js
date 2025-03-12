import express, { Router } from "express";
import { addRawProduct, DeleteRawProduct, UpdateRawProduct, updateRawProductStep, viewRawCurrentStock, ViewRawProduct, ViewRawProductById } from "../controller/rawProduct.controller.js";
const router=express.Router();

router.post("/save-rawProduct",addRawProduct)
router.get("/view-rawProduct/:database",ViewRawProduct)
router.get("/view-by-rawProduct/:id",ViewRawProductById)
router.delete("/delete-rawProduct/:id",DeleteRawProduct)
router.put("/update-rawProduct/:id",UpdateRawProduct)
router.get("/view-currentStock/:id/:productId",viewRawCurrentStock)
router.post("/update-rawProduct-step",updateRawProductStep)
export default router;