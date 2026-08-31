import { NextResponse } from "next/server";
import { analyzeAtomicModuleWithProvider } from "@/lib/atomic-analysis";
import type { AnalysisModule, Provider } from "@/lib/types";
import { getModelAssignments } from "@/lib/provider-config";

export const runtime = "nodejs";

const modules: AnalysisModule[] = ["summary", "profile", "products", "emotion_state", "emotion_trend", "personality", "decision", "drivers", "blockers", "blocker_status", "improvements", "strategy", "reply"];

export async function POST(request: Request) {
  try {
    const body = await request.json() as { conversation?: string; provider?: Provider; module?: AnalysisModule; analysisContext?: unknown };
    if (!body.conversation?.trim()) return NextResponse.json({ error: "缺少聊天记录" }, { status: 400 });
    const assignments = await getModelAssignments();
    const provider = body.provider === "deepseek" || body.provider === "openai" ? body.provider : assignments.analysisProvider;
    if (body.module && modules.includes(body.module)) {
      const result = await analyzeAtomicModuleWithProvider(provider, body.conversation, body.module, body.analysisContext);
      if (!result) {
        return NextResponse.json({ error: `尚未配置或启用 ${provider === "openai" ? "OpenAI" : "DeepSeek"} 分析服务。` }, { status: 400 });
      }
      return NextResponse.json({ module: body.module, result, provider, demo: false });
    }
    return NextResponse.json({ error: "缺少或无法识别分析模块" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "分析失败" }, { status: 502 });
  }
}
