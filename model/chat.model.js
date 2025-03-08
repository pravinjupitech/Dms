import mongoose from "mongoose";
const chatSchema=new mongoose.Schema({
    superadmin: {
        type: String,
      },
      messages: {
        type: Array,
      },
      date: {
        type: String,
        default: Date.now,
      },
},{timestamps:true})
export const Chat=mongoose.model("chat",chatSchema)