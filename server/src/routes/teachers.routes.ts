import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { UserModel } from '../models/User.js';
import { TimetableSlotModel } from '../models/TimetableSlot.js';

export const teachersRouter = Router();

function fmt(doc: any) {
    if (!doc) return doc;
    return { ...doc, id: doc._id?.toString() };
}

// GET /api/v1/teachers - List all active teachers
teachersRouter.get('/', authenticateToken, async (_req: Request, res: Response) => {
    try {
        const teachers = await UserModel.find({ role: 'TEACHER', isActive: true }).lean();
        const formatted = teachers.map(fmt);
        return res.json({ count: formatted.length, teachers: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/teachers - Register new teacher staff profile
teachersRouter.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    const { email, username, fullName, name, phone, branchId, branch } = req.body;
    const finalEmail = email || (username ? (username.includes('@') ? username : `${username}@dlschools.edu.gh`) : '');
    const finalName = fullName || name;
    const finalBranchId = branchId || branch || 'br-accra';

    if (!finalEmail || !finalName || !finalBranchId) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Email, fullName, and branchId are required.' });
    }

    try {
        const newTeacher = await UserModel.create({
            email: finalEmail,
            passwordHash: '',
            fullName: finalName,
            role: 'TEACHER',
            phone: phone || '',
            branchId: finalBranchId,
            twoFactorEnabled: false,
            isActive: true,
        });
        return res.status(201).json({ message: 'Teacher registered successfully.', teacher: fmt(newTeacher) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET /api/v1/teachers/timetable - Get Class or Teacher Timetable
teachersRouter.get('/timetable', authenticateToken, async (req: Request, res: Response) => {
    const { classStream, day } = req.query;
    try {
        const query: any = {};
        if (classStream) query.classStream = classStream;
        if (day) query.dayOfWeek = day;

        const slots = await TimetableSlotModel.find(query).lean();
        const formatted = slots.map(fmt);
        return res.json({ count: formatted.length, timetable: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/teachers/timetable - Assign Timetable Slot WITH conflict detection
teachersRouter.post('/timetable', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    const { classStream, dayOfWeek, period, subject, teacherName, room, startTime, endTime, branchId } = req.body;

    if (!classStream || !subject || !period) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing timetable parameters.' });
    }

    const day = dayOfWeek || 'Monday';
    const teacher = teacherName || 'Staff';
    const slotRoom = room || 'Main Classroom';

    try {
        // 1. Check class double-booking (same class, same day, same period)
        const classConflict = await TimetableSlotModel.findOne({ classStream, dayOfWeek: day, period }).lean();
        if (classConflict) {
            return res.status(409).json({
                error: 'CLASS_CONFLICT',
                message: `${classStream} already has "${classConflict.subject}" with ${classConflict.teacherName} during Period ${period} on ${day}.`,
                conflict: fmt(classConflict),
            });
        }

        // 2. Check teacher double-booking (same teacher, same day, same period, different class)
        const teacherConflict = await TimetableSlotModel.findOne({ teacherName: teacher, dayOfWeek: day, period }).lean();
        if (teacherConflict) {
            return res.status(409).json({
                error: 'TEACHER_CONFLICT',
                message: `${teacher} is already teaching "${teacherConflict.subject}" in ${teacherConflict.classStream} during Period ${period} on ${day}.`,
                conflict: fmt(teacherConflict),
            });
        }

        // 3. Check room double-booking (same room, same day, same period)
        if (slotRoom && slotRoom !== 'Main Classroom') {
            const roomConflict = await TimetableSlotModel.findOne({ room: slotRoom, dayOfWeek: day, period }).lean();
            if (roomConflict) {
                return res.status(409).json({
                    error: 'ROOM_CONFLICT',
                    message: `Room "${slotRoom}" is already booked for "${roomConflict.subject}" (${roomConflict.classStream}) during Period ${period} on ${day}.`,
                    conflict: fmt(roomConflict),
                });
            }
        }

        const slot = await TimetableSlotModel.create({
            classStream, dayOfWeek: day, period, subject,
            teacherName: teacher, room: slotRoom,
            startTime: startTime || '', endTime: endTime || '',
            branchId: branchId || '',
        });
        return res.status(201).json({ message: 'Timetable period allocated successfully.', slot: fmt(slot.toObject()) });
    } catch (err: any) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'DUPLICATE', message: 'This slot is already assigned. Delete it first to reassign.' });
        }
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// DELETE /api/v1/teachers/timetable/:id - Remove timetable slot
teachersRouter.delete('/timetable/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    try {
        await TimetableSlotModel.findByIdAndDelete(req.params.id);
        return res.json({ message: 'Timetable slot removed.' });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/teachers/timetable/auto-schedule - Bulk auto-schedule a class week
teachersRouter.post('/timetable/auto-schedule', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    const { classStream, branchId, slots } = req.body;
    // slots = [{ dayOfWeek, period, subject, teacherName, room, startTime, endTime }]
    if (!classStream || !Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'classStream and slots[] are required.' });
    }

    const conflicts: any[] = [];
    const created: any[] = [];

    for (const s of slots) {
        const day = s.dayOfWeek || 'Monday';
        const period = s.period;

        // Check all 3 conflict types
        const classConflict = await TimetableSlotModel.findOne({ classStream, dayOfWeek: day, period }).lean();
        if (classConflict) { conflicts.push({ type: 'CLASS', ...s, existing: fmt(classConflict) }); continue; }

        const teacherConflict = await TimetableSlotModel.findOne({ teacherName: s.teacherName, dayOfWeek: day, period }).lean();
        if (teacherConflict) { conflicts.push({ type: 'TEACHER', ...s, existing: fmt(teacherConflict) }); continue; }

        if (s.room && s.room !== 'Main Classroom') {
            const roomConflict = await TimetableSlotModel.findOne({ room: s.room, dayOfWeek: day, period }).lean();
            if (roomConflict) { conflicts.push({ type: 'ROOM', ...s, existing: fmt(roomConflict) }); continue; }
        }

        try {
            const slot = await TimetableSlotModel.create({
                classStream, dayOfWeek: day, period, subject: s.subject,
                teacherName: s.teacherName || 'Staff', room: s.room || 'Main Classroom',
                startTime: s.startTime || '', endTime: s.endTime || '',
                branchId: branchId || '',
            });
            created.push(fmt(slot.toObject()));
        } catch (e: any) {
            conflicts.push({ type: 'DB_ERROR', ...s, error: e.message });
        }
    }

    return res.json({
        message: `Auto-schedule complete. ${created.length} slots created, ${conflicts.length} conflicts detected.`,
        created: created.length,
        conflicts: conflicts.length,
        conflictDetails: conflicts,
        slots: created,
    });
});

