import { CustomerPayment } from "../model/customerPayment.model.js";
import { Ledger } from "../model/ledger.model.js";
import { Receipt } from "../model/receipt.model.js";

export const
    SaveCustomerPayment = async (req, res) => {
        try {
            const payload = {
                ...req.body,
                credit: Number(req.body.amount),
                type: "receipt",
                voucherType: "payment"
            };

            const customerPayment = await CustomerPayment.create(payload);
            const receipt = await Receipt.create(payload);
            const ledger = await Ledger.create(payload)
            return res.status(201).json({
                message: "Customer payment and receipt created successfully",
                status: true,
                data: {
                    customerPayment,
                    receipt
                }
            });

        } catch (error) {
            console.error(error);
            return res.status(500).json({
                message: "Internal Server Error",
                status: false
            });
        }
    };

export const viewCustomerPayment = async (req, res, next) => {
    try {
        const { partyId } = req.params;
        const customerPayment = await CustomerPayment.find({ partyId: partyId });
        return customerPayment.length > 0 ? res.status(200).json({ message: "Data Found", customerPayment, status: true }) : res.status(400).json({ message: "Not Found", status: false })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal Server Error",
            status: false
        });
    }
}

export const viewByIdCustomer = async (req, res, next) => {
    try {
        const { id } = req.params;
        const customerPayment = await CustomerPayment.findById(id);
        return customerPayment ? res.status(200).json({ message: "Data Found", customerPayment, status: true }) : res.status(400).json({ message: "Not Found", status: false })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal Server Error",
            status: false
        });
    }
}