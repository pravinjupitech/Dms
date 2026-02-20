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
const department=await departments.find((item)=>item?.departmentName?.departmentName.toLowerCase()==="sales")

if (
    !department ||
    department?.departmentName?.departmentName?.toLowerCase() !== "sales"
) {
    return res.status(400).json({
        success: false,
        message: "Sales department not found"
    });
}


        if (!department.roles?.length) {
            return res.status(400).json({
                success: false,
                message: "No roles configured"
            });
        }

        const sortedRoles = department.roles.sort(
            (a, b) => a.rolePosition - b.rolePosition
        );

        // console.log("Sorted Roles:", sortedRoles);

        const savedMonths = [];

        for (let i = startIndex; i < FY_MONTHS.length; i++) {

            const currentMonth = FY_MONTHS[i];

            const existing = await CompanyTarget.findOne({
                database,
                fyear,
                month: currentMonth
            });

            if (existing) continue;

            let monthProducts = JSON.parse(JSON.stringify(productItem));

            if (i !== startIndex && incrementPercent > 0) {
                monthProducts = monthProducts.map(item => ({
                    ...item,
                    pQty: item.pQty + (item.pQty * incrementPercent) / 100,
                    sQty: item.sQty + (item.sQty * incrementPercent) / 100,
                    total: item.total + (item.total * incrementPercent) / 100
                }));
            }

            const companyTotal = monthProducts.reduce(
                (sum, item) => sum + (item.total || 0),
                0
            );
const hierarchyTargets = [];

const divideHierarchy = async (
    roleIndex,
    totalTarget,
    productTarget,
    parentUserId = null
) => {
    if (roleIndex >= sortedRoles.length) return;

    const currentRole = sortedRoles[roleIndex];
    let users = [];

    // 🔹 First Level (Sales Manager – No created_by filter)
    if (roleIndex === 0) {
        users = await User.find({
            database,
            rolename: {
                $regex: new RegExp(`^${currentRole.roleId}$`, "i")
            }
        });
    }
    // 🔹 Customer Level
    else if (currentRole.roleName.toLowerCase() === "customer") {
        users = await Customer.find({
            database,
            created_by: parentUserId
        });
    }
    // 🔹 Other Roles (filter by created_by)
    else {
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

        const dividedTotal = totalTarget / count;

        const dividedProducts = productTarget.map(item => ({
            ...item,
            pQty: item.pQty / count,
            sQty: item.sQty / count,
            total: item.total / count
        }));

        // 🔹 Get firstName or CompanyName
        let firstName = "Unknown";
        if (currentRole.roleName.toLowerCase() === "customer") {
            firstName = user.CompanyName || "Unknown"; // Customer name
        } else {
            firstName = user.firstName || "Unknown"; // User name
        }

        hierarchyTargets.push({
            roleId: currentRole.roleId,
            roleName: currentRole.roleName,
            rolePosition: currentRole.rolePosition,
            userId: user._id,
            firstName, // Save name directly here
            total: dividedTotal,
            products: dividedProducts
        });

        // 🔥 Pass current user as parent for next role
        await divideHierarchy(
            roleIndex + 1,
            dividedTotal,
            dividedProducts,
            user._id
        );
    }
};
            await divideHierarchy(0, companyTotal, monthProducts);

    

            const companyDoc = new CompanyTarget({
                database,
                fyear,
                month: currentMonth,
                incrementper,
                companyTotal,
                productItem: monthProducts,
                hierarchyTargets,
                created_by
            });

            await companyDoc.save();
            savedMonths.push(companyDoc);
        }

        return res.status(201).json({
            success: true,
            message: "Targets saved successfully",
            totalMonthsSaved: savedMonths.length
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

export const
    updateCompanyTarget = async (req, res) => {
        try {
            const {
                database,
                fyear,
                month,
                incrementper,
                productItem,
                created_by
            } = req.body;

            const incrementPercent = Number(incrementper) || 0;

            const startIndex = FY_MONTHS.indexOf(month);
            if (startIndex === -1) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid month"
                });
            }

            // 🔹 Get Sales Managers
            const users = await User.find({ database }).populate({
                path: "rolename",
                model: "role"
            });

            const salesManagers = users.filter(
                (u) => u?.rolename?.roleName === "Sales Manager"
            );

            if (!salesManagers.length) {
                return res.status(400).json({
                    success: false,
                    message: "No Sales Managers found"
                });
            }

            const managerCount = salesManagers.length;

            // 🔥 BASE = Only payload value (February)
            let currentCompanyTotal = round(
                productItem.reduce((sum, item) => sum + Number(item.total || 0), 0)
            );

            let currentProductItem = productItem.map((item) => ({
                ...item,
                pQty: round(Number(item.pQty)),
                sQty: round(Number(item.sQty)),
                total: round(Number(item.total))
            }));

            const updatedTargets = [];

            // 🔥 Loop only from selected month forward
            for (let i = startIndex; i < FY_MONTHS.length; i++) {
                const currentMonth = FY_MONTHS[i];

                // Apply increment AFTER selected month
                if (i > startIndex && incrementPercent > 0) {
                    currentCompanyTotal = round(
                        currentCompanyTotal +
                        (currentCompanyTotal * incrementPercent) / 100
                    );

                    currentProductItem = currentProductItem.map((item) => ({
                        ...item,
                        pQty: round(item.pQty + (item.pQty * incrementPercent) / 100),
                        sQty: round(item.sQty + (item.sQty * incrementPercent) / 100),
                        total: round(item.total + (item.total * incrementPercent) / 100)
                    }));
                }

                // 🔹 Divide targets
                const dividedTargets = {};

                salesManagers.forEach((manager) => {
                    dividedTargets[manager._id] = {
                        total: round(currentCompanyTotal / managerCount),
                        products: currentProductItem.map((item) => ({
                            productId: item.productId,
                            pQty: round(item.pQty / managerCount),
                            sQty: round(item.sQty / managerCount),
                            price: item.price,
                            total: round(item.total / managerCount)
                        }))
                    };
                });

                // 🔥 Update only this month and forward
                const updated = await CompanyTarget.findOneAndUpdate(
                    { database, fyear, month: currentMonth },
                    {
                        $set: {
                            incrementper: incrementPercent,
                            companyTotal: currentCompanyTotal,
                            productItem: currentProductItem,
                            dividedTargets,
                            created_by
                        }
                    },
                    { new: true, upsert: true }
                );

                updatedTargets.push(updated);
            }

            res.status(200).json({
                success: true,
                message: `Updated ${month} and forward months only`,
                totalMonths: updatedTargets.length,
                data: updatedTargets
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };






