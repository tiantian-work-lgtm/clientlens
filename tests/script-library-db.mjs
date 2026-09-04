// ONLY run against the isolated PostgreSQL described in the test environment.
import assert from "node:assert/strict";
import { ensureSchema, query } from "../lib/db.ts";
import { encryptSecret } from "../lib/secret-crypto.ts";
if (process.env.DATABASE_URL !== "postgresql://library_test@127.0.0.1:55439/postgres") throw new Error("This test requires the isolated local library_test database");
try {
  await ensureSchema();
  await query("DELETE FROM sales_scripts WHERE id LIKE 'migrate-%'");
  await query("DELETE FROM script_menus WHERE id LIKE 'menu-%'");
  await query("DELETE FROM app_settings WHERE key='script_menus_v1'");
  await query(`INSERT INTO sales_scripts(id,title,content,scenario) VALUES
    ('migrate-a','OLD TITLE A','原文A不能被改写','Trust / First / Detail'),
    ('migrate-b','OLD TITLE B','原文B不能被改写','trust / First / Detail'),
    ('migrate-c','OLD TITLE C','原文C不能被改写','付款'),
    ('migrate-d','','未分类正文','')`);
  globalThis.clientLensSchema = undefined;
  await ensureSchema();
  const rows = (await query("SELECT id,content,menu_id FROM sales_scripts ORDER BY id")).rows;
  assert.equal(rows.length, 4);
  assert.equal(rows[0].content, '原文A不能被改写');
  assert.equal(rows[0].menu_id, rows[1].menu_id, "case variants should share categories");
  assert.equal(rows[3].menu_id, null);
  const menus = (await query("SELECT * FROM script_menus")).rows;
  assert.equal(menus.filter((m) => m.parent_id).length, 1);
  assert.ok(menus.find((m) => m.name === "First / Detail"), "third level folds into second without losing labels");
  const root = menus.find((m) => m.name.toLowerCase() === "trust");
  await query("DELETE FROM script_menus WHERE id=$1", [root.id]);
  assert.equal((await query("SELECT id FROM sales_scripts WHERE menu_id IS NULL")).rowCount, 3);
  assert.equal((await query("SELECT id FROM sales_scripts")).rowCount, 4);
  globalThis.clientLensSchema = undefined;
  await ensureSchema();
  assert.equal((await query("SELECT id FROM sales_scripts WHERE menu_id IS NULL")).rowCount, 3, "deleted categories must not reappear on restart");
  await query("INSERT INTO app_users(id,username,password_hash,role) VALUES ('library-test-user','library-test','not-a-login-hash','admin') ON CONFLICT DO NOTHING");
  await query("INSERT INTO provider_configs(provider,encrypted_api_key,model,base_url) VALUES ('deepseek',$1,'test-model','http://127.0.0.1:3106') ON CONFLICT(provider) DO UPDATE SET encrypted_api_key=excluded.encrypted_api_key,base_url=excluded.base_url", [encryptSecret('test-key-only')]);
  console.log("PASS: two-level migration, case duplicates, intact content, cascade-to-uncategorized, restart idempotency");
} finally { await globalThis.clientLensPool?.end(); }
