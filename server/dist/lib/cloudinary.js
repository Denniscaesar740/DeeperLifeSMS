import { v2 as cloudinary } from 'cloudinary';
// Configure Cloudinary with environment variables
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY || process.env.VITE_CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.VITE_CLOUDINARY_API_SECRET;
const cloudinaryUrl = process.env.CLOUDINARY_URL;
if (cloudinaryUrl) {
    cloudinary.config({ cloudinary_url: cloudinaryUrl });
}
else if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });
}
/**
 * Check if Cloudinary service is fully configured with active credentials.
 */
export function isCloudinaryConfigured() {
    return Boolean(cloudinaryUrl ||
        (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) ||
        (process.env.VITE_CLOUDINARY_CLOUD_NAME && process.env.VITE_CLOUDINARY_API_KEY && process.env.VITE_CLOUDINARY_API_SECRET));
}
/**
 * Upload an image (base64 Data URL, file path, or remote URL) to Cloudinary.
 * If Cloudinary environment variables are missing, falls back gracefully.
 */
export async function uploadToCloudinary(fileData, folder = 'sms_uploads') {
    if (!fileData) {
        throw new Error('No image file or data provided for upload.');
    }
    if (isCloudinaryConfigured()) {
        try {
            const res = await cloudinary.uploader.upload(fileData, {
                folder,
                resource_type: 'image',
                transformation: [
                    { width: 600, height: 600, crop: 'limit' },
                    { quality: 'auto', fetch_format: 'auto' }
                ]
            });
            // Generate optimized URL using Cloudinary URL builder
            const optimizedUrl = cloudinary.url(res.public_id, {
                fetch_format: 'auto',
                quality: 'auto',
                secure: true,
            });
            return {
                success: true,
                url: res.secure_url || optimizedUrl,
                publicId: res.public_id,
                provider: 'cloudinary',
                format: res.format,
                bytes: res.bytes,
                message: 'Image uploaded and optimized successfully via Cloudinary.',
            };
        }
        catch (error) {
            console.error('❌ Cloudinary Upload Error:', error);
            throw new Error(`Cloudinary upload failed: ${error.message || error}`);
        }
    }
    throw new Error('Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing. Base64 storage in MongoDB is disabled.');
}
/**
 * Upload User Avatar with face detection and square auto-crop (500x500).
 */
export async function uploadAvatarToCloudinary(fileData) {
    if (isCloudinaryConfigured()) {
        try {
            const res = await cloudinary.uploader.upload(fileData, {
                folder: 'dls_avatars',
                transformation: [
                    { width: 500, height: 500, crop: 'fill', gravity: 'face' },
                    { quality: 'auto', fetch_format: 'auto' }
                ]
            });
            return {
                success: true,
                url: res.secure_url,
                publicId: res.public_id,
                provider: 'cloudinary',
                message: 'Avatar uploaded and auto-cropped successfully.',
            };
        }
        catch (err) {
            console.error('❌ Cloudinary Avatar Upload Error:', err);
            throw new Error(`Avatar upload failed: ${err.message}`);
        }
    }
    return uploadToCloudinary(fileData, 'dls_avatars');
}
/**
 * Upload Student Passport photo with headshot cropping.
 */
export async function uploadPassportToCloudinary(fileData) {
    if (isCloudinaryConfigured()) {
        try {
            const res = await cloudinary.uploader.upload(fileData, {
                folder: 'dls_passports',
                transformation: [
                    { width: 400, height: 500, crop: 'fill', gravity: 'face' },
                    { quality: 'auto', fetch_format: 'auto' }
                ]
            });
            return {
                success: true,
                url: res.secure_url,
                publicId: res.public_id,
                provider: 'cloudinary',
                message: 'Passport photo uploaded and cropped successfully.',
            };
        }
        catch (err) {
            console.error('❌ Cloudinary Passport Upload Error:', err);
            throw new Error(`Passport upload failed: ${err.message}`);
        }
    }
    return uploadToCloudinary(fileData, 'dls_passports');
}
/**
 * Delete an image asset from Cloudinary using its public_id.
 */
export async function deleteFromCloudinary(publicId) {
    if (!isCloudinaryConfigured() || !publicId)
        return false;
    try {
        const res = await cloudinary.uploader.destroy(publicId);
        return res.result === 'ok';
    }
    catch (err) {
        console.error('❌ Cloudinary Deletion Error:', err);
        return false;
    }
}
