import mongoose, { Schema, Document } from 'mongoose';

export interface IPasswordReset extends Document {
    email: string;
    otpCode: string;
    expiresAt: Date;
    used: boolean;
    attempts: number;
}

const PasswordResetSchema: Schema = new Schema(
    {
        email: { type: String, required: true },
        otpCode: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        used: { type: Boolean, default: false },
        attempts: { type: Number, default: 0 },
    },
    { timestamps: true }
);

PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetModel = mongoose.models.PasswordReset || mongoose.model<IPasswordReset>('PasswordReset', PasswordResetSchema);
