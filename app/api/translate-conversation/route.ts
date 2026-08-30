import { NextResponse } from "next/server";
import { getModelAssignments } from "@/lib/provider-config";
import { translateConversationWithProvider } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { texts?: unknown };
    if (!Array.isArray(body.texts) || !body.texts.length) return NextResponse.json({ error: "缺少聊天内容" }, { status: 400 });
    const texts = body.texts.map((item) => typeof item === "string" ? item.trim() : "");
    const assignments = await getModelAssignments();
    const segments = texts.flatMap((text, messageIndex) => {
      const parts = text.match(/[\s\S]{1,6000}/g) || [""];
      return parts.map((part, segmentIndex) => ({ messageIndex, segmentIndex, text: part }));
    });
    const translatedSegments: string[] = [];
    for (let offset = 0; offset < segments.length;) {
      const batch: typeof segments = [];
      let characters = 0;
      while (offset < segments.length && batch.length < 40 && characters + segments[offset].text.length <= 12_000) {
        batch.push(segments[offset]);
        characters += segments[offset].text.length;
        offset += 1;
      }
      if (!batch.length) {
        batch.push(segments[offset]);
        offset += 1;
      }
      const translated = await translateConversationWithProvider(assignments.translationProvider, batch.map((item) => item.text));
      if (!translated) return NextResponse.json({ error: "请先配置翻译模型 API" }, { status: 400 });
      translatedSegments.push(...translated);
    }
    const translations = texts.map(() => "");
    segments.forEach((segment, index) => {
      translations[segment.messageIndex] += `${translations[segment.messageIndex] ? "\n" : ""}${translatedSegments[index] || ""}`;
    });
    return NextResponse.json({ translations, provider: assignments.translationProvider, batches: Math.ceil(segments.length / 40) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "聊天翻译失败" }, { status: 502 });
  }
}
