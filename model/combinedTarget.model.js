
// import mongoose from "mongoose";

// const CombinedTargetLineSchema = new mongoose.Schema(
//   {
//     productId: { type: mongoose.Schema.Types.Mixed }, 
//     price: { type: Number, default: 0 },
//     qtyAssign: { type: Number, default: 0 },
//     totalPrice: { type: Number, default: 0 },
//   },
//   { _id: false },
// );

// const CombinedTargetSchema = new mongoose.Schema(
//   {
//     date: { type: String }, 
//     incrementPercent: { type: Number, default: 0 }, 
//     products: { type: [CombinedTargetLineSchema], default: [] },
//     grandTotal: { type: Number, default: 0 },
//     created_by: { type: mongoose.Schema.Types.Mixed },
//     database: { type: String },
//   },
//   { timestamps: true },
// );

// export default mongoose.model("CombinedTarget", CombinedTargetSchema);

// models/CustomerTarget.js
import mongoose from "mongoose";

const ProductTargetSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.Mixed },
    monthlyQty: { type: Map, of: Number, default: {} },   // e.g., { "April": 10, "May": 12 }
    monthlyPrice: { type: Map, of: Number, default: {} }, // store per month if needed
    monthlyTotal: { type: Map, of: Number, default: {} }  // total per month
  },
  { _id: false }
);

// Main CustomerTarget schema
const CustomerTargetSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "customer", required: true },
    financialYear: { type: String, required: true },
    database: { type: String, required: true },

    // Dynamic role keys will be added at runtime
    roles: {
      type: Map,              // Map of roleKey -> ObjectId of user assigned
      of: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: {}
    },

    products: [ProductTargetSchema],
    grandTotalPerMonth: { type: Map, of: Number, default: {} }, // total per month
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("CustomerTarget", CustomerTargetSchema);
