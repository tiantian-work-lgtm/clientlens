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
    const suggestion = await generateChecklistSuggestion(provider, body.conversation, body.item, mode);
    if (!suggestion) {
      const fallback = mode === "hook"
        ? "To make sure I provide the right information, are there any details you would like me to explain before we move forward?"
        : "I understand this is important before moving forward. I can share the relevant verified details and clarify any questions step by step.";
      return NextResponse.json({ suggestion: fallback, demo: true });
    }
    return NextResponse.json({ suggestion, demo: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "生成失败" }, { status: 502 });
  }
}
