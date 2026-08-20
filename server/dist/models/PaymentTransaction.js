import mongoose, { Schema } from 'mongoose';
const PaymentTransactionSchema = new Schema({
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
}, { timestamps: true });
export const PaymentTransactionModel = mongoose.models.PaymentTransaction || mongoose.model('PaymentTransaction', PaymentTransactionSchema);
