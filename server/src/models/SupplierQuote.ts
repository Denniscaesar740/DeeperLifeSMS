import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplierQuote extends Document {
    rfqNumber: string;
    supplierName: string;
    itemDescription: string;
    quantity: number;
    unitPriceGHS: number;
    totalPriceGHS: number;
    deliveryDays: number;
    validUntil: string;
    status: 'PENDING' | 'SELECTED' | 'REJECTED';
    submittedBy: string;
    notes?: string;
}

const SupplierQuoteSchema: Schema = new Schema(
    {
        rfqNumber: { type: String, default: 'RFQ-GENERAL' },
        supplierName: { type: String, required: true },
        itemDescription: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPriceGHS: { type: Number, required: true },
        totalPriceGHS: { type: Number, required: true },
        deliveryDays: { type: Number, default: 7 },
        validUntil: { type: String, required: true },
        status: { type: String, enum: ['PENDING', 'SELECTED', 'REJECTED'], default: 'PENDING' },
        submittedBy: { type: String, default: 'Procurement Desk' },
        notes: { type: String, default: '' },
    },
    { timestamps: true }
);

export const SupplierQuoteModel =
    mongoose.models.SupplierQuote || mongoose.model<ISupplierQuote>('SupplierQuote', SupplierQuoteSchema);
