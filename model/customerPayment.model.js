import mongoose from "mongoose";
const customerPaymentSchema = new mongoose.Schema({
    database: {
        type: String
    },
     created_by: {
        type: String
    },
    paymentMode:{
        type:String
    },
    remark:{
        type:String
    },
    date: {
        type: Date
    },
    partyId: {
        type: String
    },
    userId: {
        type: String
    },
    type: {
        type: String
    },
    amount: {
        type: Number
    },
    otpDateTime: {
        type: String
    }
}, { timestamps: true });
export const CustomerPayment = mongoose.model("customerpayment", customerPaymentSchema)