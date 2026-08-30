import { decryptSecret, maskSecret } from "./secret-crypto";
import { query } from "./db";
import type { IntegrationProvider, Provider } from "./types";

export interface RuntimeProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

interface ProviderRow {
  provider: string;
  encrypted_api_key: string | null;
  model: string;
  base_url: string | null;
  enabled: boolean;
  updated_at: Date;
}

const providerDefaults = {
  openai: { model: "gpt-5.6-terra", baseUrl: "https://api.openai.com" },
  deepseek: { model: "deepseek-v4-flash", baseUrl: "https://api.deepseek.com" },
  salesmartly: { model: "", baseUrl: "https://developer.salesmartly.com" },
};

export async function getRuntimeProviderConfig(provider: IntegrationProvider): Promise<RuntimeProviderConfig | null> {
  if (process.env.DATABASE_URL && process.env.SETTINGS_ENCRYPTION_KEY) {
    try {
      const result = await query<ProviderRow>("SELECT * FROM provider_configs WHERE provider = $1 AND enabled = TRUE", [provider]);
      const row = result.rows[0];
      if (row?.encrypted_api_key) return { apiKey: decryptSecret(row.encrypted_api_key), model: row.model, baseUrl: row.base_url ?? undefined };
    } catch (error) {
      console.error("Unable to read encrypted provider configuration", error instanceof Error ? error.message : error);
    }
  }
  const apiKey = provider === "openai"
    ? process.env.OPENAI_API_KEY
    : provider === "deepseek"
      ? process.env.DEEPSEEK_API_KEY
      : process.env.SALESMARTLY_API_TOKEN || process.env.SALESMARTLY_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: provider === "openai"
      ? process.env.OPENAI_MODEL || providerDefaults.openai.model
      : provider === "deepseek"
        ? process.env.DEEPSEEK_MODEL || providerDefaults.deepseek.model
        : process.env.SALESMARTLY_PROJECT_ID || "",
    baseUrl: providerDefaults[provider].baseUrl,
  };
}

export async function listProviderConfigs() {
  const result = await query<ProviderRow>("SELECT provider, encrypted_api_key, model, base_url, enabled, updated_at FROM provider_configs ORDER BY provider");
  return result.rows.map((row) => {
    let maskedKey = "";
    if (row.encrypted_api_key) {
      try { maskedKey = maskSecret(decryptSecret(row.encrypted_api_key)); } catch { maskedKey = "••••••••"; }
    }
    return { provider: row.provider, configured: Boolean(row.encrypted_api_key), maskedKey, model: row.model, baseUrl: row.base_url ?? "", enabled: row.enabled, updatedAt: row.updated_at };
  });
}

export async function getModelAssignments() {
  const defaults = { analysisProvider: "openai" as Provider, translationProvider: "deepseek" as Provider, knowledgeProvider: "openai" as Provider };
  if (!process.env.DATABASE_URL) return defaults;
  try {
    const result = await query<{ value: Partial<typeof defaults> }>("SELECT value FROM app_settings WHERE key = 'model_assignments'");
    return { ...defaults, ...(result.rows[0]?.value ?? {}) };
  } catch {
    return defaults;
  }
}

export { providerDefaults };
