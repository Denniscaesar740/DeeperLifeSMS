import mongoose, { Schema } from 'mongoose';
const ChartOfAccountSchema = new Schema({
    accountCode: { type: String, required: true, unique: true },
    accountName: { type: String, required: true },
    accountType: { type: String, required: true, enum: ['ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE', 'EQUITY'] },
    category: { type: String, required: true },
    balanceGHS: { type: Number, default: 0 },
}, { timestamps: true });
export const ChartOfAccountModel = mongoose.models.ChartOfAccount || mongoose.model('ChartOfAccount', ChartOfAccountSchema);
