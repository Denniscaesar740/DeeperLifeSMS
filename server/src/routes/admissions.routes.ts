import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { AdmissionModel } from '../models/Admission.js';
import { StudentModel } from '../models/Student.js';
import { BranchModel } from '../models/Branch.js';
import { FeeInvoiceModel } from '../models/FeeInvoice.js';
import { UserModel } from '../models/User.js';
import { hashPassword } from '../utils/security.js';
import { uploadPassportToCloudinary } from '../lib/cloudinary.js';

export const admissionsRouter = Router();

function fmt(doc: any) {
    if (!doc) return doc;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return {
        ...obj,
        id: obj._id?.toString() || obj.applicationNo,
        intendedLevel: obj.applyingLevel || obj.intendedLevel || obj.level || '',
        branchId: obj.targetBranchId || obj.branchId || 'br-accra',
        photoUrl: obj.photoUrl || '',
        dateSubmitted: obj.submittedAt ? new Date(obj.submittedAt).toISOString().split('T')[0] : (obj.createdAt ? new Date(obj.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
    };
}

// GET /api/v1/admissions - List all admission applications
admissionsRouter.get('/', authenticateToken, async (_req: Request, res: Response) => {
    try {
        const apps = await AdmissionModel.find().sort({ createdAt: -1 }).lean();
        const formatted = apps.map(fmt);
        return res.json({ count: formatted.length, applications: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// Handler function for new admission submission
const handleNewSubmission = async (req: Request, res: Response) => {
    const {
        applicantName,
        gender,
        dateOfBirth,
        applyingLevel,
        intendedLevel,
        level,
        targetBranchId,
        branchId,
        parentName,
        parentPhone,
        parentEmail,
        photoUrl
    } = req.body;

    const finalLevel = applyingLevel || intendedLevel || level;
    const finalBranchId = targetBranchId || branchId || 'br-accra';

    let finalPhotoUrl = photoUrl ? String(photoUrl).trim() : '';

    if (!applicantName || !finalLevel || !parentPhone || !finalPhotoUrl) {
        return res.status(400).json({
            error: 'BAD_REQUEST',
            message: 'Applicant name, level, parent phone, and student passport photo (photoUrl) are required for admission application.'
        });
    }
    if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image/')) {
        try {
            const uploadRes = await uploadPassportToCloudinary(finalPhotoUrl);
            finalPhotoUrl = uploadRes.url;
        } catch (uploadErr) {
            console.error('Failed to upload base64 photo to Cloudinary in admissions submission:', uploadErr);
        }
    }

    try {
        const applicationNo = `ADM-2026-${Math.floor(100 + Math.random() * 900)}`;
        const newApplication = await AdmissionModel.create({
            applicationNo,
            applicantName,
            gender: gender || 'Male',
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('2016-01-01'),
            applyingLevel: finalLevel,
            targetBranchId: finalBranchId,
            parentName: parentName || 'Parent',
            parentPhone,
            parentEmail: parentEmail || '',
            photoUrl: finalPhotoUrl,
            status: 'SUBMITTED',
            interviewDate: null,
            submittedAt: new Date(),
        });
        return res.status(201).json({
            message: 'Admission application submitted successfully.',
            applicationNo,
            application: fmt(newApplication),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
};

admissionsRouter.post('/submit', handleNewSubmission);
admissionsRouter.post('/', handleNewSubmission);

// Approve Application Handler - Automatically Adds Student, Invoice, & Parent User
const handleApprove = async (req: Request, res: Response) => {
    const generatedAdmissionNo = `DLS-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const id = String(req.params.id);
    const { applicantName: bodyApplicantName, parentPhone: bodyParentPhone } = req.body || {};

    try {
        let updated = await AdmissionModel.findOneAndUpdate(
            {
                $or: [
                    { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
                    { applicationNo: id },
                    { applicationNo: new RegExp(id.replace(/^DLS-/, ''), 'i') }
                ]
            },
            { status: 'APPROVED' },
            { returnDocument: 'after' }
        ).lean();

        // Fallback: If not found by ID or applicationNo, check by body fields or applicant details
        if (!updated && (bodyApplicantName || bodyParentPhone)) {
            updated = await AdmissionModel.findOneAndUpdate(
                {
                    $or: [
                        { applicantName: bodyApplicantName },
                        { parentPhone: bodyParentPhone }
                    ]
                },
                { status: 'APPROVED' },
                { returnDocument: 'after' }
            ).lean();
        }

        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found.' });
        }

        // Automatic creation of Student record in database
        const applicantName = updated.applicantName || bodyApplicantName || 'Admitted Student';
        const gender = updated.gender || 'Male';
        const dateOfBirth = updated.dateOfBirth ? new Date(updated.dateOfBirth) : new Date('2016-01-01');
        const level = updated.applyingLevel || updated.intendedLevel || updated.level || 'Primary 1';
        const branchId = updated.targetBranchId || updated.branchId || 'br-accra';
        const parentName = updated.parentName || 'Guardian';
        const parentPhone = updated.parentPhone || bodyParentPhone || '';
        const parentEmail = updated.parentEmail || '';
        const photoUrl = updated.photoUrl || '';

        let branchName = 'Accra Central Campus (Dansoman)';
        try {
            const branch = await BranchModel.findOne({ $or: [{ code: branchId }, { _id: branchId.match(/^[0-9a-fA-F]{24}$/) ? branchId : null }] }).lean();
            if (branch) branchName = branch.name;
        } catch { }

        // Find or create student record
        let studentDoc = await StudentModel.findOne({
            $or: [
                { fullName: applicantName, guardianPhone: parentPhone },
                { admissionNo: generatedAdmissionNo }
            ]
        }).lean();

        if (!studentDoc) {
            studentDoc = await StudentModel.create({
                admissionNo: generatedAdmissionNo,
                fullName: applicantName,
                gender,
                dateOfBirth,
                level,
                classStream: 'Gold Stream',
                branchId,
                branchName,
                photoUrl,
                status: 'ACTIVE',
                guardianName: parentName,
                guardianPhone: parentPhone,
                guardianEmail: parentEmail,
                admissionDate: new Date(),
            });
        } else {
            studentDoc = await StudentModel.findByIdAndUpdate(
                (studentDoc as any)._id,
                {
                    photoUrl: photoUrl || (studentDoc as any).photoUrl,
                    status: 'ACTIVE',
                    branchId: branchId || (studentDoc as any).branchId,
                    branchName: branchName || (studentDoc as any).branchName,
                    level: level || (studentDoc as any).level,
                },
                { returnDocument: 'after' }
            ).lean();
        }

        const studentObj = typeof (studentDoc as any).toObject === 'function' ? (studentDoc as any).toObject() : studentDoc;
        const studentIdStr = studentObj._id?.toString() || generatedAdmissionNo;

        // Auto-generate initial Term Fee Invoice for newly enrolled student
        try {
            const invoiceNo = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
            const existingInvoice = await FeeInvoiceModel.findOne({ studentId: studentIdStr }).lean();
            if (!existingInvoice) {
                await FeeInvoiceModel.create({
                    invoiceNo,
                    studentId: studentIdStr,
                    studentName: applicantName,
                    branchId,
                    term: 'Term 3',
                    academicYear: '2025/2026',
                    billedAmountGHS: 1200,
                    paidAmountGHS: 0,
                    balanceGHS: 1200,
                    status: 'UNPAID',
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                });
            }
        } catch (invoiceErr) {
            console.error('[SMS Backend] Invoice auto-creation notice:', invoiceErr);
        }

        // Auto-provision Parent Portal user account if parent email exists
        if (parentEmail) {
            try {
                const cleanEmail = parentEmail.toLowerCase().trim();
                const parentUser = await UserModel.findOne({ email: cleanEmail }).lean();
                if (!parentUser) {
                    await UserModel.create({
                        email: cleanEmail,
                        username: cleanEmail.split('@')[0],
                        passwordHash: hashPassword('ParentPass2026!'),
                        fullName: parentName,
                        role: 'PARENT',
                        branchId,
                        isActive: true,
                    });
                }
            } catch (userErr) {
                console.error('[SMS Backend] Parent user auto-provision notice:', userErr);
            }
        }

        // Increment active student counter on campus branch
        try {
            await BranchModel.updateOne(
                { $or: [{ code: branchId }, { _id: branchId.match(/^[0-9a-fA-F]{24}$/) ? branchId : null }] },
                { $inc: { activeStudents: 1 } }
            );
        } catch (branchErr) { }

        return res.json({
            message: `Application approved. Student automatically enrolled under Admission No: ${generatedAdmissionNo}`,
            admissionNo: generatedAdmissionNo,
            application: fmt(updated),
            student: {
                ...studentObj,
                id: studentIdStr,
                parentName: studentObj.guardianName || parentName,
                parentPhone: studentObj.guardianPhone || parentPhone,
                parentEmail: studentObj.guardianEmail || parentEmail,
            },
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
};

admissionsRouter.put('/:id/approve', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMISSIONS_OFFICER'), handleApprove);
admissionsRouter.patch('/:id/approve', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMISSIONS_OFFICER'), handleApprove);

// Reject Application Handler
const handleReject = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { reason } = req.body;

    try {
        const updated = await AdmissionModel.findOneAndUpdate(
            { $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { applicationNo: id }] },
            { status: 'REJECTED', rejectionReason: reason || 'Application declined.' },
            { returnDocument: 'after' }
        ).lean();
        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found.' });
        }
        return res.json({ message: 'Application rejected.', application: fmt(updated) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
};

admissionsRouter.put('/:id/reject', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMISSIONS_OFFICER'), handleReject);
admissionsRouter.patch('/:id/reject', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMISSIONS_OFFICER'), handleReject);

// Schedule Interview Handler
const handleSchedule = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { interviewDate, date } = req.body;
    const finalDate = interviewDate || date;

    try {
        const updated = await AdmissionModel.findOneAndUpdate(
            { $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { applicationNo: id }] },
            {
                status: 'INTERVIEW_SCHEDULED',
                interviewDate: finalDate ? new Date(finalDate) : new Date(),
            },
            { returnDocument: 'after' }
        ).lean();
        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found.' });
        }
        return res.json({ message: 'Interview scheduled successfully.', application: fmt(updated) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
};

admissionsRouter.put('/:id/schedule', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMISSIONS_OFFICER'), handleSchedule);
admissionsRouter.patch('/:id/schedule', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMISSIONS_OFFICER'), handleSchedule);
