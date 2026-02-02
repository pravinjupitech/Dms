
import mongoose from "mongoose";

const CombinedTargetLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.Mixed }, 
    price: { type: Number, default: 0 },
    qtyAssign: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
  },
  { _id: false },
);

const CombinedTargetSchema = new mongoose.Schema(
  {
    date: { type: String }, 
    incrementPercent: { type: Number, default: 0 }, 
    products: { type: [CombinedTargetLineSchema], default: [] },
    grandTotal: { type: Number, default: 0 },

    created_by: { type: mongoose.Schema.Types.Mixed },
    database: { type: String },
  },
  { timestamps: true },
);

export default mongoose.model("CombinedTarget", CombinedTargetSchema);