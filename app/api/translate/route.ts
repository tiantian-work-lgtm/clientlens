import { NextResponse } from "next/server";
import { translateWithProvider } from "@/lib/ai";
import type { Provider } from "@/lib/types";
import { getModelAssignments } from "@/lib/provider-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const startedAt = Date.now();
    const body = await request.json() as { text?: string; sourceLanguage?: string; targetLanguage?: string; tone?: string; provider?: Provider };
    if (!body.text?.trim()) return NextResponse.json({ error: "请输入需要翻译的内容" }, { status: 400 });
    if (body.text.length > 5000) return NextResponse.json({ error: "单次翻译最多 5,000 个字符" }, { status: 400 });
    const assignments = await getModelAssignments();
    const provider = body.provider === "openai" || body.provider === "deepseek" ? body.provider : assignments.translationProvider;
    const translation = await translateWithProvider(
      provider,
      body.text,
      body.targetLanguage || "Simplified Chinese",
      body.sourceLanguage || "Auto detect",
      body.tone || "professional",
    );
    return NextResponse.json({
      translation: translation || "请您确认一下数量和收货地址。确认后，我可以为您准备准确的报价。",
      demo: !translation,
      provider,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "翻译失败" }, { status: 502 });
  }
}
