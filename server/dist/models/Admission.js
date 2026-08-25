import mongoose, { Schema } from 'mongoose';
const AdmissionSchema = new Schema({
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
}, { timestamps: true, strict: false, minimize: false });
export const AdmissionModel = mongoose.models.Admission || mongoose.model('Admission', AdmissionSchema);
