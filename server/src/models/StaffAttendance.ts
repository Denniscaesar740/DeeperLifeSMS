import mongoose, { Schema, Document } from 'mongoose';

export interface IStaffAttendance extends Document {
    staffId: string;
    staffName: string;
    staffNo: string;
    department: string;
    branchId: string;
    branchName: string;
    date: string;
    clockInTime: string;
    clockOutTime: string;
    status: string; // PRESENT | ABSENT | LATE | ON_LEAVE | HALF_DAY
    hoursWorked: number;
    markedBy: string;
    remarks: string;
}

const StaffAttendanceSchema: Schema = new Schema(
    {
        staffId: { type: String, required: true },
        staffName: { type: String, required: true },
        staffNo: { type: String, default: '' },
        department: { type: String, default: '' },
        branchId: { type: String, default: '' },
        branchName: { type: String, default: '' },
        date: { type: String, required: true },
        clockInTime: { type: String, default: '' },
        clockOutTime: { type: String, default: '' },
        status: {
            type: String,
            enum: ['PRESENT', 'ABSENT', 'LATE', 'ON_LEAVE', 'HALF_DAY'],
            default: 'PRESENT',
        },
        hoursWorked: { type: Number, default: 0 },
        markedBy: { type: String, default: 'SYSTEM' },
        remarks: { type: String, default: '' },
    },
    { timestamps: true }
);

StaffAttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });
StaffAttendanceSchema.index({ branchId: 1, date: 1 });

export const StaffAttendanceModel =
    mongoose.models.StaffAttendance || mongoose.model<IStaffAttendance>('StaffAttendance', StaffAttendanceSchema);
