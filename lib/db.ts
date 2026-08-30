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
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'admin',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
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
        CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS auth_attempts_lookup_idx ON auth_attempts(email, ip_address, created_at DESC);
      `);
    })().catch((error) => {
      globalForDb.clientLensSchema = undefined;
      throw error;
    });
  }
  return globalForDb.clientLensSchema;
}
