import { connectDB } from './lib/db.js';
import { UserModel } from './models/User.js';
import { hashPassword } from './utils/security.js';
import crypto from 'crypto';

function generateUniquePassword(username: string, role: string): string {
    const seed = `${role}_${username}_DLS2026`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8);
    return `DL${role.slice(0, 3)}@${hash}!`;
}

async function seed() {
    console.log('🌱 Checking MongoDB Atlas Database Initialization...');
    const connected = await connectDB();
    if (!connected) {
        console.error('Failed to connect to MongoDB Atlas.');
        process.exit(1);
    }

    const defaultAccounts = [
        { email: 'superadmin@dlschools.edu.gh', username: 'superadmin', fullName: 'System Administrator', role: 'SUPER_ADMIN', branchId: 'ALL', classesAssigned: [], subjectsAssigned: [] },
        { email: 'accra.admin@dlschools.edu.gh', username: 'accra.admin', fullName: 'Accra Campus Admin', role: 'BRANCH_ADMIN', branchId: 'br-accra', classesAssigned: [], subjectsAssigned: [] },
        { email: 'headteacher@dlschools.edu.gh', username: 'headteacher', fullName: 'Dr. Emmanuel Addo', role: 'HEADTEACHER', branchId: 'br-accra', classesAssigned: [], subjectsAssigned: [] },
        { email: 'f.boakye@dlschools.edu.gh', username: 'f.boakye', fullName: 'Mr. Francis Boakye', role: 'TEACHER', branchId: 'br-accra', classesAssigned: ['JHS 1 Gold', 'JHS 2 Blue'], subjectsAssigned: ['Core Mathematics', 'ICT & Coding'] },
        { email: 'accountant@dlschools.edu.gh', username: 'accountant', fullName: 'Mrs. Grace Ansah', role: 'ACCOUNTANT', branchId: 'ALL', classesAssigned: [], subjectsAssigned: [] },
        { email: 'cashier@dlschools.edu.gh', username: 'cashier', fullName: 'Samuel Mensah', role: 'CASHIER', branchId: 'br-accra', classesAssigned: [], subjectsAssigned: [] },
        { email: 'admissions@dlschools.edu.gh', username: 'admissions', fullName: 'Sarah Quaye', role: 'ADMISSIONS_OFFICER', branchId: 'ALL', classesAssigned: [], subjectsAssigned: [] },
        { email: 'parent.owusu@gmail.com', username: 'parent.owusu', fullName: 'Mr. Kwabena Owusu', role: 'PARENT', branchId: 'br-accra', classesAssigned: [], subjectsAssigned: [] },
        { email: 'ezekiel.owusu@student.dlschools.edu.gh', username: 'ezekiel.owusu', fullName: 'Ezekiel Owusu', role: 'STUDENT', branchId: 'br-accra', classesAssigned: [], subjectsAssigned: [] },
        { email: 'audit@dlschools.edu.gh', username: 'audit', fullName: 'Internal Auditor', role: 'AUDITOR', branchId: 'ALL', classesAssigned: [], subjectsAssigned: [] },
    ];

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  Generated System Account Credentials (Save Securely!)      ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');

    for (const acc of defaultAccounts) {
        const uniquePassword = generateUniquePassword(acc.username, acc.role);
        const passwordHash = hashPassword(uniquePassword);

        await UserModel.findOneAndUpdate(
            { email: acc.email },
            {
                email: acc.email,
                username: acc.username,
                passwordHash,
                fullName: acc.fullName,
                role: acc.role,
                branchId: acc.branchId,
                classesAssigned: acc.classesAssigned,
                subjectsAssigned: acc.subjectsAssigned,
                twoFactorEnabled: false,
                isActive: true,
            },
            { upsert: true, returnDocument: 'after' }
        );
        console.log(`║  ${acc.email.padEnd(42)} → ${uniquePassword.padEnd(14)} ║`);
    }

    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Created/Updated ${defaultAccounts.length} system accounts in MongoDB Atlas.`);
    console.log('⚠️  IMPORTANT: Change these passwords after first login!');
    console.log('🎉 MongoDB Atlas Initialization Complete!');
    process.exit(0);
}

seed();


