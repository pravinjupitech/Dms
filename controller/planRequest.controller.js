import { PlanRequest } from "../model/planRequest.model.js";

export const addPlan=async(req,res,next)=>{
    try {
        const plan=await PlanRequest.create(req.body);
        return plan ?res.status(200).json({message:"Request Added",status:true}):res.status(404).json({message:"Something Went Wrong",status:false})
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error",error:error.message,status:false})
    }
}

export const viewPlan=async(req,res,next)=>{
    try {
        const plan=await PlanRequest.find();
        return plan.length>0?res.status(200).json({message:"Data Found",plan,status:true}):res.status(404).json({message:"Not Found",status:false})
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Internal Server Error",error:error.message,status:false})    
    }
}