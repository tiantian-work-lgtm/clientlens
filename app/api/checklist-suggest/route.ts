import { NextResponse } from "next/server";
import { generateChecklistSuggestion } from "@/lib/ai";
import type { Provider } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { conversation?: string; item?: string; mode?: "hook" | "explain"; provider?: Provider };
    if (!body.conversation?.trim() || !body.item?.trim()) {
      return NextResponse.json({ error: "缺少对话或确认项" }, { status: 400 });
    }
    const provider = body.provider === "deepseek" ? "deepseek" : "openai";
    const mode = body.mode === "explain" ? "explain" : "hook";
    const result = await generateChecklistSuggestion(provider, body.conversation, body.item, mode);
    if (!result) {
      const fallback = mode === "hook"
        ? { text: "To make sure I provide the right information, are there any details you would like me to explain before we move forward?", translation: "为了确保我提供的信息符合您的需要，在继续之前，您希望我重点说明哪些细节？" }
        : { text: "I understand this is important before moving forward. I can share the relevant verified details and clarify any questions step by step.", translation: "我理解这一点在继续推进前非常重要。我可以提供相关的可验证资料，并逐一解答您的问题。" };
      return NextResponse.json({ suggestion: fallback.text, translation: fallback.translation, demo: true });
    }
    return NextResponse.json({ suggestion: result.text, translation: result.translation, demo: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "生成失败" }, { status: 502 });
  }
}
