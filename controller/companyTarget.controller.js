import mongoose from "mongoose";
import { CompanyTarget } from "../model/companyTarget.model.js";
import { User } from "../model/user.model.js";

const FY_MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March"
];

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

    const incrementPercent = Number(incrementper);

    const startIndex = FY_MONTHS.indexOf(month);
    if (startIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Invalid start month"
      });
    }

    const salesManagerss = await User.find({ database }).populate({ path: "rolename", model: "role" });
    const salesManagers=salesManagerss.filter((item)=>item?.rolename?.roleName==="Sales Manager")
    console.log(salesManagers)
    if (!salesManagers.length) {
      return res.status(400).json({
        success: false,
        message: "No Sales Managers found"
      });
    }

    const managerCount = salesManagers.length;

    let currentCompanyTotal = productItem.reduce(
      (sum, item) => sum + (item.total || 0),
      0
    );

    let currentProductItem = JSON.parse(JSON.stringify(productItem));

    const savedTargets = [];

    for (let i = startIndex; i < FY_MONTHS.length; i++) {
      const currentMonth = FY_MONTHS[i];

      if (i !== startIndex) {
        currentCompanyTotal +=
          (currentCompanyTotal * incrementPercent) / 100;

        currentProductItem = currentProductItem.map((item) => ({
          ...item,
          pQty: item.pQty + (item.pQty * incrementPercent) / 100,
          sQty: item.sQty + (item.sQty * incrementPercent) / 100,
          total: item.total + (item.total * incrementPercent) / 100
        }));
      }

      const dividedTargets = {};

      salesManagers.forEach((manager) => {
        dividedTargets[manager._id] = {
          total: currentCompanyTotal / managerCount,
          products: currentProductItem.map((item) => ({
            productId: item.productId,
            pQty: item.pQty / managerCount,
            sQty: item.sQty / managerCount,
            price: item.price,
            total: item.total / managerCount
          }))
        };
      });

      const companyTarget = new CompanyTarget({
        database,
        fyear,
        month: currentMonth,
        incrementper,
        companyTotal: currentCompanyTotal,
        productItem: currentProductItem,
        dividedTargets,
        created_by
      });

      await companyTarget.save();
      savedTargets.push(companyTarget);
    }

    res.status(201).json({
      success: true,
      message: `Targets saved from ${month} to March`,
      totalMonths: savedTargets.length,
      data: savedTargets
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


// export const getCompanyTarget = async (req, res) => {
//   try {
//     const { fyear, database } = req.params;

//     const companyTargets = await CompanyTarget.find({ database, fyear }).sort({ createdAt: 1 });

//     if (!companyTargets.length) {
//       return res.status(404).json({
//         success: false,
//         message: "Company targets not found for this financial year"
//       });
//     }

//     const result = [];

//     for (let target of companyTargets) {
//       const dividedTargetsObj = Object.fromEntries(target.dividedTargets || []);

//       const managerIds = Object.keys(dividedTargetsObj);
//       const managers = await User.find({ _id: { $in: managerIds } }, { name: 1 });

//       const managerMap = {};
//       managers.forEach((m) => {
//         managerMap[m._id] = m.name;
//       });

//       const salesManagerTargets = managerIds.map((id) => ({
//         salesManagerId: id,
//         salesManagerName: managerMap[id] || "Unknown",
//         totalTarget: dividedTargetsObj[id].total,
//         products: dividedTargetsObj[id].products
//       }));

//       result.push({
//         month: target.month,
//         companyTotal: target.companyTotal,
//         productItem: target.productItem,
//         salesManagerTargets
//       });
//     }

//     res.status(200).json({
//       success: true,
//       fyear,
//       data: result
//     });

//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// };


export const getCompanyTarget = async (req, res) => {
  try {
    const { fyear, database } = req.params;

    const companyTargets = await CompanyTarget
      .find({ database, fyear })
      .sort({ createdAt: 1 })
      .lean();

    if (!companyTargets.length) {
      return res.status(404).json({
        success: false,
        message: "Company targets not found"
      });
    }

    const result = [];

    for (const target of companyTargets) {
      const dividedTargetsObj = target.dividedTargets || {};
      const managerIds = Object.keys(dividedTargetsObj);

      const objectManagerIds = managerIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

      const managers = await User.find(
        { _id: { $in: objectManagerIds } },
        { firstName: 1 } // ✅ CORRECT FIELD
      ).lean();

      const managerMap = {};
      managers.forEach(m => {
        managerMap[m._id.toString()] = m.firstName;
      });

      const salesManagerTargets = managerIds.map(id => ({
        salesManagerId: id,
        salesManagerName: managerMap[id] || "Unknown",
        totalTarget: dividedTargetsObj[id]?.total || 0,
        products: dividedTargetsObj[id]?.products || []
      }));

      result.push({
        month: target.month,
        companyTotal: target.companyTotal,
        productItem: target.productItem,
        salesManagerTargets
      });
    }

    res.status(200).json({
      success: true,
      fyear,
      data: result
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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
        status: false,
        message: "Invalid start month"
      });
    }

    // Update from selected month till March
    const monthsToUpdate = FY_MONTHS.slice(startIndex);

    // Delete existing records for those months
    await CompanyTarget.deleteMany({
      database,
      fyear,
      month: { $in: monthsToUpdate }
    });

    // Fetch users
    const users = await User.find({ database }).populate({
      path: "rolename",
      model: "role"
    });

    const salesManagers = users.filter(
      (u) => u?.rolename?.roleName === "Sales Manager"
    );

    if (!salesManagers.length) {
      return res.status(400).json({
        status: false,
        message: "No Sales Managers found"
      });
    }

    const managerCount = salesManagers.length;

    // Calculate initial company total
    let currentCompanyTotal = productItem.reduce(
      (sum, item) => sum + (Number(item.total) || 0),
      0
    );

    // Deep copy product items
    let currentProductItem = JSON.parse(JSON.stringify(productItem));

    const savedTargets = [];

    for (let i = startIndex; i < FY_MONTHS.length; i++) {
      const currentMonth = FY_MONTHS[i];

      // Apply increment ONLY if incrementPercent > 0
      if (i !== startIndex && incrementPercent > 0) {
        currentCompanyTotal +=
          (currentCompanyTotal * incrementPercent) / 100;

        currentProductItem = currentProductItem.map((item) => ({
          ...item,
          pQty: Number(item.pQty) + (Number(item.pQty) * incrementPercent) / 100,
          sQty: Number(item.sQty) + (Number(item.sQty) * incrementPercent) / 100,
          total: Number(item.total) + (Number(item.total) * incrementPercent) / 100
        }));
      }

      const dividedTargets = {};

      salesManagers.forEach((manager) => {
        dividedTargets[manager._id] = {
          total: currentCompanyTotal / managerCount,
          products: currentProductItem.map((item) => ({
            productId: item.productId,
            pQty: Number(item.pQty) / managerCount,
            sQty: Number(item.sQty) / managerCount,
            price: item.price,
            total: Number(item.total) / managerCount
          }))
        };
      });

      const companyTarget = new CompanyTarget({
        database,
        fyear,
        month: currentMonth,
        incrementper: incrementPercent,
        companyTotal: currentCompanyTotal,
        productItem: currentProductItem,
        dividedTargets,
        created_by
      });

      await companyTarget.save();
      savedTargets.push(companyTarget);
    }

    return res.status(200).json({
      status: true,
      message: `Targets updated from ${month} to March`,
      totalMonths: savedTargets.length,
      data: savedTargets
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message
    });
  }
};



