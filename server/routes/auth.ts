import { RequestHandler } from "express";
import { getConnection } from "../db";
import { disabledRoute } from "./disabled-data";
import { logActivity } from "./activity-logs";
import { cleanupSessionTracking } from "../middleware/sessionSecurity";

// Login endpoint
export const handleLogin = disabledRoute("handleLogin");

// Signup endpoint (for customers only)
export const handleSignup = disabledRoute("handleSignup");

// Logout endpoint
export const handleLogout: RequestHandler = (req, res) => {
  const currentUser = req.user || req.session?.user || null;
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

    void (async () => {
      let connection;
      try {
        connection = await getConnection();
        await logActivity(connection, {
          userId: currentUser?.id || userId || null,
          userName: currentUser?.name || null,
          userRole: currentUser?.role || null,
          action: "USER_LOGOUT",
          entityType: "auth",
          entityId: currentUser?.id || userId || null,
          entityName: currentUser?.name || null,
          description: `${currentUser?.name || "User"} logged out`,
          metadata: { sessionId },
          ipAddress: req.ip || null,
          branchId: currentUser?.branch_id || null,
        });
      } catch (logoutLogError) {
        console.error("Logout activity log error:", logoutLogError);
      } finally {
        connection?.release();
      }
    })();
    
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
