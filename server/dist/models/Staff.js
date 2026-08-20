import mongoose, { Schema } from 'mongoose';
const StaffSchema = new Schema({
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
}, { timestamps: true });
export const StaffModel = mongoose.models.Staff || mongoose.model('Staff', StaffSchema);
