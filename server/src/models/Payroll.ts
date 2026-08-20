import mongoose, { Schema, Document } from 'mongoose';

export interface IPayroll extends Document {
    payrollNo: string;
    staffId: string;
    staffName: string;
    monthYear: string;
    basicSalaryGHS: number;
    allowancesGHS: number;
    grossSalaryGHS: number;
    ssnitEmployeeGHS: number;
    ssnitEmployerGHS: number;
    graTaxPayeGHS: number;
    totalDeductionsGHS: number;
    netSalaryGHS: number;
    status: string;
}

const PayrollSchema: Schema = new Schema(
    {
        payrollNo: { type: String, required: true, unique: true },
        staffId: { type: String, required: true },
        staffName: { type: String, default: '' },
        monthYear: { type: String, required: true },
        basicSalaryGHS: { type: Number, required: true },
        allowancesGHS: { type: Number, default: 0 },
        grossSalaryGHS: { type: Number, required: true },
        ssnitEmployeeGHS: { type: Number, required: true },
        ssnitEmployerGHS: { type: Number, required: true },
        graTaxPayeGHS: { type: Number, required: true },
        totalDeductionsGHS: { type: Number, required: true },
        netSalaryGHS: { type: Number, required: true },
        status: { type: String, default: 'PAID' },
    },
    { timestamps: true }
);

export const PayrollModel = mongoose.models.Payroll || mongoose.model<IPayroll>('Payroll', PayrollSchema);
