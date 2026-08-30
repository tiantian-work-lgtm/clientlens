import { NextResponse } from "next/server";
import { getModelAssignments } from "@/lib/provider-config";
import { translateConversationWithProvider } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { texts?: unknown };
    if (!Array.isArray(body.texts) || !body.texts.length) return NextResponse.json({ error: "缺少聊天内容" }, { status: 400 });
    if (body.texts.length > 200) return NextResponse.json({ error: "单次最多翻译 200 条消息" }, { status: 400 });
    const texts = body.texts.map((item) => typeof item === "string" ? item.trim() : "");
    const totalLength = texts.reduce((total, item) => total + item.length, 0);
    if (totalLength > 20_000) return NextResponse.json({ error: "聊天内容过长，单次最多翻译 20,000 个字符" }, { status: 400 });
    const assignments = await getModelAssignments();
    const translations = await translateConversationWithProvider(assignments.translationProvider, texts);
    if (!translations) return NextResponse.json({ error: "请先配置翻译模型 API" }, { status: 400 });
    return NextResponse.json({ translations, provider: assignments.translationProvider });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "聊天翻译失败" }, { status: 502 });
  }
}
