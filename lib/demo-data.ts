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
  { id: "education", category: "认知与经历", label: "是否需要基础知识科普", status: "unknown", evidence: "对话中尚未确认。", confidence: 0 },
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
  if (item.id === "seeding") return { ...item, status: "na", evidence: "客户已有明确目标产品。", confidence: 0.76 };
  if (item.id === "coa") return { ...item, status: "risk", evidence: "客户询问收到的产品是否对应同一批次 COA。", evidenceQuote: "Customer: Is the COA from the same batch I will receive?", riskReason: "客户尚未确认质量文件与实际交付批次一致，可能阻碍首次下单。", confidence: 0.96 };
  if (item.id === "payment_method") return { ...item, status: "risk", evidence: "客户询问首次订单可获得什么付款保障。", evidenceQuote: "Customer: What protection do I have for the first order?", riskReason: "客户对首次付款的资金安全缺乏信心，未解决前可能不会付款。", confidence: 0.95 };
  return { ...item };
});

export const emptyReport: AnalysisReport = {
  summary: "等待 AI 完成对话分析。",
  profile: [],
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
  profile: ["专业买家", "中度价格敏感", "决策谨慎", "有采购意向", "偏好简洁沟通"],
  stage: "产品与订单匹配",
  parallelStages: ["初次询盘与客户背调", "信任建立"],
  stageReason: "客户已越过初步询价，连续追问 COA、批次和付款保障，说明核心障碍已从需求转为风险判断。",
  objections: [
    {
      title: "担心质量文件与实物批次不一致",
      severity: "高",
      status: "处理中",
      evidence: "“Is the COA from the same batch I will receive?”",
      evidenceQuote: "Customer: Is the COA from the same batch I will receive?",
      advice: "明确说明文件与批次的对应关系，并只提供可验证的资料。",
    },
    {
      title: "首次合作的付款安全顾虑",
      severity: "中",
      status: "待解决",
      evidence: "“What protection do I have for the first order?”",
      evidenceQuote: "Customer: What protection do I have for the first order?",
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
