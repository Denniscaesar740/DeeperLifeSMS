import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { hashPassword, verifyPassword, generateTokens, verifyAccessToken, generateOtpCode } from '../utils/security.js';
import { redis } from '../lib/redis.js';
import { UserModel } from '../models/User.js';
import { uploadAvatarToCloudinary } from '../lib/cloudinary.js';

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.REFRESH_SECRET || 'sms_dev_jwt_refresh_secret_secret_key_2026_dlschools';

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Email address or username is required.' });
    }
    if (!password) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Password is required.' });
    }

    const inputEmail = String(email).toLowerCase().trim();
    const inputPassword = String(password);

    try {
        let user: any = await UserModel.findOne({ email: inputEmail }).lean();

        if (!user) {
            user = await UserModel.findOne({ username: inputEmail }).lean();
        }

        if (!user) {
            return res.status(401).json({
                error: 'INVALID_CREDENTIALS',
                message: 'Invalid email/username or password.',
            });
        }

        if (!user.passwordHash) {
            return res.status(403).json({ error: 'ACCOUNT_SETUP_REQUIRED', message: 'Account password has not been configured. Contact your system administrator.' });
        }
        const isPasswordValid = verifyPassword(inputPassword, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
        }

        const userId = user._id?.toString() || user.id || `usr-${Date.now()}`;

        if (user.twoFactorEnabled) {
            const otpCode = generateOtpCode();
            await redis.set(`2fa:${userId}`, otpCode, 300);
            await redis.pushQueueJob({
                type: 'SMS',
                recipient: user.email,
                payload: { message: `Your DL Schools 2FA Verification Code is ${otpCode}` },
            });
            return res.json({
                requiresTwoFactor: true,
                userId,
                message: '2FA OTP code dispatched via SMS/Email.',
            });
        }

        const tokens = generateTokens({
            userId,
            email: user.email,
            role: user.role,
            branchId: user.branchId || 'ALL',
        });

        await redis.set(`session:${userId}:${tokens.refreshToken}`, JSON.stringify({ userId }), 7 * 24 * 3600);

        return res.json({
            message: 'Authentication successful.',
            user: {
                id: userId,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                avatarUrl: user.avatarUrl || '',
                branchId: user.branchId || 'ALL',
                branchName: user.branchName || '',
                classesAssigned: user.classesAssigned || [],
                subjectsAssigned: user.subjectsAssigned || [],
            },
            ...tokens,
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'SERVER_ERROR', message: err.message || 'Authentication error.' });
    }
});

// POST /api/v1/auth/parent-login (Secure credentials-based Parent Portal access)
authRouter.post('/parent-login', async (req: Request, res: Response) => {
    const { parentEmail, parentCode, password, studentId } = req.body;

    if (!parentEmail && !parentCode) {
        return res.status(400).json({
            error: 'BAD_REQUEST',
            message: 'Parent registered email address or Parent Access Code is required.',
        });
    }

    if (!password) {
        return res.status(400).json({
            error: 'BAD_REQUEST',
            message: 'Parent portal secret password is required.',
        });
    }

    const inputIdentifier = (parentEmail || parentCode || '').toLowerCase().trim();

    try {
        let parentUser: any = await UserModel.findOne({
            $or: [
                { email: inputIdentifier },
                { username: inputIdentifier },
                { parentCode: inputIdentifier }
            ],
            role: 'PARENT'
        }).lean();

        if (!parentUser) {
            return res.status(401).json({
                error: 'INVALID_CREDENTIALS',
                message: 'Invalid Parent credentials or access code.',
            });
        }

        if (parentUser.passwordHash) {
            const isPasswordValid = verifyPassword(password, parentUser.passwordHash);
            if (!isPasswordValid) {
                return res.status(401).json({
                    error: 'INVALID_CREDENTIALS',
                    message: 'Invalid Parent credentials or secret password.',
                });
            }
        }

        const userId = parentUser._id?.toString() || parentUser.id || `par-${Date.now()}`;
        const tokens = generateTokens({
            userId,
            email: parentUser.email,
            role: 'PARENT',
            branchId: parentUser.branchId || 'br-accra',
        });

        return res.json({
            message: 'Parent authentication successful.',
            user: {
                id: userId,
                email: parentUser.email,
                fullName: parentUser.fullName || 'Registered Parent',
                role: 'PARENT',
                branchId: parentUser.branchId || 'br-accra',
                studentId: studentId || 'STU-2026-001',
            },
            ...tokens,
        });
    } catch (err: any) {
        return res.status(500).json({
            error: 'SERVER_ERROR',
            message: err.message || 'Parent authentication server error.',
        });
    }
});

// POST /api/v1/auth/verify-2fa
authRouter.post('/verify-2fa', async (req, res) => {
    const { userId, otpCode } = req.body;
    const storedOtp = await redis.get(`2fa:${userId}`);

    if (!storedOtp || storedOtp !== otpCode) {
        return res.status(400).json({ error: 'INVALID_OTP', message: 'Invalid or expired 2FA code.' });
    }

    try {
        const user: any = await UserModel.findById(userId).lean();
        if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });

        await redis.del(`2fa:${userId}`);

        const tokens = generateTokens({
            userId: user._id?.toString() || userId,
            email: user.email,
            role: user.role,
            branchId: user.branchId || 'br-accra',
        });

        return res.json({
            message: '2FA verification successful.',
            user: {
                id: user._id?.toString() || userId,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
            },
            ...tokens,
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});

// POST /api/v1/auth/refresh
authRouter.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Refresh token required.' });
    }

    try {
        const parts = refreshToken.split('.');
        if (parts.length !== 3) {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'Malformed refresh token.' });
        }

        // Verify HMAC-SHA256 signature before trusting payload
        const [header, payload, signature] = parts;
        const expectedSignature = crypto
            .createHmac('sha256', JWT_REFRESH_SECRET)
            .update(`${header}.${payload}`)
            .digest('base64url');

        if (signature !== expectedSignature) {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid refresh token signature.' });
        }

        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
        if (!decoded.userId || (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000))) {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'Expired or invalid refresh token.' });
        }

        const user: any = await UserModel.findById(decoded.userId).lean();
        if (!user) {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'User not found for this token.' });
        }

        const newTokens = generateTokens({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
            branchId: user.branchId || 'ALL',
        });

        return res.json({
            message: 'Token refreshed successfully.',
            ...newTokens,
        });
    } catch (err: any) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid refresh token.' });
    }
});

// PUT /api/v1/auth/profile - Update logged-in user profile details (avatarUrl, phone, fullName)
authRouter.post('/profile', verifyAccessToken, async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const { avatarUrl, fullName, phone } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    try {
        const updateData: any = {};
        if (avatarUrl !== undefined) {
            let finalAvatarUrl = avatarUrl;
            if (finalAvatarUrl && finalAvatarUrl.startsWith('data:image/')) {
                try {
                    const uploadRes = await uploadAvatarToCloudinary(finalAvatarUrl);
                    finalAvatarUrl = uploadRes.url;
                } catch (uploadErr) {
                    console.error('Failed to upload base64 avatar to Cloudinary in profile update:', uploadErr);
                }
            }
            updateData.avatarUrl = finalAvatarUrl;
        }
        if (fullName) updateData.fullName = fullName;
        if (phone !== undefined) updateData.phone = phone;

        const updated = await UserModel.findByIdAndUpdate(userId, updateData, { new: true }).lean();

        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
        }

        return res.json({
            message: 'Profile updated successfully.',
            user: {
                id: updated._id.toString(),
                email: updated.email,
                fullName: updated.fullName,
                role: updated.role,
                avatarUrl: updated.avatarUrl || '',
                phone: updated.phone || '',
                branchId: updated.branchId || 'ALL',
            },
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});

