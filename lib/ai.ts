import type { AnalysisModule, AnalysisReport, ConfirmationItem, Objection, Provider, SalesStage } from "./types";
import { getRuntimeProviderConfig, type RuntimeProviderConfig } from "./provider-config";
import { buildNumberedConversationChunks, parseConversationMessages, type ParsedConversationMessage } from "./conversation";

const stages = ["初次询盘与客户背调", "信任建立", "产品与订单匹配", "决策推进", "等待付款", "已成交", "售后与复购"];
const profileDimensions = ["身份与组织", "客户类型与经验", "核心需求与目标", "产品兴趣", "决策权与流程", "采购意向", "价格敏感度", "信任状态", "核心关注与风险偏好", "沟通风格与下一步倾向"];

const customerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "profile", "stage", "parallelStages", "stageReason", "confidence"],
  properties: {
    summary: { type: "string" },
    profile: { type: "array", minItems: 10, maxItems: 10, items: { type: "string" } },
    stage: { type: "string", enum: stages },
    parallelStages: { type: "array", items: { type: "string", enum: stages } },
    stageReason: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

const riskSchema = {
  type: "object",
  additionalProperties: false,
  required: ["objections", "confirmations"],
  properties: {
    objections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "severity", "status", "evidence", "evidenceMessageId", "evidenceQuote", "resolutionEvidenceMessageId", "resolutionEvidenceQuote", "resolutionReason", "advice"],
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["高", "中", "低"] },
          status: { type: "string", enum: ["未解决", "未追问-基本解决", "客户肯定-完全解决"] },
          evidence: { type: "string" },
          evidenceMessageId: { type: "string" },
          evidenceQuote: { type: "string" },
          resolutionEvidenceMessageId: { type: "string" },
          resolutionEvidenceQuote: { type: "string" },
          resolutionReason: { type: "string" },
          advice: { type: "string" },
        },
      },
    },
    confirmations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "category", "label", "status", "evidence", "evidenceMessageId", "evidenceQuote", "riskReason", "seedingNeed", "seedingDirection", "seedingPerformed", "seedingPerformedEvidenceMessageId", "seedingPerformedEvidenceQuote", "seedingAccepted", "seedingAcceptanceEvidenceMessageId", "seedingAcceptanceEvidenceQuote", "seedingAdvice", "medicalNeed", "medicalDirection", "medicalAnswered", "medicalAnswerEvidenceMessageId", "medicalAnswerEvidenceQuote", "medicalAccepted", "medicalAcceptanceEvidenceMessageId", "medicalAcceptanceEvidenceQuote", "medicalAdvice", "scamExperienceStatus", "scamExperienceSummary", "scamAddressed", "scamResponseEvidenceMessageId", "scamResponseEvidenceQuote", "scamAccepted", "scamAcceptanceEvidenceMessageId", "scamAcceptanceEvidenceQuote", "scamAdvice", "confidence"],
        properties: {
          id: { type: "string" },
          category: { type: "string", enum: ["客户角色", "认知与经历", "产品与信任", "交易条件"] },
          label: { type: "string" },
          status: { type: "string", enum: ["confirmed", "unknown", "risk", "na"] },
          evidence: { type: "string" },
          evidenceMessageId: { type: "string" },
          evidenceQuote: { type: "string" },
          riskReason: { type: "string" },
          seedingNeed: { type: "string", enum: ["需要种草", "无需种草", ""] },
          seedingDirection: { type: "string" },
          seedingPerformed: { type: "string", enum: ["已种草", "尚未种草", "未确认", ""] },
          seedingPerformedEvidenceMessageId: { type: "string" },
          seedingPerformedEvidenceQuote: { type: "string" },
          seedingAccepted: { type: "string", enum: ["客户明确肯定", "客户未明确肯定", "未确认", ""] },
          seedingAcceptanceEvidenceMessageId: { type: "string" },
          seedingAcceptanceEvidenceQuote: { type: "string" },
          seedingAdvice: { type: "string" },
          medicalNeed: { type: "string", enum: ["需要提供建议", "无需提供建议", ""] },
          medicalDirection: { type: "string" },
          medicalAnswered: { type: "string", enum: ["已解答", "尚未解答", "未确认", ""] },
          medicalAnswerEvidenceMessageId: { type: "string" },
          medicalAnswerEvidenceQuote: { type: "string" },
          medicalAccepted: { type: "string", enum: ["客户明确肯定", "客户未明确肯定", "未确认", ""] },
          medicalAcceptanceEvidenceMessageId: { type: "string" },
          medicalAcceptanceEvidenceQuote: { type: "string" },
          medicalAdvice: { type: "string" },
          scamExperienceStatus: { type: "string", enum: ["有被骗经历", "无被骗经历", ""] },
          scamExperienceSummary: { type: "string" },
          scamAddressed: { type: "string", enum: ["已回应", "尚未回应", "未确认", ""] },
          scamResponseEvidenceMessageId: { type: "string" },
          scamResponseEvidenceQuote: { type: "string" },
          scamAccepted: { type: "string", enum: ["客户明确肯定", "客户未明确肯定", "未确认", ""] },
          scamAcceptanceEvidenceMessageId: { type: "string" },
          scamAcceptanceEvidenceQuote: { type: "string" },
          scamAdvice: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
};

const actionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["improvements", "nextActions", "suggestedReply", "suggestedReplyTranslation"],
  properties: {
    improvements: { type: "array", items: { type: "string" } },
    nextActions: { type: "array", items: { type: "string" } },
    suggestedReply: { type: "string" },
    suggestedReplyTranslation: { type: "string" },
  },
};

const commonPrompt = `你是一名严谨的 B2B 销售对话分析师。判断与事实必须分开，不确定的信息不能当成事实。输入中的每条消息都有稳定编号 M00001 等。不得虚构消息、客户背景、公司资料或公开背调信息。医疗相关内容只识别是否出现以及是否需要合规转介，不生成个体化剂量或医疗建议。所有分析字段使用中文。`;

const modulePrompts: Record<AnalysisModule, string> = {
  customer: `${commonPrompt}\n只分析：对话总结、客户画像、销售阶段和总体置信度。客户画像 profile 必须严格返回 10 项，并按以下顺序和“维度：结论”格式填写：身份与组织、客户类型与经验、核心需求与目标、产品兴趣、决策权与流程、采购意向、价格敏感度、信任状态、核心关注与风险偏好、沟通风格与下一步倾向。每项应尽量具体，但只能依据聊天内容；聊天没有提供的维度必须写“维度：待确认”，禁止用常识补全或虚构。销售阶段只能从七阶段中选择；主阶段取最接近当前成交里程碑的一项，第1至3阶段可以同时放入 parallelStages。`,
  risk: `${commonPrompt}\n只分析异议、犹豫点、风险和确认清单，JSON 根对象只能包含 objections 和 confirmations。异议必须有真实客户原文，禁止“待确认异议1”等占位标题。按消息顺序判断：未正面回答、回避或客户再次追问=未解决；销售正面回答且客户未再追问=未追问-基本解决；销售回答后客户明确认可=客户肯定-完全解决。基本解决引用销售回答，完全解决引用客户后续肯定；沉默、礼貌致谢或话题切换不算肯定。确认清单必须且只返回 10 项：role、seeding、medical、scammed、coa、packaging、company、feedback、logistics、payment_method，禁止返回 education。只有明确顾虑或成交阻碍才能标记 risk，没谈到应标记 unknown。所有 evidenceQuote 必须逐字引用对应 M 编号原文。seeding 必须在需要种草/无需种草中二选一：需要时填写客户改善期望或痛点方向、销售是否已种草、客户是否在种草后明确肯定及下一步建议；已种草必须引用销售原话，客户明确肯定必须引用更晚的客户原话；非 seeding 项的全部 seeding 字段为空。medical 必须在需要提供建议/无需提供建议中二选一：客户提出剂量、用法、不良反应、禁忌、身体状况、疗效预期等需求时判为需要；需要时填写需求方向、是否已合规解答、客户是否在解答后明确肯定及下一步建议；已解答必须引用销售原话，客户明确肯定必须引用更晚的客户原话；不得生成个体化剂量、诊疗结论或替代专业医生，建议只能是安全沟通或专业转介；非 medical 项的全部 medical 字段为空。`,
  action: `${commonPrompt}\n只分析本次沟通可改善之处、下一步行动和建议回复。建议必须具体可执行；suggestedReply 沿用客户语言，suggestedReplyTranslation 返回自然简体中文翻译。`,
};

const scamPromptAddon = `\nscammed（是否有被骗经历）必须在“有被骗经历”和“无被骗经历”中二选一。“无被骗经历”仅表示当前聊天未发现相关表述，不得写成已核实的终身事实。有被骗经历时必须用 evidenceMessageId/Quote 引用客户原话，scamExperienceSummary 概括被骗方式、损失或造成的不信任；scamAddressed 判断销售是否针对该经历回应，已回应时 scamResponseEvidenceMessageId/Quote 必须引用销售原话；scamAccepted 只有客户在回应之后明确认可、接受或信任改善时才可填客户明确肯定，并引用更晚的客户原话；scamAdvice 给出建立信任和降低首次合作风险的具体建议。无被骗经历时这些明细字段返回空字符串。非 scammed 项的全部 scam 字段返回空字符串。`;

export interface CustomerModuleResult {
  summary: string;
  profile: string[];
  stage: SalesStage;
  parallelStages: SalesStage[];
  stageReason: string;
  confidence: number;
}

export interface RiskModuleResult { objections: Objection[]; confirmations: ConfirmationItem[] }
export interface ActionModuleResult { improvements: string[]; nextActions: string[]; suggestedReply: string; suggestedReplyTranslation: string }
export type AnalysisModuleResult = CustomerModuleResult | RiskModuleResult | ActionModuleResult;

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

async function requestOpenAIJson<T>(config: RuntimeProviderConfig, schema: Record<string, unknown>, schemaName: string, instructions: string, input: string): Promise<T> {
  const response = await fetch(`${config.baseUrl || "https://api.openai.com"}/v1/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, instructions, input, store: false, text: { format: { type: "json_schema", name: schemaName, strict: true, schema } } }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  return parseJsonContent<T>(extractOpenAIText(await response.json()));
}

function moduleSchema(module: AnalysisModule) {
  return module === "customer" ? customerSchema : module === "risk" ? riskSchema : actionSchema;
}

const confirmationIds = ["role", "seeding", "medical", "scammed", "coa", "packaging", "company", "feedback", "logistics", "payment_method"];
const confirmationDefinitions: Array<Pick<ConfirmationItem, "id" | "category" | "label">> = [
  { id: "role", category: "客户角色", label: "客户角色与经验" },
  { id: "seeding", category: "认知与经历", label: "是否需要产品种草" },
  { id: "medical", category: "认知与经历", label: "剂量、使用或医疗问题" },
  { id: "scammed", category: "认知与经历", label: "是否有被骗经历" },
  { id: "coa", category: "产品与信任", label: "COA 与产品一致性" },
  { id: "packaging", category: "产品与信任", label: "产品包装" },
  { id: "company", category: "产品与信任", label: "公司资料" },
  { id: "feedback", category: "产品与信任", label: "其他客户反馈" },
  { id: "logistics", category: "交易条件", label: "物流、清关和时效" },
  { id: "payment_method", category: "交易条件", label: "支付方式与付款安全" },
];

function normalizeEvidenceText(value: string) {
  return value.normalize("NFKC").replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/^[\s"'“”]+|[\s"'“”]+$/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function hasVerifiedEvidence(messageById: Map<string, ParsedConversationMessage>, messageId?: string, quote?: string) {
  if (!messageId || !quote) return false;
  const message = messageById.get(messageId);
  if (!message) return false;
  const normalizedQuote = normalizeEvidenceText(quote).replace(/^(?:customer|sales|客户|销售)\s*:\s*/i, "");
  const normalizedMessage = normalizeEvidenceText(message.content);
  return normalizedQuote.length >= 4 && (normalizedMessage.includes(normalizedQuote) || normalizedQuote.includes(normalizedMessage));
}

function resolutionEvidenceIsValid(
  messages: ParsedConversationMessage[],
  issueMessageId: string | undefined,
  resolutionMessageId: string | undefined,
  resolutionQuote: string | undefined,
  status: Objection["status"],
) {
  if (status === "未解决") return true;
  const issueIndex = messages.findIndex((message) => message.id === issueMessageId);
  const resolutionIndex = messages.findIndex((message) => message.id === resolutionMessageId);
  const messageById = new Map(messages.map((message) => [message.id, message]));
  if (issueIndex < 0 || resolutionIndex <= issueIndex || !hasVerifiedEvidence(messageById, resolutionMessageId, resolutionQuote)) return false;
  if (status === "未追问-基本解决") return messages[resolutionIndex]?.role === "sales";
  return messages[resolutionIndex]?.role === "customer"
    && messages.slice(issueIndex + 1, resolutionIndex).some((message) => message.role === "sales");
}

function normalizeRiskResult(value: AnalysisModuleResult, messages: ParsedConversationMessage[]): RiskModuleResult {
  const raw = value && typeof value === "object" ? value as Partial<RiskModuleResult> : {};
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const objections = (Array.isArray(raw.objections) ? raw.objections : []).flatMap((item) => {
    const valid = Boolean(item?.title?.trim())
      && !/^(?:待确认|待核对|需要人工核对(?:的潜在)?)?\s*异议\s*\d*$/i.test(item.title.trim())
      && Boolean(item.evidence?.trim())
      && Boolean(item.advice?.trim())
      && hasVerifiedEvidence(messageById, item.evidenceMessageId, item.evidenceQuote);
    if (!valid) return [];
    const rawStatus = String(item.status);
    const requestedStatus: Objection["status"] = rawStatus === "未追问-基本解决" || rawStatus === "客户肯定-完全解决"
      ? rawStatus
      : "未解决";
    const status = resolutionEvidenceIsValid(
      messages,
      item.evidenceMessageId,
      item.resolutionEvidenceMessageId,
      item.resolutionEvidenceQuote,
      requestedStatus,
    ) ? requestedStatus : "未解决";
    return [{
      ...item,
      status,
      resolutionEvidenceMessageId: status === "未解决" ? "" : item.resolutionEvidenceMessageId || "",
      resolutionEvidenceQuote: status === "未解决" ? "" : item.resolutionEvidenceQuote || "",
      resolutionReason: status !== requestedStatus
        ? "原解决状态缺少符合消息顺序要求的证据，已降级为未解决。"
        : item.resolutionReason?.trim() || (status === "未解决" ? "尚未找到符合顺序要求的解决证据。" : "已按消息顺序核验解决证据。"),
    } satisfies Objection];
  });
  const rawConfirmations = Array.isArray(raw.confirmations) ? raw.confirmations : [];
  const confirmations = confirmationDefinitions.map((definition) => {
    const item = rawConfirmations.find((candidate) => candidate?.id === definition.id);
    const requestedStatus = item?.status === "confirmed" || item?.status === "unknown" || item?.status === "risk" || item?.status === "na" ? item.status : "unknown";
    const verifiedRisk = requestedStatus === "risk" && hasVerifiedEvidence(messageById, item?.evidenceMessageId, item?.evidenceQuote);
    const confidence = Number(item?.confidence);
    return {
      ...definition,
      status: requestedStatus === "risk" && !verifiedRisk ? "unknown" as const : requestedStatus,
      evidence: item?.evidence?.trim() || "对话中尚未确认。",
      evidenceMessageId: item?.evidenceMessageId || "",
      evidenceQuote: item?.evidenceQuote || "",
      riskReason: verifiedRisk ? item?.riskReason?.trim() || item?.evidence?.trim() || "对话中存在明确顾虑。" : "",
      seedingNeed: item?.id === "seeding" && (item.seedingNeed === "需要种草" || item.seedingNeed === "无需种草") ? item.seedingNeed : undefined,
      seedingDirection: item?.id === "seeding" ? item.seedingDirection?.trim() || "" : "",
      seedingPerformed: item?.id === "seeding" && (item.seedingPerformed === "已种草" || item.seedingPerformed === "尚未种草" || item.seedingPerformed === "未确认") ? item.seedingPerformed : undefined,
      seedingPerformedEvidenceMessageId: item?.id === "seeding" ? item.seedingPerformedEvidenceMessageId || "" : "",
      seedingPerformedEvidenceQuote: item?.id === "seeding" ? item.seedingPerformedEvidenceQuote || "" : "",
      seedingAccepted: item?.id === "seeding" && (item.seedingAccepted === "客户明确肯定" || item.seedingAccepted === "客户未明确肯定" || item.seedingAccepted === "未确认") ? item.seedingAccepted : undefined,
      seedingAcceptanceEvidenceMessageId: item?.id === "seeding" ? item.seedingAcceptanceEvidenceMessageId || "" : "",
      seedingAcceptanceEvidenceQuote: item?.id === "seeding" ? item.seedingAcceptanceEvidenceQuote || "" : "",
      seedingAdvice: item?.id === "seeding" ? item.seedingAdvice?.trim() || "" : "",
      medicalNeed: item?.id === "medical" && (item.medicalNeed === "需要提供建议" || item.medicalNeed === "无需提供建议") ? item.medicalNeed : undefined,
      medicalDirection: item?.id === "medical" ? item.medicalDirection?.trim() || "" : "",
      medicalAnswered: item?.id === "medical" && (item.medicalAnswered === "已解答" || item.medicalAnswered === "尚未解答" || item.medicalAnswered === "未确认") ? item.medicalAnswered : undefined,
      medicalAnswerEvidenceMessageId: item?.id === "medical" ? item.medicalAnswerEvidenceMessageId || "" : "",
      medicalAnswerEvidenceQuote: item?.id === "medical" ? item.medicalAnswerEvidenceQuote || "" : "",
      medicalAccepted: item?.id === "medical" && (item.medicalAccepted === "客户明确肯定" || item.medicalAccepted === "客户未明确肯定" || item.medicalAccepted === "未确认") ? item.medicalAccepted : undefined,
      medicalAcceptanceEvidenceMessageId: item?.id === "medical" ? item.medicalAcceptanceEvidenceMessageId || "" : "",
      medicalAcceptanceEvidenceQuote: item?.id === "medical" ? item.medicalAcceptanceEvidenceQuote || "" : "",
      medicalAdvice: item?.id === "medical" ? item.medicalAdvice?.trim() || "" : "",
      scamExperienceStatus: item?.id === "scammed" && (item.scamExperienceStatus === "有被骗经历" || item.scamExperienceStatus === "无被骗经历") ? item.scamExperienceStatus : undefined,
      scamExperienceSummary: item?.id === "scammed" ? item.scamExperienceSummary?.trim() || "" : "",
      scamAddressed: item?.id === "scammed" && (item.scamAddressed === "已回应" || item.scamAddressed === "尚未回应" || item.scamAddressed === "未确认") ? item.scamAddressed : undefined,
      scamResponseEvidenceMessageId: item?.id === "scammed" ? item.scamResponseEvidenceMessageId || "" : "",
      scamResponseEvidenceQuote: item?.id === "scammed" ? item.scamResponseEvidenceQuote || "" : "",
      scamAccepted: item?.id === "scammed" && (item.scamAccepted === "客户明确肯定" || item.scamAccepted === "客户未明确肯定" || item.scamAccepted === "未确认") ? item.scamAccepted : undefined,
      scamAcceptanceEvidenceMessageId: item?.id === "scammed" ? item.scamAcceptanceEvidenceMessageId || "" : "",
      scamAcceptanceEvidenceQuote: item?.id === "scammed" ? item.scamAcceptanceEvidenceQuote || "" : "",
      scamAdvice: item?.id === "scammed" ? item.scamAdvice?.trim() || "" : "",
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    } satisfies ConfirmationItem;
  });
  return { objections, confirmations };
}

function validateModuleResult(module: AnalysisModule, value: AnalysisModuleResult, messages: ParsedConversationMessage[] = []) {
  if (!value || typeof value !== "object") throw new Error(`${module} 模块返回空结果`);
  if (module === "customer") {
    const result = value as CustomerModuleResult;
    if (!result.summary?.trim() || !stages.includes(result.stage) || !Number.isFinite(result.confidence)) throw new Error("客户画像模块字段不完整");
    if (!Array.isArray(result.profile) || result.profile.length !== profileDimensions.length) throw new Error("客户画像必须完整覆盖 10 个维度");
    if (result.profile.some((item, index) => !new RegExp(`^${profileDimensions[index]}[：:]`).test(item?.trim()))) throw new Error("客户画像维度缺失或顺序不正确");
  }
  if (module === "risk") {
    const result = value as RiskModuleResult;
    if (!Array.isArray(result.objections) || !Array.isArray(result.confirmations)) throw new Error("风险模块字段不完整");
    if (result.confirmations.length !== confirmationIds.length || new Set(result.confirmations.map((item) => item.id)).size !== confirmationIds.length || result.confirmations.some((item) => !confirmationIds.includes(item.id))) throw new Error("风险模块确认清单不完整");
    const messageById = new Map(messages.map((message) => [message.id, message]));
    if (result.objections.some((item) => !item.title?.trim() || /^(?:待确认|待核对|需要人工核对(?:的潜在)?)?\s*异议\s*\d*$/i.test(item.title.trim()))) throw new Error("风险模块返回了无效异议标题");
    if (result.objections.some((item) => !item.evidence?.trim() || !item.advice?.trim() || !hasVerifiedEvidence(messageById, item.evidenceMessageId, item.evidenceQuote))) throw new Error("风险模块异议缺少可核验的原始聊天依据");
    if (result.objections.some((item) => !["未解决", "未追问-基本解决", "客户肯定-完全解决"].includes(item.status))) throw new Error("风险模块异议状态无效");
    if (result.objections.some((item) => !item.resolutionReason?.trim())) throw new Error("风险模块异议缺少解决状态判断说明");
    if (result.objections.some((item) => item.status === "未解决" && (item.resolutionEvidenceMessageId || item.resolutionEvidenceQuote))) throw new Error("未解决异议不应包含解决证据");
    if (result.objections.some((item) => !resolutionEvidenceIsValid(messages, item.evidenceMessageId, item.resolutionEvidenceMessageId, item.resolutionEvidenceQuote, item.status))) throw new Error("风险模块解决状态与消息顺序不一致");
    if (result.confirmations.some((item) => !item.label?.trim() || !Number.isFinite(item.confidence))) throw new Error("风险模块确认清单字段不完整");
    if (result.confirmations.some((item) => item.status === "risk" && !hasVerifiedEvidence(messageById, item.evidenceMessageId, item.evidenceQuote))) throw new Error("风险项缺少可核验的原始聊天依据");
    const seeding = result.confirmations.find((item) => item.id === "seeding");
    if (!seeding || (seeding.seedingNeed !== "需要种草" && seeding.seedingNeed !== "无需种草")) throw new Error("种草分析缺少明确结论");
    const seedingEvidenceMessage = messageById.get(seeding.evidenceMessageId || "");
    if (seedingEvidenceMessage?.role !== "customer" || !hasVerifiedEvidence(messageById, seeding.evidenceMessageId, seeding.evidenceQuote)) throw new Error("种草分析缺少可核验的客户原文");
    if (seeding.seedingNeed === "需要种草" && (!seeding.seedingDirection?.trim() || !seeding.seedingPerformed || !seeding.seedingAccepted || !seeding.seedingAdvice?.trim())) throw new Error("需要种草时必须完整返回方向、执行、肯定与建议");
    const performedMessage = messageById.get(seeding.seedingPerformedEvidenceMessageId || "");
    if (seeding.seedingPerformed === "已种草" && (performedMessage?.role !== "sales" || !hasVerifiedEvidence(messageById, seeding.seedingPerformedEvidenceMessageId, seeding.seedingPerformedEvidenceQuote))) throw new Error("已种草结论缺少可核验的销售原文");
    const acceptanceMessage = messageById.get(seeding.seedingAcceptanceEvidenceMessageId || "");
    const performedIndex = messages.findIndex((message) => message.id === seeding.seedingPerformedEvidenceMessageId);
    const acceptanceIndex = messages.findIndex((message) => message.id === seeding.seedingAcceptanceEvidenceMessageId);
    if (seeding.seedingAccepted === "客户明确肯定" && (acceptanceMessage?.role !== "customer" || performedIndex < 0 || acceptanceIndex <= performedIndex || !hasVerifiedEvidence(messageById, seeding.seedingAcceptanceEvidenceMessageId, seeding.seedingAcceptanceEvidenceQuote))) throw new Error("客户肯定结论缺少种草之后的可核验原文");
    const medical = result.confirmations.find((item) => item.id === "medical");
    if (!medical || (medical.medicalNeed !== "需要提供建议" && medical.medicalNeed !== "无需提供建议")) throw new Error("医疗问题分析缺少明确结论");
    const medicalEvidenceMessage = messageById.get(medical.evidenceMessageId || "");
    if (medicalEvidenceMessage?.role !== "customer" || !hasVerifiedEvidence(messageById, medical.evidenceMessageId, medical.evidenceQuote)) throw new Error("医疗问题分析缺少可核验的客户原文");
    if (medical.medicalNeed === "需要提供建议" && (!medical.medicalDirection?.trim() || !medical.medicalAnswered || !medical.medicalAccepted || !medical.medicalAdvice?.trim())) throw new Error("需要提供医疗相关建议时必须完整返回方向、解答、肯定与建议");
    const answerMessage = messageById.get(medical.medicalAnswerEvidenceMessageId || "");
    if (medical.medicalAnswered === "已解答" && (answerMessage?.role !== "sales" || !hasVerifiedEvidence(messageById, medical.medicalAnswerEvidenceMessageId, medical.medicalAnswerEvidenceQuote))) throw new Error("已解答结论缺少可核验的销售原文");
    const medicalAcceptanceMessage = messageById.get(medical.medicalAcceptanceEvidenceMessageId || "");
    const answerIndex = messages.findIndex((message) => message.id === medical.medicalAnswerEvidenceMessageId);
    const medicalAcceptanceIndex = messages.findIndex((message) => message.id === medical.medicalAcceptanceEvidenceMessageId);
    if (medical.medicalAccepted === "客户明确肯定" && (medicalAcceptanceMessage?.role !== "customer" || answerIndex < 0 || medicalAcceptanceIndex <= answerIndex || !hasVerifiedEvidence(messageById, medical.medicalAcceptanceEvidenceMessageId, medical.medicalAcceptanceEvidenceQuote))) throw new Error("客户肯定结论缺少解答之后的可核验原文");
    const scammed = result.confirmations.find((item) => item.id === "scammed");
    if (!scammed || (scammed.scamExperienceStatus !== "有被骗经历" && scammed.scamExperienceStatus !== "无被骗经历")) throw new Error("被骗经历分析缺少明确结论");
    if (scammed.scamExperienceStatus === "有被骗经历") {
      const scamEvidenceMessage = messageById.get(scammed.evidenceMessageId || "");
      if (scamEvidenceMessage?.role !== "customer" || !hasVerifiedEvidence(messageById, scammed.evidenceMessageId, scammed.evidenceQuote)) throw new Error("被骗经历缺少可核验的客户原文");
      if (!scammed.scamExperienceSummary?.trim() || !scammed.scamAddressed || !scammed.scamAccepted || !scammed.scamAdvice?.trim()) throw new Error("被骗经历必须完整返回经历、回应、肯定与建议");
      const scamResponseMessage = messageById.get(scammed.scamResponseEvidenceMessageId || "");
      if (scammed.scamAddressed === "已回应" && (scamResponseMessage?.role !== "sales" || !hasVerifiedEvidence(messageById, scammed.scamResponseEvidenceMessageId, scammed.scamResponseEvidenceQuote))) throw new Error("被骗经历已回应结论缺少销售原文");
      const scamAcceptanceMessage = messageById.get(scammed.scamAcceptanceEvidenceMessageId || "");
      const scamResponseIndex = messages.findIndex((message) => message.id === scammed.scamResponseEvidenceMessageId);
      const scamAcceptanceIndex = messages.findIndex((message) => message.id === scammed.scamAcceptanceEvidenceMessageId);
      if (scammed.scamAccepted === "客户明确肯定" && (scamAcceptanceMessage?.role !== "customer" || scamResponseIndex < 0 || scamAcceptanceIndex <= scamResponseIndex || !hasVerifiedEvidence(messageById, scammed.scamAcceptanceEvidenceMessageId, scammed.scamAcceptanceEvidenceQuote))) throw new Error("被骗经历的客户肯定缺少回应之后的客户原文");
    }
  }
  return value;
}

async function requestModuleOnce(config: RuntimeProviderConfig, provider: Provider, module: AnalysisModule, input: string, merge = false): Promise<AnalysisModuleResult> {
  const instruction = `${modulePrompts[module]}${module === "risk" ? scamPromptAddon : ""}${merge ? "\n下面是分段分析结果，请去重并合并为一个最终结果。消息编号与原文必须原样保留。" : ""}`;
  if (provider === "openai") {
    return requestOpenAIJson<AnalysisModuleResult>(config, moduleSchema(module), `customer_${module}_analysis`, instruction, input);
  }
  const tokens = module === "risk" ? 5000 : module === "customer" ? 2400 : 2800;
  return requestDeepSeekJson<AnalysisModuleResult>(config, [{ role: "system", content: `${instruction}\n只输出符合字段要求的合法 JSON。` }, { role: "user", content: input }], tokens);
}

export async function analyzeModuleWithProvider(provider: Provider, conversation: string, module: AnalysisModule): Promise<AnalysisModuleResult | null> {
  const config = await getRuntimeProviderConfig(provider);
  if (!config) return null;
  const chunks = buildNumberedConversationChunks(conversation);
  const messages = parseConversationMessages(conversation);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const chunkResults: AnalysisModuleResult[] = [];
      const retryPrefix = attempt ? "上一次结果未通过字段或原文核验。请严格补全所有必填字段；无法找到直接原文的异议必须删除，不得用占位内容代替。\n\n" : "";
      for (const chunk of chunks) {
        const rawResult = await requestModuleOnce(config, provider, module, `${retryPrefix}${chunk}`);
        const result = module === "risk" && attempt > 0 ? normalizeRiskResult(rawResult, messages) : rawResult;
        chunkResults.push(validateModuleResult(module, result, messages));
      }
      const result = chunkResults.length === 1
        ? chunkResults[0]
        : await requestModuleOnce(config, provider, module, JSON.stringify(chunkResults), true);
      const normalizedResult = module === "risk" && attempt > 0 ? normalizeRiskResult(result, messages) : result;
      return validateModuleResult(module, normalizedResult, messages);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${module} 模块分析失败`);
}

export async function analyzeWithProvider(provider: Provider, conversation: string): Promise<AnalysisReport | null> {
  const results = await Promise.all([
    analyzeModuleWithProvider(provider, conversation, "customer"),
    analyzeModuleWithProvider(provider, conversation, "risk"),
    analyzeModuleWithProvider(provider, conversation, "action"),
  ]);
  if (results.some((result) => !result)) return null;
  const customer = results[0] as CustomerModuleResult;
  const risk = results[1] as RiskModuleResult;
  const action = results[2] as ActionModuleResult;
  return { ...customer, ...risk, ...action };
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
  const prompt = `${commonPrompt}\n${instruction}\n沿用客户使用的语言生成 text，并为其提供自然简体中文翻译 translation。只输出包含 text 和 translation 的合法 JSON。\n\n对话：\n${conversation}`;
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
