import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { AssessmentModel } from '../models/Assessment.js';
import { StudentModel } from '../models/Student.js';
export const academicsRouter = Router();
function fmt(doc) {
    if (!doc)
        return doc;
    return { ...doc, id: doc._id?.toString() };
}
// Helper to compute WAEC/NaCCA Grade
function calculateGrade(score) {
    if (score >= 80)
        return { grade: 'A1', remarks: 'Excellent' };
    if (score >= 70)
        return { grade: 'B2', remarks: 'Very Good' };
    if (score >= 65)
        return { grade: 'B3', remarks: 'Good' };
    if (score >= 60)
        return { grade: 'C4', remarks: 'Credit' };
    if (score >= 55)
        return { grade: 'C5', remarks: 'Credit' };
    if (score >= 50)
        return { grade: 'C6', remarks: 'Credit' };
    if (score >= 45)
        return { grade: 'D7', remarks: 'Pass' };
    if (score >= 40)
        return { grade: 'E8', remarks: 'Pass' };
    return { grade: 'F9', remarks: 'Fail' };
}
// 1. GET /api/v1/academics/assessments - Get assessment records
academicsRouter.get('/assessments', authenticateToken, async (req, res) => {
    const { studentId, subject, term } = req.query;
    try {
        const query = {};
        if (studentId)
            query.studentId = studentId;
        if (subject)
            query.subject = subject;
        if (term)
            query.term = term;
        const dbAssessments = await AssessmentModel.find(query).sort({ createdAt: -1 }).lean();
        const formatted = dbAssessments.map(fmt);
        return res.json({ count: formatted.length, assessments: formatted });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// 2. POST /api/v1/academics/scores - Record or update assessment score
academicsRouter.post('/scores', authenticateToken, authorizeRoles('SUPER_ADMIN', 'TEACHER'), async (req, res) => {
    const { studentId, subject, term, academicYear, classScore, examScore, remarks } = req.body;
    if (!studentId || !subject || classScore === undefined || examScore === undefined) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing studentId, subject, classScore, or examScore.' });
    }
    const total = Number(classScore) + Number(examScore);
    const { grade, remarks: autoRemark } = calculateGrade(total);
    try {
        let studentName = 'Student Record';
        try {
            const st = await StudentModel.findOne({
                $or: [{ _id: String(studentId).match(/^[0-9a-fA-F]{24}$/) ? studentId : null }, { admissionNo: studentId }]
            });
            if (st)
                studentName = st.fullName;
        }
        catch { }
        const record = await AssessmentModel.create({
            studentId,
            studentName,
            subject,
            term: term || 'Term 3',
            academicYear: academicYear || '2026',
            classScore: Number(classScore),
            examScore: Number(examScore),
            totalScore: total,
            grade,
            remarks: remarks || autoRemark,
            recordedBy: req.user?.fullName || 'Teacher',
        });
        return res.status(201).json({ message: 'Score saved successfully.', assessment: fmt(record.toObject()) });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// 3. GET /api/v1/academics/report-card/:studentId - Generate Student Terminal Report Summary
academicsRouter.get('/report-card/:studentId', authenticateToken, async (req, res) => {
    const studentId = req.params.studentId;
    try {
        const student = await StudentModel.findOne({
            $or: [{ _id: studentId.match(/^[0-9a-fA-F]{24}$/) ? studentId : null }, { admissionNo: studentId }]
        }).lean();
        if (!student) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Student profile not found.' });
        }
        const studentScores = await AssessmentModel.find({ studentId }).lean();
        const formattedScores = studentScores.map(fmt);
        const totalMarks = formattedScores.reduce((acc, s) => acc + s.totalScore, 0);
        const averageScore = formattedScores.length ? (totalMarks / formattedScores.length).toFixed(1) : 0;
        return res.json({
            student: fmt(student),
            term: 'Term 3, 2026',
            subjectCount: formattedScores.length,
            aggregateScore: totalMarks,
            averageScore: Number(averageScore),
            classPosition: '1st out of 38',
            conduct: 'Exemplary',
            attitude: 'Hardworking, respectful, and highly analytical',
            headteacherRemark: 'Outstanding performance. Promoted to next level.',
            subjects: formattedScores,
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
