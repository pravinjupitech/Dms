import mongoose from "mongoose";
const planSchema=new mongoose.Schema({
    paymentImg:{
        type:String
    },
    plan:{
        type:String
    },
    amount:{
        type:Number
    },
    superAdmin:{
        type:String
    },
    status:{
        default:"Pending",
        type:String
    }
},{timestamps:true})
export const PlanRequest=mongoose.model("planRequest",planSchema)