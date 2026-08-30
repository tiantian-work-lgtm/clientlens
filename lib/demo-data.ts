import type { AnalysisReport, CustomerTask, ProgressItem } from "./types";

export const defaultProgress: ProgressItem[] = [
  { id: "need", label: "确认产品需求", state: "done", locked: true },
  { id: "spec", label: "确认规格与数量", state: "doing" },
  { id: "quote", label: "完成报价", state: "done", locked: true },
  { id: "trust", label: "解决质量与信任问题", state: "doing" },
  { id: "logistics", label: "确认物流方案", state: "todo" },
  { id: "payment", label: "确认付款方式", state: "todo" },
];

export const demoReport: AnalysisReport = {
  summary:
    "客户正在评估首批采购，已经确认目标产品并收到报价。目前兴趣明确，但在继续推进前希望确认质量文件、批次稳定性和付款保障。对话没有明确拒绝信号，重点应从重复介绍产品转向降低首次合作风险。",
  profile: ["专业买家", "中度价格敏感", "决策谨慎", "有采购意向", "偏好简洁沟通"],
  stage: "信任建立 / 异议处理",
  stageReason: "客户已越过初步询价，连续追问 COA、批次和付款保障，说明核心障碍已从需求转为风险判断。",
  objections: [
    {
      title: "担心质量文件与实物批次不一致",
      severity: "高",
      status: "处理中",
      evidence: "“Is the COA from the same batch I will receive?”",
      advice: "明确说明文件与批次的对应关系，并只提供可验证的资料。",
    },
    {
      title: "首次合作的付款安全顾虑",
      severity: "中",
      status: "待解决",
      evidence: "“What protection do I have for the first order?”",
      advice: "先解释可用付款路径和流程，再约定一个低风险的首单方案。",
    },
  ],
  confirmed: ["目标产品已经确认", "客户已经收到初步报价", "客户接受继续沟通"],
  unresolved: ["最终采购数量", "对应批次文件", "付款方式", "期望交付时间"],
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
    report: { ...demoReport, stage: "首次询盘 / 需求确认", confidence: 0.79 },
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
    report: { ...demoReport, stage: "等待付款", confidence: 0.91 },
    progress: defaultProgress.map((item, i) => ({ ...item, state: i < 5 ? "done" : "doing" })),
    provider: "openai",
    model: "GPT",
  },
];
