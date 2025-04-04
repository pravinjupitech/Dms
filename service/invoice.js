import { CompanyDetails } from "../model/companyDetails.model.js";
import { DebitNote } from "../model/debitNote.model.js";
import { CreditNote } from "../model/creditNote.model.js";

export const generateInvoice = async (database) => {
    const companyDetail = await CompanyDetails.findOne({database:database})
    if(!companyDetail){
        return false
    }
    if(!companyDetail.dummy){
        const no = 1
        const generatedInvoice = `${companyDetail.Prefix}${no.toString().padStart(5, '0')}${companyDetail.Suffix}`;
        companyDetail.dummy = generatedInvoice;
        await companyDetail.save();
        return generatedInvoice
    } else{
        if(companyDetail.cancelInvoice.length===0){
            const length = companyDetail.Prefix.length
            const lengths = companyDetail.Suffix.length
            const first = companyDetail.dummy;
            const middlePart = first.slice(length, -lengths);
            const newMiddleNumber = (parseInt(middlePart, 10) + 1).toString().padStart(middlePart.length, "0"); 
            const generatedInvoice = first.slice(0, length) + newMiddleNumber + first.slice(-lengths);
            companyDetail.dummy = generatedInvoice;
            await companyDetail.save();
            return generatedInvoice
        } else{
            const generatedInvoice = companyDetail.cancelInvoice.shift();
            // console.log(result.invoice);
            await companyDetail.save();
            return generatedInvoice.invoice
        }
    }
    // const companyDetail = await CompanyDetails.findOne({ database: database });
    // const invoice = companyDetail.dummy + 1;
    // const generatedInvoice = `${companyDetail.Prefix}${invoice}`;
    // companyDetail.dummy = invoice;
    // await companyDetail.save()

    // return generatedInvoice;
};
export const generateOrderNo = async (database) => {
    const companyDetail = await CompanyDetails.findOne({ database: database });
    const invoice = companyDetail.orderNo + 1;
    let orderNO = invoice.toString().padStart(3, '0')
    const generatedOrderNo = `${"ORD"}${orderNO}`;
    companyDetail.orderNo = invoice;
    await companyDetail.save()

    return generatedOrderNo;
};
export const warehouseNo = async (database) => {
    const companyDetail = await CompanyDetails.findOne({ database: database });
    const invoice = companyDetail.warehouseDummy + 1;
    let warehouseNo = invoice.toString().padStart(3, '0')
    companyDetail.warehouseDummy = invoice;
    await companyDetail.save()

    return warehouseNo;
};
export const CreditNoteNo = async (body) => {
    const creditNote = await CreditNote.find({ database: body.database, creditType: "C" }).sort({ sortorder: -1 })
    if (creditNote.length === 0) {
        const no = 1
        const CreditNoteNo = `${"CN"}${no.toString().padStart(3, '0')}`;
        return CreditNoteNo;
    } else {
        const existNote = creditNote[creditNote.length - 1].NoteNumber
        const lastestNote = parseInt(existNote.slice(2)) + 1
        let Note = lastestNote.toString().padStart(3, '0')
        const CreditNoteNo = `${"CN"}${Note}`;
        return CreditNoteNo;
    }
};
export const DebitNoteNO = async (body) => {
    const debitNote = await DebitNote.find({ database: body.database, debitType: "D" }).sort({ sortorder: -1 });
    if (debitNote.length === 0) {
        const no = 1
        const DebitNoteNo = `${"DN"}${no.toString().padStart(3, '0')}`;
        return DebitNoteNo;
    } else {
        const existNote = debitNote[debitNote.length - 1].NoteNumber
        const lastestNote = parseInt(existNote.slice(2)) + 1
        let Note = lastestNote.toString().padStart(3, '0')
        const DebitNoteNo = `${"DN"}${Note}`;
        return DebitNoteNo;
    }
};
