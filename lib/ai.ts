import type { AnalysisModule, AnalysisReport, BuyingDriver, CommunicationImprovement, ConfirmationItem, CustomerEmotionProfile, DealBlocker, DealDecisionMap, KnowledgeScript, KnowledgeScriptReference, NextStepStrategy, Objection, ProductMention, Provider } from "./types";
import { getRuntimeProviderConfig, type RuntimeProviderConfig } from "./provider-config";
import { buildNumberedConversationChunks, parseConversationMessages, type ParsedConversationMessage } from "./conversation";
import { formatScriptKnowledgeContext, recordScriptUsage, retrieveRelevantScripts, toScriptReferences } from "./script-knowledge";

const profileDimensions = ["身份与组织", "客户类型与经验", "核心需求与目标", "产品兴趣", "决策权与流程", "采购意向", "价格敏感度", "信任状态", "核心关注与风险偏好", "沟通风格与下一步倾向"];

const productMentionsProperty = {
  type: "array",
  items: {
    type: "object", additionalProperties: false,
    required: ["name", "mentionedBy", "customerAwareness", "customerInterest", "awarenessReason", "evidenceMessageId", "evidenceQuote"],
    properties: {
      name: { type: "string" },
      mentionedBy: { type: "string", enum: ["客户", "销售", "双方"] },
      customerAwareness: { type: "string", enum: ["不了解", "初步了解", "有使用经验", "明确熟悉", "无法判断"] },
      customerInterest: { type: "string", enum: ["明确感兴趣", "可能感兴趣", "未表现兴趣", "明确拒绝", "无法判断"] },
      awarenessReason: { type: "string" }, evidenceMessageId: { type: "string" }, evidenceQuote: { type: "string" },
    },
  },
};

function emotionEvidenceSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["messageId", "quote", "translation", "interpretation"],
    properties: {
      messageId: { type: "string" },
      quote: { type: "string" },
      translation: { type: "string" },
      interpretation: { type: "string" },
    },
  } as const;
}

const customerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "profile", "productMentions", "emotionProfile", "confidence"],
  properties: {
    summary: { type: "string" },
    profile: { type: "array", items: { type: "string" } },
    productMentions: productMentionsProperty,
    emotionProfile: {
      type: "object",
      additionalProperties: false,
      required: ["currentState", "currentStateEvidence", "emotionTurningPoints", "personalitySummary", "personalityTraits", "decisionStyle", "decisionFactors", "decisionPace", "communicationApproach", "decisionEvidence", "confidence"],
      properties: {
        currentState: { type: "string" },
        currentStateEvidence: { type: "array", minItems: 1, maxItems: 3, items: emotionEvidenceSchema() },
        emotionTurningPoints: {
          type: "array", maxItems: 8,
          items: {
            type: "object", additionalProperties: false,
            required: ["messageId", "quote", "translation", "interpretation", "label", "score", "reason"],
            properties: { ...emotionEvidenceSchema().properties, label: { type: "string" }, score: { type: "number", minimum: -2, maximum: 2 }, reason: { type: "string" } },
          },
        },
        personalityTraits: {
          type: "array", minItems: 1, maxItems: 5,
          items: {
            type: "object", additionalProperties: false,
            required: ["trait", "explanation", "evidence"],
            properties: { trait: { type: "string" }, explanation: { type: "string" }, evidence: { type: "array", minItems: 1, maxItems: 3, items: emotionEvidenceSchema() } },
          },
        },
        personalitySummary: { type: "string" },
        decisionStyle: { type: "string" },
        decisionFactors: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
        decisionPace: { type: "string" },
        communicationApproach: { type: "string" },
        decisionEvidence: { type: "array", minItems: 1, maxItems: 4, items: emotionEvidenceSchema() },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    },
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
        required: ["id", "category", "label", "status", "evidence", "evidenceMessageId", "evidenceQuote", "riskReason", "seedingNeed", "seedingDirection", "seedingPerformed", "seedingPerformedEvidenceMessageId", "seedingPerformedEvidenceQuote", "seedingAccepted", "seedingAcceptanceEvidenceMessageId", "seedingAcceptanceEvidenceQuote", "seedingAdvice", "medicalNeed", "medicalDirection", "medicalAnswered", "medicalAnswerEvidenceMessageId", "medicalAnswerEvidenceQuote", "medicalAccepted", "medicalAcceptanceEvidenceMessageId", "medicalAcceptanceEvidenceQuote", "medicalAdvice", "scamExperienceStatus", "scamExperienceSummary", "scamAddressed", "scamResponseEvidenceMessageId", "scamResponseEvidenceQuote", "scamAccepted", "scamAcceptanceEvidenceMessageId", "scamAcceptanceEvidenceQuote", "scamAdvice", "coaMentionSource", "coaMentionEvidenceMessageId", "coaMentionEvidenceQuote", "coaExplained", "coaExplanationEvidenceMessageId", "coaExplanationEvidenceQuote", "coaAccepted", "coaAcceptanceEvidenceMessageId", "coaAcceptanceEvidenceQuote", "coaAdvice", "packagingMentionSource", "packagingMentionEvidenceMessageId", "packagingMentionEvidenceQuote", "packagingExplained", "packagingExplanationEvidenceMessageId", "packagingExplanationEvidenceQuote", "packagingAccepted", "packagingAcceptanceEvidenceMessageId", "packagingAcceptanceEvidenceQuote", "packagingAdvice", "companyMentionSource", "companyMentionEvidenceMessageId", "companyMentionEvidenceQuote", "companyExplained", "companyExplanationEvidenceMessageId", "companyExplanationEvidenceQuote", "companyAccepted", "companyAcceptanceEvidenceMessageId", "companyAcceptanceEvidenceQuote", "companyAdvice", "feedbackMentionSource", "feedbackMentionEvidenceMessageId", "feedbackMentionEvidenceQuote", "feedbackAnswered", "feedbackAnswerEvidenceMessageId", "feedbackAnswerEvidenceQuote", "feedbackAccepted", "feedbackAcceptanceEvidenceMessageId", "feedbackAcceptanceEvidenceQuote", "feedbackAdvice", "logisticsMentionSource", "logisticsMentionEvidenceMessageId", "logisticsMentionEvidenceQuote", "logisticsAnswered", "logisticsAnswerEvidenceMessageId", "logisticsAnswerEvidenceQuote", "logisticsCustomerReaction", "logisticsReactionEvidenceMessageId", "logisticsReactionEvidenceQuote", "logisticsAdvice", "paymentMentionSource", "paymentMentionEvidenceMessageId", "paymentMentionEvidenceQuote", "paymentCustomerReaction", "paymentReactionEvidenceMessageId", "paymentReactionEvidenceQuote", "paymentAdvice", "confidence"],
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
          coaMentionSource: { type: "string", enum: ["客户主动询问", "销售主动提出", "未提及", ""] },
          coaMentionEvidenceMessageId: { type: "string" },
          coaMentionEvidenceQuote: { type: "string" },
          coaExplained: { type: "string", enum: ["已说明", "尚未说明", "未确认", ""] },
          coaExplanationEvidenceMessageId: { type: "string" },
          coaExplanationEvidenceQuote: { type: "string" },
          coaAccepted: { type: "string", enum: ["客户明确肯定", "客户未明确肯定", "未确认", ""] },
          coaAcceptanceEvidenceMessageId: { type: "string" },
          coaAcceptanceEvidenceQuote: { type: "string" },
          coaAdvice: { type: "string" },
          packagingMentionSource: { type: "string", enum: ["客户主动询问", "销售主动提出", "未提及", ""] },
          packagingMentionEvidenceMessageId: { type: "string" },
          packagingMentionEvidenceQuote: { type: "string" },
          packagingExplained: { type: "string", enum: ["已说明", "尚未说明", "未确认", ""] },
          packagingExplanationEvidenceMessageId: { type: "string" },
          packagingExplanationEvidenceQuote: { type: "string" },
          packagingAccepted: { type: "string", enum: ["客户明确肯定", "客户未明确肯定", "未确认", ""] },
          packagingAcceptanceEvidenceMessageId: { type: "string" },
          packagingAcceptanceEvidenceQuote: { type: "string" },
          packagingAdvice: { type: "string" },
          companyMentionSource: { type: "string", enum: ["客户主动询问", "销售主动提出", "未提及", ""] },
          companyMentionEvidenceMessageId: { type: "string" },
          companyMentionEvidenceQuote: { type: "string" },
          companyExplained: { type: "string", enum: ["已说明", "尚未说明", "未确认", ""] },
          companyExplanationEvidenceMessageId: { type: "string" },
          companyExplanationEvidenceQuote: { type: "string" },
          companyAccepted: { type: "string", enum: ["客户明确肯定", "客户未明确肯定", "未确认", ""] },
          companyAcceptanceEvidenceMessageId: { type: "string" },
          companyAcceptanceEvidenceQuote: { type: "string" },
          companyAdvice: { type: "string" },
          feedbackMentionSource: { type: "string", enum: ["客户主动询问", "销售主动提出", "未提及", ""] },
          feedbackMentionEvidenceMessageId: { type: "string" },
          feedbackMentionEvidenceQuote: { type: "string" },
          feedbackAnswered: { type: "string", enum: ["已解答", "尚未解答", "未确认", ""] },
          feedbackAnswerEvidenceMessageId: { type: "string" },
          feedbackAnswerEvidenceQuote: { type: "string" },
          feedbackAccepted: { type: "string", enum: ["客户明确肯定", "客户未明确肯定", "未确认", ""] },
          feedbackAcceptanceEvidenceMessageId: { type: "string" },
          feedbackAcceptanceEvidenceQuote: { type: "string" },
          feedbackAdvice: { type: "string" },
          logisticsMentionSource: { type: "string", enum: ["客户主动询问", "销售主动提出", "未提及", ""] },
          logisticsMentionEvidenceMessageId: { type: "string" },
          logisticsMentionEvidenceQuote: { type: "string" },
          logisticsAnswered: { type: "string", enum: ["已解答", "尚未解答", "未确认", ""] },
          logisticsAnswerEvidenceMessageId: { type: "string" },
          logisticsAnswerEvidenceQuote: { type: "string" },
          logisticsCustomerReaction: { type: "string", enum: ["客户满意", "存在异议", "客户未明确表态", "未确认", ""] },
          logisticsReactionEvidenceMessageId: { type: "string" },
          logisticsReactionEvidenceQuote: { type: "string" },
          logisticsAdvice: { type: "string" },
          paymentMentionSource: { type: "string", enum: ["客户主动询问", "销售主动提出", "未提及", ""] },
          paymentMentionEvidenceMessageId: { type: "string" },
          paymentMentionEvidenceQuote: { type: "string" },
          paymentCustomerReaction: { type: "string", enum: ["客户明确肯定", "存在异议", "客户未明确表态", "未确认", ""] },
          paymentReactionEvidenceMessageId: { type: "string" },
          paymentReactionEvidenceQuote: { type: "string" },
          paymentAdvice: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
};

const actionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["improvements", "nextStrategy", "suggestedReply", "suggestedReplyTranslation", "knowledgeReferenceIds"],
  properties: {
    improvements: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["title", "priority", "issue", "customerEvidenceMessageId", "customerEvidenceQuote", "customerEvidenceTranslation", "handling", "salesEvidenceMessageId", "salesEvidenceQuote", "salesEvidenceTranslation", "recommendation"], properties: {
      title: { type: "string" }, priority: { type: "string", enum: ["高", "中", "低"] }, issue: { type: "string" },
      customerEvidenceMessageId: { type: "string" }, customerEvidenceQuote: { type: "string" }, customerEvidenceTranslation: { type: "string" },
      handling: { type: "string" }, salesEvidenceMessageId: { type: "string" }, salesEvidenceQuote: { type: "string" }, salesEvidenceTranslation: { type: "string" }, recommendation: { type: "string" },
    } } },
    nextStrategy: { type: "object", additionalProperties: false, required: ["strategySummary", "primaryGoal", "reasoning", "actions", "communicationMethod", "avoidActions", "evidence"], properties: {
      strategySummary: { type: "string" }, primaryGoal: { type: "string" }, reasoning: { type: "string" }, actions: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } }, communicationMethod: { type: "string" }, avoidActions: { type: "array", maxItems: 4, items: { type: "string" } }, evidence: { type: "array", maxItems: 5, items: emotionEvidenceSchema() },
    } },
    suggestedReply: { type: "string" },
    suggestedReplyTranslation: { type: "string" },
    knowledgeReferenceIds: { type: "array", items: { type: "string" } },
  },
};

const commonPrompt = `你是一名严谨的 B2B 销售对话分析师。判断与事实必须分开，不确定的信息不能当成事实。输入中的每条消息都有稳定编号 M00001 等。不得虚构消息、客户背景、公司资料或公开背调信息。所有分析字段使用中文。`;

const legacyModulePrompts = {
  customer: `${commonPrompt}\n只分析对话总结、客户画像和对话中提及的产品，不判断销售阶段。客户画像必须严格依据原始聊天，禁止用常识补全或虚构。`,
  risk: `${commonPrompt}\n只分析异议、犹豫点、风险和确认清单，JSON 根对象只能包含 objections 和 confirmations。异议必须有真实客户原文，禁止“待确认异议1”等占位标题。按消息顺序判断：未正面回答、回避或客户再次追问=未解决；销售正面回答且客户未再追问=未追问-基本解决；销售回答后客户明确认可=客户肯定-完全解决。基本解决引用销售回答，完全解决引用客户后续肯定；沉默、礼貌致谢或话题切换不算肯定。确认清单必须且只返回 10 项：role、seeding、medical、scammed、coa、packaging、company、feedback、logistics、payment_method，禁止返回 education。只有明确顾虑或成交阻碍才能标记 risk，没谈到应标记 unknown。所有 evidenceQuote 必须逐字引用对应 M 编号原文。seeding 必须在需要种草/无需种草中二选一：需要时填写客户改善期望或痛点方向、销售是否已种草、客户是否在种草后明确肯定及下一步建议；已种草必须引用销售原话，客户明确肯定必须引用更晚的客户原话；非 seeding 项的全部 seeding 字段为空。medical 必须在需要提供建议/无需提供建议中二选一：客户提出剂量、用法、不良反应、禁忌、身体状况、疗效预期等需求时判为需要；需要时填写需求方向、是否已解答、客户是否在解答后明确肯定及下一步建议；已解答必须引用销售原话，客户明确肯定必须引用更晚的客户原话。不得仅因为销售没有写“非医疗建议”免责声明或没有建议咨询医生，就判定为未解答、风险或沟通问题；非 medical 项的全部 medical 字段为空。`,
  action: `${commonPrompt}\n分析“本次沟通可改善和不足”、下一步行动和建议回复。improvements 最多 6 项，按高、中、低优先级排列并语义去重，每项固定三段：issue 说明发生了什么以及影响；handling 客观总结销售如何处理，未处理必须写“销售尚未处理”；recommendation 说明应该怎么处理。前两段只能依据原始对话，不能使用知识库补充事实；recommendation 可以借鉴话术知识库。客户事实必须引用真实客户消息，销售处理必须引用真实销售消息；没有对应证据的字段返回空字符串，不得虚构。此模块评估销售沟通质量，不重复罗列客户异议，也不在改善项中生成完整回复。suggestedReply 沿用客户语言，suggestedReplyTranslation 返回自然简体中文翻译。不得仅因为销售没有写医疗免责声明或没有建议咨询医生而生成改善项。`,
};

const scamPromptAddon = `\nscammed（是否有被骗经历）必须在“有被骗经历”和“无被骗经历”中二选一。“无被骗经历”仅表示当前聊天未发现相关表述，不得写成已核实的终身事实。有被骗经历时必须用 evidenceMessageId/Quote 引用客户原话，scamExperienceSummary 概括被骗方式、损失或造成的不信任；scamAddressed 判断销售是否针对该经历回应，已回应时 scamResponseEvidenceMessageId/Quote 必须引用销售原话；scamAccepted 只有客户在回应之后明确认可、接受或信任改善时才可填客户明确肯定，并引用更晚的客户原话；scamAdvice 给出建立信任和降低首次合作风险的具体建议。无被骗经历时这些明细字段返回空字符串。非 scammed 项的全部 scam 字段返回空字符串。`;
const coaPromptAddon = `\ncoa（COA 与产品一致性）必须返回完整四项判断。coaMentionSource 只能是客户主动询问、销售主动提出或未提及；前两种必须分别用 coaMentionEvidenceMessageId/Quote 引用客户或销售原话。coaExplained 判断销售是否已明确说明 COA、批次与实际交付产品的对应关系；已说明必须用 coaExplanationEvidenceMessageId/Quote 引用销售原话。coaAccepted 只有客户在说明之后明确认可、理解或确认接受时才可填客户明确肯定，并用 coaAcceptanceEvidenceMessageId/Quote 引用更晚的客户原话；沉默、礼貌致谢和转移话题不算。coaAdvice 必须结合当前缺口给出具体下一步建议。未提及时相关证据字段为空。非 coa 项的全部 coa 专属字段返回空字符串。`;
const packagingPromptAddon = `\npackaging（产品包装）必须返回完整四项判断。packagingMentionSource 只能是客户主动询问、销售主动提出或未提及；前两种必须分别用 packagingMentionEvidenceMessageId/Quote 引用客户或销售原话。packagingExplained 判断销售是否已明确说明包装形式、规格、标签、隐私性或运输防护等客户关心的包装信息；已说明必须用 packagingExplanationEvidenceMessageId/Quote 引用销售原话。packagingAccepted 只有客户在说明之后明确认可、理解或确认接受时才可填客户明确肯定，并用 packagingAcceptanceEvidenceMessageId/Quote 引用更晚的客户原话；沉默、礼貌致谢和转移话题不算。packagingAdvice 必须结合当前缺口给出具体下一步建议。未提及时相关证据字段为空。非 packaging 项的全部 packaging 专属字段返回空字符串。`;
const companyPromptAddon = `\ncompany（公司资料）必须返回完整四项判断。companyMentionSource 只能是客户主动询问、销售主动提出或未提及；前两种必须分别用 companyMentionEvidenceMessageId/Quote 引用客户或销售原话。companyExplained 判断销售是否已提供客户关心且可核验的公司资料，例如公司主体、所在地、生产或办公信息、官网、资质证书或联系方式；只有“多年经验”“实力强”等笼统宣传不能单独算已说明。已说明必须用 companyExplanationEvidenceMessageId/Quote 引用销售原话。companyAccepted 只有客户在说明之后明确认可、理解或确认资料足够时才可填客户明确肯定，并用 companyAcceptanceEvidenceMessageId/Quote 引用更晚的客户原话；沉默、礼貌致谢和转移话题不算。companyAdvice 必须结合当前缺口给出具体下一步建议，不得虚构公司资料。未提及时相关证据字段为空。非 company 项的全部 company 专属字段返回空字符串。`;
const feedbackPromptAddon = `\nfeedback（其他客户反馈）指用于增强信任的真实社会证明，包括物流签收或时效参考、其他客户返图、真实聊天反馈、评价和相似客户案例。必须返回完整四项判断。feedbackMentionSource 只能是客户主动询问、销售主动提出或未提及；前两种必须分别用 feedbackMentionEvidenceMessageId/Quote 引用客户或销售原话。feedbackAnswered 判断销售是否已针对客户关心点提供具体反馈或案例；只说“很多客户满意”“我们口碑很好”等空泛宣传不能单独算已解答。已解答必须用 feedbackAnswerEvidenceMessageId/Quote 引用销售原话。feedbackAccepted 只有客户在解答之后明确认可、信任增强或确认该参考有帮助时才可填客户明确肯定，并用 feedbackAcceptanceEvidenceMessageId/Quote 引用更晚的客户原话；沉默、礼貌致谢和转移话题不算。feedbackAdvice 必须结合客户所在国家、关注点或信任缺口建议最相关的证明类型，同时提醒保护其他客户隐私，不得虚构案例或反馈。未提及时相关证据字段为空。非 feedback 项的全部 feedback 专属字段返回空字符串。`;
const logisticsPromptAddon = `\nlogistics（物流、清关和时效）必须返回完整判断。范围包括发货方式、承运渠道、运输时效、轨迹查询、目的国清关、税费、延误和异常处理。logisticsMentionSource 只能是客户主动询问、销售主动提出或未提及；前两种必须分别用 logisticsMentionEvidenceMessageId/Quote 引用客户或销售原话。logisticsAnswered 判断销售是否针对客户实际关心点给出具体且不过度承诺的说明；已解答必须用 logisticsAnswerEvidenceMessageId/Quote 引用销售原话。logisticsCustomerReaction 只能是客户满意、存在异议、客户未明确表态或未确认。客户满意必须引用销售解答之后明确表示认可或接受的客户原话；沉默、礼貌致谢或转移话题不算满意。存在异议必须引用客户关于价格、时效、清关、税费、渠道或风险的真实质疑，可发生在解答前或解答后。logisticsAdvice 必须针对尚未回答的物流要素或客户异议给出下一步建议，不得承诺无法保证的时效或清关结果。未提及时相关证据字段为空。非 logistics 项的全部 logistics 专属字段返回空字符串。`;
const paymentPromptAddon = `\npayment_method（支付方式与付款安全）必须返回完整判断。范围包括可用支付渠道、手续费、币种、到账、退款、拒付、首单资金安全和付款保障。paymentMentionSource 只能是客户主动询问、销售主动提出或未提及；前两种必须分别用 paymentMentionEvidenceMessageId/Quote 引用客户或销售原话。paymentCustomerReaction 只能是客户明确肯定、存在异议、客户未明确表态或未确认。客户明确肯定必须引用支付信息提出之后，客户明确接受某种支付方式或认可付款安排的原话；沉默、礼貌致谢和转移话题不算肯定。存在异议必须引用客户对安全、保障、费用、退款、到账或支付渠道的真实顾虑；单纯询问“支持哪些付款方式”不自动算异议。paymentAdvice 必须针对客户尚未确认的支付要素或真实异议给出下一步建议，不得虚构保障、平台规则或承诺绝对安全。未提及时相关证据字段为空。非 payment_method 项的全部 payment 专属字段返回空字符串。`;

const profileSchema = {
  type: "object", additionalProperties: false,
  required: ["summary", "profile", "productMentions", "confidence"],
  properties: {
    summary: customerSchema.properties.summary,
    profile: customerSchema.properties.profile,
    productMentions: productMentionsProperty,
    confidence: customerSchema.properties.confidence,
  },
};

const psychologySchema = {
  type: "object", additionalProperties: false, required: ["emotionProfile"],
  properties: { emotionProfile: customerSchema.properties.emotionProfile },
};

const psychologyStateSchema = {
  type: "object", additionalProperties: false,
  required: ["currentState", "currentStateEvidence", "emotionTurningPoints"],
  properties: {
    currentState: customerSchema.properties.emotionProfile.properties.currentState,
    currentStateEvidence: customerSchema.properties.emotionProfile.properties.currentStateEvidence,
    emotionTurningPoints: customerSchema.properties.emotionProfile.properties.emotionTurningPoints,
  },
};

const psychologyTraitsSchema = {
  type: "object", additionalProperties: false,
  required: ["personalitySummary", "personalityTraits"],
  properties: { personalitySummary: customerSchema.properties.emotionProfile.properties.personalitySummary, personalityTraits: customerSchema.properties.emotionProfile.properties.personalityTraits },
};

const psychologyDecisionSchema = {
  type: "object", additionalProperties: false,
  required: ["decisionStyle", "decisionFactors", "decisionPace", "communicationApproach", "decisionEvidence", "confidence"],
  properties: {
    decisionStyle: customerSchema.properties.emotionProfile.properties.decisionStyle,
    decisionFactors: customerSchema.properties.emotionProfile.properties.decisionFactors,
    decisionPace: customerSchema.properties.emotionProfile.properties.decisionPace,
    communicationApproach: customerSchema.properties.emotionProfile.properties.communicationApproach,
    decisionEvidence: customerSchema.properties.emotionProfile.properties.decisionEvidence,
    confidence: customerSchema.properties.emotionProfile.properties.confidence,
  },
};

const objectionsSchema = {
  type: "object", additionalProperties: false, required: ["objections"],
  properties: { objections: riskSchema.properties.objections },
};

const checklistSchema = {
  type: "object", additionalProperties: false, required: ["decisionMap"],
  properties: {
    decisionMap: { type: "object", additionalProperties: false, required: ["motivationLevel", "biggestBlocker", "readiness", "priorityTask", "buyingDrivers", "blockers"], properties: {
      motivationLevel: { type: "string", enum: ["强", "中", "弱"] }, biggestBlocker: { type: "string" }, readiness: { type: "string", enum: ["高", "中", "低"] }, priorityTask: { type: "string" },
      buyingDrivers: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, required: ["title", "desiredOutcome", "painOrExpectation", "strength", "purchaseIntent", "conversionReason", "evidenceMessageId", "evidenceQuote", "evidenceTranslation"], properties: {
        title: { type: "string" }, desiredOutcome: { type: "string" }, painOrExpectation: { type: "string" }, strength: { type: "string", enum: ["强", "中", "弱"] }, purchaseIntent: { type: "string", enum: ["明确", "较高", "观察中"] }, conversionReason: { type: "string" }, evidenceMessageId: { type: "string" }, evidenceQuote: { type: "string" }, evidenceTranslation: { type: "string" },
      } } },
      blockers: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["title", "category", "concern", "dealImpact", "evidenceMessageId", "evidenceQuote", "evidenceTranslation", "handlingStatus", "salesEvidenceMessageId", "salesEvidenceQuote", "salesEvidenceTranslation", "resolutionEvidenceMessageId", "resolutionEvidenceQuote", "resolutionEvidenceTranslation", "solutionDirection"], properties: {
        title: { type: "string" }, category: { type: "string", enum: ["产品匹配", "产品知识", "价格与预算", "质量与COA", "公司与供应商信任", "包装与交付", "物流清关与时效", "支付与资金安全", "决策时机", "内部审批", "其他顾虑"] }, concern: { type: "string" }, dealImpact: { type: "string" }, evidenceMessageId: { type: "string" }, evidenceQuote: { type: "string" }, evidenceTranslation: { type: "string" }, handlingStatus: { type: "string", enum: ["未解决", "已回答-客户未追问", "客户明确认可"] }, salesEvidenceMessageId: { type: "string" }, salesEvidenceQuote: { type: "string" }, salesEvidenceTranslation: { type: "string" }, resolutionEvidenceMessageId: { type: "string" }, resolutionEvidenceQuote: { type: "string" }, resolutionEvidenceTranslation: { type: "string" }, solutionDirection: { type: "string" },
      } } },
    } },
  },
};

const analysisPrompts: Record<AnalysisModule, string> = {
  customer: `${commonPrompt}\n只返回对话总结、客户画像标签和对话提及产品，不判断或输出任何销售阶段。profile 由模型根据真实聊天自由提炼为简洁、具体、可独立阅读的画像标签，不预设分类、固定数量、顺序或“分类：内容”格式；应尽可能覆盖聊天中有证据的身份、经验、需求、关注点、信任、价格、决策和沟通特征，使画像足够丰富，通常可提炼 5 至 12 个标签，证据确实较少时允许更少。没有原文依据的特征不得输出，不得为了凑数量重复。productMentions 必须列出聊天中出现的每一个具体产品、多肽或药物并去重。公司名、厂家名、店铺名以及仅代表供应方的品牌名称不得作为产品输出；若商品名本身明确指向一种具体产品或药物，则应按具体产品保留。mentionedBy 判断客户、销售或双方提及；customerAwareness 依据客户原话判断不了解、初步了解、有使用经验、明确熟悉或无法判断；customerInterest 判断明确感兴趣、可能感兴趣、未表现兴趣、明确拒绝或无法判断；awarenessReason 说明判断依据。evidenceMessageId 和 evidenceQuote 必须引用包含该产品名或能直接证明客户了解程度的真实消息编号及逐字原文。仅由销售提及而客户未回应时，客户了解程度和兴趣必须填无法判断。`,
  psychology: `${commonPrompt}\n只返回 emotionProfile，并严格按 JSON 示例字段输出。\n1. currentState 将客户当前情绪与可从表达观察到的心理状态合并成一段结论；不要诊断疾病、人格障碍或贴 MBTI 标签。currentStateEvidence 必须给出支持结论的真实客户消息。\n2. emotionTurningPoints 按聊天先后顺序提取真正发生变化的 0-8 个情绪转折点。score 只能为 -2 到 2；label 是简短情绪标签，reason 说明转折原因。没有明显转折时返回 []，不得虚构。\n3. personalitySummary 用一句自然中文概括全部可观察沟通性格；personalityTraits 再列具体倾向，每项包含 trait、explanation 和自己的 evidence；不输出敏感点或防御/回避模式。\n4. decisionStyle 总结决策方式；decisionFactors 写主要考虑因素；decisionPace 写决策节奏；communicationApproach 写适合的沟通方式；decisionEvidence 必须直接支撑判断。\n5. 每条 evidence 必须引用真实客户消息的 M 编号与逐字原文，并提供忠实中文翻译和解释。禁止改写、拼接或引用销售消息。信息不足时明确说明并降低 confidence。`,
  objections: `${commonPrompt}\n只返回 objections。仅保留有客户逐字原文证据的明确异议或犹豫，禁止占位标题。未正面回答或客户再次追问=未解决；销售正面回答且客户未再追问=未追问-基本解决；销售回答后客户明确认可=客户肯定-完全解决。解决证据必须发生在异议之后；沉默、礼貌致谢和话题切换不算肯定。`,
  checklist: `${commonPrompt}\n业务上只返回 decisionMap（成交决策地图），禁止返回 offensePoints、defensePoints、confirmations 或独立 objections。它只回答：客户为什么想买、为什么还没买、当前最需要解决什么。\nbuyingDrivers 只保留真正推动购买的核心原因，最多3项；相同目标、需求、购买意向、直接货源诉求必须语义合并，禁止拆成近义卡片。每项必须由客户原文支撑，并区分想获得的结果、痛点或期望、驱动力强度、购买意愿和推动成交的原因。\nblockers 合并所有明确异议、产品疑问、价格预算、质量COA、公司信任、包装交付、物流、支付、决策时机和内部审批问题。一个语义问题只输出一次。客户疑问即使代表兴趣，只要尚未解决并可能阻碍决定，就只能进入 blockers，不能同时进入 buyingDrivers。\nhandlingStatus 严格按消息顺序判断：没有销售正面处理或客户再次追问=未解决；销售正面处理后客户未再追问=已回答-客户未追问；销售处理后客户明确认可=客户明确认可。礼貌致谢、沉默和换话题不算明确认可。销售处理存在时必须提供更晚的销售原文；客户明确认可时还必须提供销售处理之后的客户认可原文。不存在的销售处理或认可证据字段全部返回空字符串。\n每个 driver 和 blocker 都必须引用一个可核验客户 M 编号及逐字原文和忠实中文翻译，禁止拼接、改写或虚构。decisionMap 顶部给出总体下单动力、最大阻力、成交准备度和一句首要任务。这里只输出诊断和解决方向，不生成完整回复话术；完整回复属于 action 模块。`,
  action: `${legacyModulePrompts.action}\n你会同时收到“上游分析结果”，必须综合其中的对话总结、沟通性格倾向、决策方式、核心下单驱动力、成交阻力和沟通不足生成 nextStrategy。strategySummary 用一句话给出当前最合适的成交推进策略；primaryGoal 只保留本轮唯一核心目标；reasoning 解释该策略如何匹配客户性格与决策方式、如何放大真实下单驱动力并优先解决最大成交阻力；actions 按执行顺序列出 1-5 步；communicationMethod 明确表达风格和推进节奏；avoidActions 列出此刻不要做的事。evidence 只引用支撑关键策略判断的真实客户原话。不得机械复述所有分析板块，也不得同时设置多个核心目标。\n如果提供了话术知识库资料，应优先借鉴与当前客户问题直接相关的表达和销售思路，但不能照搬不适用于当前客户的事实。knowledgeReferenceIds 只返回实际用于 suggestedReply 的话术 ID；没有使用时返回 []，禁止编造 ID。`,
};

export interface CustomerModuleResult {
  summary: string;
  profile: string[];
  productMentions: ProductMention[];
  confidence: number;
}

export interface PsychologyModuleResult { emotionProfile: CustomerEmotionProfile }
export interface ObjectionsModuleResult { objections: Objection[] }
export interface ChecklistModuleResult { decisionMap: DealDecisionMap }
interface RiskModuleResult { objections: Objection[]; confirmations: ConfirmationItem[] }
export interface ActionModuleResult { improvements: CommunicationImprovement[]; nextStrategy: NextStepStrategy; suggestedReply: string; suggestedReplyTranslation: string; knowledgeReferenceIds: string[]; knowledgeReferences?: KnowledgeScriptReference[] }
export type AnalysisModuleResult = CustomerModuleResult | PsychologyModuleResult | ObjectionsModuleResult | ChecklistModuleResult | ActionModuleResult;

interface ChecklistModelResult { decisionMap: DealDecisionMap }
interface ChecklistModelItem {
  id: string; status: ConfirmationItem["status"]; evidence: string; evidenceMessageId: string; evidenceQuote: string; riskReason: string;
  conclusion: string; detail: string; source: "客户主动询问" | "销售主动提出" | "未提及" | "不适用";
  handling: "已处理" | "尚未处理" | "未确认" | "不适用"; handlingEvidenceMessageId: string; handlingEvidenceQuote: string;
  reaction: "客户明确肯定" | "客户满意" | "存在异议" | "客户未明确表态" | "未确认" | "不适用";
  reactionEvidenceMessageId: string; reactionEvidenceQuote: string; advice: string; confidence: number;
}
interface LegacyChecklistModelResult { confirmations: ChecklistModelItem[] }

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

function removeTrailingJsonCommas(content: string) {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (inString) {
      result += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }
    if (character === ",") {
      let next = index + 1;
      while (next < content.length && /\s/.test(content[next])) next += 1;
      if (content[next] === "}" || content[next] === "]") continue;
    }
    result += character;
  }
  return result;
}

function parseJsonContent<T>(content: string): T {
  const unfenced = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  const cleaned = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
  try {
    return JSON.parse(cleaned) as T;
  } catch (initialError) {
    const repaired = removeTrailingJsonCommas(cleaned);
    if (repaired === cleaned) throw initialError;
    return JSON.parse(repaired) as T;
  }
}

async function requestDeepSeekJson<T>(
  config: RuntimeProviderConfig,
  messages: Array<{ role: "system" | "user"; content: string }>,
  maxTokens: number,
): Promise<T> {
  let lastFinishReason = "unknown";
  let lastFailure = "返回内容为空";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retryMessages = attempt === 0 ? messages : [
      ...messages,
      { role: "user" as const, content: `上一次输出未通过 JSON 解析：${lastFailure}。请从头重新输出一个完整、非空、语法严格合法的 JSON 对象。所有字段名和字符串必须使用双引号，最后一个字段或数组元素后禁止保留逗号，不要输出 Markdown。` },
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
    if (!content) {
      lastFailure = `返回内容为空（finish_reason: ${lastFinishReason}）`;
      continue;
    }
    try {
      return parseJsonContent<T>(content);
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : "JSON 语法错误";
    }
  }
  throw new Error(`DeepSeek 连续两次未返回合法 JSON（${lastFailure}；finish_reason: ${lastFinishReason}）。请重试该模块或暂时改用 OpenAI。`);
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
  if (module === "customer") return profileSchema;
  if (module === "psychology") return psychologySchema;
  if (module === "objections") return objectionsSchema;
  if (module === "checklist") return checklistSchema;
  return actionSchema;
}

const confirmationIds = ["role", "seeding", "medical", "scammed", "coa", "packaging", "company", "feedback", "logistics", "payment_method"];

function deepSeekJsonExample(module: AnalysisModule): Record<string, unknown> {
  if (module === "customer") return {
    summary: "根据完整对话生成的中文总结",
    profile: ["有原文依据的画像标签一", "有原文依据的画像标签二", "有原文依据的画像标签三"],
    productMentions: [{ name: "对话中的真实产品名", mentionedBy: "客户", customerAwareness: "初步了解", customerInterest: "明确感兴趣", awarenessReason: "根据客户原话说明判断", evidenceMessageId: "M00001", evidenceQuote: "必须替换成对应消息中的逐字原文" }],
    confidence: 0.8,
  };
  if (module === "psychology") return {
    emotionProfile: {
      currentState: "合并描述当前情绪和可观察到的心理状态",
      currentStateEvidence: [{ messageId: "M00001", quote: "必须替换成该客户消息中的逐字原文", translation: "逐字原文的忠实中文翻译", interpretation: "说明如何支持当前状态判断" }],
      emotionTurningPoints: [{ messageId: "M00001", quote: "必须替换成该客户消息中的逐字原文", translation: "逐字原文的忠实中文翻译", interpretation: "解释情绪含义", label: "谨慎", score: -1, reason: "说明该处为什么构成情绪转折" }],
      personalityTraits: [{ trait: "证据导向", explanation: "使用限定语说明该沟通倾向", evidence: [{ messageId: "M00001", quote: "必须替换成该客户消息中的逐字原文", translation: "逐字原文的忠实中文翻译", interpretation: "说明如何支持该倾向" }] }],
      personalitySummary: "客户表达直接、重视证据，倾向核实关键信息后再决定。",
      decisionStyle: "概括客户的决策方式",
      decisionFactors: ["有原文依据的主要考虑因素"],
      decisionPace: "描述客户的决策节奏",
      communicationApproach: "适合当前客户的沟通方式",
      decisionEvidence: [{ messageId: "M00001", quote: "必须替换成该客户消息中的逐字原文", translation: "逐字原文的忠实中文翻译", interpretation: "说明如何支持决策判断" }],
      confidence: 0.8,
    },
  };
  if (module === "objections") return { objections: [] };
  if (module === "checklist") return {
    decisionMap: {
      motivationLevel: "强", biggestBlocker: "当前最主要的真实成交阻力", readiness: "中", priorityTask: "当前只做的一项首要任务",
      buyingDrivers: [{ title: "合并后的核心下单驱动力", desiredOutcome: "客户想获得的结果", painOrExpectation: "客户痛点或期望", strength: "强", purchaseIntent: "较高", conversionReason: "为什么能推动成交", evidenceMessageId: "M00001", evidenceQuote: "必须替换为对应客户消息的逐字原文", evidenceTranslation: "忠实中文翻译" }],
      blockers: [{ title: "唯一且具体的成交阻力", category: "支付与资金安全", concern: "客户具体担心什么", dealImpact: "该问题如何影响成交", evidenceMessageId: "M00002", evidenceQuote: "必须替换为对应客户消息的逐字原文", evidenceTranslation: "忠实中文翻译", handlingStatus: "未解决", salesEvidenceMessageId: "", salesEvidenceQuote: "", salesEvidenceTranslation: "", resolutionEvidenceMessageId: "", resolutionEvidenceQuote: "", resolutionEvidenceTranslation: "", solutionDirection: "不包含完整话术的解决方向" }],
    },
  };
  return {
    improvements: [{ title: "未直接回应关键问题", priority: "高", issue: "客户提出关键问题，但回复未正面覆盖，可能降低沟通效率。", customerEvidenceMessageId: "M00001", customerEvidenceQuote: "客户逐字原文", customerEvidenceTranslation: "忠实中文翻译", handling: "销售尚未处理", salesEvidenceMessageId: "", salesEvidenceQuote: "", salesEvidenceTranslation: "", recommendation: "先直接回答问题，再补充必要背景。" }],
    nextStrategy: { strategySummary: "一句话说明当前最合适的推进策略", primaryGoal: "本轮唯一核心目标", reasoning: "说明如何匹配沟通性格、决策方式、下单驱动力和成交阻力", actions: ["第一步具体行动"], communicationMethod: "适合客户的表达方式与节奏", avoidActions: ["此刻不要做的事"], evidence: [{ messageId: "M00001", quote: "客户逐字原文", translation: "忠实中文翻译", interpretation: "如何支撑策略判断" }] },
    suggestedReply: "A natural reply in the customer's language.",
    suggestedReplyTranslation: "上一条建议回复的自然简体中文翻译。",
    knowledgeReferenceIds: [],
  };
}

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
  const confirmations: ConfirmationItem[] = confirmationDefinitions.map((definition): ConfirmationItem => {
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
      coaMentionSource: item?.id === "coa" && (item.coaMentionSource === "客户主动询问" || item.coaMentionSource === "销售主动提出" || item.coaMentionSource === "未提及") ? item.coaMentionSource : undefined,
      coaMentionEvidenceMessageId: item?.id === "coa" ? item.coaMentionEvidenceMessageId || "" : "",
      coaMentionEvidenceQuote: item?.id === "coa" ? item.coaMentionEvidenceQuote || "" : "",
      coaExplained: item?.id === "coa" && (item.coaExplained === "已说明" || item.coaExplained === "尚未说明" || item.coaExplained === "未确认") ? item.coaExplained : undefined,
      coaExplanationEvidenceMessageId: item?.id === "coa" ? item.coaExplanationEvidenceMessageId || "" : "",
      coaExplanationEvidenceQuote: item?.id === "coa" ? item.coaExplanationEvidenceQuote || "" : "",
      coaAccepted: item?.id === "coa" && (item.coaAccepted === "客户明确肯定" || item.coaAccepted === "客户未明确肯定" || item.coaAccepted === "未确认") ? item.coaAccepted : undefined,
      coaAcceptanceEvidenceMessageId: item?.id === "coa" ? item.coaAcceptanceEvidenceMessageId || "" : "",
      coaAcceptanceEvidenceQuote: item?.id === "coa" ? item.coaAcceptanceEvidenceQuote || "" : "",
      coaAdvice: item?.id === "coa" ? item.coaAdvice?.trim() || "" : "",
      packagingMentionSource: item?.id === "packaging" && (item.packagingMentionSource === "客户主动询问" || item.packagingMentionSource === "销售主动提出" || item.packagingMentionSource === "未提及") ? item.packagingMentionSource : undefined,
      packagingMentionEvidenceMessageId: item?.id === "packaging" ? item.packagingMentionEvidenceMessageId || "" : "",
      packagingMentionEvidenceQuote: item?.id === "packaging" ? item.packagingMentionEvidenceQuote || "" : "",
      packagingExplained: item?.id === "packaging" && (item.packagingExplained === "已说明" || item.packagingExplained === "尚未说明" || item.packagingExplained === "未确认") ? item.packagingExplained : undefined,
      packagingExplanationEvidenceMessageId: item?.id === "packaging" ? item.packagingExplanationEvidenceMessageId || "" : "",
      packagingExplanationEvidenceQuote: item?.id === "packaging" ? item.packagingExplanationEvidenceQuote || "" : "",
      packagingAccepted: item?.id === "packaging" && (item.packagingAccepted === "客户明确肯定" || item.packagingAccepted === "客户未明确肯定" || item.packagingAccepted === "未确认") ? item.packagingAccepted : undefined,
      packagingAcceptanceEvidenceMessageId: item?.id === "packaging" ? item.packagingAcceptanceEvidenceMessageId || "" : "",
      packagingAcceptanceEvidenceQuote: item?.id === "packaging" ? item.packagingAcceptanceEvidenceQuote || "" : "",
      packagingAdvice: item?.id === "packaging" ? item.packagingAdvice?.trim() || "" : "",
      companyMentionSource: item?.id === "company" && (item.companyMentionSource === "客户主动询问" || item.companyMentionSource === "销售主动提出" || item.companyMentionSource === "未提及") ? item.companyMentionSource : undefined,
      companyMentionEvidenceMessageId: item?.id === "company" ? item.companyMentionEvidenceMessageId || "" : "",
      companyMentionEvidenceQuote: item?.id === "company" ? item.companyMentionEvidenceQuote || "" : "",
      companyExplained: item?.id === "company" && (item.companyExplained === "已说明" || item.companyExplained === "尚未说明" || item.companyExplained === "未确认") ? item.companyExplained : undefined,
      companyExplanationEvidenceMessageId: item?.id === "company" ? item.companyExplanationEvidenceMessageId || "" : "",
      companyExplanationEvidenceQuote: item?.id === "company" ? item.companyExplanationEvidenceQuote || "" : "",
      companyAccepted: item?.id === "company" && (item.companyAccepted === "客户明确肯定" || item.companyAccepted === "客户未明确肯定" || item.companyAccepted === "未确认") ? item.companyAccepted : undefined,
      companyAcceptanceEvidenceMessageId: item?.id === "company" ? item.companyAcceptanceEvidenceMessageId || "" : "",
      companyAcceptanceEvidenceQuote: item?.id === "company" ? item.companyAcceptanceEvidenceQuote || "" : "",
      companyAdvice: item?.id === "company" ? item.companyAdvice?.trim() || "" : "",
      feedbackMentionSource: item?.id === "feedback" && (item.feedbackMentionSource === "客户主动询问" || item.feedbackMentionSource === "销售主动提出" || item.feedbackMentionSource === "未提及") ? item.feedbackMentionSource : undefined,
      feedbackMentionEvidenceMessageId: item?.id === "feedback" ? item.feedbackMentionEvidenceMessageId || "" : "",
      feedbackMentionEvidenceQuote: item?.id === "feedback" ? item.feedbackMentionEvidenceQuote || "" : "",
      feedbackAnswered: item?.id === "feedback" && (item.feedbackAnswered === "已解答" || item.feedbackAnswered === "尚未解答" || item.feedbackAnswered === "未确认") ? item.feedbackAnswered : undefined,
      feedbackAnswerEvidenceMessageId: item?.id === "feedback" ? item.feedbackAnswerEvidenceMessageId || "" : "",
      feedbackAnswerEvidenceQuote: item?.id === "feedback" ? item.feedbackAnswerEvidenceQuote || "" : "",
      feedbackAccepted: item?.id === "feedback" && (item.feedbackAccepted === "客户明确肯定" || item.feedbackAccepted === "客户未明确肯定" || item.feedbackAccepted === "未确认") ? item.feedbackAccepted : undefined,
      feedbackAcceptanceEvidenceMessageId: item?.id === "feedback" ? item.feedbackAcceptanceEvidenceMessageId || "" : "",
      feedbackAcceptanceEvidenceQuote: item?.id === "feedback" ? item.feedbackAcceptanceEvidenceQuote || "" : "",
      feedbackAdvice: item?.id === "feedback" ? item.feedbackAdvice?.trim() || "" : "",
      logisticsMentionSource: item?.id === "logistics" && (item.logisticsMentionSource === "客户主动询问" || item.logisticsMentionSource === "销售主动提出" || item.logisticsMentionSource === "未提及") ? item.logisticsMentionSource : undefined,
      logisticsMentionEvidenceMessageId: item?.id === "logistics" ? item.logisticsMentionEvidenceMessageId || "" : "",
      logisticsMentionEvidenceQuote: item?.id === "logistics" ? item.logisticsMentionEvidenceQuote || "" : "",
      logisticsAnswered: item?.id === "logistics" && (item.logisticsAnswered === "已解答" || item.logisticsAnswered === "尚未解答" || item.logisticsAnswered === "未确认") ? item.logisticsAnswered : undefined,
      logisticsAnswerEvidenceMessageId: item?.id === "logistics" ? item.logisticsAnswerEvidenceMessageId || "" : "",
      logisticsAnswerEvidenceQuote: item?.id === "logistics" ? item.logisticsAnswerEvidenceQuote || "" : "",
      logisticsCustomerReaction: item?.id === "logistics" && (item.logisticsCustomerReaction === "客户满意" || item.logisticsCustomerReaction === "存在异议" || item.logisticsCustomerReaction === "客户未明确表态" || item.logisticsCustomerReaction === "未确认") ? item.logisticsCustomerReaction : undefined,
      logisticsReactionEvidenceMessageId: item?.id === "logistics" ? item.logisticsReactionEvidenceMessageId || "" : "",
      logisticsReactionEvidenceQuote: item?.id === "logistics" ? item.logisticsReactionEvidenceQuote || "" : "",
      logisticsAdvice: item?.id === "logistics" ? item.logisticsAdvice?.trim() || "" : "",
      paymentMentionSource: item?.id === "payment_method" && (item.paymentMentionSource === "客户主动询问" || item.paymentMentionSource === "销售主动提出" || item.paymentMentionSource === "未提及") ? item.paymentMentionSource : undefined,
      paymentMentionEvidenceMessageId: item?.id === "payment_method" ? item.paymentMentionEvidenceMessageId || "" : "",
      paymentMentionEvidenceQuote: item?.id === "payment_method" ? item.paymentMentionEvidenceQuote || "" : "",
      paymentCustomerReaction: item?.id === "payment_method" && (item.paymentCustomerReaction === "客户明确肯定" || item.paymentCustomerReaction === "存在异议" || item.paymentCustomerReaction === "客户未明确表态" || item.paymentCustomerReaction === "未确认") ? item.paymentCustomerReaction : undefined,
      paymentReactionEvidenceMessageId: item?.id === "payment_method" ? item.paymentReactionEvidenceMessageId || "" : "",
      paymentReactionEvidenceQuote: item?.id === "payment_method" ? item.paymentReactionEvidenceQuote || "" : "",
      paymentAdvice: item?.id === "payment_method" ? item.paymentAdvice?.trim() || "" : "",
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    } satisfies ConfirmationItem;
  });
  return { objections, confirmations };
}

function cleanStringArray(value: unknown, fallback: string[] = ["信息不足"]) {
  const values = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
  return values.length ? values.slice(0, 5) : fallback;
}

function normalizeCustomerResult(value: unknown, messages: ParsedConversationMessage[]): CustomerModuleResult {
  const raw = value && typeof value === "object" ? value as Partial<CustomerModuleResult> : {};
  const profile = Array.isArray(raw.profile)
    ? raw.profile.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
  const confidence = Number(raw.confidence);
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const awarenessValues = new Set<ProductMention["customerAwareness"]>(["不了解", "初步了解", "有使用经验", "明确熟悉", "无法判断"]);
  const interestValues = new Set<ProductMention["customerInterest"]>(["明确感兴趣", "可能感兴趣", "未表现兴趣", "明确拒绝", "无法判断"]);
  const mentionedByValues = new Set<ProductMention["mentionedBy"]>(["客户", "销售", "双方"]);
  const productMentions = (Array.isArray(raw.productMentions) ? raw.productMentions : []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const mention = item as ProductMention;
    const message = messageById.get(mention.evidenceMessageId);
    if (!mention.name?.trim() || !mention.awarenessReason?.trim() || !message || !hasVerifiedEvidence(messageById, mention.evidenceMessageId, mention.evidenceQuote)) return [];
    return [{
      name: mention.name.trim(),
      mentionedBy: mentionedByValues.has(mention.mentionedBy) ? mention.mentionedBy : message.role === "customer" ? "客户" as const : "销售" as const,
      customerAwareness: awarenessValues.has(mention.customerAwareness) ? mention.customerAwareness : "无法判断" as const,
      customerInterest: interestValues.has(mention.customerInterest) ? mention.customerInterest : "无法判断" as const,
      awarenessReason: mention.awarenessReason.trim(), evidenceMessageId: mention.evidenceMessageId, evidenceQuote: mention.evidenceQuote.trim(),
    }];
  }).filter((item, index, items) => items.findIndex((candidate) => candidate.name.toLocaleLowerCase() === item.name.toLocaleLowerCase()) === index);
  return {
    summary: raw.summary?.trim() || "当前对话信息不足，建议结合原始聊天人工核对。",
    profile: profile.length ? profile : ["当前对话信息不足，暂未形成明确画像"],
    productMentions,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.25,
  };
}

function requireRawModuleResult(module: AnalysisModule, value: unknown, messages: ParsedConversationMessage[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${module} 模块返回了空结果或无效 JSON 对象`);
  }
  const raw = value as Record<string, unknown>;
  if (module === "customer") {
    const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
    const profile = Array.isArray(raw.profile) ? raw.profile.filter((item) => typeof item === "string" && item.trim()) : [];
    if (!summary || profile.length < 1 || !Number.isFinite(Number(raw.confidence))) {
      throw new Error("客户总结或画像字段不完整（需要总结、有效画像标签和置信度）");
    }
    return;
  }
  if (module === "psychology") {
    const emotion = raw.emotionProfile && typeof raw.emotionProfile === "object" && !Array.isArray(raw.emotionProfile)
      ? raw.emotionProfile as Record<string, unknown> : {};
    const requiredStrings = ["currentState", "personalitySummary", "decisionStyle", "decisionPace", "communicationApproach"];
    const requiredLists = ["currentStateEvidence", "emotionTurningPoints", "personalityTraits", "decisionFactors", "decisionEvidence"];
    const stringLists = ["decisionFactors"];
    const objectLists = ["currentStateEvidence", "emotionTurningPoints", "personalityTraits", "decisionEvidence"];
    const stringsComplete = requiredStrings.every((key) => typeof emotion[key] === "string" && Boolean((emotion[key] as string).trim()));
    const listsComplete = requiredLists.every((key) => Array.isArray(emotion[key]));
    const stringListsValid = stringLists.every((key) => !Array.isArray(emotion[key]) || (emotion[key] as unknown[]).every((item) => typeof item === "string" && Boolean(item.trim())));
    const objectListsValid = objectLists.every((key) => !Array.isArray(emotion[key]) || (emotion[key] as unknown[]).every((item) => Boolean(item) && typeof item === "object" && !Array.isArray(item)));
    const missingFields = [
      ...requiredStrings.filter((key) => typeof emotion[key] !== "string" || !(emotion[key] as string).trim()),
      ...requiredLists.filter((key) => !Array.isArray(emotion[key])),
      ...(!stringListsValid ? ["字符串数组内容"] : []),
      ...(!objectListsValid ? ["依据对象数组内容"] : []),
      ...(!Number.isFinite(Number(emotion.confidence)) ? ["confidence"] : []),
    ];
    if (!stringsComplete || !listsComplete || !stringListsValid || !objectListsValid || !Number.isFinite(Number(emotion.confidence))) {
      throw new Error(`客户情绪与沟通性格模块字段不完整（缺失或格式错误：${[...new Set(missingFields)].join("、")}）`);
    }
    if (messages.some((message) => message.role === "customer") && (emotion.currentStateEvidence as unknown[]).length === 0) {
      throw new Error("客户情绪与沟通性格模块缺少客户原文依据");
    }
    return;
  }
  if (module === "objections") {
    if (!Array.isArray(raw.objections)) throw new Error("异议模块缺少 objections 数组");
    return;
  }
  if (module === "checklist") {
    const decisionMap = raw.decisionMap as Record<string, unknown> | undefined;
    if (!decisionMap || !Array.isArray(decisionMap.buyingDrivers) || !Array.isArray(decisionMap.blockers)) throw new Error("成交决策地图字段不完整");
    return;
  }
  const improvements = Array.isArray(raw.improvements) ? raw.improvements.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
  const nextStrategy = raw.nextStrategy && typeof raw.nextStrategy === "object" && !Array.isArray(raw.nextStrategy) ? raw.nextStrategy as unknown as Record<string, unknown> : {};
  if (!improvements.length || typeof nextStrategy.strategySummary !== "string" || !nextStrategy.strategySummary.trim() || typeof nextStrategy.primaryGoal !== "string" || !nextStrategy.primaryGoal.trim() || !Array.isArray(nextStrategy.actions) || !nextStrategy.actions.length || typeof raw.suggestedReply !== "string" || !raw.suggestedReply.trim() || typeof raw.suggestedReplyTranslation !== "string" || !raw.suggestedReplyTranslation.trim() || !Array.isArray(raw.knowledgeReferenceIds)) {
    throw new Error("行动建议模块字段不完整");
  }
}

function requireNormalizedModuleResult(module: AnalysisModule, value: AnalysisModuleResult, messages: ParsedConversationMessage[]) {
  if (module === "customer") {
    const result = value as CustomerModuleResult;
    if (!result.summary.trim() || !result.profile.length || !Number.isFinite(result.confidence)) throw new Error("客户总结或画像未通过质量检查");
    return;
  }
  if (module === "psychology") {
    const result = value as PsychologyModuleResult;
    if (messages.some((message) => message.role === "customer") && !result.emotionProfile.currentStateEvidence.length) throw new Error("情绪与沟通性格原文依据未通过核验");
    return;
  }
  if (module === "objections") {
    const result = value as ObjectionsModuleResult;
    if (result.objections.some((item) => !item.title.trim() || !item.advice.trim() || !item.evidenceMessageId || !item.evidenceQuote)) throw new Error("异议模块包含无法核验的结果");
    return;
  }
  if (module === "checklist") {
    const result = value as ChecklistModuleResult;
    const invalidDriver = result.decisionMap.buyingDrivers.some((item) => !item.title || !item.desiredOutcome || !item.conversionReason || !item.evidenceMessageId || !item.evidenceQuote);
    const invalidBlocker = result.decisionMap.blockers.some((item) => !item.title || !item.concern || !item.dealImpact || !item.solutionDirection || !item.evidenceMessageId || !item.evidenceQuote);
    if (!result.decisionMap.priorityTask || invalidDriver || invalidBlocker) throw new Error("成交决策地图包含无法核验或不完整的结果");
  }
}

function normalizePsychologyResult(value: unknown, messages: ParsedConversationMessage[]): PsychologyModuleResult {
  const rawRoot = value && typeof value === "object" ? value as Partial<PsychologyModuleResult> : {};
  const raw = rawRoot.emotionProfile && typeof rawRoot.emotionProfile === "object" ? rawRoot.emotionProfile as unknown as Record<string, unknown> : {};
  const customerMessages = new Map(messages.filter((message) => message.role === "customer").map((message) => [message.id, message]));
  const cleanEvidence = (value: unknown, limit = 4) => (Array.isArray(value) ? value : []).flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const item = candidate as Record<string, unknown>;
    const messageId = typeof item.messageId === "string" ? item.messageId : "";
    const quote = typeof item.quote === "string" ? item.quote : "";
    const interpretation = typeof item.interpretation === "string" ? item.interpretation.trim() : "";
    if (!interpretation || !hasVerifiedEvidence(customerMessages, messageId, quote)) return [];
    return [{ messageId, quote, translation: typeof item.translation === "string" ? item.translation.trim() : "", interpretation }];
  }).slice(0, limit);
  const currentStateEvidence = cleanEvidence(raw.currentStateEvidence, 3);
  const emotionTurningPoints = (Array.isArray(raw.emotionTurningPoints) ? raw.emotionTurningPoints : []).flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const item = candidate as Record<string, unknown>;
    const evidence = cleanEvidence([item], 1)[0];
    if (!evidence) return [];
    const score = Number(item.score);
    return [{ ...evidence, label: typeof item.label === "string" ? item.label.trim() : "情绪变化", score: Number.isFinite(score) ? Math.min(2, Math.max(-2, score)) : 0, reason: typeof item.reason === "string" ? item.reason.trim() : evidence.interpretation }];
  }).slice(0, 8);
  const personalityTraits = (Array.isArray(raw.personalityTraits) ? raw.personalityTraits : []).flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const item = candidate as Record<string, unknown>;
    const evidence = cleanEvidence(item.evidence, 3);
    const trait = typeof item.trait === "string" ? item.trait.trim() : "";
    const explanation = typeof item.explanation === "string" ? item.explanation.trim() : "";
    return trait && explanation && evidence.length ? [{ trait, explanation, evidence }] : [];
  }).slice(0, 5);
  const decisionEvidence = cleanEvidence(raw.decisionEvidence, 4);
  const confidence = Number(raw.confidence);
  return { emotionProfile: {
    currentState: typeof raw.currentState === "string" && raw.currentState.trim() ? raw.currentState.trim() : "信息不足，暂无法判断当前情绪和心理状态",
    currentStateEvidence,
    emotionTurningPoints,
    personalityTraits,
    decisionStyle: typeof raw.decisionStyle === "string" && raw.decisionStyle.trim() ? raw.decisionStyle.trim() : "信息不足，暂无法判断决策方式",
    decisionFactors: cleanStringArray(raw.decisionFactors),
    decisionPace: typeof raw.decisionPace === "string" && raw.decisionPace.trim() ? raw.decisionPace.trim() : "信息不足",
    communicationApproach: typeof raw.communicationApproach === "string" && raw.communicationApproach.trim() ? raw.communicationApproach.trim() : "继续通过开放式问题确认客户的决策条件。",
    decisionEvidence,
    personalitySummary: typeof raw.personalitySummary === "string" && raw.personalitySummary.trim() ? raw.personalitySummary.trim() : personalityTraits.map((item) => item.trait).join("、") || "当前信息不足以概括沟通性格倾向。",
    confidence: currentStateEvidence.length && Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : Math.min(Number.isFinite(confidence) ? confidence : 0.2, 0.35),
  } };
}

function normalizeObjectionsResult(value: unknown, messages: ParsedConversationMessage[]): ObjectionsModuleResult {
  const raw = value && typeof value === "object" ? value as Partial<ObjectionsModuleResult> : {};
  return { objections: normalizeRiskResult({ objections: Array.isArray(raw.objections) ? raw.objections : [], confirmations: [] } as unknown as AnalysisModuleResult, messages).objections };
}

function normalizeLegacyChecklistResult(value: unknown, messages: ParsedConversationMessage[]): { confirmations: ConfirmationItem[] } {
  const raw = value && typeof value === "object" ? value as Partial<LegacyChecklistModelResult> : {};
  const rawItems = Array.isArray(raw.confirmations) ? raw.confirmations as unknown as ChecklistModelItem[] : [];
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const confirmations: ConfirmationItem[] = confirmationDefinitions.map((definition): ConfirmationItem => {
    const item = rawItems.find((candidate) => candidate?.id === definition.id);
    const evidenceMessage = item ? messageById.get(item.evidenceMessageId || "") : undefined;
    const coreEvidenceValid = Boolean(item && hasVerifiedEvidence(messageById, item.evidenceMessageId, item.evidenceQuote));
    const handlingMessage = item ? messageById.get(item.handlingEvidenceMessageId || "") : undefined;
    const handlingValid = Boolean(item && handlingMessage?.role === "sales" && hasVerifiedEvidence(messageById, item.handlingEvidenceMessageId, item.handlingEvidenceQuote));
    const reactionMessage = item ? messageById.get(item.reactionEvidenceMessageId || "") : undefined;
    const reactionValid = Boolean(item && reactionMessage?.role === "customer" && hasVerifiedEvidence(messageById, item.reactionEvidenceMessageId, item.reactionEvidenceQuote));
    const handlingIndex = item ? messages.findIndex((message) => message.id === item.handlingEvidenceMessageId) : -1;
    const reactionIndex = item ? messages.findIndex((message) => message.id === item.reactionEvidenceMessageId) : -1;
    const reactionAfterHandling = reactionValid && (handlingIndex < 0 || reactionIndex > handlingIndex);
    const source = item?.source === "客户主动询问" && coreEvidenceValid && evidenceMessage?.role === "customer" ? "客户主动询问"
      : item?.source === "销售主动提出" && coreEvidenceValid && evidenceMessage?.role === "sales" ? "销售主动提出" : "未提及";
    const status = item?.status === "risk" && !coreEvidenceValid ? "unknown" : item?.status === "confirmed" || item?.status === "risk" || item?.status === "na" ? item.status : "unknown";
    const confidence = Number(item?.confidence);
    const base: ConfirmationItem = {
      ...definition, status,
      evidence: item?.evidence?.trim() || "对话中尚未确认。",
      evidenceMessageId: coreEvidenceValid ? item?.evidenceMessageId || "" : "",
      evidenceQuote: coreEvidenceValid ? item?.evidenceQuote || "" : "",
      riskReason: status === "risk" ? item?.riskReason?.trim() || item?.evidence?.trim() || "对话中存在明确顾虑。" : "",
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.25,
    };
    const advice = item?.advice?.trim() || "结合当前对话确认该项信息后再推进。";
    if (definition.id === "seeding") {
      const need = item?.conclusion === "需要种草" && coreEvidenceValid && evidenceMessage?.role === "customer" ? "需要种草" : "无需种草";
      return { ...base, seedingNeed: need, seedingDirection: need === "需要种草" ? item?.detail?.trim() || "待确认客户关注的改善、期望或痛点。" : "", seedingPerformed: item?.handling === "已处理" && handlingValid ? "已种草" : item?.handling === "尚未处理" ? "尚未种草" : "未确认", seedingPerformedEvidenceMessageId: handlingValid ? item?.handlingEvidenceMessageId : "", seedingPerformedEvidenceQuote: handlingValid ? item?.handlingEvidenceQuote : "", seedingAccepted: item?.reaction === "客户明确肯定" && reactionAfterHandling ? "客户明确肯定" : reactionValid ? "客户未明确肯定" : "未确认", seedingAcceptanceEvidenceMessageId: reactionAfterHandling ? item?.reactionEvidenceMessageId : "", seedingAcceptanceEvidenceQuote: reactionAfterHandling ? item?.reactionEvidenceQuote : "", seedingAdvice: advice };
    }
    if (definition.id === "medical") {
      const need = item?.conclusion === "需要提供建议" && coreEvidenceValid && evidenceMessage?.role === "customer" ? "需要提供建议" : "无需提供建议";
      return { ...base, medicalNeed: need, medicalDirection: need === "需要提供建议" ? item?.detail?.trim() || "待确认具体需求方向。" : "", medicalAnswered: item?.handling === "已处理" && handlingValid ? "已解答" : item?.handling === "尚未处理" ? "尚未解答" : "未确认", medicalAnswerEvidenceMessageId: handlingValid ? item?.handlingEvidenceMessageId : "", medicalAnswerEvidenceQuote: handlingValid ? item?.handlingEvidenceQuote : "", medicalAccepted: item?.reaction === "客户明确肯定" && reactionAfterHandling ? "客户明确肯定" : reactionValid ? "客户未明确肯定" : "未确认", medicalAcceptanceEvidenceMessageId: reactionAfterHandling ? item?.reactionEvidenceMessageId : "", medicalAcceptanceEvidenceQuote: reactionAfterHandling ? item?.reactionEvidenceQuote : "", medicalAdvice: advice };
    }
    if (definition.id === "scammed") {
      const hasExperience = item?.conclusion === "有被骗经历" && coreEvidenceValid && evidenceMessage?.role === "customer";
      return { ...base, scamExperienceStatus: hasExperience ? "有被骗经历" : "无被骗经历", scamExperienceSummary: hasExperience ? item?.detail?.trim() || item?.evidence?.trim() || "客户提及过往不良经历。" : "", scamAddressed: item?.handling === "已处理" && handlingValid ? "已回应" : item?.handling === "尚未处理" ? "尚未回应" : "未确认", scamResponseEvidenceMessageId: handlingValid ? item?.handlingEvidenceMessageId : "", scamResponseEvidenceQuote: handlingValid ? item?.handlingEvidenceQuote : "", scamAccepted: item?.reaction === "客户明确肯定" && reactionAfterHandling ? "客户明确肯定" : reactionValid ? "客户未明确肯定" : "未确认", scamAcceptanceEvidenceMessageId: reactionAfterHandling ? item?.reactionEvidenceMessageId : "", scamAcceptanceEvidenceQuote: reactionAfterHandling ? item?.reactionEvidenceQuote : "", scamAdvice: advice };
    }
    const handled = item?.handling === "已处理" && handlingValid;
    const accepted = item?.reaction === "客户明确肯定" && reactionAfterHandling ? "客户明确肯定" : reactionValid ? "客户未明确肯定" : "未确认";
    if (definition.id === "coa") return { ...base, coaMentionSource: source, coaMentionEvidenceMessageId: coreEvidenceValid ? item?.evidenceMessageId : "", coaMentionEvidenceQuote: coreEvidenceValid ? item?.evidenceQuote : "", coaExplained: handled ? "已说明" : source === "未提及" ? "未确认" : "尚未说明", coaExplanationEvidenceMessageId: handlingValid ? item?.handlingEvidenceMessageId : "", coaExplanationEvidenceQuote: handlingValid ? item?.handlingEvidenceQuote : "", coaAccepted: accepted, coaAcceptanceEvidenceMessageId: reactionAfterHandling ? item?.reactionEvidenceMessageId : "", coaAcceptanceEvidenceQuote: reactionAfterHandling ? item?.reactionEvidenceQuote : "", coaAdvice: advice };
    if (definition.id === "packaging") return { ...base, packagingMentionSource: source, packagingMentionEvidenceMessageId: coreEvidenceValid ? item?.evidenceMessageId : "", packagingMentionEvidenceQuote: coreEvidenceValid ? item?.evidenceQuote : "", packagingExplained: handled ? "已说明" : source === "未提及" ? "未确认" : "尚未说明", packagingExplanationEvidenceMessageId: handlingValid ? item?.handlingEvidenceMessageId : "", packagingExplanationEvidenceQuote: handlingValid ? item?.handlingEvidenceQuote : "", packagingAccepted: accepted, packagingAcceptanceEvidenceMessageId: reactionAfterHandling ? item?.reactionEvidenceMessageId : "", packagingAcceptanceEvidenceQuote: reactionAfterHandling ? item?.reactionEvidenceQuote : "", packagingAdvice: advice };
    if (definition.id === "company") return { ...base, companyMentionSource: source, companyMentionEvidenceMessageId: coreEvidenceValid ? item?.evidenceMessageId : "", companyMentionEvidenceQuote: coreEvidenceValid ? item?.evidenceQuote : "", companyExplained: handled ? "已说明" : source === "未提及" ? "未确认" : "尚未说明", companyExplanationEvidenceMessageId: handlingValid ? item?.handlingEvidenceMessageId : "", companyExplanationEvidenceQuote: handlingValid ? item?.handlingEvidenceQuote : "", companyAccepted: accepted, companyAcceptanceEvidenceMessageId: reactionAfterHandling ? item?.reactionEvidenceMessageId : "", companyAcceptanceEvidenceQuote: reactionAfterHandling ? item?.reactionEvidenceQuote : "", companyAdvice: advice };
    if (definition.id === "feedback") return { ...base, feedbackMentionSource: source, feedbackMentionEvidenceMessageId: coreEvidenceValid ? item?.evidenceMessageId : "", feedbackMentionEvidenceQuote: coreEvidenceValid ? item?.evidenceQuote : "", feedbackAnswered: handled ? "已解答" : source === "未提及" ? "未确认" : "尚未解答", feedbackAnswerEvidenceMessageId: handlingValid ? item?.handlingEvidenceMessageId : "", feedbackAnswerEvidenceQuote: handlingValid ? item?.handlingEvidenceQuote : "", feedbackAccepted: accepted, feedbackAcceptanceEvidenceMessageId: reactionAfterHandling ? item?.reactionEvidenceMessageId : "", feedbackAcceptanceEvidenceQuote: reactionAfterHandling ? item?.reactionEvidenceQuote : "", feedbackAdvice: advice };
    if (definition.id === "logistics") return { ...base, logisticsMentionSource: source, logisticsMentionEvidenceMessageId: coreEvidenceValid ? item?.evidenceMessageId : "", logisticsMentionEvidenceQuote: coreEvidenceValid ? item?.evidenceQuote : "", logisticsAnswered: handled ? "已解答" : source === "未提及" ? "未确认" : "尚未解答", logisticsAnswerEvidenceMessageId: handlingValid ? item?.handlingEvidenceMessageId : "", logisticsAnswerEvidenceQuote: handlingValid ? item?.handlingEvidenceQuote : "", logisticsCustomerReaction: item?.reaction === "客户满意" && reactionAfterHandling ? "客户满意" : item?.reaction === "存在异议" && reactionValid ? "存在异议" : reactionValid ? "客户未明确表态" : "未确认", logisticsReactionEvidenceMessageId: reactionValid ? item?.reactionEvidenceMessageId : "", logisticsReactionEvidenceQuote: reactionValid ? item?.reactionEvidenceQuote : "", logisticsAdvice: advice };
    if (definition.id === "payment_method") return { ...base, paymentMentionSource: source, paymentMentionEvidenceMessageId: coreEvidenceValid ? item?.evidenceMessageId : "", paymentMentionEvidenceQuote: coreEvidenceValid ? item?.evidenceQuote : "", paymentCustomerReaction: item?.reaction === "客户明确肯定" && reactionAfterHandling ? "客户明确肯定" : item?.reaction === "存在异议" && reactionValid ? "存在异议" : reactionValid ? "客户未明确表态" : "未确认", paymentReactionEvidenceMessageId: reactionValid ? item?.reactionEvidenceMessageId : "", paymentReactionEvidenceQuote: reactionValid ? item?.reactionEvidenceQuote : "", paymentAdvice: advice };
    return base;
  });
  return { confirmations };
}

function normalizeChecklistResult(value: unknown, messages: ParsedConversationMessage[]): ChecklistModuleResult {
  const raw = value && typeof value === "object" ? value as Partial<ChecklistModelResult> : {};
  const source = raw.decisionMap && typeof raw.decisionMap === "object" ? raw.decisionMap as DealDecisionMap : undefined;
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const customerMessageById = new Map(messages.filter((message) => message.role === "customer").map((message) => [message.id, message]));
  const cleanText = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const evidenceIsValid = (items: Map<string, ParsedConversationMessage>, item: { evidenceMessageId?: unknown; evidenceQuote?: unknown }) => {
    const messageId = cleanText(item.evidenceMessageId);
    const quote = cleanText(item.evidenceQuote);
    return Boolean(messageId && quote && hasVerifiedEvidence(items, messageId, quote));
  };
  const buyingDrivers = (Array.isArray(source?.buyingDrivers) ? source.buyingDrivers : []).flatMap((candidate): BuyingDriver[] => {
    if (!candidate || typeof candidate !== "object" || !evidenceIsValid(customerMessageById, candidate)) return [];
    const item = candidate as Partial<BuyingDriver>;
    const title = cleanText(item.title), desiredOutcome = cleanText(item.desiredOutcome), painOrExpectation = cleanText(item.painOrExpectation), conversionReason = cleanText(item.conversionReason), evidenceTranslation = cleanText(item.evidenceTranslation);
    if (!title || !desiredOutcome || !painOrExpectation || !conversionReason || !evidenceTranslation) return [];
    return [{ title, desiredOutcome, painOrExpectation, strength: item.strength === "强" || item.strength === "弱" ? item.strength : "中", purchaseIntent: item.purchaseIntent === "明确" || item.purchaseIntent === "较高" ? item.purchaseIntent : "观察中", conversionReason, evidenceMessageId: cleanText(item.evidenceMessageId), evidenceQuote: cleanText(item.evidenceQuote), evidenceTranslation }];
  }).filter((item, index, items) => items.findIndex((other) => normalizeEvidenceText(other.title) === normalizeEvidenceText(item.title) || (other.evidenceMessageId === item.evidenceMessageId && normalizeEvidenceText(other.desiredOutcome) === normalizeEvidenceText(item.desiredOutcome))) === index).slice(0, 3);
  const blockerCategories: DealBlocker["category"][] = ["产品匹配", "产品知识", "价格与预算", "质量与COA", "公司与供应商信任", "包装与交付", "物流清关与时效", "支付与资金安全", "决策时机", "内部审批", "其他顾虑"];
  const blockers = (Array.isArray(source?.blockers) ? source.blockers : []).flatMap((candidate): DealBlocker[] => {
    if (!candidate || typeof candidate !== "object" || !evidenceIsValid(customerMessageById, candidate)) return [];
    const item = candidate as Partial<DealBlocker>;
    const title = cleanText(item.title), concern = cleanText(item.concern), dealImpact = cleanText(item.dealImpact), evidenceTranslation = cleanText(item.evidenceTranslation), solutionDirection = cleanText(item.solutionDirection);
    if (!title || !concern || !dealImpact || !evidenceTranslation || !solutionDirection) return [];
    const requestedStatus = item.handlingStatus === "已回答-客户未追问" || item.handlingStatus === "客户明确认可" ? item.handlingStatus : "未解决";
    const salesValid = evidenceIsValid(messageById, { evidenceMessageId: item.salesEvidenceMessageId, evidenceQuote: item.salesEvidenceQuote }) && messageById.get(cleanText(item.salesEvidenceMessageId))?.role === "sales";
    const resolutionValid = evidenceIsValid(customerMessageById, { evidenceMessageId: item.resolutionEvidenceMessageId, evidenceQuote: item.resolutionEvidenceQuote });
    const issueIndex = messages.findIndex((message) => message.id === cleanText(item.evidenceMessageId));
    const salesIndex = messages.findIndex((message) => message.id === cleanText(item.salesEvidenceMessageId));
    const resolutionIndex = messages.findIndex((message) => message.id === cleanText(item.resolutionEvidenceMessageId));
    const statusValid = requestedStatus === "未解决" || (requestedStatus === "已回答-客户未追问" && salesValid && salesIndex > issueIndex) || (requestedStatus === "客户明确认可" && salesValid && resolutionValid && salesIndex > issueIndex && resolutionIndex > salesIndex);
    const handlingStatus: DealBlocker["handlingStatus"] = statusValid ? requestedStatus : "未解决";
    return [{ title, category: blockerCategories.includes(item.category as DealBlocker["category"]) ? item.category as DealBlocker["category"] : "其他顾虑", concern, dealImpact, evidenceMessageId: cleanText(item.evidenceMessageId), evidenceQuote: cleanText(item.evidenceQuote), evidenceTranslation, handlingStatus, salesEvidenceMessageId: handlingStatus === "未解决" ? "" : cleanText(item.salesEvidenceMessageId), salesEvidenceQuote: handlingStatus === "未解决" ? "" : cleanText(item.salesEvidenceQuote), salesEvidenceTranslation: handlingStatus === "未解决" ? "" : cleanText(item.salesEvidenceTranslation), resolutionEvidenceMessageId: handlingStatus === "客户明确认可" ? cleanText(item.resolutionEvidenceMessageId) : "", resolutionEvidenceQuote: handlingStatus === "客户明确认可" ? cleanText(item.resolutionEvidenceQuote) : "", resolutionEvidenceTranslation: handlingStatus === "客户明确认可" ? cleanText(item.resolutionEvidenceTranslation) : "", solutionDirection }];
  }).filter((item, index, items) => items.findIndex((other) => normalizeEvidenceText(other.title) === normalizeEvidenceText(item.title) || (other.evidenceMessageId === item.evidenceMessageId && other.category === item.category)) === index).slice(0, 8);
  const motivationLevel: DealDecisionMap["motivationLevel"] = buyingDrivers.length ? source?.motivationLevel === "强" || source?.motivationLevel === "弱" ? source.motivationLevel : "中" : "弱";
  const readiness: DealDecisionMap["readiness"] = buyingDrivers.length ? source?.readiness === "高" || source?.readiness === "低" ? source.readiness : "中" : "低";
  const requestedBiggestBlocker = cleanText(source?.biggestBlocker);
  const verifiedBiggestBlocker = blockers.find((item) => normalizeEvidenceText(item.title) === normalizeEvidenceText(requestedBiggestBlocker))?.title;
  return { decisionMap: { motivationLevel, biggestBlocker: verifiedBiggestBlocker || blockers[0]?.title || "当前未识别到明确成交阻力", readiness, priorityTask: cleanText(source?.priorityTask) || "继续确认客户当前最重要的决策条件。", buyingDrivers, blockers } };
}

function validateLegacyModuleResult(module: "customer" | "risk" | "action", value: AnalysisModuleResult, messages: ParsedConversationMessage[] = []) {
  if (!value || typeof value !== "object") throw new Error(`${module} 模块返回空结果`);
  if (module === "customer") {
    const result = value as CustomerModuleResult & PsychologyModuleResult;
    if (!result.summary?.trim() || !result.profile.length || !Number.isFinite(result.confidence)) throw new Error("客户画像模块字段不完整");
    if (!Array.isArray(result.profile) || result.profile.length !== profileDimensions.length) throw new Error("客户画像必须完整覆盖 10 个维度");
    if (result.profile.some((item, index) => !new RegExp(`^${profileDimensions[index]}[：:]`).test(item?.trim()))) throw new Error("客户画像维度缺失或顺序不正确");
    const emotion = result.emotionProfile;
    if (!emotion?.currentState?.trim() || !emotion.decisionStyle?.trim() || !emotion.decisionPace?.trim() || !emotion.communicationApproach?.trim() || !Number.isFinite(emotion.confidence)) throw new Error("客户情绪、沟通性格与心理研判字段不完整");
    if (!emotion.personalitySummary?.trim() || !Array.isArray(emotion.personalityTraits) || !Array.isArray(emotion.emotionTurningPoints) || !Array.isArray(emotion.decisionFactors) || !Array.isArray(emotion.currentStateEvidence) || !Array.isArray(emotion.decisionEvidence)) throw new Error("客户情绪与沟通性格分析缺少必要字段");
    const customerMessageById = new Map(messages.filter((message) => message.role === "customer").map((message) => [message.id, message]));
    const allEvidence = [...emotion.currentStateEvidence, ...emotion.emotionTurningPoints, ...emotion.personalityTraits.flatMap((item) => item.evidence), ...emotion.decisionEvidence];
    if (customerMessageById.size && !allEvidence.length) throw new Error("客户情绪与沟通性格分析缺少客户原文依据");
    if (allEvidence.some((item) => !item.interpretation?.trim() || !hasVerifiedEvidence(customerMessageById, item.messageId, item.quote))) throw new Error("客户情绪与沟通性格分析包含无法核验的客户原文");
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
    const coa = result.confirmations.find((item) => item.id === "coa");
    if (!coa || !coa.coaAdvice?.trim() || (coa.coaMentionSource !== "客户主动询问" && coa.coaMentionSource !== "销售主动提出" && coa.coaMentionSource !== "未提及")) throw new Error("COA 分析缺少来源判断或建议");
    if (!coa.coaExplained || !coa.coaAccepted) throw new Error("COA 分析缺少说明或客户肯定判断");
    const coaMentionMessage = messageById.get(coa.coaMentionEvidenceMessageId || "");
    if (coa.coaMentionSource !== "未提及" && (coaMentionMessage?.role !== (coa.coaMentionSource === "客户主动询问" ? "customer" : "sales") || !hasVerifiedEvidence(messageById, coa.coaMentionEvidenceMessageId, coa.coaMentionEvidenceQuote))) throw new Error("COA 提及来源缺少对应角色的原文");
    const coaExplanationMessage = messageById.get(coa.coaExplanationEvidenceMessageId || "");
    if (coa.coaExplained === "已说明" && (coaExplanationMessage?.role !== "sales" || !hasVerifiedEvidence(messageById, coa.coaExplanationEvidenceMessageId, coa.coaExplanationEvidenceQuote))) throw new Error("COA 已说明结论缺少销售原文");
    const coaMentionIndex = messages.findIndex((message) => message.id === coa.coaMentionEvidenceMessageId);
    const coaExplanationIndex = messages.findIndex((message) => message.id === coa.coaExplanationEvidenceMessageId);
    if (coa.coaMentionSource === "客户主动询问" && coa.coaExplained === "已说明" && coaExplanationIndex <= coaMentionIndex) throw new Error("COA 说明必须发生在客户询问之后");
    if (coa.coaMentionSource === "未提及" && (coa.coaExplained === "已说明" || coa.coaAccepted === "客户明确肯定")) throw new Error("未提及 COA 时不能判断为已说明或客户明确肯定");
    const coaAcceptanceMessage = messageById.get(coa.coaAcceptanceEvidenceMessageId || "");
    const coaAcceptanceIndex = messages.findIndex((message) => message.id === coa.coaAcceptanceEvidenceMessageId);
    if (coa.coaAccepted === "客户明确肯定" && (coaAcceptanceMessage?.role !== "customer" || coaExplanationIndex < 0 || coaAcceptanceIndex <= coaExplanationIndex || !hasVerifiedEvidence(messageById, coa.coaAcceptanceEvidenceMessageId, coa.coaAcceptanceEvidenceQuote))) throw new Error("COA 客户肯定缺少说明之后的客户原文");
    const packaging = result.confirmations.find((item) => item.id === "packaging");
    if (!packaging || !packaging.packagingAdvice?.trim() || (packaging.packagingMentionSource !== "客户主动询问" && packaging.packagingMentionSource !== "销售主动提出" && packaging.packagingMentionSource !== "未提及")) throw new Error("产品包装分析缺少来源判断或建议");
    if (!packaging.packagingExplained || !packaging.packagingAccepted) throw new Error("产品包装分析缺少说明或客户肯定判断");
    const packagingMentionMessage = messageById.get(packaging.packagingMentionEvidenceMessageId || "");
    if (packaging.packagingMentionSource !== "未提及" && (packagingMentionMessage?.role !== (packaging.packagingMentionSource === "客户主动询问" ? "customer" : "sales") || !hasVerifiedEvidence(messageById, packaging.packagingMentionEvidenceMessageId, packaging.packagingMentionEvidenceQuote))) throw new Error("产品包装提及来源缺少对应角色的原文");
    const packagingExplanationMessage = messageById.get(packaging.packagingExplanationEvidenceMessageId || "");
    if (packaging.packagingExplained === "已说明" && (packagingExplanationMessage?.role !== "sales" || !hasVerifiedEvidence(messageById, packaging.packagingExplanationEvidenceMessageId, packaging.packagingExplanationEvidenceQuote))) throw new Error("产品包装已说明结论缺少销售原文");
    const packagingMentionIndex = messages.findIndex((message) => message.id === packaging.packagingMentionEvidenceMessageId);
    const packagingExplanationIndex = messages.findIndex((message) => message.id === packaging.packagingExplanationEvidenceMessageId);
    if (packaging.packagingMentionSource === "客户主动询问" && packaging.packagingExplained === "已说明" && packagingExplanationIndex <= packagingMentionIndex) throw new Error("产品包装说明必须发生在客户询问之后");
    if (packaging.packagingMentionSource === "未提及" && (packaging.packagingExplained === "已说明" || packaging.packagingAccepted === "客户明确肯定")) throw new Error("未提及产品包装时不能判断为已说明或客户明确肯定");
    const packagingAcceptanceMessage = messageById.get(packaging.packagingAcceptanceEvidenceMessageId || "");
    const packagingAcceptanceIndex = messages.findIndex((message) => message.id === packaging.packagingAcceptanceEvidenceMessageId);
    if (packaging.packagingAccepted === "客户明确肯定" && (packagingAcceptanceMessage?.role !== "customer" || packagingExplanationIndex < 0 || packagingAcceptanceIndex <= packagingExplanationIndex || !hasVerifiedEvidence(messageById, packaging.packagingAcceptanceEvidenceMessageId, packaging.packagingAcceptanceEvidenceQuote))) throw new Error("产品包装客户肯定缺少说明之后的客户原文");
    const company = result.confirmations.find((item) => item.id === "company");
    if (!company || !company.companyAdvice?.trim() || (company.companyMentionSource !== "客户主动询问" && company.companyMentionSource !== "销售主动提出" && company.companyMentionSource !== "未提及")) throw new Error("公司资料分析缺少来源判断或建议");
    if (!company.companyExplained || !company.companyAccepted) throw new Error("公司资料分析缺少说明或客户肯定判断");
    const companyMentionMessage = messageById.get(company.companyMentionEvidenceMessageId || "");
    if (company.companyMentionSource !== "未提及" && (companyMentionMessage?.role !== (company.companyMentionSource === "客户主动询问" ? "customer" : "sales") || !hasVerifiedEvidence(messageById, company.companyMentionEvidenceMessageId, company.companyMentionEvidenceQuote))) throw new Error("公司资料提及来源缺少对应角色的原文");
    const companyExplanationMessage = messageById.get(company.companyExplanationEvidenceMessageId || "");
    if (company.companyExplained === "已说明" && (companyExplanationMessage?.role !== "sales" || !hasVerifiedEvidence(messageById, company.companyExplanationEvidenceMessageId, company.companyExplanationEvidenceQuote))) throw new Error("公司资料已说明结论缺少销售原文");
    const companyMentionIndex = messages.findIndex((message) => message.id === company.companyMentionEvidenceMessageId);
    const companyExplanationIndex = messages.findIndex((message) => message.id === company.companyExplanationEvidenceMessageId);
    if (company.companyMentionSource === "客户主动询问" && company.companyExplained === "已说明" && companyExplanationIndex <= companyMentionIndex) throw new Error("公司资料说明必须发生在客户询问之后");
    if (company.companyMentionSource === "未提及" && (company.companyExplained === "已说明" || company.companyAccepted === "客户明确肯定")) throw new Error("未提及公司资料时不能判断为已说明或客户明确肯定");
    const companyAcceptanceMessage = messageById.get(company.companyAcceptanceEvidenceMessageId || "");
    const companyAcceptanceIndex = messages.findIndex((message) => message.id === company.companyAcceptanceEvidenceMessageId);
    if (company.companyAccepted === "客户明确肯定" && (companyAcceptanceMessage?.role !== "customer" || companyExplanationIndex < 0 || companyAcceptanceIndex <= companyExplanationIndex || !hasVerifiedEvidence(messageById, company.companyAcceptanceEvidenceMessageId, company.companyAcceptanceEvidenceQuote))) throw new Error("公司资料客户肯定缺少说明之后的客户原文");
    const feedback = result.confirmations.find((item) => item.id === "feedback");
    if (!feedback || !feedback.feedbackAdvice?.trim() || (feedback.feedbackMentionSource !== "客户主动询问" && feedback.feedbackMentionSource !== "销售主动提出" && feedback.feedbackMentionSource !== "未提及")) throw new Error("其他客户反馈分析缺少来源判断或建议");
    if (!feedback.feedbackAnswered || !feedback.feedbackAccepted) throw new Error("其他客户反馈分析缺少解答或客户肯定判断");
    const feedbackMentionMessage = messageById.get(feedback.feedbackMentionEvidenceMessageId || "");
    if (feedback.feedbackMentionSource !== "未提及" && (feedbackMentionMessage?.role !== (feedback.feedbackMentionSource === "客户主动询问" ? "customer" : "sales") || !hasVerifiedEvidence(messageById, feedback.feedbackMentionEvidenceMessageId, feedback.feedbackMentionEvidenceQuote))) throw new Error("其他客户反馈提及来源缺少对应角色的原文");
    const feedbackAnswerMessage = messageById.get(feedback.feedbackAnswerEvidenceMessageId || "");
    if (feedback.feedbackAnswered === "已解答" && (feedbackAnswerMessage?.role !== "sales" || !hasVerifiedEvidence(messageById, feedback.feedbackAnswerEvidenceMessageId, feedback.feedbackAnswerEvidenceQuote))) throw new Error("其他客户反馈已解答结论缺少销售原文");
    const feedbackMentionIndex = messages.findIndex((message) => message.id === feedback.feedbackMentionEvidenceMessageId);
    const feedbackAnswerIndex = messages.findIndex((message) => message.id === feedback.feedbackAnswerEvidenceMessageId);
    if (feedback.feedbackMentionSource === "客户主动询问" && feedback.feedbackAnswered === "已解答" && feedbackAnswerIndex <= feedbackMentionIndex) throw new Error("其他客户反馈解答必须发生在客户询问之后");
    if (feedback.feedbackMentionSource === "未提及" && (feedback.feedbackAnswered === "已解答" || feedback.feedbackAccepted === "客户明确肯定")) throw new Error("未提及其他客户反馈时不能判断为已解答或客户明确肯定");
    const feedbackAcceptanceMessage = messageById.get(feedback.feedbackAcceptanceEvidenceMessageId || "");
    const feedbackAcceptanceIndex = messages.findIndex((message) => message.id === feedback.feedbackAcceptanceEvidenceMessageId);
    if (feedback.feedbackAccepted === "客户明确肯定" && (feedbackAcceptanceMessage?.role !== "customer" || feedbackAnswerIndex < 0 || feedbackAcceptanceIndex <= feedbackAnswerIndex || !hasVerifiedEvidence(messageById, feedback.feedbackAcceptanceEvidenceMessageId, feedback.feedbackAcceptanceEvidenceQuote))) throw new Error("其他客户反馈的客户肯定缺少解答之后的客户原文");
    const logistics = result.confirmations.find((item) => item.id === "logistics");
    if (!logistics || !logistics.logisticsAdvice?.trim() || (logistics.logisticsMentionSource !== "客户主动询问" && logistics.logisticsMentionSource !== "销售主动提出" && logistics.logisticsMentionSource !== "未提及")) throw new Error("物流清关分析缺少来源判断或建议");
    if (!logistics.logisticsAnswered || !logistics.logisticsCustomerReaction) throw new Error("物流清关分析缺少解答或客户反应判断");
    const logisticsMentionMessage = messageById.get(logistics.logisticsMentionEvidenceMessageId || "");
    if (logistics.logisticsMentionSource !== "未提及" && (logisticsMentionMessage?.role !== (logistics.logisticsMentionSource === "客户主动询问" ? "customer" : "sales") || !hasVerifiedEvidence(messageById, logistics.logisticsMentionEvidenceMessageId, logistics.logisticsMentionEvidenceQuote))) throw new Error("物流清关提及来源缺少对应角色的原文");
    const logisticsAnswerMessage = messageById.get(logistics.logisticsAnswerEvidenceMessageId || "");
    if (logistics.logisticsAnswered === "已解答" && (logisticsAnswerMessage?.role !== "sales" || !hasVerifiedEvidence(messageById, logistics.logisticsAnswerEvidenceMessageId, logistics.logisticsAnswerEvidenceQuote))) throw new Error("物流清关已解答结论缺少销售原文");
    const logisticsMentionIndex = messages.findIndex((message) => message.id === logistics.logisticsMentionEvidenceMessageId);
    const logisticsAnswerIndex = messages.findIndex((message) => message.id === logistics.logisticsAnswerEvidenceMessageId);
    if (logistics.logisticsMentionSource === "客户主动询问" && logistics.logisticsAnswered === "已解答" && logisticsAnswerIndex <= logisticsMentionIndex) throw new Error("物流清关解答必须发生在客户询问之后");
    if (logistics.logisticsMentionSource === "未提及" && (logistics.logisticsAnswered === "已解答" || logistics.logisticsCustomerReaction === "客户满意" || logistics.logisticsCustomerReaction === "存在异议")) throw new Error("未提及物流清关时不能判断为已解答、满意或存在异议");
    const logisticsReactionMessage = messageById.get(logistics.logisticsReactionEvidenceMessageId || "");
    const logisticsReactionIndex = messages.findIndex((message) => message.id === logistics.logisticsReactionEvidenceMessageId);
    if ((logistics.logisticsCustomerReaction === "客户满意" || logistics.logisticsCustomerReaction === "存在异议") && (logisticsReactionMessage?.role !== "customer" || !hasVerifiedEvidence(messageById, logistics.logisticsReactionEvidenceMessageId, logistics.logisticsReactionEvidenceQuote))) throw new Error("物流清关客户反应缺少客户原文");
    if (logistics.logisticsCustomerReaction === "客户满意" && (logisticsAnswerIndex < 0 || logisticsReactionIndex <= logisticsAnswerIndex)) throw new Error("物流清关客户满意必须有解答之后的客户原文");
    const payment = result.confirmations.find((item) => item.id === "payment_method");
    if (!payment || !payment.paymentAdvice?.trim() || (payment.paymentMentionSource !== "客户主动询问" && payment.paymentMentionSource !== "销售主动提出" && payment.paymentMentionSource !== "未提及")) throw new Error("支付安全分析缺少来源判断或建议");
    if (!payment.paymentCustomerReaction) throw new Error("支付安全分析缺少客户反应判断");
    const paymentMentionMessage = messageById.get(payment.paymentMentionEvidenceMessageId || "");
    if (payment.paymentMentionSource !== "未提及" && (paymentMentionMessage?.role !== (payment.paymentMentionSource === "客户主动询问" ? "customer" : "sales") || !hasVerifiedEvidence(messageById, payment.paymentMentionEvidenceMessageId, payment.paymentMentionEvidenceQuote))) throw new Error("支付安全提及来源缺少对应角色的原文");
    if (payment.paymentMentionSource === "未提及" && (payment.paymentCustomerReaction === "客户明确肯定" || payment.paymentCustomerReaction === "存在异议")) throw new Error("未提及支付安全时不能判断为客户肯定或存在异议");
    const paymentMentionIndex = messages.findIndex((message) => message.id === payment.paymentMentionEvidenceMessageId);
    const paymentReactionMessage = messageById.get(payment.paymentReactionEvidenceMessageId || "");
    const paymentReactionIndex = messages.findIndex((message) => message.id === payment.paymentReactionEvidenceMessageId);
    if ((payment.paymentCustomerReaction === "客户明确肯定" || payment.paymentCustomerReaction === "存在异议") && (paymentReactionMessage?.role !== "customer" || !hasVerifiedEvidence(messageById, payment.paymentReactionEvidenceMessageId, payment.paymentReactionEvidenceQuote))) throw new Error("支付安全客户反应缺少客户原文");
    if (payment.paymentCustomerReaction === "客户明确肯定" && paymentReactionIndex <= paymentMentionIndex) throw new Error("支付安全客户肯定必须发生在支付信息提出之后");
    if (payment.paymentMentionSource === "销售主动提出" && payment.paymentCustomerReaction === "存在异议" && paymentReactionIndex <= paymentMentionIndex) throw new Error("销售主动提出支付信息时，客户异议必须发生在其后");
  }
  return value;
}

function normalizeModuleResult(module: AnalysisModule, value: unknown, messages: ParsedConversationMessage[]): AnalysisModuleResult {
  if (module === "customer") return normalizeCustomerResult(value, messages);
  if (module === "psychology") return normalizePsychologyResult(value, messages);
  if (module === "objections") return normalizeObjectionsResult(value, messages);
  if (module === "checklist") return normalizeChecklistResult(value, messages);
  const raw = value && typeof value === "object" ? value as Partial<ActionModuleResult> : {};
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const priorityRank = { "高": 0, "中": 1, "低": 2 } as const;
  const improvements: CommunicationImprovement[] = (Array.isArray(raw.improvements) ? raw.improvements : []).flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const item = candidate as unknown as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const issue = typeof item.issue === "string" ? item.issue.trim() : "";
    const recommendation = typeof item.recommendation === "string" ? item.recommendation.trim() : "";
    if (!title || !issue || !recommendation) return [];
    const customerEvidenceMessageId = typeof item.customerEvidenceMessageId === "string" ? item.customerEvidenceMessageId : "";
    const customerEvidenceQuote = typeof item.customerEvidenceQuote === "string" ? item.customerEvidenceQuote : "";
    const salesEvidenceMessageId = typeof item.salesEvidenceMessageId === "string" ? item.salesEvidenceMessageId : "";
    const salesEvidenceQuote = typeof item.salesEvidenceQuote === "string" ? item.salesEvidenceQuote : "";
    if (customerEvidenceMessageId && (messageById.get(customerEvidenceMessageId)?.role !== "customer" || !hasVerifiedEvidence(messageById, customerEvidenceMessageId, customerEvidenceQuote))) return [];
    if (salesEvidenceMessageId && (messageById.get(salesEvidenceMessageId)?.role !== "sales" || !hasVerifiedEvidence(messageById, salesEvidenceMessageId, salesEvidenceQuote))) return [];
    const priority: CommunicationImprovement["priority"] = item.priority === "高" || item.priority === "低" ? item.priority : "中";
    return [{ title, priority, issue, customerEvidenceMessageId, customerEvidenceQuote, customerEvidenceTranslation: typeof item.customerEvidenceTranslation === "string" ? item.customerEvidenceTranslation.trim() : "", handling: typeof item.handling === "string" && item.handling.trim() ? item.handling.trim() : "销售尚未处理", salesEvidenceMessageId, salesEvidenceQuote, salesEvidenceTranslation: typeof item.salesEvidenceTranslation === "string" ? item.salesEvidenceTranslation.trim() : "", recommendation }];
  }).filter((item, index, all) => all.findIndex((other) => other.title === item.title) === index).sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]).slice(0, 6);
  return {
    improvements,
    nextStrategy: (() => {
      const strategy = raw.nextStrategy && typeof raw.nextStrategy === "object" && !Array.isArray(raw.nextStrategy) ? raw.nextStrategy as unknown as Record<string, unknown> : {};
      const customerMessages = new Map(messages.filter((message) => message.role === "customer").map((message) => [message.id, message]));
      const evidence = (Array.isArray(strategy.evidence) ? strategy.evidence : []).flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
        const item = candidate as Record<string, unknown>;
        const messageId = typeof item.messageId === "string" ? item.messageId : "";
        const quote = typeof item.quote === "string" ? item.quote : "";
        if (!hasVerifiedEvidence(customerMessages, messageId, quote)) return [];
        return [{ messageId, quote, translation: typeof item.translation === "string" ? item.translation.trim() : "", interpretation: typeof item.interpretation === "string" ? item.interpretation.trim() : "支持当前推进策略的客户原文。" }];
      }).slice(0, 5);
      return { strategySummary: typeof strategy.strategySummary === "string" ? strategy.strategySummary.trim() : "围绕客户当前最大的成交阻力推进一个明确下一步。", primaryGoal: typeof strategy.primaryGoal === "string" ? strategy.primaryGoal.trim() : "解决当前最关键的成交阻力", reasoning: typeof strategy.reasoning === "string" ? strategy.reasoning.trim() : "结合客户的表达方式与当前成交进度，优先降低决策不确定性。", actions: cleanStringArray(strategy.actions, ["先直接处理客户当前最关心的问题。"]), communicationMethod: typeof strategy.communicationMethod === "string" ? strategy.communicationMethod.trim() : "表达直接、信息清晰，每次只推进一个目标。", avoidActions: cleanStringArray(strategy.avoidActions, []), evidence };
    })(),
    suggestedReply: raw.suggestedReply?.trim() || "Could you tell me which point you would like to confirm first?",
    suggestedReplyTranslation: raw.suggestedReplyTranslation?.trim() || "您可以告诉我，您想先确认哪一点吗？",
    knowledgeReferenceIds: cleanStringArray(raw.knowledgeReferenceIds),
  };
}

async function requestDeepSeekPsychologyParts(config: RuntimeProviderConfig, input: string, merge = false): Promise<PsychologyModuleResult> {
  const shared = `${commonPrompt}\n${merge ? "下面是已有分段结果，请重新综合，保留可核验的消息编号和逐字原文。" : "下面是完整编号对话。"}\n每条 evidence 必须引用真实客户消息的 M 编号和逐字原文 quote，并提供忠实中文 translation；禁止引用销售消息、改写原文或拼接多条消息。只输出符合所给 Schema 的 JSON 对象。`;
  const requestPart = <T>(schema: Record<string, unknown>, example: Record<string, unknown>, instruction: string, maxTokens: number) => requestDeepSeekJson<T>(config, [{
    role: "system",
    content: `${shared}\n${instruction}\nJSON Schema:\n${JSON.stringify(schema)}\n合法 JSON 示例：\n${JSON.stringify(example)}\n示例仅展示结构，不是当前客户事实。`,
  }, { role: "user", content: input }], maxTokens);

  const [state, traits, decision] = await Promise.all([
    requestPart<Pick<CustomerEmotionProfile, "currentState" | "currentStateEvidence" | "emotionTurningPoints">>(psychologyStateSchema, {
      currentState: "合并描述当前情绪和可观察心理状态",
      currentStateEvidence: [{ messageId: "M00001", quote: "客户逐字原文", translation: "忠实中文翻译", interpretation: "如何支持当前状态" }],
      emotionTurningPoints: [{ messageId: "M00001", quote: "客户逐字原文", translation: "忠实中文翻译", interpretation: "该处情绪含义", label: "谨慎", score: -1, reason: "为什么构成转折" }],
    }, "分析当前情绪和心理状态，并按聊天先后提取 0-8 个真正的情绪转折。score 限定 -2 到 2。没有明显转折时返回空数组，不得为了画图虚构转折。", 2600),
    requestPart<Pick<CustomerEmotionProfile, "personalitySummary" | "personalityTraits">>(psychologyTraitsSchema, {
      personalitySummary: "客户表达直接、重视证据，倾向核实关键信息后再决定。",
      personalityTraits: [{ trait: "证据导向", explanation: "带有限定语的沟通性格倾向", evidence: [{ messageId: "M00001", quote: "客户逐字原文", translation: "忠实中文翻译", interpretation: "如何支持该倾向" }] }],
    }, "只分析沟通性格倾向。personalitySummary 用一句话综合概括；每项分别给出 trait、explanation 和自己的原文 evidence；不输出敏感点、防御模式、疾病或人格障碍诊断。", 2200),
    requestPart<Pick<CustomerEmotionProfile, "decisionStyle" | "decisionFactors" | "decisionPace" | "communicationApproach" | "decisionEvidence" | "confidence">>(psychologyDecisionSchema, {
      decisionStyle: "概括决策方式", decisionFactors: ["主要考虑因素"], decisionPace: "决策节奏", communicationApproach: "建议沟通方式",
      decisionEvidence: [{ messageId: "M00001", quote: "客户逐字原文", translation: "忠实中文翻译", interpretation: "如何支持决策判断" }], confidence: 0.8,
    }, "分析客户如何决策、主要考虑因素、节奏和适合的沟通方式。", 2200),
  ]);

  return { emotionProfile: { ...state, ...traits, ...decision } };
}

async function requestModuleOnce(config: RuntimeProviderConfig, provider: Provider, module: AnalysisModule, input: string, merge = false, knowledgeContext = ""): Promise<AnalysisModuleResult> {
  const instruction = `${analysisPrompts[module]}${module === "action" ? knowledgeContext : ""}${merge ? "\n下面是分段分析结果，请去重并合并为一个最终结果。消息编号与原文必须原样保留。" : ""}`;
  if (provider === "openai") {
    return requestOpenAIJson<AnalysisModuleResult>(config, moduleSchema(module), `customer_${module}_analysis`, instruction, input);
  }
  if (module === "psychology") return requestDeepSeekPsychologyParts(config, input, merge);
  const tokens = module === "checklist" ? 4200 : module === "customer" ? 2200 : module === "objections" ? 2800 : 2400;
  const schema = JSON.stringify(moduleSchema(module));
  const example = JSON.stringify(deepSeekJsonExample(module));
  return requestDeepSeekJson<AnalysisModuleResult>(config, [{
    role: "system",
    content: `${instruction}\n必须严格按照下面的 JSON Schema 返回根对象，字段名、嵌套层级和枚举值不可改名或遗漏；没有内容的数组返回 []，没有证据的字符串返回空字符串。只输出一个可由 JSON.parse 解析的 JSON 对象，不输出 Markdown。\nJSON Schema:\n${schema}\n合法 JSON 格式示例：\n${example}\n示例中的文字和 M00001 仅用于展示结构，绝不是当前客户的事实或证据，必须根据本次真实聊天替换；无法在原文中核验的内容不得照抄。`,
  }, { role: "user", content: input }], tokens);
}

export async function analyzeModuleWithProvider(provider: Provider, conversation: string, module: AnalysisModule, analysisContext?: unknown): Promise<AnalysisModuleResult | null> {
  const config = await getRuntimeProviderConfig(provider);
  if (!config) return null;
  const chunks = buildNumberedConversationChunks(conversation);
  const messages = parseConversationMessages(conversation);
  const knowledgeScripts: KnowledgeScript[] = module === "action" ? await retrieveRelevantScripts(conversation) : [];
  const knowledgeContext = module === "action" ? formatScriptKnowledgeContext(knowledgeScripts) : "";
  const attachKnowledge = async (value: AnalysisModuleResult) => {
    if (module !== "action") return value;
    const action = value as ActionModuleResult;
    const allowedIds = new Set(knowledgeScripts.map((script) => script.id));
    const ids = action.knowledgeReferenceIds.filter((id, index, items) => allowedIds.has(id) && items.indexOf(id) === index);
    await recordScriptUsage(ids);
    return { ...action, knowledgeReferenceIds: ids, knowledgeReferences: toScriptReferences(knowledgeScripts, ids) } as AnalysisModuleResult;
  };
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const chunkResults: AnalysisModuleResult[] = [];
      const previousError = lastError instanceof Error ? lastError.message : "字段或原文核验未通过";
      const retryPrefix = attempt ? `上一次结果失败，具体原因：${previousError}。请依据 JSON Schema 修正并补全所有必填字段；无法找到直接原文的异议必须删除，不得用占位内容代替。\n\n` : "";
      for (const chunk of chunks) {
        const upstreamContext = module === "action" && analysisContext ? `\n\n上游分析结果（只用于综合策略，不得覆盖原始聊天事实）：\n${JSON.stringify(analysisContext)}` : "";
        const rawResult = await requestModuleOnce(config, provider, module, `${retryPrefix}${chunk}${upstreamContext}`, false, knowledgeContext);
        requireRawModuleResult(module, rawResult, messages);
        const normalizedChunk = normalizeModuleResult(module, rawResult, messages);
        requireNormalizedModuleResult(module, normalizedChunk, messages);
        chunkResults.push(normalizedChunk);
      }
      if (chunkResults.length === 1) return attachKnowledge(chunkResults[0]);
      const mergedRaw = await requestModuleOnce(config, provider, module, JSON.stringify(chunkResults), true, knowledgeContext);
      requireRawModuleResult(module, mergedRaw, messages);
      const result = normalizeModuleResult(module, mergedRaw, messages);
      requireNormalizedModuleResult(module, result, messages);
      return attachKnowledge(result);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${module} 模块分析失败`);
}

export async function analyzeWithProvider(provider: Provider, conversation: string): Promise<AnalysisReport | null> {
  const results = await Promise.all([
    analyzeModuleWithProvider(provider, conversation, "customer"),
    analyzeModuleWithProvider(provider, conversation, "psychology"),
    analyzeModuleWithProvider(provider, conversation, "checklist"),
  ]);
  if (results.some((result) => !result)) return null;
  const customer = results[0] as CustomerModuleResult;
  const psychology = results[1] as PsychologyModuleResult;
  const checklist = results[2] as ChecklistModuleResult;
  const action = await analyzeModuleWithProvider(provider, conversation, "action", { ...customer, ...psychology, ...checklist }) as ActionModuleResult | null;
  if (!action) return null;
  return { ...customer, ...psychology, ...checklist, ...action, objections: [], offensePoints: [], defensePoints: [], confirmations: [], knowledgeReferences: action.knowledgeReferences ?? [] };
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
  const knowledgeScripts = await retrieveRelevantScripts(`${conversation}\n确认项：${item}`, 4);
  const prompt = `${commonPrompt}\n${instruction}\n沿用客户使用的语言生成 text，并为其提供自然简体中文翻译 translation。可以借鉴下方知识库话术的表达思路，但不得把不属于当前客户的示例信息当作事实。只输出包含 text 和 translation 的合法 JSON。${formatScriptKnowledgeContext(knowledgeScripts)}\n\n对话：\n${conversation}`;
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
