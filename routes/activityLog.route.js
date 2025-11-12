import express from "express"
import { AddLog, updateLogTime, viewLogs } from "../controller/activityLog.controller.js";
const router=express.Router();

router.post("/save-log",AddLog)
router.post("/update-logOutTime",updateLogTime)
router.get("/view-logs/:database",viewLogs)
export default router;