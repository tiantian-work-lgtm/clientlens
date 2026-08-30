export type SourceType = "salesmartly" | "text" | "excel";
export type TaskStatus = "ready" | "analyzing" | "stale" | "failed";
export type Provider = "openai" | "deepseek";
export type SalesStage =
  | "初次询盘与客户背调"
  | "信任建立"
  | "产品与订单匹配"
  | "决策推进"
  | "等待付款"
  | "已成交"
  | "售后与复购";
export type ConfirmationStatus = "confirmed" | "unknown" | "risk" | "na";

export interface Evidence {
  quote: string;
  time?: string;
}

export interface Objection {
  title: string;
  severity: "高" | "中" | "低";
  status: "待解决" | "处理中" | "已解决";
  evidence: string;
  advice: string;
}

export interface ConfirmationItem {
  id: string;
  category: "客户角色" | "认知与经历" | "产品与信任" | "交易条件";
  label: string;
  status: ConfirmationStatus;
  evidence: string;
  confidence: number;
}

export interface AnalysisReport {
  summary: string;
  profile: string[];
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
  updatedAt: string;
  customer: {
    name: string;
    country: string;
    company?: string;
    owner: string;
    product: string;
    channel: string;
    lastMessageAt: string;
  };
  rawConversation: string;
  report: AnalysisReport;
  progress: ProgressItem[];
  provider: Provider;
  model: string;
}
