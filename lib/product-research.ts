import { parseConversationMessages } from "./conversation";
import { getRuntimeProviderConfig } from "./provider-config";
import type { ProductResearch } from "./types";

const productResearchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["productName", "customerNeed", "customerEvidenceMessageId", "customerEvidenceQuote", "matchLevel", "matchSummary", "talkingPoints", "limitations", "sources", "suggestedReply", "suggestedReplyTranslation"],
  properties: {
    productName: { type: "string" },
    customerNeed: { type: "string" },
    customerEvidenceMessageId: { type: "string" },
    customerEvidenceQuote: { type: "string" },
    matchLevel: { type: "string", enum: ["高", "中", "低", "资料不足"] },
    matchSummary: { type: "string" },
    talkingPoints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "explanation", "sourceUrls"],
        properties: {
          title: { type: "string" },
          explanation: { type: "string" },
          sourceUrls: { type: "array", items: { type: "string" } },
        },
      },
    },
    limitations: { type: "array", items: { type: "string" } },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url", "excerpt", "level"],
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          excerpt: { type: "string" },
          level: { type: "string", enum: ["自有产品资料", "同行评审研究", "官方或机构资料", "厂商产品资料", "其他公开资料"] },
        },
      },
    },
    suggestedReply: { type: "string" },
    suggestedReplyTranslation: { type: "string" },
  },
};

function extractResponseText(payload: unknown) {
  const data = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (data.output_text) return data.output_text;
  return data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text ?? "";
}

function cleanBaseUrl(baseUrl?: string) {
  return (baseUrl || "https://api.deepseek.com").replace(/\/$/, "").replace(/\/v1$/, "");
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function researchProductForConversation(productName: string, conversation: string): Promise<ProductResearch | null> {
  const config = await getRuntimeProviderConfig("deepseek");
  if (!config) return null;
  const numberedConversation = parseConversationMessages(conversation)
    .map((message) => `${message.id} [${message.role === "customer" ? "客户" : message.role === "sales" ? "销售" : "系统"}] ${message.content}`)
    .join("\n");
  const instructions = `你是销售产品资料研究员。必须先使用 web_search 搜索产品和组成成分的可靠公开资料，再生成严格 JSON。

任务目标：从客户原话提取其身体部位、困扰、改善期望或购买动机，研究“${productName}”与该关注方向是否存在有资料支撑的匹配点，并生成自然、有说服力的销售说明。

证据规则：
1. 每个 talkingPoint 必须引用 sources 中至少一个完全相同的 URL；不得编造 URL、研究、成分、产品规格或客户经历。
2. 优先使用同行评审论文、政府/监管/研究机构资料，其次才是厂商产品页。论坛、社交媒体和用户故事只能作为其他公开资料，不能证明疗效。
3. 必须区分“该品牌产品资料”和“单独成分研究”。成分研究不能直接证明复合产品在客户身上的效果。
4. 如果无法确认该产品的真实组成、规格或对应证据，将 matchLevel 设为“资料不足”，并明确写入 limitations。
5. customerEvidenceQuote 必须逐字复制一条客户消息，customerEvidenceMessageId 必须是对应 M 编号。

回复规则：
1. suggestedReply 使用客户主要语言；suggestedReplyTranslation 返回自然简体中文。
2. 将客户明确关注点与有证据的产品信息连接起来，表达具体价值，不写空泛营销话术。
3. 不生成个体化剂量、频率、周期、注射方法、联合使用方案、诊断或治疗方案。
4. 不使用“保证、治愈、一定有效”等绝对疗效承诺，也不要自动添加固定的咨询医生免责声明。
5. 资料不足时要提出一个自然的澄清问题，不得强行推荐。`;
  const response = await fetch(`${cleanBaseUrl(config.baseUrl)}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      instructions,
      input: `目标产品：${productName}\n\n客户对话：\n${numberedConversation}`,
      tools: [{ type: "web_search" }],
      tool_choice: { type: "web_search" },
      reasoning: { effort: "low" },
      max_output_tokens: 9000,
      text: { format: { type: "json_schema", name: "product_pain_point_research", schema: productResearchSchema } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`DeepSeek 联网研究失败：${response.status}${detail ? ` · ${detail.slice(0, 240)}` : ""}`);
  }
  const content = extractResponseText(await response.json());
  if (!content.trim()) throw new Error("DeepSeek 联网研究返回空内容");
  const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as Omit<ProductResearch, "searchedAt">;
  const messages = parseConversationMessages(conversation);
  const evidenceMessage = messages.find((message) => message.id === parsed.customerEvidenceMessageId && message.role === "customer");
  if (!evidenceMessage || !parsed.customerEvidenceQuote || !evidenceMessage.content.normalize("NFKC").includes(parsed.customerEvidenceQuote.normalize("NFKC"))) {
    throw new Error("产品匹配缺少可核验的客户原文");
  }
  const sources = (Array.isArray(parsed.sources) ? parsed.sources : []).filter((source) => source?.title && source?.excerpt && isHttpUrl(source.url));
  const sourceUrls = new Set(sources.map((source) => source.url));
  const talkingPoints = (Array.isArray(parsed.talkingPoints) ? parsed.talkingPoints : []).map((point) => ({
    ...point,
    sourceUrls: (Array.isArray(point.sourceUrls) ? point.sourceUrls : []).filter((url) => sourceUrls.has(url)),
  })).filter((point) => point.title && point.explanation && point.sourceUrls.length);
  if (parsed.matchLevel !== "资料不足" && (!sources.length || !talkingPoints.length)) throw new Error("联网研究未返回可核验的资料来源");
  return { ...parsed, productName: productName.trim(), sources, talkingPoints, searchedAt: new Date().toISOString() };
}
