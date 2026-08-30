import type { AnalysisReport, Provider } from "./types";
import { getRuntimeProviderConfig, type RuntimeProviderConfig } from "./provider-config";

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "profile", "stage", "parallelStages", "stageReason", "objections", "confirmations", "improvements", "nextActions", "suggestedReply", "suggestedReplyTranslation", "confidence"],
  properties: {
    summary: { type: "string" },
    profile: { type: "array", items: { type: "string" } },
    stage: { type: "string", enum: ["初次询盘与客户背调", "信任建立", "产品与订单匹配", "决策推进", "等待付款", "已成交", "售后与复购"] },
    parallelStages: { type: "array", items: { type: "string", enum: ["初次询盘与客户背调", "信任建立", "产品与订单匹配", "决策推进", "等待付款", "已成交", "售后与复购"] } },
    stageReason: { type: "string" },
    objections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "severity", "status", "evidence", "advice"],
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["高", "中", "低"] },
          status: { type: "string", enum: ["待解决", "处理中", "已解决"] },
          evidence: { type: "string" },
          advice: { type: "string" },
        },
      },
    },
    confirmations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "category", "label", "status", "evidence", "riskReason", "confidence"],
        properties: {
          id: { type: "string" },
          category: { type: "string", enum: ["客户角色", "认知与经历", "产品与信任", "交易条件"] },
          label: { type: "string" },
          status: { type: "string", enum: ["confirmed", "unknown", "risk", "na"] },
          evidence: { type: "string" },
          riskReason: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    improvements: { type: "array", items: { type: "string" } },
    nextActions: { type: "array", items: { type: "string" } },
    suggestedReply: { type: "string" },
    suggestedReplyTranslation: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

const systemPrompt = `你是一名严谨的 B2B 销售对话分析师。根据对话生成结构化客户分析。
要求：
1. 判断与事实分开，不确定的信息不要当成事实；
2. 异议必须引用对话原文作为证据；
3. 改善建议要具体且可执行；
4. 销售阶段只能从以下七项选择：初次询盘与客户背调、信任建立、产品与订单匹配、决策推进、等待付款、已成交、售后与复购；主阶段取最接近当前成交里程碑的一项，第1至3阶段可同时放入 parallelStages；
5. confirmations 必须覆盖：客户角色与经验、是否需要产品种草、是否需要基础知识科普、剂量/使用/医疗问题、是否有被骗经历、COA与产品一致性、产品包装、公司资料、其他客户反馈、物流清关和时效、支付方式与付款安全；
6. confirmations 中只有对话出现明确顾虑、冲突、负面信号或成交阻碍时才能标记 risk；仅仅没有谈到必须标记 unknown。risk 项必须在 riskReason 说明风险原因，并在 evidence 提供对话依据；非 risk 项的 riskReason 返回空字符串；
7. suggestedReply 沿用客户语言，suggestedReplyTranslation 必须给出对应的自然简体中文翻译，其他分析字段使用中文；
8. 医疗相关内容只识别是否出现以及是否需要合规转介，不生成个体化剂量或医疗建议；不虚构公开背调信息。`;

function extractOpenAIText(payload: unknown): string {
  const data = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (data.output_text) return data.output_text;
  return data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text ?? "";
}

interface DeepSeekResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null; reasoning_content?: string | null };
  }>;
}

function parseJsonContent<T>(content: string): T {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

async function requestDeepSeekJson<T>(
  config: RuntimeProviderConfig,
  messages: Array<{ role: "system" | "user"; content: string }>,
  maxTokens: number,
): Promise<T> {
  let lastFinishReason = "unknown";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retryMessages = attempt === 0 ? messages : [
      ...messages,
      { role: "user" as const, content: "上一次返回内容为空。请立即输出一个完整、非空、可由 JSON.parse 解析的 JSON 对象，不要输出 Markdown。" },
    ];
    const response = await fetch(`${config.baseUrl || "https://api.deepseek.com"}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: retryMessages,
        response_format: { type: "json_object" },
        // V4 默认启用思考模式。结构化任务关闭思考，避免 max_tokens 被 reasoning_content 用完后 content 为空。
        thinking: { type: "disabled" },
        temperature: 0.1,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`DeepSeek request failed: ${response.status}${errorText ? ` · ${errorText.slice(0, 240)}` : ""}`);
    }
    const data = await response.json() as DeepSeekResponse;
    const choice = data.choices?.[0];
    lastFinishReason = choice?.finish_reason || "unknown";
    const content = choice?.message?.content?.trim();
    if (content) return parseJsonContent<T>(content);
  }
  throw new Error(`DeepSeek 连续两次返回空内容（finish_reason: ${lastFinishReason}）。请切换 deepseek-v4-pro 或暂时改用 OpenAI。`);
}

export async function analyzeWithProvider(provider: Provider, conversation: string): Promise<AnalysisReport | null> {
  const config = await getRuntimeProviderConfig(provider);
  if (!config) return null;
  if (provider === "openai") {
    const response = await fetch(`${config.baseUrl || "https://api.openai.com"}/v1/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        instructions: systemPrompt,
        input: conversation,
        store: false,
        text: { format: { type: "json_schema", name: "customer_analysis", strict: true, schema: analysisSchema } },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
    const text = extractOpenAIText(await response.json());
    return JSON.parse(text) as AnalysisReport;
  }

  return requestDeepSeekJson<AnalysisReport>(config, [
    {
      role: "system",
      content: `${systemPrompt}\n只输出合法 JSON，并严格使用指定字段。字段：summary, profile, stage, parallelStages, stageReason, objections, confirmations, improvements, nextActions, suggestedReply, suggestedReplyTranslation, confidence。JSON 示例：{"summary":"...","profile":[],"stage":"初次询盘与客户背调","parallelStages":[],"stageReason":"...","objections":[],"confirmations":[],"improvements":[],"nextActions":[],"suggestedReply":"...","suggestedReplyTranslation":"...","confidence":0.8}`,
    },
    { role: "user", content: conversation },
  ], 6000);
}

export interface BilingualSuggestion {
  text: string;
  translation: string;
}

const bilingualSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "translation"],
  properties: {
    text: { type: "string" },
    translation: { type: "string" },
  },
};

export async function generateChecklistSuggestion(provider: Provider, conversation: string, item: string, mode: "hook" | "explain"): Promise<BilingualSuggestion | null> {
  const instruction = mode === "hook"
    ? `根据当前对话，生成一句自然、不审问客户的探询钩子，用于确认“${item}”。`
    : `根据当前对话，生成一段简短、可信、可直接发送的说明，用于阐述“${item}”。不得虚构公司、产品或客户反馈。`;
  const prompt = `${systemPrompt}\n${instruction}\n沿用客户使用的语言生成 text，并为其提供自然简体中文翻译 translation。只输出包含 text 和 translation 的合法 JSON。\n\n对话：\n${conversation}`;
  const config = await getRuntimeProviderConfig(provider);
  if (!config) return null;
  if (provider === "openai") {
    const response = await fetch(`${config.baseUrl || "https://api.openai.com"}/v1/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, input: prompt, store: false, text: { format: { type: "json_schema", name: "bilingual_suggestion", strict: true, schema: bilingualSchema } } }),
    });
    if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
    return JSON.parse(extractOpenAIText(await response.json())) as BilingualSuggestion;
  }
  return requestDeepSeekJson<BilingualSuggestion>(config, [{ role: "user", content: prompt }], 1200);
}

export async function translateWithProvider(
  provider: Provider,
  text: string,
  targetLanguage: string,
  sourceLanguage = "Auto detect",
  tone = "professional",
): Promise<string | null> {
  const toneInstruction: Record<string, string> = {
    professional: "Use a natural, professional business tone.",
    friendly: "Use a warm, friendly business tone.",
    concise: "Use a concise, direct business tone without losing meaning.",
  };
  const prompt = `Translate from ${sourceLanguage} into ${targetLanguage}. Preserve product names, numbers, units, links and paragraph breaks. ${toneInstruction[tone] || toneInstruction.professional} Return only the translated text, with no explanation.\n\n${text}`;
  const maxOutputTokens = Math.min(6000, Math.max(256, Math.ceil(text.length * 2)));
  const config = await getRuntimeProviderConfig(provider);
  if (!config) return null;
  if (provider === "openai") {
    const response = await fetch(`${config.baseUrl || "https://api.openai.com"}/v1/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, input: prompt, store: false, max_output_tokens: maxOutputTokens }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
    return extractOpenAIText(await response.json());
  }
  const response = await fetch(`${config.baseUrl || "https://api.deepseek.com"}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: prompt }], temperature: 0.2, max_tokens: maxOutputTokens }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? null;
}

export async function translateConversationWithProvider(provider: Provider, texts: string[]): Promise<string[] | null> {
  const config = await getRuntimeProviderConfig(provider);
  if (!config) return null;
  const prompt = `Translate every item in the following JSON array into natural Simplified Chinese. Preserve product names, numbers, units and links. Return a JSON object with one field named translations. translations must be an array with exactly ${texts.length} strings in the same order. Do not merge, omit or add items.\n\n${JSON.stringify(texts)}`;
  if (provider === "openai") {
    const response = await fetch(`${config.baseUrl || "https://api.openai.com"}/v1/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        input: prompt,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "conversation_translation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["translations"],
              properties: { translations: { type: "array", items: { type: "string" } } },
            },
          },
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
    const data = parseJsonContent<{ translations?: unknown }>(extractOpenAIText(await response.json()));
    return normalizeTranslations(data.translations, texts.length);
  }
  const data = await requestDeepSeekJson<{ translations?: unknown }>(config, [{ role: "user", content: prompt }], Math.min(8000, Math.max(1200, texts.join("").length * 2)));
  return normalizeTranslations(data.translations, texts.length);
}

function normalizeTranslations(value: unknown, expectedLength: number) {
  if (!Array.isArray(value)) throw new Error("AI 未返回翻译数组");
  const translations = value.map((item) => typeof item === "string" ? item.trim() : "");
  if (translations.length !== expectedLength) throw new Error(`AI 返回 ${translations.length} 条翻译，预期 ${expectedLength} 条`);
  return translations;
}
