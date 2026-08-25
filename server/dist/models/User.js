import mongoose, { Schema } from 'mongoose';
const UserSchema = new Schema({
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
}, { timestamps: true });
export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
