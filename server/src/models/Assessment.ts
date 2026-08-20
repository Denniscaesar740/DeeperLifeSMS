import mongoose, { Schema, Document } from 'mongoose';

export interface IAssessment extends Document {
    studentId: string;
    studentName?: string;
    subject: string;
    term: string;
    academicYear: string;
    classScore: number;
    examScore: number;
    totalScore: number;
    grade: string;
    remarks?: string;
    recordedBy: string;
}

const AssessmentSchema: Schema = new Schema(
    {
        studentId: { type: String, required: true },
        studentName: { type: String, default: '' },
        subject: { type: String, required: true },
        term: { type: String, default: 'Term 3' },
        academicYear: { type: String, default: '2026' },
        classScore: { type: Number, required: true },
        examScore: { type: Number, required: true },
        totalScore: { type: Number, required: true },
        grade: { type: String, required: true },
        remarks: { type: String, default: '' },
        recordedBy: { type: String, required: true },
    },
    { timestamps: true }
);

export const AssessmentModel = mongoose.models.Assessment || mongoose.model<IAssessment>('Assessment', AssessmentSchema);
