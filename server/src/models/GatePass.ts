import mongoose, { Schema, Document } from 'mongoose';

export interface IGatePass extends Document {
    badgeNo: string;
    visitorName: string;
    visitorPhone: string;
    visitorIdType: string;     // National ID | Passport | Voter ID | Driver License
    visitorIdNumber: string;
    purpose: string;           // Parent Pickup | Meeting | Delivery | Maintenance | Other
    destination: string;       // e.g. "Principal Office", "Primary 4 Block"
    personToSee: string;
    branchId: string;
    entryTime: string;
    exitTime?: string;
    vehiclePlate?: string;
    issuedBy: string;          // security guard name
    approvedBy?: string;
    studentPickedUp?: string;  // if parent pickup
    status: string;            // CHECKED_IN | CHECKED_OUT | DENIED | EXPIRED
}

const GatePassSchema: Schema = new Schema(
    {
        badgeNo: { type: String, required: true },
        visitorName: { type: String, required: true },
        visitorPhone: { type: String, default: '' },
        visitorIdType: { type: String, default: 'National ID' },
        visitorIdNumber: { type: String, default: '' },
        purpose: { type: String, required: true },
        destination: { type: String, required: true },
        personToSee: { type: String, default: '' },
        branchId: { type: String, default: '' },
        entryTime: { type: String, required: true },
        exitTime: { type: String, default: null },
        vehiclePlate: { type: String, default: '' },
        issuedBy: { type: String, required: true },
        approvedBy: { type: String, default: '' },
        studentPickedUp: { type: String, default: '' },
        status: { type: String, enum: ['CHECKED_IN', 'CHECKED_OUT', 'DENIED', 'EXPIRED'], default: 'CHECKED_IN' },
    },
    { timestamps: true }
);

export const GatePassModel = mongoose.models.GatePass || mongoose.model<IGatePass>('GatePass', GatePassSchema);
