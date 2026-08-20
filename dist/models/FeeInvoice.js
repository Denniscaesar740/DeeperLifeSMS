import mongoose, { Schema } from 'mongoose';
const FeeInvoiceSchema = new Schema({
    invoiceNo: { type: String, required: true, unique: true },
    studentId: { type: String, required: true },
    studentName: { type: String, default: '' },
    branchId: { type: String, required: true },
    term: { type: String, default: 'Term 3' },
    academicYear: { type: String, default: '2026' },
    billedAmountGHS: { type: Number, required: true },
    paidAmountGHS: { type: Number, default: 0 },
    balanceGHS: { type: Number, required: true },
    status: { type: String, default: 'UNPAID' },
    dueDate: { type: Date, default: Date.now },
}, { timestamps: true });
export const FeeInvoiceModel = mongoose.models.FeeInvoice || mongoose.model('FeeInvoice', FeeInvoiceSchema);
