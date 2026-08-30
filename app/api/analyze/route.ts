import { NextResponse } from "next/server";
import { analyzeModuleWithProvider, analyzeWithProvider } from "@/lib/ai";
import type { AnalysisModule, Provider } from "@/lib/types";
import { getModelAssignments } from "@/lib/provider-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { conversation?: string; provider?: Provider; module?: AnalysisModule };
    if (!body.conversation?.trim()) return NextResponse.json({ error: "缺少聊天记录" }, { status: 400 });
    const assignments = await getModelAssignments();
    const provider = body.provider === "deepseek" || body.provider === "openai" ? body.provider : assignments.analysisProvider;
    if (body.module === "customer" || body.module === "risk" || body.module === "action") {
      const result = await analyzeModuleWithProvider(provider, body.conversation, body.module);
      if (!result) {
        return NextResponse.json({ error: `尚未配置或启用 ${provider === "openai" ? "OpenAI" : "DeepSeek"} 分析服务。` }, { status: 400 });
      }
      return NextResponse.json({ module: body.module, result, provider, demo: false });
    }
    const report = await analyzeWithProvider(provider, body.conversation);
    if (!report) {
      return NextResponse.json({ error: `尚未配置或启用 ${provider === "openai" ? "OpenAI" : "DeepSeek"} 分析服务，无法生成真实报告。` }, { status: 400 });
    }
    return NextResponse.json({ report, provider, demo: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "分析失败" }, { status: 502 });
  }
}
