import { NextResponse } from "next/server";
import { hasHttpUrl, searchProductEvidence, structureProductResearch } from "@/lib/product-research";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { mode?: "search" | "format"; productName?: string; conversation?: string; searchSummary?: string };
    if (!body.productName?.trim()) return NextResponse.json({ error: "请先输入要研究的产品名称" }, { status: 400 });
    if (!body.conversation?.trim()) return NextResponse.json({ error: "缺少客户聊天记录" }, { status: 400 });
    if (body.mode === "search") {
      const searchSummary = await searchProductEvidence(body.productName.trim(), body.conversation);
      if (!searchSummary) return NextResponse.json({ error: "尚未配置或启用 DeepSeek 服务" }, { status: 400 });
      return NextResponse.json({ searchSummary, provider: "deepseek" });
    }
    if (body.mode === "format") {
      if (!body.searchSummary?.trim()) return NextResponse.json({ error: "缺少联网搜索资料，请重新搜索" }, { status: 400 });
      let searchSummary = body.searchSummary.trim();
      if (!hasHttpUrl(searchSummary)) searchSummary = await searchProductEvidence(body.productName.trim(), body.conversation) || "";
      if (!searchSummary) return NextResponse.json({ error: "尚未配置或启用 DeepSeek 服务" }, { status: 400 });
      let research;
      try { research = await structureProductResearch(body.productName.trim(), body.conversation, searchSummary); }
      catch (error) {
        if (!(error instanceof Error) || !error.message.includes("可核验的来源")) throw error;
        searchSummary = await searchProductEvidence(body.productName.trim(), body.conversation) || "";
        if (!searchSummary) return NextResponse.json({ error: "尚未配置或启用 DeepSeek 服务" }, { status: 400 });
        research = await structureProductResearch(body.productName.trim(), body.conversation, searchSummary);
      }
      if (!research) return NextResponse.json({ error: "尚未配置或启用 DeepSeek 服务" }, { status: 400 });
      return NextResponse.json({ research, searchSummary, provider: "deepseek" });
    }
    return NextResponse.json({ error: "无效的研究阶段" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "产品联网研究失败" }, { status: 502 });
  }
}
