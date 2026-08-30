import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { query } from "@/lib/db";

interface UserRow { id: string; email: string | null; username: string | null; password_hash: string; role: "admin" | "user" }

export async function POST(request: Request) {
  try {
    const body = await request.json() as { identifier?: string; email?: string; password?: string };
    const identifier = (body.identifier || body.email)?.trim().toLowerCase();
    const password = body.password || "";
    if (!identifier || !password) return NextResponse.json({ error: "请输入用户名或管理员邮箱和密码" }, { status: 400 });
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ipAddress = forwarded || "unknown";
    const attempts = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM auth_attempts
      WHERE email = $1 AND ip_address = $2 AND successful = FALSE AND created_at > NOW() - INTERVAL '15 minutes'`, [identifier, ipAddress]);
    if (Number(attempts.rows[0]?.count || 0) >= 5) return NextResponse.json({ error: "登录尝试过多，请 15 分钟后再试" }, { status: 429 });

    let result = await query<UserRow>("SELECT id, email, username, password_hash, role FROM app_users WHERE LOWER(email) = $1 OR LOWER(username) = $1", [identifier]);
    if (!result.rows[0]) {
      const count = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM app_users");
      const bootstrapEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const bootstrapPassword = process.env.ADMIN_PASSWORD;
      if (count.rows[0]?.count === "0" && bootstrapEmail === identifier && bootstrapPassword === password) {
        const id = randomUUID();
        const passwordHash = await hash(password, 12);
        await query("INSERT INTO app_users (id, email, password_hash, role) VALUES ($1, $2, $3, 'admin')", [id, identifier, passwordHash]);
        result = await query<UserRow>("SELECT id, email, username, password_hash, role FROM app_users WHERE id = $1", [id]);
      }
    }

    const user = result.rows[0];
    if (!user || !(await compare(password, user.password_hash))) {
      await query("INSERT INTO auth_attempts (email, ip_address, successful) VALUES ($1, $2, FALSE)", [identifier, ipAddress]);
      return NextResponse.json({ error: "用户名、邮箱或密码错误" }, { status: 401 });
    }

    const token = await createSessionToken({ userId: user.id, email: user.email, username: user.username, role: user.role });
    const response = NextResponse.json({ ok: true, email: user.email, username: user.username, role: user.role });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 12 });
    await query("INSERT INTO auth_attempts (email, ip_address, successful) VALUES ($1, $2, TRUE)", [identifier, ipAddress]);
    await query("INSERT INTO audit_logs (actor_id, action, target, details) VALUES ($1, 'auth.login', 'session', $2::jsonb)", [user.id, JSON.stringify({ identifier, role: user.role })]);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "登录失败" }, { status: 500 });
  }
}
