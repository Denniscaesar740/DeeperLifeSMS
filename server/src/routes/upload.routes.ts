import { Router, Request, Response } from 'express';
import { uploadToCloudinary, uploadAvatarToCloudinary, uploadPassportToCloudinary, isCloudinaryConfigured } from '../lib/cloudinary.js';

export const uploadRouter = Router();

// GET /api/v1/upload/status - Check Cloudinary integration status
uploadRouter.get('/status', (_req: Request, res: Response) => {
    const configured = isCloudinaryConfigured();
    return res.json({
        configured,
        provider: configured ? 'Cloudinary Online Storage' : 'Local Fallback (Cloudinary credentials missing in .env)',
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || 'Not Configured',
        instructions: configured
            ? 'Cloudinary is active and ready to process user avatar & passport uploads.'
            : 'To save avatars and passport photos directly to Cloudinary online storage, add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your server .env file.',
    });
});

// POST /api/v1/upload/image - Upload generic image to Cloudinary
uploadRouter.post('/image', async (req: Request, res: Response) => {
    try {
        const { image, file, folder } = req.body;
        const targetImage = image || file;

        if (!targetImage) {
            return res.status(400).json({
                error: 'BAD_REQUEST',
                message: 'No image base64 Data URL or file provided in request body.'
            });
        }

        const result = await uploadToCloudinary(targetImage, folder || 'sms_uploads');
        return res.json(result);
    } catch (err: any) {
        console.error('❌ Upload Route Error:', err);
        return res.status(500).json({
            error: 'UPLOAD_FAILED',
            message: err.message || 'Failed to upload image to Cloudinary storage.'
        });
    }
});

// POST /api/v1/upload/avatar - Upload user/staff avatar photo to Cloudinary
uploadRouter.post('/avatar', async (req: Request, res: Response) => {
    try {
        const { image, file } = req.body;
        const targetImage = image || file;

        if (!targetImage) {
            return res.status(400).json({
                error: 'BAD_REQUEST',
                message: 'No avatar image base64 Data URL provided.'
            });
        }

        const result = await uploadAvatarToCloudinary(targetImage);
        return res.json(result);
    } catch (err: any) {
        return res.status(500).json({
            error: 'UPLOAD_FAILED',
            message: err.message || 'Failed to upload avatar to Cloudinary storage.'
        });
    }
});

// POST /api/v1/upload/passport - Upload student/admission passport photo to Cloudinary
uploadRouter.post('/passport', async (req: Request, res: Response) => {
    try {
        const { image, file } = req.body;
        const targetImage = image || file;

        if (!targetImage) {
            return res.status(400).json({
                error: 'BAD_REQUEST',
                message: 'No passport photo base64 Data URL provided.'
            });
        }

        const result = await uploadPassportToCloudinary(targetImage);
        return res.json(result);
    } catch (err: any) {
        return res.status(500).json({
            error: 'UPLOAD_FAILED',
            message: err.message || 'Failed to upload passport photo to Cloudinary storage.'
        });
    }
});
