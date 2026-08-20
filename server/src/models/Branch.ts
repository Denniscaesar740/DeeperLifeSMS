import mongoose, { Schema, Document } from 'mongoose';

export interface IBranch extends Document {
    code: string;
    name: string;
    region: string;
    district?: string;
    city: string;
    address: string;
    phone: string;
    email: string;
    principalName: string;
    studentCapacity: number;
    activeStudents: number;
    activeStaff: number;
    status: string;
}

const BranchSchema: Schema = new Schema(
    {
        code: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        region: { type: String, required: true },
        district: { type: String, default: 'Municipal' },
        city: { type: String, default: 'Accra' },
        address: { type: String, default: '' },
        phone: { type: String, default: '' },
        email: { type: String, required: true },
        principalName: { type: String, default: 'Unassigned' },
        studentCapacity: { type: Number, default: 500 },
        activeStudents: { type: Number, default: 0 },
        activeStaff: { type: Number, default: 0 },
        status: { type: String, default: 'ACTIVE' },
    },
    { timestamps: true }
);

export const BranchModel = mongoose.models.Branch || mongoose.model<IBranch>('Branch', BranchSchema);
