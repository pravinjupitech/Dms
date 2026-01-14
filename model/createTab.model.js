import mongoose from "mongoose";
import { type } from "os";
const TabSchemaDashboard = new mongoose.Schema({
    userId: {
        type: String
    },
    tab: [{
        key: {
            type: Number
        },
        value: [{
            key: {
                type: Number
            },
            Name: {
                type: String
            },
            show: {
                type: Boolean
            }
        }],
        Name: {
            type: String
        },
        show: {
            type: Boolean
        }
    }], groupSize: {
        type: String
    }, selectedLayout: {
        type: String
    }, isCombined: {
        type: String
    }
}, { timestamps: true })

const TabSchema = new mongoose.Schema({
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

export const Tab = mongoose.model("tab", TabSchema)
export const DashboardTab = mongoose.model("dashboardTab", TabSchemaDashboard)