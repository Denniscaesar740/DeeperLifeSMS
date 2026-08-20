import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { ChartOfAccountModel } from '../models/ChartOfAccount.js';
import { JournalEntryModel } from '../models/JournalEntry.js';
export const procurementRouter = Router();
function fmt(doc) {
    if (!doc)
        return doc;
    return { ...doc, id: doc._id?.toString() || doc.accountCode || doc.entryNo };
}
// 1. GET /api/v1/procurement/accounts - Chart of Accounts List
procurementRouter.get('/accounts', authenticateToken, async (_req, res) => {
    try {
        const accounts = await ChartOfAccountModel.find().lean();
        const formatted = accounts.map(fmt);
        return res.json({ count: formatted.length, accounts: formatted });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// 2. POST /api/v1/procurement/journal - Post General Ledger Vouchers / Expense Vouchers
procurementRouter.post('/journal', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT'), async (req, res) => {
    const { description, debitAccountCode, debitCode, creditAccountCode, creditCode, amountGHS, amount } = req.body;
    const finalAmount = Number(amountGHS || amount || 0);
    const finalDebit = debitAccountCode || debitCode;
    const finalCredit = creditAccountCode || creditCode;
    if (!description || !finalDebit || !finalCredit || finalAmount <= 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Description, debitAccountCode, creditAccountCode, and amountGHS are required.' });
    }
    try {
        const entryNo = `JRN-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        const entry = await JournalEntryModel.create({
            entryNo,
            description,
            debitAccountCode: finalDebit,
            creditAccountCode: finalCredit,
            amountGHS: finalAmount,
            preparedBy: req.user?.email || 'Accountant',
            status: 'POSTED',
        });
        return res.status(201).json({ message: 'Journal voucher posted successfully.', entry: fmt(entry) });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// 3. GET /api/v1/procurement/trial-balance - Generate Ghana Standard Trial Balance Statement
procurementRouter.get('/trial-balance', authenticateToken, async (_req, res) => {
    try {
        const accounts = await ChartOfAccountModel.find().lean();
        const formatted = accounts.map(fmt);
        const totalDebits = formatted.filter(a => ['ASSET', 'EXPENSE'].includes(a.accountType)).reduce((acc, a) => acc + a.balanceGHS, 0);
        const totalCredits = formatted.filter(a => ['REVENUE', 'LIABILITY', 'EQUITY'].includes(a.accountType)).reduce((acc, a) => acc + a.balanceGHS, 0);
        return res.json({
            statementName: 'DL Schools Ghana - General Ledger Trial Balance',
            asOfDate: new Date().toISOString(),
            currency: 'GHS',
            isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
            totalDebitsGHS: totalDebits,
            totalCreditsGHS: totalCredits,
            accounts: formatted,
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
