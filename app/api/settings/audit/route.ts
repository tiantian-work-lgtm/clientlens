import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

interface AuditRow { id: string; action: string; target: string; details: Record<string, unknown>; created_at: Date; email: string | null }

export async function GET() {
  try {
    await requireAdmin();
    const result = await query<AuditRow>(`SELECT a.id::text, a.action, a.target, a.details, a.created_at, COALESCE(u.email, u.username) AS email
      FROM audit_logs a LEFT JOIN app_users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 30`);
    return NextResponse.json({ logs: result.rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "UNAUTHORIZED" ? "未登录" : "读取失败" }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
