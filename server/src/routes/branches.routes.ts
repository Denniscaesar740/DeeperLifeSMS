import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { BranchModel } from '../models/Branch.js';

export const branchesRouter = Router();

function fmt(doc: any) {
    if (!doc) return doc;
    return { ...doc, id: doc._id?.toString() || doc.code };
}

// 1. GET /api/v1/branches - List all school branches (Public & Authenticated)
branchesRouter.get('/', async (_req: Request, res: Response) => {
    try {
        const branches = await BranchModel.find().lean();
        const formatted = branches.map(fmt);
        return res.json({ totalBranches: formatted.length, branches: formatted });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// 2. GET /api/v1/branches/:id - Get specific branch details
branchesRouter.get('/:id', authenticateToken, async (req: Request, res: Response) => {
    const branchId = String(req.params.id);
    try {
        const branch = await BranchModel.findOne({
            $or: [{ _id: branchId.match(/^[0-9a-fA-F]{24}$/) ? branchId : null }, { code: branchId }]
        }).lean();
        if (!branch) return res.status(404).json({ error: 'NOT_FOUND', message: 'Branch not found.' });
        return res.json({ branch: fmt(branch) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// 3. POST /api/v1/branches - Create new branch (Super Admin only)
branchesRouter.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req: Request, res: Response) => {
    const { name, code, region, city, address, phone, email, principalName, studentCapacity } = req.body;

    if (!name || !code || !region || !email) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing required branch details.' });
    }

    try {
        const newBranch = await BranchModel.create({
            code,
            name,
            region,
            district: 'Municipal',
            city: city || 'Ghana',
            address: address || '',
            phone: phone || '',
            email,
            principalName: principalName || 'Unassigned',
            studentCapacity: Number(studentCapacity) || 500,
            activeStudents: 0,
            activeStaff: 0,
            status: 'ACTIVE',
        });
        return res.status(201).json({ message: 'Branch created successfully.', branch: fmt(newBranch.toObject()) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// 4. PUT /api/v1/branches/:id - Update branch info
branchesRouter.put('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN'), async (req: Request, res: Response) => {
    const branchId = String(req.params.id);
    try {
        const updated = await BranchModel.findOneAndUpdate(
            { $or: [{ _id: branchId.match(/^[0-9a-fA-F]{24}$/) ? branchId : null }, { code: branchId }] },
            req.body,
            { returnDocument: 'after' }
        ).lean();
        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Branch not found.' });
        }
        return res.json({ message: 'Branch details updated successfully.', branch: fmt(updated) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// 5. PATCH /api/v1/branches/:id/status - Update branch status
branchesRouter.patch('/:id/status', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req: Request, res: Response) => {
    const branchId = String(req.params.id);
    const { status } = req.body;

    try {
        const updated = await BranchModel.findOneAndUpdate(
            { $or: [{ _id: branchId.match(/^[0-9a-fA-F]{24}$/) ? branchId : null }, { code: branchId }] },
            { status },
            { returnDocument: 'after' }
        ).lean();
        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Branch not found.' });
        }
        return res.json({ message: 'Branch status updated successfully.', branch: fmt(updated) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
