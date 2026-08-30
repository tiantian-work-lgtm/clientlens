export type SourceType = "salesmartly" | "text" | "excel";
export type TaskStatus = "ready" | "analyzing" | "stale" | "failed";
export type Provider = "openai" | "deepseek";
export type IntegrationProvider = Provider | "salesmartly";
export type SalesStage =
  | "初次询盘与客户背调"
  | "信任建立"
  | "产品与订单匹配"
  | "决策推进"
  | "等待付款"
  | "已成交"
  | "售后与复购";
export type ConfirmationStatus = "confirmed" | "unknown" | "risk" | "na";
export type AnalysisModule = "customer" | "psychology" | "objections" | "checklist" | "action";
export type AnalysisModuleStatus = "pending" | "analyzing" | "done" | "failed";

export interface ImportPreviewMessage {
  id: string;
  role: "customer" | "sales" | "unknown" | "system";
  sender: string;
  time: string;
  content: string;
  sourceRef: string;
  confidence: number;
  conversationKey: string;
  customerName: string;
}

export interface ImportPreview {
  messages: ImportPreviewMessage[];
  detectedCustomers: string[];
  detectedConversations: string[];
  mappingSummary: string[];
  warnings: string[];
  overallConfidence: number;
}

export interface Evidence {
  quote: string;
  time?: string;
}

export interface EmotionEvidence {
  messageId: string;
  quote: string;
  interpretation: string;
}

export interface CustomerEmotionProfile {
  currentEmotion: string;
  emotionTrend: string;
  personalityTraits: string[];
  decisionStyle: string;
  sensitivities: string[];
  psychologicalState: string;
  coreMotivations: string[];
  trustNeeds: string[];
  defensePatterns: string[];
  pressureResponse: string;
  evidence: EmotionEvidence[];
  advice: string[];
  confidence: number;
}

export interface HesitationSignal {
  title: string;
  kind: "明确异议" | "延后说辞" | "含蓄犹豫" | "未回复风险";
  severity: "高" | "中" | "低";
  customerPerspective: string;
  evidenceMessageId: string;
  evidenceQuote: string;
  reasoning: string;
  confidence: number;
  followUpGoal: string;
  followUpTiming: string;
  suggestedMessage: string;
  suggestedMessageTranslation: string;
}

export interface HesitationAnalysis {
  analyzedAt: string;
  readNoReplyStatus: "已确认已读未回" | "疑似未回复" | "未发现" | "无法判断";
  readNoReplyReason: string;
  readNoReplyEvidenceMessageId: string;
  readNoReplyEvidenceQuote: string;
  overallCustomerPerspective: string;
  signals: HesitationSignal[];
  strategy: string[];
  confidence: number;
}

export interface ProductResearchSource {
  title: string;
  url: string;
  excerpt: string;
  level: "自有产品资料" | "同行评审研究" | "官方或机构资料" | "厂商产品资料" | "其他公开资料";
}

export interface ProductTalkingPoint {
  title: string;
  explanation: string;
  sourceUrls: string[];
}

export interface ProductResearch {
  productName: string;
  customerNeed: string;
  customerEvidenceMessageId: string;
  customerEvidenceQuote: string;
  matchLevel: "高" | "中" | "低" | "资料不足";
  matchSummary: string;
  talkingPoints: ProductTalkingPoint[];
  limitations: string[];
  sources: ProductResearchSource[];
  suggestedReply: string;
  suggestedReplyTranslation: string;
  searchedAt: string;
}

export interface ProductMention {
  name: string;
  mentionedBy: "客户" | "销售" | "双方";
  customerAwareness: "不了解" | "初步了解" | "有使用经验" | "明确熟悉" | "无法判断";
  customerInterest: "明确感兴趣" | "可能感兴趣" | "未表现兴趣" | "明确拒绝" | "无法判断";
  awarenessReason: string;
  evidenceMessageId: string;
  evidenceQuote: string;
}

export interface Objection {
  title: string;
  severity: "高" | "中" | "低";
  status: "未解决" | "未追问-基本解决" | "客户肯定-完全解决";
  evidence: string;
  evidenceMessageId?: string;
  evidenceQuote?: string;
  evidenceVerified?: boolean;
  resolutionEvidenceMessageId?: string;
  resolutionEvidenceQuote?: string;
  resolutionReason?: string;
  advice: string;
}

export interface ConfirmationItem {
  id: string;
  category: "客户角色" | "认知与经历" | "产品与信任" | "交易条件";
  label: string;
  status: ConfirmationStatus;
  evidence: string;
  evidenceMessageId?: string;
  evidenceQuote?: string;
  riskReason?: string;
  seedingNeed?: "需要种草" | "无需种草";
  seedingDirection?: string;
  seedingPerformed?: "已种草" | "尚未种草" | "未确认";
  seedingPerformedEvidenceMessageId?: string;
  seedingPerformedEvidenceQuote?: string;
  seedingAccepted?: "客户明确肯定" | "客户未明确肯定" | "未确认";
  seedingAcceptanceEvidenceMessageId?: string;
  seedingAcceptanceEvidenceQuote?: string;
  seedingAdvice?: string;
  medicalNeed?: "需要提供建议" | "无需提供建议";
  medicalDirection?: string;
  medicalAnswered?: "已解答" | "尚未解答" | "未确认";
  medicalAnswerEvidenceMessageId?: string;
  medicalAnswerEvidenceQuote?: string;
  medicalAccepted?: "客户明确肯定" | "客户未明确肯定" | "未确认";
  medicalAcceptanceEvidenceMessageId?: string;
  medicalAcceptanceEvidenceQuote?: string;
  medicalAdvice?: string;
  scamExperienceStatus?: "有被骗经历" | "无被骗经历";
  scamExperienceSummary?: string;
  scamAddressed?: "已回应" | "尚未回应" | "未确认";
  scamResponseEvidenceMessageId?: string;
  scamResponseEvidenceQuote?: string;
  scamAccepted?: "客户明确肯定" | "客户未明确肯定" | "未确认";
  scamAcceptanceEvidenceMessageId?: string;
  scamAcceptanceEvidenceQuote?: string;
  scamAdvice?: string;
  coaMentionSource?: "客户主动询问" | "销售主动提出" | "未提及";
  coaMentionEvidenceMessageId?: string;
  coaMentionEvidenceQuote?: string;
  coaExplained?: "已说明" | "尚未说明" | "未确认";
  coaExplanationEvidenceMessageId?: string;
  coaExplanationEvidenceQuote?: string;
  coaAccepted?: "客户明确肯定" | "客户未明确肯定" | "未确认";
  coaAcceptanceEvidenceMessageId?: string;
  coaAcceptanceEvidenceQuote?: string;
  coaAdvice?: string;
  packagingMentionSource?: "客户主动询问" | "销售主动提出" | "未提及";
  packagingMentionEvidenceMessageId?: string;
  packagingMentionEvidenceQuote?: string;
  packagingExplained?: "已说明" | "尚未说明" | "未确认";
  packagingExplanationEvidenceMessageId?: string;
  packagingExplanationEvidenceQuote?: string;
  packagingAccepted?: "客户明确肯定" | "客户未明确肯定" | "未确认";
  packagingAcceptanceEvidenceMessageId?: string;
  packagingAcceptanceEvidenceQuote?: string;
  packagingAdvice?: string;
  companyMentionSource?: "客户主动询问" | "销售主动提出" | "未提及";
  companyMentionEvidenceMessageId?: string;
  companyMentionEvidenceQuote?: string;
  companyExplained?: "已说明" | "尚未说明" | "未确认";
  companyExplanationEvidenceMessageId?: string;
  companyExplanationEvidenceQuote?: string;
  companyAccepted?: "客户明确肯定" | "客户未明确肯定" | "未确认";
  companyAcceptanceEvidenceMessageId?: string;
  companyAcceptanceEvidenceQuote?: string;
  companyAdvice?: string;
  feedbackMentionSource?: "客户主动询问" | "销售主动提出" | "未提及";
  feedbackMentionEvidenceMessageId?: string;
  feedbackMentionEvidenceQuote?: string;
  feedbackAnswered?: "已解答" | "尚未解答" | "未确认";
  feedbackAnswerEvidenceMessageId?: string;
  feedbackAnswerEvidenceQuote?: string;
  feedbackAccepted?: "客户明确肯定" | "客户未明确肯定" | "未确认";
  feedbackAcceptanceEvidenceMessageId?: string;
  feedbackAcceptanceEvidenceQuote?: string;
  feedbackAdvice?: string;
  logisticsMentionSource?: "客户主动询问" | "销售主动提出" | "未提及";
  logisticsMentionEvidenceMessageId?: string;
  logisticsMentionEvidenceQuote?: string;
  logisticsAnswered?: "已解答" | "尚未解答" | "未确认";
  logisticsAnswerEvidenceMessageId?: string;
  logisticsAnswerEvidenceQuote?: string;
  logisticsCustomerReaction?: "客户满意" | "存在异议" | "客户未明确表态" | "未确认";
  logisticsReactionEvidenceMessageId?: string;
  logisticsReactionEvidenceQuote?: string;
  logisticsAdvice?: string;
  paymentMentionSource?: "客户主动询问" | "销售主动提出" | "未提及";
  paymentMentionEvidenceMessageId?: string;
  paymentMentionEvidenceQuote?: string;
  paymentCustomerReaction?: "客户明确肯定" | "存在异议" | "客户未明确表态" | "未确认";
  paymentReactionEvidenceMessageId?: string;
  paymentReactionEvidenceQuote?: string;
  paymentAdvice?: string;
  confidence: number;
}

export interface AnalysisReport {
  summary: string;
  profile: string[];
  emotionProfile: CustomerEmotionProfile;
  hesitationAnalysis?: HesitationAnalysis;
  productMentions: ProductMention[];
  productResearch?: ProductResearch;
  stage: SalesStage;
  parallelStages: SalesStage[];
  stageReason: string;
  objections: Objection[];
  confirmations: ConfirmationItem[];
  improvements: string[];
  nextActions: string[];
  suggestedReply: string;
  suggestedReplyTranslation: string;
  confidence: number;
}

export interface ProgressItem {
  id: string;
  label: string;
  state: "todo" | "doing" | "done" | "na";
  locked?: boolean;
}

export interface CustomerTask {
  id: string;
  name: string;
  source: SourceType;
  status: TaskStatus;
  analysisStep?: "importing" | "analyzing";
  analysisError?: string;
  analysisModules?: Record<AnalysisModule, AnalysisModuleStatus>;
  analysisModuleErrors?: Partial<Record<AnalysisModule, string>>;
  updatedAt: string;
  customer: {
    name: string;
    externalId?: string;
    country: string;
    company?: string;
    owner: string;
    product: string;
    channel: string;
    lastMessageAt: string;
  };
  rawConversation: string;
  rawTranslation?: {
    source: string;
    lines: string[];
    translatedAt: string;
  };
  report: AnalysisReport;
  progress: ProgressItem[];
  provider: Provider;
  model: string;
}
