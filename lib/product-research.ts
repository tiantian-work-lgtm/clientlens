import { parseConversationMessages } from "./conversation";
import { getRuntimeProviderConfig } from "./provider-config";
import type { ProductResearch } from "./types";

const productResearchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["productName", "customerNeed", "customerEvidenceMessageId", "customerEvidenceQuote", "matchLevel", "matchSummary", "talkingPoints", "limitations", "sources", "suggestedReply", "suggestedReplyTranslation"],
  properties: {
    productName: { type: "string" }, customerNeed: { type: "string" }, customerEvidenceMessageId: { type: "string" }, customerEvidenceQuote: { type: "string" },
    matchLevel: { type: "string", enum: ["高", "中", "低", "资料不足"] }, matchSummary: { type: "string" },
    talkingPoints: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "explanation", "sourceUrls"], properties: { title: { type: "string" }, explanation: { type: "string" }, sourceUrls: { type: "array", items: { type: "string" } } } } },
    limitations: { type: "array", items: { type: "string" } },
    sources: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "url", "excerpt", "level"], properties: { title: { type: "string" }, url: { type: "string" }, excerpt: { type: "string" }, level: { type: "string", enum: ["自有产品资料", "同行评审研究", "官方或机构资料", "厂商产品资料", "其他公开资料"] } } } },
    suggestedReply: { type: "string" }, suggestedReplyTranslation: { type: "string" },
  },
};

function extractResponseText(payload: unknown) {
  const data = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (data.output_text) return data.output_text;
  return data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text ?? "";
}

function parseJsonObject(content: string) {
  const clean = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(clean) as unknown; } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1)) as unknown;
    throw new Error("DeepSeek 未返回可解析的 JSON");
  }
}

function cleanBaseUrl(baseUrl?: string) { return (baseUrl || "https://api.deepseek.com").replace(/\/$/, "").replace(/\/v1$/, ""); }
function isHttpUrl(value: string) { try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; } }
function numberedConversation(conversation: string) {
  return parseConversationMessages(conversation).map((message) => `${message.id} [${message.role === "customer" ? "客户" : message.role === "sales" ? "销售" : "系统"}] ${message.content}`).join("\n");
}

export async function searchProductEvidence(productName: string, conversation: string): Promise<string | null> {
  const config = await getRuntimeProviderConfig("deepseek");
  if (!config) return null;
  const response = await fetch(`${cleanBaseUrl(config.baseUrl)}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      instructions: `你是严谨的产品资料搜索员。使用 web_search 搜索“${productName}”及其可确认成分的公开资料。输出一份中文证据资料包，不要输出 JSON。\n\n必须包含：1. 产品名称是否存在歧义、可确认组成和规格；2. 与客户关注点有关的公开资料；3. 每条资料的完整标题、完整 http/https URL、来源级别和简短摘录；4. 资料能证明什么、不能证明什么。\n\n优先同行评审论文、政府、监管或研究机构资料，其次厂商资料。不得编造 URL、研究、成分或规格；成分研究不能直接当作复合产品效果。资料不足时明确写出。`,
      input: `目标产品：${productName}\n\n客户对话：\n${numberedConversation(conversation)}`,
      tools: [{ type: "web_search" }], tool_choice: { type: "web_search" }, reasoning: { effort: "low" }, max_output_tokens: 7000,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) { const detail = await response.text().catch(() => ""); throw new Error(`DeepSeek 联网搜索失败：${response.status}${detail ? ` · ${detail.slice(0, 240)}` : ""}`); }
  const content = extractResponseText(await response.json()).trim();
  if (!content) throw new Error("DeepSeek 联网搜索返回空内容，请重试");
  return content;
}

export async function structureProductResearch(productName: string, conversation: string, searchSummary: string): Promise<ProductResearch | null> {
  const config = await getRuntimeProviderConfig("deepseek");
  if (!config) return null;
  const instructions = `你是销售产品资料研究员。根据给定的联网搜索资料包和客户原始聊天，生成严格 JSON。不要再次联网，不要输出解释、Markdown 或 JSON 之外的文字。

证据规则：
1. 每个 talkingPoint 必须引用 sources 中至少一个完全相同的 URL，且 URL 必须逐字存在于搜索资料包；不得编造 URL、研究、成分、产品规格或客户经历。
2. 必须区分品牌产品资料与单独成分研究。成分研究不能直接证明复合产品在客户身上的效果。
3. 无法确认产品组成、规格或对应证据时，将 matchLevel 设为“资料不足”并写入 limitations。
4. customerEvidenceQuote 必须逐字复制一条客户消息，customerEvidenceMessageId 必须是其 M 编号。
5. suggestedReply 使用客户主要语言，suggestedReplyTranslation 返回自然简体中文；连接客户关注点与有依据的信息，避免空泛营销。
6. 不生成个体化剂量、频率、周期、注射方法、联合使用、诊断或治疗方案；不作绝对疗效承诺，也不自动添加固定免责声明。`;

  const requestOnce = async (retry = false) => {
    const response = await fetch(`${cleanBaseUrl(config.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: `${instructions}\n\n必须严格遵循以下 JSON Schema：\n${JSON.stringify(productResearchSchema)}${retry ? "\n\n上一次输出无法解析。本次只返回一个完整 JSON 对象。" : ""}` },
          { role: "user", content: `目标产品：${productName}\n\n客户对话：\n${numberedConversation(conversation)}\n\n联网搜索资料包：\n${searchSummary.slice(0, 45_000)}\n\n请输出合法 JSON 对象。` },
        ],
        response_format: { type: "json_object" },
        thinking: { type: "disabled" }, temperature: 0.1, max_tokens: 9000,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) { const detail = await response.text().catch(() => ""); throw new Error(`DeepSeek 资料整理失败：${response.status}${detail ? ` · ${detail.slice(0, 240)}` : ""}`); }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = payload.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) throw new Error("DeepSeek 资料整理返回空内容");
    return parseJsonObject(content) as Omit<ProductResearch, "searchedAt">;
  };

  let parsed: Omit<ProductResearch, "searchedAt">;
  try { parsed = await requestOnce(); } catch (error) {
    if (error instanceof Error && (error.message.includes("JSON") || error.message.includes("空内容"))) parsed = await requestOnce(true);
    else throw error;
  }
  const messages = parseConversationMessages(conversation);
  const evidenceMessage = messages.find((message) => message.id === parsed.customerEvidenceMessageId && message.role === "customer");
  if (!evidenceMessage || !parsed.customerEvidenceQuote || !evidenceMessage.content.normalize("NFKC").includes(parsed.customerEvidenceQuote.normalize("NFKC"))) throw new Error("产品匹配缺少可核验的客户原文");
  const sources = (Array.isArray(parsed.sources) ? parsed.sources : []).filter((source) => source?.title && source?.excerpt && isHttpUrl(source.url) && searchSummary.includes(source.url));
  const sourceUrls = new Set(sources.map((source) => source.url));
  const talkingPoints = (Array.isArray(parsed.talkingPoints) ? parsed.talkingPoints : []).map((point) => ({ ...point, sourceUrls: (Array.isArray(point.sourceUrls) ? point.sourceUrls : []).filter((url) => sourceUrls.has(url)) })).filter((point) => point.title && point.explanation && point.sourceUrls.length);
  if (parsed.matchLevel !== "资料不足" && (!sources.length || !talkingPoints.length)) throw new Error("资料整理未返回可核验的来源，请重试搜索");
  return { ...parsed, productName: productName.trim(), sources, talkingPoints, searchedAt: new Date().toISOString() };
}
