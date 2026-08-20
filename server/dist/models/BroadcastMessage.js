import mongoose, { Schema } from 'mongoose';
const BroadcastMessageSchema = new Schema({
    channel: { type: String, required: true, enum: ['SMS', 'EMAIL', 'WHATSAPP'] },
    recipientGroup: { type: String, required: true },
    branchId: { type: String, default: 'br-accra' },
    subject: { type: String, default: '' },
    content: { type: String, required: true },
    isEmergency: { type: Boolean, default: false },
    recipientsCount: { type: Number, default: 0 },
    totalCostGHS: { type: Number, default: 0 },
    status: { type: String, default: 'QUEUED' },
}, { timestamps: true });
export const BroadcastMessageModel = mongoose.models.BroadcastMessage || mongoose.model('BroadcastMessage', BroadcastMessageSchema);
