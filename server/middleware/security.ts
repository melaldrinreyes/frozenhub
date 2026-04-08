import { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import hpp from "hpp";

// Helmet configuration for security headers
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket for Vite HMR
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"], // Allow web workers from blob URLs (Vite)
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

// Rate limiting for login attempts (10 attempts per 15 minutes in dev, 5 in production)
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "development" ? 10 : 5, // More lenient in development
  message: {
    error: "Too many login attempts from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  skip: (req) => {
    // Skip rate limiting in development for localhost
    return process.env.NODE_ENV === "development" && req.ip === "::1";
  },
});

// Rate limiting for signup attempts (20 attempts per hour in dev, 5 in production)
export const signupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === "development" ? 20 : 5, // More lenient in development
  message: {
    error: "Too many signup attempts from this IP, please try again after 1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development for localhost
    return process.env.NODE_ENV === "development" && req.ip === "::1";
  },
});

// General API rate limiting (200 requests per 15 minutes for better dev experience)
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "development" ? 10000 : 200, // Very high limit for dev
  message: {
    error: "Too many requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development for localhost
    return process.env.NODE_ENV === "development" && (req.ip === "::1" || req.ip === "127.0.0.1");
  },
});

// Public endpoints rate limiting (500 requests per 15 minutes - very lenient for homepage)
export const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Very high limit for public read-only endpoints
  message: {
    error: "Too many requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development for localhost
    return process.env.NODE_ENV === "development" && req.ip === "::1";
  },
});

// Strict rate limiting for sensitive operations (50 per hour for development/testing)
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Increased from 10 to 50 for better dev/test experience
  message: {
    error: "Too many sensitive operations, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// HTTP Parameter Pollution protection
export const hppProtection = hpp({
  whitelist: ["role", "branchId", "category", "status"], // Allow these params to appear multiple times
});

// Input sanitization middleware
export const sanitizeInput: RequestHandler = (req, res, next) => {
  // Sanitize request body
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        // Remove potential XSS vectors
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/javascript:/gi, "")
          .replace(/on\w+\s*=/gi, "")
          .trim();
      }
    }
  }

  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === "string") {
        req.query[key] = (req.query[key] as string)
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/javascript:/gi, "")
          .replace(/on\w+\s*=/gi, "")
          .trim();
      }
    }
  }

  next();
};

// Request logger for security monitoring
export const securityLogger: RequestHandler = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get("user-agent"),
    userId: req.session?.userId || "anonymous",
  };

  // Log response
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const responseLog = {
      ...logData,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    };

    const isApiRequest = req.path.startsWith("/api/");

    // Log suspicious activity
    if ((res.statusCode === 401 || res.statusCode === 403) && isApiRequest) {
      console.warn("🔒 Unauthorized access attempt:", responseLog);
    } else if (res.statusCode >= 400 && res.statusCode < 500) {
      console.warn("⚠️  Client error:", responseLog);
    } else if (res.statusCode >= 500) {
      console.error("❌ Server error:", responseLog);
    }
  });

  next();
};

// Prevent timing attacks on password comparison
export const preventTimingAttacks: RequestHandler = async (req, res, next) => {
  // Add a small random delay to prevent timing attacks (0-50ms)
  const delay = Math.random() * 50;
  await new Promise((resolve) => setTimeout(resolve, delay));
  next();
};
