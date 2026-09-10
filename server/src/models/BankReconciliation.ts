import mongoose, { Schema, Document } from 'mongoose';

export interface IMatchedReconciliationEntry {
    cashbookEntryNo: string;
    bankRef: string;
    description: string;
    amountGHS: number;
    matched: boolean;
}

export interface IBankReconciliation extends Document {
    reconciliationNo: string;
    statementDate: string;
    bankName: string;
    accountNumber: string;
    systemBalanceGHS: number;
    statementBalanceGHS: number;
    unreconciledDifferenceGHS: number;
    matchedEntriesCount: number;
    unmatchedEntriesCount: number;
    status: 'RECONCILED' | 'DISCREPANCY' | 'PENDING';
    notes: string;
    uploadedBy: string;
    matchedDetails: IMatchedReconciliationEntry[];
}

const BankReconciliationSchema: Schema = new Schema(
    {
        reconciliationNo: { type: String, required: true, unique: true },
        statementDate: { type: String, required: true },
        bankName: { type: String, required: true },
        accountNumber: { type: String, required: true },
        systemBalanceGHS: { type: Number, required: true },
        statementBalanceGHS: { type: Number, required: true },
        unreconciledDifferenceGHS: { type: Number, required: true },
        matchedEntriesCount: { type: Number, default: 0 },
        unmatchedEntriesCount: { type: Number, default: 0 },
        status: { type: String, enum: ['RECONCILED', 'DISCREPANCY', 'PENDING'], default: 'PENDING' },
        notes: { type: String, default: '' },
        uploadedBy: { type: String, default: 'Accountant' },
        matchedDetails: [
            {
                cashbookEntryNo: { type: String, default: '' },
                bankRef: { type: String, default: '' },
                description: { type: String, default: '' },
                amountGHS: { type: Number, required: true },
                matched: { type: Boolean, default: true },
            },
        ],
    },
    { timestamps: true }
);

export const BankReconciliationModel =
    mongoose.models.BankReconciliation || mongoose.model<IBankReconciliation>('BankReconciliation', BankReconciliationSchema);
