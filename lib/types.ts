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

export interface KnowledgeScriptReference {
  id: string;
  title: string;
  stage: string;
  excerpt: string;
}

export interface KnowledgeScript {
  id: string;
  title: string;
  scenario: string;
  stage: SalesStage;
  products: string[];
  customerRoles: string[];
  triggerText: string;
  content: string;
  translation: string;
  language: string;
  tags: string[];
  status: "draft" | "published";
  priority: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

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
  translation: string;
  interpretation: string;
}

export interface EmotionTurningPoint extends EmotionEvidence {
  label: string;
  score: number;
  reason: string;
}

export interface CommunicationTrait {
  trait: string;
  explanation: string;
  evidence: EmotionEvidence[];
}

export interface CustomerEmotionProfile {
  currentState: string;
  currentStateEvidence: EmotionEvidence[];
  emotionTurningPoints: EmotionTurningPoint[];
  personalityTraits: CommunicationTrait[];
  personalitySummary: string;
  decisionStyle: string;
  decisionFactors: string[];
  decisionPace: string;
  communicationApproach: string;
  decisionEvidence: EmotionEvidence[];
  confidence: number;
}

export interface CommunicationImprovement {
  title: string;
  priority: "高" | "中" | "低";
  issue: string;
  customerEvidenceMessageId: string;
  customerEvidenceQuote: string;
  customerEvidenceTranslation: string;
  handling: string;
  salesEvidenceMessageId: string;
  salesEvidenceQuote: string;
  salesEvidenceTranslation: string;
  recommendation: string;
}

export interface NextStepStrategy {
  strategySummary: string;
  primaryGoal: string;
  reasoning: string;
  actions: string[];
  communicationMethod: string;
  avoidActions: string[];
  evidence: EmotionEvidence[];
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

export interface OffensePoint {
  title: string;
  opportunity: string;
  timingReason: string;
  evidenceMessageId: string;
  evidenceQuote: string;
  evidenceTranslation: string;
  direction: string;
  suggestedReply: string;
  suggestedReplyTranslation: string;
  priority: "高" | "中" | "低";
  goal: "引导需求" | "建立信任" | "产品匹配" | "促成试单" | "推动付款" | "推动复购" | "其他";
}

export interface DefensePoint {
  title: string;
  risk: string;
  reason: string;
  evidenceMessageId: string;
  evidenceQuote: string;
  evidenceTranslation: string;
  status: "未解决" | "未追问-基本解决" | "客户肯定-完全解决";
  remedy: string;
  suggestedReply: string;
  suggestedReplyTranslation: string;
  riskLevel: "高" | "中" | "低";
}

export interface BuyingDriver {
  title: string;
  desiredOutcome: string;
  painOrExpectation: string;
  strength: "强" | "中" | "弱";
  purchaseIntent: "明确" | "较高" | "观察中";
  conversionReason: string;
  evidenceMessageId: string;
  evidenceQuote: string;
  evidenceTranslation: string;
}

export interface DealBlocker {
  title: string;
  category: "产品匹配" | "产品知识" | "价格与预算" | "质量与COA" | "公司与供应商信任" | "包装与交付" | "物流清关与时效" | "支付与资金安全" | "决策时机" | "内部审批" | "其他顾虑";
  concern: string;
  dealImpact: string;
  evidenceMessageId: string;
  evidenceQuote: string;
  evidenceTranslation: string;
  handlingStatus: "未解决" | "已回答-客户未追问" | "客户明确认可";
  salesEvidenceMessageId: string;
  salesEvidenceQuote: string;
  salesEvidenceTranslation: string;
  resolutionEvidenceMessageId: string;
  resolutionEvidenceQuote: string;
  resolutionEvidenceTranslation: string;
  solutionDirection: string;
}

export interface DealDecisionMap {
  motivationLevel: "强" | "中" | "弱";
  biggestBlocker: string;
  readiness: "高" | "中" | "低";
  priorityTask: string;
  buyingDrivers: BuyingDriver[];
  blockers: DealBlocker[];
}

export interface AnalysisReport {
  summary: string;
  profile: string[];
  emotionProfile: CustomerEmotionProfile;
  productMentions: ProductMention[];
  stage: SalesStage;
  parallelStages: SalesStage[];
  stageReason: string;
  objections: Objection[];
  decisionMap: DealDecisionMap;
  /** @deprecated 旧版进攻点数据，仅用于兼容浏览器中已保存的历史任务。 */
  offensePoints: OffensePoint[];
  /** @deprecated 旧版防守点数据，仅用于兼容浏览器中已保存的历史任务。 */
  defensePoints: DefensePoint[];
  /** @deprecated 仅用于读取升级前保存在浏览器中的旧任务；新分析保持为空数组。 */
  confirmations: ConfirmationItem[];
  improvements: CommunicationImprovement[];
  nextStrategy: NextStepStrategy;
  suggestedReply: string;
  suggestedReplyTranslation: string;
  knowledgeReferences: KnowledgeScriptReference[];
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
