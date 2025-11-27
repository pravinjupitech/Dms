import { Pincode } from "../model/pincode.model.js";
import ExcelJS from 'exceljs';
import fs from 'fs';

// export const saveExcelPincode = async (req, res, next) => {
//     const filePath = req.file?.path;
//     try {
//         if (!filePath) {
//             return res.status(400).json({ message: "No Excel file uploaded", status: false });
//         }
//         const workbook = new ExcelJS.Workbook();
//         await workbook.xlsx.readFile(filePath);
//         const worksheet = workbook.getWorksheet(1);
//         const headerRow = worksheet.getRow(1);
//         const headings = headerRow.values.slice(1);

//         const bulkData = [];

//         for (let rowIndex = 2; rowIndex <= worksheet.actualRowCount; rowIndex++) {
//             const row = worksheet.getRow(rowIndex);
//             const rowData = {};

//             headings.forEach((heading, i) => {
//                 const cell = row.getCell(i + 1);
//                 const value = cell.value;
//                 rowData[heading] = typeof value === 'object' && value?.text ? value.text : value;
//             });
//             if (rowData.pincode) {
//                 bulkData.push(rowData);
//             }
//         }

//         if (bulkData.length === 0) {
//             return res.status(400).json({ message: "No valid data found in Excel", status: false });
//         }

//         await Pincode.insertMany(bulkData);

//         // fs.unlinkSync(filePath);

//         return res.status(200).json({ message: "Pincode data added successfully", status: true });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             message: "Something went wrong during Excel import",
//             error: error.message,
//             status: false
//         });
//     }
// };


export const saveExcelPincodeLarge = async (req, res) => {
    const filePath = req.file?.path;

    if (!filePath) {
        return res.status(400).json({ message: "No Excel file uploaded", status: false });
    }

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath, { 
            entries: "emit", 
            sharedStrings: "cache", 
            styles: "cache" 
        });

        const worksheet = workbook.getWorksheet(1);
        const headerRow = worksheet.getRow(1);
        const headings = headerRow.values.slice(1);

        const BATCH_SIZE = 1000;
        let batch = [];
        let totalInserted = 0;
        let totalSkipped = 0;

        for (let rowIndex = 2; rowIndex <= worksheet.actualRowCount; rowIndex++) {
            const row = worksheet.getRow(rowIndex);
            const rowData = {};

            headings.forEach((heading, i) => {
                const cell = row.getCell(i + 1);
                const value = cell.value;
                rowData[heading] = typeof value === "object" && value?.text ? value.text : value;
            });

            if (rowData.pincode && rowData.city) {
                batch.push(rowData);
            }

            // Process batch
            if (batch.length >= BATCH_SIZE || rowIndex === worksheet.actualRowCount) {
                // Extract pincodes in batch
                const pincodes = [...new Set(batch.map(item => item.pincode.toString()))];

                // Fetch existing records
                const existingRecords = await Pincode.find({
                    pincode: { $in: pincodes }
                }).select("pincode city");

                const existingSet = new Set(existingRecords.map(item => `${item.pincode}_${item.city}`));

                // Filter new rows
                const newData = batch.filter(item => {
                    const key = `${item.pincode}_${item.city}`;
                    return !existingSet.has(key);
                });

                if (newData.length > 0) {
                    await Pincode.insertMany(newData);
                    totalInserted += newData.length;
                }

                totalSkipped += batch.length - newData.length;

                // Reset batch
                batch = [];
            }
        }

        return res.status(200).json({
            message: "Pincode data processed successfully",
            inserted: totalInserted,
            skipped: totalSkipped,
            status: true
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong during Excel import",
            error: error.message,
            status: false
        });
    }
};

export const viewPincode = async (req, res, next) => {
    try {
        const pinCodeList = await Pincode.find();
        return pinCodeList.length > 0 ? res.status(200).json({ message: "Data Found", status: true, pinCodeList }) : res.status(404).json({ message: "Something Went Wrong", status: false })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message,
            status: false
        });
    }
}
// export const viewPincode = async (req, res, next) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 100; // default 100 per page
//         const skip = (page - 1) * limit;

//         // optional search
//         const search = req.query.search || "";

//         const query = search
//             ? {
//                 $or: [
//                     { pincode: { $regex: search, $options: "i" } },
//                     { city: { $regex: search, $options: "i" } },
//                     { state: { $regex: search, $options: "i" } },
//                     { district: { $regex: search, $options: "i" } }
//                 ]
//             }
//             : {};

//         const [data, total] = await Promise.all([
//             Pincode.find(query).skip(skip).limit(limit),
//             Pincode.countDocuments(query)
//         ]);

//         return res.status(200).json({
//             message: "Data Found",
//             status: true,
//             currentPage: page,
//             totalPages: Math.ceil(total / limit),
//             totalRecords: total,
//             limit: limit,
//             data
//         });

//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             message: "Internal Server Error",
//             error: error.message,
//             status: false
//         });
//     }
// };

export const updatePincode = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { pincode } = req.body;
        const updatedPincode = await Pincode.findByIdAndUpdate(id, { pincode }, { new: true });
        return updatedPincode ? res.status(200).json({ message: "Pincode updated successfully", status: true }) : res.status(404).json({ message: "Not Found", status: false })
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message,
            status: false
        });
    }
}

export const deletePindcode = async (req, res, next) => {
    try {
        const { id } = req.params
        const pincode = await Pincode.findByIdAndDelete(id)
        return pincode ? res.status(200).json({ message: "Data Deleted", status: true }) : res.status(404).json({ message: "Not Found", status: false })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message,
            status: false
        });
    }
}

export const bulkDeletePincode = async (req, res, next) => {
    try {
        const { pinCodeList } = req.body;
        if (pinCodeList.length > 0) {
            for (let item of pinCodeList) {
                await Pincode.findByIdAndDelete(item.id);
            }
            return res.status(200).json({ message: "Data Deleted", status: true })
        } else {
            return res.status(404).json({ message: "Invalid Data", status: false })
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message,
            status: false
        });
    }
}