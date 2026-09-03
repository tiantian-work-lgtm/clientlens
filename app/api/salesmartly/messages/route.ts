import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSaleSmartlyConversation, getSaleSmartlyCustomer } from "@/lib/salesmartly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSession();
    const chatUserId = new URL(request.url).searchParams.get("chatUserId")?.trim();
    if (!chatUserId) return NextResponse.json({ error: "缺少客户 ID" }, { status: 400 });
    const [conversation, customer] = await Promise.all([
      getSaleSmartlyConversation(chatUserId),
      getSaleSmartlyCustomer(chatUserId).catch(() => null),
    ]);
    return NextResponse.json({ ...conversation, customer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取聊天记录失败";
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "未登录" : message }, { status: message === "UNAUTHORIZED" ? 401 : 502 });
  }
}
