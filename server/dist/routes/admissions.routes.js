import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { AdmissionModel } from '../models/Admission.js';
export const admissionsRouter = Router();
function fmt(doc) {
    if (!doc)
        return doc;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return {
        ...obj,
        id: obj._id?.toString() || obj.applicationNo,
        intendedLevel: obj.applyingLevel || obj.intendedLevel || obj.level || '',
        branchId: obj.targetBranchId || obj.branchId || 'br-accra',
        dateSubmitted: obj.submittedAt ? new Date(obj.submittedAt).toISOString().split('T')[0] : (obj.createdAt ? new Date(obj.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
    };
}
// GET /api/v1/admissions - List all admission applications
admissionsRouter.get('/', authenticateToken, async (_req, res) => {
    try {
        const apps = await AdmissionModel.find().sort({ createdAt: -1 }).lean();
        const formatted = apps.map(fmt);
        return res.json({ count: formatted.length, applications: formatted });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// Handler function for new admission submission
const handleNewSubmission = async (req, res) => {
    const { applicantName, gender, dateOfBirth, applyingLevel, intendedLevel, level, targetBranchId, branchId, parentName, parentPhone, parentEmail } = req.body;
    const finalLevel = applyingLevel || intendedLevel || level;
    const finalBranchId = targetBranchId || branchId || 'br-accra';
    if (!applicantName || !finalLevel || !parentPhone) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Applicant name, level, and parent phone are required.' });
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
            status: 'SUBMITTED',
            interviewDate: null,
            submittedAt: new Date(),
        });
        return res.status(201).json({
            message: 'Admission application submitted successfully.',
            applicationNo,
            application: fmt(newApplication),
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
};
admissionsRouter.post('/submit', authenticateToken, handleNewSubmission);
admissionsRouter.post('/', authenticateToken, handleNewSubmission);
// Approve Application Handler
const handleApprove = async (req, res) => {
    const generatedAdmissionNo = `DL-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const id = String(req.params.id);
    try {
        const updated = await AdmissionModel.findOneAndUpdate({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { applicationNo: id }] }, { status: 'APPROVED' }, { returnDocument: 'after' }).lean();
        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found.' });
        }
        return res.json({
            message: `Application approved. Student ready for enrollment under Admission No: ${generatedAdmissionNo}`,
            admissionNo: generatedAdmissionNo,
            application: fmt(updated),
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
};
admissionsRouter.put('/:id/approve', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMISSIONS_OFFICER'), handleApprove);
admissionsRouter.patch('/:id/approve', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMISSIONS_OFFICER'), handleApprove);
// Reject Application Handler
const handleReject = async (req, res) => {
    const id = String(req.params.id);
    const { reason } = req.body;
    try {
        const updated = await AdmissionModel.findOneAndUpdate({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { applicationNo: id }] }, { status: 'REJECTED', rejectionReason: reason || 'Application declined.' }, { returnDocument: 'after' }).lean();
        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found.' });
        }
        return res.json({ message: 'Application rejected.', application: fmt(updated) });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
};
admissionsRouter.put('/:id/reject', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMISSIONS_OFFICER'), handleReject);
admissionsRouter.patch('/:id/reject', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMISSIONS_OFFICER'), handleReject);
// Schedule Interview Handler
const handleSchedule = async (req, res) => {
    const id = String(req.params.id);
    const { interviewDate, date } = req.body;
    const finalDate = interviewDate || date;
    try {
        const updated = await AdmissionModel.findOneAndUpdate({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { applicationNo: id }] }, {
            status: 'INTERVIEW_SCHEDULED',
            interviewDate: finalDate ? new Date(finalDate) : new Date(),
        }, { returnDocument: 'after' }).lean();
        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found.' });
        }
        return res.json({ message: 'Interview scheduled successfully.', application: fmt(updated) });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
};
admissionsRouter.put('/:id/schedule', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMISSIONS_OFFICER'), handleSchedule);
admissionsRouter.patch('/:id/schedule', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMISSIONS_OFFICER'), handleSchedule);
