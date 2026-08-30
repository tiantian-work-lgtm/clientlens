import type { AnalysisModule, AnalysisReport, ConfirmationItem, CustomerEmotionProfile, HesitationAnalysis, Objection, Provider, SalesStage } from "./types";
import { getRuntimeProviderConfig, type RuntimeProviderConfig } from "./provider-config";
import { buildNumberedConversationChunks, parseConversationMessages, type ParsedConversationMessage } from "./conversation";

const stages = ["初次询盘与客户背调", "信任建立", "产品与订单匹配", "决策推进", "等待付款", "已成交", "售后与复购"];
const profileDimensions = ["身份与组织", "客户类型与经验", "核心需求与目标", "产品兴趣", "决策权与流程", "采购意向", "价格敏感度", "信任状态", "核心关注与风险偏好", "沟通风格与下一步倾向"];

const customerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "profile", "emotionProfile", "stage", "parallelStages", "stageReason", "confidence"],
  properties: {
    summary: { type: "string" },
    profile: { type: "array", minItems: 10, maxItems: 10, items: { type: "string" } },
    emotionProfile: {
      type: "object",
      additionalProperties: false,
      required: ["currentEmotion", "emotionTrend", "personalityTraits", "communicationStyle", "decisionStyle", "sensitivities", "psychologicalState", "coreMotivations", "trustNeeds", "defensePatterns", "pressureResponse", "evidence", "advice", "confidence"],
      properties: {
        currentEmotion: { type: "string" },
        emotionTrend: { type: "string" },
        personalityTraits: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
        communicationStyle: { type: "string" },
        decisionStyle: { type: "string" },
        sensitivities: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
        psychologicalState: { type: "string" },
        coreMotivations: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
        trustNeeds: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
        defensePatterns: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
        pressureResponse: { type: "string" },
        evidence: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["messageId", "quote", "interpretation"],
            properties: {
              messageId: { type: "string" },
              quote: { type: "string" },
              interpretation: { type: "string" },
            },
          },
        },
        advice: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    },
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
  required: ["improvements", "nextActions", "suggestedReply", "suggestedReplyTranslation"],
  properties: {
    improvements: { type: "array", items: { type: "string" } },
    nextActions: { type: "array", items: { type: "string" } },
    suggestedReply: { type: "string" },
    suggestedReplyTranslation: { type: "string" },
  },
};

const hesitationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["readNoReplyStatus", "readNoReplyReason", "readNoReplyEvidenceMessageId", "readNoReplyEvidenceQuote", "overallCustomerPerspective", "signals", "strategy", "confidence"],
  properties: {
    readNoReplyStatus: { type: "string", enum: ["已确认已读未回", "疑似未回复", "未发现", "无法判断"] },
    readNoReplyReason: { type: "string" },
    readNoReplyEvidenceMessageId: { type: "string" },
    readNoReplyEvidenceQuote: { type: "string" },
    overallCustomerPerspective: { type: "string" },
    signals: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "kind", "severity", "customerPerspective", "evidenceMessageId", "evidenceQuote", "reasoning", "confidence", "followUpGoal", "followUpTiming", "suggestedMessage", "suggestedMessageTranslation"],
        properties: {
          title: { type: "string" },
          kind: { type: "string", enum: ["明确异议", "延后说辞", "含蓄犹豫", "未回复风险"] },
          severity: { type: "string", enum: ["高", "中", "低"] },
          customerPerspective: { type: "string" },
          evidenceMessageId: { type: "string" },
          evidenceQuote: { type: "string" },
          reasoning: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          followUpGoal: { type: "string" },
          followUpTiming: { type: "string" },
          suggestedMessage: { type: "string" },
          suggestedMessageTranslation: { type: "string" },
        },
      },
    },
    strategy: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

const commonPrompt = `你是一名严谨的 B2B 销售对话分析师。判断与事实必须分开，不确定的信息不能当成事实。输入中的每条消息都有稳定编号 M00001 等。不得虚构消息、客户背景、公司资料或公开背调信息。医疗相关内容只识别是否出现以及是否需要合规转介，不生成个体化剂量或医疗建议。所有分析字段使用中文。`;

const legacyModulePrompts = {
  customer: `${commonPrompt}\n只分析：对话总结、客户画像、客户情绪、沟通性格与非临床心理研判、销售阶段和总体置信度。客户画像 profile 必须严格返回 10 项，并按以下顺序和“维度：结论”格式填写：身份与组织、客户类型与经验、核心需求与目标、产品兴趣、决策权与流程、采购意向、价格敏感度、信任状态、核心关注与风险偏好、沟通风格与下一步倾向。每项应尽量具体，但只能依据聊天内容；聊天没有提供的维度必须写“维度：待确认”，禁止用常识补全或虚构。emotionProfile 只依据对话进行沟通场景下的心理研判，不得诊断精神疾病、人格障碍或贴 MBTI 等标签，也不得把短期状态写成永久人格。currentEmotion 写当前情绪，emotionTrend 写变化；personalityTraits 写有限定语的沟通性格倾向；communicationStyle 和 decisionStyle 写沟通与决策方式；sensitivities 写容易产生防御的沟通点；psychologicalState 写当前心理状态及不确定性；coreMotivations 写推动其行动的核心动机；trustNeeds 写建立信任所需条件；defensePatterns 写受到压力或不确定性时可观察到的防御或回避模式；pressureResponse 写客户面对催促、风险或信息过载时可能的反应。所有心理判断必须使用“可能、倾向、从当前表达看”等措辞，并由 evidence 中真实客户原文支持；不得推断创伤、家庭、疾病、隐私属性或操纵弱点。证据不足时写信息不足并降低 confidence；advice 提供尊重自主决定、可执行且不操纵客户的沟通建议。销售阶段只能从七阶段中选择；主阶段取最接近当前成交里程碑的一项，第1至3阶段可以同时放入 parallelStages。`,
  risk: `${commonPrompt}\n只分析异议、犹豫点、风险和确认清单，JSON 根对象只能包含 objections 和 confirmations。异议必须有真实客户原文，禁止“待确认异议1”等占位标题。按消息顺序判断：未正面回答、回避或客户再次追问=未解决；销售正面回答且客户未再追问=未追问-基本解决；销售回答后客户明确认可=客户肯定-完全解决。基本解决引用销售回答，完全解决引用客户后续肯定；沉默、礼貌致谢或话题切换不算肯定。确认清单必须且只返回 10 项：role、seeding、medical、scammed、coa、packaging、company、feedback、logistics、payment_method，禁止返回 education。只有明确顾虑或成交阻碍才能标记 risk，没谈到应标记 unknown。所有 evidenceQuote 必须逐字引用对应 M 编号原文。seeding 必须在需要种草/无需种草中二选一：需要时填写客户改善期望或痛点方向、销售是否已种草、客户是否在种草后明确肯定及下一步建议；已种草必须引用销售原话，客户明确肯定必须引用更晚的客户原话；非 seeding 项的全部 seeding 字段为空。medical 必须在需要提供建议/无需提供建议中二选一：客户提出剂量、用法、不良反应、禁忌、身体状况、疗效预期等需求时判为需要；需要时填写需求方向、是否已合规解答、客户是否在解答后明确肯定及下一步建议；已解答必须引用销售原话，客户明确肯定必须引用更晚的客户原话；不得生成个体化剂量、诊疗结论或替代专业医生，建议只能是安全沟通或专业转介；非 medical 项的全部 medical 字段为空。`,
  action: `${commonPrompt}\n只分析本次沟通可改善之处、下一步行动和建议回复。建议必须具体可执行；suggestedReply 沿用客户语言，suggestedReplyTranslation 返回自然简体中文翻译。`,
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
  required: ["summary", "profile", "stage", "parallelStages", "stageReason", "confidence"],
  properties: {
    summary: customerSchema.properties.summary,
    profile: customerSchema.properties.profile,
    stage: customerSchema.properties.stage,
    parallelStages: customerSchema.properties.parallelStages,
    stageReason: customerSchema.properties.stageReason,
    confidence: customerSchema.properties.confidence,
  },
};

const psychologySchema = {
  type: "object", additionalProperties: false, required: ["emotionProfile"],
  properties: { emotionProfile: customerSchema.properties.emotionProfile },
};

const objectionsSchema = {
  type: "object", additionalProperties: false, required: ["objections"],
  properties: { objections: riskSchema.properties.objections },
};

const checklistSchema = {
  type: "object", additionalProperties: false, required: ["confirmations"],
  properties: {
    confirmations: {
      type: "array", minItems: 10, maxItems: 10,
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "status", "evidence", "evidenceMessageId", "evidenceQuote", "riskReason", "conclusion", "detail", "source", "handling", "handlingEvidenceMessageId", "handlingEvidenceQuote", "reaction", "reactionEvidenceMessageId", "reactionEvidenceQuote", "advice", "confidence"],
        properties: {
          id: { type: "string", enum: ["role", "seeding", "medical", "scammed", "coa", "packaging", "company", "feedback", "logistics", "payment_method"] },
          status: { type: "string", enum: ["confirmed", "unknown", "risk", "na"] },
          evidence: { type: "string" }, evidenceMessageId: { type: "string" }, evidenceQuote: { type: "string" }, riskReason: { type: "string" },
          conclusion: { type: "string" }, detail: { type: "string" },
          source: { type: "string", enum: ["客户主动询问", "销售主动提出", "未提及", "不适用"] },
          handling: { type: "string", enum: ["已处理", "尚未处理", "未确认", "不适用"] },
          handlingEvidenceMessageId: { type: "string" }, handlingEvidenceQuote: { type: "string" },
          reaction: { type: "string", enum: ["客户明确肯定", "客户满意", "存在异议", "客户未明确表态", "未确认", "不适用"] },
          reactionEvidenceMessageId: { type: "string" }, reactionEvidenceQuote: { type: "string" },
          advice: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
};

const analysisPrompts: Record<AnalysisModule, string> = {
  customer: `${commonPrompt}\n只返回对话总结、10维客户画像和销售阶段。profile 严格按“身份与组织、客户类型与经验、核心需求与目标、产品兴趣、决策权与流程、采购意向、价格敏感度、信任状态、核心关注与风险偏好、沟通风格与下一步倾向”的顺序，以“维度：结论”返回10项；未知写待确认。stage 只能使用规定七阶段，第一至三阶段可并行。`,
  psychology: `${commonPrompt}\n只返回 emotionProfile。依据客户真实原文分析当前情绪、变化、沟通性格倾向、敏感点、沟通和决策方式，并作非临床心理研判：当前心理状态、核心驱动力、信任需求、防御或回避模式、压力反应。使用“可能、倾向”等限定语，不诊断疾病或人格障碍，不推断隐私；evidence 只引用客户消息的真实 M 编号和逐字原文，证据不足就明确说明并降低 confidence。`,
  objections: `${commonPrompt}\n只返回 objections。仅保留有客户逐字原文证据的明确异议或犹豫，禁止占位标题。未正面回答或客户再次追问=未解决；销售正面回答且客户未再追问=未追问-基本解决；销售回答后客户明确认可=客户肯定-完全解决。解决证据必须发生在异议之后；沉默、礼貌致谢和话题切换不算肯定。`,
  checklist: `${commonPrompt}\n只返回 confirmations，必须且只按顺序返回 role、seeding、medical、scammed、coa、packaging、company、feedback、logistics、payment_method 共10项。每项只使用统一精简字段：conclusion 是该项结论，detail 是方向或具体说明，source 是谁提出，handling 是销售是否处理，reaction 是客户反应，advice 是下一步建议。seeding 结论只能“需要种草/无需种草”；medical 只能“需要提供建议/无需提供建议”；scammed 只能“有被骗经历/无被骗经历”。其他项目 conclusion 简洁概括。已处理必须引用销售原文；客户明确肯定、满意或异议必须引用客户原文并符合消息顺序。未提及的字段使用未提及、未确认或不适用，不得虚构证据。只有真实成交障碍才标 risk。`,
  action: legacyModulePrompts.action,
};

export interface CustomerModuleResult {
  summary: string;
  profile: string[];
  stage: SalesStage;
  parallelStages: SalesStage[];
  stageReason: string;
  confidence: number;
}

export interface PsychologyModuleResult { emotionProfile: CustomerEmotionProfile }
export interface ObjectionsModuleResult { objections: Objection[] }
export interface ChecklistModuleResult { confirmations: ConfirmationItem[] }
interface RiskModuleResult { objections: Objection[]; confirmations: ConfirmationItem[] }
export interface ActionModuleResult { improvements: string[]; nextActions: string[]; suggestedReply: string; suggestedReplyTranslation: string }
export type AnalysisModuleResult = CustomerModuleResult | PsychologyModuleResult | ObjectionsModuleResult | ChecklistModuleResult | ActionModuleResult;

interface ChecklistModelItem {
  id: string;
  status: ConfirmationItem["status"];
  evidence: string;
  evidenceMessageId: string;
  evidenceQuote: string;
  riskReason: string;
  conclusion: string;
  detail: string;
  source: "客户主动询问" | "销售主动提出" | "未提及" | "不适用";
  handling: "已处理" | "尚未处理" | "未确认" | "不适用";
  handlingEvidenceMessageId: string;
  handlingEvidenceQuote: string;
  reaction: "客户明确肯定" | "客户满意" | "存在异议" | "客户未明确表态" | "未确认" | "不适用";
  reactionEvidenceMessageId: string;
  reactionEvidenceQuote: string;
  advice: string;
  confidence: number;
}
interface ChecklistModelResult { confirmations: ChecklistModelItem[] }

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
  if (module === "customer") return profileSchema;
  if (module === "psychology") return psychologySchema;
  if (module === "objections") return objectionsSchema;
  if (module === "checklist") return checklistSchema;
  return actionSchema;
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

function normalizeCustomerResult(value: unknown): CustomerModuleResult {
  const raw = value && typeof value === "object" ? value as Partial<CustomerModuleResult> : {};
  const profile = profileDimensions.map((dimension, index) => {
    const candidate = Array.isArray(raw.profile) ? raw.profile[index] : "";
    return typeof candidate === "string" && new RegExp(`^${dimension}[：:]`).test(candidate.trim()) ? candidate.trim() : `${dimension}：待确认`;
  });
  const confidence = Number(raw.confidence);
  return {
    summary: raw.summary?.trim() || "当前对话信息不足，建议结合原始聊天人工核对。",
    profile,
    stage: stages.includes(raw.stage || "") ? raw.stage as SalesStage : "初次询盘与客户背调",
    parallelStages: Array.isArray(raw.parallelStages) ? raw.parallelStages.filter((stage): stage is SalesStage => stages.includes(stage)).slice(0, 3) : [],
    stageReason: raw.stageReason?.trim() || "当前信息不足，暂按初次询盘阶段处理。",
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.25,
  };
}

function normalizePsychologyResult(value: unknown, messages: ParsedConversationMessage[]): PsychologyModuleResult {
  const rawRoot = value && typeof value === "object" ? value as Partial<PsychologyModuleResult> : {};
  const raw = rawRoot.emotionProfile && typeof rawRoot.emotionProfile === "object" ? rawRoot.emotionProfile as Partial<CustomerEmotionProfile> : {};
  const customerMessages = new Map(messages.filter((message) => message.role === "customer").map((message) => [message.id, message]));
  const evidence = (Array.isArray(raw.evidence) ? raw.evidence : []).filter((item) => item?.interpretation?.trim() && hasVerifiedEvidence(customerMessages, item.messageId, item.quote)).slice(0, 5);
  const confidence = Number(raw.confidence);
  return { emotionProfile: {
    currentEmotion: raw.currentEmotion?.trim() || "信息不足，暂无法判断当前情绪",
    emotionTrend: raw.emotionTrend?.trim() || "信息不足，暂无法判断情绪变化",
    personalityTraits: cleanStringArray(raw.personalityTraits),
    communicationStyle: raw.communicationStyle?.trim() || "信息不足，暂无法判断沟通方式",
    decisionStyle: raw.decisionStyle?.trim() || "信息不足，暂无法判断决策方式",
    sensitivities: cleanStringArray(raw.sensitivities),
    psychologicalState: raw.psychologicalState?.trim() || "信息不足，暂无法进行沟通心理研判",
    coreMotivations: cleanStringArray(raw.coreMotivations),
    trustNeeds: cleanStringArray(raw.trustNeeds),
    defensePatterns: cleanStringArray(raw.defensePatterns),
    pressureResponse: raw.pressureResponse?.trim() || "信息不足，暂无法判断压力下的沟通反应",
    evidence,
    advice: cleanStringArray(raw.advice, ["继续观察客户表达，并通过开放式问题确认其真实关注点。"]),
    confidence: evidence.length && Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : Math.min(Number.isFinite(confidence) ? confidence : 0.2, 0.35),
  } };
}

function normalizeObjectionsResult(value: unknown, messages: ParsedConversationMessage[]): ObjectionsModuleResult {
  const raw = value && typeof value === "object" ? value as Partial<ObjectionsModuleResult> : {};
  return { objections: normalizeRiskResult({ objections: Array.isArray(raw.objections) ? raw.objections : [], confirmations: [] } as unknown as AnalysisModuleResult, messages).objections };
}

function normalizeChecklistResult(value: unknown, messages: ParsedConversationMessage[]): ChecklistModuleResult {
  const raw = value && typeof value === "object" ? value as Partial<ChecklistModelResult> : {};
  const rawItems = Array.isArray(raw.confirmations) ? raw.confirmations : [];
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

function validateLegacyModuleResult(module: "customer" | "risk" | "action", value: AnalysisModuleResult, messages: ParsedConversationMessage[] = []) {
  if (!value || typeof value !== "object") throw new Error(`${module} 模块返回空结果`);
  if (module === "customer") {
    const result = value as CustomerModuleResult & PsychologyModuleResult;
    if (!result.summary?.trim() || !stages.includes(result.stage) || !Number.isFinite(result.confidence)) throw new Error("客户画像模块字段不完整");
    if (!Array.isArray(result.profile) || result.profile.length !== profileDimensions.length) throw new Error("客户画像必须完整覆盖 10 个维度");
    if (result.profile.some((item, index) => !new RegExp(`^${profileDimensions[index]}[：:]`).test(item?.trim()))) throw new Error("客户画像维度缺失或顺序不正确");
    const emotion = result.emotionProfile;
    if (!emotion?.currentEmotion?.trim() || !emotion.emotionTrend?.trim() || !emotion.communicationStyle?.trim() || !emotion.decisionStyle?.trim() || !emotion.psychologicalState?.trim() || !emotion.pressureResponse?.trim() || !Number.isFinite(emotion.confidence)) throw new Error("客户情绪、沟通性格与心理研判字段不完整");
    if (!Array.isArray(emotion.personalityTraits) || !emotion.personalityTraits.length || !Array.isArray(emotion.sensitivities) || !emotion.sensitivities.length || !Array.isArray(emotion.coreMotivations) || !emotion.coreMotivations.length || !Array.isArray(emotion.trustNeeds) || !emotion.trustNeeds.length || !Array.isArray(emotion.defensePatterns) || !emotion.defensePatterns.length || !Array.isArray(emotion.advice) || !emotion.advice.length || !Array.isArray(emotion.evidence)) throw new Error("客户情绪、心理研判缺少动机、信任需求、防御模式、证据或建议");
    const customerMessageById = new Map(messages.filter((message) => message.role === "customer").map((message) => [message.id, message]));
    if (customerMessageById.size && !emotion.evidence.length) throw new Error("客户情绪与沟通性格分析缺少客户原文依据");
    if (emotion.evidence.some((item) => !item.interpretation?.trim() || !hasVerifiedEvidence(customerMessageById, item.messageId, item.quote))) throw new Error("客户情绪与沟通性格分析包含无法核验的客户原文");
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
  if (module === "customer") return normalizeCustomerResult(value);
  if (module === "psychology") return normalizePsychologyResult(value, messages);
  if (module === "objections") return normalizeObjectionsResult(value, messages);
  if (module === "checklist") return normalizeChecklistResult(value, messages);
  const raw = value && typeof value === "object" ? value as Partial<ActionModuleResult> : {};
  return {
    improvements: cleanStringArray(raw.improvements, ["继续结合客户原话检查本次沟通是否直接回答了问题。"]),
    nextActions: cleanStringArray(raw.nextActions, ["先确认客户当前最关心的问题，再推进一个明确的下一步。"]),
    suggestedReply: raw.suggestedReply?.trim() || "Could you tell me which point you would like to confirm first?",
    suggestedReplyTranslation: raw.suggestedReplyTranslation?.trim() || "您可以告诉我，您想先确认哪一点吗？",
  };
}

async function requestModuleOnce(config: RuntimeProviderConfig, provider: Provider, module: AnalysisModule, input: string, merge = false): Promise<AnalysisModuleResult> {
  const instruction = `${analysisPrompts[module]}${merge ? "\n下面是分段分析结果，请去重并合并为一个最终结果。消息编号与原文必须原样保留。" : ""}`;
  if (provider === "openai") {
    return requestOpenAIJson<AnalysisModuleResult>(config, moduleSchema(module), `customer_${module}_analysis`, instruction, input);
  }
  const tokens = module === "checklist" ? 4200 : module === "psychology" ? 2600 : module === "customer" ? 2200 : module === "objections" ? 2800 : 2400;
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
        chunkResults.push(normalizeModuleResult(module, rawResult, messages));
      }
      const result = chunkResults.length === 1
        ? chunkResults[0]
        : await requestModuleOnce(config, provider, module, JSON.stringify(chunkResults), true);
      return normalizeModuleResult(module, result, messages);
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
    analyzeModuleWithProvider(provider, conversation, "objections"),
    analyzeModuleWithProvider(provider, conversation, "checklist"),
    analyzeModuleWithProvider(provider, conversation, "action"),
  ]);
  if (results.some((result) => !result)) return null;
  const customer = results[0] as CustomerModuleResult;
  const psychology = results[1] as PsychologyModuleResult;
  const objections = results[2] as ObjectionsModuleResult;
  const checklist = results[3] as ChecklistModuleResult;
  const action = results[4] as ActionModuleResult;
  return { ...customer, ...psychology, ...objections, ...checklist, ...action };
}

type HesitationModelResult = Omit<HesitationAnalysis, "analyzedAt">;

const hesitationInstruction = `${commonPrompt}
这是一次用户主动触发的深度复盘，不属于首次常规分析。请按消息顺序细看完整对话，并站在客户视角识别：明确异议、延后说辞、含蓄犹豫和未回复风险。延后说辞包括“稍后看看”“研究后回复”“之后再说”等推迟决策表达；含蓄犹豫只能作为有证据的可能性推断，禁止声称读懂客户内心或把推断写成事实。
每个 signals 项必须引用一条真实消息的 M 编号及逐字原文，解释为什么该表达可能阻碍推进，并分别给出跟进目标、建议时机、可直接发送的客户语言消息及自然简体中文翻译。没有原文依据的点必须删除，不得为追求数量而虚构。
readNoReplyStatus 只有输入明确包含已读标记时才能写“已确认已读未回”；若最后一条关键销售消息之后没有客户回复但没有已读标记，只能写“疑似未回复”；若后续已有客户回复则不能把此前普通等待误判为当前未回复。礼貌感谢、普通询价和正常考虑不自动等于拒绝。
overallCustomerPerspective 要总结客户此刻可能如何看待整个沟通过程，并明确区分事实与推断。strategy 提供多点跟进顺序，优先解决高影响问题，避免连续轰炸、施压和重复发送相同内容。只输出符合字段要求的合法 JSON。`;

function validateHesitationResult(result: HesitationModelResult, messages: ParsedConversationMessage[], conversation: string, final: boolean) {
  if (!result?.readNoReplyStatus || !result.readNoReplyReason?.trim() || !result.overallCustomerPerspective?.trim() || !Array.isArray(result.signals) || !Array.isArray(result.strategy) || !result.strategy.length || !Number.isFinite(result.confidence)) throw new Error("深度犹豫分析字段不完整");
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const titles = new Set<string>();
  for (const signal of result.signals) {
    if (!signal.title?.trim() || titles.has(signal.title.trim()) || !signal.customerPerspective?.trim() || !signal.reasoning?.trim() || !signal.followUpGoal?.trim() || !signal.followUpTiming?.trim() || !signal.suggestedMessage?.trim() || !signal.suggestedMessageTranslation?.trim() || !Number.isFinite(signal.confidence)) throw new Error("深度犹豫分析包含重复或不完整的判断");
    titles.add(signal.title.trim());
    const evidenceMessage = messageById.get(signal.evidenceMessageId);
    if (!evidenceMessage || !hasVerifiedEvidence(messageById, signal.evidenceMessageId, signal.evidenceQuote)) throw new Error("深度犹豫分析包含无法核验的原文");
    if (signal.kind !== "未回复风险" && evidenceMessage.role !== "customer") throw new Error("客户异议或犹豫必须引用客户原文");
    if (signal.kind === "未回复风险") {
      const evidenceIndex = messages.findIndex((message) => message.id === signal.evidenceMessageId);
      if (evidenceMessage.role !== "sales" || (final && messages.slice(evidenceIndex + 1).some((message) => message.role === "customer"))) throw new Error("未回复风险必须引用尚无客户后续回复的销售消息");
    }
  }
  if (!final) return result;
  if (result.readNoReplyStatus === "已确认已读未回" && !/(?:已读|\bseen\b|read\s*(?:at|receipt|status))/i.test(conversation)) throw new Error("聊天记录没有明确已读标记，不能判断已确认已读未回");
  if (result.readNoReplyStatus === "已确认已读未回" || result.readNoReplyStatus === "疑似未回复") {
    const evidenceMessage = messageById.get(result.readNoReplyEvidenceMessageId);
    const evidenceIndex = messages.findIndex((message) => message.id === result.readNoReplyEvidenceMessageId);
    if (evidenceMessage?.role !== "sales" || !hasVerifiedEvidence(messageById, result.readNoReplyEvidenceMessageId, result.readNoReplyEvidenceQuote) || messages.slice(evidenceIndex + 1).some((message) => message.role === "customer")) throw new Error("未回复判断缺少最后一条未获客户回复的销售原文");
  }
  return result;
}

async function requestHesitationOnce(config: RuntimeProviderConfig, provider: Provider, input: string, merge = false) {
  const instructions = `${hesitationInstruction}${merge ? "\n下面是按时间顺序排列的分段分析及对话尾部，请去重、校正跨分段误判并合并为最终结果。保留真实消息编号与原文。" : ""}`;
  if (provider === "openai") return requestOpenAIJson<HesitationModelResult>(config, hesitationSchema, "deep_hesitation_analysis", instructions, input);
  return requestDeepSeekJson<HesitationModelResult>(config, [{ role: "system", content: instructions }, { role: "user", content: input }], 6000);
}

export async function analyzeHesitationWithProvider(provider: Provider, conversation: string): Promise<HesitationAnalysis | null> {
  const config = await getRuntimeProviderConfig(provider);
  if (!config) return null;
  const messages = parseConversationMessages(conversation);
  const chunks = buildNumberedConversationChunks(conversation);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const retryPrefix = attempt ? "上一次结果未通过原文或顺序核验。删除无法核验的推断，并严格区分事实、疑似与无法判断。\n\n" : "";
      const chunkResults: HesitationModelResult[] = [];
      for (const chunk of chunks) {
        const result = await requestHesitationOnce(config, provider, `${retryPrefix}${chunk}`);
        chunkResults.push(validateHesitationResult(result, messages, conversation, chunks.length === 1));
      }
      const merged = chunks.length === 1 ? chunkResults[0] : await requestHesitationOnce(config, provider, JSON.stringify({ chunkResults, conversationTail: chunks.at(-1) }), true);
      const validated = validateHesitationResult(merged, messages, conversation, true);
      return { ...validated, analyzedAt: new Date().toISOString() };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("深度犹豫分析失败");
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
