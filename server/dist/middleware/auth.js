import { verifyAccessToken } from '../utils/security.js';
import { redis } from '../lib/redis.js';
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Bearer access token is required.' });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid or expired access token.' });
    }
    req.user = payload;
    next();
}
export function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'FORBIDDEN',
                message: `User role '${req.user.role}' is not authorized to access this route. Required roles: ${roles.join(', ')}`,
            });
        }
        next();
    };
}
// Rate limiting middleware
export async function rateLimiter(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const { allowed, remaining } = await redis.checkRateLimit(ip, 120, 60000);
    res.setHeader('X-RateLimit-Limit', 120);
    res.setHeader('X-RateLimit-Remaining', remaining);
    if (!allowed) {
        return res.status(429).json({
            error: 'TOO_MANY_REQUESTS',
            message: 'API rate limit exceeded. Please wait 60 seconds before trying again.',
        });
    }
    next();
}
