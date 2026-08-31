import { Pool, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { clientLensPool?: Pool; clientLensSchema?: Promise<void> };

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  if (!globalForDb.clientLensPool) {
    globalForDb.clientLensPool = new Pool({ connectionString, max: 8, idleTimeoutMillis: 30_000 });
  }
  return globalForDb.clientLensPool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  await ensureSchema();
  return getPool().query<T>(text, values);
}

export async function ensureSchema() {
  if (!globalForDb.clientLensSchema) {
    globalForDb.clientLensSchema = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          username TEXT,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS username TEXT;
        ALTER TABLE app_users ALTER COLUMN email DROP NOT NULL;
        ALTER TABLE app_users ALTER COLUMN role SET DEFAULT 'user';
        CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_lower_idx ON app_users (LOWER(username)) WHERE username IS NOT NULL;
        CREATE TABLE IF NOT EXISTS provider_configs (
          provider TEXT PRIMARY KEY,
          encrypted_api_key TEXT,
          model TEXT NOT NULL,
          base_url TEXT,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          updated_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
          id BIGSERIAL PRIMARY KEY,
          actor_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          target TEXT NOT NULL,
          details JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS auth_attempts (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          ip_address TEXT NOT NULL,
          successful BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS sales_scripts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          scenario TEXT NOT NULL DEFAULT '',
          stage TEXT NOT NULL DEFAULT '初次询盘与客户背调',
          products JSONB NOT NULL DEFAULT '[]'::jsonb,
          customer_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
          trigger_text TEXT NOT NULL DEFAULT '',
          content TEXT NOT NULL,
          translation TEXT NOT NULL DEFAULT '',
          language TEXT NOT NULL DEFAULT 'EN',
          tags JSONB NOT NULL DEFAULT '[]'::jsonb,
          status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
          priority INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
          usage_count INTEGER NOT NULL DEFAULT 0,
          created_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
          updated_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS auth_attempts_lookup_idx ON auth_attempts(email, ip_address, created_at DESC);
        CREATE INDEX IF NOT EXISTS sales_scripts_status_updated_idx ON sales_scripts(status, updated_at DESC);
      `);
    })().catch((error) => {
      globalForDb.clientLensSchema = undefined;
      throw error;
    });
  }
  return globalForDb.clientLensSchema;
}
