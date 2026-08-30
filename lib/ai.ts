import type { AnalysisReport, Provider } from "./types";

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "profile", "stage", "stageReason", "objections", "confirmed", "unresolved", "improvements", "nextActions", "suggestedReply", "confidence"],
  properties: {
    summary: { type: "string" },
    profile: { type: "array", items: { type: "string" } },
    stage: { type: "string" },
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
    confirmed: { type: "array", items: { type: "string" } },
    unresolved: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    nextActions: { type: "array", items: { type: "string" } },
    suggestedReply: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

const systemPrompt = `你是一名严谨的 B2B 销售对话分析师。根据对话生成结构化客户分析。
要求：
1. 判断与事实分开，不确定的信息不要当成事实；
2. 异议必须引用对话原文作为证据；
3. 改善建议要具体且可执行；
4. 建议回复沿用客户语言，其他分析字段使用中文；
5. 不提供医疗、法律或金融结论，不虚构公开背调信息。`;

function extractOpenAIText(payload: unknown): string {
  const data = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (data.output_text) return data.output_text;
  return data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text ?? "";
}

export async function analyzeWithProvider(provider: Provider, conversation: string): Promise<AnalysisReport | null> {
  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
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

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [
        { role: "system", content: `${systemPrompt}\n只输出合法 JSON，并严格使用指定示例字段。字段：summary, profile, stage, stageReason, objections, confirmed, unresolved, improvements, nextActions, suggestedReply, confidence。` },
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

export async function translateWithProvider(provider: Provider, text: string, targetLanguage: string): Promise<string | null> {
  const prompt = `Translate the following text into ${targetLanguage}. Preserve product names, numbers, units, links and paragraph breaks. Use natural professional business language. Return only the translation.\n\n${text}`;
  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.4-mini", input: prompt, store: false }),
    });
    if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
    return extractOpenAIText(await response.json());
  }
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash", messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? null;
}
