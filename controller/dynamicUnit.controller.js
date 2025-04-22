import { DynamicUnit } from "../model/dynamicUnit.model.js";

export const saveDynamicUnit = async (req, res, next) => {
    try {
        const savedUnits = await DynamicUnit.create(req.body);
        return savedUnits ? res.status(200).json({ message: "Data Saved", status: true }) : res.status(404).json({ message: "Somethings Went Wrong", status: false })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false })
    }
}

export const viewDynamicUnit = async (req, res, next) => {
    try {
        const dynamicUnit = await DynamicUnit.find({ database: req.body.database })
        return dynamicUnit.length > 0 ? res.status(200).json({ message: "Data Found", dynamicUnit, status: true }) : res.status(404).json({ message: "Not Found", status: false })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false })
    }
}

export const deleteDynamicUnit = async (req, res, next) => {
    try {
        const { id, innerId } = req.params;
        const dynamicUnit = await DynamicUnit.findById(id)
        if (!dynamicUnit) {
            return res.status(404).json({ message: "Not Found SuperAdmin Units", status: false })
        }
        dynamicUnit.Units = dynamicUnit.Units.filter((item) => item._id !== innerId)
        await dynamicUnit.save();
        res.status(200).json({ message: "Unit Deleted", status: false })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false })
    }
}