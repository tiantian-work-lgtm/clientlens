import type { AnalysisReport, Provider } from "./types";
import { getRuntimeProviderConfig } from "./provider-config";

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
        required: ["id", "category", "label", "status", "evidence", "confidence"],
        properties: {
          id: { type: "string" },
          category: { type: "string", enum: ["客户角色", "认知与经历", "产品与信任", "交易条件"] },
          label: { type: "string" },
          status: { type: "string", enum: ["confirmed", "unknown", "risk", "na"] },
          evidence: { type: "string" },
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
6. suggestedReply 沿用客户语言，suggestedReplyTranslation 必须给出对应的自然简体中文翻译，其他分析字段使用中文；
7. 医疗相关内容只识别是否出现以及是否需要合规转介，不生成个体化剂量或医疗建议；不虚构公开背调信息。`;

function extractOpenAIText(payload: unknown): string {
  const data = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (data.output_text) return data.output_text;
  return data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text ?? "";
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

  const response = await fetch(`${config.baseUrl || "https://api.deepseek.com"}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: `${systemPrompt}\n只输出合法 JSON，并严格使用指定字段。字段：summary, profile, stage, parallelStages, stageReason, objections, confirmations, improvements, nextActions, suggestedReply, suggestedReplyTranslation, confidence。` },
        { role: "user", content: conversation },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2400,
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("DeepSeek returned empty JSON content");
  return JSON.parse(text) as AnalysisReport;
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
  const response = await fetch(`${config.baseUrl || "https://api.deepseek.com"}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } }),
  });
  if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  return content ? JSON.parse(content) as BilingualSuggestion : null;
}

export async function translateWithProvider(provider: Provider, text: string, targetLanguage: string): Promise<string | null> {
  const prompt = `Translate the following text into ${targetLanguage}. Preserve product names, numbers, units, links and paragraph breaks. Use natural professional business language. Return only the translation.\n\n${text}`;
  const config = await getRuntimeProviderConfig(provider);
  if (!config) return null;
  if (provider === "openai") {
    const response = await fetch(`${config.baseUrl || "https://api.openai.com"}/v1/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, input: prompt, store: false }),
    });
    if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
    return extractOpenAIText(await response.json());
  }
  const response = await fetch(`${config.baseUrl || "https://api.deepseek.com"}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? null;
}
