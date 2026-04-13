import { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { getConnection } from "../db";
import { AuthUser } from "../middleware/auth";
import { generateToken } from "../middleware/jwt";
import { logActivity } from "./activity-logs";
import { consumeInventoryFifo, recordSaleItemBatchAllocations } from "../utils/inventory-fifo";
import fs from "fs";
import path from "path";

const BCRYPT_ROUNDS = 12;

function isDatabaseUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = String((error as any).code || "");
  const message = error.message.toLowerCase();
  return ["ECONNREFUSED", "PROTOCOL_CONNECTION_LOST", "ENOTFOUND", "ENETUNREACH", "ETIMEDOUT", "EAI_AGAIN"].includes(code) ||
    message.includes("econnrefused") ||
    message.includes("cannot reach ipv6") ||
    message.includes("supabase direct db host resolved to ipv6");
}

function logSqlProviderError(message: string, error: unknown) {
  if (isDatabaseUnavailableError(error)) return;
  console.error(message, error);
}
const DEV_ADMIN_EMAIL = String(process.env.DEV_ADMIN_EMAIL || "admin@gmail.com").trim();
const DEV_ADMIN_PASSWORD = String(process.env.DEV_ADMIN_PASSWORD || "admin123").trim();
const settingsFallbackPath = path.join(process.cwd(), "data", "settings-fallback.json");

function isDemoLoginEnabled(): boolean {
  return String(process.env.ALLOW_DEMO_LOGIN || "").trim().toLowerCase() === "true";
}

function readFallbackSettings(): Record<string, string | null> {
  try {
    if (!fs.existsSync(settingsFallbackPath)) return {};
    const raw = fs.readFileSync(settingsFallbackPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string | null>;
  } catch {
    return {};
  }
}

type DevFallbackUser = AuthUser & {
  password: string;
  identifiers: string[];
};

function normalizeImagePath(imageValue: any): string {
  if (!imageValue || typeof imageValue !== "string") {
    return "/placeholder.svg";
  }

  const trimmed = imageValue.trim();
  if (!trimmed) return "/placeholder.svg";
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;

  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (!normalized.startsWith("/uploads/")) return normalized;

  const absolutePath = path.join(process.cwd(), "public", normalized.replace(/^\//, ""));
  if (fs.existsSync(absolutePath)) return normalized;

  return "/placeholder.svg";
}

function getDevFallbackUsers(): DevFallbackUser[] {
  const createdAt = new Date("2023-01-01T00:00:00.000Z").toISOString();
  return [
    {
      id: "user-admin-001",
      name: "System Administrator",
      email: DEV_ADMIN_EMAIL,
      phone: "+1-555-0001",
      role: "admin",
      branch_id: null,
      created_at: createdAt,
      password: DEV_ADMIN_PASSWORD,
      identifiers: [DEV_ADMIN_EMAIL, "admin", "System Administrator"],
    },
    {
      id: "user-branch-fallback-001",
      name: "Branch Admin Demo",
      email: "branchadmin@gmail.com",
      phone: "+1-555-1001",
      role: "branch_admin",
      branch_id: "branch-001",
      created_at: createdAt,
      password: "branch123",
      identifiers: ["branchadmin@gmail.com", "branchadmin", "Branch Admin Demo"],
    },
    {
      id: "user-rider-fallback-001",
      name: "Rider Demo",
      email: "rider@gmail.com",
      phone: "+1-555-2001",
      role: "rider",
      branch_id: "branch-001",
      created_at: createdAt,
      password: "rider123",
      identifiers: ["rider@gmail.com", "rider", "Rider Demo"],
    },
    {
      id: "user-customer-fallback-001",
      name: "Customer Demo",
      email: "customer@gmail.com",
      phone: "+1-555-3001",
      role: "customer",
      branch_id: null,
      created_at: createdAt,
      password: "customer123",
      identifiers: ["customer@gmail.com", "customer", "Customer Demo"],
    },
  ];
}

async function tableExists(connection: any, tableName: string): Promise<boolean> {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );

  return Number((rows as any[])[0]?.cnt || 0) > 0;
}

function findDevFallbackUser(loginIdentifier: string, password: string): AuthUser | null {
  const normalizedIdentifier = String(loginIdentifier || "").trim().toLowerCase();
  const matched = getDevFallbackUsers().find((u) => {
    const hasIdentifier = u.identifiers.some((value) => value.toLowerCase() === normalizedIdentifier);
    return hasIdentifier && u.password === password;
  });

  if (!matched) return null;
  const { password: _password, identifiers: _identifiers, ...authUser } = matched;
  return authUser;
}

function getDevFallbackAdmin(): AuthUser {
  return {
    id: "user-admin-001",
    name: "System Administrator",
    email: DEV_ADMIN_EMAIL,
    phone: "+1-555-0001",
    role: "admin",
    branch_id: null,
    created_at: new Date("2023-01-01T00:00:00.000Z").toISOString(),
  };
}

export const handleLoginMySQL: RequestHandler = async (req, res) => {
  const { email, password, username, identifier } = req.body;
  const loginIdentifier = String(identifier || username || email || "").trim();

  if (!loginIdentifier || !password) {
    res.status(400).json({ error: "Username/email and password are required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM users WHERE email = ? OR (role = 'rider' AND name = ?) LIMIT 1",
      [loginIdentifier, loginIdentifier]
    );
    const user = (rows as any[])[0];

    if (!user) {
      res.status(401).json({ error: "Invalid username/email or password" });
      return;
    }

    // Accounts created via Google OAuth should continue using Google sign-in.
    if (user.google_id && String(user.password_hash || "").startsWith("oauth-google-")) {
      res.status(401).json({
        error: "This account uses Google sign-in. Please click Continue with Google.",
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: "Invalid username/email or password" });
      return;
    }

    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      branch_id: user.branch_id || null,
      created_at: user.created_at ? new Date(user.created_at).toISOString() : new Date().toISOString(),
    };

    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.user = authUser;

    const token = generateToken(authUser);

    await logActivity(connection, {
      userId: authUser.id,
      userName: authUser.name,
      userRole: authUser.role,
      action: "USER_LOGIN",
      entityType: "auth",
      entityId: authUser.id,
      entityName: authUser.name,
      description: "User logged into the system",
      metadata: {
        login_method: "email",
      },
      ipAddress: req.ip || null,
      branchId: authUser.branch_id || null,
    });

    res.json({ user: authUser, token });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres login error:", error);
    const errorMessage = error instanceof Error ? error.message : "";
    const isMissingConnectionConfig = errorMessage.includes("Missing Supabase database connection string");
    const allowDevFallback = process.env.NODE_ENV !== "production" || isDemoLoginEnabled();

    if (allowDevFallback) {
      const authUser = findDevFallbackUser(loginIdentifier, String(password));
      if (authUser) {
        req.session.userId = authUser.id;
        req.session.userRole = authUser.role;
        req.session.user = authUser;

        const token = generateToken(authUser);

        await logActivity(connection, {
          userId: authUser.id,
          userName: authUser.name,
          userRole: authUser.role,
          action: "USER_LOGIN",
          entityType: "auth",
          entityId: authUser.id,
          entityName: authUser.name,
          description: "User logged into the system using fallback credentials",
          metadata: {
            login_method: "fallback",
          },
          ipAddress: req.ip || null,
          branchId: authUser.branch_id || null,
        });

        console.warn("Warning: Supabase/Postgres is unreachable; using fallback login");
        res.json({ user: authUser, token });
        return;
      }

      if (loginIdentifier === DEV_ADMIN_EMAIL || loginIdentifier.toLowerCase() === "admin" || !loginIdentifier) {
        const authUser = getDevFallbackAdmin();
        req.session.userId = authUser.id;
        req.session.userRole = authUser.role;
        req.session.user = authUser;

        const token = generateToken(authUser);

        await logActivity(connection, {
          userId: authUser.id,
          userName: authUser.name,
          userRole: authUser.role,
          action: "USER_LOGIN",
          entityType: "auth",
          entityId: authUser.id,
          entityName: authUser.name,
          description: "Admin fallback login used while database is unreachable",
          metadata: {
            login_method: "fallback_admin",
          },
          ipAddress: req.ip || null,
          branchId: null,
        });

        console.warn("Warning: Supabase/Postgres is unreachable; using fallback admin login");
        res.json({ user: authUser, token });
        return;
      }
    }

    res.status(503).json({
      error: "Database backend unavailable",
      message: isMissingConnectionConfig
        ? errorMessage
        : "Login is unavailable until the Supabase/Postgres database is reachable.",
    });
  } finally {
    connection?.release();
  }
};

export const handleSignupMySQL: RequestHandler = async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !phone || !password) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    const [existingRows] = await connection.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if ((existingRows as any[]).length > 0) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const userId = `user-customer-${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await connection.query(
      `INSERT INTO users (id, name, email, phone, password_hash, role, branch_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'customer', NULL, NOW())`,
      [userId, name, email, phone, passwordHash]
    );

    const authUser: AuthUser = {
      id: userId,
      name,
      email,
      phone,
      role: "customer",
      branch_id: null,
      created_at: new Date().toISOString(),
    };

    req.session.userId = userId;
    req.session.userRole = "customer";
    req.session.user = authUser;

    await logActivity(connection, {
      userId: authUser.id,
      userName: authUser.name,
      userRole: authUser.role,
      action: "USER_SIGNUP",
      entityType: "auth",
      entityId: authUser.id,
      entityName: authUser.name,
      description: "Customer account created",
      metadata: { email: authUser.email },
      ipAddress: req.ip || null,
      branchId: null,
    });

    res.status(201).json({ user: authUser });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    connection?.release();
  }
};

export const handleGetProductsMySQL: RequestHandler = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT id, name, sku, barcode, category, description, price, cost, image, active, created_at
       FROM products
       ORDER BY created_at DESC`
    );

    const products = (rows as any[]).map((p) => ({
      ...p,
      image: normalizeImagePath(p.image),
    }));

    res.json({ products });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get products error:", error);
    res.json({ products: [] });
  } finally {
    connection?.release();
  }
};

export const handleGetProductMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT id, name, sku, barcode, category, description, price, cost, image, active, created_at
       FROM products
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    const product = (rows as any[])[0];
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json({
      product: {
        ...product,
        image: normalizeImagePath(product.image),
      },
    });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get product error:", error);
    res.json({ product: null });
  } finally {
    connection?.release();
  }
};

export const handleGetCategoriesMySQL: RequestHandler = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT id, name, description, active, created_at
       FROM categories
       ORDER BY name ASC`
    );

    res.json({ categories: rows });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get categories error:", error);
    res.json({ categories: [] });
  } finally {
    connection?.release();
  }
};

export const handleGetSettingsMySQL: RequestHandler = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT id, setting_key, setting_value, updated_at, updated_by
       FROM settings
       ORDER BY setting_key ASC`
    );
    res.json({ settings: rows });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get settings error:", error);
    const fallbackSettings = readFallbackSettings();
    const now = new Date().toISOString();
    const settings = Object.entries(fallbackSettings).map(([settingKey, settingValue]) => ({
      id: `fallback-${settingKey}`,
      setting_key: settingKey,
      setting_value: settingValue,
      updated_at: now,
      updated_by: null,
    }));
    res.json({ settings });
  } finally {
    connection?.release();
  }
};

export const handleGetSettingMySQL: RequestHandler = async (req, res) => {
  const { key } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT id, setting_key, setting_value, updated_at, updated_by
       FROM settings
       WHERE setting_key = ?
       LIMIT 1`,
      [key]
    );

    const setting = (rows as any[])[0] || null;
    res.json({ setting });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get setting error:", error);
    const fallbackSettings = readFallbackSettings();
    const fallbackValue = Object.prototype.hasOwnProperty.call(fallbackSettings, key) ? fallbackSettings[key] : null;
    res.json({
      setting: {
        id: `fallback-${key}`,
        setting_key: key,
        setting_value: fallbackValue,
        updated_at: new Date().toISOString(),
        updated_by: null,
      },
    });
  } finally {
    connection?.release();
  }
};

export const handleGetSystemStatsMySQL: RequestHandler = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [[productsCount], [branchesCount], [salesStats], [customerCount]] = await Promise.all([
      connection.query("SELECT COUNT(*) as total FROM products") as any,
      connection.query("SELECT COUNT(*) as total FROM branches") as any,
      connection.query("SELECT COUNT(*) as total, COALESCE(SUM(total_amount), 0) as revenue FROM sales") as any,
      connection.query("SELECT COUNT(*) as total FROM users WHERE role = 'customer'") as any,
    ]);

    res.json({
      stats: {
        products: { total: Number((productsCount as any[])[0].total || 0), active: Number((productsCount as any[])[0].total || 0) },
        branches: { total: Number((branchesCount as any[])[0].total || 0), active: Number((branchesCount as any[])[0].total || 0) },
        sales: {
          total: Number((salesStats as any[])[0].total || 0),
          revenue: Number((salesStats as any[])[0].revenue || 0),
        },
        customers: Number((customerCount as any[])[0].total || 0),
        support: "24/7",
      },
    });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres system stats error:", error);
    res.json({
      stats: {
        products: { total: 0, active: 0 },
        branches: { total: 0, active: 0 },
        sales: { total: 0, revenue: 0 },
        customers: 0,
        support: "24/7",
      },
    });
  } finally {
    connection?.release();
  }
};

export const getPromosMySQL: RequestHandler = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT p.*, COALESCE(pp.product_count, 0) as product_count
       FROM promos p
       LEFT JOIN (
         SELECT promo_id, COUNT(*) as product_count
         FROM product_promos
         GROUP BY promo_id
       ) pp ON pp.promo_id = p.id
       ORDER BY p.created_at DESC`
    );

    res.json({ promos: rows });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get promos error:", error);
    res.json({ promos: [] });
  } finally {
    connection?.release();
  }
};

export const getPromoMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();

    const [promoRows] = await connection.query("SELECT * FROM promos WHERE id = ? LIMIT 1", [id]);
    const promo = (promoRows as any[])[0];

    if (!promo) {
      res.status(404).json({ error: "Promo not found" });
      return;
    }

    const [productRows] = await connection.query(
      `SELECT p.id, p.name, p.sku, p.category, p.image, p.price
       FROM product_promos pp
       INNER JOIN products p ON p.id = pp.product_id
       WHERE pp.promo_id = ?
       ORDER BY p.name ASC`,
      [id]
    );

    const products = (productRows as any[]).map((p) => ({
      ...p,
      image: normalizeImagePath(p.image),
    }));

    res.json({ promo: { ...promo, products } });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get promo error:", error);
    res.status(500).json({ error: "Failed to fetch promo" });
  } finally {
    connection?.release();
  }
};

export const createPromoMySQL: RequestHandler = async (req, res) => {
  const {
    name,
    description,
    discount_type,
    discount_value,
    min_purchase,
    max_discount,
    start_date,
    end_date,
    active,
    product_ids,
  } = req.body || {};

  if (!name || !discount_type || discount_value === undefined || !start_date || !end_date) {
    res.status(400).json({ error: "Missing required promo fields" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    await connection.beginTransaction();

    const promoId = `promo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await connection.query(
      `INSERT INTO promos (
         id, name, description, discount_type, discount_value,
         min_purchase, max_discount, start_date, end_date, active, created_at, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        promoId,
        name,
        description || null,
        discount_type,
        Number(discount_value),
        min_purchase !== null && min_purchase !== undefined ? Number(min_purchase) : 0,
        max_discount !== null && max_discount !== undefined ? Number(max_discount) : null,
        start_date,
        end_date,
        active !== false,
        req.user?.id || req.session?.userId || null,
      ]
    );

    if (Array.isArray(product_ids) && product_ids.length > 0) {
      for (const productId of product_ids) {
        const mapId = `pp-${promoId}-${String(productId).slice(-8)}`;
        await connection.query(
          `INSERT INTO product_promos (id, promo_id, product_id, created_at)
           VALUES (?, ?, ?, NOW())`,
          [mapId, promoId, productId]
        );
      }
    }

    await connection.commit();

    const [createdRows] = await connection.query("SELECT * FROM promos WHERE id = ? LIMIT 1", [promoId]);
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "CREATE_PROMO",
      entityType: "promo",
      entityId: promoId,
      entityName: String(name),
      description: `Promo ${String(name)} created`,
      metadata: { discount_type, discount_value, min_purchase, max_discount, start_date, end_date, active, product_ids },
      ipAddress: req.ip || null,
      branchId: null,
    });
    res.status(201).json({ promo: (createdRows as any[])[0], message: "Promo created successfully" });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback failure
      }
    }
    logSqlProviderError("Supabase/Postgres create promo error:", error);
    res.status(500).json({ error: "Failed to create promo" });
  } finally {
    connection?.release();
  }
};

export const updatePromoMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    discount_type,
    discount_value,
    min_purchase,
    max_discount,
    start_date,
    end_date,
    active,
    product_ids,
  } = req.body || {};

  let connection;
  try {
    connection = await getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.query("SELECT id FROM promos WHERE id = ? LIMIT 1", [id]);
    if ((existingRows as any[]).length === 0) {
      await connection.rollback();
      res.status(404).json({ error: "Promo not found" });
      return;
    }

    await connection.query(
      `UPDATE promos
       SET name = ?, description = ?, discount_type = ?, discount_value = ?,
           min_purchase = ?, max_discount = ?, start_date = ?, end_date = ?, active = ?
       WHERE id = ?`,
      [
        name,
        description || null,
        discount_type,
        Number(discount_value),
        min_purchase !== null && min_purchase !== undefined ? Number(min_purchase) : 0,
        max_discount !== null && max_discount !== undefined ? Number(max_discount) : null,
        start_date,
        end_date,
        active !== false,
        id,
      ]
    );

    if (Array.isArray(product_ids)) {
      await connection.query("DELETE FROM product_promos WHERE promo_id = ?", [id]);
      for (const productId of product_ids) {
        const mapId = `pp-${id}-${String(productId).slice(-8)}-${Math.random().toString(36).slice(2, 5)}`;
        await connection.query(
          `INSERT INTO product_promos (id, promo_id, product_id, created_at)
           VALUES (?, ?, ?, NOW())`,
          [mapId, id, productId]
        );
      }
    }

    await connection.commit();

    const [updatedRows] = await connection.query("SELECT * FROM promos WHERE id = ? LIMIT 1", [id]);
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "UPDATE_PROMO",
      entityType: "promo",
      entityId: id,
      entityName: String(name || id),
      description: `Promo ${String(name || id)} updated`,
      metadata: { discount_type, discount_value, min_purchase, max_discount, start_date, end_date, active, product_ids },
      ipAddress: req.ip || null,
      branchId: null,
    });
    res.json({ promo: (updatedRows as any[])[0], message: "Promo updated successfully" });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback failure
      }
    }
    logSqlProviderError("Supabase/Postgres update promo error:", error);
    res.status(500).json({ error: "Failed to update promo" });
  } finally {
    connection?.release();
  }
};

export const deletePromoMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;

  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.query("DELETE FROM promos WHERE id = ?", [id]);
    const affectedRows = Number((result as any)?.affectedRows || 0);

    if (affectedRows === 0) {
      res.status(404).json({ error: "Promo not found" });
      return;
    }

    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "DELETE_PROMO",
      entityType: "promo",
      entityId: id,
      entityName: `Promo #${id}`,
      description: "Promo deleted",
      metadata: { promo_id: id },
      ipAddress: req.ip || null,
      branchId: null,
    });

    res.json({ message: "Promo deleted successfully" });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres delete promo error:", error);
    res.status(500).json({ error: "Failed to delete promo" });
  } finally {
    connection?.release();
  }
};

export const bulkUpdatePromosMySQL: RequestHandler = async (req, res) => {
  const { promo_ids, active } = req.body || {};

  if (!Array.isArray(promo_ids) || promo_ids.length === 0) {
    res.status(400).json({ error: "promo_ids is required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    const placeholders = promo_ids.map(() => "?").join(",");
    const [result] = await connection.query(
      `UPDATE promos SET active = ? WHERE id IN (${placeholders})`,
      [active !== false, ...promo_ids]
    );

    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "BULK_UPDATE_PROMOS",
      entityType: "promo",
      entityId: promo_ids.join(","),
      entityName: `${promo_ids.length} promos`,
      description: `Updated ${promo_ids.length} promos`,
      metadata: { promo_ids, active },
      ipAddress: req.ip || null,
      branchId: null,
    });

    res.json({
      message: "Promos updated successfully",
      affected: Number((result as any)?.affectedRows || 0),
    });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres bulk update promos error:", error);
    res.status(500).json({ error: "Failed to update promos" });
  } finally {
    connection?.release();
  }
};

export const getPromoAnalyticsMySQL: RequestHandler = async (req, res) => {
  const { startDate, endDate } = req.query;
  let connection;
  try {
    connection = await getConnection();

    const params: any[] = [];
    const dateWhere: string[] = [];
    if (startDate) {
      dateWhere.push("created_at >= ?");
      params.push(startDate);
    }
    if (endDate) {
      dateWhere.push("created_at <= ?");
      params.push(`${endDate} 23:59:59`);
    }
    const where = dateWhere.length > 0 ? `WHERE ${dateWhere.join(" AND ")}` : "";

    const [overviewRows] = await connection.query(
      `SELECT
         COUNT(*) as total_promos,
         SUM(CASE WHEN active = TRUE THEN 1 ELSE 0 END) as active_promos,
         SUM(CASE WHEN start_date <= NOW() AND end_date >= NOW() AND active = TRUE THEN 1 ELSE 0 END) as running_promos
       FROM promos
       ${where}`,
      params
    );

    const [topRows] = await connection.query(
      `SELECT p.id, p.name, COALESCE(pp.product_count, 0) as product_count
       FROM promos p
       LEFT JOIN (
         SELECT promo_id, COUNT(*) as product_count
         FROM product_promos
         GROUP BY promo_id
       ) pp ON pp.promo_id = p.id
       ORDER BY product_count DESC, p.created_at DESC
       LIMIT 10`
    );

    const [dailyRows] = await connection.query(
      `SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as date, COUNT(*) as count
       FROM promos
       ${where}
       GROUP BY TO_CHAR(DATE(created_at), 'YYYY-MM-DD')
       ORDER BY TO_CHAR(DATE(created_at), 'YYYY-MM-DD') ASC`,
      params
    );

    const overview = (overviewRows as any[])[0] || {};
    res.json({
      overview: {
        totalPromos: Number(overview.total_promos || 0),
        activePromos: Number(overview.active_promos || 0),
        runningPromos: Number(overview.running_promos || 0),
      },
      topPromos: topRows,
      dailyUsage: dailyRows,
    });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres promo analytics error:", error);
    res.json({ overview: { totalPromos: 0, activePromos: 0, runningPromos: 0 }, topPromos: [], dailyUsage: [] });
  } finally {
    connection?.release();
  }
};

export const getActivePromosMySQL: RequestHandler = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT p.*, COALESCE(pp.product_ids, '') as product_ids
       FROM promos p
       LEFT JOIN (
         SELECT promo_id, STRING_AGG(product_id, ',') as product_ids
         FROM product_promos
         GROUP BY promo_id
       ) pp ON pp.promo_id = p.id
       WHERE p.active = TRUE
         AND p.start_date <= NOW()
         AND p.end_date >= NOW()
       ORDER BY p.created_at DESC`
    );

    const promos = (rows as any[]).map((promo) => ({
      ...promo,
      product_ids: promo.product_ids ? String(promo.product_ids).split(",") : [],
    }));

    res.json({ promos });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres active promos error:", error);
    res.json({ promos: [] });
  } finally {
    connection?.release();
  }
};

export const getProductPromosMySQL: RequestHandler = async (req, res) => {
  const { productId } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT p.*
       FROM promos p
       INNER JOIN product_promos pp ON pp.promo_id = p.id
       WHERE pp.product_id = ?
         AND p.active = TRUE
         AND p.start_date <= NOW()
         AND p.end_date >= NOW()
       ORDER BY p.created_at DESC`,
      [productId]
    );

    res.json({ promos: rows });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres product promos error:", error);
    res.json({ promos: [] });
  } finally {
    connection?.release();
  }
};

export const handleGetBranchesMySQL: RequestHandler = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT id, name, location, phone, manager, created_at, TRUE as is_active
       FROM branches
       ORDER BY created_at DESC`
    );
    res.json({ branches: rows });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get branches error:", error);
    res.json({ branches: [] });
  } finally {
    connection?.release();
  }
};

export const handleGetInventoryMySQL: RequestHandler = async (req, res) => {
  const { branchId } = req.query;
  let connection;
  try {
    connection = await getConnection();
    const params: any[] = [];
    let where = "";

    if (branchId) {
      where = "WHERE i.branch_id = ?";
      params.push(branchId);
    }

    const [rows] = await connection.query(
      `SELECT i.id, i.product_id, i.branch_id, i.quantity, i.reorder_level, i.last_stock_check,
              p.name as product_name, p.sku, p.barcode, b.name as branch_name
       FROM inventory i
       LEFT JOIN products p ON p.id = i.product_id
       LEFT JOIN branches b ON b.id = i.branch_id
       ${where}
       ORDER BY i.last_stock_check DESC`,
      params
    );

    res.json({ inventory: rows });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get inventory error:", error);
    res.json({ inventory: [] });
  } finally {
    connection?.release();
  }
};

export const handleGetTransferLogsMySQL: RequestHandler = async (req, res) => {
  const { branchId, productId, startDate, endDate, limit } = req.query;
  let connection;
  try {
    connection = await getConnection();

    const clauses: string[] = [];
    const params: any[] = [];

    // Dashboard KPIs are labeled as completed orders only.
    clauses.push("status = 'completed'");

    if (branchId) {
      clauses.push("(from_branch_id = ? OR to_branch_id = ?)");
      params.push(branchId, branchId);
    }
    if (productId) {
      clauses.push("product_id = ?");
      params.push(productId);
    }
    if (startDate) {
      clauses.push("transfer_date >= ?");
      params.push(startDate);
    }
    if (endDate) {
      clauses.push("transfer_date <= ?");
      params.push(`${endDate} 23:59:59`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rowLimit = Math.min(Number(limit) || 100, 500);

    const [rows] = await connection.query(
      `SELECT id, transfer_date, product_id, product_name, from_branch_id, from_branch_name,
              to_branch_id, to_branch_name, quantity, reason, approved_by, approved_by_name,
              status, notes
       FROM stock_transfer_logs
       ${where}
       ORDER BY transfer_date DESC
       LIMIT ${rowLimit}`,
      params
    );

    res.json({ logs: rows, count: (rows as any[]).length });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get transfer logs error:", error);
    res.json({ logs: [], count: 0 });
  } finally {
    connection?.release();
  }
};

export const handleGetSalesMySQL: RequestHandler = async (req, res) => {
  const { branchId, startDate, endDate, page = 1, limit = 10, status } = req.query;
  const requesterRole = req.user?.role;
  let connection;
  try {
    connection = await getConnection();

    let resolvedBranchId = "";
    if (requesterRole === "branch_admin" || requesterRole === "pos_operator") {
      resolvedBranchId = String(req.user?.branch_id || "");
      if (!resolvedBranchId && req.user?.id) {
        const [userRows] = await connection.query(
          "SELECT branch_id FROM users WHERE id = ? LIMIT 1",
          [req.user.id]
        );
        resolvedBranchId = String((userRows as any[])[0]?.branch_id || "");
      }

      if (!resolvedBranchId) {
        res.status(400).json({ error: "Branch not set for this account" });
        return;
      }
    } else if (branchId) {
      resolvedBranchId = String(branchId);
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const clauses: string[] = [];
    const params: any[] = [];

    const requestedStatus = String(status || "").toLowerCase();
    const shouldLimitToCompleted = requestedStatus !== "all";

    // Keep the default list aligned with completed-order KPIs unless the caller
    // explicitly requests the full recent-sales feed for dashboard widgets.
    if (shouldLimitToCompleted) {
      clauses.push("status = 'completed'");
    }

    // Branch-scoped users can only access their assigned branch.
    if (requesterRole === "rider") {
      clauses.push("s.assigned_rider_id = ?");
      params.push(req.user?.id || "");
      if (resolvedBranchId) {
        clauses.push("s.branch_id = ?");
        params.push(resolvedBranchId);
      }
    } else if ((requesterRole === "branch_admin" || requesterRole === "pos_operator") && resolvedBranchId) {
      clauses.push("s.branch_id = ?");
      params.push(resolvedBranchId);
    } else if (resolvedBranchId) {
      clauses.push("s.branch_id = ?");
      params.push(resolvedBranchId);
    }
    if (startDate) {
      clauses.push("s.date >= ?");
      params.push(startDate);
    }
    if (endDate) {
      clauses.push("s.date <= ?");
      params.push(`${endDate} 23:59:59`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const [countRows] = await connection.query(
      `SELECT COUNT(*) as total FROM sales s ${where}`,
      params
    );
    const total = Number((countRows as any[])[0]?.total || 0);

    const [salesRows] = await connection.query(
            `SELECT s.id, s.date as sale_date, s.branch_id, s.total_amount, s.items_count,
              s.payment_method, s.status, s.created_by, s.assigned_rider_id, s.customer_info, s.notes,
              CASE
                WHEN s.payment_status IN ('succeeded', 'paid', 'completed') THEN 'succeeded'
                WHEN s.payment_status IN ('failed', 'cancelled') THEN 'failed'
                WHEN s.status = 'completed' AND s.payment_method = 'cash' THEN 'succeeded'
                ELSE COALESCE(s.payment_status, 'pending')
              END as payment_status,
              s.picked_up_at, s.delivered_at,
              rider.name as assigned_rider_name,
              CASE
                WHEN s.customer_info IS NULL OR TRIM(COALESCE(CONCAT('', s.customer_info), '')) IN ('', '{}', 'null') THEN 'pos'
                ELSE 'online'
              END as order_type,
              JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.name')) as customer_name,
              JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.phone')) as customer_phone,
              JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.address')) as customer_address,
              JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.email')) as customer_email
       FROM sales s
            LEFT JOIN users rider ON rider.id = s.assigned_rider_id
       ${where}
       ORDER BY s.date DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    const saleIds = (salesRows as any[]).map((sale) => sale.id).filter(Boolean);
    const itemsBySaleId = new Map<string, any[]>();

    if (saleIds.length > 0) {
      try {
        const placeholders = saleIds.map(() => "?").join(", ");
        const [itemRows] = await connection.query(
          `SELECT
             si.sale_id,
             si.product_id,
             si.quantity,
             si.price AS unit_price,
             si.price,
             si.total,
             si.subtotal,
             si.discount_amount,
             p.name AS product_name
           FROM sale_items si
           LEFT JOIN products p ON p.id = si.product_id
           WHERE si.sale_id IN (${placeholders})
           ORDER BY si.sale_id ASC, si.product_id ASC`,
          saleIds
        );

        for (const row of itemRows as any[]) {
          const key = String(row.sale_id || "");
          if (!itemsBySaleId.has(key)) {
            itemsBySaleId.set(key, []);
          }
          itemsBySaleId.get(key)?.push({
            ...row,
            product_name: row.product_name || row.product_id || "Unknown Product",
            quantity: Number(row.quantity || 0),
            unit_price: Number(row.unit_price || row.price || 0),
            price: Number(row.price || row.unit_price || 0),
            total: Number(row.total || row.subtotal || 0),
            subtotal: Number(row.subtotal || row.total || 0),
            discount_amount: Number(row.discount_amount || 0),
          });
        }
      } catch (itemError) {
        logSqlProviderError("Supabase/Postgres get sales items enrichment error:", itemError);
      }
    }

    const sales = (salesRows as any[]).map((sale) => {
      let parsedCustomerInfo = null;
      try {
        parsedCustomerInfo =
          typeof sale.customer_info === "string"
            ? JSON.parse(sale.customer_info || "null")
            : sale.customer_info;
      } catch {
        parsedCustomerInfo = null;
      }

      const normalizedSaleId = String(sale.id || "");
      const matchedItems = itemsBySaleId.get(normalizedSaleId) || [];
      const hasLegacySummary = Number(sale.items_count || 0) > 0 && Number(sale.total_amount || 0) > 0;

      const items = matchedItems.length > 0
        ? matchedItems
        : hasLegacySummary
          ? [
              {
                id: `legacy-${normalizedSaleId}`,
                sale_id: normalizedSaleId,
                product_id: null,
                product_name: "Legacy order summary",
                quantity: Number(sale.items_count || 0) || 1,
                unit_price: Number(sale.total_amount || 0),
                price: Number(sale.total_amount || 0),
                total: Number(sale.total_amount || 0),
                subtotal: Number(sale.total_amount || 0),
                discount_amount: 0,
                legacy: true,
              },
            ]
          : [];

      return {
        ...sale,
        customer_info: parsedCustomerInfo,
        items,
      };
    });

    res.json({
      sales,
      pagination: {
        total,
        page: pageNum,
        pages: total > 0 ? Math.ceil(total / limitNum) : 0,
        limit: limitNum,
      },
    });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get sales error:", error);
    res.json({ sales: [], pagination: { total: 0, page: 1, pages: 0, limit: 10 } });
  } finally {
    connection?.release();
  }
};

export const handleGetRiderDeliveryHistoryMySQL: RequestHandler = async (req, res) => {
  const riderId = req.user?.id;
  const role = req.user?.role;

  if (!riderId || role !== "rider") {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    const hasDeliveryHistoryTable = await tableExists(connection, "delivery_history");

    if (hasDeliveryHistoryTable) {
      const [rows] = await connection.query(
        `SELECT
           dh.id,
           dh.sale_id,
           dh.rider_id,
           dh.branch_id,
           dh.customer_name,
           dh.customer_phone,
           dh.customer_address,
           dh.total_amount,
           CASE
             WHEN dh.payment_status IN ('succeeded', 'paid', 'completed') THEN 'succeeded'
             WHEN dh.payment_status IN ('failed', 'cancelled') THEN 'failed'
             ELSE COALESCE(dh.payment_status, 'pending')
           END as payment_status,
           dh.picked_up_at,
           dh.delivered_at,
           dh.created_at
         FROM delivery_history dh
         WHERE dh.rider_id = ?
         ORDER BY dh.delivered_at DESC`,
        [riderId]
      );

      res.json({ history: rows });
      return;
    }

    const [fallbackRows] = await connection.query(
      `SELECT
         CONCAT('dh-', s.id) AS id,
         s.id AS sale_id,
         s.assigned_rider_id AS rider_id,
         s.branch_id,
         JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.name')) AS customer_name,
         JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.phone')) AS customer_phone,
         JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.address')) AS customer_address,
         s.total_amount,
         s.payment_status,
         s.picked_up_at,
         COALESCE(s.delivered_at, s.date) AS delivered_at,
         s.date AS created_at
       FROM sales s
       WHERE s.status = 'completed'
         AND s.assigned_rider_id = ?
         AND s.customer_info IS NOT NULL
       ORDER BY COALESCE(s.delivered_at, s.date) DESC`,
      [riderId]
    );

    res.json({ history: fallbackRows });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get rider delivery history error:", error);
    res.json({ history: [] });
  } finally {
    connection?.release();
  }
};

export const handleGetSalesStatsMySQL: RequestHandler = async (req, res) => {
  const { branchId, startDate, endDate } = req.query;
  const requesterRole = req.user?.role;
  let connection;
  try {
    connection = await getConnection();

    let resolvedBranchId = "";
    if (requesterRole === "branch_admin") {
      resolvedBranchId = String(req.user?.branch_id || "");
      if (!resolvedBranchId && req.user?.id) {
        const [userRows] = await connection.query(
          "SELECT branch_id FROM users WHERE id = ? LIMIT 1",
          [req.user.id]
        );
        resolvedBranchId = String((userRows as any[])[0]?.branch_id || "");
      }

      if (!resolvedBranchId) {
        res.status(400).json({ error: "Branch not set for this account" });
        return;
      }
    } else if (branchId) {
      resolvedBranchId = String(branchId);
    }

    const clauses: string[] = [];
    const params: any[] = [];

    if (requesterRole === "branch_admin" && resolvedBranchId) {
      clauses.push("branch_id = ?");
      params.push(resolvedBranchId);
    } else if (resolvedBranchId) {
      clauses.push("branch_id = ?");
      params.push(resolvedBranchId);
    }
    if (startDate) {
      clauses.push("date >= ?");
      params.push(startDate);
    }
    if (endDate) {
      clauses.push("date <= ?");
      params.push(`${endDate} 23:59:59`);
    }
    clauses.push("status = 'completed'");

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const [rows] = await connection.query(
      `SELECT COUNT(*) as totalSales,
              COALESCE(SUM(total_amount), 0) as totalRevenue,
              COALESCE(AVG(total_amount), 0) as avgOrderValue
       FROM sales
       ${where}`,
      params
    );

    const stats = (rows as any[])[0] || {};
    const totalSales = Number(stats.totalSales ?? stats.totalsales ?? 0);
    const totalRevenue = Number(stats.totalRevenue ?? stats.totalrevenue ?? 0);
    const avgOrderValue = Number(stats.avgOrderValue ?? stats.avgordervalue ?? 0);

    res.json({
      totalSales,
      totalRevenue,
      avgOrderValue,
      totalPurchases: 0,
      totalExpenses: 0,
      avgPurchaseValue: 0,
      totalProfit: totalRevenue,
      profitMargin: totalRevenue > 0 ? 100 : 0,
      topProducts: [],
      branchBreakdown: [],
    });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres sales stats error:", error);
    res.json({
      totalSales: 0,
      totalRevenue: 0,
      avgOrderValue: 0,
      totalPurchases: 0,
      totalExpenses: 0,
      avgPurchaseValue: 0,
      totalProfit: 0,
      profitMargin: 0,
      topProducts: [],
      branchBreakdown: [],
    });
  } finally {
    connection?.release();
  }
};

export const handleGetSalesTrendMySQL: RequestHandler = async (req, res) => {
  const { branchId, startDate, endDate, days } = req.query;
  let connection;
  try {
    connection = await getConnection();

    const formatLocalDate = (value: Date) => {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const formatLocalDateTime = (value: Date) => {
      const date = formatLocalDate(value);
      const hours = String(value.getHours()).padStart(2, "0");
      const minutes = String(value.getMinutes()).padStart(2, "0");
      const seconds = String(value.getSeconds()).padStart(2, "0");
      return `${date} ${hours}:${minutes}:${seconds}`;
    };

    const explicitStart = startDate ? new Date(String(startDate)) : null;
    const explicitEnd = endDate ? new Date(String(endDate)) : null;
    const hasExplicitRange = !!(explicitStart || explicitEnd);

    const dayCountRaw = Number(days);
    let dayCount = Number.isFinite(dayCountRaw) && dayCountRaw > 0 ? Math.min(Math.floor(dayCountRaw), 365) : 7;
    const end = explicitEnd || new Date();
    const start = explicitStart || new Date(end);
    if (!explicitStart) {
      start.setDate(start.getDate() - (dayCount - 1));
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (hasExplicitRange) {
      const diffMs = end.getTime() - start.getTime();
      const computedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
      dayCount = Math.max(1, Math.min(computedDays, 3650));
    }

    const requesterRole = req.user?.role;
    let resolvedBranchId = "";

    if (requesterRole === "branch_admin") {
      resolvedBranchId = String(req.user?.branch_id || "");
      if (!resolvedBranchId && req.user?.id) {
        const [userRows] = await connection.query(
          "SELECT branch_id FROM users WHERE id = ? LIMIT 1",
          [req.user.id]
        );
        resolvedBranchId = String((userRows as any[])[0]?.branch_id || "");
      }

      if (!resolvedBranchId) {
        res.status(400).json({ error: "Branch not set for this account" });
        return;
      }
    } else if (branchId) {
      resolvedBranchId = String(branchId);
    }

    const clauses: string[] = [];
    const params: any[] = [];

    if (requesterRole === "branch_admin" && resolvedBranchId) {
      clauses.push("branch_id = ?");
      params.push(resolvedBranchId);
    } else if (resolvedBranchId) {
      clauses.push("branch_id = ?");
      params.push(resolvedBranchId);
    }
    clauses.push("status = 'completed'");
    clauses.push("date >= ?");
    params.push(formatLocalDateTime(start));
    clauses.push("date <= ?");
    params.push(formatLocalDateTime(end));

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const [rows] = await connection.query(
      `SELECT DATE_FORMAT(date, '%b %d') as month,
              DATE_FORMAT(date, '%Y-%m-%d') as day_key,
              COALESCE(SUM(total_amount), 0) as sales,
              COUNT(*) as orders,
              COALESCE(SUM(items_count), 0) as items_sold
       FROM sales
       ${where}
       GROUP BY DATE_FORMAT(date, '%Y-%m-%d'), DATE_FORMAT(date, '%b %d')
       ORDER BY day_key ASC`,
      params
    );

    const resultRows = rows as any[];
    const trend: any[] = [];
    const cursor = new Date(start);

    for (let index = 0; index < dayCount; index++) {
      const dayKey = formatLocalDate(cursor);
      const label = cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const match = resultRows.find((row) => row.day_key === dayKey);

      trend.push({
        month: label,
        date: dayKey,
        sales: match ? Number(match.sales || 0) : 0,
        orders: match ? Number(match.orders || 0) : 0,
        items_sold: match ? Number(match.items_sold || 0) : 0,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    res.json({ trend });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres sales trend error:", error);
    res.json({ trend: [] });
  } finally {
    connection?.release();
  }
};

export const handleGetPricingMySQL: RequestHandler = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT pr.*, p.name as product_name
       FROM pricing pr
       LEFT JOIN products p ON p.id = pr.product_id
       ORDER BY pr.effective_from DESC, pr.id DESC`
    );

    res.json({ pricing: rows });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres get pricing error:", error);
    res.json({ pricing: [] });
  } finally {
    connection?.release();
  }
};

export const handleCreatePricingMySQL: RequestHandler = async (req, res) => {
  const { productId, basePrice, wholesalePrice, retailPrice, distributorPrice, markup } = req.body || {};

  if (!productId) {
    res.status(400).json({ error: "productId is required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();

    const [productRows] = await connection.query("SELECT id FROM products WHERE id = ? LIMIT 1", [productId]);
    if ((productRows as any[]).length === 0) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const id = `pricing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await connection.query(
      `INSERT INTO pricing (
         id, product_id, base_price, wholesale_price, retail_price,
         distributor_price, markup, effective_from, effective_to
       ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NULL)`,
      [
        id,
        productId,
        Number(basePrice || 0),
        Number(wholesalePrice || 0),
        Number(retailPrice || 0),
        Number(distributorPrice || 0),
        Number(markup || 0),
      ]
    );

    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "CREATE_PRICING",
      entityType: "pricing",
      entityId: id,
      entityName: `Pricing for ${productId}`,
      description: `Pricing created for product ${productId}`,
      metadata: { productId, basePrice, wholesalePrice, retailPrice, distributorPrice, markup },
      ipAddress: req.ip || null,
      branchId: null,
    });

    res.status(201).json({ message: "Pricing created successfully", id });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres create pricing error:", error);
    res.status(500).json({ error: "Failed to create pricing" });
  } finally {
    connection?.release();
  }
};

export const handleUpdatePricingMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { basePrice, wholesalePrice, retailPrice, distributorPrice, markup } = req.body || {};

  let connection;
  try {
    connection = await getConnection();

    const [existing] = await connection.query("SELECT id FROM pricing WHERE id = ? LIMIT 1", [id]);
    if ((existing as any[]).length === 0) {
      res.status(404).json({ error: "Pricing not found" });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (basePrice !== undefined) {
      updates.push("base_price = ?");
      values.push(Number(basePrice));
    }
    if (wholesalePrice !== undefined) {
      updates.push("wholesale_price = ?");
      values.push(Number(wholesalePrice));
    }
    if (retailPrice !== undefined) {
      updates.push("retail_price = ?");
      values.push(Number(retailPrice));
    }
    if (distributorPrice !== undefined) {
      updates.push("distributor_price = ?");
      values.push(Number(distributorPrice));
    }
    if (markup !== undefined) {
      updates.push("markup = ?");
      values.push(Number(markup));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    values.push(id);

    await connection.query(`UPDATE pricing SET ${updates.join(", ")} WHERE id = ?`, values);

    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "UPDATE_PRICING",
      entityType: "pricing",
      entityId: id,
      entityName: `Pricing #${id}`,
      description: `Pricing ${id} updated`,
      metadata: { basePrice, wholesalePrice, retailPrice, distributorPrice, markup },
      ipAddress: req.ip || null,
      branchId: null,
    });

    res.json({ message: "Pricing updated successfully" });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres update pricing error:", error);
    res.status(500).json({ error: "Failed to update pricing" });
  } finally {
    connection?.release();
  }
};

export const handleDeletePricingMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;

  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.query("DELETE FROM pricing WHERE id = ?", [id]);

    const affectedRows = Number((result as any)?.affectedRows || 0);
    if (affectedRows === 0) {
      res.status(404).json({ error: "Pricing not found" });
      return;
    }

    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "DELETE_PRICING",
      entityType: "pricing",
      entityId: id,
      entityName: `Pricing #${id}`,
      description: `Pricing ${id} deleted`,
      metadata: { pricing_id: id },
      ipAddress: req.ip || null,
      branchId: null,
    });

    res.json({ message: "Pricing deleted successfully" });
  } catch (error) {
    logSqlProviderError("Supabase/Postgres delete pricing error:", error);
    res.status(500).json({ error: "Failed to delete pricing" });
  } finally {
    connection?.release();
  }
};

export const handleCreateSaleMySQL: RequestHandler = async (req, res) => {
  const { branchId, items, paymentMethod, totalAmount, notes } = req.body || {};

  if (!branchId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "branchId and items are required" });
    return;
  }

  const normalizedPaymentMethod =
    paymentMethod === "cash" ||
    paymentMethod === "card" ||
    paymentMethod === "gcash" ||
    paymentMethod === "paymaya" ||
    paymentMethod === "bank_transfer" ||
    paymentMethod === "online"
      ? paymentMethod
      : "cash";

  let connection;
  try {
    connection = await getConnection();
    await connection.beginTransaction();

    const saleItems: Array<{
      id: string;
      product_id: string;
      quantity: number;
      price: number;
      total: number;
      subtotal: number;
      discount_amount: number;
      fifoAllocations: Array<{
        batchId: string;
        quantity: number;
        unitCost: number;
        totalCost: number;
        receivedAt: string;
      }>;
    }> = [];

    let computedSubtotal = 0;
    let totalQuantity = 0;

    for (const rawItem of items) {
      const productId = rawItem?.productId;
      const quantity = Number(rawItem?.quantity || 0);

      if (!productId || quantity <= 0) {
        throw new Error("Invalid sale item payload");
      }

      const [invRows] = await connection.query(
        `SELECT i.id, i.quantity, p.price
         FROM inventory i
         INNER JOIN products p ON p.id = i.product_id
         WHERE i.branch_id = ? AND i.product_id = ?
         LIMIT 1
         FOR UPDATE`,
        [branchId, productId]
      );

      const inv = (invRows as any[])[0];
      if (!inv) {
        throw new Error(`Product ${productId} is not available in this branch`);
      }

      const availableQty = Number(inv.quantity || 0);
      if (availableQty < quantity) {
        throw new Error(`Insufficient stock for product ${productId}`);
      }

      const unitPrice = Number(inv.price || 0);
      const lineTotal = Number((unitPrice * quantity).toFixed(2));

      saleItems.push({
        id: `sale-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        product_id: productId,
        quantity,
        price: unitPrice,
        total: lineTotal,
        subtotal: lineTotal,
        discount_amount: 0,
        fifoAllocations: await consumeInventoryFifo(connection, {
          productId: String(productId),
          branchId: String(branchId),
          quantity,
        }),
      });

      computedSubtotal += lineTotal;
      totalQuantity += quantity;

      await connection.query(
        `UPDATE inventory
         SET quantity = quantity - ?, last_stock_check = NOW()
         WHERE branch_id = ? AND product_id = ?`,
        [quantity, branchId, productId]
      );
    }

    const finalTotalRaw = Number(totalAmount);
    const finalTotal = Number.isFinite(finalTotalRaw) ? finalTotalRaw : computedSubtotal;
    const discountAmount = Math.max(0, Number((computedSubtotal - finalTotal).toFixed(2)));

    const saleId = `sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdBy = req.user?.id || req.session?.userId || null;

    await connection.query(
      `INSERT INTO sales (
         id, date, branch_id, total_amount, items_count, payment_method, status,
         created_by, customer_info, notes, subtotal, discount_amount
       ) VALUES (?, NOW(), ?, ?, ?, ?, 'completed', ?, NULL, ?, ?, ?)`,
      [
        saleId,
        branchId,
        finalTotal,
        totalQuantity,
        normalizedPaymentMethod,
        createdBy,
        notes || null,
        computedSubtotal,
        discountAmount,
      ]
    );

    for (const item of saleItems) {
      await connection.query(
        `INSERT INTO sale_items (
           id, sale_id, product_id, quantity, price, total, subtotal, discount_amount, promo_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          item.id,
          saleId,
          item.product_id,
          item.quantity,
          item.price,
          item.total,
          item.subtotal,
          item.discount_amount,
        ]
      );

      await recordSaleItemBatchAllocations(connection, item.id, item.fifoAllocations);
    }

    await connection.commit();

    await logActivity(connection, {
      userId: req.user?.id || req.session?.userId || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "CREATE_SALE",
      entityType: "sale",
      entityId: saleId,
      entityName: `Sale #${saleId}`,
      description: "Sale created successfully",
      metadata: {
        branchId,
        paymentMethod: normalizedPaymentMethod,
        totalAmount: finalTotal,
        itemsCount: totalQuantity,
        subtotal: computedSubtotal,
        discountAmount,
      },
      ipAddress: req.ip || null,
      branchId: String(branchId),
    });

    res.status(201).json({
      saleId,
      summary: {
        total: finalTotal,
        items_count: totalQuantity,
        subtotal: computedSubtotal,
        discount_amount: discountAmount,
      },
      message: "Sale created successfully",
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback failure
      }
    }

    const message = error instanceof Error ? error.message : "Failed to create sale";
    const isValidationError =
      message.includes("Invalid sale item") ||
      message.includes("Insufficient stock") ||
      message.includes("not available in this branch");

    logSqlProviderError("Supabase/Postgres create sale error:", error);
    res.status(isValidationError ? 400 : 503).json({ error: message });
  } finally {
    connection?.release();
  }
};

