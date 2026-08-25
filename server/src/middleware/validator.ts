import { Request, Response, NextFunction } from 'express';

// Ghana Phone Regex (02x, 05x, 03x or +233 format)
const GHANA_PHONE_REGEX = /^(\+233|0)(2[0346789]|5[03456789]|3[0-9])[0-9]{7}$/;
// Standard Email Regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Ghana Card ID Regex
const GHANA_CARD_REGEX = /^GHA-[0-9]{9}-[0-9]{1}$/;

export interface ValidationRule {
    field: string;
    label?: string;
    required?: boolean;
    type?: 'email' | 'phone' | 'ghanaCard' | 'number' | 'string' | 'boolean';
    min?: number;
    max?: number;
}

export function validateRequestBody(rules: ValidationRule[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const body = req.body || {};
        const errors: Record<string, string> = {};

        for (const rule of rules) {
            const { field, label = field, required = false, type, min, max } = rule;
            const val = body[field];

            // 1. Required Check
            if (required && (val === undefined || val === null || (typeof val === 'string' && !val.trim()))) {
                errors[field] = `${label} is required.`;
                continue;
            }

            if (val === undefined || val === null || val === '') continue;

            // 2. Type & Format Checks
            if (type === 'email' && typeof val === 'string' && !EMAIL_REGEX.test(val.trim())) {
                errors[field] = `Please provide a valid email address.`;
            }

            if (type === 'phone' && typeof val === 'string' && !GHANA_PHONE_REGEX.test(val.trim().replace(/\s+/g, ''))) {
                errors[field] = `Please provide a valid Ghana phone number (e.g. 0241234567).`;
            }

            if (type === 'ghanaCard' && typeof val === 'string' && !GHANA_CARD_REGEX.test(val.trim().toUpperCase())) {
                errors[field] = `Invalid Ghana Card format. Use GHA-123456789-0.`;
            }

            if (type === 'number') {
                const num = Number(val);
                if (isNaN(num)) {
                    errors[field] = `${label} must be a number.`;
                } else {
                    if (min !== undefined && num < min) {
                        errors[field] = `${label} must be at least ${min}.`;
                    }
                    if (max !== undefined && num > max) {
                        errors[field] = `${label} cannot exceed ${max}.`;
                    }
                }
            }

            if (type === 'string' && typeof val === 'string') {
                const trimmed = val.trim();
                if (min !== undefined && trimmed.length < min) {
                    errors[field] = `${label} must be at least ${min} characters.`;
                }
                if (max !== undefined && trimmed.length > max) {
                    errors[field] = `${label} cannot exceed ${max} characters.`;
                }
            }
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                error: 'VALIDATION_FAILED',
                message: 'Form validation failed. Please correct the highlighted errors.',
                details: errors,
            });
        }

        next();
    };
}
