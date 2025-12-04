import express from "express";
import { dashboardDebitor, ViewLastLedgerBalance, viewLedgerByParty, viewLedgerByPartySalesApp, viewLedgerByUser } from "../controller/ledger.controller.js";

const router = express.Router();

router.get("/view-ledger-user/:id", viewLedgerByUser);
router.get("/view-ledger-party/:id", viewLedgerByParty)
router.get("/view-last-ledger/:id", ViewLastLedgerBalance)
router.get("/view-party-ledger-salesapp/:id", viewLedgerByPartySalesApp)
router.get("/dashboard-debitor/:database",dashboardDebitor)
router.get("/dashboard-creditor/:database",dashboardDebitor)
export default router;