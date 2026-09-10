import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { FeeInvoiceModel } from '../models/FeeInvoice.js';
import { StudentModel } from '../models/Student.js';
import { FeeStructureModel } from '../models/FeeStructure.js';

export const financeRouter = Router();

function fmt(doc: any) {
    if (!doc) return doc;
    return { ...doc, id: doc._id?.toString() || doc.invoiceNo || doc.code };
}

// GET /api/v1/finance/fee-structures - Get all configured fee structures
financeRouter.get('/fee-structures', async (req: Request, res: Response) => {
    try {
        const { level, branchId } = req.query;
        const query: any = {};
        if (level) query.level = level;
        if (branchId) query.branchId = branchId;

        const structures = await FeeStructureModel.find(query).sort({ createdAt: -1 }).lean();
        const formatted = structures.map(fmt);
        return res.json({ count: formatted.length, feeStructures: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/finance/fee-structures - Create or configure a fee structure for a class
financeRouter.post('/fee-structures', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    try {
        const { title, level, branchId, academicYear, term, items, totalAmountGHS, status } = req.body;
        if (!title || !level) {
            return res.status(400).json({ error: 'BAD_REQUEST', message: 'Title and level are required.' });
        }

        const calculatedTotal = Array.isArray(items) && items.length > 0
            ? items.reduce((acc: number, item: any) => acc + Number(item.amountGHS || 0), 0)
            : Number(totalAmountGHS || 0);

        const code = `FEE-2026-${String(level).replace(/\s+/g, '-').toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

        const newStructure = await FeeStructureModel.create({
            code,
            title,
            level,
            branchId: branchId || 'br-accra',
            academicYear: academicYear || '2025/2026',
            term: term || 'Term 3',
            items: items || [],
            totalAmountGHS: calculatedTotal,
            status: status || 'ACTIVE',
        });

        return res.status(201).json({
            message: `Fee structure "${title}" configured successfully for ${level}.`,
            feeStructure: fmt(newStructure.toObject()),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// PUT /api/v1/finance/fee-structures/:id - Update an existing fee structure
financeRouter.put('/fee-structures/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { title, level, branchId, academicYear, term, items, totalAmountGHS, status } = req.body;

        const updateData: any = {};
        if (title) updateData.title = title;
        if (level) updateData.level = level;
        if (branchId) updateData.branchId = branchId;
        if (academicYear) updateData.academicYear = academicYear;
        if (term) updateData.term = term;
        if (status) updateData.status = status;

        if (Array.isArray(items)) {
            updateData.items = items;
            updateData.totalAmountGHS = items.reduce((acc: number, item: any) => acc + Number(item.amountGHS || 0), 0);
        } else if (totalAmountGHS !== undefined) {
            updateData.totalAmountGHS = Number(totalAmountGHS);
        }

        const updated = await FeeStructureModel.findOneAndUpdate(
            { $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { code: id }] },
            updateData,
            { returnDocument: 'after' }
        ).lean();

        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Fee structure not found.' });
        }

        return res.json({ message: 'Fee structure updated successfully.', feeStructure: fmt(updated) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// DELETE /api/v1/finance/fee-structures/:id - Delete a fee structure
financeRouter.delete('/fee-structures/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await FeeStructureModel.deleteOne({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { code: id }] });
        return res.json({ message: 'Fee structure deleted successfully.' });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET /api/v1/finance/invoices - List fee invoices
financeRouter.get('/invoices', authenticateToken, async (req: Request, res: Response) => {
    const { status, studentId } = req.query;
    try {
        const query: any = {};
        const authUser = (req as any).user;

        if (authUser && authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'AUDITOR' && authUser.branchId && authUser.branchId !== 'ALL') {
            query.branchId = authUser.branchId;
        }
        if (status) query.status = status;
        if (studentId) query.studentId = studentId;

        const dbInvoices = await FeeInvoiceModel.find(query).sort({ createdAt: -1 }).lean();
        const formatted = dbInvoices.map(fmt);
        return res.json({ count: formatted.length, invoices: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/finance/invoices/generate - Batch Generate Invoices for Term
financeRouter.post('/invoices/generate', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
    const { term, academicYear, amountGHS, amount, billedAmountGHS, level } = req.body;
    let finalAmount = Number(amountGHS || amount || billedAmountGHS || 0);

    if (!term) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Term is required.' });
    }

    try {
        const query: any = {};
        if (level) query.level = level;

        const students = await StudentModel.find(query).lean();
        let createdCount = 0;
        let grandTotal = 0;

        for (const s of students) {
            // Dynamically check if a fee structure is configured for s.level
            let itemsToUse: any[] = [];
            let studentBilledAmount = finalAmount;

            if (s.level) {
                const configStructure = await FeeStructureModel.findOne({ level: s.level, status: 'ACTIVE' }).lean();
                if (configStructure && configStructure.totalAmountGHS > 0) {
                    studentBilledAmount = configStructure.totalAmountGHS;
                    itemsToUse = configStructure.items.map((i: any) => ({
                        description: i.name,
                        amountGHS: i.amountGHS,
                    }));
                }
            }

            if (studentBilledAmount <= 0) studentBilledAmount = 1500; // fallback if unconfigured

            const invoiceNo = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
            await FeeInvoiceModel.create({
                invoiceNo,
                studentId: s._id?.toString() || (s as any).admissionNo,
                studentName: s.fullName,
                level: s.level || 'Primary 1',
                branchId: s.branchId || 'br-accra',
                term: term || 'Term 3',
                academicYear: academicYear || '2025/2026',
                items: itemsToUse,
                billedAmountGHS: studentBilledAmount,
                paidAmountGHS: 0,
                balanceGHS: studentBilledAmount,
                status: 'UNPAID',
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
            createdCount++;
            grandTotal += studentBilledAmount;
        }

        return res.status(201).json({
            message: `Batch fee invoices generated for ${createdCount} students (${term}, ${academicYear || '2025/2026'}).`,
            invoicesGeneratedCount: createdCount,
            totalBilledGHS: grandTotal.toFixed(2),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET /api/v1/finance/debtors - Debtors Summary Report
financeRouter.get('/debtors', authenticateToken, async (_req: Request, res: Response) => {
    try {
        const dbDebtors = await FeeInvoiceModel.find({ balanceGHS: { $gt: 0 } }).lean();
        const formatted = dbDebtors.map(fmt);
        const totalOutstandingGHS = formatted.reduce((acc, d) => acc + d.balanceGHS, 0);
        return res.json({
            debtorsCount: formatted.length,
            totalOutstandingGHS,
            debtors: formatted,
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/finance/invoices/:id/payment - Record fee payment against an invoice
financeRouter.post('/invoices/:id/payment', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT', 'CASHIER'), async (req: Request, res: Response) => {
    const invoiceId = String(req.params.id);
    const { amount, amountGHS, method } = req.body;
    const paidVal = Number(amount || amountGHS || 0);

    if (paidVal <= 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid payment amount is required.' });
    }

    try {
        const invoice: any = await FeeInvoiceModel.findOne({
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
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

