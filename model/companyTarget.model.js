// import mongoose from "mongoose";

// const productSchema = new mongoose.Schema(
//     {
//         productId: {
//             type: String
//         },
//         category: {
//             type: String
//         },
//         subCategory: {
//             type: String
//         },
//         productName: {
//             type: String
//         },
//         pQty: {
//             type: Number
//         },
//         sQty: {
//             type: Number
//         },
//         price: {
//             type: Number
//         },
//         total: {
//             type: Number
//         }
//     },
//     { _id: false }
// );

// const managerTargetSchema = new mongoose.Schema(
//     {
//         total: {
//             type: Number
//         },
//         products: [productSchema]
//     },
//     { _id: false }
// );

// const companyTargetSchema = new mongoose.Schema(
//     {
//         database: String,

//         fyear: String,

//         month: String,

//         incrementper: String,

//         companyTotal: {
//             type: Number,
//             required: true
//         },

//         productItem: [productSchema],

//         dividedTargets: {
//             type: Map,
//             of: managerTargetSchema,
//             default: {}
//         },

//         created_by: String
//     },
//     { timestamps: true }
// );

// export const CompanyTarget = mongoose.model(
//     "companytarget",
//     companyTargetSchema
// );


import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String
    },
    category: {
      type: String
    },
    subCategory: {
      type: String
    },
    productName: {
      type: String
    },
    pQty: {
      type: Number
    },
    sQty: {
      type: Number
    },
    price: {
      type: Number
    },
    total: {
      type: Number
    }
  },
  { _id: false }
);

const roleTargetSchema = new mongoose.Schema(
  {
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "role"
    },
    rolePosition: {
      type: Number
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
     firstName: {           
      type: String
    },
    total: {
      type: Number
    },
    products: [productSchema]
  },
  { _id: false }
);

const companyTargetSchema = new mongoose.Schema(
  {
    database: {
      type: String,
      required: true
    },

    fyear: {
      type: String,
      required: true
    },

    month: {
      type: String,
      required: true
    },

    incrementper: {
      type: String
    },

    // 🔥 Calculated in backend
    companyTotal: {
      type: Number
    },

    // 🔥 Original company product target
    productItem: [productSchema],

    // 🔥 Dynamic hierarchy division
    hierarchyTargets: [roleTargetSchema],

    created_by: {
      type: String
    }

  },
  { timestamps: true }
);

// 🔥 Prevent duplicate month entry
companyTargetSchema.index(
  { database: 1, fyear: 1, month: 1 },
  { unique: true }
);

export const CompanyTarget = mongoose.model(
  "companytarget",
  companyTargetSchema
);
