import mongoose from "mongoose";
const TabSchemaDashboard = new mongoose.Schema({
    userId: {
        type: String
    },
    role: { type: String },
    cards: [{
        id: {
            type: String
        },
        title: {
            type: String
        },
        template: {
            type: String
        },
        groupKey: {
            type: String
        },
        groupName: {
            type: String
        },
        boxes: { type: Array }
    }],
}, { timestamps: true })

const TabSchema = new mongoose.Schema({
    userId: {
        type: String
    },
    tab: [{
        id: {
            type: String
        },
        title: {
            type: String
        },
        type: {
            type: String
        },
        icon: {
            type: String
        },
        navLink: {
            type: String
        }
    }], groupSize: {
        type: String
    }
}, { timestamps: true })

export const Tab = mongoose.model("tab", TabSchema)
export const DashboardTab = mongoose.model("dashboardTab", TabSchemaDashboard)