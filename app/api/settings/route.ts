import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { encryptSecret } from "@/lib/secret-crypto";
import { listProviderConfigs, providerDefaults } from "@/lib/provider-config";
import type { Provider } from "@/lib/types";

interface AssignmentRow { value: { analysisProvider?: Provider; translationProvider?: Provider; knowledgeProvider?: Provider } }

export async function GET() {
  try {
    await requireAdmin();
    const providers = await listProviderConfigs();
    const assignmentResult = await query<AssignmentRow>("SELECT value FROM app_settings WHERE key = 'model_assignments'");
    return NextResponse.json({
      providers,
      assignments: assignmentResult.rows[0]?.value ?? { analysisProvider: "openai", translationProvider: "deepseek", knowledgeProvider: "openai" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "UNAUTHORIZED" ? "未登录" : "读取设置失败" }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json() as {
      providers?: Array<{ provider: Provider; apiKey?: string; model?: string; enabled?: boolean }>;
      assignments?: { analysisProvider?: Provider; translationProvider?: Provider; knowledgeProvider?: Provider };
    };
    const allowed: Provider[] = ["openai", "deepseek"];
    for (const config of body.providers ?? []) {
      if (!allowed.includes(config.provider)) continue;
      const model = config.model?.trim() || providerDefaults[config.provider].model;
      const encrypted = config.apiKey?.trim() ? encryptSecret(config.apiKey.trim()) : null;
      await query(`
        INSERT INTO provider_configs (provider, encrypted_api_key, model, base_url, enabled, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (provider) DO UPDATE SET
          encrypted_api_key = COALESCE(EXCLUDED.encrypted_api_key, provider_configs.encrypted_api_key),
          model = EXCLUDED.model,
          base_url = EXCLUDED.base_url,
          enabled = EXCLUDED.enabled,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
      `, [config.provider, encrypted, model, providerDefaults[config.provider].baseUrl, config.enabled !== false, session.userId]);
    }
    const assignments = {
      analysisProvider: allowed.includes(body.assignments?.analysisProvider as Provider) ? body.assignments?.analysisProvider : "openai",
      translationProvider: allowed.includes(body.assignments?.translationProvider as Provider) ? body.assignments?.translationProvider : "deepseek",
      knowledgeProvider: allowed.includes(body.assignments?.knowledgeProvider as Provider) ? body.assignments?.knowledgeProvider : "openai",
    };
    await query(`INSERT INTO app_settings (key, value, updated_by) VALUES ('model_assignments', $1::jsonb, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`, [JSON.stringify(assignments), session.userId]);
    await query("INSERT INTO audit_logs (actor_id, action, target, details) VALUES ($1, 'settings.update', 'ai_providers', $2::jsonb)", [session.userId, JSON.stringify({ providers: (body.providers ?? []).map((item) => item.provider), assignments })]);
    return NextResponse.json({ ok: true, providers: await listProviderConfigs(), assignments });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "UNAUTHORIZED" ? "未登录" : error instanceof Error ? error.message : "保存失败" }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

