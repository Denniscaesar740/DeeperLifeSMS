import mongoose, { Schema, Document } from 'mongoose';

export interface IStaff extends Document {
    staffNo: string;
    fullName: string;
    gender: string;
    phone: string;
    email: string;
    jobTitle: string;
    department: string;
    branchId: string;
    branchName?: string;
    employmentType: string;
    salaryGHS: number;
    classesAssigned?: string[];
    subjectsAssigned?: string[];
    status: string;
}

const StaffSchema: Schema = new Schema(
    {
        staffNo: { type: String, required: true, unique: true },
        fullName: { type: String, required: true },
        gender: { type: String, default: 'Male' },
        phone: { type: String, default: '' },
        email: { type: String, required: true },
        jobTitle: { type: String, default: 'Teacher' },
        department: { type: String, default: 'Academics' },
        branchId: { type: String, required: true },
        branchName: { type: String, default: '' },
        employmentType: { type: String, default: 'Full-Time' },
        salaryGHS: { type: Number, default: 4500 },
        classesAssigned: { type: [String], default: [] },
        subjectsAssigned: { type: [String], default: [] },
        status: { type: String, default: 'ACTIVE' },
    },
    { timestamps: true }
);

export const StaffModel = mongoose.models.Staff || mongoose.model<IStaff>('Staff', StaffSchema);

