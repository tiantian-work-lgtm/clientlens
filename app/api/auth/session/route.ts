import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  return session ? NextResponse.json({ authenticated: true, email: session.email, username: session.username, role: session.role }) : NextResponse.json({ authenticated: false }, { status: 401 });
}
