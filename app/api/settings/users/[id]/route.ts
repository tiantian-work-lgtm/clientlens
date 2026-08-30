import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

interface UserRow { id: string; username: string | null; role: "admin" | "user" }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json() as { password?: string };
    const password = body.password || "";
    if (password.length < 8) return NextResponse.json({ error: "密码至少需要 8 位" }, { status: 400 });
    const target = await query<UserRow>("SELECT id, username, role FROM app_users WHERE id = $1", [id]);
    if (!target.rows[0] || target.rows[0].role !== "user") return NextResponse.json({ error: "只能重置普通用户密码" }, { status: 400 });
    await query("UPDATE app_users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [await hash(password, 12), id]);
    await query("INSERT INTO audit_logs (actor_id, action, target, details) VALUES ($1, 'user.password_reset', $2, $3::jsonb)", [session.userId, id, JSON.stringify({ username: target.rows[0].username })]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return NextResponse.json({ error: unauthorized ? "仅管理员可以管理用户" : "重置密码失败" }, { status: unauthorized ? 403 : 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const target = await query<UserRow>("SELECT id, username, role FROM app_users WHERE id = $1", [id]);
    if (!target.rows[0] || target.rows[0].role !== "user") return NextResponse.json({ error: "只能删除普通用户" }, { status: 400 });
    await query("DELETE FROM app_users WHERE id = $1", [id]);
    await query("INSERT INTO audit_logs (actor_id, action, target, details) VALUES ($1, 'user.delete', $2, $3::jsonb)", [session.userId, id, JSON.stringify({ username: target.rows[0].username })]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return NextResponse.json({ error: unauthorized ? "仅管理员可以管理用户" : "删除用户失败" }, { status: unauthorized ? 403 : 500 });
  }
}
