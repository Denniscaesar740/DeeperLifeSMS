import mongoose, { Schema, Document } from 'mongoose';

export interface IStudentLeave extends Document {
    leaveNo: string;
    studentId: string;
    studentName: string;
    admissionNo: string;
    classStream: string;
    level: string;
    branchId: string;
    parentName: string;
    parentPhone: string;
    reason: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    notes?: string;
    status: string; // PENDING | APPROVED | REJECTED | CANCELLED
    approvedBy?: string;
    approverRole?: string;
    approvedDate?: string;
    dateSubmitted: string;
}

const StudentLeaveSchema: Schema = new Schema(
    {
        leaveNo: { type: String, required: true, unique: true },
        studentId: { type: String, required: true },
        studentName: { type: String, required: true },
        admissionNo: { type: String, default: '' },
        classStream: { type: String, default: '' },
        level: { type: String, default: '' },
        branchId: { type: String, default: '' },
        parentName: { type: String, default: '' },
        parentPhone: { type: String, default: '' },
        reason: { type: String, required: true },
        startDate: { type: String, required: true },
        endDate: { type: String, required: true },
        totalDays: { type: Number, default: 1 },
        notes: { type: String, default: '' },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
            default: 'PENDING',
        },
        approvedBy: { type: String, default: '' },
        approverRole: { type: String, default: '' },
        approvedDate: { type: String, default: '' },
        dateSubmitted: { type: String, default: () => new Date().toISOString().split('T')[0] },
    },
    { timestamps: true }
);

StudentLeaveSchema.index({ studentId: 1, status: 1 });
StudentLeaveSchema.index({ branchId: 1, classStream: 1 });

export const StudentLeaveModel = mongoose.models.StudentLeave || mongoose.model<IStudentLeave>('StudentLeave', StudentLeaveSchema);
