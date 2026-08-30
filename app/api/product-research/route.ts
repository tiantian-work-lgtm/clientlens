import { NextResponse } from "next/server";
import { researchProductForConversation } from "@/lib/product-research";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { productName?: string; conversation?: string };
    if (!body.productName?.trim()) return NextResponse.json({ error: "请先输入要研究的产品名称" }, { status: 400 });
    if (!body.conversation?.trim()) return NextResponse.json({ error: "缺少客户聊天记录" }, { status: 400 });
    const research = await researchProductForConversation(body.productName.trim(), body.conversation);
    if (!research) return NextResponse.json({ error: "尚未配置或启用 DeepSeek 服务" }, { status: 400 });
    return NextResponse.json({ research, provider: "deepseek" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "产品联网研究失败" }, { status: 502 });
  }
}
