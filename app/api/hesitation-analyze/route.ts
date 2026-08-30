import { NextResponse } from "next/server";
import { analyzeHesitationWithProvider } from "@/lib/ai";
import type { Provider } from "@/lib/types";
import { getModelAssignments } from "@/lib/provider-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { conversation?: string; provider?: Provider };
    if (!body.conversation?.trim()) return NextResponse.json({ error: "缺少聊天记录" }, { status: 400 });
    const assignments = await getModelAssignments();
    const provider = body.provider === "deepseek" || body.provider === "openai" ? body.provider : assignments.analysisProvider;
    const analysis = await analyzeHesitationWithProvider(provider, body.conversation);
    if (!analysis) return NextResponse.json({ error: `尚未配置或启用 ${provider === "openai" ? "OpenAI" : "DeepSeek"} 分析服务。` }, { status: 400 });
    return NextResponse.json({ analysis, provider });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "深度犹豫分析失败" }, { status: 502 });
  }
}
