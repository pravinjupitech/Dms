import mongoose from "mongoose";
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
    }]
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
    }]
}, { timestamps: true })

export const Tab = mongoose.model("tab", TabSchema)
export const DashboardTab = mongoose.model("dashboardTab", TabSchemaDashboard)