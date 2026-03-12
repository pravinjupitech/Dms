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

// const round = (num) => Number(num.toFixed(2));

// export const saveCompanyTarget = async (req, res) => {
//   try {
//     const {
//       database,
//       fyear,
//       month,
//       incrementper = 0,
//       productItem,
//       created_by
//     } = req.body;

//     if (!database || !fyear || !month || !productItem?.length || !created_by) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields"
//       });
//     }

//     const incrementPercent = Number(incrementper);
//     const startIndex = FY_MONTHS.indexOf(month);

//     if (startIndex === -1) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid start month"
//       });
//     }


//     const departmentData = await AssignRole.find({ database }).populate({
//       path: "departmentName",
//       model: "department"
//     });

//     const salesDepartment = departmentData.find(
//       d => d?.departmentName?.departmentName?.toLowerCase() === "sales"
//     );

//     if (!salesDepartment?.roles?.length) {
//       return res.status(400).json({
//         success: false,
//         message: "Sales department not configured"
//       });
//     }

//     const sortedRoles = [...salesDepartment.roles].sort(
//       (a, b) => a.rolePosition - b.rolePosition
//     );

//     const firstRole = sortedRoles[0]; 

//     const allUsers = await User.find({ database,status:"Active" }).lean();
//     const allCustomers = await Customer.find({ database,status:"Active" }).lean();

//     const usersByParent = {};
//     const customersByParent = {};

//     allUsers.forEach(user => {
//       const parent = String(user.created_by || "");
//       if (!usersByParent[parent]) usersByParent[parent] = [];
//       usersByParent[parent].push(user);
//     });

//     allCustomers.forEach(customer => {
//       const parent = String(customer.created_by || "");
//       if (!customersByParent[parent]) customersByParent[parent] = [];
//       customersByParent[parent].push(customer);
//     });


//     const salesManagers = allUsers.filter(
//       u =>
//         u.rolename === firstRole.roleId &&
//         String(u.created_by) === String(created_by)
//     );

//     if (!salesManagers.length) {
//       return res.status(400).json({
//         success: false,
//         message: "No sales managers found under this hierarchy"
//       });
//     }

//     let previousMonthProducts = null;

//     for (let i = startIndex; i < FY_MONTHS.length; i++) {
//       const currentMonth = FY_MONTHS[i];

//       let monthProducts;

//       if (i === startIndex) {
//         monthProducts = JSON.parse(JSON.stringify(productItem));
//       } else {
//         const multiplier = 1 + incrementPercent / 100;

//         monthProducts = previousMonthProducts.map(p => ({
//           ...p,
//           pQty: round(p.pQty * multiplier),
//           sQty: round(p.sQty * multiplier),
//           total: round(p.total * multiplier)
//         }));
//       }

//       previousMonthProducts = JSON.parse(JSON.stringify(monthProducts));

//       const companyTotal = round(
//         monthProducts.reduce((sum, p) => sum + (p.total || 0), 0)
//       );

//       const managerCount = salesManagers.length;
//       let remainingTotal = companyTotal;

//       for (let idx = 0; idx < managerCount; idx++) {
//         const manager = salesManagers[idx];

//         const managerTotal =
//           idx === managerCount - 1
//             ? round(remainingTotal)
//             : round(companyTotal / managerCount);

//         remainingTotal -= managerTotal;

//         const managerProducts = monthProducts.map(p => ({
//           ...p,
//           pQty: round(p.pQty / managerCount),
//           sQty: round(p.sQty / managerCount),
//           total: round(p.total / managerCount)
//         }));

//         const hierarchyTargets = [];

//         hierarchyTargets.push({
//           roleId: firstRole.roleId,
//           roleName: firstRole.roleName,
//           rolePosition: firstRole.rolePosition,
//           userId: manager._id,
//           firstName: manager.firstName,
//           total: managerTotal,
//           products: managerProducts
//         });


//         const divideHierarchy = (
//           roleIndex,
//           totalTarget,
//           productTarget,
//           parentUserId
//         ) => {
//           if (roleIndex >= sortedRoles.length) return;

//           const currentRole = sortedRoles[roleIndex];

//           let users = [];

//           if (currentRole.roleName.toLowerCase() === "customer") {
//             users = customersByParent[String(parentUserId)] || [];
//           } else {
//             users =
//               (usersByParent[String(parentUserId)] || []).filter(
//                 u => u.rolename === currentRole.roleId
//               );
//           }

//           if (!users.length) return;

//           const count = users.length;

//           users.forEach(user => {
//             const dividedTotal = round(totalTarget / count);

//             const dividedProducts = productTarget.map(p => ({
//               ...p,
//               pQty: round(p.pQty / count),
//               sQty: round(p.sQty / count),
//               total: round(p.total / count)
//             }));

//             hierarchyTargets.push({
//               roleId: currentRole.roleId,
//               roleName: currentRole.roleName,
//               rolePosition: currentRole.rolePosition,
//               userId: user._id,
//               firstName:
//                 currentRole.roleName.toLowerCase() === "customer"
//                   ? user.CompanyName || "Unknown"
//                   : user.firstName || "Unknown",
//               total: dividedTotal,
//               products: dividedProducts
//             });

//             divideHierarchy(
//               roleIndex + 1,
//               dividedTotal,
//               dividedProducts,
//               user._id
//             );
//           });
//         };

//         divideHierarchy(1, managerTotal, managerProducts, manager._id);

//         await CompanyTarget.findOneAndUpdate(
//           {
//             database,
//             fyear,
//             month: currentMonth,
//             managerId: manager._id
//           },
//           {
//             $set: {
//               incrementper,
//               companyTotal,
//               managerId: manager._id,
//               managerName: manager.firstName,
//               managerTotal,
//               productItem: managerProducts,
//               hierarchyTargets,
//               created_by
//             }
//           },
//           { upsert: true, new: true }
//         );
//       }
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Manager-wise hierarchy targets saved successfully"
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
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


    const roles = [...salesDepartment.roles].sort(
      (a, b) => a.rolePosition - b.rolePosition
    );

    const bottomRole = roles[roles.length - 1];
    const topRole = roles[0];


    const allUsers = await User.find({
      database,
      status: "Active"
    }).lean();

    const allCustomers = await Customer.find({
      database,
      status: "Active",
      leadStatusCheck:
        "false"
    }).lean();


    const userMap = new Map();
    allUsers.forEach(u => userMap.set(String(u._id), u));

    const customerMap = new Map();
    allCustomers.forEach(c => customerMap.set(String(c._id), c));


    const usersByRole = {};
    roles.forEach(r => {
      usersByRole[r.roleId] = allUsers.filter(
        u => u.rolename === r.roleId
      );
    });


    let previousMonthProducts = null;

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


      let bottomUsers;

      if (bottomRole.roleName.toLowerCase() === "customer") {
        bottomUsers = allCustomers;
      } else {
        bottomUsers = usersByRole[bottomRole.roleId];
      }

      const bottomCount = bottomUsers.length;

      if (!bottomCount) {
        return res.status(400).json({
          success: false,
          message: "No bottom hierarchy users found"
        });
      }


      const targetMap = {};

      const bottomTotal = round(companyTotal / bottomCount);

      const bottomProducts = monthProducts.map(p => ({
        ...p,
        pQty: round(p.pQty / bottomCount),
        sQty: round(p.sQty / bottomCount),
        total: round(p.total / bottomCount)
      }));

      bottomUsers.forEach(u => {

        const id = String(u._id);

        targetMap[id] = {
          userId: id,
          firstName: u.firstName || u.CompanyName || "Unknown",
          roleId: bottomRole.roleId,
          roleName: bottomRole.roleName,
          rolePosition: bottomRole.rolePosition,
          total: bottomTotal,
          products: bottomProducts
        };

      });


      for (let r = roles.length - 2; r >= 0; r--) {

        const role = roles[r];
        const users = usersByRole[role.roleId] || [];

        users.forEach(user => {

          const children = Object.values(targetMap).filter(t => {

            const child =
              userMap.get(t.userId) || customerMap.get(t.userId);

            return String(child?.created_by) === String(user._id);

          });

          if (!children.length) return;

          const total = children.reduce(
            (sum, c) => sum + c.total,
            0
          );

          targetMap[String(user._id)] = {
            userId: String(user._id),
            firstName: user.firstName || "Unknown",
            roleId: role.roleId,
            roleName: role.roleName,
            rolePosition: role.rolePosition,
            total: round(total),
            products: monthProducts
          };

        });

      }


      const managers = usersByRole[topRole.roleId] || [];

      for (const manager of managers) {

        const managerId = String(manager._id);

        const hierarchyTargets = Object.values(targetMap).filter(t => {

          const user =
            userMap.get(t.userId) || customerMap.get(t.userId);

          let parent = user?.created_by;

          while (parent) {

            if (String(parent) === managerId) return true;

            const parentUser = userMap.get(String(parent));
            parent = parentUser?.created_by;

          }

          return false;

        });

        const managerTotal =
          targetMap[managerId]?.total || 0;

        hierarchyTargets.push(targetMap[managerId]);

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
              productItem: monthProducts,
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
      message: "Hierarchy targets saved successfully"
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

    const companyTargets = await CompanyTarget.find({ database, fyear })
      .sort({ createdAt: 1 })
      .lean();

    if (!companyTargets.length) {
      return res.status(404).json({ success: false, message: "Company targets not found" });
    }

    const allUserIds = new Set();
    const allRoleIds = new Set();

    companyTargets.forEach(target => {
      target.hierarchyTargets?.forEach(ht => {
        if (ht.userId) allUserIds.add(ht.userId.toString());
        if (ht.roleId) allRoleIds.add(ht.roleId.toString());
      });
    });

    const [users, roles] = await Promise.all([
      User.find({ _id: { $in: Array.from(allUserIds) } }).select("firstName").lean(),
      Role.find({ _id: { $in: Array.from(allRoleIds) } }).select("roleName").lean()
    ]);

    const userMap = {};
    users.forEach(u => userMap[u._id.toString()] = u.firstName);

    const roleMap = {};
    roles.forEach(r => roleMap[r._id.toString()] = r.roleName);

    const customers = await Customer.find({ _id: { $in: Array.from(allUserIds) } })
      .select("CompanyName _id")
      .lean();

    const customerMap = {};
    customers.forEach(c => {
      customerMap[c._id.toString()] = c.CompanyName;
    });

    let yearlyTarget = 0;
    const result = companyTargets.map(target => {
      yearlyTarget += target.companyTotal || 0;

      const grouped = {};
      target.hierarchyTargets?.forEach(ht => {
        const rolePos = ht.rolePosition;
        const roleName = roleMap[ht.roleId?.toString()] || "Unknown";

        if (!grouped[rolePos]) grouped[rolePos] = { rolePosition: rolePos, roleName, users: [] };

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
    const { database, fyear } = req.body;

    if (!database || !fyear) {
      return res.status(400).json({
        success: false,
        message: " database and fyear are required"
      });
    }

    const deletedResult = await CompanyTarget.deleteMany({
      database,
      fyear
    });

    if (deletedResult.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No company targets found to delete"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Company targets deleted successfully",
      deletedCount: deletedResult.deletedCount
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// export const updateCompanyTarget = async (req, res) => {
//   try {
//     const { database, fyear, month, incrementper, productItem, created_by } = req.body;

//     if (!database || !fyear || !month || !productItem?.length || !created_by) {
//       return res.status(400).json({ success: false, message: "Missing required fields" });
//     }

//     const incrementPercent = Number(incrementper || 0);
//     const startIndex = FY_MONTHS.indexOf(month);

//     if (startIndex === -1) {
//       return res.status(400).json({ success: false, message: "Invalid start month" });
//     }

//     const departments = await AssignRole.find({ database })
//       .populate({ path: "departmentName", model: "department" });

//     const department = departments.find(
//       item => item?.departmentName?.departmentName?.toLowerCase() === "sales"
//     );

//     if (!department?.roles?.length) {
//       return res.status(400).json({ success: false, message: "Sales department not configured" });
//     }

//     const sortedRoles = [...department.roles].sort((a, b) => a.rolePosition - b.rolePosition);
//     const firstRole = sortedRoles[0];

//     const allUsers = await User.find({ database }).lean();
//     const allCustomers = await Customer.find({ database }).lean();

//     const usersByParent = {};
//     const customersByParent = {};

//     allUsers.forEach(u => {
//       const parent = String(u.created_by || "");
//       if (!usersByParent[parent]) usersByParent[parent] = [];
//       usersByParent[parent].push(u);
//     });

//     allCustomers.forEach(c => {
//       const parent = String(c.created_by || "");
//       if (!customersByParent[parent]) customersByParent[parent] = [];
//       customersByParent[parent].push(c);
//     });

//     let previousMonthProducts = null;
//     let totalMonthsProcessed = 0;

//     for (let i = startIndex; i < FY_MONTHS.length; i++) {
//       const currentMonth = FY_MONTHS[i];

//       let monthProducts = i === startIndex
//         ? JSON.parse(JSON.stringify(productItem))
//         : previousMonthProducts.map(p => ({
//           ...p,
//           pQty: round(p.pQty * (1 + incrementPercent / 100)),
//           sQty: round(p.sQty * (1 + incrementPercent / 100)),
//           total: round(p.total * (1 + incrementPercent / 100))
//         }));
//       previousMonthProducts = JSON.parse(JSON.stringify(monthProducts));

//       const companyTotal = round(monthProducts.reduce((sum, p) => sum + (p.total || 0), 0));

//       const salesManagers = allUsers.filter(
//         u => u.rolename === firstRole.roleId && String(u.created_by) === String(created_by)
//       );

//       if (!salesManagers.length) {
//         return res.status(400).json({ success: false, message: "No sales managers found under this hierarchy" });
//       }

//       const managerCount = salesManagers.length;
//       let remainingCompanyTotal = companyTotal;

//       for (let idx = 0; idx < managerCount; idx++) {
//         const manager = salesManagers[idx];

//         const managerTotal = idx === managerCount - 1
//           ? round(remainingCompanyTotal)
//           : round(companyTotal / managerCount);

//         remainingCompanyTotal -= managerTotal;

//         const managerProducts = monthProducts.map(p => ({
//           ...p,
//           pQty: round(p.pQty / managerCount),
//           sQty: round(p.sQty / managerCount),
//           total: round(p.total / managerCount)
//         }));

//         const hierarchyTargets = [];

//         hierarchyTargets.push({
//           roleId: firstRole.roleId,
//           roleName: firstRole.roleName,
//           rolePosition: firstRole.rolePosition,
//           userId: manager._id,
//           firstName: manager.firstName,
//           total: managerTotal,
//           products: managerProducts
//         });

//         const divideHierarchy = (roleIndex, totalTarget, productTarget, parentUserId) => {
//           if (roleIndex >= sortedRoles.length) return;

//           const currentRole = sortedRoles[roleIndex];
//           let users = [];

//           if (currentRole.roleName.toLowerCase() === "customer") {
//             users = customersByParent[String(parentUserId)] || [];
//           } else {
//             users = (usersByParent[String(parentUserId)] || []).filter(u => u.rolename === currentRole.roleId);
//           }

//           if (!users.length) return;

//           const count = users.length;

//           users.forEach(user => {
//             const dividedTotal = round(totalTarget / count);
//             const dividedProducts = productTarget.map(p => ({
//               ...p,
//               pQty: round(p.pQty / count),
//               sQty: round(p.sQty / count),
//               total: round(p.total / count)
//             }));

//             hierarchyTargets.push({
//               roleId: currentRole.roleId,
//               roleName: currentRole.roleName,
//               rolePosition: currentRole.rolePosition,
//               userId: user._id,
//               firstName: currentRole.roleName.toLowerCase() === "customer"
//                 ? user.CompanyName || "Unknown"
//                 : user.firstName || "Unknown",
//               total: dividedTotal,
//               products: dividedProducts
//             });

//             divideHierarchy(roleIndex + 1, dividedTotal, dividedProducts, user._id);
//           });
//         };

//         divideHierarchy(1, managerTotal, managerProducts, manager._id);

//         await CompanyTarget.findOneAndUpdate(
//           { database, fyear, month: currentMonth, managerId: manager._id },
//           {
//             $set: {
//               incrementper,
//               companyTotal,
//               managerId: manager._id,
//               managerName: manager.firstName,
//               managerTotal,
//               productItem: managerProducts,
//               hierarchyTargets,
//               created_by
//             }
//           },
//           { upsert: true, new: true }
//         );
//       }

//       totalMonthsProcessed++;
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Company target updated manager-wise successfully",
//       totalMonthsProcessed
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

export const updateCompanyTarget = async (req, res) => {
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

    const roles = [...salesDepartment.roles].sort(
      (a, b) => a.rolePosition - b.rolePosition
    );

    const bottomRole = roles[roles.length - 1];
    const topRole = roles[0];

    const allUsers = await User.find({
      database,
      status: "Active"
    }).lean();

    const allCustomers = await Customer.find({
      database,
      status: "Active",
      leadStatusCheck: "false"
    }).lean();

    const userMap = new Map();
    allUsers.forEach(u => userMap.set(String(u._id), u));

    const customerMap = new Map();
    allCustomers.forEach(c => customerMap.set(String(c._id), c));

    const usersByRole = {};
    roles.forEach(r => {
      usersByRole[r.roleId] = allUsers.filter(
        u => u.rolename === r.roleId
      );
    });

    let previousMonthProducts = null;

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

      let bottomUsers;

      if (bottomRole.roleName.toLowerCase() === "customer") {
        bottomUsers = allCustomers;
      } else {
        bottomUsers = usersByRole[bottomRole.roleId];
      }

      const bottomCount = bottomUsers.length;

      if (!bottomCount) {
        return res.status(400).json({
          success: false,
          message: "No bottom hierarchy users found"
        });
      }

      const targetMap = {};

      const bottomTotal = round(companyTotal / bottomCount);

      const bottomProducts = monthProducts.map(p => ({
        ...p,
        pQty: round(p.pQty / bottomCount),
        sQty: round(p.sQty / bottomCount),
        total: round(p.total / bottomCount)
      }));

      bottomUsers.forEach(u => {

        const id = String(u._id);

        targetMap[id] = {
          userId: id,
          firstName: u.firstName || u.CompanyName || "Unknown",
          roleId: bottomRole.roleId,
          roleName: bottomRole.roleName,
          rolePosition: bottomRole.rolePosition,
          total: bottomTotal,
          products: bottomProducts
        };

      });

      for (let r = roles.length - 2; r >= 0; r--) {

        const role = roles[r];
        const users = usersByRole[role.roleId] || [];

        users.forEach(user => {

          const children = Object.values(targetMap).filter(t => {

            const child =
              userMap.get(t.userId) || customerMap.get(t.userId);

            return String(child?.created_by) === String(user._id);

          });

          if (!children.length) return;

          const total = children.reduce(
            (sum, c) => sum + c.total,
            0
          );

          targetMap[String(user._id)] = {
            userId: String(user._id),
            firstName: user.firstName || "Unknown",
            roleId: role.roleId,
            roleName: role.roleName,
            rolePosition: role.rolePosition,
            total: round(total),
            products: monthProducts
          };

        });

      }

      const managers = usersByRole[topRole.roleId] || [];

      for (const manager of managers) {

        const managerId = String(manager._id);

        const hierarchyTargets = Object.values(targetMap).filter(t => {

          const user =
            userMap.get(t.userId) || customerMap.get(t.userId);

          let parent = user?.created_by;

          while (parent) {

            if (String(parent) === managerId) return true;

            const parentUser = userMap.get(String(parent));
            parent = parentUser?.created_by;

          }

          return false;

        });

        const managerTotal =
          targetMap[managerId]?.total || 0;

        hierarchyTargets.push(targetMap[managerId]);

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
              productItem: monthProducts,
              hierarchyTargets,
              created_by
            }
          },
          { upsert: true, new: true }
        );

      }

    }

    return res.status(200).json({
      success: true,
      message: "Hierarchy targets updated successfully"
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

// export const updateCustomerTarget = async (req, res) => {
//   try {
//     const {
//       database,
//       fyear,
//       month,
//       customerId,
//       incrementper,
//       productItem,
//       created_by
//     } = req.body;

//     if (!database || !fyear || !month || !customerId || !productItem?.length) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields"
//       });
//     }

//     const incrementPercent = Number(incrementper);
//     const startIndex = FY_MONTHS.indexOf(month);

//     if (startIndex === -1) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid month"
//       });
//     }

//     let previousMonthProducts = null;
//     let updatedMonths = 0;

//     for (let i = startIndex; i < FY_MONTHS.length; i++) {

//       const currentMonth = FY_MONTHS[i];

//       const doc = await CompanyTarget.findOne({
//         database,
//         fyear,
//         month: currentMonth,
//         "hierarchyTargets.userId": customerId
//       });

//       if (!doc) continue;

//       const maxRolePosition = Math.max(
//         ...doc.hierarchyTargets.map(h => h.rolePosition)
//       );


//       let monthProducts;

//       if (i === startIndex) {
//         monthProducts = productItem.map(p => ({
//           ...p,
//           total: round(p.pQty * p.price)
//         }));
//       } else {
//         const multiplier = 1 + incrementPercent / 100;

//         monthProducts = previousMonthProducts.map(p => {
//           const newQty = round(p.pQty * multiplier);
//           return {
//             ...p,
//             pQty: newQty,
//             total: round(newQty * p.price)
//           };
//         });
//       }

//       previousMonthProducts = JSON.parse(JSON.stringify(monthProducts));


//       const customerIndex = doc.hierarchyTargets.findIndex(
//         h =>
//           h.userId?.toString() === customerId &&
//           h.rolePosition === maxRolePosition
//       );

//       if (customerIndex === -1) continue;

//       const oldTotal = doc.hierarchyTargets[customerIndex].total || 0;

//       const newTotal = round(
//         monthProducts.reduce((sum, p) => sum + p.total, 0)
//       );

//       const difference = newTotal - oldTotal;

//       if (difference === 0) continue;

//       doc.hierarchyTargets[customerIndex].products = monthProducts;
//       doc.hierarchyTargets[customerIndex].total = newTotal;


//       for (let level = maxRolePosition - 1; level >= 1; level--) {

//         const parents = doc.hierarchyTargets.filter(
//           h => h.rolePosition === level
//         );

//         parents.forEach(parent => {
//           parent.total = round((parent.total || 0) + difference);
//         });
//       }

//       doc.managerTotal = round((doc.managerTotal || 0) + difference);
//       doc.companyTotal = round((doc.companyTotal || 0) + difference);

//       doc.incrementper = incrementper;
//       doc.created_by = created_by;

//       await doc.save();
//       updatedMonths++;
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Customer updated with FY increment logic",
//       totalMonthsUpdated: updatedMonths
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

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
        month: currentMonth,
        "hierarchyTargets.userId": customerId
      });

      if (!doc) continue;

      const maxRolePosition = Math.max(
        ...doc.hierarchyTargets.map(h => h.rolePosition)
      );

      let monthProducts;

      if (i === startIndex) {

        monthProducts = productItem.map(p => ({
          ...p,
          pQty: p.pQty,
          sQty: p.sQty,
          total: round(p.total)
        }));

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

      const customerIndex = doc.hierarchyTargets.findIndex(
        h =>
          h.userId?.toString() === customerId &&
          h.rolePosition === maxRolePosition
      );

      if (customerIndex === -1) continue;

      const oldTotal = doc.hierarchyTargets[customerIndex].total || 0;

      const newTotal = round(
        monthProducts.reduce((sum, p) => sum + (p.total || 0), 0)
      );

      const difference = newTotal - oldTotal;

      if (difference === 0) continue;

      doc.hierarchyTargets[customerIndex].products = monthProducts;
      doc.hierarchyTargets[customerIndex].total = newTotal;

      const customer = await Customer.findById(customerId).lean();

      let parentId = customer?.created_by;

      while (parentId) {

        const parentIndex = doc.hierarchyTargets.findIndex(
          h => h.userId?.toString() === String(parentId)
        );

        if (parentIndex !== -1) {
          doc.hierarchyTargets[parentIndex].total = round(
            (doc.hierarchyTargets[parentIndex].total || 0) + difference
          );
        }

        const parentUser = await User.findById(parentId).lean();
        parentId = parentUser?.created_by;

      }

      doc.managerTotal = round((doc.managerTotal || 0) + difference);
      doc.companyTotal = round((doc.companyTotal || 0) + difference);

      doc.incrementper = incrementper;
      doc.created_by = created_by;

      await doc.save();

      updatedMonths++;
    }

    return res.status(200).json({
      success: true,
      message: "Customer updated with FY increment logic",
      totalMonthsUpdated: updatedMonths
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};






