import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { StudentModel } from '../models/Student.js';
import { UserModel } from '../models/User.js';

export const bulkdataRouter = Router();

// POST /api/v1/bulk-data/validate - Validate CSV/Excel Migration File Payload
bulkdataRouter.post('/validate', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'ACCOUNTANT'), (req: Request, res: Response) => {
    const { targetEntity, records } = req.body;

    if (!targetEntity || !Array.isArray(records)) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'targetEntity and records array are required.' });
    }

    const errors: { row: number; field: string; message: string }[] = [];
    const validRecords: any[] = [];

    records.forEach((row, index) => {
        const rowNo = index + 1;
        if (targetEntity === 'STUDENTS') {
            if (!row.fullName) errors.push({ row: rowNo, field: 'fullName', message: 'Full name is required' });
            if (!row.level) errors.push({ row: rowNo, field: 'level', message: 'Grade level is required' });
            if (!row.guardianPhone) errors.push({ row: rowNo, field: 'guardianPhone', message: 'Guardian phone is required' });
        } else if (targetEntity === 'STAFF') {
            if (!row.fullName) errors.push({ row: rowNo, field: 'fullName', message: 'Full name is required' });
            if (!row.email) errors.push({ row: rowNo, field: 'email', message: 'Email address is required' });
        }

        if (errors.filter((e) => e.row === rowNo).length === 0) {
            validRecords.push(row);
        }
    });

    return res.json({
        totalSubmitted: records.length,
        validCount: validRecords.length,
        errorCount: errors.length,
        isReadyForImport: errors.length === 0,
        errors,
        sampleValidPreview: validRecords.slice(0, 3),
    });
});

// POST /api/v1/bulk-data/import - Execute Migration Batch Import
bulkdataRouter.post('/import', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req: Request, res: Response) => {
    const { targetEntity, records } = req.body;

    if (!targetEntity || !Array.isArray(records)) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'targetEntity and records array are required.' });
    }

    let importedCount = 0;
    const errors: string[] = [];

    try {
        if (targetEntity === 'STUDENTS') {
            for (const r of records) {
                try {
                    const admissionNo = r.admissionNo || `DLS-2026-${Math.floor(1000 + Math.random() * 9000)}`;
                    await StudentModel.create({
                        admissionNo,
                        fullName: r.fullName,
                        gender: r.gender || 'Male',
                        dateOfBirth: r.dateOfBirth ? new Date(r.dateOfBirth) : new Date('2014-01-01'),
                        level: r.level || 'JHS 1',
                        classStream: r.classStream || 'Gold',
                        branchId: r.branchId || 'br-accra',
                        branchName: 'Accra Central Campus (Dansoman)',
                        guardianName: r.guardianName || r.parentName || 'Guardian',
                        guardianPhone: r.guardianPhone || r.parentPhone || '+233 24 000 0000',
                        guardianEmail: r.guardianEmail || '',
                        status: 'ACTIVE',
                    });
                    importedCount++;
                } catch (e: any) {
                    errors.push(`Row ${importedCount + 1}: ${e.message}`);
                }
            }
        } else if (targetEntity === 'STAFF') {
            for (const r of records) {
                try {
                    await UserModel.create({
                        email: r.email,
                        passwordHash: '',
                        fullName: r.fullName,
                        role: r.role || 'TEACHER',
                        branchId: r.branchId || 'br-accra',
                        twoFactorEnabled: false,
                        isActive: true,
                    });
                    importedCount++;
                } catch (e: any) {
                    errors.push(`Row ${importedCount + 1}: ${e.message}`);
                }
            }
        }

        return res.status(201).json({
            message: `Successfully imported ${importedCount} records into ${targetEntity} dataset.`,
            targetEntity,
            importedCount,
            errors: errors.length > 0 ? errors : undefined,
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
