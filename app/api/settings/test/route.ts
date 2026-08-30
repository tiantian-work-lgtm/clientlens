import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { getRuntimeProviderConfig } from "@/lib/provider-config";
import type { Provider } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json() as { provider?: Provider };
    const provider: Provider = body.provider === "deepseek" ? "deepseek" : "openai";
    const config = await getRuntimeProviderConfig(provider);
    if (!config) return NextResponse.json({ ok: false, error: "尚未保存 API Key" }, { status: 400 });
    const response = provider === "openai"
      ? await fetch(`${config.baseUrl || "https://api.openai.com"}/v1/responses`, { method: "POST", headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: config.model, input: "Reply with OK only.", max_output_tokens: 16, store: false }) })
      : await fetch(`${config.baseUrl || "https://api.deepseek.com"}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: "Reply with OK only." }], max_tokens: 16 }) });
    const text = response.ok ? "连接成功" : `服务返回 ${response.status}`;
    await query("INSERT INTO audit_logs (actor_id, action, target, details) VALUES ($1, 'provider.test', $2, $3::jsonb)", [session.userId, provider, JSON.stringify({ ok: response.ok, status: response.status })]);
    return NextResponse.json({ ok: response.ok, message: text }, { status: response.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "测试失败" }, { status: 500 });
  }
}

