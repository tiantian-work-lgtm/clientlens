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
      instructions: `你是一名产品情报搜索员。必须使用 web_search 对“${productName}”进行多轮中英文搜索，先弄清楚它是什么产品或什么多肽，再调查成分、益处、作用方向和适合沟通的客户价值。输出一份中文产品情报资料包，不要输出 JSON。

必须主动组合并搜索这些关键词：
- ${productName} peptide / ${productName} 是什么多肽 / ${productName} 多肽
- ${productName} ingredients / composition / formulation / 成分 / 配方
- ${productName} benefits / mechanism / 功效 / 益处 / 作用原理
- ${productName} official product / product description / 产品说明 / 官网
- ${productName} recovery / joint / weight management / 客户在聊天中明确提到的痛点关键词

如果找到可能的组成成分，继续分别搜索“成分名 benefits / mechanism / clinical research / 对应痛点”。不要只搜索一次产品名称便结束。

资料包必须包含：
1. 产品身份：它是单一多肽、复合产品、品牌名还是其他产品；英文全称、别名、拼写差异以及同名歧义。
2. 产品成分：可确认的主要成分、各成分的作用方向、配方或规格；无法确认时说明尝试搜索过哪些方向。
3. 益处与价值：公开资料中常见的益处、使用目的、作用方向、可能对应的客户痛点，以及与相近产品相比可能的差异。
4. 客户关联：结合聊天中客户明确说过的痛点、期望、既往尝试和不满意之处，标出最可能打动客户的产品价值方向。
5. 证据素材：每条资料给出完整标题、完整 http/https URL、来源级别、简短摘录，以及它能支持什么说法。
6. 销售素材：提炼客户容易理解的通俗说法、可以自然追问的问题，以及哪些内容不宜夸大。

优先产品官网或说明书、同行评审论文、政府、监管或研究机构资料，其次可靠厂商资料。不得编造 URL、研究、成分、规格或客户经历。必须区分“品牌产品信息”和“单独成分研究”，但即使品牌资料不完整，也要保留已确认的相关成分信息、客户价值方向和可继续核实的线索。`,
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
  const instructions = `你是一名具有产品理解能力和客户心理洞察能力的资深销售顾问。你的目标不是撰写机械的研究审查报告，而是把已核验的产品信息转化为自然、有吸引力、适合当前客户的种草策略。根据联网搜索资料包和客户原始聊天生成严格 JSON，不要再次联网，不要输出解释、Markdown 或 JSON 之外的文字。

种草分析流程：
1. 先从客户原话理解其核心痛点、改善期望、既往尝试、对原方案的不满、购买动机、当前顾虑和最可能被打动的价值点。
2. customerNeed 要写成具体的客户动机，不要只写产品名或笼统需求；customerEvidenceQuote 必须逐字复制最能代表需求的一条客户消息，customerEvidenceMessageId 必须是对应 M 编号。
3. matchSummary 要站在销售视角说明“应该从哪个方向种草、为什么这个方向与客户有关、先讲什么后讲什么”，不要写成资料审查结论。
4. talkingPoints 每一项都是一个可直接用于沟通的种草点：title 写客户能理解的价值主题；explanation 按“客户痛点 → 产品或成分价值 → 为什么与客户有关 → 如何自然表达”的顺序写，语言具体、有温度、不机械罗列功效。
5. 优先选择最能打动当前客户的一至三个价值点，不要一次堆砌所有功效。根据客户特点选择成本比较、恢复场景、方便性、信任证据或改善期望作为切入口。
6. suggestedReply 必须像真人销售回复：先承接客户刚才说的话，让客户感觉被理解；再自然引入一至两个最相关价值点；最后用一个容易回答的问题推动客户继续交流。使用客户主要语言，suggestedReplyTranslation 返回自然简体中文。
7. 不要反复使用“资料不足”“无法确认”等机械句式。资料不完整时，在 limitations 准确说明边界，同时仍要基于已确认的信息给出可用的种草方向、自然探询问题和后续核实建议。只有完全没有任何相关信息时才将 matchLevel 设为“资料不足”。

证据底线：
1. 每个 talkingPoint 必须引用 sources 中至少一个完全相同的 URL，且 URL 必须逐字存在于搜索资料包；不得编造 URL、研究、成分、产品规格或客户经历。
2. 必须区分品牌产品资料与单独成分研究。可以利用相关成分资料设计沟通方向，但不得声称成分研究已经证明整个复合产品的效果。
3. limitations 只记录真正影响判断的资料边界，不要让它盖过客户价值和种草策略。
4. 不生成个体化剂量、频率、周期、注射方法、联合使用方案、诊断或治疗方案；不作保证、治愈或一定有效等绝对承诺，也不自动添加固定免责声明。`;

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
