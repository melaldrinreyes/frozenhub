import { RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";
import { getConnection } from "../db";
import { generateToken } from "../middleware/jwt";
import type { AuthUser } from "../middleware/auth";

interface SupabaseCallbackRequest {
  accessToken: string;
}

function isMissingGoogleIdColumnError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("column \"google_id\" does not exist") ||
    message.includes("unknown column 'google_id'")
  );
}

async function ensureGoogleIdColumn(connection: any) {
  await connection.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`);
  await connection.query(`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`);
}

function makeUserId() {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const handleSupabaseCallback: RequestHandler = async (req, res) => {
  let connection: any;
  try {
    const { accessToken } = req.body as SupabaseCallbackRequest;

    if (!accessToken) {
      return res.status(400).json({
        message: "Missing required field: accessToken",
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({
        message: "Supabase auth is not configured on the server",
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const authClient = supabase.auth as any;
    const {
      data: { user: supabaseUser },
      error: userError,
    } = await authClient.getUser(accessToken);

    if (userError || !supabaseUser?.email) {
      return res.status(401).json({
        message: "Invalid Supabase session",
      });
    }

    const email = supabaseUser.email;
    const googleId = supabaseUser.id;
    const displayName =
      String(
        (supabaseUser.user_metadata as Record<string, unknown> | undefined)?.full_name ||
        (supabaseUser.user_metadata as Record<string, unknown> | undefined)?.name ||
        email.split("@")[0]
      ) || email.split("@")[0];

    connection = await getConnection();
    await ensureGoogleIdColumn(connection);

    // Check if user exists by email or google_id
    let userRow: any | null = null;
    try {
      const [rows] = await connection.query(
        "SELECT id, name, email, phone, role, branch_id, created_at, google_id FROM users WHERE email = ? OR google_id = ? LIMIT 1",
        [email, googleId]
      );
      userRow = (rows as any[])[0] || null;
    } catch (error) {
      if (!isMissingGoogleIdColumnError(error)) throw error;
      await ensureGoogleIdColumn(connection);
      const [rows] = await connection.query(
        "SELECT id, name, email, phone, role, branch_id, created_at, google_id FROM users WHERE email = ? OR google_id = ? LIMIT 1",
        [email, googleId]
      );
      userRow = (rows as any[])[0] || null;
    }

    if (!userRow) {
      // Create new customer user
      const newUserId = makeUserId();
      await connection.query(
        "INSERT INTO users (id, name, email, phone, password_hash, google_id, role, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
        [
          newUserId,
          displayName,
          email,
          "",
          `oauth-google-${googleId}`,
          googleId,
          "customer",
          null,
        ]
      );

      // Fetch the created user
      const [createdRows] = await connection.query(
        "SELECT id, name, email, phone, role, branch_id, created_at, google_id FROM users WHERE id = ? LIMIT 1",
        [newUserId]
      );
      const createdUser = (createdRows as any[])[0] || null;

      if (!createdUser) {
        return res
          .status(500)
          .json({ message: "Failed to create user account" });
      }

      userRow = createdUser;
    } else if (userRow.role !== "customer") {
      // Only customers can sign in with Google
      return res.status(403).json({
        message: "Google sign-in is only available for customer accounts",
      });
    } else if (!userRow.google_id) {
      // Link Google ID to existing customer account
      await connection.query("UPDATE users SET google_id = ? WHERE id = ?", [
        googleId,
        userRow.id,
      ]);
      userRow.google_id = googleId;
    }

    const authUser: AuthUser = {
      id: userRow.id,
      name: userRow.name || "",
      email: userRow.email,
      phone: userRow.phone || "",
      role: userRow.role as AuthUser["role"],
      branch_id: userRow.branch_id,
      created_at: userRow.created_at,
    };

    req.session.userId = authUser.id;
    req.session.userRole = authUser.role;
    req.session.user = authUser;

    // Persist session explicitly before responding to avoid race conditions
    // right after OAuth callback redirects.
    await new Promise<void>((resolve, reject) => {
      if (!req.session?.save) {
        resolve();
        return;
      }
      req.session.save((sessionError) => {
        if (sessionError) {
          reject(sessionError);
          return;
        }
        resolve();
      });
    });

    // Generate JWT token
    const token = generateToken(authUser);

    // Set JWT token in httpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({
      user: authUser,
      token,
      message: "Successfully authenticated with Google",
    });
  } catch (error: any) {
    console.error("Supabase callback error:", error);
    return res.status(500).json({
      message: error.message || "Authentication failed",
    });
  } finally {
    connection?.release?.();
  }
};
