import type { AnalysisReport, ConfirmationItem, CustomerTask, ProgressItem } from "./types";

export const defaultProgress: ProgressItem[] = [
  { id: "inquiry", label: "初次询盘与客户背调", state: "done", locked: true },
  { id: "trust", label: "信任建立", state: "doing" },
  { id: "match", label: "产品与订单匹配", state: "doing" },
  { id: "decision", label: "决策推进", state: "todo" },
  { id: "payment", label: "等待付款", state: "todo" },
  { id: "won", label: "已成交", state: "todo" },
  { id: "retention", label: "售后与复购", state: "todo" },
];

export const defaultConfirmations: ConfirmationItem[] = [
  { id: "role", category: "客户角色", label: "客户角色与经验", status: "unknown", evidence: "对话中尚未确认。", confidence: 0 },
  { id: "seeding", category: "认知与经历", label: "是否需要产品种草", status: "unknown", evidence: "对话中尚未确认。", confidence: 0 },
  { id: "medical", category: "认知与经历", label: "剂量、使用或医疗问题", status: "unknown", evidence: "对话中尚未确认。", confidence: 0 },
  { id: "scammed", category: "认知与经历", label: "是否有被骗经历", status: "unknown", evidence: "对话中尚未确认。", confidence: 0 },
  { id: "coa", category: "产品与信任", label: "COA 与产品一致性", status: "unknown", evidence: "对话中尚未确认。", confidence: 0 },
  { id: "packaging", category: "产品与信任", label: "产品包装", status: "unknown", evidence: "对话中尚未确认。", confidence: 0 },
  { id: "company", category: "产品与信任", label: "公司资料", status: "unknown", evidence: "对话中尚未确认。", confidence: 0 },
  { id: "feedback", category: "产品与信任", label: "其他客户反馈", status: "unknown", evidence: "对话中尚未确认。", confidence: 0 },
  { id: "logistics", category: "交易条件", label: "物流、清关和时效", status: "unknown", evidence: "对话中尚未确认。", confidence: 0 },
  { id: "payment_method", category: "交易条件", label: "支付方式与付款安全", status: "unknown", evidence: "对话中尚未确认。", confidence: 0 },
];

const demoConfirmations: ConfirmationItem[] = defaultConfirmations.map((item) => {
  if (item.id === "role") return { ...item, status: "confirmed", evidence: "客户代表公司询问首批采购，并熟悉批次资料。", confidence: 0.82 };
  if (item.id === "seeding") return { ...item, status: "na", evidence: "客户已有明确目标产品，当前重点是核实批次资料和付款保障。", evidenceMessageId: "M00001", evidenceQuote: "Is the COA from the same batch I will receive?", seedingNeed: "无需种草", seedingDirection: "", seedingPerformed: "未确认", seedingPerformedEvidenceMessageId: "", seedingPerformedEvidenceQuote: "", seedingAccepted: "未确认", seedingAcceptanceEvidenceMessageId: "", seedingAcceptanceEvidenceQuote: "", seedingAdvice: "", confidence: 0.76 };
  if (item.id === "medical") return { ...item, status: "na", evidence: "客户当前只在核实批次资料和付款保障，没有提出剂量、使用或医疗需求。", evidenceMessageId: "M00001", evidenceQuote: "Is the COA from the same batch I will receive?", medicalNeed: "无需提供建议", medicalDirection: "", medicalAnswered: "未确认", medicalAnswerEvidenceMessageId: "", medicalAnswerEvidenceQuote: "", medicalAccepted: "未确认", medicalAcceptanceEvidenceMessageId: "", medicalAcceptanceEvidenceQuote: "", medicalAdvice: "", confidence: 0.72 };
  if (item.id === "scammed") return { ...item, status: "na", evidence: "当前聊天中未发现客户提及被骗经历。", scamExperienceStatus: "无被骗经历", scamExperienceSummary: "", scamAddressed: "未确认", scamResponseEvidenceMessageId: "", scamResponseEvidenceQuote: "", scamAccepted: "未确认", scamAcceptanceEvidenceMessageId: "", scamAcceptanceEvidenceQuote: "", scamAdvice: "", confidence: 0.68 };
  if (item.id === "coa") return { ...item, status: "risk", evidence: "客户询问收到的产品是否对应同一批次 COA。", evidenceMessageId: "M00001", evidenceQuote: "Is the COA from the same batch I will receive?", riskReason: "客户尚未确认质量文件与实际交付批次一致，可能阻碍首次下单。", coaMentionSource: "客户主动询问", coaMentionEvidenceMessageId: "M00001", coaMentionEvidenceQuote: "Is the COA from the same batch I will receive?", coaExplained: "尚未说明", coaExplanationEvidenceMessageId: "", coaExplanationEvidenceQuote: "", coaAccepted: "客户未明确肯定", coaAcceptanceEvidenceMessageId: "", coaAcceptanceEvidenceQuote: "", coaAdvice: "直接说明 COA 与拟交付批次的对应方式，并提供可核验的批次信息。", confidence: 0.96 };
  if (item.id === "packaging") return { ...item, status: "unknown", evidence: "当前聊天中尚未提及产品包装。", packagingMentionSource: "未提及", packagingMentionEvidenceMessageId: "", packagingMentionEvidenceQuote: "", packagingExplained: "未确认", packagingExplanationEvidenceMessageId: "", packagingExplanationEvidenceQuote: "", packagingAccepted: "未确认", packagingAcceptanceEvidenceMessageId: "", packagingAcceptanceEvidenceQuote: "", packagingAdvice: "在确认产品和数量后，主动询问客户是否关注包装规格、标签或运输隐私。", confidence: 0.7 };
  if (item.id === "company") return { ...item, status: "unknown", evidence: "当前聊天中尚未有效说明可核验的公司资料。", companyMentionSource: "未提及", companyMentionEvidenceMessageId: "", companyMentionEvidenceQuote: "", companyExplained: "未确认", companyExplanationEvidenceMessageId: "", companyExplanationEvidenceQuote: "", companyAccepted: "未确认", companyAcceptanceEvidenceMessageId: "", companyAcceptanceEvidenceQuote: "", companyAdvice: "在客户需要建立信任时，询问其最希望核验的公司信息，再提供对应的真实资料。", confidence: 0.7 };
  if (item.id === "feedback") return { ...item, status: "unknown", evidence: "当前聊天中尚未提及其他客户反馈或案例。", feedbackMentionSource: "未提及", feedbackMentionEvidenceMessageId: "", feedbackMentionEvidenceQuote: "", feedbackAnswered: "未确认", feedbackAnswerEvidenceMessageId: "", feedbackAnswerEvidenceQuote: "", feedbackAccepted: "未确认", feedbackAcceptanceEvidenceMessageId: "", feedbackAcceptanceEvidenceQuote: "", feedbackAdvice: "先确认客户最担心的环节，再提供已脱敏的物流参考、客户返图或相似案例。", confidence: 0.7 };
  if (item.id === "logistics") return { ...item, status: "unknown", evidence: "当前聊天中尚未提及物流、清关或时效。", logisticsMentionSource: "未提及", logisticsMentionEvidenceMessageId: "", logisticsMentionEvidenceQuote: "", logisticsAnswered: "未确认", logisticsAnswerEvidenceMessageId: "", logisticsAnswerEvidenceQuote: "", logisticsCustomerReaction: "未确认", logisticsReactionEvidenceMessageId: "", logisticsReactionEvidenceQuote: "", logisticsAdvice: "确认目的国家和客户最关注的物流问题后，再说明可用渠道、参考时效及清关边界。", confidence: 0.7 };
  if (item.id === "payment_method") return { ...item, status: "risk", evidence: "客户询问首次订单可获得什么付款保障。", evidenceMessageId: "M00003", evidenceQuote: "What protection do I have for the first order?", riskReason: "客户对首次付款的资金安全缺乏信心，未解决前可能不会付款。", paymentMentionSource: "客户主动询问", paymentMentionEvidenceMessageId: "M00003", paymentMentionEvidenceQuote: "What protection do I have for the first order?", paymentCustomerReaction: "存在异议", paymentReactionEvidenceMessageId: "M00003", paymentReactionEvidenceQuote: "What protection do I have for the first order?", paymentAdvice: "先确认客户可用的支付渠道，再如实说明对应流程、费用和可核验的付款保障。", confidence: 0.95 };
  return { ...item };
});

export const emptyReport: AnalysisReport = {
  summary: "等待 AI 完成对话分析。",
  profile: [],
  emotionProfile: { currentEmotion: "待分析", emotionTrend: "待分析", personalityTraits: ["信息不足"], decisionStyle: "待分析", sensitivities: ["信息不足"], psychologicalState: "待分析", coreMotivations: ["信息不足"], trustNeeds: ["信息不足"], defensePatterns: ["信息不足"], pressureResponse: "待分析", evidence: [], advice: ["等待更多客户对话后再判断。"], confidence: 0 },
  stage: "初次询盘与客户背调",
  parallelStages: [],
  stageReason: "当前尚无足够信息判断销售阶段。",
  objections: [],
  confirmations: defaultConfirmations,
  improvements: [],
  nextActions: [],
  suggestedReply: "",
  suggestedReplyTranslation: "",
  confidence: 0,
};

export const demoReport: AnalysisReport = {
  summary:
    "客户正在评估首批采购，已经确认目标产品并收到报价。目前兴趣明确，但在继续推进前希望确认质量文件、批次稳定性和付款保障。对话没有明确拒绝信号，重点应从重复介绍产品转向降低首次合作风险。",
  profile: [
    "身份与组织：代表公司评估首批采购，具体职位待确认",
    "客户类型与经验：熟悉 COA、批次资料及采购风险，具备专业采购经验",
    "核心需求与目标：完成低风险的首次采购并验证交付质量",
    "产品兴趣：已有明确目标产品，具体数量待确认",
    "决策权与流程：能够参与产品筛选，最终审批人和流程待确认",
    "采购意向：较高，已收到报价并继续核实成交条件",
    "价格敏感度：中等，关注首单风险多于单纯压价",
    "信任状态：建立中，需要可核验的批次文件与付款保障",
    "核心关注与风险偏好：重视 COA 与实物一致性，偏好可控的首单方案",
    "沟通风格与下一步倾向：问题直接，倾向先确认资料和付款安全再推进",
  ],
  emotionProfile: {
    currentEmotion: "谨慎且存在首单不安全感，但仍保持明确兴趣",
    emotionTrend: "从产品了解逐渐转向对批次一致性和付款保障的审慎核验",
    personalityTraits: ["证据导向", "风险敏感", "表达直接", "决策谨慎"],
    decisionStyle: "倾向先获得可验证资料和风险保障，再决定是否推进首单",
    sensitivities: ["答非所问", "不可核验的宣传", "首单付款风险", "文件与实物不一致"],
    psychologicalState: "从当前表达看，客户处于有兴趣但主动控制风险的审慎状态；并非拒绝，而是在等待足够证据降低首次合作的不确定性。",
    coreMotivations: ["降低首次采购风险", "确认交付可验证", "保留决策控制权"],
    trustNeeds: ["批次对应的真实文件", "清晰的付款保障边界", "直接回答具体问题"],
    defensePatterns: ["遇到模糊回答时继续追问", "关键信息不足时暂缓决策", "用具体问题检验可信度"],
    pressureResponse: "若被连续催促或收到泛泛宣传，可能降低信任并延后回应；提供可核验证据和清晰选择更容易推动其继续沟通。",
    evidence: [
      { messageId: "M00001", quote: "Is the COA from the same batch I will receive?", interpretation: "关注资料与实际交付的一致性，体现证据导向和风险敏感。" },
      { messageId: "M00003", quote: "What protection do I have for the first order?", interpretation: "首次合作仍有资金安全顾虑，需要明确保障边界。" },
    ],
    advice: ["先直接回答客户当前问题，再补充必要背景。", "用可核验资料和清晰边界降低不确定性，避免绝对承诺。", "每次只推进一个明确的下一步选择。"],
    confidence: 0.86,
  },
  stage: "产品与订单匹配",
  parallelStages: ["初次询盘与客户背调", "信任建立"],
  stageReason: "客户已越过初步询价，连续追问 COA、批次和付款保障，说明核心障碍已从需求转为风险判断。",
  objections: [
    {
      title: "担心质量文件与实物批次不一致",
      severity: "高",
      status: "未解决",
      evidence: "“Is the COA from the same batch I will receive?”",
      evidenceMessageId: "M00001",
      evidenceQuote: "Is the COA from the same batch I will receive?",
      resolutionEvidenceMessageId: "",
      resolutionEvidenceQuote: "",
      resolutionReason: "销售后续回复没有直接说明 COA 是否对应实际交付批次。",
      advice: "明确说明文件与批次的对应关系，并只提供可验证的资料。",
    },
    {
      title: "首次合作的付款安全顾虑",
      severity: "中",
      status: "未解决",
      evidence: "“What protection do I have for the first order?”",
      evidenceMessageId: "M00003",
      evidenceQuote: "What protection do I have for the first order?",
      resolutionEvidenceMessageId: "",
      resolutionEvidenceQuote: "",
      resolutionReason: "该问题之后没有销售回复，付款安全顾虑尚未解决。",
      advice: "先解释可用付款路径和流程，再约定一个低风险的首单方案。",
    },
  ],
  confirmations: demoConfirmations,
  improvements: [
    "上一轮回复介绍公司背景过多，没有直接回答批次对应问题。",
    "报价后没有用一个明确问题推动客户做下一步选择。",
  ],
  nextActions: [
    "先发送与拟交付批次相符的文件，并标注批次信息。",
    "询问客户希望先确认付款方式还是物流时效。",
    "若 24 小时未回复，用一句简短问题跟进，不重复整段介绍。",
  ],
  suggestedReply:
    "I understand why you want to verify this before a first order. The document we provide will be matched to the batch prepared for your order, and I can mark the batch details clearly for you. Would you prefer to confirm the payment option or the delivery timeline next?",
  suggestedReplyTranslation:
    "我理解您在首次下单前希望核实这一点。我们提供的文件会与为您订单准备的批次相对应，我也可以为您清楚标注批次信息。您希望下一步先确认付款方式，还是配送时效？",
  confidence: 0.88,
};

export const initialTasks: CustomerTask[] = [
  {
    id: "task-james",
    name: "James · 报价后信任异议",
    source: "salesmartly",
    status: "ready",
    updatedAt: "刚刚",
    customer: {
      name: "James Carter",
      country: "United States",
      company: "Northstar Research",
      owner: "Tina",
      product: "Product A",
      channel: "WhatsApp · SaleSmartly",
      lastMessageAt: "2026-08-30 10:42",
    },
    rawConversation:
      "Customer: Is the COA from the same batch I will receive?\nSales: We have many years of experience and strict quality control.\nCustomer: What protection do I have for the first order?",
    report: demoReport,
    progress: defaultProgress,
    provider: "openai",
    model: "GPT",
  },
  {
    id: "task-maria",
    name: "Maria · 首次询盘",
    source: "excel",
    status: "stale",
    updatedAt: "2 小时前",
    customer: {
      name: "Maria Silva",
      country: "Portugal",
      owner: "Tina",
      product: "Product B",
      channel: "Excel 导入",
      lastMessageAt: "2026-08-30 08:10",
    },
    rawConversation: "Customer: Could you send your catalog and MOQ?",
    report: { ...demoReport, stage: "初次询盘与客户背调", parallelStages: ["信任建立"], confidence: 0.79 },
    progress: defaultProgress.map((item, i) => ({ ...item, state: i === 0 ? "doing" : "todo", locked: false })),
    provider: "deepseek",
    model: "DeepSeek",
  },
  {
    id: "task-daniel",
    name: "Daniel · 等待付款",
    source: "text",
    status: "ready",
    updatedAt: "昨天",
    customer: {
      name: "Daniel Wong",
      country: "Singapore",
      owner: "Leo",
      product: "Product C",
      channel: "文本导入",
      lastMessageAt: "2026-08-29 16:30",
    },
    rawConversation: "Customer: I will arrange the payment tomorrow.",
    report: { ...demoReport, stage: "等待付款", parallelStages: [], confidence: 0.91 },
    progress: defaultProgress.map((item, i) => ({ ...item, state: i < 5 ? "done" : "doing" })),
    provider: "openai",
    model: "GPT",
  },
];
