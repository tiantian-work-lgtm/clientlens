import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    openai: Boolean(process.env.OPENAI_API_KEY),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    salesmartly: Boolean(process.env.SALESMARTLY_API_KEY && process.env.SALESMARTLY_BASE_URL),
  });
}
