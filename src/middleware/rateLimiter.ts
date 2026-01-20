import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../services/RedisService';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitInfo {
  totalHits: number;
  totalTime: number;
  resetTime: Date;
}

export function createRateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = generateKey(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get current request count
      const requestsKey = `rate_limit:${key}`;
      const requests = await RedisService.get(requestsKey);
      const currentRequests = requests ? parseInt(requests) : 0;

      // Check if limit exceeded
      if (currentRequests >= maxRequests) {
        const resetTime = new Date(now + windowMs);
        
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime.toISOString()
        });

        return res.status(429).json({
          error: message,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      // Increment counter
      const newCount = currentRequests + 1;
      await RedisService.set(requestsKey, newCount.toString(), Math.ceil(windowMs / 1000));

      // Set headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': (maxRequests - newCount).toString(),
        'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
      });

      // Handle response to potentially skip counting
      const originalSend = res.send;
      res.send = function(body) {
        const statusCode = res.statusCode;
        const shouldSkip = 
          (skipSuccessfulRequests && statusCode < 400) ||
          (skipFailedRequests && statusCode >= 400);

        if (shouldSkip) {
          // Decrement counter if we should skip this request
          RedisService.set(requestsKey, (newCount - 1).toString(), Math.ceil(windowMs / 1000));
        }

        return originalSend.call(this, body);
      };

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Continue without rate limiting if Redis fails
      next();
    }
  };
}

function generateKey(req: Request): string {
  // Use IP address and user ID (if authenticated) for key
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userId = (req as any).user?.id || 'anonymous';
  const route = req.route?.path || req.path;
  
  return `${ip}:${userId}:${route}`;
}

// Predefined rate limiters for different use cases
export const authLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.'
});

export const apiLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'Too many API requests, please try again later.'
});

export const chatbotLimiter = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 chatbot requests per minute
  message: 'Too many chatbot requests, please slow down.'
});

export const contentGenerationLimiter = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20, // 20 content generation requests per hour
  message: 'Content generation limit reached, please try again later.'
});

export const schedulingLimiter = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50, // 50 scheduling operations per hour
  message: 'Scheduling limit reached, please try again later.'
});