import express from "express";
import { SaveCustomerPayment, viewByIdCustomer, viewCustomerPayment } from "../controller/customerPayment.controller.js";
const router = express.Router();

router.post("/save-customer-payment",SaveCustomerPayment)
router.get("/view-customer-payment/:partyId",viewCustomerPayment)
router.get("/view-by-customer-payment/:id",viewByIdCustomer)

export default router;