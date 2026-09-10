import mongoose, { Schema, Document } from 'mongoose';

export interface ITimetableSlot extends Document {
    classStream: string;
    dayOfWeek: string;
    period: string;
    startTime: string;
    endTime: string;
    subject: string;
    teacherName: string;
    room: string;
    branchId: string;
}

const TimetableSlotSchema: Schema = new Schema(
    {
        classStream: { type: String, required: true },
        dayOfWeek: { type: String, required: true },
        period: { type: String, required: true },
        startTime: { type: String, default: '' },
        endTime: { type: String, default: '' },
        subject: { type: String, required: true },
        teacherName: { type: String, required: true },
        room: { type: String, default: 'Classroom' },
        branchId: { type: String, default: '' },
    },
    { timestamps: true }
);

// Prevent double-booking: same class, same day, same period
TimetableSlotSchema.index({ classStream: 1, dayOfWeek: 1, period: 1 }, { unique: true });

export const TimetableSlotModel = mongoose.models.TimetableSlot || mongoose.model<ITimetableSlot>('TimetableSlot', TimetableSlotSchema);

