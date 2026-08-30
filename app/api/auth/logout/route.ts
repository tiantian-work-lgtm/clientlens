import { NextResponse } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST() {
  const session = await getSession();
  if (session) await query("INSERT INTO audit_logs (actor_id, action, target) VALUES ($1, 'auth.logout', 'session')", [session.userId]);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}

