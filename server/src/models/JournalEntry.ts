import mongoose, { Schema, Document } from 'mongoose';

export interface IJournalEntry extends Document {
    entryNo: string;
    date: Date;
    description: string;
    debitAccountCode: string;
    debitAccountName: string;
    creditAccountCode: string;
    creditAccountName: string;
    amountGHS: number;
    preparedBy: string;
    status: string;
}

const JournalEntrySchema: Schema = new Schema(
    {
        entryNo: { type: String, required: true, unique: true },
        date: { type: Date, default: Date.now },
        description: { type: String, required: true },
        debitAccountCode: { type: String, required: true },
        debitAccountName: { type: String, default: '' },
        creditAccountCode: { type: String, required: true },
        creditAccountName: { type: String, default: '' },
        amountGHS: { type: Number, required: true },
        preparedBy: { type: String, required: true },
        status: { type: String, default: 'POSTED' },
    },
    { timestamps: true }
);

export const JournalEntryModel = mongoose.models.JournalEntry || mongoose.model<IJournalEntry>('JournalEntry', JournalEntrySchema);
