import mongoose, { Schema } from 'mongoose';
const AuditLogSchema = new Schema({
    userEmail: { type: String, required: true },
    userRole: { type: String, required: true },
    action: { type: String, required: true },
    module: { type: String, required: true },
    details: { type: String, required: true },
    ipAddress: { type: String, default: '127.0.0.1' },
    branchName: { type: String, default: 'Accra Central Campus (Dansoman)' },
}, { timestamps: true });
export const AuditLogModel = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
