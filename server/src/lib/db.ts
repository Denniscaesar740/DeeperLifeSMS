import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Support loading .env from both project root and current working directory
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Connect to MongoDB Atlas
export async function connectDB(): Promise<boolean> {
    if (mongoose.connection.readyState === 1) {
        return true;
    }

    const uri = process.env.MONGODB_URI;

    if (!uri || uri.includes('<db_username>')) {
        console.error('❌ MONGODB_URI is missing or contains placeholder values.');
        return false;
    }

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('🍃 Successfully connected to MongoDB Atlas database!');
        return true;
    } catch (err: any) {
        console.error('❌ MongoDB Connection Error:', err.message);
        return false;
    }
}

export default connectDB;
