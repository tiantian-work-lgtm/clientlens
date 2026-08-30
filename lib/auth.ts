import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "clientlens_session";

export interface AdminSession {
  userId: string;
  email: string | null;
  username: string | null;
  role: "admin" | "user";
}

function authKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: AdminSession) {
  return new SignJWT({ email: session.email, username: session.username, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(authKey());
}

export async function readSessionToken(token?: string): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authKey());
    if (!payload.sub || (payload.role !== "admin" && payload.role !== "user")) return null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const username = typeof payload.username === "string" ? payload.username : null;
    if (!email && !username) return null;
    return { userId: payload.sub, email, username, role: payload.role };
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}
