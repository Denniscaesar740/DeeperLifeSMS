import mongoose, { Schema } from 'mongoose';
const PayrollSchema = new Schema({
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
}, { timestamps: true });
export const PayrollModel = mongoose.models.Payroll || mongoose.model('Payroll', PayrollSchema);
