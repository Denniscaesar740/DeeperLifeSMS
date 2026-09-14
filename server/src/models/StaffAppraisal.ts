import mongoose, { Schema, Document } from 'mongoose';

export interface IStaffAppraisal extends Document {
    appraisalNo: string;
    staffId: string;
    staffName: string;
    staffNo: string;
    jobTitle: string;
    department: string;
    branchId: string;
    branchName: string;
    reviewPeriod: string;
    evaluatorName: string;
    evaluatorRole: string;
    teachingScore: number;
    punctualityScore: number;
    teamworkScore: number;
    professionalDevelopmentScore: number;
    studentEngagementScore: number;
    overallRating: string; // EXCELLENT | VERY_GOOD | SATISFACTORY | NEEDS_IMPROVEMENT | UNSATISFACTORY
    keyAchievements: string;
    areasForImprovement: string;
    developmentPlan: string;
    staffComments: string;
    status: string; // DRAFT | SUBMITTED | APPROVED | ACKNOWLEDGED
    dateEvaluated: string;
}

const StaffAppraisalSchema: Schema = new Schema(
    {
        appraisalNo: { type: String, required: true, unique: true },
        staffId: { type: String, required: true },
        staffName: { type: String, required: true },
        staffNo: { type: String, default: '' },
        jobTitle: { type: String, default: '' },
        department: { type: String, default: '' },
        branchId: { type: String, default: '' },
        branchName: { type: String, default: '' },
        reviewPeriod: { type: String, required: true },
        evaluatorName: { type: String, required: true },
        evaluatorRole: { type: String, default: '' },
        teachingScore: { type: Number, min: 1, max: 5, default: 3 },
        punctualityScore: { type: Number, min: 1, max: 5, default: 3 },
        teamworkScore: { type: Number, min: 1, max: 5, default: 3 },
        professionalDevelopmentScore: { type: Number, min: 1, max: 5, default: 3 },
        studentEngagementScore: { type: Number, min: 1, max: 5, default: 3 },
        overallRating: {
            type: String,
            enum: ['EXCELLENT', 'VERY_GOOD', 'SATISFACTORY', 'NEEDS_IMPROVEMENT', 'UNSATISFACTORY'],
            default: 'SATISFACTORY',
        },
        keyAchievements: { type: String, default: '' },
        areasForImprovement: { type: String, default: '' },
        developmentPlan: { type: String, default: '' },
        staffComments: { type: String, default: '' },
        status: {
            type: String,
            enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACKNOWLEDGED'],
            default: 'DRAFT',
        },
        dateEvaluated: { type: String, default: () => new Date().toISOString().split('T')[0] },
    },
    { timestamps: true }
);

StaffAppraisalSchema.index({ staffId: 1, reviewPeriod: 1 });

export const StaffAppraisalModel =
    mongoose.models.StaffAppraisal || mongoose.model<IStaffAppraisal>('StaffAppraisal', StaffAppraisalSchema);
