import { NextResponse } from "next/server";
import { listProviderConfigs } from "@/lib/provider-config";

export const dynamic = "force-dynamic";

export async function GET() {
  let databaseProviders: Array<{ provider: string; configured: boolean; enabled: boolean }> = [];
  if (process.env.DATABASE_URL && process.env.SETTINGS_ENCRYPTION_KEY) {
    try { databaseProviders = await listProviderConfigs(); } catch { databaseProviders = []; }
  }
  const configured = (provider: string) => databaseProviders.some((item) => item.provider === provider && item.configured && item.enabled);
  return NextResponse.json({
    openai: configured("openai") || Boolean(process.env.OPENAI_API_KEY),
    deepseek: configured("deepseek") || Boolean(process.env.DEEPSEEK_API_KEY),
    salesmartly: Boolean(process.env.SALESMARTLY_API_KEY && process.env.SALESMARTLY_BASE_URL),
  });
}
