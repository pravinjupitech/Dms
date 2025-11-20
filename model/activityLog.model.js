import mongoose from "mongoose";
const ActivityLogSchema = new mongoose.Schema({
    name: {
        type: String
    },
    date: {
        type: String
    },
    publicIP: {
        type: String
    },
    logInTime: {
        type: String
    },
    logOutTime: {
        type: String
    },
    latitude: {
        type: String
    },
    longitude: {
        type: String
    },
    roleName: {
        type: String
    },
    sessionId: {
        type: String
    },
    userId: {
        type: String
    },
    pincode: {
        type: String
    },
    city: {
        type: String
    },
    database: {
        type: String
    }
}, { timestamps: true });
export const ActivityLog = mongoose.model("ActivityLog", ActivityLogSchema)