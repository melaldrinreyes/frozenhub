import { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { AuthUser } from "../middleware/auth";
import { disabledRoute } from "./disabled-data";
import { 
  regenerateSession, 
  cleanupSessionTracking
} from "../middleware/sessionSecurity";

// Enhanced bcrypt rounds for better security (12 rounds - good balance)
const BCRYPT_ROUNDS = 12;

// Password strength validation
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  return { valid: true };
}

// Email validation
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Login endpoint
export const handleLogin = disabledRoute("handleLogin");

// Signup endpoint (for customers only)
export const handleSignup = disabledRoute("handleSignup");

// Logout endpoint
export const handleLogout: RequestHandler = (req, res) => {
  const sessionId = req.sessionID;
  const userId = req.session?.userId;

  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      res.status(500).json({ error: "Failed to logout" });
      return;
    }
    
    // Clean up session tracking
    cleanupSessionTracking(sessionId, userId);
    
    res.clearCookie("sessionId"); // Match the custom session name
    
    console.log("✅ Logout successful:", { userId, sessionId });
    res.json({ message: "Logged out successfully" });
  });
};

// Get current user
export const handleGetMe: RequestHandler = (req, res) => {
  const sessionUser = req.session?.user || null;
  const tokenUser = req.user || null;

  const currentUser = tokenUser || sessionUser;

  if (currentUser && req.session) {
    req.session.userId = currentUser.id;
    req.session.userRole = currentUser.role;
    req.session.user = currentUser;
  }

  res.json({ user: currentUser });
};

// Google OAuth removed by project configuration.
