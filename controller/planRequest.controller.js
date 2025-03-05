import { PlanRequest } from "../model/planRequest.model.js";
import { Subscription } from "../model/subscription.model.js";
import { User } from "../model/user.model.js";

export const addPlan = async (req, res, next) => {
    try {
        if (req.file) {
            req.body.paymentImg = req.file.filename;
        }
        const plan = await PlanRequest.create(req.body);
        return plan ? res.status(200).json({ message: "Request Added", status: true }) : res.status(404).json({ message: "Something Went Wrong", status: false })
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Internal Server Error", error: error.message, status: false })
    }
}

export const viewPlan = async (req, res, next) => {
    try {
        const plan = await PlanRequest.find();
        return plan.length > 0 ? res.status(200).json({ message: "Data Found", plan, status: true }) : res.status(404).json({ message: "Not Found", status: false })
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Internal Server Error", error: error.message, status: false })
    }
}

export const updatePlan = async (req, res, next) => {
    try {
        const { id } = req.params;
        const existingPlan = await PlanRequest.findById(id);
        if (!existingPlan) {
            return res.status(404).json({ message: "Not Found", status: false })
        }
        if (req.body.status === "Approved") {
            const user = await User.findById(existingPlan.superAdmin);
            if (user) {
                const sub = await Subscription.findById({ _id: req.body.plan })
                if (sub) {
                    // const { _id, ...subWithoutId } = sub.toObject();
                    const date = new Date();
                    user.planStart = date;
                    user.planEnd = new Date(date.getTime() + (sub.days * 24 * 60 * 60 * 1000));
                    user.billAmount = sub.subscriptionCost
                    user.userAllotted = sub.noOfUser
                }
            }
            await user.save();
        }
        res.status(200).json({ message: "Status Updated", status: true })
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Internal Server Error", error: error.message, status: false })
    }
}