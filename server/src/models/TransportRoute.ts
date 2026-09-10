import mongoose, { Schema, Document } from 'mongoose';

export interface ITransportRoute extends Document {
    routeName: string;
    vehicleNo: string;
    vehicleType: string;
    driverName: string;
    driverPhone: string;
    driverLicense: string;
    assistantName?: string;
    assistantPhone?: string;
    assignedStudents: number;
    maxCapacity: number;
    feePerTermGHS: number;
    branchId: string;
    stops: string[];           // list of bus stop names
    departureTime: string;     // e.g. "06:00 AM"
    returnTime: string;        // e.g. "04:30 PM"
    status: string;
}

const TransportRouteSchema: Schema = new Schema(
    {
        routeName: { type: String, required: true },
        vehicleNo: { type: String, required: true },
        vehicleType: { type: String, default: 'Mini Bus' },
        driverName: { type: String, required: true },
        driverPhone: { type: String, required: true },
        driverLicense: { type: String, default: '' },
        assistantName: { type: String, default: '' },
        assistantPhone: { type: String, default: '' },
        assignedStudents: { type: Number, default: 0 },
        maxCapacity: { type: Number, default: 30 },
        feePerTermGHS: { type: Number, default: 0 },
        branchId: { type: String, default: '' },
        stops: [{ type: String }],
        departureTime: { type: String, default: '06:00 AM' },
        returnTime: { type: String, default: '04:30 PM' },
        status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'], default: 'ACTIVE' },
    },
    { timestamps: true }
);

export const TransportRouteModel = mongoose.models.TransportRoute || mongoose.model<ITransportRoute>('TransportRoute', TransportRouteSchema);
