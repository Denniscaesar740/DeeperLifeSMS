import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmission extends Document {
    applicationNo: string;
    applicantName: string;
    gender: string;
    dateOfBirth: Date;
    applyingLevel: string;
    targetBranchId: string;
    parentName: string;
    parentPhone: string;
    parentEmail: string;
    photoUrl?: string;
    status: string;
    interviewDate?: Date;
    submittedAt: Date;
}

const AdmissionSchema: Schema = new Schema(
    {
        applicationNo: { type: String, required: true, unique: true },
        applicantName: { type: String, required: true },
        gender: { type: String, default: 'Male' },
        dateOfBirth: { type: Date, default: Date.now },
        applyingLevel: { type: String, required: true },
        targetBranchId: { type: String, required: true },
        parentName: { type: String, required: true },
        parentPhone: { type: String, required: true },
        parentEmail: { type: String, default: '' },
        photoUrl: { type: String, default: '' },
        status: { type: String, default: 'SUBMITTED' },
        interviewDate: { type: Date, default: null },
        submittedAt: { type: Date, default: Date.now },
    },
    { timestamps: true, strict: false, minimize: false }
);

export const AdmissionModel = mongoose.models.Admission || mongoose.model<IAdmission>('Admission', AdmissionSchema);
