import { RequestHandler } from "express";
import { getConnection } from "../db";
import { generateToken } from "../middleware/jwt";
import { AuthUser } from "../../shared/api";

interface SupabaseCallbackRequest {
  accessToken: string;
  email: string;
  googleId: string;
}

export const handleSupabaseCallback: RequestHandler = async (req, res) => {
  try {
    const { accessToken, email, googleId } =
      req.body as SupabaseCallbackRequest;

    if (!accessToken || !email || !googleId) {
      return res.status(400).json({
        message: "Missing required fields: accessToken, email, googleId",
      });
    }

    const connection = await getConnection();

    // Check if user exists by email or google_id
    let user = await connection.query(
      "SELECT * FROM users WHERE email = ? OR google_id = ?",
      [email, googleId]
    );

    if (user.length === 0) {
      // Create new customer user
      const newUser = await connection.query(
        "INSERT INTO users (email, name, google_id, role, created_at) VALUES (?, ?, ?, ?, NOW())",
        [email, email.split("@")[0], googleId, "customer"]
      );

      const userId = newUser.insertId;

      // Fetch the created user
      const createdUser = await connection.query(
        "SELECT id, name, email, phone, role, branch_id, created_at FROM users WHERE id = ?",
        [userId]
      );

      if (createdUser.length === 0) {
        return res
          .status(500)
          .json({ message: "Failed to create user account" });
      }

      user = createdUser;
    } else if (user[0].role !== "customer") {
      // Only customers can sign in with Google
      return res.status(403).json({
        message: "Google sign-in is only available for customer accounts",
      });
    } else if (!user[0].google_id) {
      // Link Google ID to existing customer account
      await connection.query("UPDATE users SET google_id = ? WHERE id = ?", [
        googleId,
        user[0].id,
      ]);
    }

    const authUser: AuthUser = {
      id: user[0].id,
      name: user[0].name || "",
      email: user[0].email,
      phone: user[0].phone || "",
      role: user[0].role,
      branch_id: user[0].branch_id,
      created_at: user[0].created_at,
    };

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
      message: "Successfully authenticated with Google",
    });
  } catch (error: any) {
    console.error("Supabase callback error:", error);
    return res.status(500).json({
      message: error.message || "Authentication failed",
    });
  }
};
