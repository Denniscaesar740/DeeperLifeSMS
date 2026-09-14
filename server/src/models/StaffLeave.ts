import mongoose, { Schema, Document } from 'mongoose';

export interface IStaffLeave extends Document {
    leaveNo: string;
    staffId: string;
    staffName: string;
    staffNo: string;
    department: string;
    branchId: string;
    branchName: string;
    leaveType: string; // Annual | Sick | Maternity | Paternity | Study | Casual | Compassionate | Unpaid
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string;
    contactDuringLeave: string;
    reliefStaffName: string;
    attachmentUrl: string;
    status: string; // PENDING | APPROVED | REJECTED | CANCELLED
    approvedBy: string;
    approverComment: string;
    approvedDate: string;
    dateSubmitted: string;
}

const StaffLeaveSchema: Schema = new Schema(
    {
        leaveNo: { type: String, required: true, unique: true },
        staffId: { type: String, required: true },
        staffName: { type: String, required: true },
        staffNo: { type: String, default: '' },
        department: { type: String, default: '' },
        branchId: { type: String, default: '' },
        branchName: { type: String, default: '' },
        leaveType: {
            type: String,
            enum: ['Annual', 'Sick', 'Maternity', 'Paternity', 'Study', 'Casual', 'Compassionate', 'Unpaid'],
            required: true,
        },
        startDate: { type: String, required: true },
        endDate: { type: String, required: true },
        totalDays: { type: Number, required: true },
        reason: { type: String, default: '' },
        contactDuringLeave: { type: String, default: '' },
        reliefStaffName: { type: String, default: '' },
        attachmentUrl: { type: String, default: '' },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
            default: 'PENDING',
        },
        approvedBy: { type: String, default: '' },
        approverComment: { type: String, default: '' },
        approvedDate: { type: String, default: '' },
        dateSubmitted: { type: String, default: () => new Date().toISOString().split('T')[0] },
    },
    { timestamps: true }
);

StaffLeaveSchema.index({ staffId: 1, status: 1 });
StaffLeaveSchema.index({ branchId: 1, status: 1 });

export const StaffLeaveModel = mongoose.models.StaffLeave || mongoose.model<IStaffLeave>('StaffLeave', StaffLeaveSchema);
