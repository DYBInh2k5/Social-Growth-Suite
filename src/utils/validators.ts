import { Request, Response, NextFunction } from 'express';

interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export function validateRequest(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      // Check required fields
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.field} is required`);
        continue;
      }

      // Skip validation if field is not required and empty
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type validation
      if (rule.type) {
        if (!validateType(value, rule.type)) {
          errors.push(`${rule.field} must be of type ${rule.type}`);
          continue;
        }
      }

      // String validations
      if (rule.type === 'string' && typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${rule.field} must be at least ${rule.minLength} characters long`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${rule.field} must be no more than ${rule.maxLength} characters long`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${rule.field} format is invalid`);
        }
      }

      // Number validations
      if (rule.type === 'number' && typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${rule.field} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${rule.field} must be no more than ${rule.max}`);
        }
      }

      // Custom validation
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (customResult !== true) {
          errors.push(typeof customResult === 'string' ? customResult : `${rule.field} is invalid`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    next();
  };
}

function validateType(value: any, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

// Common validation rules
export const userRegistrationRules: ValidationRule[] = [
  { field: 'email', required: true, type: 'email' },
  { field: 'password', required: true, type: 'string', minLength: 6, maxLength: 100 },
  { field: 'name', required: true, type: 'string', minLength: 2, maxLength: 100 }
];

export const userLoginRules: ValidationRule[] = [
  { field: 'email', required: true, type: 'email' },
  { field: 'password', required: true, type: 'string' }
];

export const socialAccountRules: ValidationRule[] = [
  { field: 'platform', required: true, type: 'string', custom: (value) => 
    ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'].includes(value) || 'Invalid platform'
  },
  { field: 'accountName', required: true, type: 'string', minLength: 1, maxLength: 255 }
];

export const scheduledPostRules: ValidationRule[] = [
  { field: 'accountId', required: true, type: 'number', min: 1 },
  { field: 'content', required: true, type: 'string', minLength: 1, maxLength: 2000 },
  { field: 'scheduledTime', required: true, type: 'string', custom: (value) => {
    const date = new Date(value);
    return !isNaN(date.getTime()) && date > new Date() || 'Scheduled time must be a valid future date';
  }},
  { field: 'mediaUrls', required: false, type: 'array' }
];

export const contentSuggestionRules: ValidationRule[] = [
  { field: 'platform', required: true, type: 'string', custom: (value) => 
    ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'].includes(value) || 'Invalid platform'
  },
  { field: 'category', required: false, type: 'string', maxLength: 100 },
  { field: 'count', required: false, type: 'number', min: 1, max: 20 }
];

export const hashtagGenerationRules: ValidationRule[] = [
  { field: 'content', required: true, type: 'string', minLength: 10, maxLength: 1000 },
  { field: 'platform', required: true, type: 'string', custom: (value) => 
    ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'].includes(value) || 'Invalid platform'
  }
];

export const chatbotMessageRules: ValidationRule[] = [
  { field: 'accountId', required: true, type: 'number', min: 1 },
  { field: 'userHandle', required: true, type: 'string', minLength: 1, maxLength: 100 },
  { field: 'message', required: true, type: 'string', minLength: 1, maxLength: 1000 },
  { field: 'platform', required: true, type: 'string' }
];

export const notificationRulesValidation: ValidationRule[] = [
  { field: 'rules', required: true, type: 'array', custom: (value) => {
    if (!Array.isArray(value)) return 'Rules must be an array';
    
    for (const rule of value) {
      if (!rule.type || typeof rule.type !== 'string') {
        return 'Each rule must have a valid type';
      }
      if (rule.enabled !== undefined && typeof rule.enabled !== 'boolean') {
        return 'Rule enabled field must be boolean';
      }
    }
    return true;
  }}
];

// Sanitization helpers
export function sanitizeString(str: string): string {
  return str.trim().replace(/[<>]/g, '');
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function sanitizeContent(content: string): string {
  // Remove potentially harmful content but preserve formatting
  return content
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '');
}

// Middleware for sanitizing request body
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }
  next();
}