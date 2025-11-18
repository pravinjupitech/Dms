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
        const { userId, logOutTime } = req.body;

        const log = await ActivityLog.findOne({
            userId: userId,
            logOutTime: { $in: ["", null] }
        }).sort({ createdAt: -1 });

        if (!log) {
            return res.status(404).json({ 
                message: "No active session found for logout",
                status: false 
            });
        }

        log.logOutTime = logOutTime;
        await log.save();

        return res.status(200).json({
            message: "Logout time saved successfully",
            status: true
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal Server Error",
            status: false
        });
    }
}

export const viewLogs = async (req, res, next) => {
    try {
        const { database } = req.params;
        const logs = await ActivityLog.find({ database: database });
        return logs.length > 0 ? res.status(200).json({ message: "Data Found", logs, status: true }) : res.status(404).json({ message: "Not Found", status: false })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", status: false })
    }
}

export const deleteAllLogs = async (req, res, next) => {
    try {
        const { logs } = req.body;

        if (!Array.isArray(logs) || logs.length === 0) {
            return res.status(400).json({ message: "No logs provided", status: false });
        }

        await ActivityLog.deleteMany({ _id: { $in: logs } });

        return res.status(200).json({ message: "Deleted Successfully", status: true });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", status: false })
    }
}

export const deleteLog = async (req, res, next) => {
    try {
        const { id } = req.params;
        const log = await ActivityLog.findByIdAndDelete(id);
        return log ? res.status(200).json({ message: "Data Deleted", status: true }) : res.status(404).json({ message: "Something Went Wrong", status: false })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", status: false })
    }
}