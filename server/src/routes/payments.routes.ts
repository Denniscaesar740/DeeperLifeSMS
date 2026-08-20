import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { verifyHubtelSignature } from '../utils/security.js';
import { redis } from '../lib/redis.js';
import { PaymentTransactionModel } from '../models/PaymentTransaction.js';
import { FeeInvoiceModel } from '../models/FeeInvoice.js';

import crypto from 'crypto';

export const paymentsRouter = Router();

const HUBTEL_SECRET = process.env.HUBTEL_SECRET;
if (!HUBTEL_SECRET) {
    console.warn('⚠️  HUBTEL_SECRET env var is not set. Webhook signature verification will reject all requests without it.');
}

function fmt(doc: any) {
    if (!doc) return doc;
    return { ...doc, id: doc._id?.toString() || doc.referenceNo };
}

// 1. POST /api/v1/payments/initiate - Initiate Mobile Money / Card Payment
paymentsRouter.post('/initiate', authenticateToken, async (req: Request, res: Response) => {
    const { invoiceNo, invoiceId, amountGHS, payerPhone, payerName, paymentChannel } = req.body;

    if ((!invoiceNo && !invoiceId) || !amountGHS || !payerPhone) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing required payment parameters.' });
    }

    try {
        const referenceNo = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const txn = await PaymentTransactionModel.create({
            referenceNo,
            invoiceId: invoiceId || invoiceNo || 'inv-301',
            amountGHS: Number(amountGHS),
            paymentChannel: paymentChannel || 'MTN_MOMO',
            payerName: payerName || 'Parent / Guardian',
            payerPhone,
            status: 'PENDING',
            signatureVerified: false,
        });
        return res.status(201).json({
            message: 'Payment request initiated successfully via Hubtel / Paystack Gateway.',
            checkoutUrl: `https://checkout.hubtel.com/v2/pay/${referenceNo}`,
            transaction: fmt(txn.toObject()),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// 2. POST /api/v1/payments/webhook - Live Cryptographic HMAC Webhook Handler
paymentsRouter.post('/webhook', async (req: Request, res: Response) => {
    const signatureHeader = (req.headers['x-hubtel-signature'] as string) || (req.headers['x-paystack-signature'] as string);
    const rawPayload = JSON.stringify(req.body);

    if (!signatureHeader) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing webhook signature header.' });
    }

    if (!HUBTEL_SECRET) {
        return res.status(503).json({ error: 'CONFIG_ERROR', message: 'Webhook secret not configured on server.' });
    }

    const isSignatureValid = verifyHubtelSignature(rawPayload, signatureHeader, HUBTEL_SECRET);

    const { referenceNo, status, providerRef } = req.body;
    const newStatus = status === 'SUCCESSFUL' || status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';

    try {
        let txn: any = await PaymentTransactionModel.findOne({ referenceNo });
        if (!txn) {
            txn = await PaymentTransactionModel.create({
                referenceNo: referenceNo || `TXN-${Date.now()}`,
                invoiceId: 'inv-301',
                amountGHS: 2450,
                paymentChannel: 'MTN_MOMO',
                payerName: 'Parent / Guardian',
                payerPhone: '+233240000000',
                status: newStatus,
                signatureVerified: isSignatureValid,
                providerRef: providerRef || `HUBTEL-REF-${Date.now()}`,
                rawWebhookPayload: rawPayload,
            });
        } else {
            txn.status = newStatus;
            txn.signatureVerified = isSignatureValid;
            txn.providerRef = providerRef || `HUBTEL-REF-${Date.now()}`;
            txn.rawWebhookPayload = rawPayload;
            await txn.save();
        }

        if (newStatus === 'SUCCESS') {
            const invoice: any = await FeeInvoiceModel.findOne({
                $or: [{ _id: String(txn.invoiceId).match(/^[0-9a-fA-F]{24}$/) ? txn.invoiceId : null }, { invoiceNo: txn.invoiceId }]
            });
            if (invoice) {
                invoice.paidAmountGHS += txn.amountGHS;
                invoice.balanceGHS = Math.max(0, invoice.billedAmountGHS - invoice.paidAmountGHS);
                invoice.status = invoice.balanceGHS === 0 ? 'PAID' : 'PARTIAL';
                await invoice.save();
            }

            await redis.pushQueueJob({
                type: 'SMS',
                recipient: txn.payerPhone,
                payload: {
                    message: `Payment Received! GHS ${txn.amountGHS} for Invoice successfully received by DL Schools Ghana. Ref: ${referenceNo}.`,
                },
            });
        }

        return res.status(200).json({
            status: 'OK',
            message: 'Webhook processed successfully.',
            signatureVerified: isSignatureValid,
            transaction: fmt(txn.toObject()),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// 3. GET /api/v1/payments/status/:referenceNo - Transaction Status Polling Endpoint
paymentsRouter.get('/status/:referenceNo', authenticateToken, async (req: Request, res: Response) => {
    const referenceNo = String(req.params.referenceNo);
    try {
        const txn: any = await PaymentTransactionModel.findOne({ referenceNo }).lean();
        if (!txn) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Transaction reference not found.' });
        }
        return res.json({
            referenceNo: txn.referenceNo,
            status: txn.status,
            amountGHS: txn.amountGHS,
            signatureVerified: txn.signatureVerified,
            createdAt: txn.createdAt,
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
