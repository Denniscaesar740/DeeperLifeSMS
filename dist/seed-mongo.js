import { connectDB } from './lib/db.js';
import { UserModel } from './models/User.js';
import { hashPassword } from './utils/security.js';
async function seed() {
    console.log('🌱 Checking MongoDB Atlas Database Initialization...');
    const connected = await connectDB();
    if (!connected) {
        console.error('Failed to connect to MongoDB Atlas.');
        process.exit(1);
    }
    const email = 'superadmin@dlschools.edu.gh';
    const passwordHash = hashPassword('AdminPass2026!');
    await UserModel.findOneAndUpdate({ email }, {
        email,
        username: 'superadmin',
        passwordHash,
        fullName: 'System Administrator',
        role: 'SUPER_ADMIN',
        branchId: 'ALL',
        twoFactorEnabled: false,
        isActive: true,
    }, { upsert: true, returnDocument: 'after' });
    console.log('✅ Created/Updated default System Administrator account in MongoDB Atlas.');
    console.log('🎉 MongoDB Atlas Initialization Complete!');
    process.exit(0);
}
seed();
