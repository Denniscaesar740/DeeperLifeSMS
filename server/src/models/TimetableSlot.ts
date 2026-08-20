import mongoose, { Schema, Document } from 'mongoose';

export interface ITimetableSlot extends Document {
    classStream: string;
    dayOfWeek: string;
    period: string;
    subject: string;
    teacherName: string;
    room: string;
}

const TimetableSlotSchema: Schema = new Schema(
    {
        classStream: { type: String, required: true },
        dayOfWeek: { type: String, required: true },
        period: { type: String, required: true },
        subject: { type: String, required: true },
        teacherName: { type: String, required: true },
        room: { type: String, default: 'Classroom' },
    },
    { timestamps: true }
);

export const TimetableSlotModel = mongoose.models.TimetableSlot || mongoose.model<ITimetableSlot>('TimetableSlot', TimetableSlotSchema);
