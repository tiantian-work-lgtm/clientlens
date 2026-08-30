export type SourceType = "salesmartly" | "text" | "excel";
export type TaskStatus = "ready" | "analyzing" | "stale" | "failed";
export type Provider = "openai" | "deepseek";

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

export interface AnalysisReport {
  summary: string;
  profile: string[];
  stage: string;
  stageReason: string;
  objections: Objection[];
  confirmed: string[];
  unresolved: string[];
  improvements: string[];
  nextActions: string[];
  suggestedReply: string;
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
