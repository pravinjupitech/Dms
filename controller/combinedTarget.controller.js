
// import multer from "multer";
// import ExcelJS from "exceljs";
// import CombinedTarget from "../model/combinedTarget.model.js";
// import { User } from "../model/user.model.js";
// import { Customer } from "../model/customer.model.js";
// import { AssignRole } from "../model/assignRoleToDepartment.model.js";

// const upload = multer({ storage: multer.memoryStorage() });
// export const combinedTargetUpload = upload.single("file");

// const num = (v) => (isFinite(+v) ? +v : 0);

// /**
//  * Create / Upsert Combined Target (JSON or Excel)
//  * POST /combined-targets
//  * - JSON body:
//  *    { date: "November-2025", incrementPercent?: number, products: [{productId, qtyAssign, price, totalPrice}], grandTotal?, created_by?, database? }
//  *   If a document exists for the same `date`, it will be updated (upsert by date).
//  *
//  * - Excel body (multipart form-data, field "file"):
//  *   Columns expected: productId, qtyAssign, price, month (optional), percentage (optional)
//  *   You can also send form fields: date, incrementPercent, created_by, database
//  */
// export const saveCombinedTarget = async (req, res) => {
//     try {
//         // ===== Path A: Excel upload =====
//         if (req.file) {
//             const workbook = new ExcelJS.Workbook();
//             await workbook.xlsx.load(req.file.buffer);
//             const sheet = workbook.getWorksheet(1) || workbook.worksheets?.[0];
//             if (!sheet) {
//                 return res
//                     .status(400)
//                     .json({ status: false, message: "Empty Excel file" });
//             }

//             const headerRow = sheet.getRow(1);
//             const headers = (headerRow?.values || [])
//                 .slice(1)
//                 .map((h) => String(h || "").trim());
//             const colIndex = (name) =>
//                 headers.findIndex((h) => h.toLowerCase() === name.toLowerCase()) + 1;

//             const ciProduct = colIndex("productId");
//             const ciQty = colIndex("qtyAssign");
//             const ciPrice = colIndex("price");
//             const ciMonth = colIndex("month");
//             const ciPct = colIndex("percentage"); // optional per-row

//             if (!ciProduct || !ciQty) {
//                 return res.status(400).json({
//                     status: false,
//                     message: "Sheet must contain 'productId' and 'qtyAssign' columns",
//                 });
//             }

//             // Top-level fields (from form)
//             const dateFromForm = String(req.body?.date || "");
//             const globalPct = num(req.body?.incrementPercent ?? 0);
//             const created_by = req.body?.created_by || undefined;
//             const database = req.body?.database || undefined;

//             const products = [];
//             let monthLabel = dateFromForm || "";

//             for (let r = 2; r <= sheet.actualRowCount; r++) {
//                 const row = sheet.getRow(r);
//                 const productId = row.getCell(ciProduct)?.value ?? "";
//                 const qty = num(row.getCell(ciQty)?.value ?? 0);
//                 if (!productId || qty <= 0) continue;

//                 const price = num(ciPrice ? (row.getCell(ciPrice)?.value ?? 0) : 0);
//                 const pctRow = num(ciPct ? (row.getCell(ciPct)?.value ?? 0) : 0);

//                 if (!monthLabel && ciMonth) {
//                     const mv = row.getCell(ciMonth)?.value;
//                     if (mv) monthLabel = String(mv);
//                 }

//                 const appliedPct = pctRow || globalPct || 0;
//                 const finalQty = qty + (qty * appliedPct) / 100;

//                 products.push({
//                     productId:
//                         typeof productId === "object" && productId?.text
//                             ? productId.text
//                             : String(productId),
//                     qtyAssign: finalQty,
//                     price,
//                     totalPrice: price * finalQty,
//                 });
//             }

//             if (!products.length) {
//                 return res
//                     .status(400)
//                     .json({ status: false, message: "No valid rows found in sheet" });
//             }

//             const grand = products.reduce((s, p) => s + num(p.totalPrice), 0);
//             const doc = {
//                 date: monthLabel || null,
//                 incrementPercent: globalPct || 0,
//                 products,
//                 grandTotal: grand,
//                 created_by,
//                 database,
//             };

//             // Upsert by date
//             let saved;
//             if (doc.date) {
//                 const existing = await CombinedTarget.findOne({ date: doc.date });
//                 if (existing) {
//                     existing.incrementPercent = doc.incrementPercent;
//                     existing.products = doc.products;
//                     existing.grandTotal = doc.grandTotal;
//                     if (doc.created_by) existing.created_by = doc.created_by;
//                     if (doc.database) existing.database = doc.database;
//                     saved = await existing.save();
//                 } else {
//                     saved = await CombinedTarget.create(doc);
//                 }
//             } else {
//                 saved = await CombinedTarget.create(doc);
//             }

//             return res.json({
//                 status: true,
//                 message: "Combined target saved",
//                 data: saved,
//             });
//         }

//         // ===== Path B: JSON payload =====
//         const {
//             date,
//             incrementPercent = 0,
//             products = [],
//             grandTotal,
//             created_by,
//             database,
//         } = req.body || {};

//         if (!date || !Array.isArray(products) || products.length === 0) {
//             return res.status(400).json({
//                 status: false,
//                 message: "Missing required fields (date, products)",
//             });
//         }

//         const normalized = products.map((p) => {
//             const qty = num(p.qtyAssign);
//             const price = num(p.price);
//             const total = p.totalPrice != null ? num(p.totalPrice) : qty * price;
//             return {
//                 productId: p.productId,
//                 qtyAssign: qty,
//                 price,
//                 totalPrice: total,
//             };
//         });

//         const computedGrand = normalized.reduce((s, p) => s + num(p.totalPrice), 0);

//         const payload = {
//             date: String(date),
//             incrementPercent: num(incrementPercent),
//             products: normalized,
//             grandTotal: grandTotal != null ? num(grandTotal) : computedGrand,
//             created_by,
//             database,
//         };

//         let saved;
//         const existing = await CombinedTarget.findOne({ date: payload.date });
//         if (existing) {
//             existing.incrementPercent = payload.incrementPercent;
//             existing.products = payload.products;
//             existing.grandTotal = payload.grandTotal;
//             if (payload.created_by) existing.created_by = payload.created_by;
//             if (payload.database) existing.database = payload.database;
//             saved = await existing.save();
//         } else {
//             saved = await CombinedTarget.create(payload);
//         }

//         return res.json({
//             status: true,
//             message: "Combined target saved",
//             data: saved,
//         });
//     } catch (err) {
//         console.error("saveCombinedTarget error:", err);
//         return res.status(500).json({
//             status: false,
//             message: "Internal Server Error",
//             error: err.message,
//         });
//     }
// };

// /** GET /combined-targets  */
// export const listCombinedTargets = async (req, res) => {
//     try {
//         const { database } = req.query || {};
//         const q = {};
//         if (database) q.database = database;
//         const data = await CombinedTarget.find(q)
//             .populate({ path: "products.productId", model: "product" })
//             .sort({ createdAt: -1 })
//             .lean();
//         return res.json({ status: true, data });
//     } catch (err) {
//         console.error("listCombinedTargets error:", err);
//         return res
//             .status(500)
//             .json({ status: false, message: "Internal Server Error" });
//     }
// };

// /** PUT /combined-targets/:id */
// export const updateCombinedTarget = async (req, res) => {
//     try {
//         const id = req.params.id;
//         const body = req.body || {};
//         const updated = await CombinedTarget.findByIdAndUpdate(id, body, {
//             new: true,
//         });
//         if (!updated) {
//             return res
//                 .status(404)
//                 .json({ status: false, message: "Combined target not found" });
//         }
//         return res.json({
//             status: true,
//             message: "Updated successfully",
//             data: updated,
//         });
//     } catch (err) {
//         console.error("updateCombinedTarget error:", err);
//         return res
//             .status(500)
//             .json({ status: false, message: "Internal Server Error" });
//     }
// };

// /** DELETE /combined-targets/:id */
// export const deleteCombinedTarget = async (req, res) => {
//     try {
//         const id = req.params.id;
//         const deleted = await CombinedTarget.findByIdAndDelete(id);
//         if (!deleted) {
//             return res
//                 .status(404)
//                 .json({ status: false, message: "Combined target not found" });
//         }
//         return res.json({ status: true, message: "Deleted successfully" });
//     } catch (err) {
//         console.error("deleteCombinedTarget error:", err);
//         return res
//             .status(500)
//             .json({ status: false, message: "Internal Server Error" });
//     }
// };

// export const targetCreate = async (req, res, next) => {
//     try {
//         const { database } = req.params;
//         const department = await AssignRole.find({ database: database }).populate({ path: "created_by", model: "user" }).populate({ path: "departmentName", model: "department" }).populate({ path: "roles.roleId", model: "role" }).sort({ sortorder: -1 });
//         const user = await User.find({ database: database }).populate({ path: "created_by", model: "user" }).populate({ path: "rolename", model: "role" })
//             let customer = await Customer.find({ database: database }).sort({ sortorder: -1 }).populate({ path: "rolename", model: "role" })
//             const data = user.concat(customer)
//             for(let item of department){
//                 if (item.departmentName.departmentName?.toUpperCase() === "SALES") {
//                     item.roles.forEach((item)=>{

//                         console.log("item",item)
//                     })
// }

//             }
//     } catch (error) {
// console.log(error);
//         res.status(500).json({ message: "Internal Server Error",error:error.message,status:false });  
//     }
// }




// controllers/customerTargetController.js
import { AssignRole } from "../model/assignRoleToDepartment.model.js";
import CustomerTarget from "../model/combinedTarget.model.js";
import { Customer } from "../model/customer.model.js";
import { User } from "../model/user.model.js";
import { FY_MONTHS } from "../utils/fyMonths.js";
import mongoose from "mongoose";

const FY_MONTHS_ORDER = [
    "April", "May", "June",
    "July", "August", "September",
    "October", "November", "December",
    "January", "February", "March"
];

// export const setCustomerTarget = async (req, res) => {
//     try {
//         const { customerId, financialYear, startMonth, products, database } = req.body;

//         if (!customerId || !financialYear || !startMonth || !products || !database) {
//             return res.status(400).json({ message: "All fields are required" });
//         }

//         const customer = await Customer.findById(customerId);
//         if (!customer) return res.status(404).json({ message: "Customer not found" });
//         const department = await AssignRole.find({ database })
//             .populate({ path: "departmentName", model: "department" })
//             .populate({ path: "roles.roleId", model: "role" })
//             .sort({ sortorder: -1 });

//        const salesRoles =
//   department.find(
//     item => item?.departmentName?.departmentName?.toLowerCase() === "sales"
//   )?.roles || [];
//   console.log("sales",salesRoles)

//         const salesPersonId = customer.created_by;
//         const salesPerson = await User.findById(salesPersonId);
//         if (!salesPerson) return res.status(404).json({ message: "Sales person not found" });

//         const salesManagerId = salesPerson.created_by;

//         // Delete existing target for this customer, database & year
//         await CustomerTarget.deleteMany({ customerId, financialYear, database });

//         // Initialize grandTotal map and product monthly totals
//         let amount = 0;
//         const grandTotalPerMonth = {};
//         const productData = products.map(p => ({
//             productId: p.productId,
//             monthlyQty: {},
//             monthlyPrice: {},
//             monthlyTotal: {}
//         }));

//         const startIndex = FY_MONTHS.indexOf(startMonth);

//         for (let i = startIndex; i < FY_MONTHS.length; i++) {
//             const month = FY_MONTHS[i];

//             // Calculate total for this month
//             let monthTotal = 0;
//             productData.forEach((prod, idx) => {
//                 const qty = products[idx].qtyAssign;
//                 const price = products[idx].price;
//                 const total = qty * price;
//                 prod.monthlyQty[month] = qty;
//                 prod.monthlyPrice[month] = price;
//                 prod.monthlyTotal[month] = total;
//                 monthTotal += total;
//             });

//             grandTotalPerMonth[month] = Math.round(monthTotal);

//             // Increase amount by 10% for next month
//             products.forEach((p) => (p.price = p.price * 1.1));
//         }

//         // Create single document
//         // await CustomerTarget.create({
//         //     customerId,
//         //     salesPersonId,
//         //     salesManagerId,
//         //     financialYear,
//         //     database,
//         //     products: productData,
//         //     grandTotalPerMonth,
//         //     //   created_by: req.user._id
//         // });

//         res.status(200).json({ message: "Customer target saved in a single document successfully" });

//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// };



export const setCustomerTarget = async (req, res) => {
  try {
    const { customerId, financialYear, startMonth, products, database } = req.body;

    if (!customerId || !financialYear || !startMonth || !products || !database) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    // Fetch sales roles
    const departments = await AssignRole.find({ database })
      .populate({ path: "departmentName", model: "department" })
      .populate({ path: "roles.roleId", model: "role" });

    const salesRoles = departments.find(
      dep => dep?.departmentName?.departmentName?.toLowerCase() === "sales"
    )?.roles || [];

    // Sort roles from bottom to top (higher rolePosition = closer to bottom)
    salesRoles.sort((a, b) => b.rolePosition - a.rolePosition);

    // Prepare dynamic role keys
    const roleKeys = salesRoles.map(r =>
      r.roleId.roleName.replace(/\s+/g, '').replace(/^\w/, c => c.toLowerCase()) + 'Id'
    );

    // Assign roles dynamically bottom-to-top, skipping the customer itself
    const rolesObj = {};
    let currentUser = customer.created_by ? await User.findById(customer.created_by) : null;

    // Skip the first roleKey if it represents the customer itself
    for (let i = 1; i < roleKeys.length; i++) {
      rolesObj[roleKeys[i]] = currentUser?._id || null;
      currentUser = currentUser?.created_by ? await User.findById(currentUser.created_by) : null;
    }

    // Prepare product and monthly totals
    const productData = products.map(p => ({
      productId: p.productId,
      monthlyQty: {},
      monthlyPrice: {},
      monthlyTotal: {}
    }));

    const grandTotalPerMonth = {};
    const startIndex = FY_MONTHS.indexOf(startMonth);

    for (let i = startIndex; i < FY_MONTHS.length; i++) {
      const month = FY_MONTHS[i];
      let monthTotal = 0;

      productData.forEach((prod, idx) => {
        const qty = products[idx].qtyAssign;
        const price = products[idx].price;
        const total = qty * price;

        prod.monthlyQty[month] = qty;
        prod.monthlyPrice[month] = price;
        prod.monthlyTotal[month] = total;

        monthTotal += total;
      });

      grandTotalPerMonth[month] = Math.round(monthTotal);

      // Increase price by 10% for next month
      products.forEach(p => p.price = p.price * 1.1);
    }

    // ✅ Upsert without including customerId inside roles
    const customerTarget = await CustomerTarget.findOneAndUpdate(
      { customerId, financialYear, database },
      {
        $set: {
          products: productData,
          grandTotalPerMonth,
          roles: rolesObj, // only upper roles
          created_by: req.user?._id
        }
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: "Customer target saved/updated successfully with only upper hierarchy roles",
      data: customerTarget
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};



// export const updateCustomerTarget = async (req, res) => {
//     try {
//         const { customerId, financialYear, products, database } = req.body;

//         if (!customerId || !financialYear || !products || !database) {
//             return res.status(400).json({ message: "All fields are required" });
//         }

//         const customer = await Customer.findById(customerId);
//         if (!customer) return res.status(404).json({ message: "Customer not found" });

//         const salesPersonId = customer.created_by;
//         const salesPerson = await User.findById(salesPersonId);
//         if (!salesPerson) return res.status(404).json({ message: "Sales person not found" });

//         const salesManagerId = salesPerson.created_by;

//         // Find existing target
//         let customerTarget = await CustomerTarget.findOne({ customerId, financialYear, database });
//         if (!customerTarget) {
//             return res.status(404).json({ message: "Customer target not found. Create it first." });
//         }

//         // Determine current month automatically
//         const now = new Date();
//         const currentMonthName = FY_MONTHS_ORDER[now.getMonth()]; // JS months 0-11
//         const startIndex = FY_MONTHS_ORDER.indexOf(currentMonthName);

//         const grandTotalPerMonth = { ...customerTarget.grandTotalPerMonth };

//         // Update product data
//         const productData = customerTarget.products.map((prod) => {
//             const updatedProduct = products.find(p => p.productId.toString() === prod.productId.toString());
//             if (!updatedProduct) return prod;

//             FY_MONTHS_ORDER.forEach((month, idx) => {
//                 if (idx < startIndex) {
//                     // Past months remain unchanged
//                     prod.monthlyQty[month] = prod.monthlyQty[month];
//                     prod.monthlyPrice[month] = prod.monthlyPrice[month];
//                     prod.monthlyTotal[month] = prod.monthlyTotal[month];
//                     grandTotalPerMonth[month] = customerTarget.grandTotalPerMonth[month];
//                 } else {
//                     // Current and future months
//                     const prevPrice = idx === startIndex
//                         ? updatedProduct.price
//                         : prod.monthlyPrice[FY_MONTHS_ORDER[idx - 1]] * 1.1;

//                     const qty = updatedProduct.qtyAssign;
//                     const total = qty * prevPrice;

//                     prod.monthlyQty[month] = qty;
//                     prod.monthlyPrice[month] = parseFloat(prevPrice.toFixed(2)); // keep 2 decimals
//                     prod.monthlyTotal[month] = Math.round(total);

//                     grandTotalPerMonth[month] = Math.round(total); // replace, not add
//                 }
//             });

//             return prod;
//         });

//         customerTarget.products = productData;
//         customerTarget.grandTotalPerMonth = grandTotalPerMonth;
//         customerTarget.salesManagerId = salesManagerId;
//         // customerTarget.updated_by = req.user._id;

//         await customerTarget.save();

//         res.status(200).json({ message: "Customer target updated successfully" });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// };
export const updateCustomerTarget = async (req, res) => {
  try {
    const { customerId, financialYear, startMonth, products, database } = req.body;

    if (!customerId || !financialYear || !products || !database || !startMonth) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Fetch customer
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    // Fetch sales roles
    const departments = await AssignRole.find({ database })
      .populate({ path: "departmentName", model: "department" })
      .populate({ path: "roles.roleId", model: "role" });

    const salesRoles = departments.find(
      dep => dep?.departmentName?.departmentName?.toLowerCase() === "sales"
    )?.roles || [];

    // Sort roles bottom-to-top (higher rolePosition = bottom)
    salesRoles.sort((a, b) => b.rolePosition - a.rolePosition);

    // Prepare dynamic role keys
    const roleKeys = salesRoles.map(r =>
      r.roleId.roleName.replace(/\s+/g, '').replace(/^\w/, c => c.toLowerCase()) + 'Id'
    );

    // Assign roles dynamically (skip customer itself)
    const rolesObj = {};
    let currentUser = customer.created_by ? await User.findById(customer.created_by) : null;
    for (let i = 1; i < roleKeys.length; i++) {
      rolesObj[roleKeys[i]] = currentUser?._id || null;
      currentUser = currentUser?.created_by ? await User.findById(currentUser.created_by) : null;
    }

    // Fetch existing target
    let customerTarget = await CustomerTarget.findOne({ customerId, financialYear, database });

    const startIndex = FY_MONTHS.indexOf(startMonth);

    // Prepare updated product data
    const productData = (products || []).map(p => ({
      productId: p.productId,
      monthlyQty: {},
      monthlyPrice: {},
      monthlyTotal: {}
    }));

    const grandTotalPerMonth = {};

    for (let i = startIndex; i < FY_MONTHS.length; i++) {
      const month = FY_MONTHS[i];
      let monthTotal = 0;

      productData.forEach((prod, idx) => {
        const qty = products[idx].qtyAssign;
        const price = products[idx].price;
        const total = qty * price;

        prod.monthlyQty[month] = qty;
        prod.monthlyPrice[month] = price;
        prod.monthlyTotal[month] = total;

        monthTotal += total;
      });

      grandTotalPerMonth[month] = Math.round(monthTotal);

      // Increase price 10% for next month
      products.forEach(p => p.price = p.price * 1.1);
    }

    // Upsert target
    customerTarget = await CustomerTarget.findOneAndUpdate(
      { customerId, financialYear, database },
      {
        $set: {
          products: productData,
          grandTotalPerMonth,
          roles: rolesObj, // only upper hierarchy roles
          created_by: req.user?._id
        }
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: "Customer target updated successfully with upper hierarchy roles",
      data: customerTarget
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};


// export const getHierarchyByDatabase = async (req, res) => {
//     try {
//         const { database, financialYear } = req.body;

//         if (!database || !financialYear) {
//             return res.status(400).json({ message: "database and financialYear are required" });
//         }

//         const targets = await CustomerTarget.find({ database, financialYear })
//             .populate({ path: "customerId", select: "name _id" })
//             .populate({ path: "salesPersonId", select: "name _id" })
//             .populate({ path: "salesManagerId", select: "name _id" })
//             .lean();

//         const hierarchy = {};

//         targets.forEach(t => {
//             const smId = t.salesManagerId._id.toString();
//             const spId = t.salesPersonId._id.toString();
//             const cId = t.customerId._id.toString();

//             if (!hierarchy[smId]) {
//                 hierarchy[smId] = {
//                     salesManagerId: smId,
//                     salesManagerName: t.salesManagerId.name,
//                     salesManagerTotal: 0,
//                     salesPersons: {}
//                 };
//             }

//             if (!hierarchy[smId].salesPersons[spId]) {
//                 hierarchy[smId].salesPersons[spId] = {
//                     salesPersonId: spId,
//                     salesPersonName: t.salesPersonId.name,
//                     salesPersonTotal: 0,
//                     customers: {}
//                 };
//             }

//             if (!hierarchy[smId].salesPersons[spId].customers[cId]) {
//                 // Map month numbers to names
//                 const monthlyTargetsUnsorted = Object.entries(t.grandTotalPerMonth || {}).map(([m, total]) => {
//                     const monthName = (() => {
//                         const num = parseInt(m);
//                         if (num === 1) return "January";
//                         if (num === 2) return "February";
//                         if (num === 3) return "March";
//                         if (num === 4) return "April";
//                         if (num === 5) return "May";
//                         if (num === 6) return "June";
//                         if (num === 7) return "July";
//                         if (num === 8) return "August";
//                         if (num === 9) return "September";
//                         if (num === 10) return "October";
//                         if (num === 11) return "November";
//                         if (num === 12) return "December";
//                     })();
//                     return { month: monthName, totalTarget: total };
//                 });

//                 const monthlyTargets = monthlyTargetsUnsorted.sort((a, b) => {
//                     return FY_MONTHS_ORDER.indexOf(a.month) - FY_MONTHS_ORDER.indexOf(b.month);
//                 });

//                 const customerTotal = monthlyTargets.reduce((sum, item) => sum + item.totalTarget, 0);

//                 hierarchy[smId].salesPersons[spId].customers[cId] = {
//                     customerId: cId,
//                     customerName: t.customerId.name,
//                     customerTotal,
//                     monthlyTargets
//                 };
//             }

//             const cust = hierarchy[smId].salesPersons[spId].customers[cId];
//             hierarchy[smId].salesPersons[spId].salesPersonTotal += cust.customerTotal;
//             hierarchy[smId].salesManagerTotal += cust.customerTotal;
//         });

//         const result = Object.values(hierarchy).map(manager => ({
//             salesManagerId: manager.salesManagerId,
//             salesManagerName: manager.salesManagerName,
//             salesManagerTotal: manager.salesManagerTotal,
//             salesPersons: Object.values(manager.salesPersons).map(person => ({
//                 salesPersonId: person.salesPersonId,
//                 salesPersonName: person.salesPersonName,
//                 salesPersonTotal: person.salesPersonTotal,
//                 customers: Object.values(person.customers)
//             }))
//         }));

//         res.status(200).json(result);

//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// };


export const getHierarchyByDatabase = async (req, res) => {
  try {
    const { database, financialYear } = req.body;

    if (!database || !financialYear) {
      return res.status(400).json({ message: "database and financialYear are required" });
    }

    // 1️⃣ Fetch sales roles
    const departments = await AssignRole.find({ database })
      .populate({ path: "departmentName", model: "department" })
      .populate({ path: "roles.roleId", model: "role" });

    const salesRoles = departments.find(
      dep => dep?.departmentName?.departmentName?.toLowerCase() === "sales"
    )?.roles || [];

    // Sort bottom-to-top
    salesRoles.sort((a, b) => b.rolePosition - a.rolePosition);
    const roleKeysInOrder = salesRoles.map(r =>
        r.roleId.roleName.replace(/\s+/g, '').replace(/^\w/, c => c.toLowerCase()) + 'Id'
    );
    console.log(roleKeysInOrder)

    // 2️⃣ Fetch all targets
    const targets = await CustomerTarget.find({ database, financialYear })
      .populate({ path: "customerId", select: "name _id" })
      .lean();

    // 3️⃣ Collect unique user IDs
    const allUserIds = [];
    targets.forEach(t => {
      roleKeysInOrder.forEach(key => {
        if (t.roles?.[key]) allUserIds.push(t.roles[key].toString());
      });
    });

    const users = await User.find({ _id: { $in: allUserIds } }).select("name _id").lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    // 4️⃣ Build hierarchy
    const hierarchy = {};
    const processedCustomerProducts = {}; // track customer-product pairs globally

    targets.forEach(t => {
      const customer = t.customerId;
      if (!customer) return;

      let currentLevel = hierarchy;

      roleKeysInOrder.forEach((roleKey, idx) => {
        const userId = t.roles?.[roleKey]?.toString();
        if (!userId) return;

        const user = userMap[userId];
        if (!user) return;

        if (!currentLevel[userId]) {
          currentLevel[userId] = {
            userId,
            name: user.name,
            role: roleKey,
            total: 0,
            children: {}
          };
        }

        currentLevel = currentLevel[userId].children;

        // Bottom-most role → attach customer
        if (idx === roleKeysInOrder.length - 1) {
          // Build unique key per customer-product
          const products = t.products || [];
          let customerTotal = 0;
          const monthlyTargets = {};

          products.forEach(prod => {
            const prodKey = `${customer._id.toString()}_${prod.productId}`;
            if (!processedCustomerProducts[prodKey]) {
              // Sum monthly totals for this product
              Object.entries(prod.monthlyTotal || {}).forEach(([month, total]) => {
                monthlyTargets[month] = (monthlyTargets[month] || 0) + total;
                customerTotal += total;
              });
              processedCustomerProducts[prodKey] = true; // mark as processed
            }
          });

          if (!currentLevel[customer._id.toString()]) {
            currentLevel[customer._id.toString()] = {
              customerId: customer._id.toString(),
              customerName: customer.name,
              total: customerTotal,
              monthlyTargets: Object.entries(monthlyTargets).map(([month, total]) => ({ month, totalTarget: total }))
                .sort((a, b) => FY_MONTHS.indexOf(a.month) - FY_MONTHS.indexOf(b.month))
            };
          }

          // Update totals up the hierarchy
          let tempLevel = hierarchy;
          roleKeysInOrder.forEach(rk => {
            const uid = t.roles?.[rk]?.toString();
            if (!uid) return;
            tempLevel[uid].total += customerTotal;
            tempLevel = tempLevel[uid].children;
          });
        }
      });
    });

    res.status(200).json(hierarchy);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};



export const getSalesPersonTarget = async (req, res) => {
    try {
        const { salesPersonId, financialYear } = req.body;

        if (!salesPersonId || !financialYear) {
            return res.status(400).json({
                message: "salesPersonId and financialYear are required"
            });
        }

        const data = await CustomerTarget.aggregate([
            {
                $match: {
                    salesPersonId: new mongoose.Types.ObjectId(salesPersonId),
                    financialYear
                }
            },
            {
                $group: {
                    _id: "$month",
                    totalTarget: { $sum: "$grandTotal" }
                }
            },
            {
                // Convert month number to month name
                $addFields: {
                    monthName: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$_id", 1] }, then: "January" },
                                { case: { $eq: ["$_id", 2] }, then: "February" },
                                { case: { $eq: ["$_id", 3] }, then: "March" },
                                { case: { $eq: ["$_id", 4] }, then: "April" },
                                { case: { $eq: ["$_id", 5] }, then: "May" },
                                { case: { $eq: ["$_id", 6] }, then: "June" },
                                { case: { $eq: ["$_id", 7] }, then: "July" },
                                { case: { $eq: ["$_id", 8] }, then: "August" },
                                { case: { $eq: ["$_id", 9] }, then: "September" },
                                { case: { $eq: ["$_id", 10] }, then: "October" },
                                { case: { $eq: ["$_id", 11] }, then: "November" },
                                { case: { $eq: ["$_id", 12] }, then: "December" }
                            ],
                            default: "Unknown"
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    month: "$monthName",
                    totalTarget: 1
                }
            },
            {
                // Financial year sorting (April → March)
                $sort: {
                    month: 1
                }
            }
        ]);

        res.status(200).json(data);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getSalesManagerTarget = async (req, res) => {
    const { salesManagerId, financialYear } = req.params;

    const data = await CustomerTarget.aggregate([
        { $match: { salesManagerId, financialYear } },
        {
            $group: {
                _id: "$month",
                totalTarget: { $sum: "$grandTotal" },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    res.json(data);
};
