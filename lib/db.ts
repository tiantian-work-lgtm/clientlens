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
      const pool = await getPool().connect();
      try {
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
        BEGIN;
        SELECT pg_advisory_xact_lock(hashtext('clientlens-script-menus-v1'));
        CREATE TABLE IF NOT EXISTS script_menus (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          parent_id TEXT REFERENCES script_menus(id) ON DELETE CASCADE,
          position INTEGER NOT NULL DEFAULT 0
        );
        CREATE UNIQUE INDEX IF NOT EXISTS script_menus_sibling_name ON script_menus(COALESCE(parent_id, ''), LOWER(name));
        ALTER TABLE sales_scripts ADD COLUMN IF NOT EXISTS menu_id TEXT REFERENCES script_menus(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS sales_scripts_menu_idx ON sales_scripts(menu_id);
        CREATE TEMP TABLE script_menu_import ON COMMIT DROP AS
          SELECT id, TRIM(parts[1]) AS first_name,
            TRIM(COALESCE(array_to_string(parts[2:cardinality(parts)], ' / '), '')) AS second_name
          FROM (SELECT id, regexp_split_to_array(TRIM(scenario), '[[:space:]]*[/＞>→][[:space:]]*') AS parts FROM sales_scripts WHERE TRIM(scenario) <> '') s
          WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key='script_menus_v1');
        INSERT INTO script_menus(id, name, position)
          SELECT 'menu-' || md5(LOWER(first_name)), MIN(first_name), 0 FROM script_menu_import WHERE first_name <> '' GROUP BY LOWER(first_name) ON CONFLICT DO NOTHING;
        INSERT INTO script_menus(id, name, parent_id, position)
          SELECT 'menu-' || md5(LOWER(first_name) || chr(31) || LOWER(second_name)), MIN(second_name), 'menu-' || md5(LOWER(first_name)), 0
          FROM script_menu_import WHERE first_name <> '' AND second_name <> '' GROUP BY LOWER(first_name), LOWER(second_name) ON CONFLICT DO NOTHING;
        UPDATE sales_scripts s SET menu_id = CASE WHEN i.second_name = '' THEN 'menu-' || md5(LOWER(i.first_name))
          ELSE 'menu-' || md5(LOWER(i.first_name) || chr(31) || LOWER(i.second_name)) END
          FROM script_menu_import i WHERE s.id=i.id AND i.first_name <> '';
        INSERT INTO app_settings(key, value) VALUES ('script_menus_v1', 'true'::jsonb) ON CONFLICT DO NOTHING;
        COMMIT;
      `);
      } catch (error) { await pool.query("ROLLBACK"); throw error; }
      finally { pool.release(); }
    })().catch((error) => {
      globalForDb.clientLensSchema = undefined;
      throw error;
    });
  }
  return globalForDb.clientLensSchema;
}
