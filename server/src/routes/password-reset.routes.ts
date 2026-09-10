import { Router, Request, Response } from 'express';
import { generateOtpCode, hashPassword } from '../utils/security.js';
import { UserModel } from '../models/User.js';
import { PasswordResetModel } from '../models/PasswordReset.js';

export const passwordResetRouter = Router();

// POST /api/v1/auth/forgot-password — request OTP
passwordResetRouter.post('/forgot-password', async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Email address is required.' });
    }

    const inputEmail = String(email).toLowerCase().trim();

    try {
        const user = await UserModel.findOne({
            $or: [{ email: inputEmail }, { username: inputEmail }]
        }).lean();

        // Always return success to prevent email enumeration
        const otpCode = generateOtpCode();

        if (user) {
            // Invalidate previous reset requests
            await PasswordResetModel.updateMany({ email: inputEmail, used: false }, { $set: { used: true } });

            await PasswordResetModel.create({
                email: inputEmail,
                otpCode,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            });

            // Log OTP (in production, send via SMS/Email gateway)
            console.log(`📧 [Password Reset OTP] Email: ${inputEmail} | OTP: ${otpCode} | Expires: 10 minutes`);
        }

        return res.json({
            message: 'If an account exists with this email, a 6-digit OTP code has been dispatched via SMS/Email.',
            otpSent: true,
            expiresInMinutes: 10,
            // DEV ONLY — remove in production
            ...(process.env.NODE_ENV !== 'production' ? { devOtp: user ? otpCode : undefined } : {}),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});

// POST /api/v1/auth/verify-reset-otp — verify OTP code
passwordResetRouter.post('/verify-reset-otp', async (req: Request, res: Response) => {
    const { email, otpCode } = req.body;
    if (!email || !otpCode) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Email and OTP code are required.' });
    }

    const inputEmail = String(email).toLowerCase().trim();

    try {
        const resetRecord = await PasswordResetModel.findOne({
            email: inputEmail,
            otpCode: String(otpCode),
            used: false,
            expiresAt: { $gt: new Date() },
        });

        if (!resetRecord) {
            // Increment attempts counter on all matching records
            await PasswordResetModel.updateMany(
                { email: inputEmail, used: false },
                { $inc: { attempts: 1 } }
            );

            // Auto-invalidate after 5 failed attempts
            await PasswordResetModel.updateMany(
                { email: inputEmail, attempts: { $gte: 5 } },
                { $set: { used: true } }
            );

            return res.status(400).json({
                error: 'INVALID_OTP',
                message: 'Invalid or expired OTP code. Please request a new one.',
            });
        }

        return res.json({
            message: 'OTP verified successfully. You may now set a new password.',
            verified: true,
            resetToken: resetRecord._id.toString(),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});

// POST /api/v1/auth/reset-password — set new password
passwordResetRouter.post('/reset-password', async (req: Request, res: Response) => {
    const { email, resetToken, newPassword } = req.body;
    if (!email || !resetToken || !newPassword) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Email, resetToken, and newPassword are required.' });
    }

    if (String(newPassword).length < 6) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Password must be at least 6 characters.' });
    }

    const inputEmail = String(email).toLowerCase().trim();

    try {
        const resetRecord = await PasswordResetModel.findOne({
            _id: resetToken,
            email: inputEmail,
            used: false,
            expiresAt: { $gt: new Date() },
        });

        if (!resetRecord) {
            return res.status(400).json({
                error: 'INVALID_TOKEN',
                message: 'Reset session expired or invalid. Please request a new OTP.',
            });
        }

        // Hash new password and update user
        const passwordHash = hashPassword(newPassword);
        const user = await UserModel.findOneAndUpdate(
            { $or: [{ email: inputEmail }, { username: inputEmail }] },
            { $set: { passwordHash } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'User account not found.' });
        }

        // Mark reset as used
        resetRecord.used = true;
        await resetRecord.save();

        return res.json({
            message: 'Password reset successfully. You can now log in with your new password.',
            success: true,
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});
