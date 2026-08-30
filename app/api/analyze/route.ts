import { NextResponse } from "next/server";
import { analyzeWithProvider } from "@/lib/ai";
import { demoReport } from "@/lib/demo-data";
import type { Provider } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { conversation?: string; provider?: Provider };
    if (!body.conversation?.trim()) return NextResponse.json({ error: "缺少聊天记录" }, { status: 400 });
    const provider = body.provider === "deepseek" ? "deepseek" : "openai";
    const report = await analyzeWithProvider(provider, body.conversation);
    if (!report) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      return NextResponse.json({ report: demoReport, demo: true, message: "未配置服务端 API Key，已返回演示分析。" });
    }
    return NextResponse.json({ report, demo: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "分析失败" }, { status: 502 });
  }
}
