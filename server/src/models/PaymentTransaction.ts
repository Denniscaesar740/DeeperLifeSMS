import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentTransaction extends Document {
    referenceNo: string;
    invoiceId: string;
    amountGHS: number;
    paymentChannel: string;
    providerRef?: string;
    payerName: string;
    payerPhone: string;
    status: string;
    signatureVerified: boolean;
    rawWebhookPayload?: string;
}

const PaymentTransactionSchema: Schema = new Schema(
    {
        referenceNo: { type: String, required: true, unique: true },
        invoiceId: { type: String, required: true },
        amountGHS: { type: Number, required: true },
        paymentChannel: { type: String, default: 'MTN_MOMO' },
        providerRef: { type: String, default: '' },
        payerName: { type: String, required: true },
        payerPhone: { type: String, required: true },
        status: { type: String, default: 'PENDING' },
        signatureVerified: { type: Boolean, default: false },
        rawWebhookPayload: { type: String, default: '' },
    },
    { timestamps: true }
);

export const PaymentTransactionModel = mongoose.models.PaymentTransaction || mongoose.model<IPaymentTransaction>('PaymentTransaction', PaymentTransactionSchema);
