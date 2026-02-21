import mongoose from "mongoose";
import { CompanyTarget } from "../model/companyTarget.model.js";
import { User } from "../model/user.model.js";
import { getUserHierarchyDetails } from "../rolePermission/RolePermission.js";
import { AssignRole } from "../model/assignRoleToDepartment.model.js";
import { Customer } from "../model/customer.model.js";
import { Role } from "../model/role.model.js";

const FY_MONTHS = [
    "April", "May", "June", "July", "August", "September",
    "October", "November", "December", "January", "February", "March"
];

// export const saveCompanyTarget = async (req, res) => {
//     try {
//         const {
//             database,
//             fyear,
//             month,
//             incrementper,
//             productItem,
//             created_by
//         } = req.body;

//         const incrementPercent = Number(incrementper);

//         const startIndex = FY_MONTHS.indexOf(month);
//         if (startIndex === -1) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid start month"
//             });
//         }
//         const departments = await AssignRole.find({ database })
//             .populate({ path: "departmentName", model: "department" })
//             .populate({ path: "roles.roleId", model: "role" });

//         const salesRoles = departments.find(
//             dep => dep?.departmentName?.departmentName?.toLowerCase() === "sales"
//         )?.roles || [];

//         const salesManagerss = await User.find({ database }).populate({ path: "rolename", model: "role" });
//         const salesManagers = salesManagerss.filter((item) => item?.rolename?.roleName === "Sales Manager")
//         if (!salesManagers.length) {
//             return res.status(400).json({
//                 success: false,
//                 message: "No Sales Managers found"
//             });
//         }
//         for (let item of salesManagers) {
//             // console.log("item",item)

//             const adminDetail = await getUserHierarchyDetails(item._id, database);

//             const salespersons = await adminDetail.filter((item) => item?.rolename?.roleName === "Sales Person")
//             // console.log("salespersons",salespersons);
//         }

//         const managerCount = salesManagers.length;

//         let currentCompanyTotal = productItem.reduce(
//             (sum, item) => sum + (item.total || 0),
//             0
//         );

//         let currentProductItem = JSON.parse(JSON.stringify(productItem));

//         const savedTargets = [];

//         for (let i = startIndex; i < FY_MONTHS.length; i++) {
//             const currentMonth = FY_MONTHS[i];

//             if (i !== startIndex) {
//                 currentCompanyTotal +=
//                     (currentCompanyTotal * incrementPercent) / 100;

//                 currentProductItem = currentProductItem.map((item) => ({
//                     ...item,
//                     pQty: item.pQty + (item.pQty * incrementPercent) / 100,
//                     sQty: item.sQty + (item.sQty * incrementPercent) / 100,
//                     total: item.total + (item.total * incrementPercent) / 100
//                 }));
//             }

//             const dividedTargets = {};

//             salesManagers.forEach((manager) => {
//                 dividedTargets[manager._id] = {
//                     total: currentCompanyTotal / managerCount,
//                     products: currentProductItem.map((item) => ({
//                         productId: item.productId,
//                         pQty: item.pQty / managerCount,
//                         sQty: item.sQty / managerCount,
//                         price: item.price,
//                         total: item.total / managerCount
//                     }))
//                 };
//             });

//             // const companyTarget = new CompanyTarget({
//             //     database,
//             //     fyear,
//             //     month: currentMonth,
//             //     incrementper,
//             //     companyTotal: currentCompanyTotal,
//             //     productItem: currentProductItem,
//             //     dividedTargets,
//             //     created_by
//             // });

//             // await companyTarget.save();
//             // savedTargets.push(companyTarget);
//         }

//         res.status(201).json({
//             success: true,
//             message: `Targets saved from ${month} to March`,
//             totalMonths: savedTargets.length,
//             data: savedTargets
//         });

//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             error: error.message
//         });
//     }
// };

export const saveCompanyTarget = async (req, res) => {
    try {
        const {
            database,
            fyear,
            month,
            incrementper,
            productItem,
            created_by
        } = req.body;

        if (!database || !fyear || !month || !productItem?.length) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        const incrementPercent = Number(incrementper || 0);
        const startIndex = FY_MONTHS.indexOf(month);

        if (startIndex === -1) {
            return res.status(400).json({
                success: false,
                message: "Invalid start month"
            });
        }

        const departments = await AssignRole.find({ database })
            .populate({ path: "departmentName", model: "department" });

        const department = departments.find(
            item => item?.departmentName?.departmentName?.toLowerCase() === "sales"
        );

        if (!department?.roles?.length) {
            return res.status(400).json({
                success: false,
                message: "Sales department not configured"
            });
        }

        const sortedRoles = [...department.roles].sort(
            (a, b) => a.rolePosition - b.rolePosition
        );

        const firstRole = sortedRoles[0]; // 🔥 Sales Manager role

        const salesManagers = await User.find({
            database,
            rolename: {
                $regex: new RegExp(`^${firstRole.roleId}$`, "i")
            }
        });

        if (!salesManagers.length) {
            return res.status(400).json({
                success: false,
                message: "No sales managers found"
            });
        }

        const savedMonths = [];
        let previousMonthProducts = null;

        for (let i = startIndex; i < FY_MONTHS.length; i++) {

            const currentMonth = FY_MONTHS[i];

            let monthProducts;

            if (i === startIndex) {
                monthProducts = JSON.parse(JSON.stringify(productItem));
            } else {
                monthProducts = previousMonthProducts.map(item => {
                    const multiplier = 1 + incrementPercent / 100;
                    return {
                        ...item,
                        pQty: Number((item.pQty * multiplier).toFixed(2)),
                        sQty: Number((item.sQty * multiplier).toFixed(2)),
                        total: Number((item.total * multiplier).toFixed(2))
                    };
                });
            }

            previousMonthProducts = JSON.parse(JSON.stringify(monthProducts));

            const companyTotal = monthProducts.reduce(
                (sum, item) => sum + (item.total || 0),
                0
            );

            // 🔥 Divide total equally between Sales Managers
            const managerCount = salesManagers.length;

            for (let manager of salesManagers) {

                const managerTotal = Number((companyTotal / managerCount).toFixed(2));

                const managerProducts = monthProducts.map(item => ({
                    ...item,
                    pQty: Number((item.pQty / managerCount).toFixed(2)),
                    sQty: Number((item.sQty / managerCount).toFixed(2)),
                    total: Number((item.total / managerCount).toFixed(2))
                }));

                const hierarchyTargets = [];

                // 🔥 Recursive hierarchy only under this manager
                const divideHierarchy = async (
                    roleIndex,
                    totalTarget,
                    productTarget,
                    parentUserId
                ) => {
                    if (roleIndex >= sortedRoles.length) return;

                    const currentRole = sortedRoles[roleIndex];
                    let users = [];

                    if (currentRole.roleName.toLowerCase() === "customer") {
                        users = await Customer.find({
                            database,
                            created_by: parentUserId
                        });
                    } else {
                        users = await User.find({
                            database,
                            rolename: {
                                $regex: new RegExp(`^${currentRole.roleId}$`, "i")
                            },
                            created_by: parentUserId
                        });
                    }

                    if (!users.length) return;

                    const count = users.length;

                    for (let user of users) {

                        const dividedTotal = Number((totalTarget / count).toFixed(2));

                        const dividedProducts = productTarget.map(item => ({
                            ...item,
                            pQty: Number((item.pQty / count).toFixed(2)),
                            sQty: Number((item.sQty / count).toFixed(2)),
                            total: Number((item.total / count).toFixed(2))
                        }));

                        let firstName =
                            currentRole.roleName.toLowerCase() === "customer"
                                ? user.CompanyName || "Unknown"
                                : user.firstName || "Unknown";

                        hierarchyTargets.push({
                            roleId: currentRole.roleId,
                            roleName: currentRole.roleName,
                            rolePosition: currentRole.rolePosition,
                            userId: user._id,
                            firstName,
                            total: dividedTotal,
                            products: dividedProducts
                        });

                        await divideHierarchy(
                            roleIndex + 1,
                            dividedTotal,
                            dividedProducts,
                            user._id
                        );
                    }
                };

                // 🔥 First push manager manually
                hierarchyTargets.push({
                    roleId: firstRole.roleId,
                    roleName: firstRole.roleName,
                    rolePosition: firstRole.rolePosition,
                    userId: manager._id,
                    firstName: manager.firstName,
                    total: managerTotal,
                    products: managerProducts
                });

                await divideHierarchy(
                    1,
                    managerTotal,
                    managerProducts,
                    manager._id
                );

                const companyDoc = new CompanyTarget({
                    database,
                    fyear,
                    month: currentMonth,
                    incrementper,
                    companyTotal: managerTotal,
                    productItem: managerProducts,
                    hierarchyTargets,
                    created_by
                });

                await companyDoc.save();
                savedMonths.push(companyDoc);
            }
        }

        return res.status(201).json({
            success: true,
            message: "Sales manager wise targets saved successfully",
            totalDocumentsCreated: savedMonths.length
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// export const getCompanyTarget = async (req, res) => {
//     try {
//         const { fyear, database } = req.params;

//         const companyTargets = await CompanyTarget
//             .find({ database, fyear })
//             .sort({ createdAt: 1 })
//             .lean();

//         if (!companyTargets.length) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Company targets not found"
//             });
//         }

//         const result = [];
//         let yearlyTarget = 0;

//         for (const target of companyTargets) {

//             yearlyTarget += target.companyTotal || 0;

//             const dividedTargetsObj = target.dividedTargets || {};
//             const managerIds = Object.keys(dividedTargetsObj);

//             const objectManagerIds = managerIds
//                 .filter(id => mongoose.Types.ObjectId.isValid(id))
//                 .map(id => new mongoose.Types.ObjectId(id));

//             const managers = await User.find(
//                 { _id: { $in: objectManagerIds } },
//                 { firstName: 1 }
//             ).lean();

//             const managerMap = {};
//             managers.forEach(m => {
//                 managerMap[m._id.toString()] = m.firstName;
//             });

//             const salesManagerTargets = managerIds.map(id => ({
//                 salesManagerId: id,
//                 salesManagerName: managerMap[id] || "Unknown",
//                 totalTarget: dividedTargetsObj[id]?.total || 0,
//                 products: dividedTargetsObj[id]?.products || []
//             }));

//             result.push({
//                 month: target.month,
//                 incrementper: target.incrementper || 0,
//                 companyTotal: target.companyTotal,
//                 productItem: target.productItem,
//                 salesManagerTargets
//             });
//         }

//         res.status(200).json({
//             success: true,
//             fyear,
//             yearlyTarget,
//             data: result
//         });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({
//             success: false,
//             error: error.message
//         });
//     }
// };

export const getCompanyTarget = async (req, res) => {
    try {
        const { database, fyear } = req.params;

        if (!database || !fyear) {
            return res.status(400).json({ success: false, message: "database and fyear required" });
        }

        // 1️⃣ Fetch all company targets for the given financial year
        const companyTargets = await CompanyTarget.find({ database, fyear })
            .sort({ createdAt: 1 })
            .lean();

        if (!companyTargets.length) {
            return res.status(404).json({ success: false, message: "Company targets not found" });
        }

        // 2️⃣ Collect all unique userIds and roleIds across months
        const allUserIds = new Set();
        const allRoleIds = new Set();

        companyTargets.forEach(target => {
            target.hierarchyTargets?.forEach(ht => {
                if (ht.userId) allUserIds.add(ht.userId.toString());
                if (ht.roleId) allRoleIds.add(ht.roleId.toString());
            });
        });

        // 3️⃣ Prefetch Users and Roles
        const [users, roles] = await Promise.all([
            User.find({ _id: { $in: Array.from(allUserIds) } }).select("firstName").lean(),
            Role.find({ _id: { $in: Array.from(allRoleIds) } }).select("roleName").lean()
        ]);

        const userMap = {};
        users.forEach(u => userMap[u._id.toString()] = u.firstName);

        const roleMap = {};
        roles.forEach(r => roleMap[r._id.toString()] = r.roleName);

        // 4️⃣ Fetch Customers based on userIds
        const customers = await Customer.find({ _id: { $in: Array.from(allUserIds) } })
            .select("CompanyName _id")
            .lean();

        const customerMap = {};
        customers.forEach(c => {
            customerMap[c._id.toString()] = c.CompanyName;
        });

        // 5️⃣ Process each month target and build hierarchy
        let yearlyTarget = 0;
        const result = companyTargets.map(target => {
            yearlyTarget += target.companyTotal || 0;

            const grouped = {};
            target.hierarchyTargets?.forEach(ht => {
                const rolePos = ht.rolePosition;
                const roleName = roleMap[ht.roleId?.toString()] || "Unknown";

                if (!grouped[rolePos]) grouped[rolePos] = { rolePosition: rolePos, roleName, users: [] };

                // Use CompanyName for Customer, firstName for normal users
                let firstName = userMap[ht.userId?.toString()] || "Unknown";
                if (roleName.toLowerCase() === "customer" && customerMap[ht.userId?.toString()]) {
                    firstName = customerMap[ht.userId?.toString()];
                }

                grouped[rolePos].users.push({
                    userId: ht.userId,
                    firstName,
                    total: ht.total,
                    products: ht.products
                });
            });

            return {
                month: target.month,
                incrementper: target.incrementper || 0,
                companyTotal: target.companyTotal,
                productItem: target.productItem,
                layers: Object.values(grouped).sort((a, b) => a.rolePosition - b.rolePosition)
            };
        });

        return res.status(200).json({
            success: true,
            fyear,
            yearlyTarget,
            data: result
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
export const getSalesManagerTarget = async (req, res) => {
    try {
        const { fyear, salesManagerId } = req.params;

        const companyTargets = await CompanyTarget.find({ fyear }).sort({ createdAt: 1 });

        if (!companyTargets.length) {
            return res.status(404).json({
                success: false,
                message: "Targets not found for this financial year"
            });
        }

        const result = [];

        for (let target of companyTargets) {
            const managerTarget = target.dividedTargets?.get(salesManagerId.toString());

            if (managerTarget) {
                result.push({
                    month: target.month,
                    totalTarget: managerTarget.total,
                    products: managerTarget.products
                });
            }
        }

        if (!result.length) {
            return res.status(404).json({
                success: false,
                message: "No target assigned to this sales manager in this financial year"
            });
        }

        res.status(200).json({
            success: true,
            fyear,
            salesManagerId,
            monthlyTargets: result
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const deleteCompanyTarget = async (req, res) => {
    try {
        const { month, database, fyear } = req.body;

        if (!month || !database || !fyear) {
            return res.status(400).json({
                success: false,
                message: "month, database and fyear are required"
            });
        }

        const deletedTarget = await CompanyTarget.findOneAndDelete({
            month,
            database,
            fyear
        });

        if (!deletedTarget) {
            return res.status(404).json({
                status: false,
                message: "Company target not found"
            });
        }

        res.status(200).json({
            status: true,
            message: "Company target deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            error: error.message
        });
    }
};

const round = (num) => Math.round(num * 100) / 100;
export const updateCompanyTarget = async (req, res) => {
    try {
        const { database, fyear, month, incrementper, productItem, created_by } = req.body;

        if (!database || !fyear || !month || !productItem?.length) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const incrementPercent = Number(incrementper || 0);
        const startIndex = FY_MONTHS.indexOf(month);

        if (startIndex === -1) {
            return res.status(400).json({ success: false, message: "Invalid month" });
        }

        // 🔹 Get Sales Department & Roles
        const departments = await AssignRole.find({ database })
            .populate({ path: "departmentName", model: "department" });

        const department = departments.find(
            item => item?.departmentName?.departmentName?.toLowerCase() === "sales"
        );

        if (!department?.roles?.length) {
            return res.status(400).json({ success: false, message: "Sales roles not configured" });
        }

        const sortedRoles = [...department.roles].sort((a, b) => a.rolePosition - b.rolePosition);
        const firstRole = sortedRoles[0]; // Sales Manager role

        // 🔹 Get all Sales Managers
        const salesManagers = await User.find({
            database,
            rolename: { $regex: new RegExp(`^${firstRole.roleId}$`, "i") }
        });

        if (!salesManagers.length) {
            return res.status(400).json({ success: false, message: "No sales managers found" });
        }

        let previousMonthProducts = null;
        let updatedMonths = 0;

        // 🔹 Loop through all months starting from the updated month
        for (let i = startIndex; i < FY_MONTHS.length; i++) {
            const currentMonth = FY_MONTHS[i];

            const existingDoc = await CompanyTarget.findOne({
                database,
                fyear,
                month: currentMonth
            });

            if (!existingDoc) continue; // Only update existing months

            let monthProducts;

            // 🔹 First updated month → use given productItem
            if (i === startIndex) {
                monthProducts = JSON.parse(JSON.stringify(productItem));
            }
            // 🔹 Subsequent months → compounded increment from previous month
            else {
                monthProducts = previousMonthProducts.map(item => {
                    const multiplier = 1 + incrementPercent / 100;
                    return {
                        ...item,
                        pQty: Number((item.pQty * multiplier).toFixed(2)),
                        sQty: Number((item.sQty * multiplier).toFixed(2)),
                        total: Number((item.total * multiplier).toFixed(2))
                    };
                });
            }

            previousMonthProducts = JSON.parse(JSON.stringify(monthProducts));

            const companyTotal = monthProducts.reduce((sum, item) => sum + (item.total || 0), 0);

            // 🔹 Divide total equally between Sales Managers
            for (let manager of salesManagers) {
                const managerTotal = Number((companyTotal / salesManagers.length).toFixed(2));
                const managerProducts = monthProducts.map(item => ({
                    ...item,
                    pQty: Number((item.pQty / salesManagers.length).toFixed(2)),
                    sQty: Number((item.sQty / salesManagers.length).toFixed(2)),
                    total: Number((item.total / salesManagers.length).toFixed(2))
                }));

                const hierarchyTargets = [];

                // 🔹 Add Sales Manager first
                hierarchyTargets.push({
                    roleId: firstRole.roleId,
                    roleName: firstRole.roleName,
                    rolePosition: firstRole.rolePosition,
                    userId: manager._id,
                    firstName: manager.firstName,
                    total: managerTotal,
                    products: managerProducts
                });

                // 🔹 Recursive hierarchy under manager
                const divideHierarchy = async (roleIndex, totalTarget, productTarget, parentUserId) => {
                    if (roleIndex >= sortedRoles.length) return;

                    const currentRole = sortedRoles[roleIndex];
                    let users = [];

                    if (currentRole.roleName.toLowerCase() === "customer") {
                        users = await Customer.find({ database, created_by: parentUserId });
                    } else {
                        users = await User.find({
                            database,
                            rolename: { $regex: new RegExp(`^${currentRole.roleId}$`, "i") },
                            created_by: parentUserId
                        });
                    }

                    if (!users.length) return;

                    const count = users.length;
                    for (let user of users) {
                        const dividedTotal = Number((totalTarget / count).toFixed(2));
                        const dividedProducts = productTarget.map(item => ({
                            ...item,
                            pQty: Number((item.pQty / count).toFixed(2)),
                            sQty: Number((item.sQty / count).toFixed(2)),
                            total: Number((item.total / count).toFixed(2))
                        }));

                        const firstName = currentRole.roleName.toLowerCase() === "customer"
                            ? user.CompanyName || "Unknown"
                            : user.firstName || "Unknown";

                        hierarchyTargets.push({
                            roleId: currentRole.roleId,
                            roleName: currentRole.roleName,
                            rolePosition: currentRole.rolePosition,
                            userId: user._id,
                            firstName,
                            total: dividedTotal,
                            products: dividedProducts
                        });

                        await divideHierarchy(roleIndex + 1, dividedTotal, dividedProducts, user._id);
                    }
                };

                await divideHierarchy(1, managerTotal, managerProducts, manager._id);

                // 🔹 Update existing document
                await CompanyTarget.updateOne(
                    { _id: existingDoc._id, "hierarchyTargets.userId": manager._id },
                    {
                        $set: {
                            incrementper,
                            companyTotal: managerTotal,
                            productItem: managerProducts,
                            hierarchyTargets,
                            created_by,
                            salesManagerId: manager._id
                        }
                    }
                );
            }

            updatedMonths++;
        }

        return res.status(200).json({
            success: true,
            message: "Company targets updated for selected and following months",
            totalMonthsUpdated: updatedMonths
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


export const updateCustomerTarget = async (req, res) => {
  try {
    const {
      database,
      fyear,
      month,
      customerId,
      incrementper = 0,
      productItem,
      created_by
    } = req.body;

    if (!database || !fyear || !month || !customerId || !productItem?.length) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const incrementPercent = Number(incrementper);
    const startIndex = FY_MONTHS.indexOf(month);

    if (startIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Invalid month"
      });
    }

    let previousMonthProducts = null;
    let updatedMonths = 0;

    // 🔁 Loop from selected month → End of FY
    for (let i = startIndex; i < FY_MONTHS.length; i++) {
      const currentMonth = FY_MONTHS[i];

      const doc = await CompanyTarget.findOne({
        database,
        fyear,
        month: currentMonth
      });

      if (!doc) continue; // no new creation

      let monthProducts;

      // 🟢 First selected month → Use given data
      if (i === startIndex) {
        monthProducts = productItem.map(item => ({
          ...item,
          total: Number((item.pQty * item.price).toFixed(2))
        }));
      }
      // 🟡 Next months → Apply increment on previous month
      else {
        monthProducts = previousMonthProducts.map(item => {
          const multiplier = 1 + incrementPercent / 100;
          const newPQty = Number((item.pQty * multiplier).toFixed(2));
          const newTotal = Number((newPQty * item.price).toFixed(2));

          return {
            ...item,
            pQty: newPQty,
            total: newTotal
          };
        });
      }

      previousMonthProducts = JSON.parse(JSON.stringify(monthProducts));

      // 🔎 Find customer inside hierarchyTargets
      const customerIndex = doc.hierarchyTargets.findIndex(
        h =>
          h.userId.toString() === customerId &&
          h.roleName.toLowerCase() === "customer"
      );

      if (customerIndex === -1) continue;

      // 🔁 Update customer products & total
      const customerTotal = monthProducts.reduce(
        (sum, item) => sum + item.total,
        0
      );

      doc.hierarchyTargets[customerIndex].products = monthProducts;
      doc.hierarchyTargets[customerIndex].total = customerTotal;

      // 🔼 Recalculate upward hierarchy
      const recalculateUpward = (parentUserId) => {
        const parent = doc.hierarchyTargets.find(
          h => h.userId.toString() === parentUserId?.toString()
        );

        if (!parent) return;

        const childTargets = doc.hierarchyTargets.filter(
          h => h.parentUserId?.toString() === parentUserId?.toString()
        );

        const newTotal = childTargets.reduce(
          (sum, child) => sum + child.total,
          0
        );

        parent.total = Number(newTotal.toFixed(2));

        // continue upward
        recalculateUpward(parent.parentUserId);
      };

      const parentUserId = doc.hierarchyTargets[customerIndex].parentUserId;
      recalculateUpward(parentUserId);

      // 🔼 Update company total
      const companyTotal = doc.hierarchyTargets
        .filter(h => h.rolePosition === 1) // Sales Manager level
        .reduce((sum, item) => sum + item.total, 0);

      doc.companyTotal = Number(companyTotal.toFixed(2));
      doc.incrementper = incrementper;
      doc.created_by = created_by;

      await doc.save();
      updatedMonths++;
    }

    return res.status(200).json({
      success: true,
      message: "Customer target updated till FY end successfully",
      totalMonthsUpdated: updatedMonths
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};




