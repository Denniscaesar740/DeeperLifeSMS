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
    photoUrl: { type: String, default: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150' },
    status: { type: String, default: 'SUBMITTED' },
    interviewDate: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });
export const AdmissionModel = mongoose.models.Admission || mongoose.model('Admission', AdmissionSchema);
