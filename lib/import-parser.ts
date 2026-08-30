import { getRuntimeProviderConfig } from "./provider-config";
import type { ImportPreview, ImportPreviewMessage, Provider } from "./types";

const importSchema = {
  type: "object",
  additionalProperties: false,
  required: ["messages", "detectedCustomers", "detectedConversations", "mappingSummary", "warnings", "overallConfidence"],
  properties: {
    messages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "sender", "time", "content", "sourceRef", "confidence", "conversationKey", "customerName"],
        properties: {
          role: { type: "string", enum: ["customer", "sales", "unknown", "system"] },
          sender: { type: "string" },
          time: { type: "string" },
          content: { type: "string" },
          sourceRef: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          conversationKey: { type: "string" },
          customerName: { type: "string" },
        },
      },
    },
    detectedCustomers: { type: "array", items: { type: "string" } },
    detectedConversations: { type: "array", items: { type: "string" } },
    mappingSummary: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    overallConfidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

function extractResponseText(payload: unknown) {
  const data = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (data.output_text) return data.output_text;
  return data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text ?? "";
}

function cleanJson(content: string) {
  return content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function sourceValues(source: "text" | "excel", rawData: string) {
  if (source === "text") return [rawData];
  try {
    const parsed = JSON.parse(rawData) as Array<{ sheetName?: string; rows?: Array<Record<string, unknown>> }>;
    return parsed.flatMap((sheet) => (sheet.rows ?? []).flatMap((row) => Object.values(row).filter((value): value is string | number | boolean => typeof value === "string" || typeof value === "number" || typeof value === "boolean").map(String)));
  } catch {
    return [];
  }
}

function normalizeForMatch(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function validateMessages(messages: unknown, source: "text" | "excel", rawData: string): ImportPreviewMessage[] {
  if (!Array.isArray(messages)) return [];
  const originals = sourceValues(source, rawData).map(normalizeForMatch).filter(Boolean);
  const wholeSource = normalizeForMatch(rawData);
  return messages.flatMap((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const content = typeof item.content === "string" ? item.content.trim() : "";
    const normalized = normalizeForMatch(content);
    const exactSourceMatch = source === "text" ? wholeSource.includes(normalized) : originals.some((original) => original === normalized || original.includes(normalized));
    if (!content || !normalized || !exactSourceMatch) return [];
    const role = item.role === "customer" || item.role === "sales" || item.role === "system" ? item.role : "unknown";
    const confidence = Number(item.confidence);
    return [{
      id: `I${String(index + 1).padStart(5, "0")}`,
      role,
      sender: typeof item.sender === "string" ? item.sender.trim() : "",
      time: typeof item.time === "string" ? item.time.trim() : "",
      content,
      sourceRef: typeof item.sourceRef === "string" ? item.sourceRef.trim() : "",
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
      conversationKey: typeof item.conversationKey === "string" && item.conversationKey.trim() ? item.conversationKey.trim() : "default",
      customerName: typeof item.customerName === "string" ? item.customerName.trim() : "",
    }];
  });
}

export async function parseImportedConversation(provider: Provider, source: "text" | "excel", rawData: string, customerHint = ""): Promise<ImportPreview | null> {
  const config = await getRuntimeProviderConfig(provider);
  if (!config) return null;
  const instructions = `你是聊天记录结构解析器。你的任务只是忠实识别结构，不是分析、翻译、总结或改写聊天。

必须遵守：
1. content 必须逐字保留原始单元格或文本中的消息，不得纠错、翻译、合并改写或补写。
2. 识别消息边界、时间、发送人、客户/销售/系统角色、客户名称和会话分组。
3. 角色优先依据明确字段、incoming/outgoing、sender type、agent/customer 标记和发送者身份；不得只因为一句话像销售话术就强行判断。
4. 不能确定角色时返回 unknown 且降低 confidence。通知、撤回、分配客服等返回 system。
5. Excel 的 sourceRef 使用“工作表名 / 第N行”；文本使用“文本第N行”。
6. 同一文件存在多个客户或会话时，使用不同 conversationKey，并返回 detectedCustomers、detectedConversations。
7. mappingSummary 用中文说明识别到的列或文本结构；warnings 用中文列出低置信度、缺失时间、多人混合等问题。
8. customerHint 只作为参考，不能覆盖原始证据。`;
  const input = `来源类型：${source}\n客户名称提示：${customerHint || "无"}\n\n原始数据：\n${rawData}`;
  const baseUrl = (config.baseUrl || (provider === "openai" ? "https://api.openai.com" : "https://api.deepseek.com")).replace(/\/$/, "").replace(/\/v1$/, "");
  const endpoint = provider === "openai" ? `${baseUrl}/v1/responses` : `${baseUrl}/responses`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      instructions,
      input,
      store: provider === "openai" ? false : undefined,
      reasoning: provider === "deepseek" ? { effort: "none" } : undefined,
      max_output_tokens: 20_000,
      text: { format: { type: "json_schema", name: "import_preview", strict: provider === "openai" ? true : undefined, schema: importSchema } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI 导入识别失败：${response.status}${detail ? ` · ${detail.slice(0, 240)}` : ""}`);
  }
  const content = extractResponseText(await response.json());
  if (!content.trim()) throw new Error("AI 导入识别返回空内容");
  const parsed = JSON.parse(cleanJson(content)) as Omit<ImportPreview, "messages"> & { messages: unknown };
  const messages = validateMessages(parsed.messages, source, rawData);
  if (!messages.length) throw new Error("没有识别到可核验的聊天消息，请检查文件内容或格式");
  const dropped = Array.isArray(parsed.messages) ? parsed.messages.length - messages.length : 0;
  const customers = Array.from(new Set(messages.map((message) => message.customerName).filter(Boolean)));
  const conversations = Array.from(new Set(messages.map((message) => message.conversationKey).filter(Boolean)));
  return {
    messages,
    detectedCustomers: customers.length ? customers : Array.isArray(parsed.detectedCustomers) ? parsed.detectedCustomers.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [],
    detectedConversations: conversations,
    mappingSummary: Array.isArray(parsed.mappingSummary) ? parsed.mappingSummary.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [],
    warnings: [...(Array.isArray(parsed.warnings) ? parsed.warnings.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : []), ...(dropped > 0 ? [`${dropped} 条 AI 输出因无法逐字对应原始数据而被拦截。`] : [])],
    overallConfidence: Number.isFinite(Number(parsed.overallConfidence)) ? Math.min(1, Math.max(0, Number(parsed.overallConfidence))) : 0,
  };
}
