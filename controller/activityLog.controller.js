import { ActivityLog } from "../model/activityLog.model.js";

export const AddLog = async (req, res, next) => {
    try {
        const log = await ActivityLog.create(req.body);
        return log ? res.status(200).json({ message: "Data Saved", status: true }) : res.status(404).json({ message: "Something Went Wrong", status: false })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", status: false })
    }
}

export const updateLogTime = async (req, res, next) => {
    try {
        const { userId, logOutTime, date } = req.body;
        const log = await ActivityLog.findOne({ userId: userId, date: date ,logOutTime:""});
        if (!log) {
            return res.status(404).json({ message: "Not Found", status: false })
        }
        log.logOutTime = logOutTime
        log.save();
        res.status(200).json({ message: "LogOut Time Saved", status: true })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", status: false })
    }
}

export const viewLogs = async (req, res, next) => {
    try {
        const { database } = req.params;
        const logs = await ActivityLog.find({ database: database });
        return logs.length > 0 ? res.status(200).json({ message: "Data Found",logs, status: true }) : res.status(404).json({ message: "Not Found", status: false })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", status: false })
    }
}