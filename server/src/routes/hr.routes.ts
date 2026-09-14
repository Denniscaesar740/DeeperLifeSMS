import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { StaffModel } from '../models/Staff.js';
import { PayrollModel } from '../models/Payroll.js';
import { StaffLeaveModel } from '../models/StaffLeave.js';
import { StaffAttendanceModel } from '../models/StaffAttendance.js';
import { StaffAppraisalModel } from '../models/StaffAppraisal.js';

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

// ═══════════════════════════════════════════════════════════════════
// STAFF LEAVE REQUEST & MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

// GET /api/v1/hr/leave — List leave requests (filter by status, staffId, branchId)
hrRouter.get('/leave', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.staffId) filter.staffId = req.query.staffId;
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;
        if (req.query.leaveType) filter.leaveType = req.query.leaveType;

        const leaves = await StaffLeaveModel.find(filter).sort({ createdAt: -1 }).limit(500).lean();
        const formatted = leaves.map((d: any) => ({ ...d, id: d._id?.toString() }));
        return res.json({ count: formatted.length, leaveRequests: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/hr/leave — Create a new leave request
hrRouter.post('/leave', authenticateToken, async (req: Request, res: Response) => {
    const { staffId, staffName, staffNo, department, branchId, branchName, leaveType, startDate, endDate, totalDays, reason, contactDuringLeave, reliefStaffName } = req.body;

    if (!staffId || !staffName || !leaveType || !startDate || !endDate) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'staffId, staffName, leaveType, startDate, and endDate are required.' });
    }

    try {
        const leaveNo = `LV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = totalDays || Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        const created = await StaffLeaveModel.create({
            leaveNo,
            staffId,
            staffName,
            staffNo: staffNo || '',
            department: department || '',
            branchId: branchId || '',
            branchName: branchName || '',
            leaveType,
            startDate,
            endDate,
            totalDays: days,
            reason: reason || '',
            contactDuringLeave: contactDuringLeave || '',
            reliefStaffName: reliefStaffName || '',
            status: 'PENDING',
            dateSubmitted: new Date().toISOString().split('T')[0],
        });

        return res.status(201).json({
            message: 'Leave request submitted successfully.',
            leaveRequest: { ...created.toObject(), id: created._id?.toString() },
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// PATCH /api/v1/hr/leave/:id/approve — Approve or reject a leave request
hrRouter.patch('/leave/:id/approve', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'HEADTEACHER', 'HR_MANAGER'), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { action, comment, approvedBy } = req.body; // action: 'APPROVE' | 'REJECT'

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'action must be APPROVE or REJECT.' });
    }

    try {
        const leave = await StaffLeaveModel.findById(id);
        if (!leave) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Leave request not found.' });
        }

        leave.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        leave.approvedBy = approvedBy || (req as any).user?.fullName || 'Admin';
        leave.approverComment = comment || '';
        leave.approvedDate = new Date().toISOString().split('T')[0];
        await leave.save();

        // If approved, update staff status to ON_LEAVE
        if (action === 'APPROVE' && leave.staffId) {
            await StaffModel.findByIdAndUpdate(leave.staffId, { status: 'ON_LEAVE' }).catch(() => { });
        }

        return res.json({
            message: `Leave request ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
            leaveRequest: { ...leave.toObject(), id: leave._id?.toString() },
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// DELETE /api/v1/hr/leave/:id — Cancel / delete a leave request
hrRouter.delete('/leave/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const deleted = await StaffLeaveModel.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'NOT_FOUND', message: 'Leave request not found.' });
        return res.json({ message: 'Leave request cancelled and removed.' });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// STAFF ATTENDANCE TRACKING
// ═══════════════════════════════════════════════════════════════════

// GET /api/v1/hr/staff-attendance — List staff attendance records
hrRouter.get('/staff-attendance', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.date) filter.date = req.query.date;
        if (req.query.staffId) filter.staffId = req.query.staffId;
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;
        if (req.query.status) filter.status = req.query.status;

        const records = await StaffAttendanceModel.find(filter).sort({ createdAt: -1 }).limit(500).lean();
        const formatted = records.map((d: any) => ({ ...d, id: d._id?.toString() }));
        return res.json({ count: formatted.length, records: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/hr/staff-attendance/bulk — Bulk mark staff attendance for a day
hrRouter.post('/staff-attendance/bulk', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'HEADTEACHER', 'HR_MANAGER'), async (req: Request, res: Response) => {
    const { date, records, markedBy } = req.body;
    if (!date || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'date and records[] are required.' });
    }

    try {
        const ops = records.map((r: any) => ({
            updateOne: {
                filter: { staffId: r.staffId, date },
                update: {
                    $set: {
                        staffName: r.staffName || '',
                        staffNo: r.staffNo || '',
                        department: r.department || '',
                        branchId: r.branchId || '',
                        branchName: r.branchName || '',
                        clockInTime: r.clockInTime || '',
                        clockOutTime: r.clockOutTime || '',
                        status: r.status || 'PRESENT',
                        hoursWorked: r.hoursWorked || 0,
                        markedBy: markedBy || 'Admin',
                        remarks: r.remarks || '',
                    },
                },
                upsert: true,
            },
        }));

        const result = await StaffAttendanceModel.bulkWrite(ops);
        const present = records.filter((r: any) => r.status === 'PRESENT').length;
        const late = records.filter((r: any) => r.status === 'LATE').length;
        const absent = records.filter((r: any) => r.status === 'ABSENT').length;
        const onLeave = records.filter((r: any) => r.status === 'ON_LEAVE').length;

        return res.json({
            message: `Staff attendance marked for ${date}. ${records.length} staff recorded.`,
            totalMarked: records.length,
            present,
            late,
            absent,
            onLeave,
            upserted: result.upsertedCount,
            modified: result.modifiedCount,
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/hr/staff-attendance/clock-in — Individual staff clock-in
hrRouter.post('/staff-attendance/clock-in', authenticateToken, async (req: Request, res: Response) => {
    const { staffId, staffName, staffNo, department, branchId, branchName } = req.body;
    if (!staffId || !staffName) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'staffId and staffName are required.' });
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const expectedTime = '07:30';
        const isLate = now > '08:00';

        const record = await StaffAttendanceModel.findOneAndUpdate(
            { staffId, date: today },
            {
                $set: {
                    staffName,
                    staffNo: staffNo || '',
                    department: department || '',
                    branchId: branchId || '',
                    branchName: branchName || '',
                    clockInTime: now,
                    status: isLate ? 'LATE' : 'PRESENT',
                    markedBy: 'SELF',
                },
            },
            { upsert: true, new: true }
        );

        return res.json({
            message: `Clock-in recorded at ${now}${isLate ? ' (LATE)' : ''}.`,
            record: { ...record.toObject(), id: record._id?.toString() },
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/hr/staff-attendance/clock-out — Individual staff clock-out
hrRouter.post('/staff-attendance/clock-out', authenticateToken, async (req: Request, res: Response) => {
    const { staffId } = req.body;
    if (!staffId) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'staffId is required.' });
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        const record = await StaffAttendanceModel.findOne({ staffId, date: today });
        if (!record) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'No clock-in record found for today. Please clock in first.' });
        }

        // Calculate hours worked
        let hoursWorked = 0;
        if (record.clockInTime) {
            const [inH, inM] = record.clockInTime.split(':').map(Number);
            const [outH, outM] = now.split(':').map(Number);
            hoursWorked = Math.max(0, Number(((outH * 60 + outM - inH * 60 - inM) / 60).toFixed(1)));
        }

        record.clockOutTime = now;
        record.hoursWorked = hoursWorked;
        if (hoursWorked > 0 && hoursWorked < 4) {
            record.status = 'HALF_DAY';
        }
        await record.save();

        return res.json({
            message: `Clock-out recorded at ${now}. Hours worked: ${hoursWorked}h.`,
            record: { ...record.toObject(), id: record._id?.toString() },
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET /api/v1/hr/staff-attendance/summary — Attendance statistics for a date
hrRouter.get('/staff-attendance/summary', authenticateToken, async (req: Request, res: Response) => {
    try {
        const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
        const filter: any = { date };
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;

        const records = await StaffAttendanceModel.find(filter).lean();
        const totalStaff = await StaffModel.countDocuments({ status: { $in: ['ACTIVE', 'ON_LEAVE'] } });
        const present = records.filter(r => r.status === 'PRESENT').length;
        const late = records.filter(r => r.status === 'LATE').length;
        const absent = totalStaff - records.length;
        const onLeave = records.filter(r => r.status === 'ON_LEAVE').length;
        const halfDay = records.filter(r => r.status === 'HALF_DAY').length;
        const avgHours = records.length > 0 ? Number((records.reduce((a, r) => a + (r.hoursWorked || 0), 0) / records.length).toFixed(1)) : 0;

        return res.json({
            date,
            totalStaff,
            recorded: records.length,
            present,
            late,
            absent: Math.max(0, absent),
            onLeave,
            halfDay,
            attendanceRate: totalStaff ? (((present + late) / totalStaff) * 100).toFixed(1) : '0',
            avgHoursWorked: avgHours,
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// STAFF PERFORMANCE APPRAISALS
// ═══════════════════════════════════════════════════════════════════

// GET /api/v1/hr/appraisals — List appraisals
hrRouter.get('/appraisals', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.staffId) filter.staffId = req.query.staffId;
        if (req.query.status) filter.status = req.query.status;
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;
        if (req.query.reviewPeriod) filter.reviewPeriod = req.query.reviewPeriod;

        const appraisals = await StaffAppraisalModel.find(filter).sort({ createdAt: -1 }).limit(200).lean();
        const formatted = appraisals.map((d: any) => ({ ...d, id: d._id?.toString() }));
        return res.json({ count: formatted.length, appraisals: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/hr/appraisals — Create / Submit an appraisal
hrRouter.post('/appraisals', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'HEADTEACHER', 'HR_MANAGER'), async (req: Request, res: Response) => {
    const {
        staffId, staffName, staffNo, jobTitle, department, branchId, branchName,
        reviewPeriod, evaluatorName, evaluatorRole,
        teachingScore, punctualityScore, teamworkScore, professionalDevelopmentScore, studentEngagementScore,
        overallRating, keyAchievements, areasForImprovement, developmentPlan, staffComments, status
    } = req.body;

    if (!staffId || !staffName || !reviewPeriod || !evaluatorName) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'staffId, staffName, reviewPeriod, and evaluatorName are required.' });
    }

    try {
        const appraisalNo = `APR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

        const created = await StaffAppraisalModel.create({
            appraisalNo,
            staffId,
            staffName,
            staffNo: staffNo || '',
            jobTitle: jobTitle || '',
            department: department || '',
            branchId: branchId || '',
            branchName: branchName || '',
            reviewPeriod,
            evaluatorName,
            evaluatorRole: evaluatorRole || '',
            teachingScore: teachingScore || 3,
            punctualityScore: punctualityScore || 3,
            teamworkScore: teamworkScore || 3,
            professionalDevelopmentScore: professionalDevelopmentScore || 3,
            studentEngagementScore: studentEngagementScore || 3,
            overallRating: overallRating || 'SATISFACTORY',
            keyAchievements: keyAchievements || '',
            areasForImprovement: areasForImprovement || '',
            developmentPlan: developmentPlan || '',
            staffComments: staffComments || '',
            status: status || 'SUBMITTED',
            dateEvaluated: new Date().toISOString().split('T')[0],
        });

        return res.status(201).json({
            message: 'Appraisal submitted successfully.',
            appraisal: { ...created.toObject(), id: created._id?.toString() },
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// PATCH /api/v1/hr/appraisals/:id — Update appraisal status (acknowledge, approve)
hrRouter.patch('/appraisals/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const updated = await StaffAppraisalModel.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
        if (!updated) return res.status(404).json({ error: 'NOT_FOUND', message: 'Appraisal not found.' });
        return res.json({ message: 'Appraisal updated.', appraisal: { ...updated, id: (updated as any)._id?.toString() } });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
