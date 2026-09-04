"use client";

import {
  Archive,
  ArrowUp,
  ArrowLeftRight,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleDashed,
  Cloud,
  Copy,
  Database,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Languages,
  Link2,
  ListChecks,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { defaultConfirmations, defaultProgress, emptyReport, initialTasks } from "@/lib/demo-data";
import { parseConversationMessages } from "@/lib/conversation";
import type { AnalysisModule, AnalysisModuleStatus, BuyingDriver, CommunicationImprovement, CommunicationTrait, CustomerTask, DealBlocker, DealDecisionMap, DefensePoint, EmotionEvidence, EmotionTurningPoint, ImportPreview, KnowledgeScript, KnowledgeScriptReference, OffensePoint, ProductMention, Provider, SourceType } from "@/lib/types";
import SettingsManager from "@/app/components/settings-manager";
import dynamic from "next/dynamic";

const ScriptMindMap = dynamic(() => import("@/app/components/script-mind-map"), { ssr: false, loading: () => <div className="knowledge-empty">正在加载思维导图…</div> });

type View = "analysis" | "scripts" | "products" | "translate" | "settings";
type ImportStep = "source" | SourceType;

const navItems = [
  { id: "analysis" as View, label: "客户分析台", icon: UsersRound },
  { id: "scripts" as View, label: "话术库", icon: BookOpen },
  { id: "products" as View, label: "产品知识库", icon: FlaskConical },
  { id: "translate" as View, label: "AI 翻译", icon: Languages },
  { id: "settings" as View, label: "系统设置", icon: Settings },
];

const sourceMeta: Record<SourceType, { label: string; icon: typeof Cloud; color: string }> = {
  salesmartly: { label: "SaleSmartly", icon: Cloud, color: "blue" },
  text: { label: "文本", icon: FileText, color: "amber" },
  excel: { label: "Excel", icon: FileSpreadsheet, color: "green" },
};

function customerDisplayName(customer: { name: string; remark?: string }) {
  const name = customer.name.trim() || "未命名客户";
  const remark = customer.remark?.trim();
  if (!remark || remark.localeCompare(name, undefined, { sensitivity: "accent" }) === 0) return name;
  return `${name}（${remark}）`;
}

function taskConversationCount(task: CustomerTask) {
  const parsed = parseConversationMessages(task.rawConversation).length;
  return parsed || task.rawConversation.split("\n").filter((line) => line.trim()).length;
}

type ReportSectionId = "summary" | "profile" | "psychology" | "objections" | "checklist" | "improvements" | "next-actions";
const ReportCollapseContext = createContext<{ collapsed: Record<string, boolean>; toggle: (id: ReportSectionId) => void }>({ collapsed: {}, toggle: () => undefined });

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  if (typeof value === "string" && value.trim()) return value.split(/[，,；;\n]/).map((item) => item.trim()).filter(Boolean);
  return [...fallback];
}

function confidenceLabel(score: number) {
  if (score >= 0.8) return "高可信";
  if (score >= 0.6) return "中等可信";
  if (score > 0) return "低可信";
  return "待分析";
}

function normalizeEvidenceQuote(value: unknown, conversation: string) {
  const candidate = stringValue(value).replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "").trim();
  if (candidate.length < 4) return "";
  const normalize = (text: string) => text.normalize("NFKC").replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLocaleLowerCase();
  return normalize(conversation).includes(normalize(candidate)) ? candidate : "";
}

function isPlaceholderObjectionTitle(value: string) {
  return /^(?:待确认|待核对|需要人工核对(?:的潜在)?)?\s*异议\s*\d*$/i.test(value.trim());
}

function objectionStatusClass(status: CustomerTask["report"]["objections"][number]["status"]) {
  if (status === "客户肯定-完全解决") return "complete";
  if (status === "未追问-基本解决") return "basic";
  return "unresolved";
}

function normalizeReport(value: unknown, conversation = ""): CustomerTask["report"] {
  const report = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const profile = stringList(report.profile);
  const rawObjections = Array.isArray(report.objections) ? report.objections : [];
  const parsedMessages = parseConversationMessages(conversation);
  const messageById = new Map(parsedMessages.map((message) => [message.id, message]));
  const rawEmotionProfile = report.emotionProfile && typeof report.emotionProfile === "object" && !Array.isArray(report.emotionProfile) ? report.emotionProfile as Record<string, unknown> : {};
  const normalizeEmotionEvidence = (value: unknown, limit = 5): EmotionEvidence[] => (Array.isArray(value) ? value : []).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const message = messageById.get(stringValue(item.messageId));
    if (!message || message.role !== "customer") return [];
    const quote = normalizeEvidenceQuote(item.quote, conversation);
    if (!quote || !message.content.normalize("NFKC").includes(quote.normalize("NFKC"))) return [];
    return [{ messageId: message.id, quote, translation: stringValue(item.translation), interpretation: stringValue(item.interpretation, "该原文支持当前沟通判断。") }];
  }).slice(0, limit);
  const legacyEvidence = normalizeEmotionEvidence(rawEmotionProfile.evidence);
  const currentStateEvidence = normalizeEmotionEvidence(rawEmotionProfile.currentStateEvidence, 3);
  const turningPoints: EmotionTurningPoint[] = (Array.isArray(rawEmotionProfile.emotionTurningPoints) ? rawEmotionProfile.emotionTurningPoints : []).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const evidence = normalizeEmotionEvidence([item], 1)[0];
    if (!evidence) return [];
    const score = Number(item.score);
    return [{ ...evidence, label: stringValue(item.label, "情绪变化"), score: Number.isFinite(score) ? Math.min(2, Math.max(-2, score)) : 0, reason: stringValue(item.reason, evidence.interpretation) }];
  }).slice(0, 8);
  const personalityTraits: CommunicationTrait[] = (Array.isArray(rawEmotionProfile.personalityTraits) ? rawEmotionProfile.personalityTraits : []).flatMap((value) => {
    if (typeof value === "string" && value.trim()) return [{ trait: value.trim(), explanation: "根据当前聊天呈现出的沟通倾向。", evidence: legacyEvidence.slice(0, 1) }];
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const trait = stringValue(item.trait);
    if (!trait) return [];
    return [{ trait, explanation: stringValue(item.explanation, "根据当前聊天呈现出的沟通倾向。"), evidence: normalizeEmotionEvidence(item.evidence, 3) }];
  }).slice(0, 5);
  const emotionConfidence = Number(rawEmotionProfile.confidence);
  const emotionProfile: CustomerTask["report"]["emotionProfile"] = {
    currentState: stringValue(rawEmotionProfile.currentState, [stringValue(rawEmotionProfile.currentEmotion), stringValue(rawEmotionProfile.psychologicalState)].filter(Boolean).join("；") || "信息不足，暂无法判断当前情绪和心理状态"),
    currentStateEvidence: currentStateEvidence.length ? currentStateEvidence : legacyEvidence.slice(0, 3),
    emotionTurningPoints: turningPoints,
    personalityTraits: personalityTraits.length ? personalityTraits : [{ trait: "信息不足", explanation: "当前对话不足以形成明确的沟通性格倾向。", evidence: [] }],
    personalitySummary: stringValue(rawEmotionProfile.personalitySummary, personalityTraits.map((item) => item.trait).join("、") || "当前信息不足以概括沟通性格倾向。"),
    decisionStyle: stringValue(rawEmotionProfile.decisionStyle, "信息不足，暂无法判断决策方式"),
    decisionFactors: stringList(rawEmotionProfile.decisionFactors, stringList(rawEmotionProfile.coreMotivations)).slice(0, 5),
    decisionPace: stringValue(rawEmotionProfile.decisionPace, stringValue(rawEmotionProfile.pressureResponse, "信息不足")),
    communicationApproach: stringValue(rawEmotionProfile.communicationApproach, "先确认客户最看重的决策条件，再提供对应信息。"),
    decisionEvidence: normalizeEmotionEvidence(rawEmotionProfile.decisionEvidence, 4).length ? normalizeEmotionEvidence(rawEmotionProfile.decisionEvidence, 4) : legacyEvidence.slice(0, 4),
    confidence: Number.isFinite(emotionConfidence) ? Math.min(1, Math.max(0, emotionConfidence)) : 0,
  };
  const rawProductMentions = Array.isArray(report.productMentions) ? report.productMentions : [];
  const productMentions: CustomerTask["report"]["productMentions"] = rawProductMentions.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const message = messageById.get(stringValue(item.evidenceMessageId));
    const quote = normalizeEvidenceQuote(item.evidenceQuote, conversation);
    const name = stringValue(item.name);
    if (!name || !message || !quote || !message.content.normalize("NFKC").includes(quote.normalize("NFKC"))) return [];
    const mentionedBy: ProductMention["mentionedBy"] = item.mentionedBy === "客户" || item.mentionedBy === "双方" ? item.mentionedBy : "销售";
    const customerAwareness: ProductMention["customerAwareness"] = item.customerAwareness === "不了解" || item.customerAwareness === "初步了解" || item.customerAwareness === "有使用经验" || item.customerAwareness === "明确熟悉" ? item.customerAwareness : "无法判断";
    const customerInterest: ProductMention["customerInterest"] = item.customerInterest === "明确感兴趣" || item.customerInterest === "可能感兴趣" || item.customerInterest === "未表现兴趣" || item.customerInterest === "明确拒绝" ? item.customerInterest : "无法判断";
    return [{
      name,
      mentionedBy, customerAwareness, customerInterest,
      awarenessReason: stringValue(item.awarenessReason, "当前对话不足以判断客户对该产品的了解程度。"),
      evidenceMessageId: message.id, evidenceQuote: quote,
    }];
  }).filter((item, index, items) => items.findIndex((candidate) => candidate.name.toLocaleLowerCase() === item.name.toLocaleLowerCase()) === index);
  const objections = rawObjections.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const requestedMessageId = stringValue(item.evidenceMessageId);
    const evidenceMessage = messageById.get(requestedMessageId);
    const title = stringValue(item.title);
    if (!title || isPlaceholderObjectionTitle(title)) return [];
    const evidenceQuote = evidenceMessage?.content || normalizeEvidenceQuote(item.evidenceQuote, conversation) || normalizeEvidenceQuote(item.evidence, conversation);
    const severity: "高" | "中" | "低" = item.severity === "高" || item.severity === "中" || item.severity === "低" ? item.severity : "中";
    const rawStatus = stringValue(item.status);
    const requestedStatus: CustomerTask["report"]["objections"][number]["status"] = rawStatus === "客户肯定-完全解决"
      ? "客户肯定-完全解决"
      : rawStatus === "未追问-基本解决" || rawStatus === "已解决"
        ? "未追问-基本解决"
        : "未解决";
    const issueIndex = parsedMessages.findIndex((message) => message.id === evidenceMessage?.id);
    const resolutionMessage = messageById.get(stringValue(item.resolutionEvidenceMessageId));
    const resolutionIndex = parsedMessages.findIndex((message) => message.id === resolutionMessage?.id);
    const hasSalesAnswerBeforeResolution = parsedMessages.slice(issueIndex + 1, resolutionIndex).some((message) => message.role === "sales");
    const resolutionValid = requestedStatus === "未解决"
      || (requestedStatus === "未追问-基本解决" && issueIndex >= 0 && resolutionIndex > issueIndex && resolutionMessage?.role === "sales")
      || (requestedStatus === "客户肯定-完全解决" && issueIndex >= 0 && resolutionIndex > issueIndex && resolutionMessage?.role === "customer" && hasSalesAnswerBeforeResolution);
    const status = resolutionValid ? requestedStatus : "未解决";
    return [{
      title,
      severity,
      status,
      evidence: stringValue(item.evidence, "AI 识别到潜在犹豫点，具体依据需要人工核对。"),
      evidenceQuote,
      evidenceMessageId: evidenceMessage?.id || "",
      evidenceVerified: Boolean(evidenceMessage || evidenceQuote),
      resolutionEvidenceMessageId: status === "未解决" ? "" : resolutionMessage?.id || "",
      resolutionEvidenceQuote: status === "未解决" ? "" : resolutionMessage?.content || "",
      resolutionReason: status !== requestedStatus
        ? "原解决状态缺少符合消息顺序要求的证据，已降级为未解决。"
        : stringValue(item.resolutionReason, status === "未解决" ? "尚未找到符合消息顺序要求的解决证据。" : "已按消息顺序核验解决状态。"),
      advice: stringValue(item.advice, "需要结合原始对话进一步确认。"),
    }];
  });
  const offenseGoals: OffensePoint["goal"][] = ["引导需求", "建立信任", "产品匹配", "促成试单", "推动付款", "推动复购", "其他"];
  const offensePoints: OffensePoint[] = (Array.isArray(report.offensePoints) ? report.offensePoints : []).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const message = messageById.get(stringValue(item.evidenceMessageId));
    const evidenceQuote = normalizeEvidenceQuote(item.evidenceQuote, conversation);
    const title = stringValue(item.title);
    if (!title || !message || !evidenceQuote || !message.content.normalize("NFKC").includes(evidenceQuote.normalize("NFKC"))) return [];
    if (message.role !== "customer" && /客户(?:需要|希望|关注|认可|同意|感兴趣|愿意|决定)/.test(`${stringValue(item.opportunity)}${stringValue(item.timingReason)}`)) return [];
    const priority: OffensePoint["priority"] = item.priority === "高" || item.priority === "低" ? item.priority : "中";
    const goal = offenseGoals.includes(item.goal as OffensePoint["goal"]) ? item.goal as OffensePoint["goal"] : "其他";
    return [{ title, opportunity: stringValue(item.opportunity), timingReason: stringValue(item.timingReason), evidenceMessageId: message.id, evidenceQuote, evidenceTranslation: stringValue(item.evidenceTranslation), direction: stringValue(item.direction), suggestedReply: stringValue(item.suggestedReply), suggestedReplyTranslation: stringValue(item.suggestedReplyTranslation), priority, goal }];
  });
  const defensePoints: DefensePoint[] = (Array.isArray(report.defensePoints) ? report.defensePoints : []).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const message = messageById.get(stringValue(item.evidenceMessageId));
    const evidenceQuote = normalizeEvidenceQuote(item.evidenceQuote, conversation);
    const title = stringValue(item.title);
    if (!title || !message || !evidenceQuote || !message.content.normalize("NFKC").includes(evidenceQuote.normalize("NFKC"))) return [];
    if (message.role !== "customer" && /客户(?:担心|质疑|不信任|不满|拒绝|犹豫|认可|肯定)/.test(`${title}${stringValue(item.risk)}${stringValue(item.reason)}`)) return [];
    const riskLevel: DefensePoint["riskLevel"] = item.riskLevel === "高" || item.riskLevel === "低" ? item.riskLevel : "中";
    const status: DefensePoint["status"] = item.status === "客户肯定-完全解决" || item.status === "未追问-基本解决" ? item.status : "未解决";
    return [{ title, risk: stringValue(item.risk), reason: stringValue(item.reason), evidenceMessageId: message.id, evidenceQuote, evidenceTranslation: stringValue(item.evidenceTranslation), status, remedy: stringValue(item.remedy), suggestedReply: stringValue(item.suggestedReply), suggestedReplyTranslation: stringValue(item.suggestedReplyTranslation), riskLevel }];
  });
  const rawDecisionMap = report.decisionMap && typeof report.decisionMap === "object" && !Array.isArray(report.decisionMap) ? report.decisionMap as Record<string, unknown> : {};
  const rawDrivers = Array.isArray(rawDecisionMap.buyingDrivers) ? rawDecisionMap.buyingDrivers : [];
  const buyingDrivers: BuyingDriver[] = rawDrivers.flatMap((value): BuyingDriver[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const message = messageById.get(stringValue(item.evidenceMessageId));
    const quote = normalizeEvidenceQuote(item.evidenceQuote, conversation);
    const title = stringValue(item.title);
    if (!title || message?.role !== "customer" || !quote || !message.content.normalize("NFKC").includes(quote.normalize("NFKC"))) return [];
    const strength: BuyingDriver["strength"] = item.strength === "强" || item.strength === "弱" ? item.strength : "中";
    const purchaseIntent: BuyingDriver["purchaseIntent"] = item.purchaseIntent === "明确" || item.purchaseIntent === "较高" ? item.purchaseIntent : "观察中";
    return [{ title, desiredOutcome: stringValue(item.desiredOutcome), painOrExpectation: stringValue(item.painOrExpectation), strength, purchaseIntent, conversionReason: stringValue(item.conversionReason), evidenceMessageId: message.id, evidenceQuote: quote, evidenceTranslation: stringValue(item.evidenceTranslation) }];
  }).slice(0, 3);
  const blockerCategories: DealBlocker["category"][] = ["产品匹配", "产品知识", "价格与预算", "质量与COA", "公司与供应商信任", "包装与交付", "物流清关与时效", "支付与资金安全", "决策时机", "内部审批", "其他顾虑"];
  const rawBlockers = Array.isArray(rawDecisionMap.blockers) ? rawDecisionMap.blockers : [];
  const blockers: DealBlocker[] = rawBlockers.flatMap((value): DealBlocker[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const customerMessage = messageById.get(stringValue(item.evidenceMessageId));
    const customerQuote = normalizeEvidenceQuote(item.evidenceQuote, conversation);
    const title = stringValue(item.title);
    if (!title || customerMessage?.role !== "customer" || !customerQuote || !customerMessage.content.normalize("NFKC").includes(customerQuote.normalize("NFKC"))) return [];
    const salesMessage = messageById.get(stringValue(item.salesEvidenceMessageId));
    const salesQuote = salesMessage?.role === "sales" ? normalizeEvidenceQuote(item.salesEvidenceQuote, conversation) : "";
    const resolutionMessage = messageById.get(stringValue(item.resolutionEvidenceMessageId));
    const resolutionQuote = resolutionMessage?.role === "customer" ? normalizeEvidenceQuote(item.resolutionEvidenceQuote, conversation) : "";
    const issueIndex = parsedMessages.findIndex((message) => message.id === customerMessage.id);
    const salesIndex = parsedMessages.findIndex((message) => message.id === salesMessage?.id);
    const resolutionIndex = parsedMessages.findIndex((message) => message.id === resolutionMessage?.id);
    const requestedStatus: DealBlocker["handlingStatus"] = item.handlingStatus === "客户明确认可" || item.handlingStatus === "已回答-客户未追问" ? item.handlingStatus : "未解决";
    const salesAfterIssue = Boolean(salesQuote && salesIndex > issueIndex);
    const resolutionAfterSales = Boolean(resolutionQuote && resolutionIndex > salesIndex);
    const handlingStatus: DealBlocker["handlingStatus"] = requestedStatus === "已回答-客户未追问" && salesAfterIssue
      ? requestedStatus
      : requestedStatus === "客户明确认可" && salesAfterIssue && resolutionAfterSales
        ? requestedStatus
        : "未解决";
    return [{
      title,
      category: blockerCategories.includes(item.category as DealBlocker["category"]) ? item.category as DealBlocker["category"] : "其他顾虑",
      concern: stringValue(item.concern),
      dealImpact: stringValue(item.dealImpact),
      evidenceMessageId: customerMessage.id,
      evidenceQuote: customerQuote,
      evidenceTranslation: stringValue(item.evidenceTranslation),
      handlingStatus,
      salesEvidenceMessageId: handlingStatus === "未解决" ? "" : salesMessage?.id || "",
      salesEvidenceQuote: handlingStatus === "未解决" ? "" : salesQuote,
      salesEvidenceTranslation: handlingStatus === "未解决" ? "" : stringValue(item.salesEvidenceTranslation),
      resolutionEvidenceMessageId: handlingStatus === "客户明确认可" ? resolutionMessage?.id || "" : "",
      resolutionEvidenceQuote: handlingStatus === "客户明确认可" ? resolutionQuote : "",
      resolutionEvidenceTranslation: handlingStatus === "客户明确认可" ? stringValue(item.resolutionEvidenceTranslation) : "",
      solutionDirection: stringValue(item.solutionDirection),
    }];
  }).slice(0, 8);
  const requestedBiggestBlocker = stringValue(rawDecisionMap.biggestBlocker);
  const verifiedBiggestBlocker = blockers.find((item) => item.title.normalize("NFKC") === requestedBiggestBlocker.normalize("NFKC"))?.title;
  const decisionMap: DealDecisionMap = {
    motivationLevel: buyingDrivers.length ? rawDecisionMap.motivationLevel === "强" || rawDecisionMap.motivationLevel === "弱" ? rawDecisionMap.motivationLevel : "中" : "弱",
    biggestBlocker: verifiedBiggestBlocker || blockers[0]?.title || "当前未识别到明确成交阻力",
    readiness: buyingDrivers.length ? rawDecisionMap.readiness === "高" || rawDecisionMap.readiness === "低" ? rawDecisionMap.readiness : "中" : "低",
    priorityTask: stringValue(rawDecisionMap.priorityTask, "继续确认客户当前最重要的决策条件。"),
    buyingDrivers,
    blockers,
  };
  const rawConfirmations = Array.isArray(report.confirmations) ? report.confirmations : [];
  const confirmations = defaultConfirmations.map((fallback) => {
    const raw = rawConfirmations.find((value) => value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).id === fallback.id);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...fallback };
    const item = raw as Record<string, unknown>;
    const requestedStatus = item.status === "confirmed" || item.status === "unknown" || item.status === "risk" || item.status === "na" ? item.status : fallback.status;
    const confidence = Number(item.confidence);
    const requestedMessageId = stringValue(item.evidenceMessageId);
    const evidenceMessage = messageById.get(requestedMessageId);
    const evidenceQuote = evidenceMessage?.content || normalizeEvidenceQuote(item.evidenceQuote, conversation);
    const status = requestedStatus === "risk" && !evidenceMessage && !evidenceQuote ? "unknown" : requestedStatus;
    const evidence = requestedStatus === "risk" && !evidenceQuote ? fallback.evidence : stringValue(item.evidence, fallback.evidence);
    return {
      ...fallback,
      status,
      evidence,
      evidenceQuote,
      evidenceMessageId: evidenceMessage?.id || "",
      riskReason: status === "risk" ? stringValue(item.riskReason, evidence) : "",
      seedingNeed: item.id === "seeding" && (item.seedingNeed === "需要种草" || item.seedingNeed === "无需种草") ? item.seedingNeed : fallback.seedingNeed,
      seedingDirection: item.id === "seeding" ? stringValue(item.seedingDirection, fallback.seedingDirection || "") : "",
      seedingPerformed: item.id === "seeding" && (item.seedingPerformed === "已种草" || item.seedingPerformed === "尚未种草" || item.seedingPerformed === "未确认") ? item.seedingPerformed : fallback.seedingPerformed,
      seedingPerformedEvidenceMessageId: item.id === "seeding" ? stringValue(item.seedingPerformedEvidenceMessageId) : "",
      seedingPerformedEvidenceQuote: item.id === "seeding" ? normalizeEvidenceQuote(item.seedingPerformedEvidenceQuote, conversation) : "",
      seedingAccepted: item.id === "seeding" && (item.seedingAccepted === "客户明确肯定" || item.seedingAccepted === "客户未明确肯定" || item.seedingAccepted === "未确认") ? item.seedingAccepted : fallback.seedingAccepted,
      seedingAcceptanceEvidenceMessageId: item.id === "seeding" ? stringValue(item.seedingAcceptanceEvidenceMessageId) : "",
      seedingAcceptanceEvidenceQuote: item.id === "seeding" ? normalizeEvidenceQuote(item.seedingAcceptanceEvidenceQuote, conversation) : "",
      seedingAdvice: item.id === "seeding" ? stringValue(item.seedingAdvice, fallback.seedingAdvice || "") : "",
      medicalNeed: item.id === "medical" && (item.medicalNeed === "需要提供建议" || item.medicalNeed === "无需提供建议") ? item.medicalNeed : fallback.medicalNeed,
      medicalDirection: item.id === "medical" ? stringValue(item.medicalDirection, fallback.medicalDirection || "") : "",
      medicalAnswered: item.id === "medical" && (item.medicalAnswered === "已解答" || item.medicalAnswered === "尚未解答" || item.medicalAnswered === "未确认") ? item.medicalAnswered : fallback.medicalAnswered,
      medicalAnswerEvidenceMessageId: item.id === "medical" ? stringValue(item.medicalAnswerEvidenceMessageId) : "",
      medicalAnswerEvidenceQuote: item.id === "medical" ? normalizeEvidenceQuote(item.medicalAnswerEvidenceQuote, conversation) : "",
      medicalAccepted: item.id === "medical" && (item.medicalAccepted === "客户明确肯定" || item.medicalAccepted === "客户未明确肯定" || item.medicalAccepted === "未确认") ? item.medicalAccepted : fallback.medicalAccepted,
      medicalAcceptanceEvidenceMessageId: item.id === "medical" ? stringValue(item.medicalAcceptanceEvidenceMessageId) : "",
      medicalAcceptanceEvidenceQuote: item.id === "medical" ? normalizeEvidenceQuote(item.medicalAcceptanceEvidenceQuote, conversation) : "",
      medicalAdvice: item.id === "medical" ? stringValue(item.medicalAdvice, fallback.medicalAdvice || "") : "",
      scamExperienceStatus: item.id === "scammed" && (item.scamExperienceStatus === "有被骗经历" || item.scamExperienceStatus === "无被骗经历") ? item.scamExperienceStatus : fallback.scamExperienceStatus,
      scamExperienceSummary: item.id === "scammed" ? stringValue(item.scamExperienceSummary, fallback.scamExperienceSummary || "") : "",
      scamAddressed: item.id === "scammed" && (item.scamAddressed === "已回应" || item.scamAddressed === "尚未回应" || item.scamAddressed === "未确认") ? item.scamAddressed : fallback.scamAddressed,
      scamResponseEvidenceMessageId: item.id === "scammed" ? stringValue(item.scamResponseEvidenceMessageId) : "",
      scamResponseEvidenceQuote: item.id === "scammed" ? normalizeEvidenceQuote(item.scamResponseEvidenceQuote, conversation) : "",
      scamAccepted: item.id === "scammed" && (item.scamAccepted === "客户明确肯定" || item.scamAccepted === "客户未明确肯定" || item.scamAccepted === "未确认") ? item.scamAccepted : fallback.scamAccepted,
      scamAcceptanceEvidenceMessageId: item.id === "scammed" ? stringValue(item.scamAcceptanceEvidenceMessageId) : "",
      scamAcceptanceEvidenceQuote: item.id === "scammed" ? normalizeEvidenceQuote(item.scamAcceptanceEvidenceQuote, conversation) : "",
      scamAdvice: item.id === "scammed" ? stringValue(item.scamAdvice, fallback.scamAdvice || "") : "",
      coaMentionSource: item.id === "coa" && (item.coaMentionSource === "客户主动询问" || item.coaMentionSource === "销售主动提出" || item.coaMentionSource === "未提及") ? item.coaMentionSource : fallback.coaMentionSource,
      coaMentionEvidenceMessageId: item.id === "coa" ? stringValue(item.coaMentionEvidenceMessageId) : "",
      coaMentionEvidenceQuote: item.id === "coa" ? normalizeEvidenceQuote(item.coaMentionEvidenceQuote, conversation) : "",
      coaExplained: item.id === "coa" && (item.coaExplained === "已说明" || item.coaExplained === "尚未说明" || item.coaExplained === "未确认") ? item.coaExplained : fallback.coaExplained,
      coaExplanationEvidenceMessageId: item.id === "coa" ? stringValue(item.coaExplanationEvidenceMessageId) : "",
      coaExplanationEvidenceQuote: item.id === "coa" ? normalizeEvidenceQuote(item.coaExplanationEvidenceQuote, conversation) : "",
      coaAccepted: item.id === "coa" && (item.coaAccepted === "客户明确肯定" || item.coaAccepted === "客户未明确肯定" || item.coaAccepted === "未确认") ? item.coaAccepted : fallback.coaAccepted,
      coaAcceptanceEvidenceMessageId: item.id === "coa" ? stringValue(item.coaAcceptanceEvidenceMessageId) : "",
      coaAcceptanceEvidenceQuote: item.id === "coa" ? normalizeEvidenceQuote(item.coaAcceptanceEvidenceQuote, conversation) : "",
      coaAdvice: item.id === "coa" ? stringValue(item.coaAdvice, fallback.coaAdvice || "") : "",
      packagingMentionSource: item.id === "packaging" && (item.packagingMentionSource === "客户主动询问" || item.packagingMentionSource === "销售主动提出" || item.packagingMentionSource === "未提及") ? item.packagingMentionSource : fallback.packagingMentionSource,
      packagingMentionEvidenceMessageId: item.id === "packaging" ? stringValue(item.packagingMentionEvidenceMessageId) : "",
      packagingMentionEvidenceQuote: item.id === "packaging" ? normalizeEvidenceQuote(item.packagingMentionEvidenceQuote, conversation) : "",
      packagingExplained: item.id === "packaging" && (item.packagingExplained === "已说明" || item.packagingExplained === "尚未说明" || item.packagingExplained === "未确认") ? item.packagingExplained : fallback.packagingExplained,
      packagingExplanationEvidenceMessageId: item.id === "packaging" ? stringValue(item.packagingExplanationEvidenceMessageId) : "",
      packagingExplanationEvidenceQuote: item.id === "packaging" ? normalizeEvidenceQuote(item.packagingExplanationEvidenceQuote, conversation) : "",
      packagingAccepted: item.id === "packaging" && (item.packagingAccepted === "客户明确肯定" || item.packagingAccepted === "客户未明确肯定" || item.packagingAccepted === "未确认") ? item.packagingAccepted : fallback.packagingAccepted,
      packagingAcceptanceEvidenceMessageId: item.id === "packaging" ? stringValue(item.packagingAcceptanceEvidenceMessageId) : "",
      packagingAcceptanceEvidenceQuote: item.id === "packaging" ? normalizeEvidenceQuote(item.packagingAcceptanceEvidenceQuote, conversation) : "",
      packagingAdvice: item.id === "packaging" ? stringValue(item.packagingAdvice, fallback.packagingAdvice || "") : "",
      companyMentionSource: item.id === "company" && (item.companyMentionSource === "客户主动询问" || item.companyMentionSource === "销售主动提出" || item.companyMentionSource === "未提及") ? item.companyMentionSource : fallback.companyMentionSource,
      companyMentionEvidenceMessageId: item.id === "company" ? stringValue(item.companyMentionEvidenceMessageId) : "",
      companyMentionEvidenceQuote: item.id === "company" ? normalizeEvidenceQuote(item.companyMentionEvidenceQuote, conversation) : "",
      companyExplained: item.id === "company" && (item.companyExplained === "已说明" || item.companyExplained === "尚未说明" || item.companyExplained === "未确认") ? item.companyExplained : fallback.companyExplained,
      companyExplanationEvidenceMessageId: item.id === "company" ? stringValue(item.companyExplanationEvidenceMessageId) : "",
      companyExplanationEvidenceQuote: item.id === "company" ? normalizeEvidenceQuote(item.companyExplanationEvidenceQuote, conversation) : "",
      companyAccepted: item.id === "company" && (item.companyAccepted === "客户明确肯定" || item.companyAccepted === "客户未明确肯定" || item.companyAccepted === "未确认") ? item.companyAccepted : fallback.companyAccepted,
      companyAcceptanceEvidenceMessageId: item.id === "company" ? stringValue(item.companyAcceptanceEvidenceMessageId) : "",
      companyAcceptanceEvidenceQuote: item.id === "company" ? normalizeEvidenceQuote(item.companyAcceptanceEvidenceQuote, conversation) : "",
      companyAdvice: item.id === "company" ? stringValue(item.companyAdvice, fallback.companyAdvice || "") : "",
      feedbackMentionSource: item.id === "feedback" && (item.feedbackMentionSource === "客户主动询问" || item.feedbackMentionSource === "销售主动提出" || item.feedbackMentionSource === "未提及") ? item.feedbackMentionSource : fallback.feedbackMentionSource,
      feedbackMentionEvidenceMessageId: item.id === "feedback" ? stringValue(item.feedbackMentionEvidenceMessageId) : "",
      feedbackMentionEvidenceQuote: item.id === "feedback" ? normalizeEvidenceQuote(item.feedbackMentionEvidenceQuote, conversation) : "",
      feedbackAnswered: item.id === "feedback" && (item.feedbackAnswered === "已解答" || item.feedbackAnswered === "尚未解答" || item.feedbackAnswered === "未确认") ? item.feedbackAnswered : fallback.feedbackAnswered,
      feedbackAnswerEvidenceMessageId: item.id === "feedback" ? stringValue(item.feedbackAnswerEvidenceMessageId) : "",
      feedbackAnswerEvidenceQuote: item.id === "feedback" ? normalizeEvidenceQuote(item.feedbackAnswerEvidenceQuote, conversation) : "",
      feedbackAccepted: item.id === "feedback" && (item.feedbackAccepted === "客户明确肯定" || item.feedbackAccepted === "客户未明确肯定" || item.feedbackAccepted === "未确认") ? item.feedbackAccepted : fallback.feedbackAccepted,
      feedbackAcceptanceEvidenceMessageId: item.id === "feedback" ? stringValue(item.feedbackAcceptanceEvidenceMessageId) : "",
      feedbackAcceptanceEvidenceQuote: item.id === "feedback" ? normalizeEvidenceQuote(item.feedbackAcceptanceEvidenceQuote, conversation) : "",
      feedbackAdvice: item.id === "feedback" ? stringValue(item.feedbackAdvice, fallback.feedbackAdvice || "") : "",
      logisticsMentionSource: item.id === "logistics" && (item.logisticsMentionSource === "客户主动询问" || item.logisticsMentionSource === "销售主动提出" || item.logisticsMentionSource === "未提及") ? item.logisticsMentionSource : fallback.logisticsMentionSource,
      logisticsMentionEvidenceMessageId: item.id === "logistics" ? stringValue(item.logisticsMentionEvidenceMessageId) : "",
      logisticsMentionEvidenceQuote: item.id === "logistics" ? normalizeEvidenceQuote(item.logisticsMentionEvidenceQuote, conversation) : "",
      logisticsAnswered: item.id === "logistics" && (item.logisticsAnswered === "已解答" || item.logisticsAnswered === "尚未解答" || item.logisticsAnswered === "未确认") ? item.logisticsAnswered : fallback.logisticsAnswered,
      logisticsAnswerEvidenceMessageId: item.id === "logistics" ? stringValue(item.logisticsAnswerEvidenceMessageId) : "",
      logisticsAnswerEvidenceQuote: item.id === "logistics" ? normalizeEvidenceQuote(item.logisticsAnswerEvidenceQuote, conversation) : "",
      logisticsCustomerReaction: item.id === "logistics" && (item.logisticsCustomerReaction === "客户满意" || item.logisticsCustomerReaction === "存在异议" || item.logisticsCustomerReaction === "客户未明确表态" || item.logisticsCustomerReaction === "未确认") ? item.logisticsCustomerReaction : fallback.logisticsCustomerReaction,
      logisticsReactionEvidenceMessageId: item.id === "logistics" ? stringValue(item.logisticsReactionEvidenceMessageId) : "",
      logisticsReactionEvidenceQuote: item.id === "logistics" ? normalizeEvidenceQuote(item.logisticsReactionEvidenceQuote, conversation) : "",
      logisticsAdvice: item.id === "logistics" ? stringValue(item.logisticsAdvice, fallback.logisticsAdvice || "") : "",
      paymentMentionSource: item.id === "payment_method" && (item.paymentMentionSource === "客户主动询问" || item.paymentMentionSource === "销售主动提出" || item.paymentMentionSource === "未提及") ? item.paymentMentionSource : fallback.paymentMentionSource,
      paymentMentionEvidenceMessageId: item.id === "payment_method" ? stringValue(item.paymentMentionEvidenceMessageId) : "",
      paymentMentionEvidenceQuote: item.id === "payment_method" ? normalizeEvidenceQuote(item.paymentMentionEvidenceQuote, conversation) : "",
      paymentCustomerReaction: item.id === "payment_method" && (item.paymentCustomerReaction === "客户明确肯定" || item.paymentCustomerReaction === "存在异议" || item.paymentCustomerReaction === "客户未明确表态" || item.paymentCustomerReaction === "未确认") ? item.paymentCustomerReaction : fallback.paymentCustomerReaction,
      paymentReactionEvidenceMessageId: item.id === "payment_method" ? stringValue(item.paymentReactionEvidenceMessageId) : "",
      paymentReactionEvidenceQuote: item.id === "payment_method" ? normalizeEvidenceQuote(item.paymentReactionEvidenceQuote, conversation) : "",
      paymentAdvice: item.id === "payment_method" ? stringValue(item.paymentAdvice, fallback.paymentAdvice || "") : "",
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    };
  });
  const confidence = Number(report.confidence);
  const knowledgeReferences: KnowledgeScriptReference[] = Array.isArray(report.knowledgeReferences) ? report.knowledgeReferences.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const id = stringValue(item.id);
    const title = stringValue(item.title);
    if (!id || !title) return [];
    return [{ id, title, scenario: stringValue(item.scenario), excerpt: stringValue(item.excerpt) }];
  }) : [];
  const priorityRank = { "高": 0, "中": 1, "低": 2 } as const;
  const improvements: CommunicationImprovement[] = Array.isArray(report.improvements) ? report.improvements.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const title = stringValue(item.title);
    const issue = stringValue(item.issue);
    const recommendation = stringValue(item.recommendation);
    if (!title || !issue || !recommendation) return [];
    const priority: CommunicationImprovement["priority"] = item.priority === "高" || item.priority === "低" ? item.priority : "中";
    return [{ title, priority, issue, customerEvidenceMessageId: stringValue(item.customerEvidenceMessageId), customerEvidenceQuote: normalizeEvidenceQuote(item.customerEvidenceQuote, conversation), customerEvidenceTranslation: stringValue(item.customerEvidenceTranslation), handling: stringValue(item.handling, "销售尚未处理"), salesEvidenceMessageId: stringValue(item.salesEvidenceMessageId), salesEvidenceQuote: normalizeEvidenceQuote(item.salesEvidenceQuote, conversation), salesEvidenceTranslation: stringValue(item.salesEvidenceTranslation), recommendation }];
  }).sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]) : [];
  const rawNextStrategy = report.nextStrategy && typeof report.nextStrategy === "object" && !Array.isArray(report.nextStrategy) ? report.nextStrategy as Record<string, unknown> : {};
  const nextStrategy: CustomerTask["report"]["nextStrategy"] = {
    strategySummary: stringValue(rawNextStrategy.strategySummary, "待生成综合推进策略"),
    primaryGoal: stringValue(rawNextStrategy.primaryGoal, "待确认本轮核心目标"),
    reasoning: stringValue(rawNextStrategy.reasoning),
    actions: stringList(rawNextStrategy.actions, []),
    communicationMethod: stringValue(rawNextStrategy.communicationMethod),
    avoidActions: stringList(rawNextStrategy.avoidActions, []),
    evidence: normalizeEmotionEvidence(rawNextStrategy.evidence, 5),
  };
  return {
    summary: stringValue(report.summary, "AI 未返回有效的对话总结。"),
    profile,
    emotionProfile,
    productMentions,
    objections,
    decisionMap,
    offensePoints,
    defensePoints,
    confirmations,
    improvements,
    nextStrategy,
    suggestedReply: stringValue(report.suggestedReply),
    suggestedReplyTranslation: stringValue(report.suggestedReplyTranslation),
    knowledgeReferences,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
  };
}

const foundationAnalysisModules: AnalysisModule[] = ["summary", "profile", "products", "emotion_state", "emotion_trend", "personality", "decision", "drivers", "blockers", "blocker_status", "improvements"];
const analysisModules: AnalysisModule[] = [...foundationAnalysisModules, "strategy", "reply"];
const analysisModuleLabels: Record<AnalysisModule, string> = {
  summary: "对话总结", profile: "客户画像", products: "产品识别", emotion_state: "当前情绪", emotion_trend: "情绪变化",
  personality: "沟通性格", decision: "决策方式", drivers: "下单驱动力", blockers: "成交阻力", blocker_status: "阻力处理状态",
  improvements: "沟通改善和不足", strategy: "下一步策略", reply: "建议回复",
};

function mergeAnalysisModule(report: CustomerTask["report"], module: AnalysisModule, result: unknown, conversation: string) {
  const value = result && typeof result === "object" ? result as Record<string, unknown> : {};
  if (module === "summary") return normalizeReport({ ...report, summary: value.summary, confidence: value.confidence }, conversation);
  if (module === "profile") return normalizeReport({ ...report, profile: value.profile, confidence: Math.max(report.confidence, Number(value.confidence) || 0) }, conversation);
  if (module === "products") return normalizeReport({ ...report, productMentions: value.productMentions }, conversation);
  if (module === "emotion_state") return normalizeReport({ ...report, emotionProfile: { ...report.emotionProfile, currentState: value.currentState, currentStateEvidence: value.currentStateEvidence, confidence: value.confidence } }, conversation);
  if (module === "emotion_trend") return normalizeReport({ ...report, emotionProfile: { ...report.emotionProfile, emotionTurningPoints: value.emotionTurningPoints } }, conversation);
  if (module === "personality") return normalizeReport({ ...report, emotionProfile: { ...report.emotionProfile, personalitySummary: value.personalitySummary, personalityTraits: value.personalityTraits } }, conversation);
  if (module === "decision") return normalizeReport({ ...report, emotionProfile: { ...report.emotionProfile, decisionStyle: value.decisionStyle, decisionFactors: value.decisionFactors, decisionPace: value.decisionPace, communicationApproach: value.communicationApproach, decisionEvidence: value.decisionEvidence, confidence: Math.max(report.emotionProfile.confidence, Number(value.confidence) || 0) } }, conversation);
  if (module === "drivers") return normalizeReport({ ...report, decisionMap: { ...report.decisionMap, motivationLevel: value.motivationLevel, readiness: value.readiness, buyingDrivers: value.buyingDrivers } }, conversation);
  if (module === "blockers") return normalizeReport({ ...report, decisionMap: { ...report.decisionMap, biggestBlocker: value.biggestBlocker, priorityTask: value.priorityTask, blockers: value.blockers } }, conversation);
  if (module === "blocker_status") {
    const assessments = Array.isArray(value.blockerAssessments) ? value.blockerAssessments as Array<Record<string, unknown>> : [];
    const blockers = report.decisionMap.blockers.map((blocker) => {
      const assessment = assessments.find((item) => item.evidenceMessageId === blocker.evidenceMessageId);
      return assessment ? { ...blocker, ...assessment } : blocker;
    });
    return normalizeReport({ ...report, decisionMap: { ...report.decisionMap, blockers } }, conversation);
  }
  if (module === "improvements") return normalizeReport({ ...report, improvements: value.improvements }, conversation);
  if (module === "strategy") return normalizeReport({ ...report, nextStrategy: value.nextStrategy }, conversation);
  return normalizeReport({ ...report, suggestedReply: value.suggestedReply, suggestedReplyTranslation: value.suggestedReplyTranslation, knowledgeReferences: value.knowledgeReferences }, conversation);
}

async function analyzeConcurrently(task: CustomerTask, conversation: string, onUpdate: (task: CustomerTask) => void, requestedModules: AnalysisModule[] = analysisModules) {
  const resetAll = requestedModules.length === analysisModules.length && analysisModules.every((module) => requestedModules.includes(module));
  // 完整重新分析时立即丢弃旧报告；单模块重试时只清空对应模块，避免旧数据与本次结果混在一起。
  let report: CustomerTask["report"] = resetAll
    ? { ...emptyReport, confirmations: defaultConfirmations.map((item) => ({ ...item })) }
    : {
      ...task.report,
      ...(requestedModules.includes("summary") ? { summary: emptyReport.summary, confidence: 0 } : {}),
      ...(requestedModules.includes("profile") ? { profile: [] } : {}),
      ...(requestedModules.includes("products") ? { productMentions: [] } : {}),
      ...(requestedModules.some((module) => ["emotion_state", "emotion_trend", "personality", "decision"].includes(module)) ? { emotionProfile: { ...task.report.emotionProfile, ...(requestedModules.includes("emotion_state") ? { currentState: emptyReport.emotionProfile.currentState, currentStateEvidence: [], confidence: 0 } : {}), ...(requestedModules.includes("emotion_trend") ? { emotionTurningPoints: [] } : {}), ...(requestedModules.includes("personality") ? { personalitySummary: emptyReport.emotionProfile.personalitySummary, personalityTraits: [] } : {}), ...(requestedModules.includes("decision") ? { decisionStyle: emptyReport.emotionProfile.decisionStyle, decisionFactors: [], decisionPace: emptyReport.emotionProfile.decisionPace, communicationApproach: emptyReport.emotionProfile.communicationApproach, decisionEvidence: [] } : {}) } } : {}),
      ...(requestedModules.some((module) => ["drivers", "blockers", "blocker_status"].includes(module)) ? { decisionMap: { ...task.report.decisionMap, ...(requestedModules.includes("drivers") ? { motivationLevel: "弱" as const, readiness: "低" as const, buyingDrivers: [] } : {}), ...(requestedModules.includes("blockers") ? { biggestBlocker: "待分析", priorityTask: "等待 AI 完成成交判断。", blockers: [] } : {}) } } : {}),
      ...(requestedModules.includes("improvements") ? { improvements: [] } : {}),
      ...(requestedModules.includes("strategy") ? { nextStrategy: { ...emptyReport.nextStrategy, actions: [], avoidActions: [], evidence: [] } } : {}),
      ...(requestedModules.includes("reply") ? { suggestedReply: "", suggestedReplyTranslation: "", knowledgeReferences: [] } : {}),
    };
  let provider: Provider = task.provider;
  let completed = 0;
  let succeeded = 0;
  let states = Object.fromEntries(analysisModules.map((module) => [module, task.analysisModules?.[module] ?? "pending"])) as Record<AnalysisModule, AnalysisModuleStatus>;
  for (const module of requestedModules) states[module] = "analyzing";
  let errors: Partial<Record<AnalysisModule, string>> = { ...(task.analysisModuleErrors ?? {}) };
  for (const module of requestedModules) delete errors[module];
  const results: Partial<Record<AnalysisModule, unknown>> = {};
  let latest: CustomerTask = { ...task, rawConversation: conversation, report, status: "analyzing", analysisStep: "analyzing", analysisModules: states, analysisModuleErrors: errors, analysisError: undefined };
  onUpdate(latest);
  const runModule = async (module: AnalysisModule) => {
    try {
      const analysisContext = module === "strategy"
        ? { summary: report.summary, profile: report.profile, emotionProfile: report.emotionProfile, decisionMap: report.decisionMap, improvements: report.improvements }
        : module === "reply"
          ? { summary: report.summary, emotionProfile: report.emotionProfile, decisionMap: report.decisionMap, nextStrategy: report.nextStrategy }
          : undefined;
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation, module, analysisContext }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `${analysisModuleLabels[module]}分析失败`);
      provider = data.provider === "deepseek" ? "deepseek" : "openai";
      results[module] = data.result;
      report = mergeAnalysisModule(report, module, data.result, conversation);
      states = { ...states, [module]: "done" };
      succeeded += 1;
    } catch (error) {
      states = { ...states, [module]: "failed" };
      errors = { ...errors, [module]: error instanceof Error ? error.message : `${analysisModuleLabels[module]}分析失败` };
    }
    completed += 1;
    latest = normalizeTask({
      ...latest,
      report,
      provider,
      model: provider === "openai" ? "GPT" : "DeepSeek",
      analysisModules: states,
      analysisModuleErrors: errors,
      status: completed < requestedModules.length ? "analyzing" : (succeeded || Object.values(states).includes("done")) ? "ready" : "failed",
      analysisStep: completed < requestedModules.length ? "analyzing" : undefined,
      analysisError: completed === requestedModules.length && !succeeded && !Object.values(states).includes("done") ? Object.values(errors).join("；") : undefined,
      updatedAt: "刚刚",
    });
    onUpdate(latest);
  };
  const foundationModules = requestedModules.filter((module) => foundationAnalysisModules.includes(module));
  await Promise.all(foundationModules.map(runModule));
  // Rebuild foundation fields in a fixed order so completion timing cannot change the final report.
  for (const module of foundationAnalysisModules) if (results[module]) report = mergeAnalysisModule(report, module, results[module], conversation);
  latest = { ...latest, report };
  if (requestedModules.includes("strategy")) await runModule("strategy");
  if (requestedModules.includes("reply")) {
    if (states.strategy === "done") await runModule("reply");
    else {
      states = { ...states, reply: "failed" };
      errors = { ...errors, reply: "下一步策略未完成，建议回复已停止生成" };
      completed += 1;
      latest = normalizeTask({ ...latest, report, analysisModules: states, analysisModuleErrors: errors, status: succeeded || Object.values(states).includes("done") ? "ready" : "failed", analysisStep: undefined, updatedAt: "刚刚" });
      onUpdate(latest);
    }
  }
  return latest;
}

function normalizeTask(task: CustomerTask): CustomerTask {
  const hasNewProgress = task.progress?.some((item) => item.id === "inquiry");
  const rawStates = task.analysisModules as unknown as Record<string, AnalysisModuleStatus> | undefined;
  const rawErrors = task.analysisModuleErrors as unknown as Record<string, string> | undefined;
  const legacyState = (module: AnalysisModule): AnalysisModuleStatus | undefined => {
    if (!rawStates) return undefined;
    if (module === "summary" || module === "profile" || module === "products") return rawStates.customer;
    if (module === "emotion_state" || module === "emotion_trend" || module === "personality" || module === "decision") return rawStates.psychology;
    if (module === "drivers" || module === "blockers" || module === "blocker_status") return rawStates.checklist || rawStates.risk;
    return rawStates.action;
  };
  const normalizedStates = rawStates ? Object.fromEntries(analysisModules.map((module) => [module, rawStates[module] ?? legacyState(module) ?? "pending"])) as Record<AnalysisModule, AnalysisModuleStatus> : undefined;
  const normalizedErrors: Partial<Record<AnalysisModule, string>> | undefined = rawErrors ? Object.fromEntries(analysisModules.flatMap((module) => {
    const legacy = module === "summary" || module === "profile" || module === "products" ? rawErrors.customer
      : module === "emotion_state" || module === "emotion_trend" || module === "personality" || module === "decision" ? rawErrors.psychology
        : module === "drivers" || module === "blockers" || module === "blocker_status" ? rawErrors.checklist || rawErrors.risk
          : rawErrors.action;
    const error = rawErrors[module] || legacy;
    return error ? [[module, error]] : [];
  })) : undefined;
  return {
    ...task,
    report: normalizeReport(task.report, task.rawConversation),
    analysisModules: normalizedStates,
    analysisModuleErrors: normalizedErrors,
    progress: hasNewProgress ? task.progress : defaultProgress.map((item) => ({ ...item })),
  };
}

const productRows = [
  { name: "Product A", category: "核心产品", docs: 6, scripts: 12, updated: "今天 09:30", completeness: 92 },
  { name: "Product B", category: "常规产品", docs: 3, scripts: 8, updated: "昨天", completeness: 76 },
  { name: "Product C", category: "定制产品", docs: 4, scripts: 5, updated: "3 天前", completeness: 68 },
  { name: "Product D", category: "新品", docs: 1, scripts: 2, updated: "5 天前", completeness: 41 },
];

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function AppLogo() {
  return (
    <div className="brand">
      <div className="brand-mark"><Sparkles size={18} /></div>
      <div><strong>ClientLens</strong><span>AI Sales Intelligence</span></div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("analysis");
  const [session, setSession] = useState<{ email: string | null; username: string | null; role: "admin" | "user" } | null>(null);
  const [tasks, setTasks] = useState<CustomerTask[]>(initialTasks);
  const [activeTaskId, setActiveTaskId] = useState(initialTasks[0].id);
  const [showNewTask, setShowNewTask] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      setSession({ email: data.email ?? null, username: data.username ?? null, role: data.role });
    });
  }, []);

  useEffect(() => {
    if (session?.role === "user" && view === "settings") setView("analysis");
  }, [session, view]);

  useEffect(() => {
    const stored = localStorage.getItem("clientlens-tasks");
    if (stored) {
      try {
        const parsed = (JSON.parse(stored) as CustomerTask[]).map(normalizeTask);
        if (parsed.length) {
          setTasks(parsed);
          setActiveTaskId(parsed[0].id);
        }
      } catch { /* keep demo data */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("clientlens-tasks", JSON.stringify(tasks));
  }, [tasks]);

  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? tasks[0];
  const updateTask = (next: CustomerTask) => setTasks((items) => items.map((item) => item.id === next.id ? next : item));
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/login"); };

  return (
    <main className="app-shell">
      <header className="topbar">
        <AppLogo />
        <nav className="main-nav" aria-label="主导航">
          {navItems.filter((item) => item.id !== "settings" || session?.role === "admin").map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
              <item.icon size={17} />{item.label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <div className="sync-pill"><span />原型运行正常</div>
          {session?.role === "admin" && <button className="icon-button" aria-label="设置" onClick={() => setView("settings")}><Settings size={18} /></button>}
          <button className="icon-button logout-button" aria-label="退出登录" title="退出登录" onClick={logout}><LogOut size={17} /></button>
          <div className="avatar small" title={session?.username || session?.email || "当前用户"}>{initials(session?.username || session?.email || "U")}</div>
        </div>
      </header>

      {view === "analysis" && activeTask && (
        <AnalysisWorkspace
          tasks={tasks}
          activeTask={activeTask}
          onSelect={setActiveTaskId}
          onUpdate={updateTask}
          onNew={() => setShowNewTask(true)}
        />
      )}
      {view === "scripts" && <KnowledgeView kind="scripts" isAdmin={session?.role === "admin"} />}
      {view === "products" && <KnowledgeView kind="products" isAdmin={session?.role === "admin"} />}
      {view === "translate" && <TranslateView />}
      {view === "settings" && session?.role === "admin" && <SettingsView />}

      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onUpdate={updateTask}
          onCreate={(task) => {
            setTasks((items) => [task, ...items]);
            setActiveTaskId(task.id);
            setShowNewTask(false);
          }}
        />
      )}
    </main>
  );
}

function EmotionEvidenceDisclosure({ evidence, onLocate, compact = false }: { evidence: EmotionEvidence[]; onLocate: (messageId?: string, quote?: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!evidence.length) return <div className="emotion-evidence-missing">当前没有可逐字核验的客户原文</div>;
  return <div className={`embedded-evidence ${compact ? "compact" : ""}`}>
    <button type="button" className="evidence-toggle" onClick={() => setOpen((value) => !value)}><FileText size={13} />查看依据 · {evidence.length} 条<ChevronDown size={13} className={open ? "open" : ""} /></button>
    {open && <div className="embedded-evidence-list">{evidence.map((item) => <article key={`${item.messageId}-${item.quote}`}>
      <div className="evidence-copy"><span>{item.messageId}</span><blockquote>“{item.quote}”</blockquote>{item.translation && <p className="evidence-translation"><strong>中文</strong>{item.translation}</p>}<p>{item.interpretation}</p></div>
      <button type="button" className="evidence-lock" onClick={() => onLocate(item.messageId, item.quote)}><Link2 size={12} />定位并锁定</button>
    </article>)}</div>}
  </div>;
}

function EmotionTrendChart({ points, onLocate }: { points: EmotionTurningPoint[]; onLocate: (messageId?: string, quote?: string) => void }) {
  const [selected, setSelected] = useState(0);
  if (!points.length) return <div className="emotion-chart-empty">当前对话不足以识别可靠的情绪转折</div>;
  const width = 760;
  const height = 210;
  const paddingX = 58;
  const paddingY = 28;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const coordinates = points.map((point, index) => ({ x: paddingX + (points.length === 1 ? chartWidth / 2 : chartWidth * index / (points.length - 1)), y: paddingY + (2 - point.score) / 4 * chartHeight }));
  const path = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const active = points[Math.min(selected, points.length - 1)];
  return <div className="emotion-trend-chart">
    <div className="chart-canvas"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="客户情绪变化折线图">
      {[2, 1, 0, -1, -2].map((score) => { const y = paddingY + (2 - score) / 4 * chartHeight; return <g key={score}><line x1={paddingX} x2={width - paddingX} y1={y} y2={y} className={score === 0 ? "chart-zero" : "chart-grid-line"} /><text x={10} y={y + 4}>{score === 2 ? "积极" : score === 1 ? "偏积极" : score === 0 ? "中性" : score === -1 ? "偏消极" : "消极"}</text></g>; })}
      {points.length > 1 && <polyline points={path} className="emotion-line" />}
      {coordinates.map((point, index) => <g key={`${points[index].messageId}-${index}`} className={`chart-point ${selected === index ? "active" : ""}`} role="button" tabIndex={0} onClick={() => setSelected(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelected(index); }}><circle cx={point.x} cy={point.y} r={selected === index ? 8 : 6} /><text className="chart-point-label" x={point.x} y={Math.max(14, point.y - 13)} textAnchor="middle">{points[index].label}</text><text className="chart-point-id" x={point.x} y={height - 5} textAnchor="middle">{points[index].messageId}</text></g>)}
    </svg></div>
    <article className="turning-point-detail"><header><span>{active.label}</span><strong>{active.reason}</strong></header><EmotionEvidenceDisclosure evidence={[active]} onLocate={onLocate} /></article>
  </div>;
}

function AnalysisWorkspace({ tasks, activeTask, onSelect, onUpdate, onNew }: {
  tasks: CustomerTask[];
  activeTask: CustomerTask;
  onSelect: (id: string) => void;
  onUpdate: (task: CustomerTask) => void;
  onNew: () => void;
}) {
  const [taskSearch, setTaskSearch] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [rawTarget, setRawTarget] = useState<{ messageId?: string; quote: string; nonce: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [activeReportSection, setActiveReportSection] = useState<ReportSectionId>("summary");
  const skipCollapseSaveRef = useRef(false);
  const isAnalyzing = analyzing || activeTask.status === "analyzing";
  const hasCompletedModule = Object.values(activeTask.analysisModules ?? {}).includes("done");
  const moduleVisible = (module: AnalysisModule) => {
    const state = activeTask.analysisModules?.[module];
    return state ? state === "done" : activeTask.status !== "analyzing";
  };
  const anyModuleVisible = (modules: AnalysisModule[]) => modules.some(moduleVisible);
  const normalizedTaskSearch = taskSearch.trim().toLowerCase();
  const filtered = tasks.filter((task) => [task.customer.name, task.customer.remark, task.taskLabel, task.name]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedTaskSearch)));

  useEffect(() => {
    skipCollapseSaveRef.current = true;
    try {
      const saved = localStorage.getItem(`clientlens-report-collapse-${activeTask.id}`);
      setCollapsedSections(saved ? JSON.parse(saved) as Record<string, boolean> : {});
    } catch { setCollapsedSections({}); }
  }, [activeTask.id]);

  useEffect(() => {
    if (skipCollapseSaveRef.current) { skipCollapseSaveRef.current = false; return; }
    try { localStorage.setItem(`clientlens-report-collapse-${activeTask.id}`, JSON.stringify(collapsedSections)); } catch { /* storage may be unavailable */ }
  }, [activeTask.id, collapsedSections]);

  useEffect(() => {
    const root = document.querySelector(".report-pane");
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-report-section]"));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const id = visible[0]?.target.getAttribute("data-report-section") as ReportSectionId | null;
      if (id) setActiveReportSection(id);
    }, { root, rootMargin: "-150px 0px -62% 0px", threshold: 0 });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [activeTask.id, activeTask.status]);

  const toggleReportSection = (id: ReportSectionId) => setCollapsedSections((current) => ({ ...current, [id]: !current[id] }));

  const reportSections = useMemo(() => {
    const sections: Array<{ id: ReportSectionId; label: string; meta?: string }> = [];
    if (moduleVisible("summary")) sections.push({ id: "summary", label: "对话总结" });
    if (moduleVisible("profile")) sections.push({ id: "profile", label: "客户画像" });
    if (anyModuleVisible(["emotion_state", "emotion_trend", "personality", "decision"])) sections.push({ id: "psychology", label: "情绪与心理" });
    if (anyModuleVisible(["drivers", "blockers", "blocker_status"])) {
      sections.push({ id: "checklist", label: "成交决策地图", meta: `${activeTask.report.decisionMap.buyingDrivers.length}/${activeTask.report.decisionMap.blockers.length}` });
    }
    if (moduleVisible("improvements")) sections.push({ id: "improvements", label: "改善和不足" });
    if (anyModuleVisible(["strategy", "reply"])) sections.push({ id: "next-actions", label: "下一步建议" });
    return sections;
  }, [activeTask]);

  const openReportSection = (id: ReportSectionId) => {
    setCollapsedSections((current) => ({ ...current, [id]: false }));
    window.setTimeout(() => document.getElementById(`report-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  };

  const setAllReportSections = (collapsed: boolean) => setCollapsedSections(Object.fromEntries(reportSections.map((section) => [section.id, collapsed])));

  const openRawChat = (messageId = "", quote = "") => {
    setShowRaw(true);
    setRawTarget({ messageId, quote, nonce: Date.now() });
  };

  const rename = (task: CustomerTask) => {
    const clean = draftName.trim();
    onUpdate({ ...task, taskLabel: clean || undefined });
    setRenaming(null);
  };

  const reanalyze = async () => {
    setAnalyzing(true);
    try {
      await analyzeConcurrently(activeTask, activeTask.rawConversation, onUpdate);
    } catch (error) {
      onUpdate({ ...activeTask, status: "failed", analysisStep: undefined, analysisError: error instanceof Error ? error.message : "AI 分析失败" });
    } finally {
      setAnalyzing(false);
    }
  };

  const retryFailedModules = async () => {
    const failedModules = analysisModules.filter((module) => activeTask.analysisModules?.[module] === "failed");
    if (!failedModules.length) return reanalyze();
    setAnalyzing(true);
    try {
      await analyzeConcurrently(activeTask, activeTask.rawConversation, onUpdate, failedModules);
    } finally {
      setAnalyzing(false);
    }
  };

  const syncLatestMessages = async () => {
    if (activeTask.source !== "salesmartly" || !activeTask.customer.externalId) return;
    setSyncing(true);
    setSyncError("");
    try {
      const response = await fetch(`/api/salesmartly/messages?chatUserId=${encodeURIComponent(activeTask.customer.externalId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "同步聊天记录失败");
      const conversation = typeof data.conversation === "string" ? data.conversation.trim() : "";
      if (!conversation) throw new Error("SaleSmartly 暂无可同步的聊天记录");
      const changed = conversation !== activeTask.rawConversation.trim();
      const remoteCustomer = data.customer && typeof data.customer === "object" ? data.customer as Partial<SaleSmartlyCustomerOption> : null;
      const customer = remoteCustomer?.name ? {
        ...activeTask.customer,
        name: remoteCustomer.name,
        remark: remoteCustomer.remark || undefined,
        country: remoteCustomer.country || activeTask.customer.country,
        channel: remoteCustomer.channel || activeTask.customer.channel,
        lastMessageAt: remoteCustomer.lastMessageAt || activeTask.customer.lastMessageAt,
      } : activeTask.customer;
      onUpdate({
        ...activeTask,
        customer,
        rawConversation: conversation,
        report: activeTask.report,
        name: `${customerDisplayName(customer)} · ${Number(data.messageCount ?? 0)} 条消息`,
        status: changed ? "stale" : activeTask.status,
        updatedAt: changed ? "刚刚" : activeTask.updatedAt,
      });
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "同步聊天记录失败");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className={`analysis-grid ${showRaw ? "mobile-raw-open" : ""}`}>
      <aside className="task-rail">
        <div className="rail-head">
          <div><span className="eyebrow">WORKSPACE</span><h2>分析任务</h2></div>
          <span className="count-badge">{tasks.length}</span>
        </div>
        <button className="primary-button wide" onClick={onNew}><Plus size={17} />新建分析任务</button>
        <label className="search-box"><Search size={15} /><input value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} placeholder="搜索任务或客户" /></label>
        <div className="task-filters"><button className="active">全部</button><button>进行中</button><button>需更新</button></div>
        <div className="task-list">
          {filtered.map((task) => {
            const meta = sourceMeta[task.source];
            return (
              <button key={task.id} className={`task-item ${activeTask.id === task.id ? "active" : ""}`} onClick={() => onSelect(task.id)} onDoubleClick={() => { setRenaming(task.id); setDraftName(task.taskLabel || ""); }}>
                <div className="task-row">
                  <span className={`source-icon ${meta.color}`}><meta.icon size={14} /></span>
                  <strong>{customerDisplayName(task.customer)} · {taskConversationCount(task)} 条消息</strong>
                </div>
                {renaming === task.id ? <input className="task-label-input" autoFocus value={draftName} placeholder="可选：设置任务别名" onChange={(e) => setDraftName(e.target.value)} onClick={(e) => e.stopPropagation()} onBlur={() => rename(task)} onKeyDown={(e) => e.key === "Enter" && rename(task)} /> : task.taskLabel && <div className="task-label">任务：{task.taskLabel}</div>}
                <div className="task-meta"><span>{meta.label}</span><span>·</span><span>{task.updatedAt}</span></div>
                <div className="task-bottom">
                  <span className={`status-dot ${task.status}`} />
                  <span>{task.status === "stale" ? "有新消息，需更新" : task.status === "analyzing" ? "分析中" : task.status === "failed" ? "分析失败" : "分析完成"}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="rail-footer"><Archive size={15} />已归档任务<span>12</span></div>
      </aside>

      <section className="report-pane">
        <div className="report-toolbar">
          <div>
            <div className="breadcrumb">客户分析台 <ChevronRight size={13} /> {customerDisplayName(activeTask.customer)} · {taskConversationCount(activeTask)} 条消息</div>
            <h1>客户分析报告</h1>
          </div>
          <div className="toolbar-actions">
            <button className="secondary-button mobile-raw-toggle" onClick={() => openRawChat()}><FileText size={16} />原始聊天</button>
            <button className="secondary-button"><Upload size={16} />导出</button>
            <button className="primary-button" onClick={reanalyze} disabled={isAnalyzing}><RefreshCw size={16} className={isAnalyzing ? "spin" : ""} />{isAnalyzing ? "分析中…" : "重新分析"}</button>
          </div>
        </div>

        {activeTask.status === "stale" && (
          <div className="stale-banner"><CircleAlert size={17} /><div><strong>发现新的聊天消息</strong><span>当前报告基于旧记录，建议同步并重新分析。</span></div><button onClick={reanalyze}>立即更新</button></div>
        )}
        {syncError && <div className="sync-error-banner"><CircleAlert size={16} /><span>{syncError}</span><button onClick={() => setSyncError("")}><X size={14} /></button></div>}
        {!!Object.keys(activeTask.analysisModuleErrors ?? {}).length && activeTask.status !== "analyzing" && <div className="partial-error-banner"><CircleAlert size={16} /><span>部分分析未完成：{Object.entries(activeTask.analysisModuleErrors ?? {}).map(([module, error]) => `${analysisModuleLabels[module as AnalysisModule]}（${error}）`).join("；")}</span><button onClick={() => void retryFailedModules()}>仅重试失败模块</button></div>}

        {activeTask.status !== "failed" && (activeTask.status !== "analyzing" || hasCompletedModule) && <ReportDirectory sections={reportSections} active={activeReportSection} collapsed={collapsedSections} onOpen={openReportSection} onSetAll={setAllReportSections} />}

        {activeTask.status === "analyzing" && !hasCompletedModule ? (
          <AnalysisLoading task={activeTask} />
        ) : activeTask.status === "failed" ? (
          <AnalysisFailed task={activeTask} onRetry={reanalyze} />
        ) : <ReportCollapseContext.Provider value={{ collapsed: collapsedSections, toggle: toggleReportSection }}><div className="report-content">
          {activeTask.status === "analyzing" && <AnalysisModuleProgress task={activeTask} compact />}
          {anyModuleVisible(["summary", "profile"]) && <>
          <div className="report-intro">
            <div className="ai-orb"><Sparkles size={22} /></div>
            <div><span>AI ANALYSIS</span><h2>{customerDisplayName(activeTask.customer)} 的对话洞察</h2><p>基于 {taskConversationCount(activeTask)} 条对话 · {activeTask.model} · 置信度 {Math.round(activeTask.report.confidence * 100)}%</p></div>
            <div className={`confidence score-${confidenceLabel(activeTask.report.confidence)}`}><div style={{ "--score": `${activeTask.report.confidence * 100}%` } as React.CSSProperties} /><span>{confidenceLabel(activeTask.report.confidence)}</span></div>
          </div>

          {moduleVisible("summary") && <ReportCard icon={FileText} title="对话总结" tone="violet" sectionId="summary">
            <p className="summary-text">{activeTask.report.summary}</p>
          </ReportCard>}

          {moduleVisible("profile") && <ReportCard icon={UserRound} title="客户画像" tone="blue" sectionId="profile">
            <div className="profile-tags">{activeTask.report.profile.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div>
          </ReportCard>}
          </>}

          {anyModuleVisible(["emotion_state", "emotion_trend", "personality", "decision"]) && <>
          <ReportCard icon={UsersRound} title="客户情绪、沟通性格与心理研判" tone="cyan" sectionId="psychology">
            <div className="emotion-profile-toolbar"><span>基于客户真实表达的沟通研判</span><strong className={`emotion-confidence score-${confidenceLabel(activeTask.report.emotionProfile.confidence)}`}>{confidenceLabel(activeTask.report.emotionProfile.confidence)} · {Math.round(activeTask.report.emotionProfile.confidence * 100)}%</strong></div>
            <section className="emotion-insight current-state-card">
              <header><span>1</span><div><small>当前情绪和心理状态</small><strong>{activeTask.report.emotionProfile.currentState}</strong></div></header>
              <EmotionEvidenceDisclosure evidence={activeTask.report.emotionProfile.currentStateEvidence} onLocate={openRawChat} />
            </section>
            <section className="emotion-insight emotion-chart-card">
              <header><span>2</span><div><small>情绪变化</small><strong>按对话顺序查看情绪转折与原因</strong></div></header>
              <EmotionTrendChart points={activeTask.report.emotionProfile.emotionTurningPoints} onLocate={openRawChat} />
            </section>
            <section className="emotion-insight">
              <header><span>3</span><div><small>沟通性格倾向</small><strong>{activeTask.report.emotionProfile.personalitySummary}</strong></div></header>
              <div className="communication-traits">{activeTask.report.emotionProfile.personalityTraits.map((item, index) => <article key={`${item.trait}-${index}`}><div><strong>{item.trait}</strong><p>{item.explanation}</p></div><EmotionEvidenceDisclosure evidence={item.evidence} onLocate={openRawChat} compact /></article>)}</div>
            </section>
            <section className="emotion-insight decision-card">
              <header><span>4</span><div><small>决策方式</small><strong>{activeTask.report.emotionProfile.decisionStyle}</strong></div></header>
              <div className="decision-grid"><div><small>主要考虑因素</small><div className="emotion-tags">{activeTask.report.emotionProfile.decisionFactors.map((item) => <span key={item}>{item}</span>)}</div></div><div><small>决策节奏</small><p>{activeTask.report.emotionProfile.decisionPace}</p></div><div><small>建议沟通方式</small><p>{activeTask.report.emotionProfile.communicationApproach}</p></div></div>
              <EmotionEvidenceDisclosure evidence={activeTask.report.emotionProfile.decisionEvidence} onLocate={openRawChat} />
            </section>
            <p className="emotion-disclaimer">仅依据当前聊天进行非临床沟通心理研判，不构成精神健康、人格障碍或医学诊断。</p>
          </ReportCard>
          </>}

          {anyModuleVisible(["drivers", "blockers", "blocker_status"]) && <>
          <DecisionMapPanel task={activeTask} onLocate={openRawChat} />
          </>}

          {moduleVisible("improvements") && <ReportCard icon={Zap} title="本次沟通可改善和不足" tone="amber" sectionId="improvements">
            <CommunicationReview improvements={activeTask.report.improvements} onLocate={openRawChat} />
          </ReportCard>}

          {anyModuleVisible(["strategy", "reply"]) && <ReportCard icon={Sparkles} title="AI 下一步建议" tone="violet" featured sectionId="next-actions">
            <div className="next-strategy">
              <section className="strategy-summary"><small>当前策略判断</small><strong>{activeTask.report.nextStrategy.strategySummary}</strong></section>
              <div className="strategy-grid"><section><small>下一步核心目标</small><strong>{activeTask.report.nextStrategy.primaryGoal}</strong></section><section><small>推荐沟通方式</small><p>{activeTask.report.nextStrategy.communicationMethod}</p></section></div>
              <section className="strategy-reasoning"><small>为什么这样推进</small><p>{activeTask.report.nextStrategy.reasoning}</p><EmotionEvidenceDisclosure evidence={activeTask.report.nextStrategy.evidence} onLocate={openRawChat} compact /></section>
              <section><small>推荐推进顺序</small><div className="action-list">{activeTask.report.nextStrategy.actions.map((item, i) => <div key={`${item}-${i}`}><span>{i + 1}</span><p>{item}</p></div>)}</div></section>
              {activeTask.report.nextStrategy.avoidActions.length > 0 && <section className="strategy-avoid"><small>暂时不要做</small><ul>{activeTask.report.nextStrategy.avoidActions.map((item) => <li key={item}>{item}</li>)}</ul></section>}
            </div>
            <div className="reply-box"><div><Bot size={16} /><strong>建议回复</strong><button onClick={() => navigator.clipboard.writeText(activeTask.report.suggestedReply)}><Copy size={14} />复制原文</button></div><p>{activeTask.report.suggestedReply}</p><div className="reply-translation"><span>中文核对</span><p>{activeTask.report.suggestedReplyTranslation}</p></div></div>
          </ReportCard>}
        </div></ReportCollapseContext.Provider>}
      </section>

      <button type="button" className="report-back-top" onClick={() => document.querySelector(".report-pane")?.scrollTo({ top: 0, behavior: "smooth" })} title="返回顶部"><ArrowUp size={17} /></button>

      <RawChatPanel
        task={activeTask}
        onUpdate={onUpdate}
        onClose={() => { setShowRaw(false); setRawTarget(null); }}
        onSync={activeTask.source === "salesmartly" ? syncLatestMessages : undefined}
        syncing={syncing}
        target={rawTarget}
      />
    </div>
  );
}

function AnalysisLoading({ task }: { task: CustomerTask }) {
  const importing = task.analysisStep === "importing";
  return (
    <div className="analysis-state-card loading">
      <div className="analysis-loader"><Sparkles size={25} /><i /><i /><i /></div>
      <span className="eyebrow">AI ANALYSIS</span>
      <h2>{importing ? "正在同步客户聊天记录" : "正在生成客户分析报告"}</h2>
      <p>{importing ? "正在从 SaleSmartly 获取并整理该客户的历史消息…" : "AI 正在识别客户画像、情绪与沟通性格、异议和下一步建议…"}</p>
      {importing ? <div className="analysis-steps"><span className="active"><Cloud size={13} />读取聊天记录</span></div> : <AnalysisModuleProgress task={task} />}
    </div>
  );
}

function AnalysisModuleProgress({ task, compact = false }: { task: CustomerTask; compact?: boolean }) {
  const states: Record<AnalysisModule, AnalysisModuleStatus> = task.analysisModules
    ?? Object.fromEntries(analysisModules.map((module) => [module, "analyzing"])) as Record<AnalysisModule, AnalysisModuleStatus>;
  return <div className={`analysis-steps ${compact ? "compact" : ""}`}>
    {analysisModules.map((module) => {
      const state = states[module];
      return <span className={state === "analyzing" ? "active" : state} key={module}>
        {state === "done" ? <Check size={13} /> : state === "failed" ? <CircleAlert size={13} /> : <Sparkles size={13} />}
        {analysisModuleLabels[module]}
      </span>;
    })}
  </div>;
}

function AnalysisFailed({ task, onRetry }: { task: CustomerTask; onRetry: () => void }) {
  return (
    <div className="analysis-state-card failed">
      <span className="state-icon"><CircleAlert size={27} /></span>
      <span className="eyebrow">ANALYSIS FAILED</span>
      <h2>本次分析未完成</h2>
      <p>{task.analysisError || "AI 服务暂时不可用，请稍后重试。"}</p>
      <button className="primary-button" onClick={onRetry}><RefreshCw size={15} />重新分析</button>
    </div>
  );
}

function ReportDirectory({ sections, active, collapsed, onOpen, onSetAll }: { sections: Array<{ id: ReportSectionId; label: string; meta?: string }>; active: ReportSectionId; collapsed: Record<string, boolean>; onOpen: (id: ReportSectionId) => void; onSetAll: (collapsed: boolean) => void }) {
  return <nav className="report-directory" aria-label="报告目录">
    <div className="report-directory-inner">
      <strong>报告目录</strong>
      <div className="report-directory-links">{sections.map((section) => <button type="button" key={section.id} className={active === section.id ? "active" : ""} onClick={() => onOpen(section.id)}><span>{section.label}</span>{section.meta && <em>{section.meta}</em>}{collapsed[section.id] && <i />}</button>)}</div>
      <div className="report-directory-actions"><button type="button" onClick={() => onSetAll(false)}>全部展开</button><button type="button" onClick={() => onSetAll(true)}>全部收起</button></div>
    </div>
  </nav>;
}

function ReportCard({ icon: Icon, title, tone, featured, sectionId, children }: React.PropsWithChildren<{ icon: typeof Sparkles; title: string; tone: string; featured?: boolean; sectionId?: ReportSectionId }>) {
  const { collapsed, toggle } = useContext(ReportCollapseContext);
  const isCollapsed = sectionId ? Boolean(collapsed[sectionId]) : false;
  return <article id={sectionId ? `report-${sectionId}` : undefined} data-report-section={sectionId} className={`report-card ${featured ? "featured" : ""} ${isCollapsed ? "collapsed" : ""}`}>
    <header className={sectionId ? "collapsible" : ""} onClick={sectionId ? () => toggle(sectionId) : undefined}><span className={`card-icon ${tone}`}><Icon size={17} /></span><h3>{title}</h3>{sectionId && <button type="button" className="report-collapse-button" aria-label={isCollapsed ? `展开${title}` : `收起${title}`} aria-expanded={!isCollapsed} onClick={(event) => { event.stopPropagation(); toggle(sectionId); }}><ChevronDown size={17} /></button>}</header>
    {!isCollapsed && <div className="card-body">{children}</div>}
  </article>;
}

type StrategyPriority = "高" | "中" | "低";
type DefenseResolution = "未解决" | "未追问-基本解决" | "客户肯定-完全解决";

type OffensePointView = {
  id: string;
  title: string;
  opportunity: string;
  timing: string;
  evidenceMessageId: string;
  evidenceQuote: string;
  evidenceTranslation: string;
  direction: string;
  suggestedReply: string;
  suggestedReplyTranslation: string;
  priority: StrategyPriority;
  goal: string;
};

type DefensePointView = {
  id: string;
  title: string;
  risk: string;
  trigger: string;
  evidenceMessageId: string;
  evidenceQuote: string;
  evidenceTranslation: string;
  status: DefenseResolution;
  remedy: string;
  suggestedReply: string;
  suggestedReplyTranslation: string;
  riskLevel: StrategyPriority;
};

function normalizeStrategyPriority(value: unknown): StrategyPriority {
  const text = stringValue(value);
  if (text.includes("高")) return "高";
  if (text.includes("低")) return "低";
  return "中";
}

function normalizeOffensePoint(value: unknown, index: number): OffensePointView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const point = value as Record<string, unknown>;
  const title = stringValue(point.title);
  if (!title) return null;
  return {
    id: stringValue(point.id, `offense-${index}`),
    title,
    opportunity: stringValue(point.opportunity, stringValue(point.opportunityReason, "当前对话中存在可继续推进的积极信号。")),
    timing: stringValue(point.timingReason, stringValue(point.timing, stringValue(point.whyNow, "可结合当前对话自然推进。"))),
    evidenceMessageId: stringValue(point.evidenceMessageId),
    evidenceQuote: stringValue(point.evidenceQuote),
    evidenceTranslation: stringValue(point.evidenceTranslation),
    direction: stringValue(point.direction, stringValue(point.recommendedDirection, "围绕客户已经表达的关注点继续推进。")),
    suggestedReply: stringValue(point.suggestedReply),
    suggestedReplyTranslation: stringValue(point.suggestedReplyTranslation),
    priority: normalizeStrategyPriority(point.priority),
    goal: stringValue(point.goal, "推进客户决策"),
  };
}

function normalizeDefensePoint(value: unknown, index: number): DefensePointView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const point = value as Record<string, unknown>;
  const title = stringValue(point.title);
  if (!title) return null;
  const rawStatus = stringValue(point.status);
  const status: DefenseResolution = rawStatus.includes("完全") || rawStatus.includes("肯定")
    ? "客户肯定-完全解决"
    : rawStatus.includes("基本") || rawStatus.includes("未追问")
      ? "未追问-基本解决"
      : "未解决";
  return {
    id: stringValue(point.id, `defense-${index}`),
    title,
    risk: stringValue(point.risk, stringValue(point.riskDescription, "该问题可能阻碍客户继续推进。")),
    trigger: stringValue(point.reason, stringValue(point.trigger, stringValue(point.triggerReason, "根据当前对话识别。"))),
    evidenceMessageId: stringValue(point.evidenceMessageId),
    evidenceQuote: stringValue(point.evidenceQuote),
    evidenceTranslation: stringValue(point.evidenceTranslation),
    status,
    remedy: stringValue(point.remedy, stringValue(point.recommendedAction, "先正面回应客户顾虑，再补充可验证的信息。")),
    suggestedReply: stringValue(point.suggestedReply),
    suggestedReplyTranslation: stringValue(point.suggestedReplyTranslation),
    riskLevel: normalizeStrategyPriority(point.riskLevel),
  };
}

function StrategyReply({ text, translation }: { text: string; translation: string }) {
  if (!text && !translation) return null;
  return <div className="strategy-reply">
    <header><Bot size={14} /><strong>可直接发送的回复</strong>{text && <button type="button" onClick={() => navigator.clipboard.writeText(text)}><Copy size={12} />复制原文</button>}</header>
    {text && <p>{text}</p>}
    {translation && <div><small>中文核对</small><p>{translation}</p></div>}
  </div>;
}

function StrategyEvidence({ messageId, quote, translation, onLocate }: { messageId: string; quote: string; translation: string; onLocate: (messageId?: string, quote?: string) => void }) {
  if (!quote) return <div className="strategy-no-evidence"><CircleAlert size={13} />暂无可逐字核验的原始聊天依据</div>;
  return <div className="strategy-evidence">
    <button type="button" onClick={() => onLocate(messageId, quote)}>已核验原文</button>
    <blockquote>“{quote.replaceAll("“", "").replaceAll("”", "")}”</blockquote>
    {translation && <p><span>中文翻译</span>{translation}</p>}
  </div>;
}

function CommunicationReview({ improvements, onLocate }: { improvements: CommunicationImprovement[]; onLocate: (messageId?: string, quote?: string) => void }) {
  if (!improvements.length) return <div className="strategy-empty"><CheckCircle2 size={16} />当前未识别到有充分依据的明显沟通不足</div>;
  return <div className="communication-review-list">{improvements.map((item, index) => <details key={`${item.title}-${index}`} open>
    <summary><span className={`review-priority priority-${item.priority}`}>{item.priority}</span><strong>{item.title}</strong><ChevronDown size={16} /></summary>
    <div className="communication-review-body">
      <section><small>问题阐述</small><p>{item.issue}</p>{item.customerEvidenceQuote && <StrategyEvidence messageId={item.customerEvidenceMessageId} quote={item.customerEvidenceQuote} translation={item.customerEvidenceTranslation} onLocate={onLocate} />}</section>
      <section><small>销售是怎么处理的</small><p>{item.handling}</p>{item.salesEvidenceQuote && <StrategyEvidence messageId={item.salesEvidenceMessageId} quote={item.salesEvidenceQuote} translation={item.salesEvidenceTranslation} onLocate={onLocate} />}</section>
      <section className="review-recommendation"><small>应该怎么处理</small><p>{item.recommendation}</p></section>
    </div>
  </details>)}</div>;
}

function DecisionMapPanel({ task, onLocate }: { task: CustomerTask; onLocate: (messageId?: string, quote?: string) => void }) {
  const map = task.report.decisionMap;
  const unresolved = map.blockers.filter((item) => item.handlingStatus === "未解决").length;
  return <ReportCard icon={ListChecks} title="成交决策地图" tone="green" sectionId="checklist">
    <div className="decision-overview">
      <div><small>下单动力</small><strong className={`decision-level level-${map.motivationLevel}`}>{map.motivationLevel}</strong></div>
      <div><small>成交准备度</small><strong className={`decision-level level-${map.readiness}`}>{map.readiness}</strong></div>
      <div className="wide"><small>最大阻力</small><strong>{map.biggestBlocker}</strong></div>
      <div className="wide priority"><small>当前首要任务</small><strong>{map.priorityTask}</strong></div>
    </div>
    <p className="strategy-intro">这里只判断客户为什么想买、为什么还没买。完整跟进话术统一放在“AI 下一步建议”，避免报告重复。</p>
    <div className="strategy-columns decision-map-columns">
      <section className="strategy-column offense-column">
        <header><div><Zap size={17} /><strong>核心下单驱动力</strong></div><span>{map.buyingDrivers.length} 个</span></header>
        {!map.buyingDrivers.length && <div className="strategy-empty"><CircleDashed size={17} />尚未识别到有客户原文支撑的核心下单动力</div>}
        {map.buyingDrivers.map((item, index) => <details className="strategy-item offense-item" key={`${item.title}-${index}`} open={index === 0}>
          <summary><span className={`strategy-level level-${item.strength === "强" ? "高" : item.strength === "弱" ? "低" : "中"}`}>{item.strength}</span><strong>{item.title}</strong><span className="driver-intent">意愿 {item.purchaseIntent}</span><ChevronDown size={15} /></summary>
          <div className="strategy-item-body"><dl>
            <div><dt>客户想获得什么</dt><dd>{item.desiredOutcome}</dd></div>
            <div><dt>背后的痛点或期望</dt><dd>{item.painOrExpectation}</dd></div>
            <div><dt>为什么能够推动成交</dt><dd>{item.conversionReason}</dd></div>
          </dl><StrategyEvidence messageId={item.evidenceMessageId} quote={item.evidenceQuote} translation={item.evidenceTranslation} onLocate={onLocate} /></div>
        </details>)}
      </section>
      <section className="strategy-column defense-column">
        <header><div><ShieldCheck size={17} /><strong>当前成交阻力</strong></div><span>{unresolved}/{map.blockers.length} 未解决</span></header>
        {!map.blockers.length && <div className="strategy-empty safe"><CheckCircle2 size={17} />当前未识别到有原文支撑的明确成交阻力</div>}
        {map.blockers.map((item, index) => <details className="strategy-item defense-item" key={`${item.title}-${index}`} open={index === 0}>
          <summary><span className="blocker-category">{item.category}</span><strong>{item.title}</strong><span className={`strategy-status blocker-status status-${item.handlingStatus}`}>{item.handlingStatus}</span><ChevronDown size={15} /></summary>
          <div className="strategy-item-body"><dl>
            <div><dt>客户具体担心什么</dt><dd>{item.concern}</dd></div>
            <div><dt>对成交的影响</dt><dd>{item.dealImpact}</dd></div>
            <div><dt>解决方向</dt><dd>{item.solutionDirection}</dd></div>
          </dl>
          <StrategyEvidence messageId={item.evidenceMessageId} quote={item.evidenceQuote} translation={item.evidenceTranslation} onLocate={onLocate} />
          {item.salesEvidenceQuote && <div className="sales-handling-evidence"><strong>销售处理依据</strong><StrategyEvidence messageId={item.salesEvidenceMessageId} quote={item.salesEvidenceQuote} translation={item.salesEvidenceTranslation} onLocate={onLocate} /></div>}
          {item.resolutionEvidenceQuote && <div className="resolution-evidence"><strong>客户认可依据</strong><StrategyEvidence messageId={item.resolutionEvidenceMessageId} quote={item.resolutionEvidenceQuote} translation={item.resolutionEvidenceTranslation} onLocate={onLocate} /></div>}
          </div>
        </details>)}
      </section>
    </div>
  </ReportCard>;
}

function OffenseDefensePanel({ task, onLocate }: { task: CustomerTask; onLocate: (messageId?: string, quote?: string) => void }) {
  const report = task.report as unknown as { offensePoints?: unknown[]; defensePoints?: unknown[] };
  const offensePoints = (Array.isArray(report.offensePoints) ? report.offensePoints : []).map(normalizeOffensePoint).filter((point): point is OffensePointView => Boolean(point));
  const defensePoints = (Array.isArray(report.defensePoints) ? report.defensePoints : []).map(normalizeDefensePoint).filter((point): point is DefensePointView => Boolean(point));
  const highRiskCount = defensePoints.filter((point) => point.riskLevel === "高" && point.status !== "客户肯定-完全解决").length;

  return <ReportCard icon={ListChecks} title="进攻点与防守点" tone="green" sectionId="checklist">
    <div className="strategy-summary">
      <div className="offense"><Zap size={16} /><span>进攻点</span><strong>{offensePoints.length}</strong></div>
      <div className="defense"><ShieldCheck size={16} /><span>防守点</span><strong>{defensePoints.length}</strong></div>
      <div className={`high-risk ${highRiskCount ? "active" : ""}`}><CircleAlert size={16} /><span>高风险</span><strong>{highRiskCount}</strong></div>
    </div>
    <p className="strategy-intro">从完整对话中识别当前可以主动推进的机会，以及成交前必须守住的风险。结论只采用可核验的真实聊天原文。</p>
    <div className="strategy-columns">
      <section className="strategy-column offense-column">
        <header><div><Zap size={17} /><strong>进攻点</strong></div><span>{offensePoints.length} 个机会</span></header>
        {!offensePoints.length && <div className="strategy-empty"><CircleDashed size={17} />当前对话暂未识别到可靠的进攻机会</div>}
        {offensePoints.map((point, index) => <details className="strategy-item offense-item" key={point.id} open={index === 0}>
          <summary><span className={`strategy-level level-${point.priority}`}>{point.priority}</span><strong>{point.title}</strong><ChevronDown size={15} /></summary>
          <div className="strategy-item-body">
            <div className="strategy-meta"><span>目标 · {point.goal}</span><span>优先级 · {point.priority}</span></div>
            <dl><div><dt>机会判断</dt><dd>{point.opportunity}</dd></div><div><dt>为什么现在适合推进</dt><dd>{point.timing}</dd></div><div><dt>推荐推进方向</dt><dd>{point.direction}</dd></div></dl>
            <StrategyEvidence messageId={point.evidenceMessageId} quote={point.evidenceQuote} translation={point.evidenceTranslation} onLocate={onLocate} />
            <StrategyReply text={point.suggestedReply} translation={point.suggestedReplyTranslation} />
          </div>
        </details>)}
      </section>
      <section className="strategy-column defense-column">
        <header><div><ShieldCheck size={17} /><strong>防守点</strong></div><span>{defensePoints.length} 个风险</span></header>
        {!defensePoints.length && <div className="strategy-empty safe"><CheckCircle2 size={17} />当前对话暂未识别到可靠的防守风险</div>}
        {defensePoints.map((point, index) => <details className="strategy-item defense-item" key={point.id} open={index === 0}>
          <summary><span className={`strategy-level level-${point.riskLevel}`}>{point.riskLevel}</span><strong>{point.title}</strong><span className={`strategy-status status-${point.status}`}>{point.status}</span><ChevronDown size={15} /></summary>
          <div className="strategy-item-body">
            <div className="strategy-meta"><span>风险等级 · {point.riskLevel}</span><span>{point.status}</span></div>
            <dl><div><dt>风险说明</dt><dd>{point.risk}</dd></div><div><dt>触发原因</dt><dd>{point.trigger}</dd></div><div><dt>建议补救动作</dt><dd>{point.remedy}</dd></div></dl>
            <StrategyEvidence messageId={point.evidenceMessageId} quote={point.evidenceQuote} translation={point.evidenceTranslation} onLocate={onLocate} />
            <StrategyReply text={point.suggestedReply} translation={point.suggestedReplyTranslation} />
          </div>
        </details>)}
      </section>
    </div>
  </ReportCard>;
}


function RawChatPanel({ task, onClose, onUpdate, onSync, syncing = false, target }: { task: CustomerTask; onClose: () => void; onUpdate: (task: CustomerTask) => void; onSync?: () => Promise<void>; syncing?: boolean; target: { messageId?: string; quote: string; nonce: number } | null }) {
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [lockedIndex, setLockedIndex] = useState<number | null>(null);
  const messageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const messages = useMemo(() => parseConversationMessages(task.rawConversation), [task.rawConversation]);
  const savedTranslation = task.rawTranslation?.source === task.rawConversation && task.rawTranslation.lines.length === messages.length
    ? task.rawTranslation.lines
    : undefined;

  useEffect(() => {
    if (!target?.messageId && !target?.quote) return;
    const messageIdIndex = target.messageId ? messages.findIndex((message) => message.id === target.messageId) : -1;
    if (messageIdIndex >= 0) {
      setLockedIndex(messageIdIndex);
      setHighlightedIndex(messageIdIndex);
      messageRefs.current[messageIdIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
      const timer = window.setTimeout(() => setHighlightedIndex(null), 1800);
      return () => window.clearTimeout(timer);
    }
    const cleanQuote = target.quote.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "").replace(/^(?:\[[^\]]+\]\s*)?(?:Customer|Sales|客户|销售)\s*:\s*/i, "").trim();
    const normalize = (text: string) => text.normalize("NFKC").replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLocaleLowerCase();
    const needle = normalize(cleanQuote);
    if (!needle) return;
    const index = messages.findIndex((message) => normalize(message.content).includes(needle) || needle.includes(normalize(message.content)));
    if (index < 0) return;
    setLockedIndex(index);
    setHighlightedIndex(index);
    messageRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => setHighlightedIndex(null), 1800);
    return () => window.clearTimeout(timer);
  }, [messages, target]);

  const translate = async () => {
    setTranslating(true);
    setTranslationError("");
    try {
      const response = await fetch("/api/translate-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: messages.map((item) => item.content) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "聊天翻译失败");
      const lines = Array.isArray(data.translations) ? data.translations.map(String) : [];
      if (lines.length !== messages.length) throw new Error("翻译条数与聊天消息不一致");
      onUpdate({ ...task, rawTranslation: { source: task.rawConversation, lines, translatedAt: new Date().toISOString() } });
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : "聊天翻译失败");
    } finally {
      setTranslating(false);
    }
  };

  return <aside className="raw-side-panel">
    <header><div><span className="eyebrow">SOURCE DATA</span><h2>原始聊天记录</h2></div><div className="drawer-actions">{lockedIndex !== null && <button className="secondary-button raw-unlock" onClick={() => setLockedIndex(null)}><Link2 size={15} />解除锁定</button>}{onSync && <button className="secondary-button" onClick={() => void onSync()} disabled={syncing}><Cloud size={15} className={syncing ? "spin" : ""} />{syncing ? "同步中" : "同步"}</button>}<button className="secondary-button" onClick={() => void translate()} disabled={translating}><Languages size={15} />{translating ? "翻译中…" : savedTranslation ? "重新翻译" : "翻译"}</button><button className="icon-button raw-close-button" onClick={onClose}><X size={18} /></button></div></header>
    <div className="drawer-meta"><span>{sourceMeta[task.source].label}</span><span>{customerDisplayName(task.customer)}</span><span>{messages.length} 条消息</span></div>
    {translationError && <div className="raw-translation-error"><CircleAlert size={14} />{translationError}</div>}
    <div className="raw-chat-scroll">
      {messages.map((message, index) => <div ref={(element) => { messageRefs.current[index] = element; }} className={`raw-message ${message.role} ${highlightedIndex === index ? "flash-highlight" : ""} ${lockedIndex === index ? "locked-highlight" : ""}`} key={`${index}-${message.content.slice(0, 20)}`}>
        <div className="raw-message-meta"><strong>{message.label}</strong><span>{message.id}</span>{message.time && <span>{message.time}</span>}</div>
        <div className="raw-message-bubble"><p>{message.content}</p>{savedTranslation?.[index] && <div className="raw-message-translation"><span>中文</span><p>{savedTranslation[index]}</p></div>}</div>
      </div>)}
    </div>
  </aside>;
}

interface SaleSmartlyCustomerOption {
  id: string;
  name: string;
  remark: string;
  email: string;
  phone: string;
  channel: string;
  country: string;
  language: string;
  lastMessageAt: string;
}

function ImportPreviewPanel({ preview, selectedConversationKey, onConversationChange, onRoleChange, batchMode = false, onBatchModeChange }: {
  preview: ImportPreview;
  selectedConversationKey: string;
  onConversationChange: (key: string) => void;
  onRoleChange: (messageId: string, sender: string, role: "customer" | "sales" | "unknown" | "system") => void;
  batchMode?: boolean;
  onBatchModeChange?: (value: boolean) => void;
}) {
  const messages = preview.messages.filter((message) => batchMode || !selectedConversationKey || message.conversationKey === selectedConversationKey);
  const customerCount = messages.filter((message) => message.role === "customer").length;
  const salesCount = messages.filter((message) => message.role === "sales").length;
  const unknownCount = messages.filter((message) => message.role === "unknown").length;
  return <div className="import-preview">
    <div className="import-preview-head"><div><CheckCircle2 size={18} /><div><strong>智能识别完成</strong><span>置信度 {Math.round(preview.overallConfidence * 100)}%</span></div></div><div><span>客户 {customerCount}</span><span>销售 {salesCount}</span>{unknownCount > 0 && <span className="unknown">待确认 {unknownCount}</span>}</div></div>
    {preview.detectedConversations.length > 1 && <div className="conversation-picker"><div><span>检测到多个客户或会话</span><label><input type="radio" checked={!batchMode} onChange={() => onBatchModeChange?.(false)} />仅创建所选会话</label><label><input type="radio" checked={batchMode} onChange={() => onBatchModeChange?.(true)} />批量创建全部任务</label></div><select value={selectedConversationKey} onChange={(event) => onConversationChange(event.target.value)} disabled={batchMode}>{preview.detectedConversations.map((key) => { const group = preview.messages.filter((message) => message.conversationKey === key); const name = group.find((message) => message.customerName)?.customerName; return <option value={key} key={key}>{name ? `${name} · ` : ""}{key} · {group.length} 条</option>; })}</select></div>}
    {!!preview.mappingSummary.length && <div className="import-mapping-summary">{preview.mappingSummary.map((item) => <span key={item}><Check size={11} />{item}</span>)}</div>}
    {!!preview.warnings.length && <div className="import-warnings">{preview.warnings.map((item) => <p key={item}><CircleAlert size={12} />{item}</p>)}</div>}
    <div className="import-message-list">
      {messages.map((message) => <article className={`import-message role-${message.role}`} key={message.id}>
        <header><div><strong>{message.sender || "未识别发送人"}</strong>{message.time && <span>{message.time}</span>}<small>{message.sourceRef}</small></div><label><select value={message.role} onChange={(event) => onRoleChange(message.id, message.sender, event.target.value as "customer" | "sales" | "unknown" | "system")}><option value="customer">客户</option><option value="sales">销售</option><option value="unknown">待确认</option><option value="system">系统消息（排除）</option></select><span className={`message-confidence ${message.confidence < .65 ? "low" : ""}`}>{Math.round(message.confidence * 100)}%</span></label></header>
        <p>{message.content}</p>
      </article>)}
    </div>
    <p className="import-preview-note">修改某位发送人的角色会同步应用到该发送人的全部消息。系统消息不会进入分析。</p>
  </div>;
}

function NewTaskModal({ onClose, onCreate, onUpdate }: { onClose: () => void; onCreate: (task: CustomerTask) => void; onUpdate: (task: CustomerTask) => void }) {
  const [step, setStep] = useState<ImportStep>("source");
  const [conversation, setConversation] = useState("");
  const [fileName, setFileName] = useState("");
  const [rawImportData, setRawImportData] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [selectedConversationKey, setSelectedConversationKey] = useState("");
  const [batchImport, setBatchImport] = useState(false);
  const [parsingImport, setParsingImport] = useState(false);
  const [customerName, setCustomerName] = useState("新客户");
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<SaleSmartlyCustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [customerTotal, setCustomerTotal] = useState<number | null>(null);
  const [loadedCustomers, setLoadedCustomers] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function searchCustomers(term = searchTerm) {
    setSearching(true);
    setSourceError("");
    try {
      const response = await fetch(`/api/salesmartly/customers?q=${encodeURIComponent(term.trim())}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "搜索客户失败");
      const nextCustomers = (data.customers ?? []) as SaleSmartlyCustomerOption[];
      setCustomers(nextCustomers);
      setCustomerTotal(typeof data.total === "number" ? data.total : nextCustomers.length);
      setSelectedCustomerId((current) => nextCustomers.some((item) => item.id === current) ? current : nextCustomers[0]?.id || "");
      setLoadedCustomers(true);
    } catch (error) {
      setCustomers([]);
      setSelectedCustomerId("");
      setSourceError(error instanceof Error ? error.message : "搜索客户失败");
      setLoadedCustomers(true);
    } finally { setSearching(false); }
  }

  useEffect(() => {
    if (step === "salesmartly" && !loadedCustomers) void searchCustomers("");
  }, [step, loadedCustomers]);

  const create = async () => {
    setCreating(true);
    setSourceError("");
    const source = step === "source" ? "text" : step;
    const selectedCustomer = customers.find((item) => item.id === selectedCustomerId);
    if (source === "salesmartly" && !selectedCustomer) {
      setSourceError("请先选择一个 SaleSmartly 客户");
      setCreating(false);
      return;
    }
    const previewMessages = importPreview?.messages.filter((message) => !selectedConversationKey || message.conversationKey === selectedConversationKey) ?? [];
    const previewCustomerName = previewMessages.find((message) => message.customerName)?.customerName;
    const name = source === "salesmartly" ? selectedCustomer?.name || "SaleSmartly 客户" : customerName || previewCustomerName || "新客户";
    const displayName = source === "salesmartly" && selectedCustomer ? customerDisplayName(selectedCustomer) : name;
    const normalizedImportConversation = source === "salesmartly" ? conversation : previewMessages.filter((message) => message.role !== "system").map((message) => `${message.time ? `[${message.time}] ` : ""}${message.role === "customer" ? "Customer" : "Sales"}: ${message.content}`).join("\n");
    if (source !== "salesmartly" && batchImport && importPreview && importPreview.detectedConversations.length > 1) {
      const batchTasks = importPreview.detectedConversations.flatMap((key, index) => {
        const group = importPreview.messages.filter((message) => message.conversationKey === key && (message.role === "customer" || message.role === "sales"));
        if (!group.length || group.some((message) => message.role === "unknown")) return [];
        const groupName = group.find((message) => message.customerName)?.customerName || `${customerName || "新客户"} ${index + 1}`;
        const groupConversation = group.map((message) => `${message.time ? `[${message.time}] ` : ""}${message.role === "customer" ? "Customer" : "Sales"}: ${message.content}`).join("\n");
        return [normalizeTask({
          id: `task-${Date.now()}-${index}`,
          name: `${groupName} · 正在分析`,
          source,
          status: "analyzing",
          analysisStep: "analyzing",
          updatedAt: "刚刚",
          customer: { name: groupName, country: "待识别", owner: "Tina", product: "待识别", channel: sourceMeta[source].label, lastMessageAt: new Date().toLocaleString("zh-CN") },
          rawConversation: groupConversation,
          report: { ...emptyReport, confirmations: defaultConfirmations.map((item) => ({ ...item })) },
          progress: defaultProgress.map((item) => ({ ...item, state: "todo", locked: false })),
          provider: "deepseek",
          model: "AI",
        })];
      });
      if (!batchTasks.length) {
        setSourceError("没有可批量创建的有效会话，请先确认消息角色");
        setCreating(false);
        return;
      }
      batchTasks.forEach((batchTask) => onCreate(batchTask));
      // 两个一组运行，避免批量文件瞬间放大为过多大模型并发请求。
      for (let index = 0; index < batchTasks.length; index += 2) {
        await Promise.all(batchTasks.slice(index, index + 2).map((batchTask) => analyzeConcurrently(batchTask, batchTask.rawConversation, onUpdate)));
      }
      setCreating(false);
      return;
    }
    const task: CustomerTask = normalizeTask({
      id: `task-${Date.now()}`,
      name: `${displayName} · 正在分析`,
      source,
      status: "analyzing",
      analysisStep: source === "salesmartly" ? "importing" : "analyzing",
      updatedAt: "刚刚",
      customer: {
        name,
        remark: selectedCustomer?.remark || undefined,
        externalId: selectedCustomer?.id,
        country: selectedCustomer?.country || "待识别",
        owner: "Tina",
        product: "待识别",
        channel: selectedCustomer?.channel || sourceMeta[source].label,
        lastMessageAt: selectedCustomer?.lastMessageAt || new Date().toLocaleString("zh-CN"),
      },
      rawConversation: normalizedImportConversation,
      report: { ...emptyReport, confirmations: defaultConfirmations.map((item) => ({ ...item })) },
      progress: defaultProgress.map((item) => ({ ...item, state: "todo", locked: false })),
      provider: "deepseek",
      model: "AI",
    });
    // 立即创建并选中任务；耗时的同步和分析继续在后台完成。
    onCreate(task);
    let workingTask = task;
    try {
      let importedConversation = normalizedImportConversation;
      let importedMessageCount = 0;
      if (source === "salesmartly" && selectedCustomer) {
        const response = await fetch(`/api/salesmartly/messages?chatUserId=${encodeURIComponent(selectedCustomer.id)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "读取聊天记录失败");
        importedConversation = data.conversation || "";
        importedMessageCount = data.messageCount || 0;
        if (!importedConversation.trim()) {
          const rawCount = Number(data.rawMessageCount ?? 0);
          const total = Number(data.total ?? 0);
          if (rawCount === 0) {
            throw new Error(`SaleSmartly 消息接口返回 0 条记录（total: ${total}）。请确认该客户在当前 Project ID 下确实存在聊天内容。`);
          }
          throw new Error(
            `SaleSmartly 返回 ${rawCount} 条记录，但均为系统通知或已撤回消息（系统 ${Number(data.systemMessageCount ?? 0)} 条，撤回 ${Number(data.withdrawnMessageCount ?? 0)} 条）。`,
          );
        }
        workingTask = { ...workingTask, rawConversation: importedConversation, name: `${displayName} · ${importedMessageCount} 条消息`, analysisStep: "analyzing" };
        onUpdate(workingTask);
      }
      if (!importedConversation.trim()) importedConversation = "Customer: Please send me more information about your product and pricing.";
      workingTask = normalizeTask({
        ...workingTask,
        name: source === "salesmartly" ? `${displayName} · ${importedMessageCount} 条消息` : `${name} · 新分析`,
        rawConversation: importedConversation,
      });
      await analyzeConcurrently(workingTask, importedConversation, onUpdate);
    } catch (error) {
      onUpdate({ ...workingTask, status: "failed", analysisStep: undefined, analysisError: error instanceof Error ? error.message : "创建分析任务失败" });
    } finally { setCreating(false); }
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setSourceError("文件超过 20MB，请拆分后重新导入");
      return;
    }
    setSourceError("");
    setFileName(file.name);
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer());
    const sheets = workbook.SheetNames.map((sheetName) => ({ sheetName, rows: XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "", raw: false }) }));
    const serialized = JSON.stringify(sheets);
    setRawImportData(serialized);
    setConversation("");
    setImportPreview(null);
    setSelectedConversationKey("");
    setBatchImport(false);
  };

  const parseImport = async () => {
    const source = step === "excel" ? "excel" : "text";
    const rawData = source === "excel" ? rawImportData : conversation;
    if (!rawData.trim()) return setSourceError(source === "excel" ? "请先选择 Excel 或 CSV 文件" : "请先粘贴聊天记录");
    setParsingImport(true);
    setSourceError("");
    try {
      const response = await fetch("/api/import-parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, rawData, customerHint: customerName === "新客户" ? "" : customerName }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "智能导入识别失败");
      const preview = data.preview as ImportPreview;
      setImportPreview(preview);
      setSelectedConversationKey(preview.detectedConversations[0] || preview.messages[0]?.conversationKey || "default");
      setBatchImport(false);
      const detectedName = preview.messages.find((message) => message.customerName)?.customerName || preview.detectedCustomers[0];
      if (detectedName && customerName === "新客户") setCustomerName(detectedName);
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "智能导入识别失败");
    } finally {
      setParsingImport(false);
    }
  };

  const updateSenderRole = (messageId: string, sender: string, role: "customer" | "sales" | "unknown" | "system") => {
    setImportPreview((current) => current ? { ...current, messages: current.messages.map((message) => sender ? message.sender === sender ? { ...message, role, confidence: 1 } : message : message.id === messageId ? { ...message, role, confidence: 1 } : message) } : current);
  };

  const selectedPreviewMessages = importPreview?.messages.filter((message) => batchImport || !selectedConversationKey || message.conversationKey === selectedConversationKey) ?? [];
  const selectedAnalyzableMessages = selectedPreviewMessages.filter((message) => message.role === "customer" || message.role === "sales");
  const previewUnknownCount = selectedPreviewMessages.filter((message) => message.role === "unknown").length;

  return (
    <div className="modal-wrap"><div className="overlay" onClick={onClose} /><section className="modal">
      <header><div>{step !== "source" && <button className="back-button" onClick={() => setStep("source")}><ChevronRight size={18} /></button>}<span className="eyebrow">NEW ANALYSIS</span><h2>创建分析任务</h2><p>选择一种聊天数据来源，稍后仍可同步或补充。</p></div><button className="icon-button" onClick={onClose}><X size={19} /></button></header>
      {step === "source" && <div className="source-grid">
        {(Object.keys(sourceMeta) as SourceType[]).map((key) => {
          const item = sourceMeta[key];
          const descriptions = { salesmartly: "选择并同步一个客户的聊天记录", text: "粘贴任意格式的对话文本", excel: "上传 Excel 或 CSV 并自动解析" };
          return <button key={key} onClick={() => { setStep(key); setImportPreview(null); setSelectedConversationKey(""); setBatchImport(false); setSourceError(""); }}><span className={`source-large ${item.color}`}><item.icon size={24} /></span><strong>{item.label}</strong><p>{descriptions[key]}</p><ChevronRight size={18} /></button>;
        })}
      </div>}
      {step === "salesmartly" && <div className="modal-body">
        <label className="form-label">搜索 SaleSmartly 客户</label><div className="salesmartly-search"><label className="search-box large"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchCustomers(); } }} placeholder="姓名、邮箱、手机号或客户 ID" /></label><button className="secondary-button" onClick={() => void searchCustomers()} disabled={searching}>{searching ? <RefreshCw className="spin" size={15} /> : <Search size={15} />}{searching ? "搜索中" : "搜索"}</button></div>
        <div className={sourceError ? "connection-error" : "connection-ok"}><CircleAlert size={15} />{sourceError || (searching ? "正在连接 SaleSmartly…" : customerTotal == null ? "正在读取客户" : `已连接 SaleSmartly · 共 ${customerTotal} 位客户`)}</div>
        <div className="customer-options">{customers.map((customer) => <button className={selectedCustomerId === customer.id ? "selected" : ""} key={customer.id} onClick={() => setSelectedCustomerId(customer.id)}><div className="avatar small">{initials(customer.name)}</div><div><strong>{customerDisplayName(customer)}</strong><span>{customer.channel}{customer.email ? ` · ${customer.email}` : customer.phone ? ` · ${customer.phone}` : ""}</span><small>{customer.lastMessageAt}</small></div>{selectedCustomerId === customer.id && <Check size={17} />}</button>)}{loadedCustomers && !searching && !sourceError && !customers.length && <div className="empty-customers">没有找到匹配客户，请更换关键词。</div>}</div>
      </div>}
      {step === "text" && <div className="modal-body import-smart-body"><label className="form-label">客户名称（可选提示）</label><input className="text-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="例如 James Carter" />{!importPreview ? <><label className="form-label">粘贴聊天记录</label><textarea className="import-textarea" value={conversation} onChange={(e) => { setConversation(e.target.value); setImportPreview(null); }} placeholder="支持 WhatsApp、Messenger、SaleSmartly 或任意带姓名/时间的复制文本" /><p className="field-help">AI 只识别结构，不会翻译、改写或补写原始聊天。</p></> : <ImportPreviewPanel preview={importPreview} selectedConversationKey={selectedConversationKey} onConversationChange={setSelectedConversationKey} onRoleChange={updateSenderRole} batchMode={batchImport} onBatchModeChange={setBatchImport} />}{sourceError && <div className="import-parse-error"><CircleAlert size={14} />{sourceError}</div>}</div>}
      {step === "excel" && <div className="modal-body import-smart-body"><label className="form-label">客户名称（可选提示）</label><input className="text-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /><input ref={fileRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void readFile(e.target.files?.[0])} />{!importPreview ? <><button className={`dropzone ${fileName ? "has-file" : ""}`} onClick={() => fileRef.current?.click()}><span><FileSpreadsheet size={28} /></span><strong>{fileName || "点击选择 Excel 或 CSV 文件"}</strong><p>{fileName ? "文件已读取，等待智能识别" : "支持 .xlsx、.xls、.csv，最大 20MB"}</p></button><div className="mapping-preview"><strong>AI 智能映射</strong><span>工作表与会话</span><span>时间与发送人</span><span>客户与销售角色</span><span>消息内容</span></div></> : <ImportPreviewPanel preview={importPreview} selectedConversationKey={selectedConversationKey} onConversationChange={setSelectedConversationKey} onRoleChange={updateSenderRole} batchMode={batchImport} onBatchModeChange={setBatchImport} />}{sourceError && <div className="import-parse-error"><CircleAlert size={14} />{sourceError}</div>}</div>}
      {step !== "source" && <footer>{importPreview && (step === "text" || step === "excel") && <button className="secondary-button import-reparse" onClick={() => { setImportPreview(null); setSelectedConversationKey(""); setSourceError(""); }} disabled={creating || parsingImport}>返回修改</button>}<button className="secondary-button" onClick={onClose} disabled={creating || parsingImport}>取消</button>{(step === "text" || step === "excel") && !importPreview ? <button className="primary-button" onClick={() => void parseImport()} disabled={parsingImport || (step === "excel" ? !fileName : !conversation.trim())}>{parsingImport ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}{parsingImport ? "AI 正在识别格式…" : "智能识别并预览"}</button> : <button className="primary-button" onClick={() => void create()} disabled={creating || (step === "salesmartly" && !selectedCustomerId) || ((step === "text" || step === "excel") && (!selectedAnalyzableMessages.length || previewUnknownCount > 0))}>{creating ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}{creating ? "读取聊天并分析中…" : previewUnknownCount > 0 ? `请先确认 ${previewUnknownCount} 条角色` : "确认并创建分析"}</button>}</footer>}
    </section></div>
  );
}

function KnowledgeView({ kind, isAdmin }: { kind: "scripts" | "products"; isAdmin: boolean }) {
  const scripts = kind === "scripts";
  if (scripts) return <ScriptKnowledgeView isAdmin={isAdmin} />;
  return <section className="page-view">
    <div className="page-header"><div><span className="eyebrow">KNOWLEDGE BASE</span><h1>产品知识库</h1><p>统一维护产品事实、文件和可对外表达的内容。</p></div><button className="primary-button"><Plus size={17} />新建产品</button></div>
    <div className="stats-row">
      {[["产品总数", "26", "+2 本月"], ["资料完整", "18", "69%"], ["关联话术", "127", "+8"], ["待更新文件", "6", "需要处理"]].map(([label, value, note], i) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong><small className={i === 2 || i === 3 ? "warning" : ""}>{note}</small></div>)}
    </div>
    <div className="table-card">
      <div className="table-toolbar"><label className="search-box"><Search size={16} /><input placeholder="搜索产品或分类" /></label><button className="filter-button">全部分类 <ChevronDown size={14} /></button><button className="filter-button">全部状态 <ChevronDown size={14} /></button><button className="secondary-button"><Upload size={16} />批量导入</button></div>
      <table><thead><tr><th>产品名称</th><th>分类</th><th>关联文件</th><th>关联话术</th><th>资料完整度</th><th>最后更新</th></tr></thead><tbody>{productRows.map((row) => <tr key={row.name}><td><div className="name-cell"><span className="product-icon"><FlaskConical size={16} /></span><strong>{row.name}</strong></div></td><td><span className="table-tag">{row.category}</span></td><td>{row.docs} 个</td><td>{row.scripts} 条</td><td><div className="completion"><i><b style={{ width: `${row.completeness}%` }} /></i><span>{row.completeness}%</span></div></td><td>{row.updated}</td></tr>)}</tbody></table>
    </div>
  </section>;
}

type ScriptDraft = Omit<KnowledgeScript, "id" | "usageCount" | "createdAt" | "updatedAt">;
const emptyScriptDraft: ScriptDraft = { title: "", scenario: "", products: [], customerRoles: [], triggerText: "", content: "", translation: "", language: "EN", tags: [], status: "draft", priority: 50 };

function ScriptKnowledgeView({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<KnowledgeScript[]>([]);
  const [status, setStatus] = useState<"" | "draft" | "published">("");
  const [copiedKey, setCopiedKey] = useState("");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState("");
  const [translationStartedAt, setTranslationStartedAt] = useState(0);
  const [translationElapsed, setTranslationElapsed] = useState(0);
  const [editing, setEditing] = useState<KnowledgeScript | null | "new">(null);
  const [draft, setDraft] = useState<ScriptDraft>(emptyScriptDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadScripts = async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const response = await fetch(`/api/knowledge/scripts?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "读取话术失败");
      setItems(data.scripts ?? []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "读取话术失败"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadScripts(); }, [status]);
  useEffect(() => {
    if (!translatingId || !translationStartedAt) return;
    const timer = window.setInterval(() => setTranslationElapsed((Date.now() - translationStartedAt) / 1000), 100);
    return () => window.clearInterval(timer);
  }, [translatingId, translationStartedAt]);

  const copyText = async (key: string, value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => current === key ? "" : current), 1600);
    } catch { setError("复制失败，请检查浏览器剪贴板权限。"); }
  };

  const translateScript = async (script: KnowledgeScript) => {
    if (translations[script.id] || translatingId) return;
    setTranslatingId(script.id); setTranslationStartedAt(Date.now()); setTranslationElapsed(0); setError("");
    try {
      const response = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: script.content, sourceLanguage: "Auto detect", targetLanguage: "English", tone: "professional" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "翻译失败");
      setTranslations((current) => ({ ...current, [script.id]: data.translation || script.translation }));
    } catch (translationError) {
      if (script.translation.trim()) setTranslations((current) => ({ ...current, [script.id]: script.translation }));
      else setError(translationError instanceof Error ? translationError.message : "翻译失败");
    } finally { setTranslatingId(""); setTranslationStartedAt(0); }
  };

  const openEditor = (script?: KnowledgeScript) => {
    setError("");
    if (!script) { setEditing("new"); setDraft({ ...emptyScriptDraft, products: [], customerRoles: [], tags: [] }); return; }
    setEditing(script); setDraft({ title: script.title, scenario: script.scenario, products: [...script.products], customerRoles: [...script.customerRoles], triggerText: script.triggerText, content: script.content, translation: script.translation, language: script.language, tags: [...script.tags], status: script.status, priority: script.priority });
  };
  const listChange = (key: "products" | "customerRoles" | "tags", value: string) => setDraft((current) => ({ ...current, [key]: value.split(/[,，;；]/).map((item) => item.trim()).filter(Boolean) }));
  const save = async () => {
    if (!draft.title.trim() || !draft.content.trim()) { setError("请填写话术标题和正文"); return; }
    setSaving(true); setError("");
    try {
      const isNew = editing === "new";
      const response = await fetch(isNew ? "/api/knowledge/scripts" : `/api/knowledge/scripts/${(editing as KnowledgeScript).id}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存话术失败");
      if (editing !== "new" && editing) setTranslations((current) => { const next = { ...current }; delete next[editing.id]; return next; });
      setEditing(null); await loadScripts();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "保存话术失败"); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!isAdmin || !editing || editing === "new" || !window.confirm(`确定删除“${editing.title}”吗？`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/knowledge/scripts/${editing.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "删除话术失败");
      setEditing(null); await loadScripts();
    } catch (removeError) { setError(removeError instanceof Error ? removeError.message : "删除话术失败"); }
    finally { setSaving(false); }
  };

  const renderScriptCard = (row: KnowledgeScript) => {
          const translated = translations[row.id];
          const isTranslating = translatingId === row.id;
          return <article className="script-copy-item" key={row.id}>
            <header><div><div className="script-card-meta"><span>{row.scenario || "未分类"}</span>{row.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div></div><div className="script-card-actions"><button onClick={() => void translateScript(row)} disabled={Boolean(translatingId) || Boolean(translated)}>{isTranslating ? <RefreshCw className="spin" size={14} /> : <Languages size={14} />}{isTranslating ? `${translationElapsed.toFixed(1)}s` : translated ? "已翻译" : "翻译成英语"}</button><button aria-label={`编辑 ${row.title}`} onClick={() => openEditor(row)}><Pencil size={14} /></button></div></header>
            <button className="script-copy-panel original" onClick={() => void copyText(`original-${row.id}`, row.content)}><span><strong>话术内容</strong><small>{copiedKey === `original-${row.id}` ? "已复制" : "点击卡片复制"}</small></span><p>{row.content}</p><Copy size={15} /></button>
            {(translated || isTranslating) && <button className={`script-copy-panel translation ${isTranslating ? "loading" : ""}`} disabled={isTranslating} onClick={() => void copyText(`translation-${row.id}`, translated || "")}><span><strong>英文翻译</strong><small>{isTranslating ? `${translationElapsed.toFixed(1)}s · 正在翻译` : copiedKey === `translation-${row.id}` ? "已复制" : "点击卡片复制翻译"}</small></span>{isTranslating ? <div className="script-translation-loading"><i /><i /><i /></div> : <p>{translated}</p>}{!isTranslating && <Copy size={15} />}</button>}
          </article>;
  };

  return <section className="page-view script-library-view">
    <div className="page-header"><div><span className="eyebrow">SCRIPT MIND MAP</span><h1>话术库</h1><p>沿场景分支寻找话术，或搜索后直接定位。点击原文与译文即可复制。</p></div><div className="mind-header-actions"><select aria-label="话术状态" className="filter-select" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option></select><button className="primary-button" onClick={() => openEditor()}><Plus size={17} />新建话术</button></div></div>
    {error && !editing && <div className="knowledge-error"><CircleAlert size={15} />{error}<button className="secondary-button" onClick={() => void loadScripts()}>重新加载</button></div>}
    {loading ? <div className="knowledge-empty"><RefreshCw className="spin" size={18} />正在读取话术库…</div> : <ScriptMindMap items={items} renderCard={renderScriptCard} />}
    {editing && <div className="script-editor-wrap"><div className="overlay" onClick={() => !saving && setEditing(null)} /><section className="script-editor">
      <header><div><span className="eyebrow">{editing === "new" ? "NEW SCRIPT" : "SCRIPT DETAIL"}</span><h2>{editing === "new" ? "新建话术" : "查看与编辑话术"}</h2><p>话术仅供员工手动查找和复制，不参与客户分析。</p></div><button className="icon-button" onClick={() => setEditing(null)} disabled={saving}><X size={19} /></button></header>
      <div className="script-editor-body">
        <label className="script-field wide-field"><span>话术名称 *</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：客户认为价格太高" /></label>
        <label className="script-field"><span>场景路径（用 / 分层，留空放入未分类）</span><input value={draft.scenario} onChange={(event) => setDraft({ ...draft, scenario: event.target.value })} placeholder="建立信任 / 担心被骗 / 首次交易" /></label>
        <label className="script-field"><span>关联产品（逗号分隔）</span><input value={draft.products.join("，")} onChange={(event) => listChange("products", event.target.value)} placeholder="通用，Reta" /></label>
        <label className="script-field"><span>客户角色（逗号分隔）</span><input value={draft.customerRoles.join("，")} onChange={(event) => listChange("customerRoles", event.target.value)} placeholder="新手个人，经销商" /></label>
        <label className="script-field wide-field"><span>触发条件 / 客户常见说法</span><textarea value={draft.triggerText} onChange={(event) => setDraft({ ...draft, triggerText: event.target.value })} placeholder="客户说价格太高、需要考虑、担心首次付款安全……" /></label>
        <label className="script-field wide-field"><span>推荐话术原文 *</span><textarea className="script-content-input" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="填写销售可以直接参考或改写的话术" /></label>
        <label className="script-field wide-field"><span>中文核对翻译</span><textarea value={draft.translation} onChange={(event) => setDraft({ ...draft, translation: event.target.value })} placeholder="用于人工检查英文话术含义" /></label>
        <label className="script-field"><span>标签（逗号分隔）</span><input value={draft.tags.join("，")} onChange={(event) => listChange("tags", event.target.value)} placeholder="价格，信任，首单" /></label>
        <label className="script-field"><span>语言</span><input value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })} placeholder="EN" /></label>
        <label className="script-field"><span>优先级 0–100</span><input type="number" min={0} max={100} value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })} /></label>
        <label className="script-field"><span>状态</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ScriptDraft["status"] })}><option value="draft">草稿</option><option value="published">已发布</option></select></label>
      </div>
      {error && <div className="script-editor-error"><CircleAlert size={14} />{error}</div>}
      <footer>{isAdmin && editing !== "new" && <button className="danger-button" onClick={() => void remove()} disabled={saving}><Trash2 size={15} />删除</button>}<span /><button className="secondary-button" onClick={() => setEditing(null)} disabled={saving}>取消</button><button className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? <RefreshCw className="spin" size={15} /> : <Pencil size={15} />}{saving ? "保存中…" : "保存话术"}</button></footer>
    </section></div>}
  </section>;
}

const translationLanguages = [
  { value: "zh-CN", label: "简体中文", prompt: "Simplified Chinese" },
  { value: "en", label: "English", prompt: "English" },
  { value: "es", label: "Español", prompt: "Spanish" },
  { value: "fr", label: "Français", prompt: "French" },
  { value: "de", label: "Deutsch", prompt: "German" },
  { value: "pt", label: "Português", prompt: "Portuguese" },
  { value: "ru", label: "Русский", prompt: "Russian" },
  { value: "ar", label: "العربية", prompt: "Arabic" },
  { value: "ja", label: "日本語", prompt: "Japanese" },
  { value: "ko", label: "한국어", prompt: "Korean" },
] as const;

type TranslationTone = "professional" | "friendly" | "concise";

function TranslateView() {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("zh-CN");
  const [tone, setTone] = useState<TranslationTone>("professional");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [translationMeta, setTranslationMeta] = useState("DeepSeek · 商务翻译");
  const languagePrompt = (value: string) => translationLanguages.find((item) => item.value === value)?.prompt || "Auto detect";
  useEffect(() => {
    if (!loading) return;
    const startedAt = performance.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((performance.now() - startedAt) / 1000), 100);
    return () => window.clearInterval(timer);
  }, [loading]);
  const swapLanguages = () => {
    const fallbackTarget = targetLanguage === "zh-CN" ? "en" : "zh-CN";
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage === "auto" ? fallbackTarget : sourceLanguage);
    setSource(target);
    setTarget(source);
    setError("");
  };
  const translate = async () => {
    if (!source.trim()) { setError("请先输入需要翻译的内容"); return; }
    setLoading(true);
    setTarget("");
    setElapsed(0);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          text: source,
          sourceLanguage: sourceLanguage === "auto" ? "Auto detect" : languagePrompt(sourceLanguage),
          targetLanguage: languagePrompt(targetLanguage),
          tone,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "翻译失败");
      setTarget(result.translation);
      const providerName = result.provider === "openai" ? "OpenAI" : "DeepSeek";
      setTranslationMeta(`${providerName} · ${Math.max(0.1, result.elapsedMs / 1000).toFixed(1)} 秒`);
    } catch (requestError) {
      setError(requestError instanceof DOMException && requestError.name === "AbortError" ? "翻译超时，请稍后重试或切换模型" : requestError instanceof Error ? requestError.message : "翻译失败，请稍后重试");
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  };
  return <section className="page-view translate-page">
    <div className="page-header"><div><span className="eyebrow">AI TRANSLATOR</span><h1>AI 翻译</h1><p>保留产品术语、数字和语气的自然商务翻译。</p></div><div className="translation-model"><span className="provider-dot deepseek" />{translationMeta}</div></div>
    <div className="translator-card">
      <div className="language-row"><label className="language-select"><select aria-label="源语言" value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)}><option value="auto">自动检测</option>{translationLanguages.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}</select><ChevronDown size={15} /></label><button className="swap-button" aria-label="交换语言和文本" onClick={swapLanguages}><ArrowLeftRight size={17} /></button><label className="language-select"><select aria-label="目标语言" value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>{translationLanguages.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}</select><ChevronDown size={15} /></label></div>
      <div className="translation-grid"><div><textarea aria-label="需要翻译的内容" maxLength={5000} value={source} onChange={(e) => setSource(e.target.value)} /><footer><span>{source.length} / 5,000</span>{source && <button className="translation-clear" aria-label="清空原文" onClick={() => { setSource(""); setTarget(""); }}><X size={22} /></button>}</footer></div><div className="translation-result">{loading ? <div className="translation-loading" role="status"><span className="translation-pulse"><Sparkles size={24} /></span><strong>AI 正在翻译</strong><b>{elapsed.toFixed(1)}s</b></div> : <textarea aria-label="翻译结果" value={target} onChange={(e) => setTarget(e.target.value)} />}<footer><span><Sparkles size={14} />自然商务版</span>{target && <button onClick={() => navigator.clipboard.writeText(target)}><Copy size={15} />复制</button>}</footer></div></div>
      <div className="translate-actions"><div><div className="tone-selector"><span>语气</span>{([['professional', '专业'], ['friendly', '友好'], ['concise', '简洁']] as const).map(([value, label]) => <button key={value} className={tone === value ? "active" : ""} onClick={() => setTone(value)}>{label}</button>)}</div>{error && <p className="translation-error">{error}</p>}</div><button className="primary-button" onClick={translate} disabled={loading || !source.trim()}><Languages size={17} />{loading ? "AI 翻译中，请稍候…" : "开始翻译"}</button></div>
    </div>
    <div className="translator-features"><div><ShieldCheck size={20} /><strong>术语保护</strong><p>产品名、规格、单位不会被错误改写。</p></div><div><Sparkles size={20} /><strong>自然表达</strong><p>根据商务场景优化语气，不是逐字直译。</p></div><div><LockKeyhole size={20} /><strong>隐私模式</strong><p>可关闭翻译历史，不在浏览器长期保存。</p></div></div>
  </section>;
}

function SettingsView() {
  return <SettingsManager />;
}
