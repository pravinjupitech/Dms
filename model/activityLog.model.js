import mongoose from "mongoose";
const ActivityLogSchema = new mongoose.Schema({
    name: {
        type: String
    },
    date: {
        type: String
    },
    logInTime: {
        type: String
    },
    logOutTime: {
        type: String
    },
    roleName: {
        type: String
    },
    userId: {
        type: String
    }
}, { timestamps: true });
export const ActivityLog = mongoose.model("ActivityLog", ActivityLogSchema)