import mongoose, { Schema } from 'mongoose';
const JournalEntrySchema = new Schema({
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
}, { timestamps: true });
export const JournalEntryModel = mongoose.models.JournalEntry || mongoose.model('JournalEntry', JournalEntrySchema);
