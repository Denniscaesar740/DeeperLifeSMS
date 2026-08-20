import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { StaffModel } from '../models/Staff.js';
import { PayrollModel } from '../models/Payroll.js';

export const hrRouter = Router();

function fmt(doc: any) {
    if (!doc) return doc;
    return { ...doc, id: doc._id?.toString() || doc.staffNo };
}

// Ghana GRA PAYE Tax Calculation Engine (Section 27)
function calculateGhanaPayroll(basicSalaryGHS: number, allowancesGHS: number = 0) {
    const grossSalary = basicSalaryGHS + allowancesGHS;
    const ssnitEmployee = grossSalary * 0.055;
    const ssnitEmployer = grossSalary * 0.13;
    const taxableIncome = grossSalary - ssnitEmployee;

    let payeTax = 0;
    let tempIncome = taxableIncome;

    if (tempIncome > 490) {
        tempIncome -= 490;
        if (tempIncome > 110) { payeTax += 110 * 0.05; tempIncome -= 110; }
        else { payeTax += tempIncome * 0.05; tempIncome = 0; }
        if (tempIncome > 130) { payeTax += 130 * 0.10; tempIncome -= 130; }
        else { payeTax += tempIncome * 0.10; tempIncome = 0; }
        if (tempIncome > 3166.67) { payeTax += 3166.67 * 0.175; tempIncome -= 3166.67; }
        else { payeTax += tempIncome * 0.175; tempIncome = 0; }
        if (tempIncome > 0) { payeTax += tempIncome * 0.25; }
    }

    const totalDeductions = ssnitEmployee + payeTax;
    const netPay = grossSalary - totalDeductions;

    return {
        grossSalaryGHS: Number(grossSalary.toFixed(2)),
        ssnitEmployeeGHS: Number(ssnitEmployee.toFixed(2)),
        ssnitEmployerGHS: Number(ssnitEmployer.toFixed(2)),
        graTaxPayeGHS: Number(payeTax.toFixed(2)),
        totalDeductionsGHS: Number(totalDeductions.toFixed(2)),
        netSalaryGHS: Number(netPay.toFixed(2)),
    };
}

// 1. GET /api/v1/hr/staff - List all staff
hrRouter.get('/staff', authenticateToken, async (_req: Request, res: Response) => {
    try {
        let staff = await StaffModel.find().lean();
        if (staff.length === 0) {
            const initialStaff = [
                {
                    staffNo: 'DLS-STF-101',
                    fullName: 'Mr. Francis Boakye',
                    gender: 'Male',
                    phone: '+233 24 555 8899',
                    email: 'f.boakye@dlschools.edu.gh',
                    jobTitle: 'Senior Mathematics & ICT Teacher',
                    department: 'Mathematics & STEM',
                    branchId: 'br-accra',
                    branchName: 'Accra Central Campus (Dansoman)',
                    employmentType: 'Full-Time',
                    salaryGHS: 3800,
                    classesAssigned: ['JHS 1 Gold', 'JHS 2 Grace'],
                    subjectsAssigned: ['Mathematics', 'ICT'],
                    status: 'ACTIVE',
                },
                {
                    staffNo: 'DLS-STF-102',
                    fullName: 'Mrs. Deborah Adjei',
                    gender: 'Female',
                    phone: '+233 20 777 3322',
                    email: 'd.adjei@dlschools.edu.gh',
                    jobTitle: 'English & Integrated Science Lead',
                    department: 'Languages & Science',
                    branchId: 'br-accra',
                    branchName: 'Accra Central Campus (Dansoman)',
                    employmentType: 'Full-Time',
                    salaryGHS: 3600,
                    classesAssigned: ['JHS 1 Gold', 'Primary 5 Excellence'],
                    subjectsAssigned: ['English Language', 'Integrated Science'],
                    status: 'ACTIVE',
                },
                {
                    staffNo: 'DLS-STF-103',
                    fullName: 'Mr. Kwame Asante',
                    gender: 'Male',
                    phone: '+233 24 888 9900',
                    email: 'k.asante@dlschools.edu.gh',
                    jobTitle: 'Social Studies & RME Teacher',
                    department: 'Humanities & Social Studies',
                    branchId: 'br-kumasi',
                    branchName: 'Kumasi City Campus (Nhyiaeso)',
                    employmentType: 'Full-Time',
                    salaryGHS: 3200,
                    classesAssigned: ['JHS 1 Gold', 'JHS 2 Grace'],
                    subjectsAssigned: ['Social Studies', 'RME'],
                    status: 'ACTIVE',
                }
            ];
            await StaffModel.insertMany(initialStaff);
            staff = await StaffModel.find().lean();
        }
        const formatted = staff.map(fmt);
        return res.json({ count: formatted.length, staff: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// 2. POST /api/v1/hr/staff - Create / Onboard new staff member
hrRouter.post('/staff', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
    const {
        fullName,
        gender,
        phone,
        email,
        jobTitle,
        department,
        branchId,
        branchName,
        employmentType,
        salaryGHS,
        salary,
        classesAssigned,
        subjectsAssigned,
        status
    } = req.body;

    if (!fullName || !email) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Full name and email are required.' });
    }

    try {
        const staffNo = req.body.staffNo || `DLS-STF-${Math.floor(100 + Math.random() * 900)}`;
        const salaryVal = Number(salaryGHS || salary || 3500);

        const createdStaff = await StaffModel.create({
            staffNo,
            fullName,
            gender: gender || 'Male',
            phone: phone || '',
            email,
            jobTitle: jobTitle || 'Teacher',
            department: department || 'Academics',
            branchId: branchId || 'br-accra',
            branchName: branchName || 'Accra Central Campus (Dansoman)',
            employmentType: employmentType || 'Full-Time',
            salaryGHS: salaryVal,
            classesAssigned: Array.isArray(classesAssigned) ? classesAssigned : (typeof classesAssigned === 'string' ? classesAssigned.split(',').map(s => s.trim()) : []),
            subjectsAssigned: Array.isArray(subjectsAssigned) ? subjectsAssigned : (typeof subjectsAssigned === 'string' ? subjectsAssigned.split(',').map(s => s.trim()) : []),
            status: status || 'ACTIVE',
        });

        return res.status(201).json({
            message: 'Staff member onboarded successfully.',
            staff: fmt(createdStaff.toObject())
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// 3. PUT /api/v1/hr/staff/:id - Update existing staff member
hrRouter.put('/staff/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const updated = await StaffModel.findByIdAndUpdate(id, req.body, { new: true }).lean();
        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Staff member not found.' });
        }
        return res.json({ message: 'Staff member updated successfully.', staff: fmt(updated) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// 4. DELETE /api/v1/hr/staff/:id - Delete staff member
hrRouter.delete('/staff/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const deleted = await StaffModel.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Staff member not found.' });
        }
        return res.json({ message: 'Staff member removed successfully.' });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});


// 2. POST /api/v1/hr/payroll/calculate - Calculate Ghana PAYE Tax & Net Payslip
hrRouter.post('/payroll/calculate', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT'), (req: Request, res: Response) => {
    const { basicSalaryGHS, basicSalary, salary, allowancesGHS, allowances } = req.body;
    const salaryVal = Number(basicSalaryGHS || basicSalary || salary || 0);
    const allowancesVal = Number(allowancesGHS || allowances || 0);

    if (salaryVal <= 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Basic salary (GHS) is required.' });
    }
    const payroll = calculateGhanaPayroll(salaryVal, allowancesVal);
    return res.json({ message: 'Ghana GRA PAYE & SSNIT calculations executed.', payroll });
});

// 3. POST /api/v1/hr/payroll/run - Run Monthly Payroll Disbursement
hrRouter.post('/payroll/run', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
    const { monthYear } = req.body;
    try {
        const staffList = await StaffModel.find({ status: 'ACTIVE' }).lean();
        const payrollSummary = [];
        for (const stf of staffList) {
            const baseSalary = stf.salaryGHS || 4500.00;
            const pay = calculateGhanaPayroll(baseSalary);
            const payrollNo = `PAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

            const record = await PayrollModel.create({
                payrollNo,
                staffId: stf._id?.toString() || stf.staffNo,
                staffName: stf.fullName,
                monthYear: monthYear || 'August 2026',
                basicSalaryGHS: baseSalary,
                allowancesGHS: 0,
                ...pay,
                status: 'PAID',
            });
            payrollSummary.push(fmt(record.toObject()));
        }

        const totalNetPayout = payrollSummary.reduce((acc, p) => acc + p.netSalaryGHS, 0);

        return res.status(201).json({
            message: `Payroll run completed for ${monthYear || 'August 2026'}.`,
            totalStaffPaid: payrollSummary.length,
            totalNetPayoutGHS: totalNetPayout.toFixed(2),
            payrollSummary,
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
