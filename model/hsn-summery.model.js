import mongoose from "mongoose";

const hsnSummerySchema = new mongoose.Schema({
    database: {
        type: String
    },
    financeYear: {
        type: String
    },
    type: {
        type: String,
        required: true
    },
    taxAmount: {
        type: Number
    },
    particular: {
        type: String
    },
    gstin: {
        type: String
    },
    roundOff: {
        type: Number
    },
    sgstAmount: {
        type: Number
    },
    cgstAmount: {
        type: Number
    },
    igstAmount: {
        type: Number
    },
    hsn: {
        type: String
    },
    gstRate: {
        type: String
    },
    taxableAmount: {
        type: Number
    },
    grandTotal: {
        type: Number
    },
    qty: {
        type: Number
    },
    Description: {
        type: String,
    },
    UQC: {
        type: String
    }
}, { timestamps: true })

export const hsn_summery = mongoose.model("hsnsummery", hsnSummerySchema)