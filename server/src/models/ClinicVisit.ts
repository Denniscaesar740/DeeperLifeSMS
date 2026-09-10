import mongoose, { Schema, Document } from 'mongoose';

export interface IClinicVisit extends Document {
    studentId: string;
    studentName: string;
    studentLevel: string;
    branchId: string;
    visitDate: string;
    visitTime: string;
    complaint: string;
    diagnosis: string;
    treatmentGiven: string;
    prescription?: string;
    temperature?: string;
    bloodPressure?: string;
    weight?: string;
    allergiesNoted: string;
    nurseName: string;
    referredToHospital: boolean;
    hospitalName?: string;
    parentNotified: boolean;
    parentNotificationMethod?: string; // SMS | CALL | WHATSAPP
    followUpDate?: string;
    status: string;  // TREATED | REFERRED | FOLLOW_UP | CLOSED
}

const ClinicVisitSchema: Schema = new Schema(
    {
        studentId: { type: String, required: true },
        studentName: { type: String, required: true },
        studentLevel: { type: String, default: '' },
        branchId: { type: String, default: '' },
        visitDate: { type: String, required: true },
        visitTime: { type: String, default: '' },
        complaint: { type: String, required: true },
        diagnosis: { type: String, default: '' },
        treatmentGiven: { type: String, required: true },
        prescription: { type: String, default: '' },
        temperature: { type: String, default: '' },
        bloodPressure: { type: String, default: '' },
        weight: { type: String, default: '' },
        allergiesNoted: { type: String, default: 'None' },
        nurseName: { type: String, required: true },
        referredToHospital: { type: Boolean, default: false },
        hospitalName: { type: String, default: '' },
        parentNotified: { type: Boolean, default: false },
        parentNotificationMethod: { type: String, default: '' },
        followUpDate: { type: String, default: null },
        status: { type: String, enum: ['TREATED', 'REFERRED', 'FOLLOW_UP', 'CLOSED'], default: 'TREATED' },
    },
    { timestamps: true }
);

export const ClinicVisitModel = mongoose.models.ClinicVisit || mongoose.model<IClinicVisit>('ClinicVisit', ClinicVisitSchema);
