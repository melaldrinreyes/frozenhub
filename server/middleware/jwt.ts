import jwt from "jsonwebtoken";
import { Request, RequestHandler } from "express";
import { AuthUser } from "./auth";

const JWT_SECRET = process.env.JWT_SECRET || "frozenhub-jwt-secret-change-in-production";
const JWT_EXPIRY = "7d";

export interface PayloadWithToken extends AuthUser {
  iat?: number;
  exp?: number;
}

/**
 * Generate JWT token from user data
 * For Vercel serverless compatibility
 */
export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): PayloadWithToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as PayloadWithToken;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware to extract JWT from Authorization header
 * Format: Bearer <token>
 */
export const jwtMiddleware: RequestHandler = (req, _res, next) => {
  const authHeader = req.get("authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  const payload = verifyToken(token);

  if (payload) {
    // Attach user to request for use in routes
    (req as Request & { user?: PayloadWithToken }).user = payload;
  }

  return next();
};
