import express from 'express';
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
import { rateLimiter } from './middleware/auth.js';
const app = express();
const PORT = process.env.PORT || 5000;
// Security & Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);
// NoSQL Injection Sanitization — strip MongoDB operators from user input
function sanitizeValue(val) {
    if (val === null || val === undefined)
        return val;
    if (typeof val === 'string')
        return val;
    if (typeof val === 'number' || typeof val === 'boolean')
        return val;
    if (Array.isArray(val))
        return val.map(sanitizeValue);
    if (typeof val === 'object') {
        const clean = {};
        for (const key of Object.keys(val)) {
            if (key.startsWith('$'))
                continue; // Strip MongoDB operators
            clean[key] = sanitizeValue(val[key]);
        }
        return clean;
    }
    return val;
}
app.use((req, _res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        for (const key of Object.keys(req.query)) {
            if (key.startsWith('$'))
                delete req.query[key];
        }
    }
    next();
});
// CORS Headers for Frontend Client (restricted origins in production)
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'https://deeperlife.netlify.app,http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000').split(',');
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        if (ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== 'production') {
            res.header('Access-Control-Allow-Origin', origin);
        }
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
app.use(async (req, res, next) => {
    if (req.path === '/health')
        return next();
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
// System Health Check Endpoint
app.get('/health', (_req, res) => {
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
// Bind Platform API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/branches', branchesRouter);
app.use('/api/v1/admissions', admissionsRouter);
app.use('/api/v1/students', studentsRouter);
app.use('/api/v1/academics', academicsRouter);
app.use('/api/v1/teachers', teachersRouter);
app.use('/api/v1/finance', financeRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/hr', hrRouter);
app.use('/api/v1/procurement', procurementRouter);
app.use('/api/v1/communication', communicationRouter);
app.use('/api/v1/bulk-data', bulkdataRouter);
app.use('/api/v1/audit', auditRouter);
// Global Error Handler Middleware
app.use((err, _req, res, _next) => {
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
