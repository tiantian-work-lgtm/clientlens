import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { searchSaleSmartlyCustomers } from "@/lib/salesmartly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const search = new URL(request.url).searchParams.get("q") || "";
    return NextResponse.json(await searchSaleSmartlyCustomers(search));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取客户失败";
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "未登录" : message }, { status: message === "UNAUTHORIZED" ? 401 : 502 });
  }
}
