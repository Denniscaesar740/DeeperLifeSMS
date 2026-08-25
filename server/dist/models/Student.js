import mongoose, { Schema } from 'mongoose';
const StudentSchema = new Schema({
    admissionNo: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    gender: { type: String, default: 'Male' },
    dateOfBirth: { type: Date, default: Date.now },
    level: { type: String, required: true },
    classStream: { type: String, default: 'Gold' },
    branchId: { type: String, required: true },
    branchName: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    status: { type: String, default: 'ACTIVE' },
    guardianName: { type: String, required: true },
    guardianPhone: { type: String, required: true },
    guardianEmail: { type: String, default: '' },
    admissionDate: { type: Date, default: Date.now },
}, { timestamps: true, strict: false, minimize: false });
export const StudentModel = mongoose.models.Student || mongoose.model('Student', StudentSchema);
