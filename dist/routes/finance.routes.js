import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { FeeInvoiceModel } from '../models/FeeInvoice.js';
import { StudentModel } from '../models/Student.js';
export const financeRouter = Router();
function fmt(doc) {
    if (!doc)
        return doc;
    return { ...doc, id: doc._id?.toString() || doc.invoiceNo };
}
// GET /api/v1/finance/invoices - List fee invoices
financeRouter.get('/invoices', authenticateToken, async (req, res) => {
    const { status, studentId } = req.query;
    try {
        const query = {};
        if (status)
            query.status = status;
        if (studentId)
            query.studentId = studentId;
        const dbInvoices = await FeeInvoiceModel.find(query).sort({ createdAt: -1 }).lean();
        const formatted = dbInvoices.map(fmt);
        return res.json({ count: formatted.length, invoices: formatted });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// POST /api/v1/finance/invoices/generate - Batch Generate Invoices for Term
financeRouter.post('/invoices/generate', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT'), async (req, res) => {
    const { term, academicYear, amountGHS, amount, billedAmountGHS, level } = req.body;
    const finalAmount = Number(amountGHS || amount || billedAmountGHS || 0);
    if (!term || finalAmount <= 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Term and valid billing amount are required.' });
    }
    try {
        const query = {};
        if (level)
            query.level = level;
        const students = await StudentModel.find(query).lean();
        let createdCount = 0;
        for (const s of students) {
            const invoiceNo = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
            await FeeInvoiceModel.create({
                invoiceNo,
                studentId: s._id?.toString() || s.admissionNo,
                studentName: s.fullName,
                branchId: s.branchId || 'br-accra',
                term: term || 'Term 3',
                academicYear: academicYear || '2026',
                billedAmountGHS: Number(amountGHS),
                paidAmountGHS: 0,
                balanceGHS: Number(amountGHS),
                status: 'UNPAID',
                dueDate: new Date('2026-08-30'),
            });
            createdCount++;
        }
        return res.status(201).json({
            message: `Batch fee invoices generated for ${createdCount} students (${term}, ${academicYear || '2026'}).`,
            invoicesGeneratedCount: createdCount,
            totalBilledGHS: (createdCount * Number(amountGHS)).toFixed(2),
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// GET /api/v1/finance/debtors - Debtors Summary Report
financeRouter.get('/debtors', authenticateToken, async (_req, res) => {
    try {
        const dbDebtors = await FeeInvoiceModel.find({ balanceGHS: { $gt: 0 } }).lean();
        const formatted = dbDebtors.map(fmt);
        const totalOutstandingGHS = formatted.reduce((acc, d) => acc + d.balanceGHS, 0);
        return res.json({
            debtorsCount: formatted.length,
            totalOutstandingGHS,
            debtors: formatted,
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// POST /api/v1/finance/invoices/:id/payment - Record fee payment against an invoice
financeRouter.post('/invoices/:id/payment', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT', 'CASHIER'), async (req, res) => {
    const invoiceId = String(req.params.id);
    const { amount, amountGHS, method } = req.body;
    const paidVal = Number(amount || amountGHS || 0);
    if (paidVal <= 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid payment amount is required.' });
    }
    try {
        const invoice = await FeeInvoiceModel.findOne({
            $or: [{ _id: invoiceId.match(/^[0-9a-fA-F]{24}$/) ? invoiceId : null }, { invoiceNo: invoiceId }]
        });
        if (!invoice) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found.' });
        }
        invoice.paidAmountGHS = (invoice.paidAmountGHS || 0) + paidVal;
        invoice.balanceGHS = Math.max(0, invoice.billedAmountGHS - invoice.paidAmountGHS);
        invoice.status = invoice.balanceGHS === 0 ? 'PAID' : 'PARTIAL';
        await invoice.save();
        return res.json({ message: 'Payment recorded successfully.', invoice: fmt(invoice.toObject()) });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
