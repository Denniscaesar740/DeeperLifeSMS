import mongoose, { Schema } from 'mongoose';
const BranchSchema = new Schema({
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
}, { timestamps: true });
export const BranchModel = mongoose.models.Branch || mongoose.model('Branch', BranchSchema);
