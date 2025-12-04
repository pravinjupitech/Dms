import { Customer } from "../model/customer.model.js";
import { Ledger } from "../model/ledger.model.js";


export const viewLedgerByParty = async (req, res, next) => {
    try {
        const ledger = await Ledger.find({
            $or: [{ userId: req.params.id }, { partyId: req.params.id }, { expenseId: req.params.id }, { transporterId: req.params.id }]
        }).sort({ date: 1, sortorder: -1 }).populate({ path: "partyId", model: "customer" }).populate({ path: "userId", model: "user" }).populate({ path: "expenseId", model: "createAccount" }).populate({ path: "transporterId", model: "transporter" })

        if (ledger.length === 0) {
            return res.status(404).json({ message: "Not Found", status: false });
        }
        return res.status(200).json({ Ledger: ledger, status: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};
export const viewLedgerByUser = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const ledger = await Ledger.find({ userId: userId, ledgerType: "user" }).sort({ sortorder: -1 }).populate({ path: "partyId", model: "customer" }).populate({ path: "userId", model: "user" })
        if (!ledger.length > 0) {
            return res.status(404).json({ message: "Not Found", status: false })
        }
        return res.status(200).json({ Ledger: ledger, status: true })
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false })
    }
}
export const ViewLastLedgerBalance = async (req, res, next) => {
    try {
        const partyId = req.params.id;
        const ledger = await Ledger.find({ partyId: partyId, ledgerType: "party" }).sort({ sortorder: -1 }).populate({ path: "partyId", model: "customer" })
        if (ledger.length === 0) {
            return res.status(404).json({ message: "Not Found", status: false })
        }
        let lastLedgerBalance = ledger[ledger.length - 1]

        return res.status(200).json({ Ledger: lastLedgerBalance, status: true })
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false })
    }
}
export const viewLedgerByPartySalesApp = async (req, res, next) => {
    try {
        const customer = await Customer.find({ created_by: req.params.id })
        if (customer.length === 0) {
            return res.status(404).json({ message: "Customer Not Found", status: false });
        }
        let ledgerData = [];
        for (let items of customer) {
            let totalBillAmount = 0;
            let totalReceipt = 0;
            const ledger = await Ledger.find({ partyId: items._id }).sort({ date: 1, sortorder: -1 }).populate({ path: "partyId", model: "customer" });
            if (ledger.length === 0) {
                continue;
            }
            for (let item of ledger) {
                const existingLedger = await ledgerData.find((i) => i.partyId._id.toString() === item.partyId._id.toString());
                if (existingLedger) {
                    if (item.debit) {
                        existingLedger.totalBillAmount += item.debit;
                    } else {
                        existingLedger.totalReceipt += item.credit;
                    }
                } else {
                    if (item.debit) {
                        totalBillAmount = item.debit;
                    } else {
                        totalReceipt = item.credit;
                    }
                    const obj = {
                        partyId: items,
                        totalBillAmount: totalBillAmount,
                        totalReceipt: totalReceipt
                    }
                    ledgerData.push(obj)
                }
            }
        }
        return res.status(200).json({ Ledger: ledgerData, status: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};
export const dashboardDebitor = async (req, res, next) => {
    try {
        const { database } = req.params;

        const customerList = await Customer.find({
            database: database,
            status: "Active"
        });

    const registerPartyList = customerList.filter(
    (item) =>
        (item?.registrationType === "Regular" ||
         item?.registrationType === "Register") &&
        item?.partyType === "Debitor"
);

        let grandTotalDebit = 0;
        let grandTotalCredit = 0;
        let ledgers;
        for (let customer of registerPartyList) {

            ledgers = await Ledger.find({
                $or: [
                    { userId: customer._id },
                    { partyId: customer._id },
                    { expenseId: customer._id },
                    { transporterId: customer._id }
                ]
            });

            if (!ledgers || ledgers.length === 0) continue;

            let totalDebit = 0;
            let totalCredit = 0;

            for (let ledger of ledgers) {
                if (Array.isArray(ledger.Ledger)) {
                    ledger.Ledger.forEach((entry) => {
                        if (entry.debit) totalDebit += entry.debit;
                        if (entry.credit) totalCredit += entry.credit;
                    });
                } else {
                    if (ledger.debit) totalDebit += ledger.debit;
                    if (ledger.credit) totalCredit += ledger.credit;
                }
            }

            const openingBalance = Number(customer?.OpeningBalance) || 0;
            const type = customer?.Type?.toLowerCase();

            if (type === "debit") totalDebit += openingBalance;
            else if (type === "credit") totalCredit += openingBalance;

            grandTotalDebit += totalDebit;
            grandTotalCredit += totalCredit;
        }

        const closingBalance = grandTotalDebit - grandTotalCredit;

        return res.status(200).json({
            message: "Data Found",
            totalDebit: grandTotalDebit,
            totalCredit: grandTotalCredit,
            Debitor: closingBalance,
            status: true,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: "Internal Server Error",
            status: false,
        });
    }
};
export const dashboardCreditor = async (req, res, next) => {
    try {
        const { database } = req.params;

        const customerList = await Customer.find({
            database: database,
            status: "Active"
        });

    const registerPartyList = customerList.filter(
    (item) =>
        (item?.registrationType === "Regular" ||
         item?.registrationType === "Register") &&
        item?.partyType === "Creditor"
);

        let grandTotalDebit = 0;
        let grandTotalCredit = 0;
        let ledgers;
        for (let customer of registerPartyList) {

            ledgers = await Ledger.find({
                $or: [
                    { userId: customer._id },
                    { partyId: customer._id },
                    { expenseId: customer._id },
                    { transporterId: customer._id }
                ]
            });

            if (!ledgers || ledgers.length === 0) continue;

            let totalDebit = 0;
            let totalCredit = 0;

            for (let ledger of ledgers) {
                if (Array.isArray(ledger.Ledger)) {
                    ledger.Ledger.forEach((entry) => {
                        if (entry.debit) totalDebit += entry.debit;
                        if (entry.credit) totalCredit += entry.credit;
                    });
                } else {
                    if (ledger.debit) totalDebit += ledger.debit;
                    if (ledger.credit) totalCredit += ledger.credit;
                }
            }

            const openingBalance = Number(customer?.OpeningBalance) || 0;
            const type = customer?.Type?.toLowerCase();

            if (type === "debit") totalDebit += openingBalance;
            else if (type === "credit") totalCredit += openingBalance;

            grandTotalDebit += totalDebit;
            grandTotalCredit += totalCredit;
        }

        const closingBalance = grandTotalDebit - grandTotalCredit;

        return res.status(200).json({
            message: "Data Found",
            totalDebit: grandTotalDebit,
            totalCredit: grandTotalCredit,
            Creditor: closingBalance,
            status: true,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: "Internal Server Error",
            status: false,
        });
    }
};




