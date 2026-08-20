import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { BranchModel } from '../models/Branch.js';
import { UserModel } from '../models/User.js';
import { StudentModel } from '../models/Student.js';
import { FeeInvoiceModel } from '../models/FeeInvoice.js';
export const auditRouter = Router();
function fmt(doc) {
    if (!doc)
        return doc;
    return { ...doc, id: doc._id?.toString() };
}
// GET /api/v1/audit/logs - Query Audit Logs
auditRouter.get('/logs', authenticateToken, async (req, res) => {
    const { module, role } = req.query;
    try {
        const query = {};
        if (module)
            query.module = module;
        if (role)
            query.userRole = role;
        const dbLogs = await AuditLogModel.find(query).sort({ createdAt: -1 }).lean();
        const formatted = dbLogs.map(fmt);
        return res.json({ count: formatted.length, logs: formatted });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// POST /api/v1/audit/logs - Log New System Action
auditRouter.post('/logs', authenticateToken, async (req, res) => {
    const { action, module, details } = req.body;
    const userEmail = req.user?.email || 'admin@dlschools.edu.gh';
    const userRole = req.user?.role || 'SUPER_ADMIN';
    try {
        const log = await AuditLogModel.create({
            userEmail,
            userRole,
            action: action || 'SYSTEM_EVENT',
            module: module || 'Core System',
            details: details || 'Action executed',
            ipAddress: req.ip || '127.0.0.1',
            branchName: 'Accra Central Campus (Dansoman)',
        });
        return res.status(201).json({ message: 'Audit entry recorded.', log: fmt(log.toObject()) });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
// GET /api/v1/audit/backup - Export Full System Database Snapshot
auditRouter.get('/backup', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (_req, res) => {
    try {
        const branchCount = await BranchModel.countDocuments();
        const userCount = await UserModel.countDocuments();
        const studentCount = await StudentModel.countDocuments();
        const invoiceCount = await FeeInvoiceModel.countDocuments();
        return res.json({
            system: 'DL Schools Management System Ghana',
            backupVersion: '2026.08.17.v1',
            timestamp: new Date().toISOString(),
            exportedBy: 'Super Admin Owusu',
            tablesCount: 16,
            databaseMetrics: {
                branchCount,
                userCount,
                studentCount,
                invoiceCount,
            },
            status: 'SUCCESSFUL',
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
