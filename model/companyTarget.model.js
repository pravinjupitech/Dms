import mongoose from "mongoose";
import { Category } from "./category.model";

const productSchema = new mongoose.Schema(
    {
        productId: {
            type: String
        },
        Category: {
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

const managerTargetSchema = new mongoose.Schema(
    {
        total: {
            type: Number
        },
        products: [productSchema]
    },
    { _id: false }
);

const companyTargetSchema = new mongoose.Schema(
    {
        database: String,

        fyear: String,

        month: String,

        incrementper: String,

        companyTotal: {
            type: Number,
            required: true
        },

        productItem: [productSchema],

        dividedTargets: {
            type: Map,
            of: managerTargetSchema,
            default: {}
        },

        created_by: String
    },
    { timestamps: true }
);

export const CompanyTarget = mongoose.model(
    "companytarget",
    companyTargetSchema
);
