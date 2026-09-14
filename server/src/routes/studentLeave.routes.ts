import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { StudentLeaveModel } from '../models/StudentLeave.js';
import { AttendanceModel } from '../models/Attendance.js';

export const studentLeaveRouter = Router();

function fmt(doc: any) {
    if (!doc) return doc;
    const obj = doc.toJSON ? doc.toJSON() : { ...doc };
    obj.id = obj._id?.toString() || obj.id;
    return obj;
}

// Generate date array between startDate and endDate inclusive (ISO format YYYY-MM-DD)
function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
    const dates: string[] = [];
    let curr = new Date(startDateStr);
    const end = new Date(endDateStr);

    while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

// GET /api/v1/student-leaves — List student leave applications
studentLeaveRouter.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.studentId) filter.studentId = req.query.studentId;
        if (req.query.classStream) filter.classStream = req.query.classStream;
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;
        if (req.query.status) filter.status = req.query.status;

        const leaves = await StudentLeaveModel.find(filter).sort({ createdAt: -1 }).limit(200).lean();
        return res.json({ count: leaves.length, leaves: leaves.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/student-leaves — Submit new student leave request
studentLeaveRouter.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
        const {
            studentId,
            studentName,
            admissionNo,
            classStream,
            level,
            branchId,
            parentName,
            parentPhone,
            reason,
            startDate,
            endDate,
            notes,
        } = req.body;

        if (!studentId || !studentName || !reason || !startDate || !endDate) {
            return res.status(400).json({ error: 'BAD_REQUEST', message: 'studentId, studentName, reason, startDate, endDate are required.' });
        }

        const dates = getDatesInRange(startDate, endDate);
        const leaveNo = `LEV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const leave = await StudentLeaveModel.create({
            leaveNo,
            studentId,
            studentName,
            admissionNo: admissionNo || '',
            classStream: classStream || '',
            level: level || '',
            branchId: branchId || '',
            parentName: parentName || '',
            parentPhone: parentPhone || '',
            reason,
            startDate,
            endDate,
            totalDays: dates.length,
            notes: notes || '',
            status: 'PENDING',
            dateSubmitted: new Date().toISOString().split('T')[0],
        });

        return res.status(201).json({
            message: 'Student leave request submitted successfully.',
            leave: fmt(leave),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// PATCH /api/v1/student-leaves/:id/status — Approve or reject student leave
// AUTOMATED REGISTER INTEGRATION: Pre-marks student as EXCUSED in Attendance register for leave dates
studentLeaveRouter.patch('/:id/status', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, approvedBy, approverRole } = req.body;

        if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
            return res.status(400).json({ error: 'BAD_REQUEST', message: 'Status must be APPROVED, REJECTED, or CANCELLED.' });
        }

        const leave = await StudentLeaveModel.findById(id);
        if (!leave) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Student leave request not found.' });
        }

        leave.status = status;
        leave.approvedBy = approvedBy || (req as any).user?.fullName || 'Teacher';
        leave.approverRole = approverRole || (req as any).user?.role || 'TEACHER';
        leave.approvedDate = new Date().toISOString().split('T')[0];
        await leave.save();

        let autoPreMarkedDates: string[] = [];

        // AUTOMATED ATTENDANCE PRE-MARKING ENGINE
        if (status === 'APPROVED') {
            const dates = getDatesInRange(leave.startDate, leave.endDate);
            autoPreMarkedDates = dates;

            const attendanceOps = dates.map((d: string) => ({
                updateOne: {
                    filter: { studentId: leave.studentId, date: d },
                    update: {
                        $set: {
                            studentName: leave.studentName,
                            level: leave.level,
                            classStream: leave.classStream,
                            branchId: leave.branchId,
                            status: 'EXCUSED',
                            markedBy: leave.approvedBy,
                            remarks: `Excused Absence (Leave ${leave.leaveNo}: ${leave.reason})`,
                            parentNotified: true,
                            notificationMethod: 'SYSTEM_LEAVE_APPROVAL',
                        },
                    },
                    upsert: true,
                },
            }));

            if (attendanceOps.length > 0) {
                await AttendanceModel.bulkWrite(attendanceOps);
            }
        }

        return res.json({
            message: status === 'APPROVED'
                ? `Student leave ${leave.leaveNo} APPROVED. Attendance register automatically pre-marked as EXCUSED for ${autoPreMarkedDates.length} date(s).`
                : `Student leave ${leave.leaveNo} updated to ${status}.`,
            leave: fmt(leave),
            autoPreMarkedDates,
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
