import mongoose from "mongoose";
import { CompanyTarget } from "../model/companyTarget.model.js";
import { User } from "../model/user.model.js";
import { Product } from "../model/product.model.js";
import { AssignRole } from "../model/assignRoleToDepartment.model.js";
import { Customer } from "../model/customer.model.js";
import { Role } from "../model/role.model.js";
import { CreateOrder } from "../model/createOrder.model.js";

const FY_MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March"
];

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

// export const getCompanyTarget = async (req, res) => {
//   try {
//     const { database, fyear } = req.params;

//     if (!database || !fyear) {
//       return res.status(400).json({
//         success: false,
//         message: "database and fyear required"
//       });
//     }

//     const companyTargets = await CompanyTarget.find({ database, fyear })
//       .sort({ createdAt: 1 })
//       .lean();

//     if (!companyTargets.length) {
//       return res.status(404).json({
//         success: false,
//         message: "Company targets not found"
//       });
//     }

//     const allUserIds = new Set();
//     const allRoleIds = new Set();

//     companyTargets.forEach(target => {
//       target.hierarchyTargets?.forEach(ht => {
//         if (ht.userId) allUserIds.add(ht.userId.toString());
//         if (ht.roleId) allRoleIds.add(ht.roleId.toString());
//       });
//     });

//     const [users, roles] = await Promise.all([
//       User.find({ _id: { $in: [...allUserIds] },status:"Active" })
//         .select("firstName")
//         .lean(),
//       Role.find({ _id: { $in: [...allRoleIds] } })
//         .select("roleName")
//         .lean()
//     ]);

//     const userMap = {};
//     users.forEach(u => {
//       userMap[u._id.toString()] = u.firstName;
//     });

//     const roleMap = {};
//     roles.forEach(r => {
//       roleMap[r._id.toString()] = r.roleName;
//     });

//     const customers = await Customer.find({
//       _id: { $in: [...allUserIds] },status:"Active"
//     })
//       .select("CompanyName _id")
//       .lean();

//     const customerMap = {};
//     customers.forEach(c => {
//       customerMap[c._id.toString()] = c.CompanyName;
//     });

//     let yearlyTarget = 0;

//     // ✅ Step 1: Create user map (flat)
//     const userTreeMap = {};

//     companyTargets.forEach(target => {
//       yearlyTarget += target.companyTotal || 0;

//       target.hierarchyTargets?.forEach(ht => {
//         const userId = ht.userId?.toString();
//         const roleId = ht.roleId?.toString();

//         if (!userTreeMap[userId]) {
//           const roleName = roleMap[roleId] || "Unknown";

//           let firstName = userMap[userId] || "Unknown";
//           if (
//             roleName.toLowerCase() === "customer" &&
//             customerMap[userId]
//           ) {
//             firstName = customerMap[userId];
//           }

//           userTreeMap[userId] = {
//             userId,
//             firstName,
//             rolePosition: ht.rolePosition,
//             roleName,
//             reportingTo: ht.reportingTo?.toString() || null,
//             targets: [],
//             children: []
//           };
//         }

//         userTreeMap[userId].targets.push({
//           month: target.month,
//           total: ht.total,
//           products: ht.products
//         });
//       });
//     });

//     // ✅ Step 2: Build hierarchy
//     const root = [];

//     Object.values(userTreeMap).forEach(user => {
//       if (user.reportingTo && userTreeMap[user.reportingTo]) {
//         userTreeMap[user.reportingTo].children.push(user);
//       } else {
//         // top level (rolePosition 1)
//         root.push(user);
//       }
//     });

//     return res.status(200).json({
//       success: true,
//       fyear,
//       yearlyTarget,
//       data: root
//     });

//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

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


export const achievedTarget = async (req, res) => {
  try {
    const { database, fyear } = req.params;

    if (!database || !fyear) {
      return res.status(400).json({
        success: false,
        message: "database and fyear required"
      });
    }

    // ================= FY =================
    const [startYear, shortEndYear] = fyear.split("-");
    const endYear = Number(startYear.slice(0, 2) + shortEndYear);

    const startDate = new Date(`${startYear}-04-01T00:00:00.000Z`);
    const endDate = new Date(`${endYear}-03-31T23:59:59.999Z`);

   

    const getFYIndex = (m) => (m >= 4 ? m - 4 : m + 8);

    // ================= AGG =================
    const aggData = await CreateOrder.aggregate([
      {
        $match: {
          database,
          status: "completed",
          date: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: "$orderItems" },
      {
        $addFields: { month: { $month: "$date" } }
      },
      {
        $group: {
          _id: {
            party: "$partyId",
            product: "$orderItems.productId",
            month: "$month"
          },
          qty: { $sum: "$orderItems.qty" },
          total: { $sum: "$orderItems.totalPrice" }
        }
      },
      {
        $group: {
          _id: {
            party: "$_id.party",
            month: "$_id.month"
          },
          products: {
            $push: {
              productId: "$_id.product",
              qty: "$qty",
              total: "$total"
            }
          },
          total: { $sum: "$total" }
        }
      },
      {
        $group: {
          _id: "$_id.month",
          parties: {
            $push: {
              partyId: "$_id.party",
              total: "$total",
              products: "$products"
            }
          },
          companyTotal: { $sum: "$total" }
        }
      }
    ]);

    if (!aggData.length) {
      return res.status(404).json({
        success: false,
        message: "No data found"
      });
    }

    // ================= MASTER DATA =================
    const customers = await Customer.find({ database, status: "Active" }).lean();
    const users = await User.find({ database, status: "Active" }).lean();
    const products = await Product.find({ database }).lean();

    const customerMap = new Map(customers.map(c => [String(c._id), c]));
    const userMap = new Map(users.map(u => [String(u._id), u]));
    const productMap = new Map(products.map(p => [String(p._id), p]));

    // ================= ROLES =================
    const departmentData = await AssignRole.find({ database }).populate({
      path: "departmentName",
      model: "department"
    });

    const salesDept = departmentData.find(
      d => d?.departmentName?.departmentName?.toLowerCase() === "sales"
    );

    let roles = [...(salesDept?.roles || [])].sort(
      (a, b) => a.rolePosition - b.rolePosition
    );

    const bottomRole = roles[roles.length - 1];

    // ================= HELPERS =================
    const mergeProducts = (a = [], b = []) => {
      const map = {};

      [...a, ...b].forEach(p => {
        const key = String(p.productId);

        if (!map[key]) {
          const product = productMap.get(key);

          map[key] = {
            productId: key,
            productName: product?.Product_Title || "Unknown",
            qty: p.qty,
            total: p.total
          };
        } else {
          map[key].qty += p.qty;
          map[key].total += p.total;
        }
      });

      return Object.values(map);
    };

    const getParent = (id) => {
      const c = customerMap.get(id);
      if (c) return c.created_by ? String(c.created_by) : null;

      const u = userMap.get(id);
      return u?.created_by ? String(u.created_by) : null;
    };

    const getUserInfo = (id) => {
      const c = customerMap.get(id);

      if (c) {
        return {
          name: c.CompanyName || c.firstName || "Unknown",
          roleName: bottomRole?.roleName || "CUSTOMER",
          rolePosition: bottomRole?.rolePosition || roles.length + 1
        };
      }

      const u = userMap.get(id);

      if (!u) {
        return {
          name: "Unknown",
          roleName: "UNKNOWN",
          rolePosition: roles.length + 2
        };
      }

      const roleData = roles.find(
        r => String(r.roleId) === String(u.rolename)
      );

      return {
        name: u.firstName || "Unknown",
        roleName: roleData?.roleName || "UNKNOWN",
        rolePosition: roleData?.rolePosition ?? roles.length + 2
      };
    };

    const buildChain = (id) => {
      const chain = [];
      let current = id;

      while (current) {
        const info = getUserInfo(current);

        chain.push({
          userId: current,
          firstName: info.name,
          roleName: info.roleName,
          rolePosition: info.rolePosition
        });

        current = getParent(current);
      }

      return chain;
    };

    // ================= FINAL =================
    const finalMap = new Map();

    for (const mData of aggData) {
      const monthName = FY_MONTHS[getFYIndex(mData._id)];

      if (!finalMap.has(monthName)) {
        finalMap.set(monthName, {
          month: monthName,
          companyTotal: 0,
          layers: []
        });
      }

      const monthEntry = finalMap.get(monthName);
      monthEntry.companyTotal += mData.companyTotal;

      const hierarchy = {};

      for (const p of mData.parties) {
        const chain = buildChain(String(p.partyId));

        chain.forEach(node => {
          if (!hierarchy[node.userId]) {
            hierarchy[node.userId] = {
              userId: node.userId,
              firstName: node.firstName,
              roleName: node.roleName,
              rolePosition: node.rolePosition,
              total: 0,
              products: []
            };
          }

          hierarchy[node.userId].total += p.total;
          hierarchy[node.userId].products = mergeProducts(
            hierarchy[node.userId].products,
            p.products
          );
        });
      }

      const layerMap = {};

      Object.values(hierarchy).forEach(u => {
        const key = `${u.rolePosition}-${u.roleName}`;

        if (!layerMap[key]) {
          layerMap[key] = {
            rolePosition: u.rolePosition,
            roleName: u.roleName,
            users: []
          };
        }

        layerMap[key].users.push({
          userId: u.userId,
          firstName: u.firstName,
          total: u.total,
          products: u.products
        });
      });

      monthEntry.layers = Object.values(layerMap).sort(
        (a, b) => a.rolePosition - b.rolePosition
      );
    }

    const finalData = FY_MONTHS.map(m => finalMap.get(m)).filter(Boolean);

    return res.status(200).json({
      success: true,
      fyear,
      data: finalData
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};



