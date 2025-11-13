import express from "express"
import { AddLog, deleteAllLogs, deleteLog, updateLogTime, viewLogs } from "../controller/activityLog.controller.js";
const router=express.Router();

router.post("/save-log",AddLog)
router.post("/update-logOutTime",updateLogTime)
router.get("/view-logs/:database",viewLogs)
router.delete("/delete-all",deleteAllLogs)
router.delete("/delete-logs/:id",deleteLog)
export default router;