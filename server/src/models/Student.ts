import mongoose, { Schema, Document } from 'mongoose';

export interface IStudent extends Document {
    admissionNo: string;
    fullName: string;
    gender: string;
    dateOfBirth: Date;
    level: string;
    classStream: string;
    branchId: string;
    branchName?: string;
    status: string;
    guardianName: string;
    guardianPhone: string;
    guardianEmail?: string;
}

const StudentSchema: Schema = new Schema(
    {
        admissionNo: { type: String, required: true, unique: true },
        fullName: { type: String, required: true },
        gender: { type: String, default: 'Male' },
        dateOfBirth: { type: Date, default: Date.now },
        level: { type: String, required: true },
        classStream: { type: String, default: 'Gold' },
        branchId: { type: String, required: true },
        branchName: { type: String, default: '' },
        status: { type: String, default: 'ACTIVE' },
        guardianName: { type: String, required: true },
        guardianPhone: { type: String, required: true },
        guardianEmail: { type: String, default: '' },
    },
    { timestamps: true }
);

export const StudentModel = mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema);
