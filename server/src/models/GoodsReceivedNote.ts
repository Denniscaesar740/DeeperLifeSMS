import mongoose, { Schema, Document } from 'mongoose';

export interface IGRNItem {
    description: string;
    expectedQty: number;
    receivedQty: number;
    condition: 'SATISFACTORY' | 'DAMAGED' | 'DEFECTIVE';
}

export interface IGoodsReceivedNote extends Document {
    grnNo: string;
    poId?: string;
    poNumber: string;
    supplierName: string;
    dateReceived: string;
    receivedBy: string;
    itemsReceived: IGRNItem[];
    qualityStatus: 'PASSED' | 'FAILED' | 'PARTIAL_ACCEPTANCE';
    remarks: string;
    inspectedBy: string;
}

const GoodsReceivedNoteSchema: Schema = new Schema(
    {
        grnNo: { type: String, required: true, unique: true },
        poId: { type: String, default: '' },
        poNumber: { type: String, required: true },
        supplierName: { type: String, required: true },
        dateReceived: { type: String, required: true },
        receivedBy: { type: String, required: true },
        itemsReceived: [
            {
                description: { type: String, required: true },
                expectedQty: { type: Number, required: true },
                receivedQty: { type: Number, required: true },
                condition: { type: String, enum: ['SATISFACTORY', 'DAMAGED', 'DEFECTIVE'], default: 'SATISFACTORY' },
            },
        ],
        qualityStatus: {
            type: String,
            enum: ['PASSED', 'FAILED', 'PARTIAL_ACCEPTANCE'],
            default: 'PASSED',
        },
        remarks: { type: String, default: '' },
        inspectedBy: { type: String, default: 'Quality Control Inspector' },
    },
    { timestamps: true }
);

export const GoodsReceivedNoteModel =
    mongoose.models.GoodsReceivedNote || mongoose.model<IGoodsReceivedNote>('GoodsReceivedNote', GoodsReceivedNoteSchema);
