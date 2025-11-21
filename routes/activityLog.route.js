import express from "express"
import { AddLog, checkPincode, deleteAllLogs, deleteLog, updateLogTime, viewLogs } from "../controller/activityLog.controller.js";
const router=express.Router();

router.post("/save-log",AddLog)
router.post("/update-logOutTime",updateLogTime)
router.get("/view-logs/:database",viewLogs)
router.delete("/delete-all",deleteAllLogs)
router.delete("/delete-logs/:id",deleteLog)
router.post("/check-logs",checkPincode)
export default router;