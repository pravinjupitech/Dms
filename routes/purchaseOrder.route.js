import express from "express";
import multer from "multer";
import { CountInTransitPurchase, CountPurchase, CountpendingPurchase, CreditorCalculate, ProductWisePurchaseReport, Purch, PurchaseOrderDispatch, UpdatePurchaseInvoiceOrder, dashboardGstInput, dashboardPurchase, deletePurchaseOrder, deletedPurchase, gstInputReport, purchaseInvoiceOrder, purchaseOrder, purchaseOrderHistory, purchaseOrderHistoryByOrderId, updatePurchaseOrder, updatePurchaseOrderStatus } from "../controller/purchageOrder.controller.js";

const router = express.Router();
const upload = multer({ dest: "public/Images/" })

router.post("/save-purchase-order", purchaseOrder)
router.post("/purchase-invoice-order", purchaseInvoiceOrder)
router.put("/purchase-order-update/:orderId", UpdatePurchaseInvoiceOrder)
router.post("/dipatch-purchase-order/:id", PurchaseOrderDispatch)
router.get("/view-purchase-order-history/:id/:database", purchaseOrderHistory)
router.get("/view-purchase-order-history-by-id/:id", purchaseOrderHistoryByOrderId);
router.put("/update-purchase-order/:id", updatePurchaseOrder);
router.put("/update-purchase-order-status/:id", updatePurchaseOrderStatus);
router.post("/product-purchase-report/:database", ProductWisePurchaseReport)
router.delete("/delete-purchase-order/:id", deletePurchaseOrder);
router.delete("/deleted-purchase-order/:id", deletedPurchase)
router.get("/gst-input/:database",gstInputReport)
router.get("/creditor-calculate/:database", CreditorCalculate)
router.post("/purch/:id", Purch)
router.get("/dashboard-purchase/:database",dashboardPurchase)
router.get("/dashboard-gstinput/:database",dashboardGstInput)
router.get("/dashboard-count-purchase/:database",CountPurchase)
router.get("/dashboard-purchase-pending/:database",CountpendingPurchase)
router.get("/dashboard-purchase-intransit/:database",CountInTransitPurchase)
export default router;