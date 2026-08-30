import { NextResponse } from "next/server";
import { parseImportedConversation } from "@/lib/import-parser";
import { getModelAssignments } from "@/lib/provider-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { source?: "text" | "excel"; rawData?: string; customerHint?: string };
    if (body.source !== "text" && body.source !== "excel") return NextResponse.json({ error: "不支持的导入来源" }, { status: 400 });
    if (!body.rawData?.trim()) return NextResponse.json({ error: "没有可识别的导入内容" }, { status: 400 });
    if (body.rawData.length > 500_000) return NextResponse.json({ error: "当前单次智能识别最多支持约 50 万字符，请拆分文件后导入" }, { status: 413 });
    const assignments = await getModelAssignments();
    const preview = await parseImportedConversation(assignments.analysisProvider, body.source, body.rawData, body.customerHint);
    if (!preview) return NextResponse.json({ error: "尚未配置或启用当前分析大模型" }, { status: 400 });
    return NextResponse.json({ preview, provider: assignments.analysisProvider });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "智能导入识别失败" }, { status: 502 });
  }
}
