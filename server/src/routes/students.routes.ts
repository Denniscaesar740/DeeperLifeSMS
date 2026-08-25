import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { StudentModel } from '../models/Student.js';
import { BranchModel } from '../models/Branch.js';
import { uploadPassportToCloudinary } from '../lib/cloudinary.js';

export const studentsRouter = Router();

// Helper: format Mongoose doc with string id
function fmt(doc: any) {
    if (!doc) return doc;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    const pName = obj.parentName || obj.guardianName || '';
    const pPhone = obj.parentPhone || obj.guardianPhone || '';
    const pEmail = obj.parentEmail || obj.guardianEmail || '';
    return {
        ...obj,
        id: obj._id?.toString() || obj.admissionNo || obj.id,
        photoUrl: obj.photoUrl || '',
        admissionDate: obj.admissionDate ? new Date(obj.admissionDate).toISOString().split('T')[0] : (obj.createdAt ? new Date(obj.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
        parentName: pName,
        parentPhone: pPhone,
        parentEmail: pEmail,
        guardianName: pName,
        guardianPhone: pPhone,
        guardianEmail: pEmail,
    };
}

// GET /api/v1/students - List all students
studentsRouter.get('/', authenticateToken, async (req: Request, res: Response) => {
    const { branchId, level } = req.query;
    try {
        const query: any = {};
        if (branchId && branchId !== 'ALL') query.branchId = branchId;
        if (level && level !== 'ALL') query.level = level;

        const dbStudents = await StudentModel.find(query).sort({ createdAt: -1 }).lean();
        const formatted = dbStudents.map(fmt);
        return res.json({ count: formatted.length, students: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST /api/v1/students - Create new student profile
studentsRouter.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    const {
        fullName,
        gender,
        level,
        classStream,
        branchId,
        parentName,
        guardianName,
        parentPhone,
        guardianPhone,
        parentEmail,
        guardianEmail,
        dateOfBirth,
        photoUrl,
    } = req.body;

    const finalParentName = parentName || guardianName || 'Guardian';
    const finalParentPhone = parentPhone || guardianPhone;
    const finalParentEmail = parentEmail || guardianEmail || '';

    if (!fullName || !level || !branchId || !finalParentPhone) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing required student fields (fullName, level, branchId, parentPhone).' });
    }

    let finalPhotoUrl = photoUrl || '';
    if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image/')) {
        try {
            const uploadRes = await uploadPassportToCloudinary(finalPhotoUrl);
            finalPhotoUrl = uploadRes.url;
        } catch (uploadErr) {
            console.error('Failed to upload base64 student photo to Cloudinary:', uploadErr);
        }
    }

    try {
        const admissionNo = `DLS-2026-${Math.floor(100 + Math.random() * 900)}`;
        let branchName = 'Accra Central Campus (Dansoman)';
        try {
            const branch = await BranchModel.findOne({ $or: [{ code: branchId }, { _id: branchId.match(/^[0-9a-fA-F]{24}$/) ? branchId : null }] }).lean();
            if (branch) branchName = branch.name;
        } catch { }

        const newStudent = await StudentModel.create({
            admissionNo,
            fullName,
            gender: gender || 'Male',
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('2014-01-01'),
            level,
            classStream: classStream || 'Gold',
            branchId,
            branchName,
            photoUrl: finalPhotoUrl,
            guardianName: finalParentName,
            guardianPhone: finalParentPhone,
            guardianEmail: finalParentEmail,
            status: 'ACTIVE',
        });
        return res.status(201).json({ message: 'Student registered successfully.', student: fmt(newStudent) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET /api/v1/students/:id - Get single student profile
studentsRouter.get('/:id', authenticateToken, async (req: Request, res: Response) => {
    const studentId = String(req.params.id);
    try {
        const student = await StudentModel.findOne({
            $or: [{ _id: studentId.match(/^[0-9a-fA-F]{24}$/) ? studentId : null }, { admissionNo: studentId }]
        }).lean();
        if (!student) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Student profile not found.' });
        }
        return res.json({ student: fmt(student) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// PUT /api/v1/students/:id - Update student details
studentsRouter.put('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    const studentId = String(req.params.id);
    const updateData = { ...req.body };

    if (updateData.photoUrl && updateData.photoUrl.startsWith('data:image/')) {
        try {
            const uploadRes = await uploadPassportToCloudinary(updateData.photoUrl);
            updateData.photoUrl = uploadRes.url;
        } catch (uploadErr) {
            console.error('Failed to upload updated base64 student photo to Cloudinary:', uploadErr);
        }
    }

    try {
        const updated = await StudentModel.findOneAndUpdate(
            { $or: [{ _id: studentId.match(/^[0-9a-fA-F]{24}$/) ? studentId : null }, { admissionNo: studentId }] },
            updateData,
            { returnDocument: 'after' }
        ).lean();
        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Student profile not found.' });
        }
        return res.json({ message: 'Student profile updated successfully.', student: fmt(updated) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// DELETE /api/v1/students/:id - Archive or soft delete student profile
studentsRouter.delete('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req: Request, res: Response) => {
    const studentId = String(req.params.id);
    try {
        const updated = await StudentModel.findOneAndUpdate(
            { $or: [{ _id: studentId.match(/^[0-9a-fA-F]{24}$/) ? studentId : null }, { admissionNo: studentId }] },
            { status: 'WITHDRAWN' },
            { returnDocument: 'after' }
        ).lean();
        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Student not found.' });
        }
        return res.json({ message: 'Student profile archived successfully.', student: fmt(updated) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
