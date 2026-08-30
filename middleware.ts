import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose/jwt/verify";

const publicPaths = ["/login", "/api/auth/login", "/api/status"];

export async function middleware(request: NextRequest) {
  if (!process.env.AUTH_SECRET) return NextResponse.next();
  if (publicPaths.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))) return NextResponse.next();
  const token = request.cookies.get("clientlens_session")?.value;
  let valid = false;
  if (token) {
    try {
      const result = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      valid = result.payload.role === "admin";
    } catch { valid = false; }
  }
  if (valid) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
