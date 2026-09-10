import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { ChartOfAccountModel } from '../models/ChartOfAccount.js';
import { JournalEntryModel } from '../models/JournalEntry.js';
import { PurchaseOrderModel } from '../models/PurchaseOrder.js';
import { SupplierQuoteModel } from '../models/SupplierQuote.js';
import { GoodsReceivedNoteModel } from '../models/GoodsReceivedNote.js';
import { BankReconciliationModel } from '../models/BankReconciliation.js';

export const procurementRouter = Router();

function fmt(doc: any) {
    if (!doc) return doc;
    const obj = doc.toJSON ? doc.toJSON() : { ...doc };
    obj.id = obj._id?.toString() || obj.accountCode || obj.entryNo || obj.poNumber || obj.grnNo;
    return obj;
}

// ============================================================================
// 1. CHART OF ACCOUNTS & GENERAL LEDGER JOURNALS
// ============================================================================

// GET /api/v1/procurement/accounts - Chart of Accounts List
procurementRouter.get('/accounts', authenticateToken, async (_req: Request, res: Response) => {
    try {
        const accounts = await ChartOfAccountModel.find().lean();
        const formatted = accounts.map(fmt);
        return res.json({ count: formatted.length, accounts: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET /api/v1/procurement/journal - List Journal Entries
procurementRouter.get('/journal', authenticateToken, async (_req: Request, res: Response) => {
    try {
        const entries = await JournalEntryModel.find().sort({ createdAt: -1 }).limit(200).lean();
        const formatted = entries.map(fmt);
        return res.json({ count: formatted.length, journalEntries: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/procurement/journal - Post General Ledger Vouchers / Expense Vouchers
procurementRouter.post('/journal', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
    const { description, debitAccountCode, debitCode, creditAccountCode, creditCode, amountGHS, amount } = req.body;
    const finalAmount = Number(amountGHS || amount || 0);
    const finalDebit = debitAccountCode || debitCode;
    const finalCredit = creditAccountCode || creditCode;

    if (!description || !finalDebit || !finalCredit || finalAmount <= 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Description, debitAccountCode, creditAccountCode, and amountGHS are required.' });
    }

    try {
        const entryNo = `JRN-2026-${Math.floor(1000 + Math.random() * 9000)}`;

        // Fetch account names if available
        const debitAcc = await ChartOfAccountModel.findOne({ accountCode: finalDebit }).lean();
        const creditAcc = await ChartOfAccountModel.findOne({ accountCode: finalCredit }).lean();

        const entry = await JournalEntryModel.create({
            entryNo,
            description,
            debitAccountCode: finalDebit,
            debitAccountName: debitAcc?.accountName || 'Debit Account',
            creditAccountCode: finalCredit,
            creditAccountName: creditAcc?.accountName || 'Credit Account',
            amountGHS: finalAmount,
            preparedBy: (req as any).user?.fullName || (req as any).user?.email || 'Accountant',
            status: 'POSTED',
        });
        return res.status(201).json({ message: 'Journal voucher posted successfully.', entry: fmt(entry) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET /api/v1/procurement/trial-balance - Generate Ghana Standard Trial Balance Statement
procurementRouter.get('/trial-balance', authenticateToken, async (_req: Request, res: Response) => {
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
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// ============================================================================
// 2. PURCHASE ORDERS (PO) & MULTI-TIER APPROVALS
// ============================================================================

// GET /api/v1/procurement/orders - List Purchase Orders
procurementRouter.get('/orders', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.supplierName) filter.supplierName = new RegExp(String(req.query.supplierName), 'i');

        const orders = await PurchaseOrderModel.find(filter).sort({ createdAt: -1 }).lean();
        return res.json({ count: orders.length, purchaseOrders: orders.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/procurement/orders - Create Purchase Order (Initiates Sequential Approval Chain)
procurementRouter.post('/orders', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
    const { supplierName, branchName, branchId, targetDeliveryDate, items } = req.body;

    if (!supplierName || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Supplier name and items list are required.' });
    }

    try {
        const poNumber = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;

        const processedItems = items.map((i: any) => ({
            description: i.description || i.name || 'Item',
            qty: Number(i.qty || i.quantity || 1),
            unitPriceGHS: Number(i.unitPriceGHS || i.unitPrice || 0),
            totalGHS: Number(i.totalGHS || (Number(i.qty || 1) * Number(i.unitPriceGHS || 0))),
        }));

        const grandTotalGHS = processedItems.reduce((acc, i) => acc + i.totalGHS, 0);

        const defaultChain = [
            { role: 'Accountant Budget Sign-Off', approved: false },
            { role: 'Headteacher Operational Approval', approved: false },
            { role: 'SuperAdmin Financial Authorization', approved: false },
        ];

        const po = await PurchaseOrderModel.create({
            poNumber,
            supplierName,
            branchName: branchName || 'Main Campus',
            branchId: branchId || 'br-accra',
            dateIssued: new Date().toISOString().split('T')[0],
            targetDeliveryDate: targetDeliveryDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            items: processedItems,
            grandTotalGHS,
            status: 'PENDING_APPROVAL',
            currentApprovalTier: 'ACCOUNTANT',
            approvalChain: defaultChain,
            createdBy: (req as any).user?.fullName || (req as any).user?.email || 'Procurement Officer',
        });

        return res.status(201).json({
            message: `Purchase Order ${poNumber} created. Multi-tier approval chain initiated (Tier 1: Accountant).`,
            purchaseOrder: fmt(po.toObject()),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/procurement/orders/:id/approve - Approve / Reject PO Step in Multi-Tier Chain
procurementRouter.post('/orders/:id/approve', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT', 'HEADTEACHER', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    const { action, comment } = req.body; // action: 'APPROVE' | 'REJECT'
    const poId = req.params.id;

    if (!action || !['APPROVE', 'REJECT'].includes(action.toUpperCase())) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: "Action must be 'APPROVE' or 'REJECT'." });
    }

    try {
        const po = await PurchaseOrderModel.findById(poId);
        if (!po) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Purchase Order not found.' });
        }

        if (po.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ error: 'BAD_REQUEST', message: `Purchase Order status is already ${po.status}.` });
        }

        const user = (req as any).user;
        const userRole = user?.role || 'ACCOUNTANT';
        const userName = user?.fullName || user?.email || 'Authorized Signatory';
        const currentDate = new Date().toISOString().split('T')[0];

        if (action.toUpperCase() === 'REJECT') {
            po.status = 'REJECTED';
            // Mark current tier in chain
            const stepIndex = po.currentApprovalTier === 'ACCOUNTANT' ? 0 : po.currentApprovalTier === 'HEADTEACHER' ? 1 : 2;
            if (po.approvalChain[stepIndex]) {
                po.approvalChain[stepIndex].comment = `[REJECTED by ${userRole} ${userName}]: ${comment || 'No comment provided'}`;
            }
            await po.save();
            return res.json({ message: `Purchase Order ${po.poNumber} rejected at ${po.currentApprovalTier} tier.`, purchaseOrder: fmt(po.toObject()) });
        }

        // Sequential Approval Logic
        if (po.currentApprovalTier === 'ACCOUNTANT') {
            po.approvalChain[0].approved = true;
            po.approvalChain[0].approvedBy = `${userName} (${userRole})`;
            po.approvalChain[0].date = currentDate;
            po.approvalChain[0].comment = comment || 'Budget availability verified.';
            po.currentApprovalTier = 'HEADTEACHER';
        } else if (po.currentApprovalTier === 'HEADTEACHER') {
            po.approvalChain[1].approved = true;
            po.approvalChain[1].approvedBy = `${userName} (${userRole})`;
            po.approvalChain[1].date = currentDate;
            po.approvalChain[1].comment = comment || 'Operational necessity confirmed.';
            po.currentApprovalTier = 'SUPER_ADMIN';
        } else if (po.currentApprovalTier === 'SUPER_ADMIN') {
            po.approvalChain[2].approved = true;
            po.approvalChain[2].approvedBy = `${userName} (${userRole})`;
            po.approvalChain[2].date = currentDate;
            po.approvalChain[2].comment = comment || 'Final financial authorization granted.';
            po.currentApprovalTier = 'COMPLETED';
            po.status = 'APPROVED';
        }

        await po.save();
        return res.json({
            message: po.status === 'APPROVED'
                ? `Purchase Order ${po.poNumber} fully authorized and approved across all tiers!`
                : `Tier approved. Purchase Order advanced to ${po.currentApprovalTier} stage.`,
            purchaseOrder: fmt(po.toObject()),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// ============================================================================
// 3. SUPPLIER QUOTATION MATRIX
// ============================================================================

// GET /api/v1/procurement/quotes - List Supplier Quotations
procurementRouter.get('/quotes', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.rfqNumber) filter.rfqNumber = req.query.rfqNumber;
        if (req.query.status) filter.status = req.query.status;

        const quotes = await SupplierQuoteModel.find(filter).sort({ createdAt: -1 }).lean();
        return res.json({ count: quotes.length, supplierQuotes: quotes.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/procurement/quotes - Capture New Supplier Quotation
procurementRouter.post('/quotes', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    const { supplierName, itemDescription, quantity, unitPriceGHS, deliveryDays, validUntil, rfqNumber, notes } = req.body;

    if (!supplierName || !itemDescription || !quantity || !unitPriceGHS) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Supplier name, item description, quantity, and unit price are required.' });
    }

    try {
        const qty = Number(quantity);
        const price = Number(unitPriceGHS);
        const totalPriceGHS = qty * price;

        const quote = await SupplierQuoteModel.create({
            rfqNumber: rfqNumber || `RFQ-${Date.now().toString().slice(-4)}`,
            supplierName,
            itemDescription,
            quantity: qty,
            unitPriceGHS: price,
            totalPriceGHS,
            deliveryDays: Number(deliveryDays || 7),
            validUntil: validUntil || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            status: 'PENDING',
            submittedBy: (req as any).user?.fullName || 'Procurement Desk',
            notes: notes || '',
        });

        return res.status(201).json({ message: 'Supplier quotation recorded in matrix.', supplierQuote: fmt(quote.toObject()) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/procurement/quotes/:id/select - Select Winning Supplier Quotation
procurementRouter.post('/quotes/:id/select', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    const quoteId = req.params.id;

    try {
        const winningQuote = await SupplierQuoteModel.findById(quoteId);
        if (!winningQuote) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Supplier quotation not found.' });
        }

        // Mark target quote as SELECTED
        winningQuote.status = 'SELECTED';
        await winningQuote.save();

        // Reject competing quotes under same RFQ or item description
        await SupplierQuoteModel.updateMany(
            { _id: { $ne: quoteId }, itemDescription: winningQuote.itemDescription, status: 'PENDING' },
            { $set: { status: 'REJECTED' } }
        );

        // Auto-generate draft Purchase Order from winning quote
        const poNumber = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        const autoPo = await PurchaseOrderModel.create({
            poNumber,
            supplierName: winningQuote.supplierName,
            branchName: 'Main Campus',
            branchId: 'br-accra',
            dateIssued: new Date().toISOString().split('T')[0],
            targetDeliveryDate: new Date(Date.now() + winningQuote.deliveryDays * 86400000).toISOString().split('T')[0],
            items: [
                {
                    description: winningQuote.itemDescription,
                    qty: winningQuote.quantity,
                    unitPriceGHS: winningQuote.unitPriceGHS,
                    totalGHS: winningQuote.totalPriceGHS,
                },
            ],
            grandTotalGHS: winningQuote.totalPriceGHS,
            status: 'PENDING_APPROVAL',
            currentApprovalTier: 'ACCOUNTANT',
            approvalChain: [
                { role: 'Accountant Budget Sign-Off', approved: false },
                { role: 'Headteacher Operational Approval', approved: false },
                { role: 'SuperAdmin Financial Authorization', approved: false },
            ],
            createdBy: `Winning Quote ${winningQuote.rfqNumber}`,
        });

        return res.json({
            message: `Quotation from "${winningQuote.supplierName}" selected! Draft Purchase Order ${poNumber} automatically generated.`,
            supplierQuote: fmt(winningQuote.toObject()),
            generatedPurchaseOrder: fmt(autoPo.toObject()),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// ============================================================================
// 4. GOODS RECEIVED NOTES (GRN) & QUALITY INSPECTION
// ============================================================================

// GET /api/v1/procurement/grn - List Goods Received Notes
procurementRouter.get('/grn', authenticateToken, async (_req: Request, res: Response) => {
    try {
        const grns = await GoodsReceivedNoteModel.find().sort({ createdAt: -1 }).lean();
        return res.json({ count: grns.length, grnList: grns.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/procurement/grn - Issue Goods Received Note (Quality Inspection Verification)
procurementRouter.post('/grn', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    const { poNumber, supplierName, itemsReceived, qualityStatus, remarks } = req.body;

    if (!poNumber || !supplierName || !Array.isArray(itemsReceived) || itemsReceived.length === 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'PO number, supplier name, and itemsReceived list are required.' });
    }

    try {
        const grnNo = `GRN-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        const user = (req as any).user;

        const grn = await GoodsReceivedNoteModel.create({
            grnNo,
            poNumber,
            supplierName,
            dateReceived: new Date().toISOString().split('T')[0],
            receivedBy: user?.fullName || user?.email || 'Store Receiver',
            itemsReceived: itemsReceived.map((i: any) => ({
                description: i.description || 'Item',
                expectedQty: Number(i.expectedQty || 1),
                receivedQty: Number(i.receivedQty || 1),
                condition: i.condition || 'SATISFACTORY',
            })),
            qualityStatus: qualityStatus || 'PASSED',
            remarks: remarks || 'Physical delivery inspected and verified against PO requirements.',
            inspectedBy: user?.fullName || 'Quality Inspector',
        });

        // Link delivery to PO & update status to DELIVERED if passed
        const matchingPo = await PurchaseOrderModel.findOne({ poNumber });
        if (matchingPo && (qualityStatus === 'PASSED' || qualityStatus === 'PARTIAL_ACCEPTANCE')) {
            matchingPo.status = 'DELIVERED';
            await matchingPo.save();
        }

        return res.status(201).json({
            message: `Goods Received Note ${grnNo} created with quality verification status [${qualityStatus || 'PASSED'}].`,
            grn: fmt(grn.toObject()),
            updatedPoStatus: matchingPo ? matchingPo.status : undefined,
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// ============================================================================
// 5. AUTOMATED BANK STATEMENT RECONCILIATION
// ============================================================================

// GET /api/v1/procurement/reconciliations - List Reconciliation Reports
procurementRouter.get('/reconciliations', authenticateToken, async (_req: Request, res: Response) => {
    try {
        const recs = await BankReconciliationModel.find().sort({ createdAt: -1 }).lean();
        return res.json({ count: recs.length, reconciliations: recs.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/procurement/reconciliation/reconcile-csv - Process CSV / Electronic Bank Statement Upload & Auto-Match
procurementRouter.post('/reconciliation/reconcile-csv', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
    const { bankName, accountNumber, statementDate, statementBalanceGHS, bankTransactions, notes } = req.body;
    // bankTransactions = [{ refNo, description, amountGHS, date }]

    if (!bankName || !accountNumber || statementBalanceGHS === undefined || !Array.isArray(bankTransactions)) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'bankName, accountNumber, statementBalanceGHS, and bankTransactions[] are required.' });
    }

    try {
        const stmtBal = Number(statementBalanceGHS);

        // Fetch Cashbook Entries from Journal Entries
        const journalEntries = await JournalEntryModel.find().lean();
        const cashbookTotal = journalEntries.reduce((acc, j) => acc + (j.amountGHS || 0), 0);

        // Automated matching algorithm
        const matchedDetails: any[] = [];
        let matchedCount = 0;
        let unmatchedCount = 0;

        for (const bTxn of bankTransactions) {
            const bAmount = Number(bTxn.amountGHS || bTxn.amount || 0);
            const bRef = bTxn.refNo || bTxn.reference || '';

            // Find matching journal entry by exact amount or reference
            const match = journalEntries.find(j =>
                Math.abs(j.amountGHS - bAmount) < 0.01 || (bRef && j.entryNo.includes(bRef))
            );

            if (match) {
                matchedCount++;
                matchedDetails.push({
                    cashbookEntryNo: match.entryNo,
                    bankRef: bRef || 'BNK-MATCHED',
                    description: bTxn.description || match.description,
                    amountGHS: bAmount,
                    matched: true,
                });
            } else {
                unmatchedCount++;
                matchedDetails.push({
                    cashbookEntryNo: 'UNMATCHED',
                    bankRef: bRef || 'BNK-UNMATCHED',
                    description: bTxn.description || 'Bank Electronic Transaction',
                    amountGHS: bAmount,
                    matched: false,
                });
            }
        }

        const unreconciledDifferenceGHS = Math.abs(stmtBal - cashbookTotal);
        const status = unreconciledDifferenceGHS < 0.01 ? 'RECONCILED' : 'DISCREPANCY';
        const reconciliationNo = `REC-2026-${Math.floor(1000 + Math.random() * 9000)}`;

        const rec = await BankReconciliationModel.create({
            reconciliationNo,
            statementDate: statementDate || new Date().toISOString().split('T')[0],
            bankName,
            accountNumber,
            systemBalanceGHS: cashbookTotal,
            statementBalanceGHS: stmtBal,
            unreconciledDifferenceGHS,
            matchedEntriesCount: matchedCount,
            unmatchedEntriesCount: unmatchedCount,
            status,
            notes: notes || `Auto-matched ${matchedCount} entries. ${unmatchedCount} unmatched.`,
            uploadedBy: (req as any).user?.fullName || 'Accountant',
            matchedDetails,
        });

        return res.status(201).json({
            message: `Bank statement processed. Reconciled Status: [${status}] with ${matchedCount} matched transactions and GHS ${unreconciledDifferenceGHS.toFixed(2)} variance.`,
            reconciliation: fmt(rec.toObject()),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
