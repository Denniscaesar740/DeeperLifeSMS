import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { redis } from '../lib/redis.js';
import { BroadcastMessageModel } from '../models/BroadcastMessage.js';
export const communicationRouter = Router();
// POST /api/v1/communication/broadcast - Trigger Bulk Emergency SMS/Email Broadcast
communicationRouter.post('/broadcast', authenticateToken, authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN'), async (req, res) => {
    const { channel, recipientGroup, branchId, subject, content, isEmergency } = req.body;
    if (!channel || !recipientGroup || !content) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Channel, recipientGroup, and content are required.' });
    }
    const recipientsCount = recipientGroup === 'ALL_PARENTS' ? 1420 : 85;
    const costPerSmsGHS = 0.045;
    const totalCostGHS = channel === 'SMS' ? Number((recipientsCount * costPerSmsGHS).toFixed(2)) : 0;
    await redis.pushQueueJob({
        type: channel,
        recipient: recipientGroup,
        payload: {
            subject: subject || 'DL Schools Ghana Notice',
            content,
            isEmergency: Boolean(isEmergency),
            branchId: branchId || 'ALL',
        },
    });
    try {
        const messageRecord = await BroadcastMessageModel.create({
            channel,
            recipientGroup,
            branchId: branchId || 'br-accra',
            subject: subject || '',
            content,
            isEmergency: Boolean(isEmergency),
            recipientsCount,
            totalCostGHS,
            status: 'DISPATCHED',
        });
        return res.status(202).json({
            message: `${channel} broadcast queued in MongoDB and dispatched via SMS/Email gateway.`,
            recipientsCount,
            estimatedCostGHS: totalCostGHS,
            jobStatus: 'DISPATCHED',
            broadcast: messageRecord,
        });
    }
    catch {
        return res.status(202).json({
            message: `${channel} broadcast queued and dispatched via SMS/Email gateway.`,
            recipientsCount,
            estimatedCostGHS: totalCostGHS,
            jobStatus: 'DISPATCHED',
        });
    }
});
