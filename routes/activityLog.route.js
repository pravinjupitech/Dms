import express from "express"
import { AddLog, updateLogTime } from "../controller/activityLog.controller.js";
const router=express.Router();

router.post("/save-log",AddLog)
router.post("/update-logOutTime",updateLogTime)
export default router;