import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { AttendanceModel } from '../models/Attendance.js';
import { StudentModel } from '../models/Student.js';

export const attendanceRouter = Router();

function fmt(doc: any) {
    if (!doc) return doc;
    const obj = doc.toJSON ? doc.toJSON() : { ...doc };
    obj.id = obj._id?.toString() || obj.id;
    return obj;
}

// GET /api/v1/attendance — fetch attendance records (filter by date, level, branchId)
attendanceRouter.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.date) filter.date = req.query.date;
        if (req.query.level) filter.level = req.query.level;
        if (req.query.classStream) filter.classStream = req.query.classStream;
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;
        if (req.query.studentId) filter.studentId = req.query.studentId;
        if (req.query.status) filter.status = req.query.status;

        const records = await AttendanceModel.find(filter).sort({ createdAt: -1 }).limit(500).lean();
        return res.json({ count: records.length, records: records.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET /api/v1/attendance/class-list — get students for roll call by level/class
attendanceRouter.get('/class-list', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = { status: 'ACTIVE' };
        if (req.query.level) filter.level = req.query.level;
        if (req.query.classStream) filter.classStream = req.query.classStream;
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;

        const students = await StudentModel.find(filter).select('fullName level classStream branchId admissionNo parentPhone parentName').sort({ fullName: 1 }).lean();
        return res.json({ count: students.length, students: students.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/attendance/bulk — submit daily roll call for entire class
attendanceRouter.post('/bulk', authenticateToken, async (req: Request, res: Response) => {
    const { date, records, markedBy } = req.body;
    // records = [{ studentId, studentName, level, classStream, branchId, status, remarks }]
    if (!date || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'date and records[] are required.' });
    }

    try {
        const ops = records.map((r: any) => ({
            updateOne: {
                filter: { studentId: r.studentId, date },
                update: {
                    $set: {
                        studentName: r.studentName || '',
                        level: r.level || '',
                        classStream: r.classStream || '',
                        branchId: r.branchId || '',
                        status: r.status || 'PRESENT',
                        markedBy: markedBy || '',
                        remarks: r.remarks || '',
                        parentNotified: r.status === 'ABSENT',
                        notificationMethod: r.status === 'ABSENT' ? 'SMS' : '',
                    },
                },
                upsert: true,
            },
        }));

        const result = await AttendanceModel.bulkWrite(ops);

        // Count absences for notification summary
        const absentees = records.filter((r: any) => r.status === 'ABSENT');
        const absentCount = absentees.length;

        return res.json({
            message: `Roll call submitted. ${records.length} students marked.`,
            totalMarked: records.length,
            present: records.filter((r: any) => r.status === 'PRESENT').length,
            late: records.filter((r: any) => r.status === 'LATE').length,
            absent: absentCount,
            parentNotifications: absentCount,
            upserted: result.upsertedCount,
            modified: result.modifiedCount,
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET /api/v1/attendance/summary — daily/weekly statistics
attendanceRouter.get('/summary', authenticateToken, async (req: Request, res: Response) => {
    try {
        const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
        const filter: any = { date };
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;

        const records = await AttendanceModel.find(filter).lean();
        const total = records.length;
        const present = records.filter(r => r.status === 'PRESENT').length;
        const late = records.filter(r => r.status === 'LATE').length;
        const absent = records.filter(r => r.status === 'ABSENT').length;

        return res.json({
            date,
            total,
            present,
            late,
            absent,
            attendanceRate: total ? ((present + late) / total * 100).toFixed(1) : '0',
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET /api/v1/attendance/student/:studentId — individual student attendance history
attendanceRouter.get('/student/:studentId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const records = await AttendanceModel.find({ studentId: req.params.studentId }).sort({ date: -1 }).lean();
        const total = records.length;
        const present = records.filter(r => r.status === 'PRESENT').length;
        const late = records.filter(r => r.status === 'LATE').length;
        const absent = records.filter(r => r.status === 'ABSENT').length;

        return res.json({
            studentId: req.params.studentId,
            totalDays: total,
            present,
            late,
            absent,
            attendanceRate: total ? ((present + late) / total * 100).toFixed(1) : '0',
            records: records.map(fmt),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
