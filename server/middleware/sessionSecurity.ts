import { RequestHandler } from "express";
import crypto from "crypto";

// Store session fingerprints (in production, use Redis or database)
const sessionFingerprints = new Map<string, string>();

/**
 * Generate a fingerprint from request headers to detect session hijacking
 */
function generateFingerprint(req: any): string {
  const components = [
    req.headers["user-agent"] || "",
    req.headers["accept-language"] || "",
    req.headers["accept-encoding"] || "",
    // Don't include IP as it can change with mobile networks
  ];
  
  return crypto
    .createHash("sha256")
    .update(components.join("|"))
    .digest("hex");
}

/**
 * Store fingerprint for a session (exported for use in OAuth callbacks)
 */
export function storeSessionFingerprint(req: any): void {
  const sessionId = req.sessionID;
  const fingerprint = generateFingerprint(req);
  sessionFingerprints.set(sessionId, fingerprint);
}

/**
 * Session Fingerprinting - Detect session hijacking attempts
 * Validates that the session is being used from the same browser/client
 * 
 * DISABLED: Causing issues with OAuth redirect flows
 */
export const sessionFingerprinting: RequestHandler = (req, res, next) => {
  // DISABLED: Skip fingerprinting entirely to fix OAuth login issues
  return next();
  
  /* ORIGINAL CODE - COMMENTED OUT
  // Skip for OAuth callback routes - fingerprint changes during redirect flow
  if (req.path.includes('/auth/google/callback') || req.path.includes('/auth/callback')) {
    return next();
  }

  // Skip for non-authenticated sessions
  if (!req.session?.userId) {
    return next();
  }

  const sessionId = req.sessionID;
  const currentFingerprint = generateFingerprint(req);
  const storedFingerprint = sessionFingerprints.get(sessionId);

  if (!storedFingerprint) {
    // First time seeing this session, store fingerprint
    sessionFingerprints.set(sessionId, currentFingerprint);
    return next();
  }

  if (storedFingerprint !== currentFingerprint) {
    // Fingerprint mismatch - possible session hijacking
    console.warn("⚠️  Session hijacking attempt detected:", {
      sessionId,
      userId: req.session.userId,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Destroy the compromised session
    req.session.destroy((err) => {
      if (err) console.error("Error destroying session:", err);
    });

    // Clear the fingerprint
    sessionFingerprints.delete(sessionId);

    res.status(401).json({ 
      error: "Session invalid. Please log in again.",
      code: "SESSION_HIJACK_DETECTED"
    });
    return;
  }

  next();
  */
};

/**
 * Session Regeneration - Regenerate session ID after privilege escalation
 * Prevents session fixation attacks
 */
export const regenerateSession = (req: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    const oldSessionId = req.sessionID;
    const oldFingerprint = sessionFingerprints.get(oldSessionId);

    req.session.regenerate((err: any) => {
      if (err) {
        reject(err);
        return;
      }

      // Transfer fingerprint to new session ID
      if (oldFingerprint) {
        sessionFingerprints.delete(oldSessionId);
        sessionFingerprints.set(req.sessionID, oldFingerprint);
      }

      resolve();
    });
  });
};

/**
 * Session Activity Tracking - Track last activity time
 * Helps detect suspicious activity patterns
 */
export const trackSessionActivity: RequestHandler = (req, res, next) => {
  if (req.session?.userId) {
    req.session.lastActivity = new Date().toISOString();
    
    // Store user's IP and user agent for audit trail
    if (!req.session.loginMetadata) {
      req.session.loginMetadata = {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        loginTime: new Date().toISOString(),
      };
    }
  }
  next();
};

/**
 * Session Timeout Check - Enforce absolute session timeout
 * Even with rolling expiration, sessions should have a maximum lifetime
 */
export const checkSessionTimeout: RequestHandler = (req, res, next) => {
  if (!req.session?.userId || !req.session.loginMetadata?.loginTime) {
    return next();
  }

  const loginTime = new Date(req.session.loginMetadata.loginTime).getTime();
  const now = Date.now();
  const maxSessionAge = 1000 * 60 * 60 * 24 * 7; // 7 days absolute maximum

  if (now - loginTime > maxSessionAge) {
    console.log("Session expired (absolute timeout):", {
      userId: req.session.userId,
      loginTime: req.session.loginMetadata.loginTime,
    });

    req.session.destroy((err) => {
      if (err) console.error("Error destroying session:", err);
    });

    res.status(401).json({ 
      error: "Session expired. Please log in again.",
      code: "SESSION_TIMEOUT"
    });
    return;
  }

  next();
};

/**
 * Concurrent Session Limiting - Limit number of active sessions per user
 * Prevents account sharing and credential stuffing
 * DISABLED: Set to allow unlimited concurrent sessions
 */
const userSessions = new Map<string, Set<string>>();
const MAX_SESSIONS_PER_USER = 999; // Effectively unlimited

export const limitConcurrentSessions: RequestHandler = (req, res, next) => {
  // DISABLED: Skip session limiting
  return next();
  
  /* Original logic commented out:
  if (!req.session?.userId) {
    return next();
  }

  const userId = req.session.userId;
  const sessionId = req.sessionID;

  if (!userSessions.has(userId)) {
    userSessions.set(userId, new Set([sessionId]));
    return next();
  }

  const sessions = userSessions.get(userId)!;
  
  if (!sessions.has(sessionId)) {
    if (sessions.size >= MAX_SESSIONS_PER_USER) {
      // Too many concurrent sessions
      console.warn("⚠️  Concurrent session limit exceeded:", {
        userId,
        currentSessions: sessions.size,
        ip: req.ip,
      });

      res.status(401).json({ 
        error: "Maximum number of concurrent sessions reached. Please log out from other devices.",
        code: "TOO_MANY_SESSIONS"
      });
      return;
    }
    
    sessions.add(sessionId);
  }

  next();
  */
};

/**
 * Clean up session tracking when session is destroyed
 */
export const cleanupSessionTracking = (sessionId: string, userId?: string) => {
  sessionFingerprints.delete(sessionId);
  
  if (userId) {
    const sessions = userSessions.get(userId);
    if (sessions) {
      sessions.delete(sessionId);
      if (sessions.size === 0) {
        userSessions.delete(userId);
      }
    }
  }
};

/**
 * Session Security Info - Get current session security status
 * Useful for debugging and monitoring
 */
export const getSessionSecurityInfo = (req: any) => {
  if (!req.session?.userId) {
    return null;
  }

  return {
    sessionId: req.sessionID,
    userId: req.session.userId,
    hasFingerprint: sessionFingerprints.has(req.sessionID),
    loginMetadata: req.session.loginMetadata,
    lastActivity: req.session.lastActivity,
    concurrentSessions: userSessions.get(req.session.userId)?.size || 0,
  };
};
