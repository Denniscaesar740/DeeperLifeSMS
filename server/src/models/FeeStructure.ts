import mongoose, { Schema, Document } from 'mongoose';

export interface IFeeStructureItem {
    id?: string;
    name: string;
    category: 'Tuition' | 'Facility' | 'Exam' | 'Transport' | 'Levy' | 'Other';
    amountGHS: number;
    isRequired: boolean;
}

export interface IFeeStructure extends Document {
    code: string;
    title: string;
    level: string;
    branchId: string;
    academicYear: string;
    term: string;
    items: IFeeStructureItem[];
    totalAmountGHS: number;
    status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
}

const FeeStructureItemSchema = new Schema({
    id: { type: String, default: () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` },
    name: { type: String, required: true },
    category: { type: String, default: 'Tuition' },
    amountGHS: { type: Number, required: true },
    isRequired: { type: Boolean, default: true }
});

const FeeStructureSchema: Schema = new Schema(
    {
        code: { type: String, required: true, unique: true },
        title: { type: String, required: true },
        level: { type: String, required: true },
        branchId: { type: String, default: 'br-accra' },
        academicYear: { type: String, default: '2025/2026' },
        term: { type: String, default: 'Term 3' },
        items: [FeeStructureItemSchema],
        totalAmountGHS: { type: Number, required: true },
        status: { type: String, default: 'ACTIVE' },
    },
    { timestamps: true }
);

export const FeeStructureModel = mongoose.models.FeeStructure || mongoose.model<IFeeStructure>('FeeStructure', FeeStructureSchema);
