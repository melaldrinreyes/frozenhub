import "express-session";
import { AuthUser } from "../middleware/auth";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userRole?: string;
    user?: AuthUser;
    lastActivity?: string;
    loginMetadata?: {
      ip: string;
      userAgent?: string;
      loginTime: string;
    };
  }
}
