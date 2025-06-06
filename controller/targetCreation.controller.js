import axios from "axios";
import { TargetCreation } from "../model/targetCreation.model.js";
import { Product } from "../model/product.model.js";
import { User } from "../model/user.model.js";
import { getUserHierarchyBottomToTop } from "../rolePermission/RolePermission.js";
import { Customer } from "../model/customer.model.js";
import { CreateOrder } from "../model/createOrder.model.js";
import moment from "moment";
import { Role } from "../model/role.model.js";
import xlsx from "xlsx";
import ExcelJS from 'exceljs'
import fs from 'fs/promises';
import { populate } from "dotenv";
const uniqueId = new Set();
const uniqueUserId = new Set();
const emptyObj = {};


export const SaveTargetCreation1 = async (req, res) => {
    try {
        const party = await Customer.findById({ _id: req.body.partyId });
        const user = await User.findById({ _id: req.body.created_by });
        if (!user) {
            return res.status(400).json({ message: "User Not Found", status: false });
        }
        req.body.database = user.database;
        const target = await TargetCreation.create(req.body)
        const existingTarget = await TargetCreation.find({ userId: party.created_by }).sort({ sortorder: -1 })
        const tar = existingTarget[existingTarget.length - 1];
        if (tar) {
            for (let product of tar.products) {
                const existingProduct = req.body.products.find(p => p.productId === product.productId);
                console.log("existing" + existingProduct)
                if (existingProduct) {
                    existingProduct.qtyAssign += product.qtyAssign;
                    existingProduct.totalPrice = (product.qtyAssign * product.price);
                } else {
                    tar.products.push(product);
                }
            }
            tar.grandTotal += req.body.grandTotal;
            await existingTarget.save();
        }
        req.body.partyId = undefined;
        req.body.created_by = undefined;
        req.body.userId = await party.created_by;
        const newTarget = await TargetCreation.create(req.body);
        return (target && newTarget) ? res.status(200).json({ message: "Target save successfully", status: true }) : res.status(400).json({ message: "Something Went Wrong", status: false })
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
// save target start assign party and salesPerson
export const SaveTargetCreation555 = async (req, res) => {
    try {
        const party = await Customer.findById(req.body.partyId);
        const user = await User.findById(req.body.created_by);
        if (!user) {
            return res.status(400).json({ message: "User Not Found", status: false });
        }
        req.body.database = user.database;
        const target = await TargetCreation.create(req.body);
        const existingTargets = await TargetCreation.find({ userId: party.created_by }).sort({ sortorder: -1 });
        const lastTarget = existingTargets[existingTargets.length - 1];
        if (lastTarget) {
            for (let product of req.body.products) {
                const existingProduct = lastTarget.products.find(p => p.productId === product.productId);
                if (existingProduct) {
                    existingProduct.qtyAssign += product.qtyAssign;
                    existingProduct.totalPrice = existingProduct.qtyAssign * existingProduct.price;
                } else {
                    lastTarget.products.push(product);
                }
            }
            lastTarget.grandTotal += req.body.grandTotal;
            await lastTarget.save();
            await TargetAssignUser(party.created_by, req.body.grandTotal)
        } else {
            req.body.partyId = undefined;
            req.body.created_by = undefined;
            req.body.userId = party.created_by;
            const newTarget = await TargetCreation.create(req.body);
            await TargetAssignUser(party.created_by, req.body.grandTotal)
        }
        return res.status(200).json({ message: "Target saved successfully", status: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
// save target start from salesPerson

export const SaveTargetCreation = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Excel file is required" });
        }

        const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
            return res.status(400).json({ message: "Excel file is empty" });
        }

        const userId = rows[0].userId;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: "User Not Found" });
        }

        const products = rows
            .filter(row => row.qtyAssign != null && Number(row.qtyAssign) > 0)
            .map(row =>
                console.log("row", row)
                    ({
                        productId: row.productId,
                        qtyAssign: Number(row.qtyAssign),
                        price: Number(row.price) || 0,
                        totalPrice: Number(row.totalPrice) || 0,
                        assignPercentage: (row.month != null && row.percentage != null)
                            ? [{
                                month: Number(row.month),
                                percentage: Number(row.percentage)
                            }]
                            : []
                    }));

        if (products.length === 0) {
            return res.status(400).json({ message: "No valid products with qtyAssign found." });
        }
        const grandTotal = products.reduce((sum, p) => sum + (p.totalPrice || 0), 0);
        console.log("products", products, grandTotal)

        const targetData = {
            userId,
            created_by: user.created_by,
            database: user.database,
            salesPersonId: "salesPerson",
            products,
            grandTotal
        };
        // console.log("targetData", targetData)
        const target = await TargetCreation.create(targetData);
        const checkUser = await User.findById(user.created_by).populate("rolename");
        if (checkUser?.rolename?.roleName === "SuperAdmin") {
            return res.status(200).json({ message: "Target saved successfully", status: true });
        }

        const existingTargets = await TargetCreation.find({ userId: user.created_by }).sort({ sortorder: -1 });
        const lastTarget = existingTargets[existingTargets.length - 1];

        if (lastTarget) {
            for (let product of products) {
                const existingProduct = lastTarget.products.find(p => p.productId === product.productId);
                if (existingProduct) {
                    existingProduct.qtyAssign += product.qtyAssign;
                    existingProduct.totalPrice = existingProduct.qtyAssign * product.price;
                } else {
                    lastTarget.products.push(product);
                }
            }
            lastTarget.grandTotal += grandTotal;
            await lastTarget.save();
            await TargetAssignUser(user.created_by, grandTotal);
        } else {
            const newPayload = {
                userId: user.created_by,
                products,
                grandTotal,
                database: user.database
            };
            await TargetCreation.create(newPayload);
            // console.log("target", newPayload)
            await TargetAssignUser(user.created_by, grandTotal);
        }

        return res.status(200).json({ message: "Target saved successfully", status: true });

    } catch (error) {
        console.error("Error in SaveTargetCreation:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
};


// export const SaveTargetCreation = async (req, res) => {
//     try {
//         const user = await User.findById(req.body.userId);
//         if (!user) {
//             return res.status(400).json({ message: "User Not Found", status: false });
//         }
//         req.body.database = user.database;
//         req.body.salesPersonId = "salesPerson";
//         const target = await TargetCreation.create(req.body);
//         req.body.salesPersonId = undefined
//         // check user role
//         const checkUser = await User.findById(user.created_by).populate({ path: "rolename", model: "role" });
//         if (checkUser.rolename.roleName === "SuperAdmin") {
//             console.log("SuperAdmin detected, not saving target.");
//             return res.status(200).json({ message: "Target saved successfully", status: true });
//         }
//         const existingTargets = await TargetCreation.find({ userId: user.created_by }).sort({ sortorder: -1 });
//         const lastTarget = existingTargets[existingTargets.length - 1];
//         if (lastTarget) {
//             for (let product of req.body.products) {
//                 const existingProduct = lastTarget.products.find(p => p.productId === product.productId);
//                 if (existingProduct) {
//                     existingProduct.qtyAssign += product.qtyAssign;
//                     existingProduct.totalPrice = existingProduct.qtyAssign * existingProduct.price;
//                 } else {
//                     lastTarget.products.push(product);
//                 }
//             }
//             lastTarget.grandTotal += req.body.grandTotal;
//             await lastTarget.save();
//             await TargetAssignUser(user.created_by, req.body.grandTotal)
//         } else {
//             req.body.userId = user.created_by;
//             const newTarget = await TargetCreation.create(req.body);
//             await TargetAssignUser(user.created_by, req.body.grandTotal)
//         }
//         return res.status(200).json({ message: "Target saved successfully", status: true });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ error: "Internal Server Error" });
//     }
// };

export const DeleteTargetCreation = async (req, res, next) => {
    try {
        const target = await TargetCreation.findByIdAndDelete({ _id: req.params.id })
        return (target) ? res.status(200).json({ message: "delete successful", status: true }) : res.status(404).json({ error: "Not Found", status: false });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal server error", status: false });
    }
}


export const UpdateTargetCreation = async (req, res, next) => {
    try {
        const targetId = req.params.id;
        const existingTarget = await TargetCreation.findById(targetId);
        if (!existingTarget) {
            return res.status(404).json({ error: 'Target not found', status: false });
        }
        else {
            const updatedTarget = req.body;
            await TargetCreation.findByIdAndUpdate(targetId, updatedTarget, { new: true });
            return res.status(200).json({ message: 'Target Updated Successfully', status: true });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};


export const ViewTargetCreation = async (req, res, next) => {
    try {
        // const userId = req.params.id;
        // const adminDetail = await getTargetCreationHierarchy(userId);
        // const adminDetail = adminDetails.length === 1 ? adminDetails[0] : adminDetails;
        const userId = req.params.id;
        const database = req.params.database;
        const adminDetail = await getUserHierarchyBottomToTop(userId, database)
        if (!adminDetail.length > 0) {
            return res.status(404).json({ error: "Target Not Found", status: false })
        }
        let target = await TargetCreation.find({ database: database }).sort({ sortorder: -1 }).populate({ path: 'userId', model: 'user' }).populate({ path: "products.productId", model: "product" });
        return (target.length > 0) ? res.status(200).json({ TargetCreation: target, status: true }) : res.status(404).json({ error: "Not Found", status: false });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
}
export const ViewTargetCreationById = async (req, res, next) => {
    try {
        let target = await TargetCreation.find({ userId: req.params.id })
            .populate({ path: 'salesPersonId', model: 'user' })
            .populate({ path: "products.productId", model: "product" });
        // const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        // const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
        // const target = await TargetCreation.find({
        //     userId: req.params.id,
        //     createdAt: {
        //         $gte: currentMonthStart,
        //         $lt: currentMonthEnd,
        //     }
        // }).populate({ path: 'salesPersonId', model: 'user' }).populate({ path: "products.productId", model: "product" });
        return target ? res.status(200).json({ TargetCreation: target, status: true }) : res.status(404).json({ error: "Not Found", status: false });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
}
export const deleteProductFromTargetCreation = async (req, res, next) => {
    const targetId = req.params.targetId;
    const productIdToDelete = req.params.productId;
    try {
        const target = await TargetCreation.findById(targetId);
        const productPrice = target.products.reduce((total, item) => {
            if (item.productId.toString().toLowerCase() === productIdToDelete.toLowerCase()) {
                return total + item.price * item.qtyAssign;
            }
            return total;
        }, 0);
        const updatedTarget = await TargetCreation.findByIdAndUpdate(
            targetId,
            { $pull: { products: { productId: productIdToDelete } } },
            { new: true }
        );
        if (updatedTarget) {
            const grandTotal = updatedTarget.grandTotal - productPrice;
            const updatedTargetWithGrandTotal = await TargetCreation.findByIdAndUpdate(
                targetId,
                { grandTotal: grandTotal },
                { new: true }
            );
            return res.status(200).json({ TargetCreation: updatedTargetWithGrandTotal, status: true });
        } else {
            return res.status(404).json({ error: "Not Found", status: false });
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err, status: false });
    }
};

export const Achievement = async (req, res) => {
    try {
        const salespersonId = req.params.id;
        const targets1 = await TargetCreation.findOne({ partyId: salespersonId });
        if (!targets1) {
            return res.status(404).json({ message: "Not Found", status: false })
        }
        const startDate = new Date(targets1.startDate);
        const endDate = new Date();
        const targets = await TargetCreation.findOne({
            partyId: salespersonId,

        });
        if (!targets) {
            return res.status(404).json({ error: 'Targets not found', status: false });
        }
        const orders = await CreateOrder.find({ partyId: targets1.partyId });
        if (!orders || orders.length === 0) {
            return res.status(404).json({ error: 'Orders not found', status: false });
        }
        const allOrderItems = orders.flatMap(order => order.orderItems);
        const aggregatedOrders = allOrderItems.reduce((acc, item) => {
            const existingItem = acc.find(accItem => accItem.productId.toString() === item.productId._id.toString());
            if (existingItem) {
                existingItem.qty += item.qty;
                existingItem.price += item.price;
            } else {
                acc.push({
                    productId: item.productId._id.toString(),
                    qty: item.qty,
                    price: item.price,
                });
            }
            return acc;
        }, []);

        const productDetailsMap = {};
        const productIds = aggregatedOrders.map(order => order.productId);
        const products = await Product.find({ _id: { $in: productIds } });
        products.forEach(product => {
            productDetailsMap[product._id.toString()] = product;
        });
        const achievements = targets.products.flatMap(targetProduct => {
            const matchingOrders = aggregatedOrders.filter(order => order.productId === targetProduct.productId);
            if (matchingOrders.length > 0) {
                const actualQuantity = matchingOrders.reduce((total, order) => total + order.qty, 0);
                const actualTotalPrice = matchingOrders.reduce((total, order) => total + order.qty * order.price, 0);
                const productDetails = productDetailsMap[targetProduct.productId.toString()] || {};
                return {
                    product: {
                        productId: targetProduct.productId,
                        details: productDetails,
                    },
                    targetQuantity: targetProduct.qtyAssign,
                    actualQuantity: actualQuantity,
                    achievementPercentage: (actualQuantity / targetProduct.qtyAssign) * 100,
                    targetTotalPrice: targetProduct.price,
                    actualTotalPrice: actualTotalPrice
                };
            } else {
                return null;
            }
        }).filter(Boolean);
        const overallTargetQuantity = targets.products.reduce((total, targetProduct) => total + targetProduct.qtyAssign, 0);
        const overallActualQuantity = achievements.reduce((total, achievement) => total + achievement.actualQuantity, 0);
        const overallAchievementPercentage = (overallActualQuantity / overallTargetQuantity) * 100;
        // console.log(achievements.products.detail.Size)
        return res.status(200).json({ achievements, overallAchievementPercentage });
    } catch (error) {
        console.error('Error calculating achievements:', error);
        res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};

export const updateTargetProducts = async (req, res, next) => {
    try {
        const targetId = req.params.id;
        const updatedFields = req.body;
        if (!targetId || !updatedFields) {
            return res.status(400).json({ message: "Invalid input data", status: false });
        }
        const target = await TargetCreation.findById({ _id: targetId });
        if (!target) {
            return res.status(404).json({ message: "Order not found", status: false });
        }
        const productItems = target.products || [];
        const newProductItems = updatedFields.products || [];
        for (const newProducts of newProductItems) {
            const oldProducts = productItems.find(item => item.productId.toString() === newProducts.productId);
            if (oldProducts) {
                oldProducts.productId = newProducts.productId || oldProducts.productId;
                oldProducts.qtyAssign = newProducts.qtyAssign || oldProducts.qtyAssign;
                oldProducts.price = newProducts.price || oldProducts.price
                oldProducts.totalPrice = newProducts.totalPrice || oldProducts.totalPrice
                oldProducts.assignPercentage = newProducts.assignPercentage || oldProducts.assignPercentage
            }
            await oldProducts.save();
        }
        const updatedOrder = await target.save();
        return res.status(200).json({ Target: updatedOrder, status: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

// -----------------------------------------------------------------------------------------

// increaseTarget month wise
export const increasePercentage555 = async (req, res, next) => {
    try {
        const customers = await Customer.find({}).sort({ sortorder: -1 }).select("created_by");
        if (!customers.length > 0) {
            return res.status(404).json({ message: "Party Not Found", status: false });
        }
        let id;
        for (let customer of customers) {
            const date = new Date();
            const targetCreation = await TargetCreation.find({ partyId: customer._id });
            const target = targetCreation[targetCreation.length - 1];
            if (!target) {
                console.log(`TargetCreation document not found for party ${customer._id}`);
                continue;
            }
            const updatedProducts = target.products.map((items) => {
                if (items.assignPercentage.some((item) => item.month === date.getMonth() + 1)) {
                    const updatedAssignments = items.assignPercentage.map((item) => {
                        if (item.month === date.getMonth() + 1) {
                            const increaseQty = items.qtyAssign * item.percentage / 100;
                            const roundedIncreaseQty = Math.floor(increaseQty);
                            const productQtyAssign = items.qtyAssign + roundedIncreaseQty;
                            return {
                                month: item.month,
                                percentage: item.percentage,
                                increase: productQtyAssign
                            };
                        }
                        return item;
                    });
                    const updatedItem = {
                        productId: items.productId,
                        qtyAssign: updatedAssignments[0].increase,
                        price: items.price,
                        totalPrice: (updatedAssignments[0].increase * items.price),
                        assignPercentage: updatedAssignments,
                    };
                    return updatedItem;
                }
                return items;
            });
            const grandtotal = updatedProducts.reduce((total, item) => total + (item.qtyAssign * item.price), 0);
            const { _id, createdAt, updatedAt, ...targetWithoutId } = target.toObject();
            const updatedTarget = new TargetCreation({
                ...targetWithoutId,
                grandTotal: grandtotal,
                products: updatedProducts,
            });
            await updatedTarget.save();

            id = customer.created_by;
            await t1(id)
        }
        Object.assign(uniqueId, emptyObj);
        Object.assign(uniqueUserId, emptyObj);
    } catch (err) {
        console.error(err);
    }
};

export const increasePercentage = async (req, res, next) => {
    try {
        const customers = await User.find({}).sort({ sortorder: -1 }).select("created_by");
        if (!customers.length > 0) {
            return res.status(404).json({ message: "Party Not Found", status: false });
        }
        let finalTarget;
        let id;
        let total = 0;
        for (let customer of customers) {
            const date = new Date();
            const targetCreation = await TargetCreation.find({ userId: customer._id, salesPersonId: "salesPerson" });
            const target = targetCreation[targetCreation.length - 1];
            if (!target) {
                console.log(`TargetCreation document not found for party ${customer._id}`);
                continue;
            }
            const updatedProducts = target.products.map((items) => {
                if (items.assignPercentage.some((item) => item.month === date.getMonth() + 1)) {
                    const updatedAssignments = items.assignPercentage.map((item) => {
                        if (item.month === date.getMonth() + 1) {
                            const increaseQty = items.qtyAssign * item.percentage / 100;
                            const roundedIncreaseQty = Math.floor(increaseQty);
                            const productQtyAssign = items.qtyAssign + roundedIncreaseQty;
                            return {
                                month: item.month,
                                percentage: item.percentage,
                                increase: productQtyAssign
                            };
                        }
                        return item;
                    });
                    const updatedItem = {
                        productId: items.productId,
                        qtyAssign: updatedAssignments[0].increase,
                        price: items.price,
                        totalPrice: (updatedAssignments[0].increase * items.price),
                        assignPercentage: updatedAssignments,
                    };
                    return updatedItem;
                }
                return items;
            });
            const grandtotal = updatedProducts.reduce((total, item) => total + (item.qtyAssign * item.price), 0);
            const { _id, createdAt, updatedAt, ...targetWithoutId } = target.toObject();
            const updatedTarget = new TargetCreation({
                ...targetWithoutId,
                grandTotal: grandtotal,
                products: updatedProducts,
            });
            await updatedTarget.save();

            id = customer.created_by;
            await t1(id, grandtotal)
        }
        Object.assign(uniqueId, emptyObj);
        Object.assign(uniqueUserId, emptyObj);
    } catch (err) {
        console.error(err);
    }
};


// assing target salesPerson month's wise
export const t1555 = async function t1(createdById) {
    let partyTotal = 0;
    let storedData = [];
    let finalTarget;
    try {
        const createdByIdString = createdById.toString();
        if (!uniqueId.has(createdByIdString)) {
            uniqueId.add(createdByIdString);
            const newParty = await Customer.find({ created_by: createdById }).sort({ sortorder: -1 });
            if (!newParty.length > 0) {
                console.log(`party not found`);
            }
            for (let item of newParty) {
                const target = await TargetCreation.find({ partyId: item._id }).sort({ sortorder: -1 });
                const lastTarget = target[target.length - 1];
                if (lastTarget) {
                    const dd = await salesPerson(lastTarget.products, storedData.slice());
                    storedData = dd;
                    partyTotal += lastTarget.grandTotal;
                    finalTarget = lastTarget
                }
            }
            if (finalTarget) {
                const { _id, products, createdAt, updatedAt, ...newTargetCreation } = finalTarget.toObject();
                const newCopyTarget = new TargetCreation({
                    ...newTargetCreation,
                    userId: createdById,
                    grandTotal: partyTotal,
                    products: storedData,
                    partyId: undefined,
                });
                await newCopyTarget.save();
                await increaseTargetUserClosure(newCopyTarget.userId)
            }
        } else {
            console.log("Duplicate found:", createdByIdString);
        }
    } catch (error) {
        console.error("Error:", error);
    }
};

export const t1 = async function t1(createdById, total) {
    let partyTotal = 0;
    let storedData = [];
    let finalTarget;
    try {
        const createdByIdString = createdById.toString();
        if (!uniqueId.has(createdByIdString)) {
            uniqueId.add(createdByIdString);
            const newParty = await User.find({ created_by: createdById }).sort({ sortorder: -1 });
            if (!newParty.length > 0) {
                console.log(`party not found`);
            }
            for (let item of newParty) {
                const target = await TargetCreation.find({ userId: item._id }).sort({ sortorder: -1 });
                const lastTarget = target[target.length - 1];
                if (lastTarget) {
                    const dd = await salesPerson(lastTarget.products, storedData.slice());
                    storedData = dd;
                    partyTotal += total
                    finalTarget = lastTarget
                }
            }
            if (finalTarget) {
                const { _id, products, createdAt, updatedAt, ...newTargetCreation } = finalTarget.toObject();
                const newCopyTarget = new TargetCreation({
                    ...newTargetCreation,
                    userId: createdById,
                    grandTotal: partyTotal,
                    products: storedData,
                    salesPersonId: undefined
                });
                await newCopyTarget.save();
                await increaseTargetUserClosure(newCopyTarget.userId)
            }
        } else {
            console.log("Duplicate found:", createdByIdString);
        }
    } catch (error) {
        console.error("Error:", error);
    }
};



// assing user hierarchy target when targer created......
export const TargetAssignUser = (function () {
    let initialUserId = "";
    return async function TargetUser(userId, amount) {
        try {
            if (initialUserId === "") {
                initialUserId = userId;
                console.log("First call with userId: " + initialUserId);
            }
            const user = await User.findById(userId);
            if (!user) {
                return console.log("User Not Found");
            }
            const checkUser = await User.findById(user.created_by).populate({ path: "rolename", model: "role" });
            if (checkUser.rolename.roleName === "SuperAdmin") {
                console.log("SuperAdmin detected, not saving target.");
                return console.log("completed...");
            }
            const targets = await TargetCreation.find({ userId: initialUserId }).sort({ sortorder: -1 });
            if (targets.length === 0) {
                console.log("No targets found for user:");
            }
            const newTarget = targets[targets.length - 1];
            const existingTargets = await TargetCreation.find({ userId: user.created_by }).sort({ sortorder: -1 });
            const lastTarget = existingTargets[existingTargets.length - 1];
            let grandTotalSum = 0;
            if (lastTarget) {
                lastTarget.grandTotal += amount;
                await lastTarget.save();
            } else {
                const tar = new TargetCreation({
                    userId: user.created_by,
                    database: user.database,
                    status: user.status,
                    grandTotal: newTarget.grandTotal
                });
                await tar.save();
            }
            await TargetUser(user.created_by, amount);
        } catch (error) {
            console.error(error);
        }
    }
})();

// assign target salesPerson with productId
const salesPerson = async function salesPerson(productsData, storedData) {
    storedData = storedData || [];
    for (const product of productsData) {
        const index = storedData.findIndex(item => item.productId === product.productId);
        if (index !== -1) {
            storedData[index].qtyAssign += product.qtyAssign;
            storedData[index].totalPrice += product.totalPrice;
            storedData[index].price = product.price;
        } else {
            storedData.push(product);
        }
    }
    return storedData;
};


// assing user hierarchy target month's wise
export const increaseTargetUserClosure555 = (function () {
    return async function increaseTargetUser(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return console.log("User Not Found");
            }
            const checkUser = await User.findById(user.created_by).populate({ path: "rolename", model: "role" });

            if (checkUser.rolename.roleName === "SuperAdmin") {
                console.log("SuperAdmin detected, not saving target.");
                return console.log("completed...");
            }
            await t2(userId)
            await increaseTargetUser(user.created_by);
        } catch (error) {
            console.error(error);
        }
    };
})();

export const increaseTargetUserClosure = (function () {

    return async function increaseTargetUser(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return console.log("User Not Found");
            }
            const checkUser = await User.findById(user.created_by).populate({ path: "rolename", model: "role" });
            if (checkUser.rolename.roleName === "SuperAdmin") {
                console.log("SuperAdmin detected, not saving target.");
                return console.log("completed...");
            }
            await t2(userId)
            await increaseTargetUser(user.created_by);
        } catch (error) {
            console.error(error);
        }
    };
})();



export const t2555 = async function t2(userId) {
    try {
        let partyTotal = 0;
        const createdBy = userId.toString();
        const user = await User.findById(userId);
        if (!user) {
            return console.log("User Not Found");
        }
        const newParty = await User.find({ created_by: user.created_by }).sort({ sortorder: -1 });
        if (!newParty.length > 0) {
            console.log(`party not found`);
        }
        for (let item of newParty) {
            const target = await TargetCreation.find({ userId: item._id }).sort({ sortorder: -1 });
            const lastTarget = target[target.length - 1];
            if (lastTarget) {
                partyTotal += lastTarget.grandTotal;
                finalTarget = lastTarget
            }
        }
        if (partyTotal !== 0) {
            const us = await TargetCreation.find({ userId: user.created_by }).sort({ sortorder: -1 })
            const last = us[us.length - 1].createdAt;
            const created = new Date(last)
            const current = new Date();
            if (current.getMonth() + 1 !== created.getMonth() + 1) {
                const tar = new TargetCreation({
                    userId: user.created_by,
                    startDate: new Date(),
                    database: user.database,
                    status: user.status,
                    grandTotal: partyTotal
                });
                await tar.save();
            } else {
                const us = await TargetCreation.find({ userId: user.created_by }).sort({ sortorder: -1 })
                const last1 = us[us.length - 1];
                const date = last1.createdAt;
                const created = new Date(date)
                if (current.getMonth() + 1 === created.getMonth() + 1) {
                    last1.grandTotal = partyTotal
                    await last1.save();
                } else {
                    console.log("duplicate user")
                }
            }
        }
    }
    catch (err) {
        console.log(err)
    }
}

export const t2 = async function t2(userId) {
    try {
        let partyTotal = 0;
        const createdBy = userId.toString();
        const user = await User.findById(userId);
        if (!user) {
            return console.log("User Not Found");
        }
        const newParty = await User.find({ created_by: user.created_by }).sort({ sortorder: -1 });
        if (!newParty.length > 0) {
            console.log(`party not found`);
        }
        for (let item of newParty) {
            const target = await TargetCreation.find({ userId: item._id }).sort({ sortorder: -1 });
            const lastTarget = target[target.length - 1];
            if (lastTarget) {
                partyTotal += lastTarget.grandTotal;
                finalTarget = lastTarget
            }
        }
        if (partyTotal !== 0) {
            const us = await TargetCreation.find({ userId: user.created_by }).sort({ sortorder: -1 })
            const last = us[us.length - 1].createdAt;
            const created = new Date(last)
            const current = new Date();
            if (current.getMonth() + 1 !== created.getMonth() + 1) {
                const tar = new TargetCreation({
                    userId: user.created_by,
                    database: user.database,
                    status: user.status,
                    grandTotal: partyTotal
                });
                await tar.save();
            } else {
                const us = await TargetCreation.find({ userId: user.created_by }).sort({ sortorder: -1 })
                const last1 = us[us.length - 1];
                const date = last1.createdAt;
                const created = new Date(date)
                if (current.getMonth() + 1 === created.getMonth() + 1) {
                    last1.grandTotal = partyTotal
                    await last1.save();
                } else {
                    console.log("duplicate user")
                }
            }
        }
    }
    catch (err) {
        console.log(err)
    }
}



export const viewTarget = async (req, res, next) => {
    try {
        let target = [];
        const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
        const user = await User.find({ created_by: req.params.id, status: "Active" }).sort({ sortorder: -1 }).select("_id");
        if (user.length > 0) {
            for (let id of user) {
                const user = await TargetCreation.find({ userId: id._id, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }).populate({ path: "userId", model: "user" })
                if (!user.length > 0) {
                    continue;
                }
                target.push(user)
            }
            const totalTarget = target.flat()
            return res.status(200).json({ Target: totalTarget, status: true })
        } else {
            const user = await Customer.find({ created_by: req.params.id, status: "Active" }).sort({ sortorder: -1 }).select("_id");
            if (user.length > 0) {
                for (let id of user) {
                    const user = await TargetCreation.find({ partyId: id._id, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }).populate({ path: "products.productId", model: "product" }).populate({ path: "partyId", model: "customer" })
                    if (!user.length > 0) {
                        continue;
                    }
                    target.push(user)
                }
                const totalTarget = target.flat()
                return res.status(200).json({ Target: totalTarget, status: true })
            } else {
                const customer = await TargetCreation.find({ partyId: req.params.id, createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } }).populate({ path: "products.productId", model: "product" })
                if (customer.length > 0) {
                    return res.status(200).json({ Target: customer, status: true })
                }
                return res.status(404).json({ message: "Not Found", status: false })
            }
        }
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false })
    }
}
//----------------------------------------------------------------------------------------

// all party get achievement
export const latestAchievementById = async (req, res) => {
    try {
        const partyId = req.params.id;
        const customer = await Customer.findOne({ _id: partyId, database: req.params.database, status: "Active" })
        const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
        const endDate = req.body.endDate ? new Date(req.body.endDate) : null;

        const targetQuery = { partyId: partyId };
        if (startDate && endDate) {
            targetQuery.createdAt = { $gte: startDate, $lte: endDate };
        }

        const targetss = await TargetCreation.find(targetQuery).populate({ path: "partyId", model: "customer" }).sort({ sortorder: -1 });
        const targets = targetss[targetss.length - 1]
        if (targetss.length === 0) {
            return res.status(404).json({ message: "Not Found", status: false });
        }
        const orders = await CreateOrder.find({ partyId: targets.partyId });
        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: "Order Not Found", status: false });
        }
        const allOrderItems = orders.flatMap(order => order.orderItems);
        const aggregatedOrders = allOrderItems.reduce((acc, item) => {
            const existingItem = acc.find(accItem => accItem.productId.toString() === item.productId._id.toString());
            if (existingItem) {
                existingItem.qty += item.qty;
                existingItem.price += item.price;
            } else {
                acc.push({
                    productId: item.productId._id.toString(),
                    qty: item.qty,
                    price: item.price,
                });
            }
            return acc;
        }, []);
        const productDetailsMap = {};
        const productIds = aggregatedOrders.map(order => order.productId);
        const products = await Product.find({ _id: { $in: productIds } });
        products.forEach(product => {
            productDetailsMap[product._id.toString()] = product;
        });
        const achievements = targets.products.flatMap(targetProduct => {
            const matchingOrders = aggregatedOrders.filter(order => order.productId === targetProduct.productId);
            if (matchingOrders.length > 0) {
                const actualQuantity = matchingOrders.reduce((total, order) => total + order.qty, 0);
                const actualTotalPrice = matchingOrders.reduce((total, order) => total + order.qty * order.price, 0);
                const productDetails = productDetailsMap[targetProduct.productId.toString()] || {};
                return {
                    productId: productDetails,
                    targetQuantity: targetProduct.qtyAssign,
                    actualQuantity: actualQuantity,
                    achievementPercentage: (actualQuantity / targetProduct.qtyAssign) * 100,
                    productPrice: targetProduct.price,
                    targetTotalPrice: targetProduct.totalPrice,
                    actualTotalPrice: actualTotalPrice
                };
            } else {
                return null;
            }
        }).filter(Boolean);
        const overallTargetQuantity = targets.products.reduce((total, targetProduct) => total + targetProduct.qtyAssign, 0);
        const overallActualQuantity = achievements.reduce((total, achievement) => total + achievement.actualQuantity, 0);
        const overallAchievementPercentage = (overallActualQuantity / overallTargetQuantity) * 100;

        customer.overallAchievementPercentage = overallAchievementPercentage
        return res.status(200).json({ customer, achievements, overallAchievementPercentage, status: true });
    } catch (error) {
        console.error('Error calculating achievements:', error);
        res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};
export const latestAchievementSalesById1 = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findOne({ _id: userId, database: req.params.database, status: "Active" })
        const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
        const endDate = req.body.endDate ? new Date(req.body.endDate) : null;

        const targetQuery = { userId: userId };
        if (startDate && endDate) {
            targetQuery.createdAt = { $gte: startDate, $lte: endDate };
            // targetQuery.startDate = { $gte: startDate };
            // targetQuery.endDate = { $lte: endDate };
        }
        const targetss = await TargetCreation.find(targetQuery).populate({ path: "userId", model: "user" }).populate({ path: "partyId", model: "customer" });
        const targets = targetss[targetss.length - 1]
        if (targetss.length === 0) {
            return res.status(404).json({ message: "Not Found", status: false });
        }
        const orders = await CreateOrder.find({ userId: targets.userId });
        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: "Order Not Found", status: false });
        }
        const allOrderItems = orders.flatMap(order => order.orderItems);
        const aggregatedOrders = allOrderItems.reduce((acc, item) => {
            const existingItem = acc.find(accItem => accItem.productId.toString() === item.productId._id.toString());
            if (existingItem) {
                existingItem.qty += item.qty;
                existingItem.price += item.price;
            } else {
                acc.push({
                    productId: item.productId._id.toString(),
                    qty: item.qty,
                    price: item.price,
                });
            }
            return acc;
        }, []);
        const productDetailsMap = {};
        const productIds = aggregatedOrders.map(order => order.productId);
        const products = await Product.find({ _id: { $in: productIds } });
        products.forEach(product => {
            productDetailsMap[product._id.toString()] = product;
        });
        const achievements = targets.products.flatMap(targetProduct => {
            const matchingOrders = aggregatedOrders.filter(order => order.productId === targetProduct.productId);
            if (matchingOrders.length > 0) {
                const actualQuantity = matchingOrders.reduce((total, order) => total + order.qty, 0);
                const actualTotalPrice = matchingOrders.reduce((total, order) => total + order.qty * order.price, 0);
                const productDetails = productDetailsMap[targetProduct.productId.toString()] || {};
                return {
                    productId: productDetails,
                    targetQuantity: targetProduct.qtyAssign,
                    actualQuantity: actualQuantity,
                    achievementPercentage: (actualQuantity / targetProduct.qtyAssign) * 100,
                    productPrice: targetProduct.price,
                    targetTotalPrice: targetProduct.totalPrice,
                    actualTotalPrice: actualTotalPrice
                };
            } else {
                return null;
            }
        }).filter(Boolean);
        const overallTargetQuantity = targets.products.reduce((total, targetProduct) => total + targetProduct.qtyAssign, 0);
        const overallActualQuantity = achievements.reduce((total, achievement) => total + achievement.actualQuantity, 0);
        const overallAchievementPercentage = (overallActualQuantity / overallTargetQuantity) * 100;

        user.overallAchievementPercentage = overallAchievementPercentage
        return res.status(200).json({ user, achievements, overallAchievementPercentage, status: true });
    } catch (error) {
        console.error('Error calculating achievements:', error);
        res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};
export const latestAchievementSalesById555 = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findOne({ _id: userId, database: req.params.database, status: "Active" })
        if (user.length === 0) {
            return res.status(404).json({ message: "Not Found", status: false });
        }
        const customer = await Customer.find({ created_by: user._id, status: "Active" }).sort({ sortorder: -1 })
        if (customer.length === 0) {
            return res.status(404).json({ message: "Not Found", status: false });
        }
        let salesPerson = []
        for (let item of customer) {
            const customer = await Customer.findById({ _id: item._id, status: "Active" }).sort({ sortorder: -1 })
            const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
            const endDate = req.body.endDate ? new Date(req.body.endDate) : null;

            const targetQuery = { partyId: item._id };
            if (startDate && endDate) {
                targetQuery.createdAt = { $gte: startDate, $lte: endDate };
                // targetQuery.startDate = { $gte: startDate };
                // targetQuery.endDate = { $lte: endDate };
            }
            const targetss = await TargetCreation.find(targetQuery).populate({ path: "partyId", model: "customer" }).sort({ sortorder: -1 });
            const targets = targetss[targetss.length - 1]
            if (targetss.length === 0) {
                continue;
                // return res.status(404).json({ message: "Not Found", status: false });
            }
            const orders = await CreateOrder.find({ partyId: targets.partyId });
            if (!orders || orders.length === 0) {
                continue;
                // return res.status(404).json({ message: "Order Not Found", status: false });
            }
            const allOrderItems = orders.flatMap(order => order.orderItems);
            const aggregatedOrders = allOrderItems.reduce((acc, item) => {
                const existingItem = acc.find(accItem => accItem.productId.toString() === item.productId._id.toString());
                if (existingItem) {
                    existingItem.qty += item.qty;
                    existingItem.price += item.price;
                } else {
                    acc.push({
                        productId: item.productId._id.toString(),
                        qty: item.qty,
                        price: item.price,
                    });
                }
                return acc;
            }, []);
            const productDetailsMap = {};
            productDetailsMap.partyName = targets?.partyId?.ownerName
            const productIds = aggregatedOrders.map(order => order.productId);
            const products = await Product.find({ _id: { $in: productIds } });
            products.forEach(product => {
                productDetailsMap[product._id.toString()] = product;
            });
            const achievements = targets.products.flatMap(targetProduct => {
                const matchingOrders = aggregatedOrders.filter(order => order.productId === targetProduct.productId);
                if (matchingOrders.length > 0) {
                    const actualQuantity = matchingOrders.reduce((total, order) => total + order.qty, 0);
                    const actualTotalPrice = matchingOrders.reduce((total, order) => total + order.qty * order.price, 0);
                    const productDetails = productDetailsMap[targetProduct.productId.toString()] || {};
                    return {
                        productId: productDetails,
                        targetQuantity: targetProduct.qtyAssign,
                        actualQuantity: actualQuantity,
                        achievementPercentage: (actualQuantity / targetProduct.qtyAssign) * 100,
                        productPrice: targetProduct.price,
                        targetTotalPrice: targetProduct.totalPrice,
                        actualTotalPrice: actualTotalPrice
                    };
                } else {
                    return null;
                }
            }).filter(Boolean);
            const overallTargetQuantity = targets.products.reduce((total, targetProduct) => total + targetProduct.qtyAssign, 0);
            const overallActualQuantity = achievements.reduce((total, achievement) => total + achievement.actualQuantity, 0);
            const overallAchievementPercentage = (overallActualQuantity / overallTargetQuantity) * 100;
            salesPerson.push({ customer, achievements })
        }
        return res.status(200).json({ salesPerson, status: true });
    } catch (error) {
        console.error('Error calculating achievements:', error);
        res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};

export const latestAchievementSalesById = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findOne({ _id: userId, database: req.params.database, status: "Active" })
        if (!user) {
            return res.status(404).json({ message: "Not Found", status: false });
        }
        // const customer = await Customer.find({ created_by: user._id, status: "Active" }).sort({ sortorder: -1 })
        // if (customer.length === 0) {
        //     return res.status(404).json({ message: "Not Found", status: false });
        // }
        let salesPerson = []
        // for (let item of customer) {
        // const customer = await Customer.findById({ _id: item._id, status: "Active" }).sort({ sortorder: -1 })
        const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
        const endDate = req.body.endDate ? new Date(req.body.endDate) : null;

        const targetQuery = { userId: user._id };
        if (startDate && endDate) {
            targetQuery.createdAt = { $gte: startDate, $lte: endDate };
            // targetQuery.startDate = { $gte: startDate };
            // targetQuery.endDate = { $lte: endDate };
        }
        const targetss = await TargetCreation.find(targetQuery).populate({ path: "userId", model: "user" }).sort({ sortorder: -1 });
        const targets = targetss[targetss.length - 1]
        if (targetss.length === 0) {
            console.log("targer not found")
            // continue;
            return res.status(404).json({ message: "Target Not Found", status: false });
        }
        const orders = await CreateOrder.find({ userId: targets.userId });
        if (!orders || orders.length === 0) {
            console.log("order not found")
            // continue;
            return res.status(404).json({ message: "Order Not Found", status: false });
        }
        const allOrderItems = orders.flatMap(order => order.orderItems);
        const aggregatedOrders = allOrderItems.reduce((acc, item) => {
            const existingItem = acc.find(accItem => accItem.productId.toString() === item.productId._id.toString());
            if (existingItem) {
                existingItem.qty += item.qty;
                existingItem.price += item.price;
            } else {
                acc.push({
                    productId: item.productId._id.toString(),
                    qty: item.qty,
                    price: item.price,
                });
            }
            return acc;
        }, []);
        const productDetailsMap = {};
        productDetailsMap.userName = targets?.userId?.firstName
        const productIds = aggregatedOrders.map(order => order.productId);
        const products = await Product.find({ _id: { $in: productIds } });
        products.forEach(product => {
            productDetailsMap[product._id.toString()] = product;
        });
        const achievements = targets.products.flatMap(targetProduct => {
            const matchingOrders = aggregatedOrders.filter(order => order.productId === targetProduct.productId);
            if (matchingOrders.length > 0) {
                const actualQuantity = matchingOrders.reduce((total, order) => total + order.qty, 0);
                const actualTotalPrice = matchingOrders.reduce((total, order) => total + order.qty * order.price, 0);
                const productDetails = productDetailsMap[targetProduct.productId.toString()] || {};
                return {
                    productId: productDetails,
                    targetQuantity: targetProduct.qtyAssign,
                    actualQuantity: actualQuantity,
                    achievementPercentage: (actualQuantity / targetProduct.qtyAssign) * 100,
                    productPrice: targetProduct.price,
                    targetTotalPrice: (targetProduct.qtyAssign * productDetails.Product_MRP), //targetProduct.totalPrice,
                    actualTotalPrice: (actualQuantity * productDetails.Product_MRP)  //actualTotalPrice
                };
            } else {
                return null;
            }
        }).filter(Boolean);
        const overallTargetQuantity = targets.products.reduce((total, targetProduct) => total + targetProduct.qtyAssign, 0);
        const overallActualQuantity = achievements.reduce((total, achievement) => total + achievement.actualQuantity, 0);
        const overallAchievementPercentage = (overallActualQuantity / overallTargetQuantity) * 100;
        salesPerson.push({ achievements })
        // }
        return res.status(200).json({ achievements, status: true });
    } catch (error) {
        console.error('Error calculating achievements:', error);
        res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};

export const latestAchievement = async (req, res) => {
    try {
        const customers = await Customer.find({ database: req.params.database, status: "Active" });
        const achievementsByCustomer = [];

        for (let customer of customers) {
            const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
            const endDate = req.body.endDate ? new Date(req.body.endDate) : null;

            const targetQuery = { partyId: customer._id };
            if (startDate && endDate) {
                targetQuery.createdAt = { $gte: startDate, $lte: endDate };
                // targetQuery.startDate = { $gte: startDate };
                // targetQuery.endDate = { $lte: endDate };
            }

            const targets = await TargetCreation.findOne(targetQuery).populate({ path: "partyId", model: "customer" });
            if (!targets) {
                continue;
            }
            const orders = await CreateOrder.find({ partyId: targets.partyId });
            if (!orders || orders.length === 0) {
                continue;
            }
            const allOrderItems = orders.flatMap(order => order.orderItems);
            const aggregatedOrders = allOrderItems.reduce((acc, item) => {
                const existingItem = acc.find(accItem => accItem.productId.toString() === item.productId._id.toString());
                if (existingItem) {
                    existingItem.qty += item.qty;
                    existingItem.price += item.price;
                } else {
                    acc.push({
                        productId: item.productId._id.toString(),
                        qty: item.qty,
                        price: item.price,
                    });
                }
                return acc;
            }, []);
            const productDetailsMap = {};
            const productIds = aggregatedOrders.map(order => order.productId);
            const products = await Product.find({ _id: { $in: productIds } });
            products.forEach(product => {
                productDetailsMap[product._id.toString()] = product;
            });
            const achievements = targets.products.flatMap(targetProduct => {
                const matchingOrders = aggregatedOrders.filter(order => order.productId === targetProduct.productId);
                if (matchingOrders.length > 0) {
                    const actualQuantity = matchingOrders.reduce((total, order) => total + order.qty, 0);
                    const actualTotalPrice = matchingOrders.reduce((total, order) => total + order.qty * order.price, 0);
                    const productDetails = productDetailsMap[targetProduct.productId.toString()] || {};
                    return {
                        productId: productDetails,
                        targetQuantity: targetProduct.qtyAssign,
                        actualQuantity: actualQuantity,
                        achievementPercentage: (actualQuantity / targetProduct.qtyAssign) * 100,
                        productPrice: targetProduct.price,
                        targetTotalPrice: targetProduct.totalPrice,
                        actualTotalPrice: actualTotalPrice
                    };
                } else {
                    return null;
                }
            }).filter(Boolean);

            const overallTargetQuantity = targets.products.reduce((total, targetProduct) => total + targetProduct.qtyAssign, 0);
            const overallActualQuantity = achievements.reduce((total, achievement) => total + achievement.actualQuantity, 0);
            const overallAchievementPercentage = (overallActualQuantity / overallTargetQuantity) * 100;

            achievementsByCustomer.push({ overallAchievementPercentage, partyId: customer._id, achievements });
        }

        return res.status(200).json({ achievementsByCustomer, status: true });
    } catch (error) {
        console.error('Error calculating achievements:', error);
        res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};



// right-1
export const called = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const database = req.params.database;
        const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
        const endDate = req.body.endDate ? new Date(req.body.endDate) : null;

        const result = await getUserHierarchyBottomToTop2(userId, database, req.body);
        const flattenedArray = flattenNestedArray(result);
        const targetQuery = { userId: userId };
        if (startDate && endDate) {
            targetQuery.createdAt = { $gte: startDate, $lte: endDate };
            // targetQuery.startDate = { $gte: startDate };
            // targetQuery.endDate = { $lte: endDate };
        }
        const targetss = await TargetCreation.find(targetQuery).sort({ sortorder: -1 });
        const targets = targetss[targetss.length - 1]
        if (targetss.length === 0) {
            return res.status(404).json({ message: "Target Not Found", status: false });
        }
        const totalAchievementPrice = flattenedArray.reduce((total, price) => {
            return total + price.actualTotalPrice
        }, 0)
        // const totalTargetPrice = flattenedArray.reduce((total, price) => {
        //     return total + price.targetTotalPrice
        // }, 0)
        let totalTargetPrice
        let TargetAchievement = { totalTargetPrice: targets.grandTotal, totalAchievementPrice, overAllPercentage: ((totalAchievementPrice * 100) / targets.grandTotal).toFixed(2) }
        return res.status(200).json({ TargetAchievement, status: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};
// 2
const flattenNestedArray = (arr) => {
    return arr.reduce((acc, val) => {
        if (Array.isArray(val) && val.length > 0) {
            return acc.concat(flattenNestedArray(val));
        } else {
            return acc.concat(val);
        }
    }, []);
};
// 3
const latestAchievement1 = async (body, data) => {
    try {
        const customer = await User.find({ created_by: body })
        let latestAchieve = []
        for (let id of customer) {
            // const targets1 = await TargetCreation.findOne({ partyId: id._id });
            // if (!targets1) {
            //     continue;
            // }
            const startDate = data.startDate ? new Date(data.startDate) : null;
            const endDate = data.endDate ? new Date(data.endDate) : null;
            const targetQuery = { userId: id._id, salesPersonId: "salesPerson" };
            if (startDate && endDate) {
                targetQuery.createdAt = { $gte: startDate, $lte: endDate };
                // targetQuery.startDate = { $gte: startDate };
                // targetQuery.endDate = { $lte: endDate };
            }
            const targetss = await TargetCreation.find(targetQuery).sort({ sortorder: -1 });
            const targets = targetss[targetss.length - 1]
            if (targetss.length === 0) {
                continue;
                // return res.status(404).json({ message: "Not Found", status: false });
            }
            // const targets = await TargetCreation.findOne(targetQuery);
            // if (!targets) {
            //     continue;
            // }
            const orders = await CreateOrder.find({ userId: targets.userId });
            if (!orders || orders.length === 0) {
                continue;
            }
            const allOrderItems = orders.flatMap(order => order.orderItems);
            const aggregatedOrders = allOrderItems.reduce((acc, item) => {
                const existingItem = acc.find(accItem => accItem.productId.toString() === item.productId._id.toString());
                if (existingItem) {
                    existingItem.qty += item.qty;
                    existingItem.price += item.price;
                } else {
                    acc.push({
                        productId: item.productId._id.toString(),
                        qty: item.qty,
                        price: item.price,
                    });
                }
                return acc;
            }, []);
            const productDetailsMap = {};
            const productIds = aggregatedOrders.map(order => order.productId);
            const products = await Product.find({ _id: { $in: productIds } });
            products.forEach(product => {
                productDetailsMap[product._id.toString()] = product;
            });
            const achievements = targets.products.flatMap(targetProduct => {
                const matchingOrders = aggregatedOrders.filter(order => order.productId === targetProduct.productId);
                if (matchingOrders.length > 0) {
                    const actualQuantity = matchingOrders.reduce((total, order) => total + order.qty, 0);
                    const actualTotalPrice = matchingOrders.reduce((total, order) => total + order.qty * order.price, 0);
                    const productDetails = productDetailsMap[targetProduct.productId.toString()] || {};
                    return {
                        productId: productDetails,
                        targetQuantity: targetProduct.qtyAssign,
                        actualQuantity: actualQuantity,
                        achievementPercentage: (actualQuantity / targetProduct.qtyAssign) * 100,
                        targetTotalPrice: targetProduct.totalPrice,
                        actualTotalPrice: actualTotalPrice
                    };
                } else {
                    return null;
                }
            }).filter(Boolean);
            const overallTargetQuantity = targets.products.reduce((total, targetProduct) => total + targetProduct.qtyAssign, 0);
            const overallActualQuantity = achievements.reduce((total, achievement) => total + achievement.actualQuantity, 0);
            const overallAchievementPercentage = (overallActualQuantity / overallTargetQuantity) * 100;

            latestAchieve = [...latestAchieve, ...achievements]
        }
        // console.log(achievements.products.detail.Size)
        return latestAchieve;
    } catch (error) {
        console.error('Error calculating achievements:', error);
        res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};
// 4
const getUserHierarchyBottomToTop2 = async function getUserHierarchyBottomToTop2(parentId, database, body, processedIds = new Set()) {
    try {
        if (processedIds.has(parentId)) {
            return [];
        }
        processedIds.add(parentId);
        const users = await User.find({ created_by: parentId, database: `${database}`, status: "Active" }).lean();
        const subUserIds = users.map(user => user._id);
        const achievement = await latestAchievement1(parentId, body);
        const subResultsPromises = subUserIds.map(userId => getUserHierarchyBottomToTop2(userId, database, body, processedIds));
        const subResults = await Promise.all(subResultsPromises);
        return [...achievement, ...subResults];
    } catch (error) {
        console.error('Error in getUserHierarchy:', error);
        throw error;
    }
};

// export const yes = async (req, res, next) => {
//     try {
//         let storedData = [];
//         const newParty = await Customer.find({ created_by: "65a101da103bf4d6762c209d" }).sort({ sortorder: -1 });
//         if (!newParty.length > 0) {
//             console.log(`party not found`);
//         }
//         for (let item of newParty) {
//             const target = await TargetCreation.find({ partyId: item._id }).sort({ sortorder: -1 });
//             const lastTarget = target[target.length - 1];
//             if (lastTarget) {
//                 const dd = await salesPerson(lastTarget.products, storedData.slice());
//                 storedData = dd;
//             }
//         }
//         return res.status(200).json({ storedData, status: true });
//     } catch (err) {
//         console.log(err);
//     }
// };


// ---------------------------------------------------------------------------------------

// final party and salerPerson targetAchievement

export const checkTarget = async (req, res) => {
    try {
        const party = await Customer.findById(req.params.id)
        if (party) {
            const target = await latestAchievement2(req.body, req.params.id, req.params.database)
            return res.send(target)
        }
        const customer = await Customer.find({ created_by: req.params.id, database: req.params.database })
        let latestAchieve = []
        for (let id of customer) {

            const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
            const endDate = req.body.endDate ? new Date(req.body.endDate) : null;

            const targetQuery = { partyId: id._id };
            if (startDate && endDate) {
                targetQuery.createdAt = { $gte: startDate, $lte: endDate };
                // targetQuery.startDate = { $gte: startDate };
                // targetQuery.endDate = { $lte: endDate };
            }

            const targetss = await TargetCreation.find(targetQuery);
            const targets = targetss[targetss.length - 1]
            if (targetss.length === 0) {
                continue;
                // return res.status(404).json({ error: 'Targets not found', status: false });
            }
            const orders = await CreateOrder.find({ partyId: targets.partyId });
            if (!orders || orders.length === 0) {
                continue;
                // return res.status(404).json({ error: 'Orders not found', status: false });
            }
            const allOrderItems = orders.flatMap(order => order.orderItems);
            const aggregatedOrders = allOrderItems.reduce((acc, item) => {
                const existingItem = acc.find(accItem => accItem.productId.toString() === item.productId._id.toString());
                if (existingItem) {
                    existingItem.qty += item.qty;
                    existingItem.price += item.price;
                } else {
                    acc.push({
                        productId: item.productId._id.toString(),
                        qty: item.qty,
                        price: item.price,
                    });
                }
                return acc;
            }, []);
            const productDetailsMap = {};
            const productIds = aggregatedOrders.map(order => order.productId);
            const products = await Product.find({ _id: { $in: productIds } });
            products.forEach(product => {
                productDetailsMap[product._id.toString()] = product;
            });
            const achievements = targets.products.flatMap(targetProduct => {
                const matchingOrders = aggregatedOrders.filter(order => order.productId === targetProduct.productId);
                if (matchingOrders.length > 0) {
                    const actualQuantity = matchingOrders.reduce((total, order) => total + order.qty, 0);
                    const actualTotalPrice = matchingOrders.reduce((total, order) => total + order.qty * order.price, 0);
                    const productDetails = productDetailsMap[targetProduct.productId.toString()] || {};
                    return {
                        productId: productDetails,
                        targetQuantity: targetProduct.qtyAssign,
                        actualQuantity: actualQuantity,
                        achievementPercentage: (actualQuantity / targetProduct.qtyAssign) * 100,
                        targetTotalPrice: targetProduct.totalPrice,
                        actualTotalPrice: actualTotalPrice
                    };
                } else {
                    return null;
                }
            }).filter(Boolean);
            const overallTargetQuantity = targets.products.reduce((total, targetProduct) => total + targetProduct.qtyAssign, 0);
            const overallActualQuantity = achievements.reduce((total, achievement) => total + achievement.actualQuantity, 0);
            const overallAchievementPercentage = (overallActualQuantity / overallTargetQuantity) * 100;

            latestAchieve = [...latestAchieve, ...achievements]
        }
        // console.log(achievements.products.detail.Size)
        return res.status(200).json({ latestAchieve, status: true });
    } catch (error) {
        console.error('Error calculating achievements:', error);
        res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};

export const latestAchievement2 = async (body, id, database) => {
    try {
        const partyId = id;
        const targets1 = await TargetCreation.findOne({ partyId: id, database: database });
        if (!targets1) {
            // return res.status(404).json({ message: "Not Found", status: false });
        }

        const startDate = body.startDate ? new Date(body.startDate) : null;
        const endDate = body.endDate ? new Date(body.endDate) : null;

        const targetQuery = { partyId: partyId };
        if (startDate && endDate) {
            targetQuery.createdAt = { $gte: startDate, $lte: endDate };
            // targetQuery.startDate = { $gte: startDate };
            // targetQuery.endDate = { $lte: endDate };
        }

        const targetss = await TargetCreation.find(targetQuery);
        const targets = targetss[targetss.length - 1]
        if (targetss.length === 0) {
            // return res.status(404).json({ error: 'Targets not found', status: false });
        }
        const orders = await CreateOrder.find({ partyId: targets.partyId });
        if (!orders || orders.length === 0) {
            // return res.status(404).json({ error: 'Orders not found', status: false });
        }
        const allOrderItems = orders.flatMap(order => order.orderItems);
        const aggregatedOrders = allOrderItems.reduce((acc, item) => {
            const existingItem = acc.find(accItem => accItem.productId.toString() === item.productId._id.toString());
            if (existingItem) {
                existingItem.qty += item.qty;
                existingItem.price += item.price;
            } else {
                acc.push({
                    productId: item.productId._id.toString(),
                    qty: item.qty,
                    price: item.price,
                });
            }
            return acc;
        }, []);
        const productDetailsMap = {};
        const productIds = aggregatedOrders.map(order => order.productId);
        const products = await Product.find({ _id: { $in: productIds } });
        products.forEach(product => {
            productDetailsMap[product._id.toString()] = product;
        });
        const achievements = targets.products.flatMap(targetProduct => {
            const matchingOrders = aggregatedOrders.filter(order => order.productId === targetProduct.productId);
            if (matchingOrders.length > 0) {
                const actualQuantity = matchingOrders.reduce((total, order) => total + order.qty, 0);
                const actualTotalPrice = matchingOrders.reduce((total, order) => total + order.qty * order.price, 0);
                const productDetails = productDetailsMap[targetProduct.productId.toString()] || {};
                return {
                    productId: productDetails,
                    targetQuantity: targetProduct.qtyAssign,
                    actualQuantity: actualQuantity,
                    achievementPercentage: (actualQuantity / targetProduct.qtyAssign) * 100,
                    targetTotalPrice: targetProduct.price,
                    actualTotalPrice: actualTotalPrice
                };
            } else {
                return null;
            }
        }).filter(Boolean);
        const overallTargetQuantity = targets.products.reduce((total, targetProduct) => total + targetProduct.qtyAssign, 0);
        const overallActualQuantity = achievements.reduce((total, achievement) => total + achievement.actualQuantity, 0);
        const overallAchievementPercentage = (overallActualQuantity / overallTargetQuantity) * 100;
        // console.log(achievements.products.detail.Size)
        return achievements
    } catch (error) {
        console.error('Error calculating achievements:', error);
        // res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};


// ---------------------------------------------------------------------------------------

// save target customer

export const SavePartyTarget = async (req, res) => {
    const filePath = req.file?.path;

    try {
        if (!filePath) {
            return res.status(400).json({ message: "No Excel file uploaded", status: false });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet(1);
        const headerRow = worksheet.getRow(1);
        const headings = headerRow.values.slice(1);

        const groupedData = {};

        for (let rowIndex = 2; rowIndex <= worksheet.actualRowCount; rowIndex++) {
            const row = worksheet.getRow(rowIndex);
            const rowData = {};

            headings.forEach((heading, i) => {
                const cell = row.getCell(i + 1);
                const value = cell.value;
                rowData[heading] = typeof value === 'object' && value?.text ? value.text : value;
            });

            const {
                salesPersonId,
                partyId,
                productId,
                qtyAssign,
                price,
                month,
                percentage,
                created_by
            } = rowData;

            const key = `${salesPersonId}_${partyId}_${created_by}_${month}`;

            if (!groupedData[key]) {
                groupedData[key] = {
                    salesPersonId,
                    partyId,
                    created_by,
                    date: month?.toString() || "",
                    products: []
                };
            }

            if (qtyAssign > 0) {
                const parsedQty = parseFloat(qtyAssign) || 0;
                const parsedPercentage = parseFloat(percentage) || 0;
                const parsedPrice = parseFloat(price) || 0;
                const adjustedQty = parsedQty + (parsedQty * parsedPercentage / 100);

                groupedData[key].products.push({
                    productId,
                    qtyAssign: adjustedQty,
                    price: parsedPrice,
                    totalPrice: adjustedQty * parsedPrice,
                    assignPercentage: [{
                        month: month?.toString() || "",
                        percentage: parsedPercentage
                    }]
                });
            }
        }

        const savedDocuments = [];

        for (const key in groupedData) {
            const entry = groupedData[key];

            const party = await Customer.findOne({ sId: entry.partyId });

            if (!party) {
                return res.status(404).json({
                    message: `Customer with ID ${entry.partyId} not found`,
                    status: false
                });
            }

            entry.database = party.database;
            const existingTarget = await TargetCreation.findOne({
                partyId: entry.partyId,
                date: entry.date
            });
            if (existingTarget) {
                existingTarget.products = entry.products;
                await existingTarget.save();
                savedDocuments.push(existingTarget);
            } else {
                if (entry?.products?.length > 0) {
                    const saved = await TargetCreation.create(entry);
                    savedDocuments.push(saved);
                }
            }
        }

        return res.status(200).json({
            message: `${savedDocuments.length} target(s) processed successfully.`,
            status: true,
            data: savedDocuments
        });

    } catch (error) {
        console.error("Error saving party targets from Excel:", error);
        return res.status(500).json({
            message: "Internal Server Error",
            status: false,
            error: error.message
        });
    } finally {
        if (filePath) {
            await fs.unlink(filePath).catch(err => console.error("File deletion error:", err));
        }
    }
};




// export const SavePartyTarget = async (req, res) => {
//     try {
//         const party = await Customer.findById(req.body.partyId);
//         if (!party) {
//             return res.status(404).json({ message: "Customer Not Found", status: false })
//         }
//         req.body.database = party.database
//         const target = await TargetCreation.create(req.body);
//         return res.status(200).json({ message: "Target saved successfully", status: true });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ error: "Internal Server Error", status: false });
//     }
// };
// view party target

export const ViewPartyTarget = async (req, res, next) => {
    try {
        const targets = await TargetCreation.find({
            database: req.params.database,
            partyId: { $ne: null }
        }).populate({ path: "created_by", model: "user" }).lean();

        if (targets.length === 0) {
            return res.status(404).json({ message: "Target not found", status: false });
        }

        const partyIds = [...new Set(targets.map(t => t.partyId))];

        const productIds = [
            ...new Set(
                targets.flatMap(t => t.products?.map(p => p.productId) || [])
            )
        ];

        const products = await Product.find({ sId: { $in: productIds } }).lean();
        const customers = await Customer.find({ sId: { $in: partyIds } }).lean();

        const productMap = {};
        const customerMap = {};

        products.forEach(product => {
            productMap[product.sId] = product;
        });

        customers.forEach(customer => {
            customerMap[customer.sId] = customer;
        });

        const enrichedTargets = targets.map(target => {
            const enrichedProducts = target.products?.map(prod => ({
                ...prod,
                productDetails: productMap[prod.productId] || null
            })) || [];

            return {
                ...target,
                customer: customerMap[target.partyId] || null,
                products: enrichedProducts
            };
        });

        return res.status(200).json({
            message: "Target data fetched successfully",
            status: true,
            data: enrichedTargets
        });

    } catch (err) {
        console.error("Error in ViewPartyTarget:", err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};

// export const ViewPartyTarget = async (req, res, next) => {
//     try {
//         const party = await TargetCreation.find({ database: req.params.database, partyId: { $ne: null } }).populate({path:"partyId",model:"customer"})
//         if (party.length === 0) {
//             return res.status(404).json({ message: "target not found", status: false })
//         }
//         return res.status(200).json({ TargetCreation: party, status: true })
//     }
//     catch (err) {
//         console.log(err)
//         return res.status(500).json({ error: "Internal Server Error", status: false })
//     }
// }


export const targetCalculation = async (req, res, next) => {
    try {
        let Target = {
            currentMonthTarget: 0,
            currentMonthAchieve: 0,
            targerPending: 0,
            averageTarget: 0,
            averageAchievement: 0,
            averagePending: 0
        };

        const { id, database } = req.params;
        let lastMonthCount = 1;

        const user = await User.findOne({ sId: id, database });
        const customer = !user ? await Customer.findOne({ sId: id, database }) : null;

        let Achievement = [];

        if (user) {
            const role = await Role.findOne({ _id: user.rolename });
            if (!role) {
                return res.status(404).json({ message: "Role not found", status: false });
            }

            const roleName = role.roleName;

            if (roleName === "SuperAdmin" || roleName === "Sales Manager") {
                Achievement = await SalesPersonAchievement(database);
            } else if (roleName === "Sales Person") {
                Achievement = await SalesPersonAchievement(database, user.sId, user._id);
            } else {
                return res.status(403).json({ message: "Access denied for this role", status: false });
            }

         } else if (customer) {
            Achievement = await CustomerTargetAchievement(database, customer.sId, customer._id);
        }else {
            return res.status(404).json({ message: "User or Customer not found", status: false });
        }

        if (!Achievement || !Achievement[0]?.achievements?.length) {
            return res.status(404).json({ message: "Achievement not found", status: false });
        }

        let totalSalesPersons = 0;

        Achievement[0].achievements.forEach(item => {
            Target.currentMonthTarget += item.totalTarget;
            Target.currentMonthAchieve += item.totalAchieve;
            Target.averageTarget += item.averageTarget;
            Target.averageAchievement += item.averageAchieve;
            totalSalesPersons += 1;
        });

        Target.targerPending = Target.currentMonthTarget - Target.currentMonthAchieve>0?Target.currentMonthTarget - Target.currentMonthAchieve:0;

        lastMonthCount = totalSalesPersons || 1;

        // Target.averageTarget = Target.currentMonthTarget / lastMonthCount;
        // Target.averageAchievement = Target.currentMonthAchieve / lastMonthCount;
        Target.averagePending = Target.averageTarget - Target.averageAchievement>0?Target.averageTarget - Target.averageAchievement:0;

        res.status(200).json({ Target, status: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};


export const SalesPersonAchievement = async (database, salesPersonId = null, userId = null) => {
  try {
    const role = await Role.findOne({ database, roleName: "Sales Person" });
    if (!role) return [];

    const query = { rolename: role._id, database, status: "Active" };
    if (salesPersonId) query.sId = salesPersonId;

    const users = await User.find(query);
    if (!users.length) return [];

    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();
    const currentMonthLabel = moment().format("MMM-YYYY");

 const salesPersonPromises = users.map(async (user) => {
  const targetQuery = { salesPersonId: user.sId, date: currentMonthLabel };
  const targetQuery1 = { salesPersonId: user.sId};
  const currentMonthTargetss = await TargetCreation.find(targetQuery).sort({ sortorder: -1 });
 const totalMonthsTargets = await TargetCreation.find(targetQuery1).sort({ sortorder: -1 });
  const uniqueMonths = new Set(totalMonthsTargets.map(t => t.date));
  const totalMonths = uniqueMonths.size;
  const allTotalTarget=totalMonthsTargets.flatMap((item)=>item.products||[]);
  const allTotalTargetss=allTotalTarget.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const allTarget = currentMonthTargetss.flatMap((item) => item.products || []);
  const totalTarget = allTarget.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
const averageTarget=allTotalTargetss/totalMonths;
  const CurrentMothOrders = await CreateOrder.find({
    userId: user._id,
    date: { $gte: startOfMonth, $lte: endOfMonth },
    status: "completed"
  });

  const allOrderItems = CurrentMothOrders.flatMap(order => order.orderItems || []);
  const aggregatedOrders = [];

  for (const item of allOrderItems) {
    const existingItem = aggregatedOrders.find(accItem =>
      accItem.originalProductId === item.productId.toString()
    );

    if (existingItem) {
      existingItem.qty += item.qty;
      existingItem.price = item.price;
      existingItem.grandTotal += item.grandTotal;
    } else {
      const findProduct = await Product.findById(item.productId);
      if (findProduct) {
        const pId = `${findProduct.category}-${findProduct.SubCategory}-${findProduct.Product_Title}`;
        aggregatedOrders.push({
          productId: pId,
          originalProductId: item.productId.toString(),
          qty: item.qty,
          price: item.price,
          grandTotal: item.grandTotal
        });
      }
    }
  }

    const TotalMothOrders = await CreateOrder.find({
    userId: user._id,
    status: "completed"
  });
  const orderMonths = new Set(
  TotalMothOrders.map(order => moment(order.date).format("MMM-YYYY"))
);

const totalOrderMonths = orderMonths.size;
  const allTotalOrderItems = TotalMothOrders.flatMap(order => order.orderItems || []);
  const aggregatedOrderss = [];

  for (const item of allTotalOrderItems) {
    const existingItem = aggregatedOrderss.find(accItem =>
      accItem.originalProductId === item.productId.toString()
    );

    if (existingItem) {
      existingItem.qty += item.qty;
      existingItem.price = item.price;
      existingItem.grandTotal += item.grandTotal;
    } else {
      const findProduct = await Product.findById(item.productId);
      if (findProduct) {
        const pId = `${findProduct.category}-${findProduct.SubCategory}-${findProduct.Product_Title}`;
        aggregatedOrderss.push({
          productId: pId,
          originalProductId: item.productId.toString(),
          qty: item.qty,
          price: item.price,
          grandTotal: item.grandTotal
        });
      }
    }
  }
 const totalsAchieve = aggregatedOrderss.reduce((sum, o) => sum + o.grandTotal, 0);
 const averageAchieve=totalsAchieve/(totalOrderMonths||1);
  const totalAchieve = aggregatedOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  return {
    totalTarget: totalTarget || 0,
    totalAchieve: totalAchieve || 0,
    averageTarget:averageTarget||0,
    averageAchieve:averageAchieve||0,
  };
});


    const results = (await Promise.all(salesPersonPromises)).filter(Boolean);

    return [{
      achievements: results
    }];

  } catch (err) {
    console.error("Error calculating SalesPersonAchievement:", err);
    return [];
  }
};


// export const SalesPersonAchievement = async (database, salesPersonId=null, userId=null) => {
//   try {
//     const role = await Role.findOne({ database, roleName: "Sales Person" });
//     if (!role) return [];

//     const query = { rolename: role._id, database, status: "Active" };
//     if (salesPersonId) query.sId = salesPersonId;

//     const users = await User.find(query);
//     if (!users.length) return [];

//     const startOfMonth = moment().startOf('month').toDate();
//     const endOfMonth = moment().endOf('month').toDate();
//     const currentMonthLabel = moment().format("MMM-YYYY");

//     const salesPersonPromises = users.map(async (user) => {
//       const targetQuery = { salesPersonId: user.sId, date: currentMonthLabel };
//       const targetss = await TargetCreation.find(targetQuery).sort({ sortorder: -1 });
//       if (!targetss.length) return null;

//       const allTarget = targetss.flatMap((item) => item.products);
//       const totalTarget = allTarget.reduce((sum, o) => sum + o.totalPrice, 0);

//       const orderQuery = {
//         userId: userId,
//         date: { $gte: startOfMonth, $lte: endOfMonth },
//         status: "completed"
//       };

//       const orders = await CreateOrder.find(orderQuery);
//       if (!orders.length) return null;

//       const allOrderItems = orders.flatMap(order => order.orderItems);
//       const aggregatedOrders = [];

//       for (const item of allOrderItems) {
//         const existingItem = aggregatedOrders.find(accItem =>
//           accItem.originalProductId === item.productId.toString()
//         );

//         if (existingItem) {
//           existingItem.qty += item.qty;
//           existingItem.price = item.price;
//           existingItem.grandTotal += item.grandTotal;
//         } else {
//           const findProduct = await Product.findById(item.productId);
//           if (findProduct) {
//             const pId = `${findProduct.category}-${findProduct.SubCategory}-${findProduct.Product_Title}`;
//             aggregatedOrders.push({
//               productId: pId,
//               originalProductId: item.productId.toString(),
//               qty: item.qty,
//               price: item.price,
//               grandTotal: item.grandTotal
//             });
//           }
//         }
//       }

//       const totalAchieve = aggregatedOrders.reduce((sum, o) => sum + o.grandTotal, 0);
     

//       return {
//         totalTarget,
//         totalAchieve,
//       };
//     });

//     const results = (await Promise.all(salesPersonPromises)).filter(Boolean);

//     return [{
//       achievements: results
//     }];

//   } catch (err) {
//     console.error("Error calculating SalesPersonAchievement:", err);
//     return [];
//   }
// };


export const CustomerTargetAchievement = async (database, partyId, customerId) => {
  try {
    const currentMonthLabel = moment().format("MMM-YYYY");
    const startOfMonth = moment().startOf("month").toDate();
    const endOfMonth = moment().endOf("month").toDate();

    const allTargets = await TargetCreation.find({ partyId, database });

    const uniqueTargetMonths = new Set(allTargets.map(t => t.date));
    const countTargetMonths = uniqueTargetMonths.size || 1;

    const allProducts = allTargets.flatMap(t => t.products || []);
    const totalAllTargets = allProducts.reduce((sum, p) => sum + (p.totalPrice || 0), 0);
    const averageTarget = totalAllTargets / countTargetMonths;

    const currentMonthTargets = allTargets.filter(t => t.date === currentMonthLabel);
    const currentMonthProducts = currentMonthTargets.flatMap(t => t.products || []);
    const totalTarget = currentMonthProducts.reduce((sum, p) => sum + (p.totalPrice || 0), 0);

    const allOrders = await CreateOrder.find({ partyId: customerId, status: "completed", database });

    const orderMonths = new Set(allOrders.map(o => moment(o.date).format("MMM-YYYY")));
    const countOrderMonths = orderMonths.size || 1;

    const allOrderItems = allOrders.flatMap(o => o.orderItems || []);
    const totalAllAchieve = allOrderItems.reduce((sum, i) => sum + (i.qty * i.price || 0), 0);
    const averageAchieve = totalAllAchieve / countOrderMonths;

    const currentMonthOrders = allOrders.filter(order =>
      order.date >= startOfMonth && order.date <= endOfMonth
    );
    const currentOrderItems = currentMonthOrders.flatMap(o => o.orderItems || []);
    const totalAchieve = currentOrderItems.reduce((sum, i) => sum + (i.qty * i.price || 0), 0);

    return [{
      achievements: [{
        totalTarget: totalTarget || 0,
        totalAchieve: totalAchieve || 0,
        averageTarget: averageTarget || 0,
        averageAchieve: averageAchieve || 0,
        monthCount: countTargetMonths
      }]
    }];
  } catch (err) {
    console.error("CustomerTargetAchievement error:", err);
    return [{
      achievements: [{
        totalTarget: 0,
        totalAchieve: 0,
        averageTarget: 0,
        averageAchieve: 0,
        monthCount: 0
      }]
    }];
  }
};




// For Dashboar
// export const targetCalculation = async (req, res, next) => {
//     try {
//         let Target = {
//             currentMonthTarget: 0,
//             currentMonthAchieve: 0,
//             targerPending: 0,
//             averageTarget: 0,
//             averageAchievement: 0,
//             averagePending: 0
//         };
//         const {id,database}=req.params
//         let lastMonthCount
//         const startOfDay = moment().startOf('month').toDate();
//         const endOfDay = moment().endOf('month').toDate();
//         const Achievement = await SalesPersonAchievement(database,id)
//         if (Achievement.length === 0) {
//             return res.status(404).json({ message: "achievement not found", status: false })
//         }
//         Achievement[0].achievements.forEach(item => {
//             Target.currentMonthAchieve += item.actualTotalPrice
//             Target.currentMonthTarget += item.targetTotalPrice
//             lastMonthCount = (1 < item.lastMonthCount) ? item.lastMonthCount : 1
//         })
//         Target.targerPending = Target.currentMonthTarget - Target.currentMonthAchieve;
//         Target.averageTarget = Target.currentMonthTarget / lastMonthCount;
//         Target.averageAchievement = Target.currentMonthAchieve / lastMonthCount;
//         Target.averagePending = Target.averageTarget - Target.averageAchievement;
//         res.status(200).json({ Target, status: true })
//     }
//     catch (err) {
//         console.log(err)
//         return res.status(500).json({ error: "Internal Server Error", status: false })
//     }
// }

// // For Dashboard
// export const SalesPersonAchievement = async (database,id) => {
//     try {
//         // const { database } = req.params;
//         const role = await Role.findOne({ database, roleName: "Sales Person" });
//         if (!role) {
//             // return res.status(404).json({ message: "Role Not Found", status: false });
//         }
//         const users = await User.find({ rolename: role._id, database, status: "Active" });
//         if (users.length === 0) {
//             // return res.status(404).json({ message: "No Active Sales Person Found", status: false });
//         }
//         // const { startDate, endDate } = req.body;
//         // const start = startDate ? new Date(startDate) : null;
//         // const end = endDate ? new Date(endDate) : null;
//         const salesPersonPromises = users.map(async (user) => {
//             console.log("user",user )
//             const targetQuery = { salesPersonId: user.sId };
//             // if (start && end) {
//             //     targetQuery.createdAt = { $gte: start, $lte: end };
//             // }
//             const targetss = await TargetCreation.find(targetQuery).populate({ path: "userId", model: "user" }).sort({ sortorder: -1 });
//             if (targetss.length === 0) return null;
//             const countMonth = await TargetCreation.find({ salesPersonId: user.sId})
//             const targets = targetss[targetss.length - 1];
//             console.log("taragerts",countMonth,targets)
//             const orders = await CreateOrder.find({ salesPersonId: targets.sId });
//             // console.log("order",orders)
//             if (!orders || orders.length === 0) return null;
//             const allOrderItems = orders.flatMap(order => order.orderItems);
//             const aggregatedOrders = allOrderItems.reduce((acc, item) => {
//                 const existingItem = acc.find(accItem => accItem.productId.toString() === item.productId._id.toString());
//                 if (existingItem) {
//                     existingItem.qty += item.qty;
//                     existingItem.price = item.price;
//                 } else {
//                     acc.push({
//                         productId: item.productId._id.toString(),
//                         qty: item.qty,
//                         price: item.price,
//                     });
//                 }
//                 return acc;
//             }, []);
//             const productIds = aggregatedOrders.map(order => order.productId);
//             const products = await Product.find({ _id: { $in: productIds } });
//             const productDetailsMap = products.reduce((acc, product) => {
//                 acc[product._id.toString()] = product;
//                 return acc;
//             }, {});
//             const achievements = targets.products.map(targetProduct => {
//                 const matchingOrders = aggregatedOrders.filter(order => order.productId === targetProduct.productId);
//                 if (matchingOrders.length > 0) {
//                     const actualQuantity = matchingOrders.reduce((total, order) => total + order.qty, 0);
//                     const actualTotalPrice = matchingOrders.reduce((total, order) => total + order.qty * order.price, 0);
//                     const productDetails = productDetailsMap[targetProduct.productId.toString()] || {};
//                     return {
//                         User: user,
//                         productId: productDetails,
//                         targetQuantity: targetProduct.qtyAssign,
//                         actualQuantity: actualQuantity,
//                         achievementPercentage: (actualQuantity / targetProduct.qtyAssign) * 100,
//                         productPrice: targetProduct.price,
//                         targetTotalPrice: (targetProduct.qtyAssign * productDetails.Product_MRP),// targetProduct.totalPrice,
//                         actualTotalPrice: (actualQuantity * productDetails.Product_MRP),  //actualTotalPrice
//                         lastMonthCount: countMonth.length
//                     };
//                 }
//                 return null;
//             }).filter(Boolean);

//             return { achievements };
//         });
//         const salesPerson = (await Promise.all(salesPersonPromises)).filter(Boolean);
//         // const salesTarget = salesPerson.map((salesPerson) => {
//         //     if (Array.isArray(salesPerson.achievements) && salesPerson.achievements.length === 1) {
//         //         salesPerson.achievements = salesPerson.achievements[0];
//         //     } else {
//         //         salesPerson.achievements = salesPerson.achievements[0];

//         //     }
//         //     return salesPerson;
//         // });
//         // return res.status(200).json({ salesTarget, status: true });
//         return salesPerson
//     } catch (error) {
//         console.error('Error calculating achievements:', error);
//     }
// };

// All SalesPerson Achievement
export const AllSalesPersonAchievement111 = async (req, res) => {
    try {
        let roleId
        const role = await Role.find({ database: req.params.database })
        for (let id of role) {
            if (id.roleName === "Sales Person") {
                roleId = id._id
            }
        }
        const userId = req.params.id;
        const user = await User.find({ rolename: roleId, database: req.params.database, status: "Active" })
        if (!user) {
            return res.status(404).json({ message: "Not Found", status: false });
        }
        let salesPerson = []
        for (let item of user) {
            const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
            const endDate = req.body.endDate ? new Date(req.body.endDate) : null;
            const targetQuery = { userId: item._id };
            if (startDate && endDate) {
                targetQuery.createdAt = { $gte: startDate, $lte: endDate };
            }
            const targetss = await TargetCreation.find(targetQuery).populate({ path: "userId", model: "user" }).sort({ sortorder: -1 });
            const targets = targetss[targetss.length - 1]
            if (targetss.length === 0) {
                console.log("targer not found")
                continue;
            }
            const orders = await CreateOrder.find({ userId: targets.userId });
            if (!orders || orders.length === 0) {
                console.log("order not found")
                continue;
            }
            const allOrderItems = orders.flatMap(order => order.orderItems);
            const aggregatedOrders = allOrderItems.reduce((acc, item) => {
                const existingItem = acc.find(accItem => accItem.productId.toString() === item.productId._id.toString());
                if (existingItem) {
                    existingItem.qty += item.qty;
                    existingItem.price += item.price;
                } else {
                    acc.push({
                        productId: item.productId._id.toString(),
                        qty: item.qty,
                        price: item.price,
                    });
                }
                return acc;
            }, []);
            const productDetailsMap = {};
            productDetailsMap.userName = targets?.userId?.firstName
            const productIds = aggregatedOrders.map(order => order.productId);
            const products = await Product.find({ _id: { $in: productIds } });
            products.forEach(product => {
                productDetailsMap[product._id.toString()] = product;
            });
            const achievements = targets.products.flatMap(targetProduct => {
                const matchingOrders = aggregatedOrders.filter(order => order.productId === targetProduct.productId);
                if (matchingOrders.length > 0) {
                    const actualQuantity = matchingOrders.reduce((total, order) => total + order.qty, 0);
                    const actualTotalPrice = matchingOrders.reduce((total, order) => total + order.qty * order.price, 0);
                    const productDetails = productDetailsMap[targetProduct.productId.toString()] || {};
                    return {
                        productId: productDetails,
                        targetQuantity: targetProduct.qtyAssign,
                        actualQuantity: actualQuantity,
                        achievementPercentage: (actualQuantity / targetProduct.qtyAssign) * 100,
                        productPrice: targetProduct.price,
                        targetTotalPrice: targetProduct.totalPrice,
                        actualTotalPrice: actualTotalPrice
                    };
                } else {
                    return null;
                }
            }).filter(Boolean);
            const overallTargetQuantity = targets.products.reduce((total, targetProduct) => total + targetProduct.qtyAssign, 0);
            const overallActualQuantity = achievements.reduce((total, achievement) => total + achievement.actualQuantity, 0);
            const overallAchievementPercentage = (overallActualQuantity / overallTargetQuantity) * 100;
            salesPerson.push({ achievements })
        }
        const salesTarget = salesPerson.map(salesPerson => {
            if (Array.isArray(salesPerson.achievements) && salesPerson.achievements.length === 1) {
                salesPerson.achievements = salesPerson.achievements[0];
            }
            return salesPerson;
        });
        return res.status(200).json({ salesTarget, status: true });
    } catch (error) {
        console.error('Error calculating achievements:', error);
        res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};

export const AllSalesPersonAchievement = async (req, res) => {
    try {
        const { database } = req.params;
        const role = await Role.findOne({ database, roleName: "Sales Person" });
        if (!role) {
            return res.status(404).json({ message: "Role Not Found", status: false });
        }
        const users = await User.find({ rolename: role._id, database, status: "Active" });
        if (users.length === 0) {
            return res.status(404).json({ message: "No Active Sales Person Found", status: false });
        }
        const { startDate, endDate } = req.body;
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        const salesPersonPromises = users.map(async (user) => {
            const targetQuery = { userId: user._id };
            if (start && end) {
                targetQuery.createdAt = { $gte: start, $lte: end };
            }
            const targetss = await TargetCreation.find(targetQuery).populate({ path: "userId", model: "user" }).sort({ sortorder: -1 });
            if (targetss.length === 0) return null;
            const targets = targetss[targetss.length - 1];
            const orders = await CreateOrder.find({ userId: targets.userId });
            if (!orders || orders.length === 0) return null;
            const allOrderItems = orders.flatMap(order => order.orderItems);
            const aggregatedOrders = allOrderItems.reduce((acc, item) => {
                const existingItem = acc.find(accItem => accItem.productId.toString() === item.productId._id.toString());
                if (existingItem) {
                    existingItem.qty += item.qty;
                    existingItem.price += item.price;
                } else {
                    acc.push({
                        productId: item.productId._id.toString(),
                        qty: item.qty,
                        price: item.price,
                    });
                }
                return acc;
            }, []);
            const productIds = aggregatedOrders.map(order => order.productId);
            const products = await Product.find({ _id: { $in: productIds } });
            const productDetailsMap = products.reduce((acc, product) => {
                acc[product._id.toString()] = product;
                return acc;
            }, {});
            const achievements = targets.products.map(targetProduct => {
                const matchingOrders = aggregatedOrders.filter(order => order.productId === targetProduct.productId);
                if (matchingOrders.length > 0) {
                    const actualQuantity = matchingOrders.reduce((total, order) => total + order.qty, 0);
                    const actualTotalPrice = matchingOrders.reduce((total, order) => total + order.qty * order.price, 0);
                    const productDetails = productDetailsMap[targetProduct.productId.toString()] || {};
                    return {
                        User: user,
                        productId: productDetails,
                        targetQuantity: targetProduct.qtyAssign,
                        actualQuantity: actualQuantity,
                        achievementPercentage: (actualQuantity / targetProduct.qtyAssign) * 100,
                        productPrice: targetProduct.price,
                        targetTotalPrice: targetProduct.totalPrice,
                        actualTotalPrice: actualTotalPrice
                    };
                }
                return null;
            }).filter(Boolean);

            return { achievements };
        });
        const salesPerson = (await Promise.all(salesPersonPromises)).filter(Boolean);
        const salesTarget = salesPerson.map(salesPerson => {
            if (Array.isArray(salesPerson.achievements) && salesPerson.achievements.length === 1) {
                salesPerson.achievements = salesPerson.achievements[0];
            }
            return salesPerson;
        });
        return res.status(200).json({ salesTarget, status: true });
    } catch (error) {
        console.error('Error calculating achievements:', error);
        res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};
