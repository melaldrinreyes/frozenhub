import { RequestHandler } from "express";
import { getConnection } from "../db";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "branch_admin" | "pos_operator" | "customer" | "rider";
  branch_id: string | null;
  created_at: string;
  google_id?: string | null;
}

// Extend Express types - compatible with Passport
declare global {
  namespace Express {
    interface User extends AuthUser {}
    interface Request {
      user?: AuthUser;
    }
  }
}

// Middleware to check if user is authenticated (session or JWT)
async function tableExists(connection: any, tableName: string): Promise<boolean> {
  try {
    const [rows] = await connection.query("SHOW TABLES LIKE ?", [tableName]);
    return (rows as any[]).length > 0;
  } catch {
    return false;
  }
}

async function usersActiveColumnExists(connection: any): Promise<boolean> {
  try {
    const [rows] = await connection.query("SHOW COLUMNS FROM users LIKE 'active'");
    return (rows as any[]).length > 0;
  } catch {
    return false;
  }
}

function isFalseLike(value: any): boolean {
  return value === false || value === 0 || String(value).toLowerCase() === "false";
}

async function isAccountDisabled(connection: any, userId: string, role: string): Promise<boolean> {
  const hasUserActive = await usersActiveColumnExists(connection);
  if (hasUserActive) {
    const [userRows] = await connection.query("SELECT active FROM users WHERE id = ? LIMIT 1", [userId]);
    const user = (userRows as any[])[0];
    if (!user) return true;
    if (isFalseLike(user.active)) return true;
  }

  if (role !== "rider") return false;

  const hasAssignmentTable = await tableExists(connection, "rider_branch_assignments");
  if (!hasAssignmentTable) return false;

  const [assignmentRows] = await connection.query(
    `SELECT active
     FROM rider_branch_assignments
     WHERE rider_id = ?
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [userId]
  );
  const assignment = (assignmentRows as any[])[0];
  if (!assignment) return false;

  return isFalseLike(assignment.active);
}

// Middleware to check if user is authenticated (session or JWT)
export const requireAuth: RequestHandler = async (req, res, next) => {
  // Check session (traditional method)
  const hasSessionAuth = Boolean(req.session?.userId);
  // Check JWT token (serverless compatible)
  const hasJwtAuth = Boolean(req.user && req.user.id);

  if (!hasSessionAuth && !hasJwtAuth) {
    console.warn(`Unauthorized access attempt to ${req.path} from ${req.ip}`);
    res.status(401).json({
      error: "Authentication required",
      message: "You must be logged in to access this resource"
    });
    return;
  }

  if (!req.user && req.session?.user) {
    req.user = req.session.user;
  }

  const effectiveUserId = req.user?.id || req.session?.userId;
  const effectiveRole = req.user?.role || req.session?.user?.role || req.session?.userRole;

  if (!effectiveUserId || !effectiveRole) {
    res.status(401).json({
      error: "Authentication required",
      message: "You must be logged in to access this resource"
    });
    return;
  }

  let connection: any = null;
  try {
    connection = await getConnection();
    const disabled = await isAccountDisabled(connection, String(effectiveUserId), String(effectiveRole));

    if (disabled) {
      try {
        req.session?.destroy?.(() => {});
      } catch {
        // no-op
      }

      res.status(403).json({
        error: "Account is disabled. Please contact an administrator.",
        disabled: true,
        forceLogout: true,
      });
      return;
    }
  } catch (error) {
    // Do not block authenticated traffic on transient DB failures.
    console.warn("Auth middleware status check skipped:", (error as any)?.message || error);
  } finally {
    connection?.release?.();
  }

  next();
};

// Middleware to check if user has specific role
export function requireRole(...allowedRoles: string[]): RequestHandler {
  return (req, res, next) => {
    const effectiveRole = req.user?.role || req.session?.user?.role || req.session?.userRole;
    const effectiveEmail = req.user?.email || req.session?.user?.email || "unknown";

    if (!effectiveRole) {
      console.warn(`Authentication missing for ${req.path} from ${req.ip}`);
      res.status(401).json({ 
        error: "Authentication required",
        message: "You must be logged in to access this resource"
      });
      return;
    }

    // Ensure req.user is available to downstream handlers when session auth is present.
    if (!req.user && req.session?.user) {
      req.user = req.session.user;
    }

    if (!allowedRoles.includes(effectiveRole)) {
      console.warn(
        `Access denied: User ${effectiveEmail} (${effectiveRole}) attempted to access ${req.path} requiring roles: ${allowedRoles.join(", ")}`
      );
      res.status(403).json({ 
        error: "Access denied", 
        message: `This action requires one of these roles: ${allowedRoles.join(", ")}`,
        userRole: effectiveRole,
        requiredRoles: allowedRoles
      });
      return;
    }

    next();
  };
}

// Middleware to check if user can access specific branch
export function requireBranchAccess(branchIdParam: string = "branchId"): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const branchId = req.params[branchIdParam] || req.body.branch_id || req.query.branch_id;

    // Admin can access any branch
    if (req.user.role === "admin") {
      next();
      return;
    }

    // Branch admin and POS operator can only access their own branch
    if ((req.user.role === "branch_admin" || req.user.role === "pos_operator") && req.user.branch_id !== branchId) {
      console.warn(
        `Branch access denied: User ${req.user.email} (branch: ${req.user.branch_id}) attempted to access branch ${branchId}`
      );
      res.status(403).json({ 
        error: "Access denied", 
        message: "You can only access your assigned branch" 
      });
      return;
    }

    next();
  };
}

// Middleware to check if user is admin or owns the resource
export function requireAdminOrOwner(userIdParam: string = "userId"): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const targetUserId = req.params[userIdParam] || req.body.user_id || req.query.user_id;

    // Admin can access any user
    if (req.user.role === "admin") {
      next();
      return;
    }

    // User can access their own data
    if (req.user.id === targetUserId) {
      next();
      return;
    }

    console.warn(
      `Resource access denied: User ${req.user.email} attempted to access user ${targetUserId}`
    );
    res.status(403).json({ 
      error: "Access denied", 
      message: "You can only access your own data" 
    });
    return;
  };
}

// Middleware to load user from session
export const loadUser: RequestHandler = (req, _res, next) => {
  if (req.session?.user) {
    req.user = req.session.user;
  }
  next();
};

// Middleware to check if user is verified (if verification system is implemented)
export const requireVerified: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // For future email verification feature
  // if (!req.user.email_verified) {
  //   res.status(403).json({ 
  //     error: "Email verification required",
  //     message: "Please verify your email address to access this resource"
  //   });
  //   return;
  // }

  next();
};

// Role hierarchy helper
export const roleHierarchy: Record<string, number> = {
  admin: 4,
  branch_admin: 3,
  pos_operator: 2,
  rider: 2,
  customer: 1,
};

// Middleware to check if user has minimum role level
export function requireMinRole(minRole: keyof typeof roleHierarchy): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const userLevel = roleHierarchy[req.user.role] || 0;
    const requiredLevel = roleHierarchy[minRole] || 0;

    if (userLevel < requiredLevel) {
      console.warn(
        `Insufficient permissions: User ${req.user.email} (${req.user.role}) attempted to access ${req.path} requiring ${minRole} or higher`
      );
      res.status(403).json({ 
        error: "Insufficient permissions", 
        message: `This action requires ${minRole} role or higher` 
      });
      return;
    }

    next();
  };
}
