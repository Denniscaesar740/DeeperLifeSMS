import mongoose, { Schema } from 'mongoose';
const TimetableSlotSchema = new Schema({
    classStream: { type: String, required: true },
    dayOfWeek: { type: String, required: true },
    period: { type: String, required: true },
    subject: { type: String, required: true },
    teacherName: { type: String, required: true },
    room: { type: String, default: 'Classroom' },
}, { timestamps: true });
export const TimetableSlotModel = mongoose.models.TimetableSlot || mongoose.model('TimetableSlot', TimetableSlotSchema);
