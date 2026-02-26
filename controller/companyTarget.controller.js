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

const round = (num) => Number(num.toFixed(2));

export const saveCompanyTarget = async (req, res) => {
  try {
    const {
      database,
      fyear,
      month,
      incrementper = 0,
      productItem,
      created_by
    } = req.body;

    if (!database || !fyear || !month || !productItem?.length || !created_by) {
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
        message: "Invalid start month"
      });
    }

    /* ------------------------------------
       GET SALES DEPARTMENT ROLES
    ------------------------------------ */
    const departmentData = await AssignRole.find({ database }).populate({
      path: "departmentName",
      model: "department"
    });

    const salesDepartment = departmentData.find(
      d => d?.departmentName?.departmentName?.toLowerCase() === "sales"
    );

    if (!salesDepartment?.roles?.length) {
      return res.status(400).json({
        success: false,
        message: "Sales department not configured"
      });
    }

    const sortedRoles = [...salesDepartment.roles].sort(
      (a, b) => a.rolePosition - b.rolePosition
    );

    const firstRole = sortedRoles[0]; // Sales Manager Role

    /* ------------------------------------
       FETCH USERS & CUSTOMERS
    ------------------------------------ */
    const allUsers = await User.find({ database,status:"Active" }).lean();
    const allCustomers = await Customer.find({ database,status:"Active" }).lean();

    const usersByParent = {};
    const customersByParent = {};

    allUsers.forEach(user => {
      const parent = String(user.created_by || "");
      if (!usersByParent[parent]) usersByParent[parent] = [];
      usersByParent[parent].push(user);
    });

    allCustomers.forEach(customer => {
      const parent = String(customer.created_by || "");
      if (!customersByParent[parent]) customersByParent[parent] = [];
      customersByParent[parent].push(customer);
    });

    /* ------------------------------------
       GET SALES MANAGERS UNDER created_by
    ------------------------------------ */
    const salesManagers = allUsers.filter(
      u =>
        u.rolename === firstRole.roleId &&
        String(u.created_by) === String(created_by)
    );

    if (!salesManagers.length) {
      return res.status(400).json({
        success: false,
        message: "No sales managers found under this hierarchy"
      });
    }

    let previousMonthProducts = null;

    /* ====================================
       MONTH LOOP
    ==================================== */
    for (let i = startIndex; i < FY_MONTHS.length; i++) {
      const currentMonth = FY_MONTHS[i];

      let monthProducts;

      if (i === startIndex) {
        monthProducts = JSON.parse(JSON.stringify(productItem));
      } else {
        const multiplier = 1 + incrementPercent / 100;

        monthProducts = previousMonthProducts.map(p => ({
          ...p,
          pQty: round(p.pQty * multiplier),
          sQty: round(p.sQty * multiplier),
          total: round(p.total * multiplier)
        }));
      }

      previousMonthProducts = JSON.parse(JSON.stringify(monthProducts));

      const companyTotal = round(
        monthProducts.reduce((sum, p) => sum + (p.total || 0), 0)
      );

      const managerCount = salesManagers.length;
      let remainingTotal = companyTotal;

      /* ====================================
         MANAGER LOOP (SAVE SEPARATELY)
      ==================================== */
      for (let idx = 0; idx < managerCount; idx++) {
        const manager = salesManagers[idx];

        const managerTotal =
          idx === managerCount - 1
            ? round(remainingTotal)
            : round(companyTotal / managerCount);

        remainingTotal -= managerTotal;

        const managerProducts = monthProducts.map(p => ({
          ...p,
          pQty: round(p.pQty / managerCount),
          sQty: round(p.sQty / managerCount),
          total: round(p.total / managerCount)
        }));

        const hierarchyTargets = [];

        // Push Manager
        hierarchyTargets.push({
          roleId: firstRole.roleId,
          roleName: firstRole.roleName,
          rolePosition: firstRole.rolePosition,
          userId: manager._id,
          firstName: manager.firstName,
          total: managerTotal,
          products: managerProducts
        });

        /* ------------------------------------
           RECURSIVE DIVISION
        ------------------------------------ */
        const divideHierarchy = (
          roleIndex,
          totalTarget,
          productTarget,
          parentUserId
        ) => {
          if (roleIndex >= sortedRoles.length) return;

          const currentRole = sortedRoles[roleIndex];

          let users = [];

          if (currentRole.roleName.toLowerCase() === "customer") {
            users = customersByParent[String(parentUserId)] || [];
          } else {
            users =
              (usersByParent[String(parentUserId)] || []).filter(
                u => u.rolename === currentRole.roleId
              );
          }

          if (!users.length) return;

          const count = users.length;

          users.forEach(user => {
            const dividedTotal = round(totalTarget / count);

            const dividedProducts = productTarget.map(p => ({
              ...p,
              pQty: round(p.pQty / count),
              sQty: round(p.sQty / count),
              total: round(p.total / count)
            }));

            hierarchyTargets.push({
              roleId: currentRole.roleId,
              roleName: currentRole.roleName,
              rolePosition: currentRole.rolePosition,
              userId: user._id,
              firstName:
                currentRole.roleName.toLowerCase() === "customer"
                  ? user.CompanyName || "Unknown"
                  : user.firstName || "Unknown",
              total: dividedTotal,
              products: dividedProducts
            });

            divideHierarchy(
              roleIndex + 1,
              dividedTotal,
              dividedProducts,
              user._id
            );
          });
        };

        divideHierarchy(1, managerTotal, managerProducts, manager._id);

        /* ------------------------------------
           SAVE PER MANAGER PER MONTH
        ------------------------------------ */
        await CompanyTarget.findOneAndUpdate(
          {
            database,
            fyear,
            month: currentMonth,
            managerId: manager._id
          },
          {
            $set: {
              incrementper,
              companyTotal,
              managerId: manager._id,
              managerName: manager.firstName,
              managerTotal,
              productItem: managerProducts,
              hierarchyTargets,
              created_by
            }
          },
          { upsert: true, new: true }
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Manager-wise hierarchy targets saved successfully"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
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

export const updateCompanyTarget = async (req, res) => {
  try {
    const { database, fyear, month, incrementper, productItem, created_by } = req.body;

    if (!database || !fyear || !month || !productItem?.length || !created_by) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const incrementPercent = Number(incrementper || 0);
    const startIndex = FY_MONTHS.indexOf(month);

    if (startIndex === -1) {
      return res.status(400).json({ success: false, message: "Invalid start month" });
    }

    const departments = await AssignRole.find({ database })
      .populate({ path: "departmentName", model: "department" });

    const department = departments.find(
      item => item?.departmentName?.departmentName?.toLowerCase() === "sales"
    );

    if (!department?.roles?.length) {
      return res.status(400).json({ success: false, message: "Sales department not configured" });
    }

    const sortedRoles = [...department.roles].sort((a, b) => a.rolePosition - b.rolePosition);
    const firstRole = sortedRoles[0];

    const allUsers = await User.find({ database }).lean();
    const allCustomers = await Customer.find({ database }).lean();

    const usersByParent = {};
    const customersByParent = {};

    allUsers.forEach(u => {
      const parent = String(u.created_by || "");
      if (!usersByParent[parent]) usersByParent[parent] = [];
      usersByParent[parent].push(u);
    });

    allCustomers.forEach(c => {
      const parent = String(c.created_by || "");
      if (!customersByParent[parent]) customersByParent[parent] = [];
      customersByParent[parent].push(c);
    });

    let previousMonthProducts = null;
    let totalMonthsProcessed = 0;

    for (let i = startIndex; i < FY_MONTHS.length; i++) {
      const currentMonth = FY_MONTHS[i];

      // Start with either initial products or incremented previous month
      let monthProducts = i === startIndex
        ? JSON.parse(JSON.stringify(productItem))
        : previousMonthProducts.map(p => ({
            ...p,
            pQty: round(p.pQty * (1 + incrementPercent / 100)),
            sQty: round(p.sQty * (1 + incrementPercent / 100)),
            total: round(p.total * (1 + incrementPercent / 100))
          }));
      previousMonthProducts = JSON.parse(JSON.stringify(monthProducts));

      const companyTotal = round(monthProducts.reduce((sum, p) => sum + (p.total || 0), 0));

      // Only get sales managers under this created_by
      const salesManagers = allUsers.filter(
        u => u.rolename === firstRole.roleId && String(u.created_by) === String(created_by)
      );

      if (!salesManagers.length) {
        return res.status(400).json({ success: false, message: "No sales managers found under this hierarchy" });
      }

      const managerCount = salesManagers.length;
      let remainingCompanyTotal = companyTotal;

      // Loop per manager
      for (let idx = 0; idx < managerCount; idx++) {
        const manager = salesManagers[idx];

        const managerTotal = idx === managerCount - 1
          ? round(remainingCompanyTotal)
          : round(companyTotal / managerCount);

        remainingCompanyTotal -= managerTotal;

        const managerProducts = monthProducts.map(p => ({
          ...p,
          pQty: round(p.pQty / managerCount),
          sQty: round(p.sQty / managerCount),
          total: round(p.total / managerCount)
        }));

        const hierarchyTargets = [];

        // Add manager as root
        hierarchyTargets.push({
          roleId: firstRole.roleId,
          roleName: firstRole.roleName,
          rolePosition: firstRole.rolePosition,
          userId: manager._id,
          firstName: manager.firstName,
          total: managerTotal,
          products: managerProducts
        });

        // Recursive hierarchy division
        const divideHierarchy = (roleIndex, totalTarget, productTarget, parentUserId) => {
          if (roleIndex >= sortedRoles.length) return;

          const currentRole = sortedRoles[roleIndex];
          let users = [];

          if (currentRole.roleName.toLowerCase() === "customer") {
            users = customersByParent[String(parentUserId)] || [];
          } else {
            users = (usersByParent[String(parentUserId)] || []).filter(u => u.rolename === currentRole.roleId);
          }

          if (!users.length) return;

          const count = users.length;

          users.forEach(user => {
            const dividedTotal = round(totalTarget / count);
            const dividedProducts = productTarget.map(p => ({
              ...p,
              pQty: round(p.pQty / count),
              sQty: round(p.sQty / count),
              total: round(p.total / count)
            }));

            hierarchyTargets.push({
              roleId: currentRole.roleId,
              roleName: currentRole.roleName,
              rolePosition: currentRole.rolePosition,
              userId: user._id,
              firstName: currentRole.roleName.toLowerCase() === "customer"
                ? user.CompanyName || "Unknown"
                : user.firstName || "Unknown",
              total: dividedTotal,
              products: dividedProducts
            });

            divideHierarchy(roleIndex + 1, dividedTotal, dividedProducts, user._id);
          });
        };

        divideHierarchy(1, managerTotal, managerProducts, manager._id);

        await CompanyTarget.findOneAndUpdate(
          { database, fyear, month: currentMonth, managerId: manager._id },
          {
            $set: {
              incrementper,
              companyTotal,
              managerId: manager._id,
              managerName: manager.firstName,
              managerTotal,
              productItem: managerProducts,
              hierarchyTargets,
              created_by
            }
          },
          { upsert: true, new: true }
        );
      }

      totalMonthsProcessed++;
    }

    return res.status(200).json({
      success: true,
      message: "Company target updated manager-wise successfully",
      totalMonthsProcessed
    });

  } catch (error) {
    console.error(error);
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

    for (let i = startIndex; i < FY_MONTHS.length; i++) {
      const currentMonth = FY_MONTHS[i];

      const doc = await CompanyTarget.findOne({
        database,
        fyear,
        month: currentMonth
      });

      if (!doc || !doc.hierarchyTargets?.length) continue;

      // 🔹 Detect LAST rolePosition dynamically (Customer level)
      const maxRolePosition = Math.max(
        ...doc.hierarchyTargets.map(h => h.rolePosition || 0)
      );

      // 🔹 Prepare products
      let monthProducts;

      if (i === startIndex) {
        monthProducts = productItem.map(item => ({
          ...item,
          total: round(item.pQty * item.price)
        }));
      } else {
        const multiplier = 1 + incrementPercent / 100;

        monthProducts = previousMonthProducts.map(item => {
          const newPQty = round(item.pQty * multiplier);
          return {
            ...item,
            pQty: newPQty,
            total: round(newPQty * item.price)
          };
        });
      }

      previousMonthProducts = JSON.parse(JSON.stringify(monthProducts));

      // 🔹 Find customer (last rolePosition)
      const customerIndex = doc.hierarchyTargets.findIndex(
        h =>
          h?.userId?.toString() === customerId &&
          h?.rolePosition === maxRolePosition
      );

      if (customerIndex === -1) continue;

      // 🔹 Update customer
      const customerTotal = monthProducts.reduce(
        (sum, item) => sum + item.total,
        0
      );

      doc.hierarchyTargets[customerIndex].products = monthProducts;
      doc.hierarchyTargets[customerIndex].total = round(customerTotal);

      // 🔹 Recalculate totals LEVEL BY LEVEL upward
      for (let level = maxRolePosition - 1; level >= 1; level--) {

        const currentLevelUsers = doc.hierarchyTargets.filter(
          h => h.rolePosition === level
        );

        const nextLevelUsers = doc.hierarchyTargets.filter(
          h => h.rolePosition === level + 1
        );

        if (!currentLevelUsers.length) continue;

        const totalOfNextLevel = nextLevelUsers.reduce(
          (sum, item) => sum + (item.total || 0),
          0
        );

        const distributedTotal = round(
          totalOfNextLevel / currentLevelUsers.length
        );

        currentLevelUsers.forEach(user => {
          user.total = distributedTotal;
        });
      }

      // 🔹 Recalculate company total (rolePosition = 1)
      const companyTotal = doc.hierarchyTargets
        .filter(h => h.rolePosition === 1)
        .reduce((sum, item) => sum + (item.total || 0), 0);

      doc.companyTotal = round(companyTotal);
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
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


export const updateCustomerHierarchyTarget = async (req, res) => {
  try {
    const { database, fyear, month, customerId, incrementper = 0, productItem, created_by } = req.body;

    if (!database || !fyear || !month || !customerId || !productItem?.length) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const incrementPercent = Number(incrementper);
    const startIndex = FY_MONTHS.indexOf(month);
    if (startIndex === -1) return res.status(400).json({ success: false, message: "Invalid month" });

    let previousMonthProducts = null;
    let monthsUpdated = 0;

    for (let i = startIndex; i < FY_MONTHS.length; i++) {
      const currentMonth = FY_MONTHS[i];

      // 🔹 Get the target month document
      const doc = await CompanyTarget.findOne({ database, fyear, month: currentMonth });
      if (!doc) continue; // Skip if document does not exist

      // 🔹 Prepare products for this month with increment
      let monthProducts;
      if (i === startIndex) {
        monthProducts = productItem.map(p => ({ ...p, total: round(p.pQty * (p.price || 1)) }));
      } else {
        const multiplier = 1 + incrementPercent / 100;
        monthProducts = previousMonthProducts.map(p => {
          const newPQty = round(p.pQty * multiplier);
          return { ...p, pQty: newPQty, total: round(newPQty * (p.price || 1)) };
        });
      }
      previousMonthProducts = JSON.parse(JSON.stringify(monthProducts));

      // 🔹 Find the customer in the hierarchyTargets
      const customerIndex = doc.hierarchyTargets.findIndex(
        h => h.userId.toString() === customerId && h.roleName.toLowerCase() === "customer"
      );
      if (customerIndex === -1) continue;

      const customerTarget = doc.hierarchyTargets[customerIndex];

      // 🔹 Update customer products & total
      customerTarget.products = monthProducts;
      customerTarget.total = round(monthProducts.reduce((sum, p) => sum + p.total, 0));

      // 🔹 Recursive function to update parent totals up to Sales Manager
      const updateParentTotals = (parentUserId) => {
        if (!parentUserId) return;

        const parent = doc.hierarchyTargets.find(h => h.userId.toString() === parentUserId.toString());
        if (!parent) return;

        const children = doc.hierarchyTargets.filter(h => h.parentUserId?.toString() === parentUserId.toString());
        parent.total = round(children.reduce((sum, c) => sum + c.total, 0));

        // Continue upward
        updateParentTotals(parent.parentUserId);
      };

      updateParentTotals(customerTarget.parentUserId);

      // 🔹 Recalculate top-level totals (Sales Manager(s)) & companyTotal
      const topLevelUsers = doc.hierarchyTargets.filter(h => !h.parentUserId);
      doc.companyTotal = round(topLevelUsers.reduce((sum, u) => sum + u.total, 0));
      doc.incrementper = incrementper;
      doc.created_by = created_by;

      await doc.save();
      monthsUpdated++;
    }

    return res.status(200).json({
      success: true,
      message: "Customer hierarchy targets updated successfully",
      monthsUpdated
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};




