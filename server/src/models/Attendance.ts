import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
    studentId: string;
    studentName: string;
    level: string;
    classStream: string;
    branchId: string;
    date: string;
    status: string;        // PRESENT | LATE | ABSENT
    markedBy: string;
    parentNotified: boolean;
    notificationMethod?: string;
    remarks?: string;
}

const AttendanceSchema: Schema = new Schema(
    {
        studentId: { type: String, required: true },
        studentName: { type: String, required: true },
        level: { type: String, default: '' },
        classStream: { type: String, default: '' },
        branchId: { type: String, default: '' },
        date: { type: String, required: true },
        status: { type: String, enum: ['PRESENT', 'LATE', 'ABSENT'], required: true },
        markedBy: { type: String, default: '' },
        parentNotified: { type: Boolean, default: false },
        notificationMethod: { type: String, default: '' },
        remarks: { type: String, default: '' },
    },
    { timestamps: true }
);

AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

export const AttendanceModel = mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);
