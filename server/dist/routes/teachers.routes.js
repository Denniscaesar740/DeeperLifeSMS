import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { UserModel } from '../models/User.js';
import { TimetableSlotModel } from '../models/TimetableSlot.js';
export const teachersRouter = Router();
function fmt(doc) {
    if (!doc)
        return doc;
    return { ...doc, id: doc._id?.toString() };
}
// GET /api/v1/teachers - List all active teachers
teachersRouter.get('/', authenticateToken, async (_req, res) => {
    try {
        const teachers = await UserModel.find({ role: 'TEACHER', isActive: true }).lean();
        const formatted = teachers.map(fmt);
        return res.json({ count: formatted.length, teachers: formatted });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// POST /api/v1/teachers - Register new teacher staff profile
teachersRouter.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
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
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// GET /api/v1/teachers/timetable - Get Class or Teacher Timetable
teachersRouter.get('/timetable', authenticateToken, async (req, res) => {
    const { classStream, day } = req.query;
    try {
        const query = {};
        if (classStream)
            query.classStream = classStream;
        if (day)
            query.dayOfWeek = day;
        const slots = await TimetableSlotModel.find(query).lean();
        const formatted = slots.map(fmt);
        return res.json({ count: formatted.length, timetable: formatted });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// POST /api/v1/teachers/timetable - Assign Timetable Slot
teachersRouter.post('/timetable', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
    const { classStream, dayOfWeek, period, subject, teacherName, room } = req.body;
    if (!classStream || !subject || !period) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing timetable parameters.' });
    }
    try {
        const slot = await TimetableSlotModel.create({
            classStream,
            dayOfWeek: dayOfWeek || 'Monday',
            period,
            subject,
            teacherName: teacherName || 'Staff',
            room: room || 'Main Classroom',
        });
        return res.status(201).json({ message: 'Timetable period allocated successfully.', slot: fmt(slot.toObject()) });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
