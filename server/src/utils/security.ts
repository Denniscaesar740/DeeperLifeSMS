import crypto from 'crypto';

// Secret keys — MUST be set via environment variables in production
function getSecret(envKey: string, label: string): string {
    const val = process.env[envKey];
    if (!val) {
        const fallback = `sms_dev_${envKey.toLowerCase()}_secret_key_2026_dlschools`;
        console.warn(`⚠️  ${label} (${envKey}) is not set. Using stable development fallback key.`);
        return fallback;
    }
    return val;
}

const JWT_SECRET = getSecret('JWT_SECRET', 'JWT Access Secret');
const JWT_REFRESH_SECRET = getSecret('JWT_REFRESH_SECRET', 'JWT Refresh Secret');

export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
    branchId?: string;
}

// 1. Password Hashing (PBKDF2 / SHA-256 fallback for zero-dep server execution)
export function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
}

// 2. JWT Token Generation (Access & Refresh Tokens)
export function generateTokens(payload: JwtPayload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

    const accessTokenExpiry = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 Hours
    const accessPayload = Buffer.from(JSON.stringify({ ...payload, exp: accessTokenExpiry })).toString('base64url');
    const accessSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${accessPayload}`)
        .digest('base64url');
    const accessToken = `${header}.${accessPayload}.${accessSignature}`;

    const refreshTokenExpiry = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 Days
    const refreshPayload = Buffer.from(JSON.stringify({ userId: payload.userId, exp: refreshTokenExpiry })).toString('base64url');
    const refreshSignature = crypto
        .createHmac('sha256', JWT_REFRESH_SECRET)
        .update(`${header}.${refreshPayload}`)
        .digest('base64url');
    const refreshToken = `${header}.${refreshPayload}.${refreshSignature}`;

    return { accessToken, refreshToken, expiresAt: accessTokenExpiry };
}

export function verifyAccessToken(token: string): JwtPayload | null {
    try {
        const [header, payload, signature] = token.split('.');
        const expectedSignature = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(`${header}.${payload}`)
            .digest('base64url');
        if (signature !== expectedSignature) return null;

        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
        return decoded as JwtPayload;
    } catch {
        return null;
    }
}

// 3. 2FA OTP Token Verification
export function generateOtpCode(): string {
    return crypto.randomInt(100000, 999999).toString();
}

export function verifyHubtelSignature(payloadString: string, signatureHeader: string, secret: string): boolean {
    const calculatedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(calculatedSignature), Buffer.from(signatureHeader));
}
