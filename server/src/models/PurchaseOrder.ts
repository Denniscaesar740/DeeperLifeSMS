import mongoose, { Schema, Document } from 'mongoose';

export interface IApprovalStep {
    role: string;
    approved: boolean;
    approvedBy?: string;
    date?: string;
    comment?: string;
}

export interface IPurchaseOrderItem {
    description: string;
    qty: number;
    unitPriceGHS: number;
    totalGHS: number;
}

export interface IPurchaseOrder extends Document {
    poNumber: string;
    branchName: string;
    branchId: string;
    supplierName: string;
    dateIssued: string;
    targetDeliveryDate: string;
    items: IPurchaseOrderItem[];
    grandTotalGHS: number;
    status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'DELIVERED' | 'CANCELLED';
    currentApprovalTier: 'ACCOUNTANT' | 'HEADTEACHER' | 'SUPER_ADMIN' | 'COMPLETED';
    approvalChain: IApprovalStep[];
    createdBy: string;
}

const PurchaseOrderSchema: Schema = new Schema(
    {
        poNumber: { type: String, required: true, unique: true },
        branchName: { type: String, default: 'Main Campus' },
        branchId: { type: String, default: 'br-accra' },
        supplierName: { type: String, required: true },
        dateIssued: { type: String, required: true },
        targetDeliveryDate: { type: String, required: true },
        items: [
            {
                description: { type: String, required: true },
                qty: { type: Number, required: true },
                unitPriceGHS: { type: Number, required: true },
                totalGHS: { type: Number, required: true },
            },
        ],
        grandTotalGHS: { type: Number, required: true },
        status: {
            type: String,
            enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ISSUED', 'DELIVERED', 'CANCELLED'],
            default: 'PENDING_APPROVAL',
        },
        currentApprovalTier: {
            type: String,
            enum: ['ACCOUNTANT', 'HEADTEACHER', 'SUPER_ADMIN', 'COMPLETED'],
            default: 'ACCOUNTANT',
        },
        approvalChain: [
            {
                role: { type: String, required: true },
                approved: { type: Boolean, default: false },
                approvedBy: { type: String, default: '' },
                date: { type: String, default: '' },
                comment: { type: String, default: '' },
            },
        ],
        createdBy: { type: String, default: 'Procurement Officer' },
    },
    { timestamps: true }
);

export const PurchaseOrderModel =
    mongoose.models.PurchaseOrder || mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
