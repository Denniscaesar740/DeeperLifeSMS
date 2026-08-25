import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    email: string;
    username?: string;
    passwordHash: string;
    fullName: string;
    role: string;
    phone?: string;
    avatarUrl?: string;
    branchId?: string;
    twoFactorEnabled: boolean;
    isActive: boolean;
}

const UserSchema: Schema = new Schema(
    {
        email: { type: String, required: true, unique: true },
        username: { type: String, sparse: true },
        passwordHash: { type: String, default: '' },
        fullName: { type: String, required: true },
        role: { type: String, required: true, enum: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'HEADTEACHER', 'ACCOUNTANT', 'CASHIER', 'ADMISSIONS_OFFICER', 'TEACHER', 'PARENT', 'STUDENT', 'AUDITOR'] },
        phone: { type: String, default: '' },
        avatarUrl: { type: String, default: '' },
        branchId: { type: String, default: 'br-accra' },
        twoFactorEnabled: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
