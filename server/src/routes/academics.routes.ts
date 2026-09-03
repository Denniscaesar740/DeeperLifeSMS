import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { AssessmentModel } from '../models/Assessment.js';
import { StudentModel } from '../models/Student.js';

export const academicsRouter = Router();

function fmt(doc: any) {
    if (!doc) return doc;
    return { ...doc, id: doc._id?.toString() };
}

// Helper to compute WAEC/NaCCA Grade
function calculateGrade(score: number): { grade: string; remarks: string } {
    if (score >= 80) return { grade: 'A1', remarks: 'Excellent' };
    if (score >= 70) return { grade: 'B2', remarks: 'Very Good' };
    if (score >= 65) return { grade: 'B3', remarks: 'Good' };
    if (score >= 60) return { grade: 'C4', remarks: 'Credit' };
    if (score >= 55) return { grade: 'C5', remarks: 'Credit' };
    if (score >= 50) return { grade: 'C6', remarks: 'Credit' };
    if (score >= 45) return { grade: 'D7', remarks: 'Pass' };
    if (score >= 40) return { grade: 'E8', remarks: 'Pass' };
    return { grade: 'F9', remarks: 'Fail' };
}

// 1. GET /api/v1/academics/assessments - Get assessment records
academicsRouter.get('/assessments', authenticateToken, async (req: Request, res: Response) => {
    const { studentId, subject, term } = req.query;
    try {
        const query: any = {};
        if (studentId) query.studentId = studentId;
        if (subject) query.subject = subject;
        if (term) query.term = term;

        const dbAssessments = await AssessmentModel.find(query).sort({ createdAt: -1 }).lean();
        const formatted = dbAssessments.map(fmt);
        return res.json({ count: formatted.length, assessments: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// 2. POST /api/v1/academics/scores - Record or update assessment score
academicsRouter.post('/scores', authenticateToken, authorizeRoles('SUPER_ADMIN', 'TEACHER'), async (req: Request, res: Response) => {
    const { studentId, subject, term, academicYear, classScore, examScore, remarks } = req.body;

    if (!studentId || !subject || classScore === undefined || examScore === undefined) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing studentId, subject, classScore, or examScore.' });
    }

    const authUser = (req as any).user;
    if (authUser && authUser.role === 'TEACHER') {
        const assignedSubjects = authUser.subjectsAssigned || [];
        if (assignedSubjects.length > 0 && !assignedSubjects.includes(subject)) {
            return res.status(403).json({
                error: 'FORBIDDEN',
                message: `Access denied. You are only authorized to grade subjects assigned to you (${assignedSubjects.join(', ')}).`,
            });
        }
    }

    const total = Number(classScore) + Number(examScore);
    const { grade, remarks: autoRemark } = calculateGrade(total);

    try {
        let studentName = 'Student Record';
        try {
            const st = await StudentModel.findOne({
                $or: [{ _id: String(studentId).match(/^[0-9a-fA-F]{24}$/) ? studentId : null }, { admissionNo: studentId }]
            });
            if (st) {
                studentName = st.fullName;
                if (authUser && authUser.role === 'TEACHER') {
                    const assignedClasses = authUser.classesAssigned || [];
                    if (assignedClasses.length > 0) {
                        const isAssigned = assignedClasses.some((ac: string) =>
                            (st.classStream && st.classStream.includes(ac)) || (st.level && st.level.includes(ac)) || (st.level && ac.includes(st.level))
                        );
                        if (!isAssigned) {
                            return res.status(403).json({
                                error: 'FORBIDDEN',
                                message: `Access denied. Student ${st.fullName} (${st.level}) is not in your assigned class (${assignedClasses.join(', ')}).`,
                            });
                        }
                    }
                }
            }
        } catch { }

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
            recordedBy: authUser?.fullName || 'Teacher',
        });
        return res.status(201).json({ message: 'Score saved successfully.', assessment: fmt(record.toObject()) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// 3. GET /api/v1/academics/report-card/:studentId - Generate Student Terminal Report Summary
academicsRouter.get('/report-card/:studentId', authenticateToken, async (req: Request, res: Response) => {
    const studentId = req.params.studentId as string;

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
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
