import dotenv from "dotenv";
import moment from "moment";
import path from "path"
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from "fs"
import pdf from 'html-pdf'
import { User } from "../model/user.model.js";
import { Product } from "../model/product.model.js";
import { CreateOrder } from "../model/createOrder.model.js";
import {generateInvoice, generateOrderNo } from "../service/invoice.js";
import { getCreateOrderHierarchy, getUserHierarchyBottomToTop } from "../rolePermission/RolePermission.js";
import { Customer } from "../model/customer.model.js";
import { createInvoiceTemplate } from "../Invoice/invoice.js";
import transporter from "../service/email.js";
import { Warehouse } from "../model/warehouse.model.js";
import { UpdateCheckLimitSales, checkLimit } from "../service/checkLimit.js";
import { Ledger } from "../model/ledger.model.js";
import { ClosingStock } from "../model/closingStock.model.js";
import { Receipt } from "../model/receipt.model.js";
import { ledgerPartyForDebit } from "../service/ledger.js";
import { addProductInWarehouse5, addProductInWarehouse6 } from "./product.controller.js";
import { Stock } from "../model/stock.js";
import { CompanyDetails } from "../model/companyDetails.model.js";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


export const createOrder = async (req, res, next) => {
    try {
        const orderItems = req.body.orderItems;
        const date1 = new Date();
        const date2 = new Date(req.body.date);
        const party = await Customer.findById({ _id: req.body.partyId })
        const user = await User.findOne({ _id: party.created_by });
        if (!user) {
            return res.status(401).json({ message: "No user found", status: false });
        } else {
            if (date1.toDateString() === date2.toDateString()) {
                if (party.paymentTerm.toLowerCase() !== "cash") {
                    const existOrders = await CreateOrder.find({ partyId: req.body.partyId,
                        status: { $nin: ['Deactive', 'Cancelled', 'Cancel in process'] },
                        paymentStatus: false }).sort({ date: 1, sortorder: -1 })
                    if (existOrders.length > 0) {
                        const due = existOrders[0];
                        const lastOrderDate = due?.date;
                        const currentDate = new Date();
                        const timeDifference = currentDate - lastOrderDate;
                        const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
                        if (days >= party.lockInTime) {
                            return res.status(400).json({ message: "First, you need to pay the previous payment", status: false });
                        }
                    }
                }
                const orderNo = await generateOrderNo(user.database);
                for (const orderItem of orderItems) {
                    const product = await Product.findById({ _id: orderItem.productId });
                    if (product) {
                        product.salesDate = new Date()
                        const warehouse = await Warehouse.findById(product.warehouse)
                        if (warehouse) {
                            const pro = warehouse.productItems.find((item) => item.productId.toString() === orderItem.productId.toString())
                            pro.currentStock -= (orderItem.qty);
                            product.qty -= orderItem.qty;
                            product.pendingQty += orderItem.qty;
                            await addProductInWarehouse6(product, product.warehouse, orderItem, req.body.date)
                            // await warehouse.save();
                            await product.save()
                        }
                    } else {
                        console.error(`Product with ID ${orderItem.productId} not found`);
                    }
                }
                const result = await generateInvoice(user.database);
          
                let challanNo = result
                let invoiceId = result
                req.body.challanNo = challanNo
                req.body.invoiceId = invoiceId

                req.body.userId = party.created_by
                req.body.database = user.database
                req.body.orderNo = orderNo
                req.body.orderItems = orderItems
                const savedOrder = CreateOrder.create(req.body)
                req.body.database = user.database;
                req.body.totalAmount = req.body.grandTotal;
                req.body.orderId = savedOrder._id;
                if (party.paymentTerm === "credit") {
                    await checkLimit(req.body)
                }
                return res.status(200).json({ orderDetail: savedOrder, status: true });
            } else {
                return res.status(404).json({ message: "select current date", status: false })
            }
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};
export const createOrderWithInvoice = async (req, res, next) => {
    try {
        const orderItems = req.body.orderItems;
        const date1 = new Date();
        const date2 = new Date(req.body.date);
        const party = await Customer.findById({ _id: req.body.partyId })
        const user = await User.findOne({ _id: party.created_by });
        if (!user) {
            return res.status(401).json({ message: "No user found", status: false });
        } else {
            if (date1.toDateString() === date2.toDateString()) {
                for (const orderItem of orderItems) {
                    const product = await Product.findById({ _id: orderItem.productId });
                    if (product) {
                        const warehouse = await Warehouse.findById(product.warehouse)
                        if (warehouse) {
                            const pro = warehouse.productItems.find((item) => item.productId.toString() === orderItem.productId.toString())
                            pro.currentStock -= (orderItem.qty);
                            product.qty -= orderItem.qty;
                            await warehouse.save();
                            await product.save()
                            await addProductInWarehouse5(product, product.warehouse, orderItem, req.body.date)
                        }
                    } else {
                        console.error(`Product with ID ${orderItem.productId} not found`);
                    }
                }
                req.body.status = "completed"
                req.body.userId = party.created_by
                req.body.database = user.database
                const savedOrder = await CreateOrder.create(req.body)
                if (savedOrder) {
                    const particular = "SalesInvoice";
                    await ledgerPartyForDebit(savedOrder, particular)
                }
                return res.status(200).json({ orderDetail: savedOrder, status: true });
            } else if (date1 > date2) {
                for (const orderItem of orderItems) {
                    const product = await Product.findById({ _id: orderItem.productId });
                    if (product) {
                        const warehouse = await Warehouse.findById(product.warehouse)
                        if (warehouse) {
                            const pro = warehouse.productItems.find((item) => item.productId.toString() === orderItem.productId.toString())
                            product.qty -= orderItem.qty;
                            await warehouse.save();
                            await product.save()
                            await addProductInWarehouse5(product, product.warehouse, orderItem, req.body.date)
                        }
                    } else {
                        console.error(`Product with ID ${orderItem.productId} not found`);
                    }
                }
                req.body.status = "completed"
                req.body.userId = party.created_by
                req.body.database = user.database
                req.body.paymentStatus = true;
                const savedOrder = await CreateOrder.create(req.body)
                if (savedOrder) {
                    const particular = "SalesInvoice";
                    await ledgerPartyForDebit(savedOrder, particular)
                }
                return res.status(200).json({ orderDetail: savedOrder, status: true });
            } else {
                return res.status(400).json({ message: "can not purchaseOrder of next date", status: false })
            }
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};
export const createOrderHistoryByUserId = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const orders = await CreateOrder.find({ userId: userId }).populate({ path: 'orderItems.productId', model: 'product' }).populate({ path: "partyId", model: "customer" }).exec();
        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: "No orders found for the user", status: false });
        }
        const formattedOrders = orders.map(order => {
            const formattedOrderItems = order.orderItems.map(item => ({
                product: item.productId,
                qty: item.qty,
                unitType: item.unitType,
                price: item.price,
                status: item.status
            }));
            return {
                _id: order._id,
                userId: order.userId,
                fullName: order.fullName,
                partyId: order.partyId,
                invoiceId: order.invoiceId,
                address: order.address,
                MobileNo: order.MobileNo,
                country: order.country,
                state: order.state,
                city: order.city,
                landMark: order.landMark,
                pincode: order.pincode,
                grandTotal: order.grandTotal,
                discount: order.discount,
                shippingCost: order.shippingCost,
                taxAmount: order.taxAmount,
                orderItems: formattedOrderItems,
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                currentAddress: req.body.currentAddress,
                status: order.status,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt
            };
        });
        return res.status(200).json({ orderHistory: formattedOrders, status: true });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err });
    }
};
export const createOrderHistoryById = async (req, res, next) => {
    try {
        const orders = await CreateOrder.findById(req.params.id).populate({ path: 'orderItems.productId', model: 'product' }).populate({ path: "partyId", model: "customer" }).exec();
        return res.status(200).json({ orderHistory: orders, status: true });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err });
    }
};
export const deleteSalesOrder = async (req, res, next) => {
    try {
        const order = await CreateOrder.findById(req.params.id)
        if (!order) {
            return res.status(404).json({ error: "Not Found", status: false });
        }
        if (order.status === "completed") {
            return res.status(400).json({ error: "this order not deleted", status: false });
        }
        for (const orderItem of order.orderItems) {
            const product = await Product.findById({ _id: orderItem.productId });
            if (product) {
                const warehouse = await Warehouse.findById(product.warehouse)
                if (warehouse) {
                    const pro = warehouse.productItems.find((item) => item.productId === orderItem.productId.toString())
                    if (pro) {
                        pro.currentStock += (orderItem.qty);
                        product.qty += orderItem.qty;
                        product.pendingQty -= orderItem.qty;
                        await deleteProductInStock(product, product.warehouse, orderItem, order.date)
                        await warehouse.save();
                        await product.save()
                    }
                }
            } else {
                console.error(`Product With ID ${orderItem.productId} Not Found`);
            }
        }
        await UpdateCheckLimitSales(order)
        order.status = "Deactive";
        await order.save();
        const companyDetails = await CompanyDetails.findOne({database:order.database})
        if(companyDetails){
            companyDetails.cancelInvoice.push({invoice:order.invoiceId})
            await companyDetails.save();
        }
        return res.status(200).json({ message: "delete successfull!", status: true })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
}
export const createOrderHistoryByPartyId = async (req, res, next) => {
    try {
        const orders = await CreateOrder.findById(req.params.id).populate({ path: 'orderItems.productId', model: 'product' }).populate({ path: "partyId", model: "customer" }).populate({ path: "userId", model: "user" }).exec();
        if (!orders) {
            return res.status(404).json({ message: "No orders found for the user", status: false });
        }
        let partyId;
        if (orders.partyId) {
            partyId = await Customer.findById(orders.partyId._id).populate({ path: 'category', model: "customerGroup" });
            if (!partyId) {
                console.log("Party details not found");
            }
        } else {
            console.log("Party ID not found in orders");
        }
        return res.status(200).json({ orderHistory: { ...orders.toObject(), partyId: undefined, partyId }, status: true });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err });
    }
};
export const OrdertoBilling = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await CreateOrder.findById({ _id: orderId })
        if (!order) {
            return res.status(404).json({ message: 'Sales Order Not Found', status: false });
        }
        for (const orderItem of req.body.orderItems) {
            const product = await Product.findById({ _id: orderItem.productId });
            if (product) {
                product.salesDate = new Date()
                const warehouse = await Warehouse.findById(orderItem.warehouse)
                if (warehouse) {
                    const pro = warehouse.productItems.find((item) => item.productId.toString() === orderItem.productId.toString())
                    pro.currentStock -= (orderItem.qty);
                    // product.qty -= orderItem.qty;
                    // product.pendingQty += orderItem.qty;
                    // await addProductInWarehouse6(product, product.warehouse, orderItem, req.body.date)
                    await warehouse.save();
                    // await product.save()
                }
            } else {
                console.error(`Product with ID ${orderItem.productId} not found`);
            }
        }
        order.orderItems = req.body.orderItems;
        order.status = "Billing";
        await order.save();
        return res.status(200).json({ message: "Order Billing Seccessfull!", Order: order, status: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};

// Order To Dispatch
export const OrdertoDispatch = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await CreateOrder.findById({ _id: orderId })
        if (!order) {
            return res.status(404).json({ message: 'Sales Order Not Found', status: false });
        }
        for (const orderItem of order.orderItems) {
            if (orderItem.warehouse.toString() === req.body.warehouse.toString()) {
                orderItem.status = "Dispatch";
            }
        }
        if (order.NoOfPackage) {
            order.NoOfPackage += req.body.NoOfPackage
        } else {
            order.NoOfPackage = req.body.NoOfPackage
        }
        for (const orderItem of order.orderItems) {
            if (orderItem.status === "Dispatch") {
                order.status = "Dispatch"
            }
            else {
                order.status = "Billing"
            }
        }
        const orders = await order.save();
        return res.status(200).json({ message: "Order Dispatch Seccessfull!", Order: orders, status: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};
// Order To Dispatch
export const DispatchOrderCancelFromWarehouse = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await CreateOrder.findById({ _id: orderId });
        if (!order) {
            return res.status(404).json({ message: 'Sales Order Not Found', status: false });
        }
        order.status = "pending";
        order.Remark = req.body.Remark;
        const orders = await order.save();
        return res.status(200).json({ message: "Order Dispatch Cancel Seccessfull!", Order: orders, status: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};
export const updateCreateOrder = async (req, res, next) => {
    try {
        const orderId = req.params.id;
        const updatedFields = req.body;
        if (!orderId || !updatedFields) {
            return res.status(400).json({ message: "Invalid input data", status: false });
        }
        const order = await CreateOrder.findById({ _id: orderId });
        if (!order) {
            return res.status(404).json({ message: "Order not found", status: false });
        }
        else if (order.status === 'completed')
            return res.status(400).json({ message: "this order not updated", status: false })
        const oldOrderItems = order.orderItems || [];
        const newOrderItems = updatedFields.orderItems || [];
        for (const newOrderItem of newOrderItems) {
            const oldOrderItem = oldOrderItems.find(item => item.productId.toString() === newOrderItem.productId.toString());
            if (oldOrderItem) {
                const quantityChange = newOrderItem.qty - oldOrderItem.qty;
                if (quantityChange !== 0) {
                    const product = await Product.findById({ _id: newOrderItem.productId });
                    if (product) {
                        product.qty -= quantityChange;
                        product.pendingQty += quantityChange;
                        const warehouse = await Warehouse.findById({ _id: product.warehouse })
                        if (warehouse) {
                            const pro = warehouse.productItems.find((item) => item.productId.toString() === newOrderItem.productId.toString())
                            pro.currentStock -= (quantityChange);
                            await warehouse.save();
                        }
                        await product.save()
                    } else {
                        console.error(`Product with ID ${newOrderItem.productId} not found`);
                    }
                }
            }
        }
        Object.assign(order, updatedFields);
        const updatedOrder = await order.save();
        return res.status(200).json({ orderDetail: updatedOrder, status: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
export const SalesOrderList = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const database = req.params.database;
        const adminDetail = await getUserHierarchyBottomToTop(userId, database)
        if (!adminDetail.length > 0) {
            return res.status(404).json({ error: "Product Not Found", status: false })
        }
        const createOrder = await CreateOrder.find({ database: database }).populate({
            path: 'orderItems.productId',
            model: 'product'
        }).populate({ path: "partyId", model: "customer" }).exec();
        if ((!createOrder || createOrder.length === 0)) {
            return res.status(404).json({ message: "No orders found", status: false });
        }
        return res.status(200).json({ orderHistory: createOrder, status: true });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};
export const createOrderHistory = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const adminDetail = await getCreateOrderHierarchy(userId)
        return (adminDetail.length > 0) ? res.status(200).json({ orderHistory: adminDetail, status: true }) : res.status(400).json({ message: "Not Found", status: false })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};
export const updateCreateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;
        const order = await CreateOrder.findById({ _id: orderId }).populate({ path: "userId", model: "user" }).populate({ path: "partyId", model: "customer" }).populate({ path: "orderItems.productId", model: "product" });
        if (!order) {
            return res.status(404).json({ message: 'sales order not found' });
        }
        order.status = status;
        await order.save();
        const timestamp = new Date().toISOString().replace(/[-:]/g, '');
        const invoiceFilename = `invoice_${timestamp}.pdf`;
        const pdfFilePath = path.resolve(__dirname, invoiceFilename);
        await new Promise((resolve, reject) => {
            pdf.create(createInvoiceTemplate(order), {}).toFile(pdfFilePath, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
        const attachment = fs.readFileSync(pdfFilePath).toString("base64");
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: order.partyId.email,
            subject: 'Pdf Generate document',
            html: 'Testing Pdf Generate document, Thanks.',
            attachments: [
                {
                    content: attachment,
                    filename: invoiceFilename,
                    contentType: 'application/pdf',
                    path: pdfFilePath
                }
            ]
        }, function (error, info) {
            if (error) {
                console.log(error);
            } else {
                fs.unlinkSync(pdfFilePath);
                res.send("Mail has been sent to your email. Check your mail");
            }
        });
        return res.status(200).json({ Order: order, status: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error, status: false });
    }
};
export const checkPartyOrderLimit = async (req, res, next) => {
    try {
        // const party = await PartyOrderLimit.findOne({ partyId: req.params.id })
        const party = await Customer.findById(req.params.id)
        if (party) {
            const CustomerLimit = (party.remainingLimit > 0) ? party.remainingLimit+party.AdvanceAmount : party.limit;
            return res.status(200).json({ CustomerLimit, message: `The limit on your order amount is ${CustomerLimit}`, status: true })
        } else {
            return res.status(404).json({ message: "Party Not Found", status: true })
        }
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false })
    }
}
export const ProductWiseSalesReport = async (req, res, next) => {
    try {
        const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
        const endDate = req.body.endDate ? new Date(req.body.endDate) : null;
        const targetQuery = { database: req.params.database };
        if (startDate && endDate) {
            targetQuery.createdAt = { $gte: startDate, $lte: endDate };
        }
        let orders = [];
        const salesOrder = await CreateOrder.find(targetQuery).populate({ path: "orderItems.productId", model: "product" });
        if (salesOrder.length === 0) {
            return res.status(404).json({ message: "Not Found", status: false });
        }
        for (let order of salesOrder) {
            orders = orders.concat(order.orderItems);
        }
        const uniqueOrdersMap = new Map();
        for (let orderItem of orders) {
            const key = orderItem.productId._id.toString() + orderItem.HSN_Code;
            if (uniqueOrdersMap.has(key)) {
                const existingOrder = uniqueOrdersMap.get(key);
                existingOrder.taxableAmount += orderItem.taxableAmount;
                existingOrder.cgstRate += orderItem.cgstRate;
                existingOrder.qty += orderItem.qty;
                existingOrder.Size += orderItem.Size;
                existingOrder.sgstRate += orderItem.sgstRate;
                existingOrder.igstRate += orderItem.igstRate;
                existingOrder.grandTotal += orderItem.grandTotal;
            } else {
                uniqueOrdersMap.set(key, { ...orderItem.toObject() });
            }
        }
        const uniqueOrders = Array.from(uniqueOrdersMap.values());
        return res.status(200).json({ Orders: uniqueOrders, status: true })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};
// Order History App
export const ViewOrderHistoryForPartySalesPerson = async (req, res, next) => {
    try {
        const orders = await CreateOrder.find({ partyId: req.params.id, status: { $ne: "Deactive" } }).populate({ path: 'orderItems.productId', model: 'product' }).populate({ path: "userId", model: "user" }).populate({ path: "partyId", model: "customer" })
        return res.status(200).json({ orderHistory: orders, status: true })
    }
    catch (err) {
        console.log(err)
        return res.status(500).json({ error: "Internal Server Error", status: false })
    }
}

//  For DashBoard
export const SalesOrderCalculate111 = async (req, res, next) => {
    try {
        let salesOrders = {
            totalAmount: 0,
            lastMonthAmount: 0,
            averageAmount: 0,
            totalPending: 0,
            totalDelivery: 0
        };
        const previousMonthStart = moment().subtract(1, 'months').startOf('month').toDate();
        const previousMonthEnd = moment().subtract(1, 'months').endOf('month').toDate();
        const order = await CreateOrder.find({ database: req.params.database }).sort({ sortorder: -1 })
        if (order.length === 0) {
            return res.status(404).json({ message: "Sales Order Not Found", status: false })
        }
        const lastMonth = order[0].createdAt.getMonth() + 1
        for (let item of order) {
            if (item.status === "Completed") {
                salesOrders.totalAmount += item.grandTotal
            }
            if (item.status === "pending") {
                salesOrders.totalPending++
            }
            if (item.status === "Pending for Delivery") {
                salesOrders.totalDelivery++
            }
        }
        const orders = await CreateOrder.find({
            database: req.params.database, status: "Completed",
            createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd }
        });
        if (orders.length === 0) {
            return res.status(404).json({ message: "Sales Order Not Found", status: false })
        }
        for (let item of orders) {
            salesOrders.lastMonthAmount += item.grandTotal
        }
        salesOrders.averageAmount = (salesOrders.totalAmount / lastMonth).toFixed(2)
        res.status(200).json({ salesOrders, status: true })
    }
    catch (err) {
        console.log(err)
        return res.status(500).json({ error: "Internal Server Error", status: false })
    }
}
export const SalesOrderCalculate = async (req, res, next) => {
    try {
        let salesOrders = {
            totalAmount: 0,
            lastMonthAmount: 0,
            averageAmount: 0,
            totalPending: 0,
            totalDelivery: 0
        };
        const previousMonthStart = moment().subtract(1, 'months').startOf('month').toDate();
        const previousMonthEnd = moment().subtract(1, 'months').endOf('month').toDate();
        const orders = await CreateOrder.find({ database: req.params.database }).sort({ sortorder: -1 });
        if (orders.length === 0) {
            return res.status(404).json({ message: "Sales Order Not Found", status: false });
        }
        let completedOrdersLastMonth = [];
        const lastMonth = orders[0].date.getMonth() + 1
        orders.forEach(order => {
            if (order.status.toLowerCase() === "completed") {
                salesOrders.totalAmount += order.grandTotal;
                if (moment(order.date).isBetween(previousMonthStart, previousMonthEnd, null, '[]')) {
                    completedOrdersLastMonth.push(order);
                }
            } else if (order.status.toLowerCase() === "pending") {
                salesOrders.totalPending++;
            } else if (order.status.toLowerCase() === "pending for delivery") {
                salesOrders.totalDelivery++;
            }
        });
        completedOrdersLastMonth.forEach(order => {
            salesOrders.lastMonthAmount += order.grandTotal;
        });
        salesOrders.averageAmount = (salesOrders.totalAmount / lastMonth).toFixed(2);
        return res.status(200).json({ SalesCalculation: salesOrders, status: true });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};

// For DashBoard
export const DebitorCalculate = async (req, res, next) => {
    try {
        let Debtor = {
            totalReceipt: 0,
            totalDue: 0,
            currentReceipt: 0,
            currentOutstanding: 0,
            totalOutstanding: 0
        };
        const startOfDay = moment().startOf('month').toDate();
        const endOfDay = moment().endOf('month').toDate();
        const [salesOrder, salesOrderCurrentMonth, receipt, receipts] = await Promise.all([
            CreateOrder.find({ database: req.params.database, status: "completed" }).sort({ sortorder: -1 }),
            CreateOrder.find({ database: req.params.database, status: "completed", date: { $gte: startOfDay, $lte: endOfDay } }).sort({ sortorder: -1 }),
            Receipt.find({ database: req.params.database, type: "receipt", status: "Active" }).sort({ sortorder: -1 }),
            Receipt.find({ database: req.params.database, type: "receipt", date: { $gte: startOfDay, $lte: endOfDay }, status: "Active" }).sort({ sortorder: -1 })
        ]);
        Debtor.totalDue = salesOrder.reduce((sum, item) => sum + item.grandTotal, 0);
        let currentSales = salesOrderCurrentMonth.reduce((sum, item) => sum + item.grandTotal, 0);
        Debtor.totalReceipt = receipt.reduce((sum, item) => sum + item.amount, 0);
        Debtor.currentReceipt = receipts.reduce((sum, item) => sum + item.amount, 0);

        res.status(200).json({ Debtor, status: true });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};

// --------------------------------------------
export const deletedSalesOrder = async (req, res, next) => {
    try {
        const order = await CreateOrder.findById(req.params.id)
        if (!order) {
            return res.status(404).json({ error: "Not Found", status: false });
        }
        for (const orderItem of order.orderItems) {
            const product = await Product.findById({ _id: orderItem.productId });
            if (product) {
                const warehouse = await Warehouse.findById(orderItem.warehouse)
                if (warehouse) {
                    const pro = warehouse.productItems.find((item) => item.productId === orderItem.productId.toString())
                    pro.currentStock += (orderItem.qty);
                    product.qty += orderItem.qty;
                    product.pendingQty -= orderItem.qty;
                    await warehouse.save();
                    await product.save()
                }
            } else {
                console.error(`Product With ID ${orderItem.productId} Not Found`);
            }
        }
        await UpdateCheckLimitSales(order)
        order.status = "Deactive";
        await order.save();
        await Ledger.findOneAndDelete({ orderId: req.params.id })
        const companyDetails = await CompanyDetails.findOne({database:order.database})
        if(companyDetails){
            companyDetails.cancelInvoice.push({invoice:order.invoiceId})
            await companyDetails.save();
        }
        return res.status(200).json({ message: "delete successfull!", status: true })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
}
export const deleteProductInStock = async (warehouse, warehouseId, orderItem, date) => {
    try {
        const dates = new Date(date);
        const startOfDay = new Date(dates);
        const endOfDay = new Date(dates);
        startOfDay.setUTCHours(0, 0, 0, 0);
        endOfDay.setUTCHours(23, 59, 59, 999);
        const stock = await Stock.find({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay } });
        if (stock.length === 0) {
            return console.log("warehouse not found");
        } else {
            for (let item of stock) {
                const existingStock = item.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
                if (existingStock) {
                    if (item.date.toDateString() === dates.toDateString()) {
                        existingStock.pendingStock -= orderItem.qty
                        existingStock.currentStock += orderItem.qty
                        existingStock.totalPrice -= (orderItem.qty * orderItem.price);
                        existingStock.rQty += orderItem.qty
                        item.markModified('productItems');
                        await item.save();
                    } else {
                        existingStock.currentStock += orderItem.qty
                        existingStock.totalPrice -= (orderItem.qty * orderItem.price);
                        // existingStock.rQty += orderItem.qty
                        item.markModified('productItems');
                        await item.save();
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
};
export const DeleteClosingSales = async (orderItem, warehouse) => {
    try {
        let cgstRate = 0;
        let sgstRate = 0;
        let igstRate = 0;
        let tax = 0
        const rate = parseInt(orderItem.gstPercentage) / 2;
        if (orderItem.igstTaxType === false) {
            cgstRate = (((orderItem.qty) * orderItem.price) * rate) / 100;
            sgstRate = (((orderItem.qty) * orderItem.price) * rate) / 100;
            tax = cgstRate + sgstRate
        } else {
            igstRate = (((orderItem.qty) * orderItem.price) * parseInt(orderItem.gstPercentage)) / 100;
            tax = igstRate
        }
        const stock = await ClosingStock.findOne({ warehouseId1: warehouse, productId: orderItem.productId })
        if (stock) {
            stock.sQty -= (orderItem.qty);
            stock.sBAmount -= orderItem.totalPrice;
            stock.sTaxRate -= tax;
            stock.sTotal -= (orderItem.totalPrice + tax)
            await stock.save()
        }
    }
    catch (err) {
        console.log(err)
    }
}

// For Customer Target, Purchase Product Qty By Customer
export const PartyPurchaseqty = async (req, res, next) => {
    try {
        const previousMonthStart = moment().subtract(1, 'months').startOf('month').toDate();
        const previousMonthEnd = moment().subtract(1, 'months').endOf('month').toDate();
        let qty = 0;
        const partyOrder = await CreateOrder.find({
            partyId: req.params.partyId,
            createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd }
        });
        if (!partyOrder.length) {
            return res.status(200).json({ qty, status: true });
        }
        for (let item of partyOrder) {
            for (let orderItem of item.orderItems) {
                if (orderItem.productId.toString() === req.params.productId) {
                    qty += orderItem.qty;
                }
            }
        }
        return res.status(200).json({ qty, status: true });
    } catch (err) {
        console.error("Error fetching party purchase quantity:", err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
}

export const CheckPartyPayment = async (req, res, next) => {
    try {
        let amount = 100000
        const Orders = await CreateOrder.find({ partyId: "66e42d7b3e4aac5818e47e1a", paymentStatus: { $ne: true } })
        if (Orders.length === 0) {
            return res.status(404).json({ message: "Order's Not Found", status: false })
        }
        for (let item of Orders) {
            const remaining = amount - item.grandTotal;
            console.log("-------------------------------")
            console.log(item.grandTotal)
            console.log("-------------------------------")
            if (remaining < 0) {
                console.log("Negetive Value", item.grandTotal)
                return false
            } else {
                console.log("Positive ", item.grandTotal)
                amount = remaining
                console.log(remaining)
                Orders.paymentStatus = true;
                console.log(Orders.paymentStatus)
            }
        }
    }
    catch (err) {
        console.log(err)
    }
}