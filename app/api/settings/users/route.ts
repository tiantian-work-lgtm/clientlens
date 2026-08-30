import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

interface UserRow {
  id: string;
  email: string | null;
  username: string | null;
  role: "admin" | "user";
  created_at: Date;
  updated_at: Date;
}

function validUsername(username: string) {
  return /^[a-z0-9._-]{3,32}$/.test(username);
}

export async function GET() {
  try {
    await requireAdmin();
    const result = await query<UserRow>(`SELECT id, email, username, role, created_at, updated_at
      FROM app_users ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at ASC`);
    return NextResponse.json({ users: result.rows });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return NextResponse.json({ error: unauthorized ? "仅管理员可以管理用户" : "读取用户失败" }, { status: unauthorized ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json() as { username?: string; password?: string };
    const username = body.username?.trim().toLowerCase() || "";
    const password = body.password || "";
    if (!validUsername(username)) return NextResponse.json({ error: "用户名须为 3–32 位英文、数字、点、下划线或短横线" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "密码至少需要 8 位" }, { status: 400 });
    const duplicate = await query<{ id: string }>("SELECT id FROM app_users WHERE LOWER(username) = $1 OR LOWER(email) = $1 LIMIT 1", [username]);
    if (duplicate.rows[0]) return NextResponse.json({ error: "该用户名已存在" }, { status: 409 });
    const id = randomUUID();
    await query("INSERT INTO app_users (id, username, password_hash, role) VALUES ($1, $2, $3, 'user')", [id, username, await hash(password, 12)]);
    await query("INSERT INTO audit_logs (actor_id, action, target, details) VALUES ($1, 'user.create', $2, $3::jsonb)", [session.userId, id, JSON.stringify({ username })]);
    return NextResponse.json({ ok: true, id, username }, { status: 201 });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return NextResponse.json({ error: unauthorized ? "仅管理员可以管理用户" : error instanceof Error ? error.message : "创建用户失败" }, { status: unauthorized ? 403 : 500 });
  }
}
