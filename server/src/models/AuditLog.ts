import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
    userEmail: string;
    userRole: string;
    action: string;
    module: string;
    details: string;
    ipAddress?: string;
    branchName?: string;
}

const AuditLogSchema: Schema = new Schema(
    {
        userEmail: { type: String, required: true },
        userRole: { type: String, required: true },
        action: { type: String, required: true },
        module: { type: String, required: true },
        details: { type: String, required: true },
        ipAddress: { type: String, default: '127.0.0.1' },
        branchName: { type: String, default: 'Accra Central Campus (Dansoman)' },
    },
    { timestamps: true }
);

export const AuditLogModel = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
