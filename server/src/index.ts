import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { connectDB } from './lib/db.js';
import { authRouter } from './routes/auth.routes.js';
import { branchesRouter } from './routes/branches.routes.js';
import { admissionsRouter } from './routes/admissions.routes.js';
import { studentsRouter } from './routes/students.routes.js';
import { academicsRouter } from './routes/academics.routes.js';
import { teachersRouter } from './routes/teachers.routes.js';
import { financeRouter } from './routes/finance.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { hrRouter } from './routes/hr.routes.js';
import { procurementRouter } from './routes/procurement.routes.js';
import { communicationRouter } from './routes/communication.routes.js';
import { bulkdataRouter } from './routes/bulkdata.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { rateLimiter } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(rateLimiter);

// NoSQL Injection Sanitization — strip MongoDB operators from user input
function sanitizeValue(val: any): any {
    if (val === null || val === undefined) return val;
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return val;
    if (Array.isArray(val)) return val.map(sanitizeValue);
    if (typeof val === 'object') {
        const clean: any = {};
        for (const key of Object.keys(val)) {
            if (key.startsWith('$')) continue; // Strip MongoDB operators
            clean[key] = sanitizeValue(val[key]);
        }
        return clean;
    }
    return val;
}

app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        for (const key of Object.keys(req.query)) {
            if (key.startsWith('$')) delete req.query[key];
        }
    }
    next();
});

// CORS Headers for Frontend Client (allow Netlify, localhost, and custom domain origins)
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
        const cleanOrigin = origin.trim().replace(/\/$/, '');
        // Reflect origin if allowed or if request is from Vercel / Netlify / dev
        if (
            ALLOWED_ORIGINS.length === 0 ||
            ALLOWED_ORIGINS.includes(cleanOrigin) ||
            cleanOrigin.endsWith('.vercel.app') ||
            cleanOrigin.endsWith('.netlify.app') ||
            cleanOrigin.includes('localhost') ||
            cleanOrigin.includes('127.0.0.1')
        ) {
            res.header('Access-Control-Allow-Origin', origin);
        }
        // Disallowed origins: no CORS header set — browser will block the request
    }

    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Hubtel-Signature');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Database Connectivity Guard Middleware
app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (['/health', '/', '/api', '/api/v1'].includes(req.path) || req.method === 'OPTIONS') return next();
    if (mongoose.connection.readyState !== 1) {
        const connected = await connectDB().catch(() => false);
        if (!connected) {
            return res.status(503).json({
                error: 'DATABASE_OFFLINE',
                message: 'Database is currently offline or unreachable. Please check your internet connectivity or MongoDB server status.',
            });
        }
    }
    next();
});

// Root & API Information Endpoint
app.get(['/', '/api', '/api/v1'], (_req: Request, res: Response) => {
    res.json({
        status: 'ONLINE',
        system: 'DL Schools Management System REST API (Ghana)',
        version: '1.0.0',
        healthCheck: '/health',
    });
});

// System Health Check Endpoint
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'HEALTHY',
        system: 'DL Schools Management System Backend API (Ghana)',
        database: mongoose.connection.readyState === 1 ? 'MongoDB Atlas (Connected)' : 'MongoDB Atlas (Disconnected)',
        databaseState: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        activeModules: [
            'Authentication & 2FA',
            'Branch Management',
            'Admissions Pipeline',
            'Student Information System (SIS)',
            'Academics & Report Cards',
            'Teachers & Timetables',
            'Finance & Fees Management',
            'Ghana Payment Webhooks (Hubtel / Paystack)',
            'Staff HR & Ghana GRA PAYE Payroll Engine',
            'Procurement & General Ledger Accounting',
            'Communication Broadcast Hub (SMS / Email / WhatsApp)',
            'Bulk Data Import / Export Engine',
            'Audit & Governance',
        ],
    });
});

// Bind Platform API Routes (supports both /api/v1/* and root /* endpoints)
const routes = [
    { prefix: 'auth', router: authRouter },
    { prefix: 'branches', router: branchesRouter },
    { prefix: 'admissions', router: admissionsRouter },
    { prefix: 'students', router: studentsRouter },
    { prefix: 'academics', router: academicsRouter },
    { prefix: 'teachers', router: teachersRouter },
    { prefix: 'finance', router: financeRouter },
    { prefix: 'payments', router: paymentsRouter },
    { prefix: 'hr', router: hrRouter },
    { prefix: 'procurement', router: procurementRouter },
    { prefix: 'communication', router: communicationRouter },
    { prefix: 'bulk-data', router: bulkdataRouter },
    { prefix: 'audit', router: auditRouter },
    { prefix: 'upload', router: uploadRouter },
];

for (const { prefix, router } of routes) {
    app.use(`/api/v1/${prefix}`, router);
}

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../../dist');

// Serve static frontend assets if built
app.use(express.static(distPath));

// API 404 Handler for missing /api routes
app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: 'The requested API endpoint was not found on this server.',
    });
});

// SPA History API Catch-All Fallback (Serves index.html for routes like /admissions, /dashboard, etc.)
app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) return next();
    const indexPath = path.join(distPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(404).json({
                error: 'NOT_FOUND',
                message: 'Frontend client index.html not found. Please build frontend app with `npm run build`.',
            });
        }
    });
});

// Global Error Handler Middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('❌ Global Server Error:', err);
    const message = process.env.NODE_ENV === 'production'
        ? 'An unexpected internal server error occurred.'
        : err.message || 'Internal server error';
    res.status(err.status || 500).json({ error: 'SERVER_ERROR', message });
});

// Start Backend REST API Server
async function startServer() {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`========================================================================`);
        console.log(`🚀 DL Schools Complete Advanced Backend API running on port ${PORT}`);
        console.log(`📡 Health Check: http://localhost:${PORT}/health`);
        console.log(`💳 Live Ghana Payment Webhook: http://localhost:${PORT}/api/v1/payments/webhook`);
        console.log(`========================================================================`);
    });
}

startServer();

export default app;
