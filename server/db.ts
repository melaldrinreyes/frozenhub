import bcrypt from "bcryptjs";
import dns from "dns";
import { Pool, PoolClient, QueryResult, QueryResultRow, types } from "pg";

types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));
types.setTypeParser(20, (value) => (value === null ? null : Number(value)));

type QueryValue = string | number | boolean | null | Date | Buffer | QueryValue[] | Record<string, unknown>;

type QueryResultHeader = {
  affectedRows: number;
  changedRows?: number;
  insertId?: string | number | null;
};

type QueryResponse<T extends QueryResultRow = any> = [T[] | QueryResultHeader, QueryResult<T>];

let pool: Pool | null = null;
let publicDnsFallbackPool: Pool | null = null;

function getConnectionString() {
  return (
    process.env.SUPABASE_POOLER_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.PGURL ||
    process.env.DB_URL ||
    ""
  ).trim();
}

function shouldUseSsl() {
  const explicit = String(process.env.DATABASE_SSL || process.env.PGSSLMODE || "").toLowerCase();
  if (explicit === "disable" || explicit === "false" || explicit === "0") return false;
  return Boolean(getConnectionString() || String(process.env.DB_HOST || "").includes("supabase"));
}

function isSupabaseDataProviderEnabled() {
  return String(process.env.DATA_PROVIDER || "supabase").toLowerCase() !== "none";
}

function getPoolConfig() {
  const connectionString = getConnectionString();
  const isServerlessRuntime = Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const configuredMax = Number(process.env.DB_POOL_MAX || "");
  const poolMax = Number.isFinite(configuredMax) && configuredMax > 0
    ? Math.max(1, Math.floor(configuredMax))
    : isServerlessRuntime
      ? 1
      : 10;

  const configuredIdleTimeout = Number(process.env.DB_POOL_IDLE_TIMEOUT_MS || "");
  const idleTimeoutMillis = Number.isFinite(configuredIdleTimeout) && configuredIdleTimeout >= 0
    ? Math.floor(configuredIdleTimeout)
    : isServerlessRuntime
      ? 2_000
      : 10_000;

  const configuredConnectTimeout = Number(process.env.DB_POOL_CONNECT_TIMEOUT_MS || "");
  const connectionTimeoutMillis = Number.isFinite(configuredConnectTimeout) && configuredConnectTimeout >= 0
    ? Math.floor(configuredConnectTimeout)
    : 10_000;

  if (connectionString) {
    return {
      connectionString,
      max: poolMax,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      ssl: shouldUseSsl() ? { rejectUnauthorized: false } : undefined,
    };
  }

  if (isSupabaseDataProviderEnabled()) {
    throw new Error("Missing Supabase database connection string. Set DATABASE_URL or SUPABASE_DATABASE_URL in your environment.");
  }

  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || 5432);
  const user = process.env.DB_USER || "postgres";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "postgres";

  return {
    host,
    port: Number.isFinite(port) ? port : 5432,
    user,
    password,
    database,
    max: poolMax,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    ssl: shouldUseSsl() ? { rejectUnauthorized: false } : undefined,
  };
}

function isDnsResolutionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = String((error as any).code || "");
  const message = error.message.toLowerCase();
  return code === "ENOTFOUND" || message.includes("enotfound");
}

function isIpv6UnreachableError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = String((error as any).code || "");
  const address = String((error as any).address || "");
  return code === "ENETUNREACH" && address.includes(":");
}

function normalizeConnectivityError(error: unknown) {
  if (isIpv6UnreachableError(error)) {
    const normalized = new Error(
      "Supabase direct DB host resolved to IPv6 but this network cannot reach IPv6. Use the Supabase pooler connection string in SUPABASE_POOLER_URL (or DATABASE_URL)."
    ) as Error & { code?: string };
    // Preserve a network-style code so higher-level fallback logic can recognize this as connectivity-related.
    normalized.code = "ENETUNREACH";
    return normalized;
  }
  return error;
}

async function resolveHostWithPublicDns(host: string) {
  const resolver = new dns.promises.Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);

  try {
    const ipv4 = await resolver.resolve4(host);
    if (ipv4.length > 0) return ipv4[0];
  } catch {
    // Ignore and attempt IPv6 next.
  }

  try {
    const ipv6 = await resolver.resolve6(host);
    if (ipv6.length > 0) return ipv6[0];
  } catch {
    // Ignore and return null below.
  }

  return null;
}

async function getPublicDnsFallbackPool() {
  if (publicDnsFallbackPool) return publicDnsFallbackPool;

  const connectionString = getConnectionString();
  if (!connectionString) return null;

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    return null;
  }

  const hostname = parsed.hostname;
  if (!hostname) return null;

  const resolvedHost = await resolveHostWithPublicDns(hostname);
  if (!resolvedHost) return null;

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "") || "postgres");
  const user = decodeURIComponent(parsed.username || "postgres");
  const password = decodeURIComponent(parsed.password || "");
  const port = Number(parsed.port || 5432);

  publicDnsFallbackPool = new Pool({
    host: resolvedHost,
    port: Number.isFinite(port) ? port : 5432,
    user,
    password,
    database,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: shouldUseSsl() ? { rejectUnauthorized: false, servername: hostname } : undefined,
  });

  return publicDnsFallbackPool;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(getPoolConfig());
  }
  return pool;
}

function normalizeDateFormat(format: string) {
  const mapping: Record<string, string> = {
    "%b %d": "Mon DD",
    "%Y-%m-%d": "YYYY-MM-DD",
    "%Y-%m": "YYYY-MM",
    "%Y-%m-%d %H:%i": "YYYY-MM-DD HH24:MI",
  };
  return mapping[format] || "YYYY-MM-DD";
}

function normalizeJsonExtract(sql: string) {
  return sql.replace(
    /JSON_UNQUOTE\(JSON_EXTRACT\(([^,]+),\s*'\$\.([^']+)'\)\)/gi,
    (_match, expression: string, path: string) => {
      const pathParts = String(path)
        .split(".")
        .map((part) => part.trim())
        .filter(Boolean)
        .join(",");
      return `(((${expression.trim()})::jsonb) #>> '{${pathParts}}')`;
    }
  );
}

function normalizeSql(sql: string, values: QueryValue[] = []) {
  let text = String(sql).trim();

  text = text.replace(/`/g, '"');
  text = text.replace(/\bDATABASE\(\)/gi, "current_schema()");
  text = text.replace(/\bIFNULL\(/gi, "COALESCE(");
  text = text.replace(/DATE_FORMAT\(([^,]+),\s*'([^']+)'\)/gi, (_match, expression: string, format: string) => {
    return `TO_CHAR(${expression.trim()}, '${normalizeDateFormat(format)}')`;
  });
  text = normalizeJsonExtract(text);

  let index = 0;
  text = text.replace(/\?/g, () => `$${++index}`);

  return { text, values };
}

function buildShowColumnsResult(tableName: string, columnName: string) {
  const columnTypes: Record<string, Record<string, string>> = {
    sales: {
      payment_status: "enum('pending','succeeded','failed')",
      status: "enum('pending','preparing','ready','picked_up','out_for_delivery','completed','cancelled')",
      customer_info: "jsonb",
      notes: "text",
      assigned_rider_id: "text",
      picked_up_at: "timestamp",
      delivered_at: "timestamp",
    },
    purchases: {
      status: "enum('received','pending','cancelled')",
    },
  };

  const type = columnTypes[tableName]?.[columnName];
  if (!type) return [];

  return [
    {
      Field: columnName,
      Type: type,
      Null: "YES",
      Key: "",
      Default: null,
      Extra: "",
    },
  ];
}

function buildShowIndexResult(tableName: string, keyName: string) {
  const knownIndexes: Record<string, Set<string>> = {
    products: new Set(["idx_barcode"]),
  };

  if (!knownIndexes[tableName]?.has(keyName)) return [];
  return [{ Table: tableName, Key_name: keyName }];
}

function normalizePgError(error: unknown) {
  const err = error as any;
  const code = String(err?.code || "");
  const message = String(err?.message || "");

  if (code === "23505") {
    const duplicate = new Error(`Duplicate entry: ${message}`) as Error & { code?: string };
    duplicate.code = "ER_DUP_ENTRY";
    return duplicate;
  }

  if (code === "23503") {
    const fkError = new Error(`Cannot delete or update a parent row: a foreign key constraint fails (${message})`) as Error & {
      code?: string;
    };
    fkError.code = "ER_ROW_IS_REFERENCED_2";
    return fkError;
  }

  return error;
}

function formatQueryResult<T extends QueryResultRow>(sql: string, result: QueryResult<T>): QueryResponse<T> {
  const trimmed = sql.trim().toLowerCase();
  if (trimmed.startsWith("select") || trimmed.startsWith("with") || trimmed.startsWith("show")) {
    return [result.rows, result];
  }

  const firstRow = result.rows?.[0] || null;
  const header: QueryResultHeader = {
    affectedRows: result.rowCount ?? 0,
    changedRows: result.rowCount ?? 0,
    insertId: firstRow && typeof firstRow === "object" && "id" in firstRow ? (firstRow as any).id : null,
  };

  return [header, result];
}

class PgConnection {
  private client: PoolClient | null = null;
  private transactionActive = false;

  constructor(private readonly pool: Pool) {}

  private async getClient() {
    if (this.client) return this.client;
    this.client = await this.pool.connect();
    return this.client;
  }

  async query<T extends QueryResultRow = any>(sql: string, values: QueryValue[] = []): Promise<QueryResponse<T>> {
    const normalized = normalizeSql(sql, values);

    if (normalized.text.toLowerCase().startsWith("show columns from")) {
      const match = normalized.text.match(/^show\s+columns\s+from\s+"?([\w-]+)"?\s+like\s+(.+)$/i);
      if (match) {
        const tableName = match[1].replace(/"/g, "");
        const likeValue = String(values[0] ?? match[2]).replace(/^'|'$/g, "").replace(/^\$/g, "");
        return [buildShowColumnsResult(tableName, likeValue) as any, { rows: [] as any[], rowCount: 0 } as QueryResult<T>];
      }
    }

    if (normalized.text.toLowerCase().startsWith("show tables like")) {
      const tableName = String(values[0] ?? "").replace(/^'|'$/g, "");
      return [[tableName ? { table_name: tableName } : []].flat() as any, { rows: [] as any[], rowCount: 0 } as QueryResult<T>];
    }

    if (normalized.text.toLowerCase().startsWith("show index from")) {
      const match = normalized.text.match(/^show\s+index\s+from\s+"?([\w-]+)"?\s+where\s+key_name\s*=\s*'([^']+)'/i);
      if (match) {
        const tableName = match[1].replace(/"/g, "");
        const keyName = match[2];
        return [buildShowIndexResult(tableName, keyName) as any, { rows: [] as any[], rowCount: 0 } as QueryResult<T>];
      }
    }

    try {
      const runner = this.client ?? this.pool;
      const result = await runner.query(normalized.text, normalized.values as any[]);
      return formatQueryResult<T>(sql, result);
    } catch (error) {
      if (!this.client && isDnsResolutionError(error)) {
        const fallbackPool = await getPublicDnsFallbackPool();
        if (fallbackPool) {
          try {
            const result = await fallbackPool.query(normalized.text, normalized.values as any[]);
            return formatQueryResult<T>(sql, result);
          } catch (fallbackError) {
            throw normalizePgError(normalizeConnectivityError(fallbackError));
          }
        }
      }

      throw normalizePgError(normalizeConnectivityError(error));
    }
  }

  async beginTransaction() {
    const client = await this.getClient();
    await client.query("BEGIN");
    this.transactionActive = true;
  }

  async commit() {
    if (!this.client || !this.transactionActive) return;
    await this.client.query("COMMIT");
    this.transactionActive = false;
  }

  async rollback() {
    if (!this.client || !this.transactionActive) return;
    await this.client.query("ROLLBACK");
    this.transactionActive = false;
  }

  release() {
    if (this.client) {
      this.client.release();
      this.client = null;
      this.transactionActive = false;
    }
  }
}

export async function getConnection() {
  return new PgConnection(getPool());
}

async function executeStatements(connection: PgConnection, statements: string[]) {
  for (const statement of statements) {
    await connection.query(statement);
  }
}

async function ensureSchema(connection: PgConnection) {
  await executeStatements(connection, [
    `CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      phone TEXT NOT NULL,
      manager TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'branch_admin', 'pos_operator', 'customer', 'rider')),
      branch_id TEXT NULL REFERENCES branches(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
      image TEXT NOT NULL DEFAULT '/placeholder.svg',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 50,
      last_stock_check TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT unique_product_branch UNIQUE (product_id, branch_id)
    )`,
    `CREATE TABLE IF NOT EXISTS pricing (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      base_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      wholesale_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      retail_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      distributor_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      markup NUMERIC(10, 2) NOT NULL DEFAULT 0,
      effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      effective_to TIMESTAMPTZ NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
      total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
      items_count INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'gcash', 'paymaya', 'bank_transfer', 'online')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'completed', 'cancelled')),
      created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      assigned_rider_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      customer_info JSONB NULL,
      notes TEXT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'succeeded', 'failed')),
      picked_up_at TIMESTAMPTZ NULL,
      delivered_at TIMESTAMPTZ NULL,
      subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
      discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL DEFAULT 1,
      price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      total NUMERIC(10, 2) NOT NULL DEFAULT 0,
      subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
      discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
      promo_id TEXT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS stock_transfer_logs (
      id TEXT PRIMARY KEY,
      transfer_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      from_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      from_branch_name TEXT NOT NULL,
      to_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      to_branch_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT NULL,
      approved_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      approved_by_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
      notes TEXT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS promos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NULL,
      discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
      discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
      min_purchase NUMERIC(10, 2) NOT NULL DEFAULT 0,
      max_discount NUMERIC(10, 2) NULL,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS product_promos (
      id TEXT PRIMARY KEY,
      promo_id TEXT NOT NULL REFERENCES promos(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT unique_promo_product UNIQUE (promo_id, product_id)
    )`,
    `CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS cart_items (
      id TEXT PRIMARY KEY,
      cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT unique_cart_product UNIQUE (cart_id, product_id)
    )`,
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL CHECK (user_role IN ('admin', 'branch_admin', 'pos_operator', 'customer', 'rider')),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NULL,
      entity_name TEXT NULL,
      description TEXT NULL,
      metadata JSONB NULL,
      ip_address TEXT NULL,
      branch_id TEXT NULL REFERENCES branches(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS rider_branch_assignments (
      id TEXT PRIMARY KEY,
      rider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      assigned_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uniq_rider_assignment UNIQUE (rider_id)
    )`,
    `CREATE TABLE IF NOT EXISTS delivery_history (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      rider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      customer_name TEXT NULL,
      customer_phone TEXT NULL,
      customer_address TEXT NULL,
      total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
      payment_status TEXT NULL,
      picked_up_at TIMESTAMPTZ NULL,
      delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uniq_delivery_sale UNIQUE (sale_id)
    )`,
    `CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT NULL,
      phone TEXT NULL,
      email TEXT NULL,
      address TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NULL REFERENCES suppliers(id) ON DELETE SET NULL,
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      invoice_number TEXT NULL,
      purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'pending', 'cancelled')),
      notes TEXT NULL,
      created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
      total NUMERIC(10, 2) NOT NULL DEFAULT 0
    )`,
  ]);

  await executeStatements(connection, [
    `CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
    `CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_branches_name ON branches(name)`,
    `CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name)`,
    `CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active)`,
    `CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`,
    `CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)`,
    `CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)`,
    `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`,
    `CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_inventory_branch_id ON inventory(branch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity)`,
    `CREATE INDEX IF NOT EXISTS idx_inventory_branch_quantity ON inventory(branch_id, quantity)`,
    `CREATE INDEX IF NOT EXISTS idx_inventory_last_check ON inventory(last_stock_check)`,
    `CREATE INDEX IF NOT EXISTS idx_pricing_product_id ON pricing(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pricing_effective_from ON pricing(effective_from)`,
    `CREATE INDEX IF NOT EXISTS idx_pricing_effective_to ON pricing(effective_to)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales(branch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_created_by ON sales(created_by)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_assigned_rider ON sales(assigned_rider_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(setting_key)`,
    `CREATE INDEX IF NOT EXISTS idx_transfer_date ON stock_transfer_logs(transfer_date)`,
    `CREATE INDEX IF NOT EXISTS idx_transfer_product ON stock_transfer_logs(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_transfer_from_branch ON stock_transfer_logs(from_branch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_transfer_to_branch ON stock_transfer_logs(to_branch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_promos_active ON promos(active)`,
    `CREATE INDEX IF NOT EXISTS idx_promos_dates ON promos(start_date, end_date)`,
    `CREATE INDEX IF NOT EXISTS idx_product_promos_promo ON product_promos(promo_id)`,
    `CREATE INDEX IF NOT EXISTS idx_product_promos_product ON product_promos(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_carts_user ON carts(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action)`,
    `CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id)`,
    `CREATE INDEX IF NOT EXISTS idx_activity_branch ON activity_logs(branch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_rider_branch_branch ON rider_branch_assignments(branch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_rider_branch_active ON rider_branch_assignments(active)`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_rider ON delivery_history(rider_id)`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_branch ON delivery_history(branch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_delivered_at ON delivery_history(delivered_at)`,
    `CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)`,
    `CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date)`,
    `CREATE INDEX IF NOT EXISTS idx_purchases_branch ON purchases(branch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id)`,
    `CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id)`,
    `CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id)`,
  ]);
}

export async function initializeDatabase() {
  const connection = await getConnection();

  try {
    await ensureSchema(connection);
    console.log("✅ Supabase/Postgres schema initialized");
  } finally {
    connection.release();
  }
}

export async function seedDatabase() {
  const connection = await getConnection();

  try {
    const [categoriesRows] = await connection.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM categories");
    const categoryCount = Number((categoriesRows as any[])[0]?.count || 0);

    if (categoryCount > 0) {
      console.log("⏭️  Database already seeded");
      return;
    }

    console.log("🌱 Seeding database...");

    const categories = [
      ["cat-001", "Meat", "Fresh frozen meat products", true],
      ["cat-002", "Seafood", "Fresh frozen seafood products", true],
      ["cat-003", "Vegetables", "Fresh frozen vegetables", true],
      ["cat-004", "Fruits", "Fresh frozen fruits and berries", true],
    ];

    for (const [id, name, description, active] of categories) {
      await connection.query(
        `INSERT INTO categories (id, name, description, active, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, name, description, active]
      );
    }

    const adminUser = {
      id: "user-admin-001",
      name: "System Administrator",
      email: "admin@gmail.com",
      phone: "+1-555-0001",
      password: "admin123",
      role: "admin",
      branch_id: null,
    };

    const passwordHash = await bcrypt.hash(adminUser.password, 10);
    await connection.query(
      `INSERT INTO users (id, name, email, phone, password_hash, role, branch_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [adminUser.id, adminUser.name, adminUser.email, adminUser.phone, passwordHash, adminUser.role, adminUser.branch_id]
    );

    const defaultSettings = [
      ["cms-001", "hero_banner", "/placeholder.svg"],
      ["cms-002", "hero_title", "Premium Frozen Foods"],
      ["cms-003", "hero_subtitle", "Quality You Can Trust"],
      ["cms-004", "hero_description", "Quality frozen products delivered to your door. Browse our extensive catalog of meats, seafood, vegetables, and ready-to-eat meals."],
      ["cms-005", "about_title", "About Batangas Premium Bongabong"],
      ["cms-006", "about_description", "At Batangas Premium Bongabong, we've been delivering premium quality frozen products to Filipino families and businesses since our establishment. Our commitment to excellence and customer satisfaction has made us a trusted name in the frozen foods industry."],
      ["cms-007", "about_mission", "To provide the highest quality frozen products while maintaining exceptional service and competitive pricing."],
      ["cms-008", "about_values", "Quality, Trust, Service, Innovation"],
      ["cms-009", "company_name", "Batangas Premium Bongabong"],
      ["cms-010", "company_logo", null],
      ["cms-011", "featured_bg_type", "color"],
      ["cms-012", "featured_bg_color", "#ffffff"],
      ["cms-013", "featured_bg_image", null],
    ];

    for (const [id, key, value] of defaultSettings) {
      await connection.query(
        `INSERT INTO settings (id, setting_key, setting_value, updated_at, updated_by)
         VALUES ($1, $2, $3, NOW(), NULL)
         ON CONFLICT (setting_key) DO UPDATE
         SET setting_value = EXCLUDED.setting_value,
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by`,
        [id, key, value]
      );
    }

    console.log("✅ Seed data created successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  } finally {
    connection.release();
  }
}
/*
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

// MySQL connection pool
let pool: mysql.Pool | null = null;

function getDatabaseName() {
  return process.env.DB_NAME || "frozenhub_pos";
}

function getDatabasePort() {
  const rawPort = process.env.DB_PORT;
  const parsed = rawPort ? Number(rawPort) : 3306;
  return Number.isFinite(parsed) ? parsed : 3306;
}

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: getDatabasePort(),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: getDatabaseName(),
      connectTimeout: 10000,
      acquireTimeout: 10000,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

// Get a connection from the pool
export async function getConnection() {
  const pool = getPool();
  return await pool.getConnection();
}

// Initialize database schema
export async function initializeDatabase() {
  const databaseName = getDatabaseName();
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: getDatabasePort(),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    connectTimeout: 10000,
  });
  
  try {
    // Create database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
    await connection.query(`USE \`${databaseName}\``);

    // Recreate the application pool now that the database exists
    if (pool) {
      await pool.end();
      pool = null;
    }
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: getDatabasePort(),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: databaseName,
      connectTimeout: 10000,
      acquireTimeout: 10000,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'branch_admin', 'pos_operator', 'customer', 'rider') NOT NULL,
        branch_id VARCHAR(255),
        created_at DATETIME NOT NULL,
        INDEX idx_email (email),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Branches table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        manager VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Categories table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL,
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Products table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) UNIQUE NOT NULL,
        barcode VARCHAR(100) UNIQUE NOT NULL, -- New field for barcodes
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        cost DECIMAL(10, 2) NOT NULL,
        image VARCHAR(255) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL,
        INDEX idx_sku (sku),
        INDEX idx_category (category),
        INDEX idx_barcode (barcode) -- Index for faster lookups
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // MySQL 5.7 does not support IF NOT EXISTS in ADD COLUMN/INDEX.
    // Use metadata checks to keep this migration compatible.
    const [barcodeColumn] = await connection.query(`SHOW COLUMNS FROM products LIKE 'barcode'`);
    if ((barcodeColumn as any[]).length === 0) {
      await connection.query(`ALTER TABLE products ADD COLUMN barcode VARCHAR(100) UNIQUE`);
    }

    const [barcodeIndex] = await connection.query(`SHOW INDEX FROM products WHERE Key_name = 'idx_barcode'`);
    if ((barcodeIndex as any[]).length === 0) {
      await connection.query(`CREATE INDEX idx_barcode ON products(barcode)`);
    }

    // Inventory table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR(255) PRIMARY KEY,
        product_id VARCHAR(255) NOT NULL,
        branch_id VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        reorder_level INT NOT NULL DEFAULT 50,
        last_stock_check DATETIME NOT NULL,
        UNIQUE KEY unique_product_branch (product_id, branch_id),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        INDEX idx_branch (branch_id),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Pricing table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pricing (
        id VARCHAR(255) PRIMARY KEY,
        product_id VARCHAR(255) NOT NULL,
        base_price DECIMAL(10, 2) NOT NULL,
        wholesale_price DECIMAL(10, 2) NOT NULL,
        retail_price DECIMAL(10, 2) NOT NULL,
        distributor_price DECIMAL(10, 2) NOT NULL,
        markup DECIMAL(10, 2) NOT NULL,
        effective_from DATETIME NOT NULL,
        effective_to DATETIME NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Sales table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR(255) PRIMARY KEY,
        date DATETIME NOT NULL,
        branch_id VARCHAR(255) NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        items_count INT NOT NULL,
        payment_method ENUM('cash', 'card', 'gcash', 'paymaya', 'bank_transfer', 'online') NOT NULL,
        status ENUM('pending', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
        created_by VARCHAR(255) NULL,
        assigned_rider_id VARCHAR(255) NULL,
        customer_info TEXT COMMENT 'JSON data of customer information',
        notes TEXT COMMENT 'Additional notes for the sale',
        payment_status ENUM('pending', 'succeeded', 'failed') NOT NULL DEFAULT 'pending',
        picked_up_at DATETIME NULL,
        delivered_at DATETIME NULL,
        subtotal DECIMAL(10, 2) DEFAULT 0 COMMENT 'Subtotal before discounts',
        discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Total discount amount',
        FOREIGN KEY (branch_id) REFERENCES branches(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (assigned_rider_id) REFERENCES users(id),
        INDEX idx_branch (branch_id),
        INDEX idx_date (date),
        INDEX idx_status (status),
        INDEX idx_created_by (created_by),
        INDEX idx_assigned_rider (assigned_rider_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Sale items table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id VARCHAR(255) PRIMARY KEY,
        sale_id VARCHAR(255) NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        subtotal DECIMAL(10, 2) DEFAULT 0 COMMENT 'Item subtotal before discount',
        discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Discount applied to item',
        promo_id VARCHAR(255) COMMENT 'Promo applied to this item',
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id),
        INDEX idx_sale (sale_id),
        INDEX idx_promo (promo_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Settings table for banner and other configurations
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR(255) PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        updated_at DATETIME NOT NULL,
        updated_by VARCHAR(255),
        INDEX idx_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Stock transfer logs table for audit trail
    await connection.query(`
      CREATE TABLE IF NOT EXISTS stock_transfer_logs (
        id VARCHAR(255) PRIMARY KEY,
        transfer_date DATETIME NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        from_branch_id VARCHAR(255) NOT NULL,
        from_branch_name VARCHAR(255) NOT NULL,
        to_branch_id VARCHAR(255) NOT NULL,
        to_branch_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        reason TEXT,
        approved_by VARCHAR(255) NOT NULL,
        approved_by_name VARCHAR(255) NOT NULL,
        status ENUM('completed', 'failed') NOT NULL DEFAULT 'completed',
        notes TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (from_branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        FOREIGN KEY (to_branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id),
        INDEX idx_transfer_date (transfer_date),
        INDEX idx_product (product_id),
        INDEX idx_from_branch (from_branch_id),
        INDEX idx_to_branch (to_branch_id),
        INDEX idx_approved_by (approved_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Promos table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS promos (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        discount_type ENUM('percentage', 'fixed') NOT NULL,
        discount_value DECIMAL(10, 2) NOT NULL,
        min_purchase DECIMAL(10, 2) DEFAULT 0,
        max_discount DECIMAL(10, 2) DEFAULT NULL,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL,
        created_by VARCHAR(255),
        FOREIGN KEY (created_by) REFERENCES users(id),
        INDEX idx_active (active),
        INDEX idx_dates (start_date, end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Product promos junction table (many-to-many)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_promos (
        id VARCHAR(255) PRIMARY KEY,
        promo_id VARCHAR(255) NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_promo_product (promo_id, product_id),
        FOREIGN KEY (promo_id) REFERENCES promos(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_promo (promo_id),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Cart table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Cart items table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id VARCHAR(255) PRIMARY KEY,
        cart_id VARCHAR(255) NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_cart_product (cart_id, product_id),
        INDEX idx_cart (cart_id),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Activity logs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        user_role ENUM('admin', 'branch_admin', 'pos_operator', 'customer', 'rider') NOT NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255),
        entity_name VARCHAR(255),
        description TEXT,
        metadata JSON,
        ip_address VARCHAR(45),
        branch_id VARCHAR(255),
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (branch_id) REFERENCES branches(id),
        INDEX idx_user (user_id),
        INDEX idx_action (action),
        INDEX idx_entity (entity_type, entity_id),
        INDEX idx_branch (branch_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Rider-branch assignment table (admin-controlled mapping)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS rider_branch_assignments (
        id VARCHAR(255) PRIMARY KEY,
        rider_id VARCHAR(255) NOT NULL,
        branch_id VARCHAR(255) NOT NULL,
        assigned_by VARCHAR(255) NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        UNIQUE KEY uniq_rider_assignment (rider_id),
        FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id),
        INDEX idx_assignment_branch (branch_id),
        INDEX idx_assignment_active (active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Rider delivery history table (persistent delivery logs)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS delivery_history (
        id VARCHAR(255) PRIMARY KEY,
        sale_id VARCHAR(255) NOT NULL,
        rider_id VARCHAR(255) NOT NULL,
        branch_id VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255) NULL,
        customer_phone VARCHAR(100) NULL,
        customer_address TEXT NULL,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        payment_status VARCHAR(50) NULL,
        picked_up_at DATETIME NULL,
        delivered_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE KEY uniq_delivery_sale (sale_id),
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        INDEX idx_delivery_rider (rider_id),
        INDEX idx_delivery_branch (branch_id),
        INDEX idx_delivery_delivered_at (delivered_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log("✅ Database schema initialized");
    
    // Run migrations for existing databases
    await runMigrations(connection);
  } finally {
    await connection.end();
  }
}

// Run database migrations for existing tables
async function runMigrations(connection: mysql.PoolConnection) {
  try {
    console.log("🔄 Running database migrations...");

    // Migration 1: Add new columns to sales table
    try {
      // Check and add customer_info column
      const [salesColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'customer_info'`);
      if ((salesColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales 
          ADD COLUMN customer_info TEXT COMMENT 'JSON data of customer information'
        `);
      }
      
      // Check and add notes column
      const [notesColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'notes'`);
      if ((notesColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales 
          ADD COLUMN notes TEXT COMMENT 'Additional notes for the sale'
        `);
      }
      
      // Check and add subtotal column
      const [subtotalColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'subtotal'`);
      if ((subtotalColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales 
          ADD COLUMN subtotal DECIMAL(10, 2) DEFAULT 0 COMMENT 'Subtotal before discounts'
        `);
      }
      
      // Check and add discount_amount column
      const [discountColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'discount_amount'`);
      if ((discountColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales 
          ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Total discount amount'
        `);
      }

      const [riderColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'assigned_rider_id'`);
      if ((riderColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales
          ADD COLUMN assigned_rider_id VARCHAR(255) NULL AFTER created_by
        `);
      }

      const [paymentStatusColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'payment_status'`);
      if ((paymentStatusColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales
          ADD COLUMN payment_status ENUM('pending', 'succeeded', 'failed') NOT NULL DEFAULT 'pending' AFTER notes
        `);
      }

      const [pickedUpAtColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'picked_up_at'`);
      if ((pickedUpAtColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales
          ADD COLUMN picked_up_at DATETIME NULL AFTER payment_status
        `);
      }

      const [deliveredAtColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'delivered_at'`);
      if ((deliveredAtColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales
          ADD COLUMN delivered_at DATETIME NULL AFTER picked_up_at
        `);
      }

      const [riderIdxRows] = await connection.query(`SHOW INDEX FROM sales WHERE Key_name = 'idx_assigned_rider'`);
      if ((riderIdxRows as any[]).length === 0) {
        await connection.query(`CREATE INDEX idx_assigned_rider ON sales(assigned_rider_id)`);
      }

      const [riderFkRows] = await connection.query(`
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'sales'
          AND COLUMN_NAME = 'assigned_rider_id'
          AND REFERENCED_TABLE_NAME = 'users'
      `);
      if ((riderFkRows as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales
          ADD CONSTRAINT fk_sales_assigned_rider
          FOREIGN KEY (assigned_rider_id) REFERENCES users(id)
        `);
      }

      // Ensure status enum supports online order workflow states.
      await connection.query(`
        ALTER TABLE sales
        MODIFY COLUMN status ENUM('pending', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'completed', 'cancelled')
        NOT NULL DEFAULT 'pending'
      `);

      await connection.query(`
        UPDATE sales
        SET payment_status = 'succeeded'
        WHERE status = 'completed'
          AND customer_info IS NOT NULL
          AND (payment_status IS NULL OR payment_status = 'pending')
      `);
      
      console.log("  ✅ Sales table updated");
    } catch (error: any) {
      console.error("  ⚠️  Sales table migration error:", error.message);
    }

    // Migration 2: Add new columns to sale_items table
    try {
      // Check and add subtotal column
      const [siSubtotalColumns] = await connection.query(`SHOW COLUMNS FROM sale_items LIKE 'subtotal'`);
      if ((siSubtotalColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sale_items 
          ADD COLUMN subtotal DECIMAL(10, 2) DEFAULT 0 COMMENT 'Item subtotal before discount'
        `);
      }
      
      // Check and add discount_amount column
      const [siDiscountColumns] = await connection.query(`SHOW COLUMNS FROM sale_items LIKE 'discount_amount'`);
      if ((siDiscountColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sale_items 
          ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Discount applied to item'
        `);
      }
      
      // Check and add promo_id column
      const [siPromoColumns] = await connection.query(`SHOW COLUMNS FROM sale_items LIKE 'promo_id'`);
      if ((siPromoColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sale_items 
          ADD COLUMN promo_id VARCHAR(255) COMMENT 'Promo applied to this item'
        `);
        
        // Add index for promo_id
        await connection.query(`
          CREATE INDEX idx_sale_items_promo ON sale_items(promo_id)
        `);
      }
      
      console.log("  ✅ Sale items table updated");
    } catch (error: any) {
      console.error("  ⚠️  Sale items table migration error:", error.message);
    }

    // Migration 3: Add created_at to product_promos
    try {
      const [ppCreatedColumns] = await connection.query(`SHOW COLUMNS FROM product_promos LIKE 'created_at'`);
      if ((ppCreatedColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE product_promos 
          ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        `);
      }
      console.log("  ✅ Product promos table updated");
    } catch (error: any) {
      console.error("  ⚠️  Product promos table migration error:", error.message);
    }

    // Migration 4: Ensure rider assignment table exists and backfill
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS rider_branch_assignments (
          id VARCHAR(255) PRIMARY KEY,
          rider_id VARCHAR(255) NOT NULL,
          branch_id VARCHAR(255) NOT NULL,
          assigned_by VARCHAR(255) NULL,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          UNIQUE KEY uniq_rider_assignment (rider_id),
          FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
          FOREIGN KEY (assigned_by) REFERENCES users(id),
          INDEX idx_assignment_branch (branch_id),
          INDEX idx_assignment_active (active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await connection.query(`
        INSERT INTO rider_branch_assignments (id, rider_id, branch_id, assigned_by, active, created_at, updated_at)
        SELECT CONCAT('rba-', u.id), u.id, u.branch_id, NULL, TRUE, NOW(), NOW()
        FROM users u
        WHERE u.role = 'rider' AND u.branch_id IS NOT NULL
        ON DUPLICATE KEY UPDATE
          branch_id = VALUES(branch_id),
          active = TRUE,
          updated_at = NOW()
      `);

      console.log("  ✅ Rider assignment table updated");
    } catch (error: any) {
      console.error("  ⚠️  Rider assignment migration error:", error.message);
    }

    // Migration 5: Update existing records
    try {
      await connection.query(`
        UPDATE sale_items SET subtotal = total WHERE subtotal = 0 OR subtotal IS NULL
      `);
      await connection.query(`
        UPDATE sales SET subtotal = total_amount WHERE subtotal = 0 OR subtotal IS NULL
      `);
      console.log("  ✅ Existing records updated");
    } catch (error: any) {
      console.error("  ⚠️  Record update warning:", error.message);
    }

    // Migration 6: Ensure delivery history table exists and backfill
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS delivery_history (
          id VARCHAR(255) PRIMARY KEY,
          sale_id VARCHAR(255) NOT NULL,
          rider_id VARCHAR(255) NOT NULL,
          branch_id VARCHAR(255) NOT NULL,
          customer_name VARCHAR(255) NULL,
          customer_phone VARCHAR(100) NULL,
          customer_address TEXT NULL,
          total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
          payment_status VARCHAR(50) NULL,
          picked_up_at DATETIME NULL,
          delivered_at DATETIME NOT NULL,
          created_at DATETIME NOT NULL,
          UNIQUE KEY uniq_delivery_sale (sale_id),
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
          FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
          INDEX idx_delivery_rider (rider_id),
          INDEX idx_delivery_branch (branch_id),
          INDEX idx_delivery_delivered_at (delivered_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await connection.query(`
        INSERT INTO delivery_history (
          id, sale_id, rider_id, branch_id, customer_name, customer_phone, customer_address,
          total_amount, payment_status, picked_up_at, delivered_at, created_at
        )
        SELECT
          CONCAT('dh-', s.id),
          s.id,
          s.assigned_rider_id,
          s.branch_id,
          JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.name')),
          JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.phone')),
          JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.address')),
          COALESCE(s.total_amount, 0),
          COALESCE(s.payment_status, 'completed'),
          s.picked_up_at,
          COALESCE(s.delivered_at, s.date),
          NOW()
        FROM sales s
        WHERE s.status = 'completed'
          AND s.assigned_rider_id IS NOT NULL
          AND s.customer_info IS NOT NULL
        ON DUPLICATE KEY UPDATE
          rider_id = VALUES(rider_id),
          branch_id = VALUES(branch_id),
          customer_name = VALUES(customer_name),
          customer_phone = VALUES(customer_phone),
          customer_address = VALUES(customer_address),
          total_amount = VALUES(total_amount),
          payment_status = VALUES(payment_status),
          picked_up_at = VALUES(picked_up_at),
          delivered_at = VALUES(delivered_at)
      `);

      console.log("  ✅ Delivery history table updated");
    } catch (error: any) {
      console.error("  ⚠️  Delivery history migration error:", error.message);
    }

    console.log("✅ Database migrations completed");
  } catch (error) {
    console.error("❌ Migration error:", error);
    // Don't throw - allow app to continue even if migrations fail
  }
}

// Seed initial data
export async function seedDatabase() {
  const connection = await getConnection();
  
  try {
    // Check if data already exists (check categories instead of branches)
    const [categories] = await connection.query("SELECT COUNT(*) as count FROM categories");
    const categoryCount = (categories as any)[0].count;
    
    if (categoryCount > 0) {
      console.log("⏭️  Database already seeded");
      return;
    }

    console.log("🌱 Seeding database...");

    // Insert categories
    const categoryData = [
      ["cat-001", "Meat", "Fresh frozen meat products", true, "2023-01-01 00:00:00"],
      ["cat-002", "Seafood", "Fresh frozen seafood products", true, "2023-01-01 00:00:00"],
      ["cat-003", "Vegetables", "Fresh frozen vegetables", true, "2023-01-01 00:00:00"],
      ["cat-004", "Fruits", "Fresh frozen fruits and berries", true, "2023-01-01 00:00:00"],
    ];

    await connection.query(
      "INSERT INTO categories (id, name, description, active, created_at) VALUES ?",
      [categoryData]
    );

    // Skip branch seeding - let admin add branches manually
    console.log("⏭️  Skipping branch mock data - admin can add branches manually");

    // Insert only the system administrator user
    const adminUser = {
      id: "user-admin-001",
      name: "System Administrator",
      email: "admin@gmail.com",
      phone: "+1-555-0001",
      password: "admin123",
      role: "admin",
      branch_id: null,
      created_at: "2023-01-01 00:00:00"
    };

    const passwordHash = bcrypt.hashSync(adminUser.password, 10);
    await connection.query(
      "INSERT INTO users (id, name, email, phone, password_hash, role, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [adminUser.id, adminUser.name, adminUser.email, adminUser.phone, passwordHash, adminUser.role, adminUser.branch_id, adminUser.created_at]
    );

    console.log("✅ Admin user created - email: admin@gmail.com, password: admin123");

    // Insert default CMS settings
    const defaultSettings = [
      ["cms-001", "hero_banner", "/placeholder.svg", "2023-01-01 00:00:00", null],
      ["cms-002", "hero_title", "Premium Frozen Foods", "2023-01-01 00:00:00", null],
      ["cms-003", "hero_subtitle", "Quality You Can Trust", "2023-01-01 00:00:00", null],
      ["cms-004", "hero_description", "Quality frozen products delivered to your door. Browse our extensive catalog of meats, seafood, vegetables, and ready-to-eat meals.", "2023-01-01 00:00:00", null],
      ["cms-005", "about_title", "About Batangas Premium Bongabong", "2023-01-01 00:00:00", null],
      ["cms-006", "about_description", "At Batangas Premium Bongabong, we've been delivering premium quality frozen products to Filipino families and businesses since our establishment. Our commitment to excellence and customer satisfaction has made us a trusted name in the frozen foods industry.", "2023-01-01 00:00:00", null],
      ["cms-007", "about_mission", "To provide the highest quality frozen products while maintaining exceptional service and competitive pricing.", "2023-01-01 00:00:00", null],
      ["cms-008", "about_values", "Quality, Trust, Service, Innovation", "2023-01-01 00:00:00", null],
      ["cms-009", "company_name", "Batangas Premium Bongabong", "2023-01-01 00:00:00", null],
      ["cms-010", "company_logo", null, "2023-01-01 00:00:00", null],
      ["cms-011", "featured_bg_type", "color", "2023-01-01 00:00:00", null],
      ["cms-012", "featured_bg_color", "#ffffff", "2023-01-01 00:00:00", null],
      ["cms-013", "featured_bg_image", null, "2023-01-01 00:00:00", null],
    ];

    await connection.query(
      "INSERT INTO settings (id, setting_key, setting_value, updated_at, updated_by) VALUES ?",
      [defaultSettings]
    );

    console.log("✅ Default CMS settings created");

    // Skip product seeding - let admin add products manually with images
    console.log("⏭️  Skipping product mock data - admin can add products manually");

    // Insert sample activity logs for Recent Activity section
    const activityLogs = [
      // Recent product additions
      ["log-1", "user-admin-001", "Admin User", "admin", "CREATE", "product", "prod-001", "Frozen Chicken Breast - 5kg pack", "New product added to catalog", '{"category": "Frozen Meat", "price": 850.00}', "192.168.1.1", null, new Date(Date.now() - 2 * 60 * 60 * 1000)], // 2 hours ago
      ["log-2", "user-admin-001", "Admin User", "admin", "CREATE", "product", "prod-002", "Premium Ice Cream - Vanilla 1L", "New product added to catalog", '{"category": "Frozen Desserts", "price": 320.00}', "192.168.1.1", null, new Date(Date.now() - 4 * 60 * 60 * 1000)], // 4 hours ago
      
      // Price updates
      ["log-3", "user-admin-001", "Admin User", "admin", "PRICE_UPDATED", "product_category", "cat-vegetables", "Frozen Vegetables", "Bulk price adjustment for category", '{"old_price_range": "50-200", "new_price_range": "45-180", "discount": "10%"}', "192.168.1.1", null, new Date(Date.now() - 5 * 60 * 60 * 1000)], // 5 hours ago
      ["log-4", "user-admin-001", "Admin User", "admin", "UPDATE", "product", "prod-seafood-001", "Frozen Salmon Fillet 500g", "Price updated due to supplier cost change", '{"old_price": 450.00, "new_price": 420.00}', "192.168.1.1", null, new Date(Date.now() - 8 * 60 * 60 * 1000)], // 8 hours ago
      
      // Sales transactions
      ["log-5", "user-pos-001", "POS Operator", "pos_operator", "SALE_CREATED", "sale", "sale-2847", "Order #2847", "Sale transaction completed", '{"total": 1250.00, "items": 5, "payment_method": "cash", "discount": 125.00}', "192.168.1.100", "branch-003", new Date(Date.now() - 24 * 60 * 60 * 1000)], // 1 day ago
      ["log-6", "user-pos-002", "Branch Manager", "branch_admin", "SALE_CREATED", "sale", "sale-2846", "Order #2846", "Large bulk order processed", '{"total": 3450.00, "items": 12, "payment_method": "card", "customer_type": "wholesale"}', "192.168.1.101", "branch-002", new Date(Date.now() - 25 * 60 * 60 * 1000)], // 1 day ago
      
      // Inventory adjustments
      ["log-7", "user-branch-001", "Branch Admin", "branch_admin", "INVENTORY_ADJUSTED", "inventory", "inv-seafood-001", "Frozen Seafood Collection", "Monthly inventory reconciliation completed", '{"adjusted_items": 15, "total_value_change": -450.00, "reason": "spoilage"}', "192.168.1.102", "branch-001", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)], // 2 days ago
      ["log-8", "user-admin-001", "Admin User", "admin", "INVENTORY_ADJUSTED", "inventory", "inv-chicken-001", "Frozen Chicken Products", "Stock replenishment from supplier", '{"adjusted_items": 50, "total_value_change": 12500.00, "reason": "restock"}', "192.168.1.1", null, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000)], // 2 days ago
      
      // Promotional activities
      ["log-9", "user-admin-001", "Admin User", "admin", "PROMO_ACTIVATED", "promotion", "promo-001", "Weekend Special - 15% Off Frozen Meals", "Weekend promotion activated", '{"discount_type": "percentage", "discount_value": 15, "valid_until": "2025-11-10"}', "192.168.1.1", null, new Date(Date.now() - 3 * 60 * 60 * 1000)], // 3 hours ago
      ["log-10", "user-admin-001", "Admin User", "admin", "PROMO_DEACTIVATED", "promotion", "promo-halloween", "Halloween Bundle Deals", "Seasonal promotion ended", '{"reason": "expired", "total_usage": 45, "total_savings": 2250.00}', "192.168.1.1", null, new Date(Date.now() - 6 * 60 * 60 * 1000)], // 6 hours ago
      
      // User activities
      ["log-11", "user-branch-002", "Jane Smith", "branch_admin", "USER_LOGIN", "auth", "user-branch-002", "Jane Smith", "User logged into system", '{"login_method": "email", "device": "desktop"}', "192.168.1.103", "branch-002", new Date(Date.now() - 30 * 60 * 1000)], // 30 minutes ago
      ["log-12", "user-pos-003", "Mike Johnson", "pos_operator", "USER_LOGIN", "auth", "user-pos-003", "Mike Johnson", "User started shift", '{"login_method": "email", "device": "pos_terminal", "shift": "morning"}', "192.168.1.104", "branch-001", new Date(Date.now() - 60 * 60 * 1000)], // 1 hour ago
    ];

    await connection.query(
      `INSERT INTO activity_logs (
        id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, description, metadata, ip_address, branch_id, created_at
      ) VALUES ?`,
      [activityLogs]
    );

    console.log("✅ Sample activity logs created");
    console.log("✅ Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  } finally {
    connection.release();
  }
}
*/
