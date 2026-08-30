"use client";

import {
  Archive,
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
  Globe2,
  Languages,
  Link2,
  ListChecks,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultConfirmations, defaultProgress, emptyReport, initialTasks } from "@/lib/demo-data";
import { parseConversationMessages } from "@/lib/conversation";
import type { AnalysisModule, AnalysisModuleStatus, ConfirmationItem, ConfirmationStatus, CustomerTask, HesitationSignal, ImportPreview, ProductResearch, Provider, SalesStage, SourceType } from "@/lib/types";
import SettingsManager from "@/app/components/settings-manager";

type View = "analysis" | "scripts" | "products" | "translate" | "settings";
type ImportStep = "source" | SourceType;

const navItems = [
  { id: "analysis" as View, label: "客户分析台", icon: UsersRound },
  { id: "scripts" as View, label: "话术知识库", icon: BookOpen },
  { id: "products" as View, label: "产品知识库", icon: FlaskConical },
  { id: "translate" as View, label: "AI 翻译", icon: Languages },
  { id: "settings" as View, label: "系统设置", icon: Settings },
];

const sourceMeta: Record<SourceType, { label: string; icon: typeof Cloud; color: string }> = {
  salesmartly: { label: "SaleSmartly", icon: Cloud, color: "blue" },
  text: { label: "文本", icon: FileText, color: "amber" },
  excel: { label: "Excel", icon: FileSpreadsheet, color: "green" },
};

const salesStages: SalesStage[] = ["初次询盘与客户背调", "信任建立", "产品与订单匹配", "决策推进", "等待付款", "已成交", "售后与复购"];

function normalizeStage(value?: string): SalesStage {
  if (salesStages.includes(value as SalesStage)) return value as SalesStage;
  if (value?.includes("付款")) return "等待付款";
  if (value?.includes("信任") || value?.includes("异议")) return "信任建立";
  if (value?.includes("成交")) return "已成交";
  return "初次询盘与客户背调";
}

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
  const parallelStages = stringList(report.parallelStages)
    .map((stage) => normalizeStage(stage))
    .filter((stage, index, items) => items.indexOf(stage) === index);
  const rawObjections = Array.isArray(report.objections) ? report.objections : [];
  const parsedMessages = parseConversationMessages(conversation);
  const messageById = new Map(parsedMessages.map((message) => [message.id, message]));
  const rawEmotionProfile = report.emotionProfile && typeof report.emotionProfile === "object" && !Array.isArray(report.emotionProfile) ? report.emotionProfile as Record<string, unknown> : {};
  const rawEmotionEvidence = Array.isArray(rawEmotionProfile.evidence) ? rawEmotionProfile.evidence : [];
  const emotionEvidence = rawEmotionEvidence.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const message = messageById.get(stringValue(item.messageId));
    if (!message || message.role !== "customer") return [];
    const quote = normalizeEvidenceQuote(item.quote, conversation);
    if (!quote || !message.content.normalize("NFKC").includes(quote.normalize("NFKC"))) return [];
    return [{ messageId: message.id, quote, interpretation: stringValue(item.interpretation, "该原文支持当前沟通判断。") }];
  });
  const emotionConfidence = Number(rawEmotionProfile.confidence);
  const emotionProfile: CustomerTask["report"]["emotionProfile"] = {
    currentEmotion: stringValue(rawEmotionProfile.currentEmotion, "信息不足，暂无法判断当前情绪"),
    emotionTrend: stringValue(rawEmotionProfile.emotionTrend, "信息不足，暂无法判断情绪变化"),
    personalityTraits: stringList(rawEmotionProfile.personalityTraits, ["信息不足"]).slice(0, 5),
    decisionStyle: stringValue(rawEmotionProfile.decisionStyle, "信息不足，暂无法判断决策方式"),
    sensitivities: stringList(rawEmotionProfile.sensitivities, ["信息不足"]).slice(0, 5),
    psychologicalState: stringValue(rawEmotionProfile.psychologicalState, "信息不足，暂无法进行沟通心理研判"),
    coreMotivations: stringList(rawEmotionProfile.coreMotivations, ["信息不足"]).slice(0, 5),
    trustNeeds: stringList(rawEmotionProfile.trustNeeds, ["信息不足"]).slice(0, 5),
    defensePatterns: stringList(rawEmotionProfile.defensePatterns, ["信息不足"]).slice(0, 5),
    pressureResponse: stringValue(rawEmotionProfile.pressureResponse, "信息不足，暂无法判断压力下的沟通反应"),
    evidence: emotionEvidence.slice(0, 5),
    advice: stringList(rawEmotionProfile.advice, ["继续观察客户表达，并通过开放式问题确认其真实关注点。"]).slice(0, 5),
    confidence: Number.isFinite(emotionConfidence) ? Math.min(1, Math.max(0, emotionConfidence)) : 0,
  };
  const rawHesitation = report.hesitationAnalysis && typeof report.hesitationAnalysis === "object" && !Array.isArray(report.hesitationAnalysis) ? report.hesitationAnalysis as Record<string, unknown> : null;
  const rawHesitationSignals = rawHesitation && Array.isArray(rawHesitation.signals) ? rawHesitation.signals : [];
  const hesitationSignals = rawHesitationSignals.flatMap<HesitationSignal>((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const evidenceMessage = messageById.get(stringValue(item.evidenceMessageId));
    const evidenceQuote = normalizeEvidenceQuote(item.evidenceQuote, conversation);
    const kind: HesitationSignal["kind"] | null = item.kind === "明确异议" || item.kind === "延后说辞" || item.kind === "含蓄犹豫" || item.kind === "未回复风险" ? item.kind : null;
    const severity: HesitationSignal["severity"] = item.severity === "高" || item.severity === "中" || item.severity === "低" ? item.severity : "中";
    const quoteMatchesMessage = Boolean(evidenceMessage && evidenceQuote && evidenceMessage.content.normalize("NFKC").includes(evidenceQuote.normalize("NFKC")));
    if (!kind || !evidenceMessage || !evidenceQuote || !quoteMatchesMessage || (kind !== "未回复风险" && evidenceMessage.role !== "customer") || (kind === "未回复风险" && evidenceMessage.role !== "sales")) return [];
    const signalConfidence = Number(item.confidence);
    return [{
      title: stringValue(item.title, "需要人工核对的犹豫点"), kind, severity,
      customerPerspective: stringValue(item.customerPerspective, "需要结合上下文进一步确认客户视角。"),
      evidenceMessageId: evidenceMessage.id, evidenceQuote,
      reasoning: stringValue(item.reasoning, "该表达可能影响当前推进。"),
      confidence: Number.isFinite(signalConfidence) ? Math.min(1, Math.max(0, signalConfidence)) : 0,
      followUpGoal: stringValue(item.followUpGoal, "确认客户当前最关心的问题。"),
      followUpTiming: stringValue(item.followUpTiming, "根据最近一次沟通时间择机跟进。"),
      suggestedMessage: stringValue(item.suggestedMessage),
      suggestedMessageTranslation: stringValue(item.suggestedMessageTranslation),
    }];
  });
  const rawReadStatus = rawHesitation?.readNoReplyStatus;
  const readNoReplyStatus = rawReadStatus === "已确认已读未回" || rawReadStatus === "疑似未回复" || rawReadStatus === "未发现" || rawReadStatus === "无法判断" ? rawReadStatus : "无法判断";
  const readEvidenceMessage = rawHesitation ? messageById.get(stringValue(rawHesitation.readNoReplyEvidenceMessageId)) : undefined;
  const readEvidenceQuote = rawHesitation ? normalizeEvidenceQuote(rawHesitation.readNoReplyEvidenceQuote, conversation) : "";
  const readEvidenceMatches = Boolean(readEvidenceMessage && readEvidenceQuote && readEvidenceMessage.content.normalize("NFKC").includes(readEvidenceQuote.normalize("NFKC")));
  const hesitationConfidence = Number(rawHesitation?.confidence);
  const hesitationAnalysis: CustomerTask["report"]["hesitationAnalysis"] = rawHesitation && stringValue(rawHesitation.analyzedAt) ? {
    analyzedAt: stringValue(rawHesitation.analyzedAt),
    readNoReplyStatus: (readNoReplyStatus === "已确认已读未回" || readNoReplyStatus === "疑似未回复") && (!readEvidenceMessage || readEvidenceMessage.role !== "sales" || !readEvidenceMatches) ? "无法判断" : readNoReplyStatus,
    readNoReplyReason: stringValue(rawHesitation.readNoReplyReason, "当前聊天信息不足以判断未回复状态。"),
    readNoReplyEvidenceMessageId: readEvidenceMessage?.role === "sales" && readEvidenceMatches ? readEvidenceMessage.id : "",
    readNoReplyEvidenceQuote: readEvidenceMessage?.role === "sales" && readEvidenceMatches ? readEvidenceQuote : "",
    overallCustomerPerspective: stringValue(rawHesitation.overallCustomerPerspective, "当前证据不足，建议结合完整对话人工核对。"),
    signals: hesitationSignals.slice(0, 12),
    strategy: stringList(rawHesitation.strategy, ["优先确认客户当前最在意的问题，再决定跟进内容。"]).slice(0, 6),
    confidence: Number.isFinite(hesitationConfidence) ? Math.min(1, Math.max(0, hesitationConfidence)) : 0,
  } : undefined;
  const rawProductResearch = report.productResearch && typeof report.productResearch === "object" && !Array.isArray(report.productResearch) ? report.productResearch as ProductResearch : undefined;
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
  return {
    summary: stringValue(report.summary, "AI 未返回有效的对话总结。"),
    profile,
    emotionProfile,
    hesitationAnalysis,
    productResearch: rawProductResearch,
    stage: normalizeStage(stringValue(report.stage)),
    parallelStages,
    stageReason: stringValue(report.stageReason, "当前聊天记录不足以支持更具体的阶段判断。"),
    objections,
    confirmations,
    improvements: stringList(report.improvements),
    nextActions: stringList(report.nextActions),
    suggestedReply: stringValue(report.suggestedReply),
    suggestedReplyTranslation: stringValue(report.suggestedReplyTranslation),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
  };
}

const analysisModules: AnalysisModule[] = ["customer", "psychology", "objections", "checklist", "action"];
const analysisModuleLabels: Record<AnalysisModule, string> = { customer: "总结、画像与阶段", psychology: "情绪、性格与心理", objections: "异议与解决状态", checklist: "客户确认清单", action: "行动与回复" };

function mergeAnalysisModule(report: CustomerTask["report"], module: AnalysisModule, result: unknown, conversation: string) {
  const value = result && typeof result === "object" ? result as Record<string, unknown> : {};
  if (module === "customer") return normalizeReport({ ...report, summary: value.summary, profile: value.profile, stage: value.stage, parallelStages: value.parallelStages, stageReason: value.stageReason, confidence: value.confidence }, conversation);
  if (module === "psychology") return normalizeReport({ ...report, emotionProfile: value.emotionProfile }, conversation);
  if (module === "objections") return normalizeReport({ ...report, objections: value.objections }, conversation);
  if (module === "checklist") return normalizeReport({ ...report, confirmations: value.confirmations }, conversation);
  return normalizeReport({ ...report, improvements: value.improvements, nextActions: value.nextActions, suggestedReply: value.suggestedReply, suggestedReplyTranslation: value.suggestedReplyTranslation }, conversation);
}

async function analyzeConcurrently(task: CustomerTask, conversation: string, onUpdate: (task: CustomerTask) => void, requestedModules: AnalysisModule[] = analysisModules) {
  const resetAll = requestedModules.length === analysisModules.length && analysisModules.every((module) => requestedModules.includes(module));
  // 完整重新分析时立即丢弃旧报告；单模块重试时只清空对应模块，避免旧数据与本次结果混在一起。
  let report: CustomerTask["report"] = resetAll
    ? { ...emptyReport, confirmations: defaultConfirmations.map((item) => ({ ...item })) }
    : {
      ...task.report,
      ...(requestedModules.includes("customer") ? {
        summary: emptyReport.summary,
        profile: [],
        stage: emptyReport.stage,
        parallelStages: [],
        stageReason: emptyReport.stageReason,
        confidence: 0,
      } : {}),
      ...(requestedModules.includes("psychology") ? { emotionProfile: { ...emptyReport.emotionProfile, evidence: [], advice: [...emptyReport.emotionProfile.advice] } } : {}),
      ...(requestedModules.includes("objections") ? { objections: [] } : {}),
      ...(requestedModules.includes("checklist") ? { confirmations: defaultConfirmations.map((item) => ({ ...item })) } : {}),
      ...(requestedModules.includes("action") ? { improvements: [], nextActions: [], suggestedReply: "", suggestedReplyTranslation: "" } : {}),
    };
  let provider: Provider = task.provider;
  let completed = 0;
  let succeeded = 0;
  let states = { customer: "pending", psychology: "pending", objections: "pending", checklist: "pending", action: "pending", ...(task.analysisModules ?? {}) } as Record<AnalysisModule, AnalysisModuleStatus>;
  for (const module of requestedModules) states[module] = "analyzing";
  let errors: Partial<Record<AnalysisModule, string>> = { ...(task.analysisModuleErrors ?? {}) };
  for (const module of requestedModules) delete errors[module];
  let latest: CustomerTask = { ...task, rawConversation: conversation, report, status: "analyzing", analysisStep: "analyzing", analysisModules: states, analysisModuleErrors: errors, analysisError: undefined };
  onUpdate(latest);
  await Promise.all(requestedModules.map(async (module) => {
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation, module }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `${analysisModuleLabels[module]}分析失败`);
      provider = data.provider === "deepseek" ? "deepseek" : "openai";
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
  }));
  return latest;
}

function normalizeTask(task: CustomerTask): CustomerTask {
  const hasNewProgress = task.progress?.some((item) => item.id === "inquiry");
  const rawStates = task.analysisModules as unknown as Record<string, AnalysisModuleStatus> | undefined;
  const rawErrors = task.analysisModuleErrors as unknown as Record<string, string> | undefined;
  const normalizedStates = rawStates ? {
    customer: rawStates.customer ?? "pending",
    psychology: rawStates.psychology ?? rawStates.customer ?? "pending",
    objections: rawStates.objections ?? rawStates.risk ?? "pending",
    checklist: rawStates.checklist ?? rawStates.risk ?? "pending",
    action: rawStates.action ?? "pending",
  } satisfies Record<AnalysisModule, AnalysisModuleStatus> : undefined;
  const normalizedErrors: Partial<Record<AnalysisModule, string>> | undefined = rawErrors ? {
    ...(rawErrors.customer ? { customer: rawErrors.customer } : {}),
    ...(rawErrors.psychology ? { psychology: rawErrors.psychology } : {}),
    ...(rawErrors.objections || rawErrors.risk ? { objections: rawErrors.objections || rawErrors.risk } : {}),
    ...(rawErrors.checklist || rawErrors.risk ? { checklist: rawErrors.checklist || rawErrors.risk } : {}),
    ...(rawErrors.action ? { action: rawErrors.action } : {}),
  } : undefined;
  return {
    ...task,
    report: normalizeReport(task.report, task.rawConversation),
    analysisModules: normalizedStates,
    analysisModuleErrors: normalizedErrors,
    progress: hasNewProgress ? task.progress : defaultProgress.map((item) => ({ ...item })),
  };
}

const scriptRows = [
  { title: "首次询盘 · 确认客户需求", stage: "初次询盘与客户背调", product: "通用", language: "EN", status: "已发布", used: 128 },
  { title: "客户认为价格太高", stage: "决策推进", product: "通用", language: "EN", status: "已发布", used: 86 },
  { title: "解释批次与 COA 的对应关系", stage: "信任建立", product: "Product A", language: "EN", status: "已发布", used: 52 },
  { title: "报价后 24 小时简短跟进", stage: "决策推进", product: "通用", language: "EN", status: "草稿", used: 19 },
  { title: "首次订单付款安全说明", stage: "等待付款", product: "通用", language: "EN", status: "审核中", used: 34 },
];

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
  const [tasks, setTasks] = useState<CustomerTask[]>(initialTasks);
  const [activeTaskId, setActiveTaskId] = useState(initialTasks[0].id);
  const [showNewTask, setShowNewTask] = useState(false);

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

  return (
    <main className="app-shell">
      <header className="topbar">
        <AppLogo />
        <nav className="main-nav" aria-label="主导航">
          {navItems.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
              <item.icon size={17} />{item.label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <div className="sync-pill"><span />原型运行正常</div>
          <button className="icon-button" aria-label="设置" onClick={() => setView("settings")}><Settings size={18} /></button>
          <div className="avatar small">TT</div>
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
      {view === "scripts" && <KnowledgeView kind="scripts" />}
      {view === "products" && <KnowledgeView kind="products" />}
      {view === "translate" && <TranslateView />}
      {view === "settings" && <SettingsView />}

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
  const isAnalyzing = analyzing || activeTask.status === "analyzing";
  const hasCompletedModule = Object.values(activeTask.analysisModules ?? {}).includes("done");
  const moduleVisible = (module: AnalysisModule) => {
    const state = activeTask.analysisModules?.[module];
    return state ? state === "done" : activeTask.status !== "analyzing";
  };
  const filtered = tasks.filter((task) => task.name.toLowerCase().includes(taskSearch.toLowerCase()));

  const openRawChat = (messageId = "", quote = "") => {
    setShowRaw(true);
    setRawTarget({ messageId, quote, nonce: Date.now() });
  };

  const rename = (task: CustomerTask) => {
    const clean = draftName.trim();
    if (clean) onUpdate({ ...task, name: clean });
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
      onUpdate({
        ...activeTask,
        rawConversation: conversation,
        report: changed ? { ...activeTask.report, hesitationAnalysis: undefined } : activeTask.report,
        name: `${activeTask.customer.name} · ${Number(data.messageCount ?? 0)} 条消息`,
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
              <button key={task.id} className={`task-item ${activeTask.id === task.id ? "active" : ""}`} onClick={() => onSelect(task.id)} onDoubleClick={() => { setRenaming(task.id); setDraftName(task.name); }}>
                <div className="task-row">
                  <span className={`source-icon ${meta.color}`}><meta.icon size={14} /></span>
                  {renaming === task.id ? (
                    <input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)} onClick={(e) => e.stopPropagation()} onBlur={() => rename(task)} onKeyDown={(e) => e.key === "Enter" && rename(task)} />
                  ) : <strong>{task.name}</strong>}
                </div>
                <div className="task-meta"><span>{meta.label}</span><span>·</span><span>{task.updatedAt}</span></div>
                <div className="task-bottom">
                  <span className={`status-dot ${task.status}`} />
                  <span>{task.status === "stale" ? "有新消息，需更新" : task.status === "analyzing" ? "分析中" : task.status === "failed" ? "分析失败" : task.report.stage}</span>
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
            <div className="breadcrumb">客户分析台 <ChevronRight size={13} /> {activeTask.name}</div>
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

        {activeTask.status === "analyzing" && !hasCompletedModule ? (
          <AnalysisLoading task={activeTask} />
        ) : activeTask.status === "failed" ? (
          <AnalysisFailed task={activeTask} onRetry={reanalyze} />
        ) : <div className="report-content">
          {activeTask.status === "analyzing" && <AnalysisModuleProgress task={activeTask} compact />}
          {moduleVisible("customer") && <>
          <div className="report-intro">
            <div className="ai-orb"><Sparkles size={22} /></div>
            <div><span>AI ANALYSIS</span><h2>{activeTask.customer.name} 的对话洞察</h2><p>基于 {activeTask.rawConversation.split("\n").length} 条对话 · {activeTask.model} · 置信度 {Math.round(activeTask.report.confidence * 100)}%</p></div>
            <div className={`confidence score-${confidenceLabel(activeTask.report.confidence)}`}><div style={{ "--score": `${activeTask.report.confidence * 100}%` } as React.CSSProperties} /><span>{confidenceLabel(activeTask.report.confidence)}</span></div>
          </div>

          <ReportCard icon={FileText} title="对话总结" tone="violet">
            <p className="summary-text">{activeTask.report.summary}</p>
          </ReportCard>

          <ReportCard icon={UserRound} title="客户画像" tone="blue">
            <div className="profile-tags">{activeTask.report.profile.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div>
          </ReportCard>
          </>}

          {moduleVisible("psychology") && <>
          <ReportCard icon={UsersRound} title="客户情绪、沟通性格与心理研判" tone="cyan">
            <div className="emotion-headline">
              <div><small>当前情绪</small><strong>{activeTask.report.emotionProfile.currentEmotion}</strong></div>
              <div><small>情绪变化</small><strong>{activeTask.report.emotionProfile.emotionTrend}</strong></div>
              <span className={`emotion-confidence score-${confidenceLabel(activeTask.report.emotionProfile.confidence)}`}>{confidenceLabel(activeTask.report.emotionProfile.confidence)} · {Math.round(activeTask.report.emotionProfile.confidence * 100)}%</span>
            </div>
            <div className="emotion-columns">
              <div><small>沟通性格倾向</small><div className="emotion-tags">{activeTask.report.emotionProfile.personalityTraits.map((item) => <span key={item}>{item}</span>)}</div></div>
              <div><small>敏感点</small><div className="emotion-tags sensitivity-tags">{activeTask.report.emotionProfile.sensitivities.map((item) => <span key={item}>{item}</span>)}</div></div>
              <div><small>决策方式</small><p>{activeTask.report.emotionProfile.decisionStyle}</p></div>
            </div>
            <div className="psychology-panel">
              <div className="psychology-title"><strong>沟通心理研判</strong><span>非临床</span></div>
              <div className="psychology-state"><small>当前心理状态</small><p>{activeTask.report.emotionProfile.psychologicalState}</p></div>
              <div className="psychology-grid">
                <div><small>核心驱动力</small><div className="emotion-tags">{activeTask.report.emotionProfile.coreMotivations.map((item) => <span key={item}>{item}</span>)}</div></div>
                <div><small>信任需求</small><div className="emotion-tags">{activeTask.report.emotionProfile.trustNeeds.map((item) => <span key={item}>{item}</span>)}</div></div>
                <div><small>防御或回避模式</small><div className="emotion-tags sensitivity-tags">{activeTask.report.emotionProfile.defensePatterns.map((item) => <span key={item}>{item}</span>)}</div></div>
                <div><small>压力下的可能反应</small><p>{activeTask.report.emotionProfile.pressureResponse}</p></div>
              </div>
            </div>
            {!!activeTask.report.emotionProfile.evidence.length && <div className="emotion-evidence">
              <h4>对话依据</h4>
              {activeTask.report.emotionProfile.evidence.map((item) => <div key={`${item.messageId}-${item.quote}`}>
                <blockquote>“{item.quote}”</blockquote>
                <p>{item.interpretation}</p>
                <button type="button" onClick={() => openRawChat(item.messageId, item.quote)}>定位原文</button>
              </div>)}
            </div>}
            <div className="emotion-advice"><h4>沟通建议</h4>{activeTask.report.emotionProfile.advice.map((item, index) => <p key={item}><span>{index + 1}</span>{item}</p>)}</div>
            <p className="emotion-disclaimer">仅依据当前聊天进行非临床沟通心理研判，不构成精神健康、人格障碍或医学诊断。</p>
          </ReportCard>
          </>}

          {moduleVisible("objections") && <>
          <ReportCard icon={CircleAlert} title={`主要异议与犹豫点 · ${activeTask.report.objections.length}`} tone="orange">
            <div className="objection-list">
              {!activeTask.report.objections.length && <div className="empty-objections"><CheckCircle2 size={15} />暂未识别到具有原始聊天依据的明确异议</div>}
              {activeTask.report.objections.map((item, index) => (
                <details key={item.title} open={index === 0}>
                  <summary><span className={`severity ${item.severity}`}>{item.severity}</span><strong>{item.title}</strong><span className={`objection-state ${objectionStatusClass(item.status)}`}>{item.status}</span><ChevronDown size={16} /></summary>
                  <div className="evidence">
                    <p className="objection-basis"><span>判断依据</span>{item.evidence}</p>
                    {item.evidenceVerified && item.evidenceQuote
                      ? <blockquote><button type="button" className="evidence-locate" onClick={() => openRawChat(item.evidenceMessageId, item.evidenceQuote || item.evidence)} title="定位到原始聊天">已核验原文</button>“{item.evidenceQuote.replaceAll("“", "").replaceAll("”", "") }”</blockquote>
                      : <div className="objection-unverified"><CircleAlert size={13} />未找到可逐字匹配的原始片段，请结合原始聊天人工核对</div>}
                    <p className="resolution-basis"><span>状态判断</span>{item.resolutionReason}</p>
                    <p><Sparkles size={14} />{item.advice}</p>
                  </div>
                </details>
              ))}
            </div>
          </ReportCard>

          <DeepHesitationCard task={activeTask} onUpdate={onUpdate} onLocate={openRawChat} />
          </>}

          {moduleVisible("checklist") && <>
          <ConfirmationChecklist task={activeTask} onUpdate={onUpdate} onLocate={openRawChat} />
          </>}

          {moduleVisible("action") && <>
          <ReportCard icon={Zap} title="本次沟通可改善" tone="amber">
            <div className="number-list">{activeTask.report.improvements.map((item, i) => <div key={item}><span>{i + 1}</span><p>{item}</p></div>)}</div>
          </ReportCard>

          <ReportCard icon={Sparkles} title="AI 下一步建议" tone="violet" featured>
            <div className="action-list">{activeTask.report.nextActions.map((item, i) => <div key={item}><span>{i + 1}</span><p>{item}</p></div>)}</div>
            <div className="reply-box"><div><Bot size={16} /><strong>建议回复</strong><button onClick={() => navigator.clipboard.writeText(activeTask.report.suggestedReply)}><Copy size={14} />复制原文</button></div><p>{activeTask.report.suggestedReply}</p><div className="reply-translation"><span>中文核对</span><p>{activeTask.report.suggestedReplyTranslation}</p></div></div>
          </ReportCard>
          </>}
        </div>}
      </section>

      <RawChatPanel
        task={activeTask}
        onUpdate={onUpdate}
        onClose={() => setShowRaw(false)}
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
  const states = task.analysisModules ?? { customer: "analyzing", psychology: "analyzing", objections: "analyzing", checklist: "analyzing", action: "analyzing" };
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

function ReportCard({ icon: Icon, title, tone, featured, children }: React.PropsWithChildren<{ icon: typeof Sparkles; title: string; tone: string; featured?: boolean }>) {
  return <article className={`report-card ${featured ? "featured" : ""}`}><header><span className={`card-icon ${tone}`}><Icon size={17} /></span><h3>{title}</h3></header><div className="card-body">{children}</div></article>;
}

function DeepHesitationCard({ task, onUpdate, onLocate }: { task: CustomerTask; onUpdate: (task: CustomerTask) => void; onLocate: (messageId?: string, quote?: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const analysis = task.report.hesitationAnalysis;
  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/hesitation-analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation: task.rawConversation }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "深度犹豫分析失败");
      onUpdate(normalizeTask({
        ...task,
        report: { ...task.report, hesitationAnalysis: data.analysis },
        provider: data.provider === "deepseek" ? "deepseek" : "openai",
        model: data.provider === "deepseek" ? "DeepSeek" : "GPT",
        updatedAt: "刚刚",
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "深度犹豫分析失败");
    } finally {
      setLoading(false);
    }
  };

  return <ReportCard icon={Search} title="深度犹豫与未回复分析" tone="orange">
    {!analysis ? <div className="hesitation-cta">
      <span>按需分析 · 首次不自动运行</span>
      <h4>从客户视角重新细看整段聊天</h4>
      <p>识别已读未回或疑似未回复、明确异议、延后说辞和有证据的潜在犹豫，并为每个问题生成独立跟进建议。</p>
      <button className="primary-button" onClick={() => void runAnalysis()} disabled={loading || task.status === "analyzing"}><Search size={14} />{loading ? "正在深度分析…" : "开始深度分析"}</button>
      {error && <div className="hesitation-error"><CircleAlert size={13} />{error}</div>}
    </div> : <div className="hesitation-result">
      <div className="hesitation-result-head">
        <div><span className={`read-status status-${analysis.readNoReplyStatus}`}>{analysis.readNoReplyStatus}</span><small>深度分析置信度 {Math.round(analysis.confidence * 100)}%</small></div>
        <button onClick={() => void runAnalysis()} disabled={loading}><RefreshCw size={13} className={loading ? "spin" : ""} />{loading ? "分析中…" : "重新分析"}</button>
      </div>
      <div className="customer-perspective"><small>站在客户角度</small><p>{analysis.overallCustomerPerspective}</p></div>
      <div className="read-no-reply-detail"><strong>未回复判断</strong><p>{analysis.readNoReplyReason}</p>{analysis.readNoReplyEvidenceQuote && <blockquote><button onClick={() => onLocate(analysis.readNoReplyEvidenceMessageId, analysis.readNoReplyEvidenceQuote)}>定位原文</button>“{analysis.readNoReplyEvidenceQuote}”</blockquote>}</div>
      <div className="hesitation-signals">
        <h4>发现 {analysis.signals.length} 个需要关注的点</h4>
        {!analysis.signals.length && <div className="empty-objections"><CheckCircle2 size={15} />没有发现具有原文依据的明显异议或延后说辞</div>}
        {analysis.signals.map((signal, index) => <article key={`${signal.title}-${index}`}>
          <header><span className={`severity ${signal.severity}`}>{signal.severity}</span><strong>{signal.title}</strong><em>{signal.kind}</em><small>{Math.round(signal.confidence * 100)}%</small></header>
          <div className="signal-body">
            <div className="signal-perspective"><small>客户视角</small><p>{signal.customerPerspective}</p></div>
            <blockquote><button onClick={() => onLocate(signal.evidenceMessageId, signal.evidenceQuote)}>已核验原文</button>“{signal.evidenceQuote}”</blockquote>
            <p className="signal-reasoning"><span>判断说明</span>{signal.reasoning}</p>
            <div className="follow-up-plan"><div><small>跟进目标</small><p>{signal.followUpGoal}</p></div><div><small>建议时机</small><p>{signal.followUpTiming}</p></div></div>
            <div className="signal-message"><header><strong>建议跟进消息</strong><button onClick={() => navigator.clipboard.writeText(signal.suggestedMessage)}><Copy size={12} />复制</button></header><p>{signal.suggestedMessage}</p><div><small>中文核对</small><p>{signal.suggestedMessageTranslation}</p></div></div>
          </div>
        </article>)}
      </div>
      <div className="hesitation-strategy"><h4>整体跟进顺序</h4>{analysis.strategy.map((item, index) => <p key={item}><span>{index + 1}</span>{item}</p>)}</div>
      {error && <div className="hesitation-error"><CircleAlert size={13} />{error}</div>}
      <p className="hesitation-disclaimer">潜在犹豫属于基于原文的销售推断，不代表已经确认客户的内心想法。</p>
    </div>}
  </ReportCard>;
}

function ProductResearchCard({ task, onUpdate, onLocate }: { task: CustomerTask; onUpdate: (task: CustomerTask) => void; onLocate: (messageId?: string, quote?: string) => void }) {
  const research = task.report.productResearch;
  const defaultProduct = research?.productName || (task.customer.product && task.customer.product !== "待识别" ? task.customer.product : "KLOW");
  const [productName, setProductName] = useState(defaultProduct);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setProductName(defaultProduct), [task.id, defaultProduct]);

  const runResearch = async () => {
    if (!productName.trim()) return setError("请先输入产品名称");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/product-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: productName.trim(), conversation: task.rawConversation }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "产品联网研究失败");
      onUpdate(normalizeTask({ ...task, report: { ...task.report, productResearch: data.research }, updatedAt: "刚刚" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "产品联网研究失败");
    } finally {
      setLoading(false);
    }
  };

  return <section className="product-research">
    <header><div><Globe2 size={16} /><div><strong>产品痛点匹配与联网研究</strong><small>按需运行 · 结果随当前任务保存</small></div></div><span>DeepSeek Web Search</span></header>
    <div className="product-research-form">
      <label><span>目标产品</span><input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="例如 KLOW" /></label>
      <button type="button" className="primary-button" onClick={() => void runResearch()} disabled={loading}>{loading ? <RefreshCw className="spin" size={14} /> : <Search size={14} />}{loading ? "正在检索资料…" : research ? "重新联网研究" : "联网研究并生成话术"}</button>
    </div>
    {!research && !loading && <p className="product-research-hint">系统会提取客户的具体痛点，联网核验产品及成分资料，再生成带来源的价值说明；不会生成个体化剂量、周期或治疗方案。</p>}
    {error && <div className="product-research-error"><CircleAlert size={14} />{error}</div>}
    {research && <div className="product-research-result">
      <div className="research-match-head"><div><small>客户关注</small><strong>{research.customerNeed}</strong></div><span className={`match-level level-${research.matchLevel}`}>匹配度 {research.matchLevel}</span></div>
      <button className="research-evidence" type="button" onClick={() => onLocate(research.customerEvidenceMessageId, research.customerEvidenceQuote)}><span>客户原文</span>“{research.customerEvidenceQuote}”</button>
      <p className="research-summary">{research.matchSummary}</p>
      <div className="research-points"><h5>可用于沟通的价值点</h5>{research.talkingPoints.map((point, index) => <article key={`${point.title}-${index}`}><span>{index + 1}</span><div><strong>{point.title}</strong><p>{point.explanation}</p><div>{point.sourceUrls.map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}><Link2 size={11} />查看依据</a>)}</div></div></article>)}</div>
      {!!research.limitations.length && <div className="research-limitations"><strong>资料边界</strong>{research.limitations.map((item) => <p key={item}><CircleAlert size={12} />{item}</p>)}</div>}
      <details className="research-sources"><summary>查看 {research.sources.length} 条资料来源 <ChevronDown size={14} /></summary><div>{research.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${source.title}`}><span>{source.level}</span><strong>{source.title}</strong><p>{source.excerpt}</p></a>)}</div></details>
      <div className="research-reply"><header><Bot size={15} /><strong>针对当前客户的建议回复</strong><button type="button" onClick={() => navigator.clipboard.writeText(research.suggestedReply)}><Copy size={13} />复制原文</button></header><p>{research.suggestedReply}</p><div><small>中文核对</small><p>{research.suggestedReplyTranslation}</p></div></div>
      <small className="research-time">检索于 {new Date(research.searchedAt).toLocaleString("zh-CN")}</small>
    </div>}
  </section>;
}

const confirmationState: Record<ConfirmationStatus, { label: string; className: string }> = {
  confirmed: { label: "已确认", className: "confirmed" },
  unknown: { label: "未确认", className: "unknown" },
  risk: { label: "存在风险", className: "risk" },
  na: { label: "不适用", className: "na" },
};

function ConfirmationChecklist({ task, onUpdate, onLocate }: { task: CustomerTask; onUpdate: (task: CustomerTask) => void; onLocate: (messageId?: string, quote?: string) => void }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; mode: "hook" | "explain"; text: string; translation: string } | null>(null);
  const categories: ConfirmationItem["category"][] = ["客户角色", "认知与经历", "产品与信任", "交易条件"];
  const completed = task.report.confirmations.filter((item) => item.status === "confirmed" || item.status === "na").length;
  const riskItems = task.report.confirmations.filter((item) => item.status === "risk");

  const cycleStatus = (item: ConfirmationItem) => {
    const order: ConfirmationStatus[] = ["unknown", "confirmed", "risk", "na"];
    const status = order[(order.indexOf(item.status) + 1) % order.length];
    onUpdate({
      ...task,
      report: { ...task.report, confirmations: task.report.confirmations.map((current) => current.id === item.id ? {
        ...current,
        status,
        evidenceQuote: status === "risk" ? current.evidenceQuote || "" : current.evidenceQuote,
        riskReason: status === "risk" ? current.riskReason || "该项目由人工标记为风险，具体原因需要补充确认。" : "",
      } : current) },
    });
  };

  const generate = async (item: ConfirmationItem, mode: "hook" | "explain") => {
    setGenerating(`${item.id}-${mode}`);
    setResult(null);
    try {
      const response = await fetch("/api/checklist-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: task.rawConversation, item: item.label, mode, provider: task.provider }),
      });
      const data = await response.json();
      setResult({ id: item.id, mode, text: data.suggestion || data.error || "暂时无法生成建议。", translation: data.translation || "暂无中文翻译。" });
    } catch {
      setResult({ id: item.id, mode, text: "Generation failed. Please try again later.", translation: "生成失败，请稍后重试。" });
    } finally {
      setGenerating(null);
    }
  };

  return (
    <ReportCard icon={ListChecks} title={`客户确认清单 · ${completed}/${task.report.confirmations.length}`} tone="green">
      <p className="checklist-intro">点击状态可人工切换。对未确认或存在风险的项目，可结合当前对话生成探询钩子或直接说明。</p>
      {!!riskItems.length && <div className="risk-summary">
        <header><CircleAlert size={14} /><strong>发现 {riskItems.length} 个风险点</strong></header>
        {riskItems.map((item) => <div className="risk-summary-item" key={item.id}>
          <strong>{item.label}</strong>
          <p><span>风险原因</span>{item.riskReason || item.evidence || "该项目被人工标记为风险，原因尚待补充。"}</p>
          <p><span>对话依据</span>{item.evidence || "暂无直接对话依据，建议进一步确认。"}</p>
          <blockquote><span>原始片段</span>{item.evidenceQuote ? `“${item.evidenceQuote.replaceAll("“", "").replaceAll("”", "") }”` : "暂无可验证的原始聊天片段"}</blockquote>
        </div>)}
      </div>}
      <div className="confirmation-groups">
        {categories.map((category) => {
          const items = task.report.confirmations.filter((item) => item.category === category);
          if (!items.length) return null;
          return <section className="confirmation-group" key={category}>
            <h4>{category}</h4>
            {items.map((item) => {
              const state = confirmationState[item.status];
              const selectedResult = result?.id === item.id ? result : null;
              return <div className="confirmation-row" key={item.id}>
                <div className="confirmation-main">
                  <button className={`confirmation-status ${state.className}`} onClick={() => cycleStatus(item)}>{item.status === "confirmed" && <Check size={12} />}{state.label}</button>
                  <div><strong>{item.label}</strong><p>{item.evidence}</p></div>
                  <span className="item-confidence">{Math.round(item.confidence * 100)}%</span>
                </div>
                {item.id === "seeding" && item.seedingNeed && <div className={`seeding-analysis ${item.seedingNeed === "需要种草" ? "needed" : "not-needed"}`}>
                  <header><span>种草结论</span><strong>{item.seedingNeed}</strong></header>
                  {item.seedingNeed === "需要种草" && <div className="seeding-detail-grid">
                    <div><small>种草方向</small><p>{item.seedingDirection || "待确认客户关注的改善、期望或痛点。"}</p></div>
                    <div><small>当前是否已种草</small><p>{item.seedingPerformed || "未确认"}</p>{item.seedingPerformedEvidenceQuote && <blockquote>“{item.seedingPerformedEvidenceQuote}”</blockquote>}</div>
                    <div><small>是否获得客户肯定</small><p>{item.seedingAccepted || "未确认"}</p>{item.seedingAcceptanceEvidenceQuote && <blockquote>“{item.seedingAcceptanceEvidenceQuote}”</blockquote>}</div>
                    <div className="seeding-advice"><small>建议</small><p>{item.seedingAdvice || "先确认客户希望改善的问题，再做针对性价值说明。"}</p></div>
                  </div>}
                </div>}
                {item.id === "seeding" && <ProductResearchCard task={task} onUpdate={onUpdate} onLocate={onLocate} />}
                {item.id === "medical" && item.medicalNeed && <div className={`seeding-analysis medical-analysis ${item.medicalNeed === "需要提供建议" ? "needed" : "not-needed"}`}>
                  <header><span>建议结论</span><strong>{item.medicalNeed}</strong></header>
                  {item.medicalNeed === "需要提供建议" && <div className="seeding-detail-grid medical-detail-grid">
                    <div><small>需求方向</small><p>{item.medicalDirection || "待确认客户的剂量、使用或医疗相关需求。"}</p></div>
                    <div><small>是否已经解答</small><p>{item.medicalAnswered || "未确认"}</p>{item.medicalAnswerEvidenceQuote && <blockquote>“{item.medicalAnswerEvidenceQuote}”</blockquote>}</div>
                    <div><small>是否获得客户肯定</small><p>{item.medicalAccepted || "未确认"}</p>{item.medicalAcceptanceEvidenceQuote && <blockquote>“{item.medicalAcceptanceEvidenceQuote}”</blockquote>}</div>
                    <div className="seeding-advice"><small>建议</small><p>{item.medicalAdvice || "结合客户的具体问题，给出清晰、准确且有依据的下一步说明。"}</p></div>
                  </div>}
                </div>}
                {item.id === "scammed" && item.scamExperienceStatus && <div className={`seeding-analysis scam-analysis ${item.scamExperienceStatus === "有被骗经历" ? "needed" : "not-needed"}`}>
                  <header><span>被骗经历</span><strong>{item.scamExperienceStatus}</strong></header>
                  {item.scamExperienceStatus === "有被骗经历" && <div className="seeding-detail-grid scam-detail-grid">
                    <div><small>具体经历概述</small><p>{item.scamExperienceSummary || "待确认被骗方式、损失或由此产生的不信任。"}</p></div>
                    <div><small>是否针对问题回应</small><p>{item.scamAddressed || "未确认"}</p>{item.scamResponseEvidenceQuote && <blockquote>“{item.scamResponseEvidenceQuote}”</blockquote>}</div>
                    <div><small>是否获得客户肯定</small><p>{item.scamAccepted || "未确认"}</p>{item.scamAcceptanceEvidenceQuote && <blockquote>“{item.scamAcceptanceEvidenceQuote}”</blockquote>}</div>
                    <div className="seeding-advice"><small>建议</small><p>{item.scamAdvice || "先承接客户的不信任，再用可验证资料和低风险首单方案回应。"}</p></div>
                  </div>}
                </div>}
                {item.id === "coa" && item.coaMentionSource && <div className={`seeding-analysis coa-analysis ${item.coaMentionSource === "未提及" ? "not-needed" : "needed"}`}>
                  <header><span>COA 判断</span><strong>{item.coaMentionSource}</strong></header>
                  <div className="seeding-detail-grid coa-detail-grid">
                    <div><small>由谁提出</small><p>{item.coaMentionSource}</p>{item.coaMentionEvidenceQuote && <blockquote>“{item.coaMentionEvidenceQuote}”</blockquote>}</div>
                    <div><small>是否已经说明</small><p>{item.coaExplained || "未确认"}</p>{item.coaExplanationEvidenceQuote && <blockquote>“{item.coaExplanationEvidenceQuote}”</blockquote>}</div>
                    <div><small>是否获得客户肯定</small><p>{item.coaAccepted || "未确认"}</p>{item.coaAcceptanceEvidenceQuote && <blockquote>“{item.coaAcceptanceEvidenceQuote}”</blockquote>}</div>
                    <div className="seeding-advice"><small>建议</small><p>{item.coaAdvice || "根据当前对话判断是否需要主动说明 COA、批次与交付产品的对应关系。"}</p></div>
                  </div>
                </div>}
                {item.id === "packaging" && item.packagingMentionSource && <div className={`seeding-analysis packaging-analysis ${item.packagingMentionSource === "未提及" ? "not-needed" : "needed"}`}>
                  <header><span>包装判断</span><strong>{item.packagingMentionSource}</strong></header>
                  <div className="seeding-detail-grid packaging-detail-grid">
                    <div><small>由谁提出</small><p>{item.packagingMentionSource}</p>{item.packagingMentionEvidenceQuote && <blockquote>“{item.packagingMentionEvidenceQuote}”</blockquote>}</div>
                    <div><small>是否已经说明</small><p>{item.packagingExplained || "未确认"}</p>{item.packagingExplanationEvidenceQuote && <blockquote>“{item.packagingExplanationEvidenceQuote}”</blockquote>}</div>
                    <div><small>是否获得客户肯定</small><p>{item.packagingAccepted || "未确认"}</p>{item.packagingAcceptanceEvidenceQuote && <blockquote>“{item.packagingAcceptanceEvidenceQuote}”</blockquote>}</div>
                    <div className="seeding-advice"><small>建议</small><p>{item.packagingAdvice || "根据当前对话判断是否需要主动说明包装规格、标签、隐私性和运输防护。"}</p></div>
                  </div>
                </div>}
                {item.id === "company" && item.companyMentionSource && <div className={`seeding-analysis company-analysis ${item.companyMentionSource === "未提及" ? "not-needed" : "needed"}`}>
                  <header><span>公司资料判断</span><strong>{item.companyMentionSource}</strong></header>
                  <div className="seeding-detail-grid company-detail-grid">
                    <div><small>由谁提出</small><p>{item.companyMentionSource}</p>{item.companyMentionEvidenceQuote && <blockquote>“{item.companyMentionEvidenceQuote}”</blockquote>}</div>
                    <div><small>是否已经说明</small><p>{item.companyExplained || "未确认"}</p>{item.companyExplanationEvidenceQuote && <blockquote>“{item.companyExplanationEvidenceQuote}”</blockquote>}</div>
                    <div><small>是否获得客户肯定</small><p>{item.companyAccepted || "未确认"}</p>{item.companyAcceptanceEvidenceQuote && <blockquote>“{item.companyAcceptanceEvidenceQuote}”</blockquote>}</div>
                    <div className="seeding-advice"><small>建议</small><p>{item.companyAdvice || "根据客户最想核验的内容，提供真实、具体且可验证的公司资料。"}</p></div>
                  </div>
                </div>}
                {item.id === "feedback" && item.feedbackMentionSource && <div className={`seeding-analysis feedback-analysis ${item.feedbackMentionSource === "未提及" ? "not-needed" : "needed"}`}>
                  <header><span>客户反馈判断</span><strong>{item.feedbackMentionSource}</strong></header>
                  <div className="seeding-detail-grid feedback-detail-grid">
                    <div><small>由谁提出</small><p>{item.feedbackMentionSource}</p>{item.feedbackMentionEvidenceQuote && <blockquote>“{item.feedbackMentionEvidenceQuote}”</blockquote>}</div>
                    <div><small>是否已经解答</small><p>{item.feedbackAnswered || "未确认"}</p>{item.feedbackAnswerEvidenceQuote && <blockquote>“{item.feedbackAnswerEvidenceQuote}”</blockquote>}</div>
                    <div><small>是否获得客户肯定</small><p>{item.feedbackAccepted || "未确认"}</p>{item.feedbackAcceptanceEvidenceQuote && <blockquote>“{item.feedbackAcceptanceEvidenceQuote}”</blockquote>}</div>
                    <div className="seeding-advice"><small>建议</small><p>{item.feedbackAdvice || "结合客户的国家和信任顾虑，提供真实、相关且已脱敏的客户反馈或物流参考。"}</p></div>
                  </div>
                </div>}
                {item.id === "logistics" && item.logisticsMentionSource && <div className={`seeding-analysis logistics-analysis ${item.logisticsMentionSource === "未提及" ? "not-needed" : "needed"}`}>
                  <header><span>物流判断</span><strong>{item.logisticsMentionSource}</strong></header>
                  <div className="seeding-detail-grid logistics-detail-grid">
                    <div><small>由谁提出</small><p>{item.logisticsMentionSource}</p>{item.logisticsMentionEvidenceQuote && <blockquote>“{item.logisticsMentionEvidenceQuote}”</blockquote>}</div>
                    <div><small>是否已经解答</small><p>{item.logisticsAnswered || "未确认"}</p>{item.logisticsAnswerEvidenceQuote && <blockquote>“{item.logisticsAnswerEvidenceQuote}”</blockquote>}</div>
                    <div><small>客户是否满意或存在异议</small><p>{item.logisticsCustomerReaction || "未确认"}</p>{item.logisticsReactionEvidenceQuote && <blockquote>“{item.logisticsReactionEvidenceQuote}”</blockquote>}</div>
                    <div className="seeding-advice"><small>建议</small><p>{item.logisticsAdvice || "结合目的国家，明确渠道、参考时效、清关边界和异常处理方式。"}</p></div>
                  </div>
                </div>}
                {item.id === "payment_method" && item.paymentMentionSource && <div className={`seeding-analysis payment-analysis ${item.paymentMentionSource === "未提及" ? "not-needed" : "needed"}`}>
                  <header><span>支付判断</span><strong>{item.paymentMentionSource}</strong></header>
                  <div className="seeding-detail-grid payment-detail-grid">
                    <div><small>由谁提出</small><p>{item.paymentMentionSource}</p>{item.paymentMentionEvidenceQuote && <blockquote>“{item.paymentMentionEvidenceQuote}”</blockquote>}</div>
                    <div><small>客户是否肯定或存在异议</small><p>{item.paymentCustomerReaction || "未确认"}</p>{item.paymentReactionEvidenceQuote && <blockquote>“{item.paymentReactionEvidenceQuote}”</blockquote>}</div>
                    <div className="seeding-advice"><small>建议</small><p>{item.paymentAdvice || "确认客户可用的支付渠道，并如实说明流程、费用和可核验的付款保障。"}</p></div>
                  </div>
                </div>}
                {(item.status === "unknown" || item.status === "risk") && <div className="confirmation-actions">
                  <button onClick={() => generate(item, "hook")} disabled={!!generating}><Sparkles size={12} />{generating === `${item.id}-hook` ? "生成中…" : "生成探询钩子"}</button>
                  <button onClick={() => generate(item, "explain")} disabled={!!generating}><Bot size={12} />{generating === `${item.id}-explain` ? "生成中…" : "生成直接阐述"}</button>
                </div>}
                {selectedResult && <div className="generated-suggestion"><header><span>{selectedResult.mode === "hook" ? "探询钩子" : "直接阐述"}</span><button onClick={() => navigator.clipboard.writeText(selectedResult.text)}><Copy size={12} />复制原文</button></header><p>{selectedResult.text}</p><div className="suggestion-translation"><span>中文核对</span><p>{selectedResult.translation}</p></div></div>}
              </div>;
            })}
          </section>;
        })}
      </div>
    </ReportCard>
  );
}

function RawChatPanel({ task, onClose, onUpdate, onSync, syncing = false, target }: { task: CustomerTask; onClose: () => void; onUpdate: (task: CustomerTask) => void; onSync?: () => Promise<void>; syncing?: boolean; target: { messageId?: string; quote: string; nonce: number } | null }) {
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const messageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const messages = useMemo(() => parseConversationMessages(task.rawConversation), [task.rawConversation]);
  const savedTranslation = task.rawTranslation?.source === task.rawConversation && task.rawTranslation.lines.length === messages.length
    ? task.rawTranslation.lines
    : undefined;

  useEffect(() => {
    if (!target?.messageId && !target?.quote) return;
    const messageIdIndex = target.messageId ? messages.findIndex((message) => message.id === target.messageId) : -1;
    if (messageIdIndex >= 0) {
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
    <header><div><span className="eyebrow">SOURCE DATA</span><h2>原始聊天记录</h2></div><div className="drawer-actions">{onSync && <button className="secondary-button" onClick={() => void onSync()} disabled={syncing}><Cloud size={15} className={syncing ? "spin" : ""} />{syncing ? "同步中" : "同步"}</button>}<button className="secondary-button" onClick={() => void translate()} disabled={translating}><Languages size={15} />{translating ? "翻译中…" : savedTranslation ? "重新翻译" : "翻译"}</button><button className="icon-button raw-close-button" onClick={onClose}><X size={18} /></button></div></header>
    <div className="drawer-meta"><span>{sourceMeta[task.source].label}</span><span>{task.customer.name}</span><span>{messages.length} 条消息</span></div>
    {translationError && <div className="raw-translation-error"><CircleAlert size={14} />{translationError}</div>}
    <div className="raw-chat-scroll">
      {messages.map((message, index) => <div ref={(element) => { messageRefs.current[index] = element; }} className={`raw-message ${message.role} ${highlightedIndex === index ? "flash-highlight" : ""}`} key={`${index}-${message.content.slice(0, 20)}`}>
        <div className="raw-message-meta"><strong>{message.label}</strong><span>{message.id}</span>{message.time && <span>{message.time}</span>}</div>
        <div className="raw-message-bubble"><p>{message.content}</p>{savedTranslation?.[index] && <div className="raw-message-translation"><span>中文</span><p>{savedTranslation[index]}</p></div>}</div>
      </div>)}
    </div>
  </aside>;
}

interface SaleSmartlyCustomerOption {
  id: string;
  name: string;
  email: string;
  phone: string;
  channel: string;
  country: string;
  language: string;
  lastMessageAt: string;
}

function ImportPreviewPanel({ preview, selectedConversationKey, onConversationChange, onRoleChange }: {
  preview: ImportPreview;
  selectedConversationKey: string;
  onConversationChange: (key: string) => void;
  onRoleChange: (messageId: string, sender: string, role: "customer" | "sales" | "unknown" | "system") => void;
}) {
  const messages = preview.messages.filter((message) => !selectedConversationKey || message.conversationKey === selectedConversationKey);
  const customerCount = messages.filter((message) => message.role === "customer").length;
  const salesCount = messages.filter((message) => message.role === "sales").length;
  const unknownCount = messages.filter((message) => message.role === "unknown").length;
  return <div className="import-preview">
    <div className="import-preview-head"><div><CheckCircle2 size={18} /><div><strong>智能识别完成</strong><span>置信度 {Math.round(preview.overallConfidence * 100)}%</span></div></div><div><span>客户 {customerCount}</span><span>销售 {salesCount}</span>{unknownCount > 0 && <span className="unknown">待确认 {unknownCount}</span>}</div></div>
    {preview.detectedConversations.length > 1 && <label className="conversation-picker"><span>检测到多个客户或会话，请选择本次创建的任务</span><select value={selectedConversationKey} onChange={(event) => onConversationChange(event.target.value)}>{preview.detectedConversations.map((key) => { const group = preview.messages.filter((message) => message.conversationKey === key); const name = group.find((message) => message.customerName)?.customerName; return <option value={key} key={key}>{name ? `${name} · ` : ""}{key} · {group.length} 条</option>; })}</select></label>}
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
    const normalizedImportConversation = source === "salesmartly" ? conversation : previewMessages.filter((message) => message.role !== "system").map((message) => `${message.time ? `[${message.time}] ` : ""}${message.role === "customer" ? "Customer" : "Sales"}: ${message.content}`).join("\n");
    const task: CustomerTask = normalizeTask({
      id: `task-${Date.now()}`,
      name: `${name} · 正在分析`,
      source,
      status: "analyzing",
      analysisStep: source === "salesmartly" ? "importing" : "analyzing",
      updatedAt: "刚刚",
      customer: {
        name,
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
        workingTask = { ...workingTask, rawConversation: importedConversation, name: `${name} · ${importedMessageCount} 条消息`, analysisStep: "analyzing" };
        onUpdate(workingTask);
      }
      if (!importedConversation.trim()) importedConversation = "Customer: Please send me more information about your product and pricing.";
      workingTask = normalizeTask({
        ...workingTask,
        name: source === "salesmartly" ? `${name} · ${importedMessageCount} 条消息` : `${name} · 新分析`,
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

  const selectedPreviewMessages = importPreview?.messages.filter((message) => !selectedConversationKey || message.conversationKey === selectedConversationKey) ?? [];
  const selectedAnalyzableMessages = selectedPreviewMessages.filter((message) => message.role === "customer" || message.role === "sales");
  const previewUnknownCount = selectedPreviewMessages.filter((message) => message.role === "unknown").length;

  return (
    <div className="modal-wrap"><div className="overlay" onClick={onClose} /><section className="modal">
      <header><div>{step !== "source" && <button className="back-button" onClick={() => setStep("source")}><ChevronRight size={18} /></button>}<span className="eyebrow">NEW ANALYSIS</span><h2>创建分析任务</h2><p>选择一种聊天数据来源，稍后仍可同步或补充。</p></div><button className="icon-button" onClick={onClose}><X size={19} /></button></header>
      {step === "source" && <div className="source-grid">
        {(Object.keys(sourceMeta) as SourceType[]).map((key) => {
          const item = sourceMeta[key];
          const descriptions = { salesmartly: "选择并同步一个客户的聊天记录", text: "粘贴任意格式的对话文本", excel: "上传 Excel 或 CSV 并自动解析" };
          return <button key={key} onClick={() => { setStep(key); setImportPreview(null); setSelectedConversationKey(""); setSourceError(""); }}><span className={`source-large ${item.color}`}><item.icon size={24} /></span><strong>{item.label}</strong><p>{descriptions[key]}</p><ChevronRight size={18} /></button>;
        })}
      </div>}
      {step === "salesmartly" && <div className="modal-body">
        <label className="form-label">搜索 SaleSmartly 客户</label><div className="salesmartly-search"><label className="search-box large"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchCustomers(); } }} placeholder="姓名、邮箱、手机号或客户 ID" /></label><button className="secondary-button" onClick={() => void searchCustomers()} disabled={searching}>{searching ? <RefreshCw className="spin" size={15} /> : <Search size={15} />}{searching ? "搜索中" : "搜索"}</button></div>
        <div className={sourceError ? "connection-error" : "connection-ok"}><CircleAlert size={15} />{sourceError || (searching ? "正在连接 SaleSmartly…" : customerTotal == null ? "正在读取客户" : `已连接 SaleSmartly · 共 ${customerTotal} 位客户`)}</div>
        <div className="customer-options">{customers.map((customer) => <button className={selectedCustomerId === customer.id ? "selected" : ""} key={customer.id} onClick={() => setSelectedCustomerId(customer.id)}><div className="avatar small">{initials(customer.name)}</div><div><strong>{customer.name}</strong><span>{customer.channel}{customer.email ? ` · ${customer.email}` : customer.phone ? ` · ${customer.phone}` : ""}</span><small>{customer.lastMessageAt}</small></div>{selectedCustomerId === customer.id && <Check size={17} />}</button>)}{loadedCustomers && !searching && !sourceError && !customers.length && <div className="empty-customers">没有找到匹配客户，请更换关键词。</div>}</div>
      </div>}
      {step === "text" && <div className="modal-body import-smart-body"><label className="form-label">客户名称（可选提示）</label><input className="text-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="例如 James Carter" />{!importPreview ? <><label className="form-label">粘贴聊天记录</label><textarea className="import-textarea" value={conversation} onChange={(e) => { setConversation(e.target.value); setImportPreview(null); }} placeholder="支持 WhatsApp、Messenger、SaleSmartly 或任意带姓名/时间的复制文本" /><p className="field-help">AI 只识别结构，不会翻译、改写或补写原始聊天。</p></> : <ImportPreviewPanel preview={importPreview} selectedConversationKey={selectedConversationKey} onConversationChange={setSelectedConversationKey} onRoleChange={updateSenderRole} />}{sourceError && <div className="import-parse-error"><CircleAlert size={14} />{sourceError}</div>}</div>}
      {step === "excel" && <div className="modal-body import-smart-body"><label className="form-label">客户名称（可选提示）</label><input className="text-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /><input ref={fileRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void readFile(e.target.files?.[0])} />{!importPreview ? <><button className={`dropzone ${fileName ? "has-file" : ""}`} onClick={() => fileRef.current?.click()}><span><FileSpreadsheet size={28} /></span><strong>{fileName || "点击选择 Excel 或 CSV 文件"}</strong><p>{fileName ? "文件已读取，等待智能识别" : "支持 .xlsx、.xls、.csv，最大 20MB"}</p></button><div className="mapping-preview"><strong>AI 智能映射</strong><span>工作表与会话</span><span>时间与发送人</span><span>客户与销售角色</span><span>消息内容</span></div></> : <ImportPreviewPanel preview={importPreview} selectedConversationKey={selectedConversationKey} onConversationChange={setSelectedConversationKey} onRoleChange={updateSenderRole} />}{sourceError && <div className="import-parse-error"><CircleAlert size={14} />{sourceError}</div>}</div>}
      {step !== "source" && <footer>{importPreview && (step === "text" || step === "excel") && <button className="secondary-button import-reparse" onClick={() => { setImportPreview(null); setSelectedConversationKey(""); setSourceError(""); }} disabled={creating || parsingImport}>返回修改</button>}<button className="secondary-button" onClick={onClose} disabled={creating || parsingImport}>取消</button>{(step === "text" || step === "excel") && !importPreview ? <button className="primary-button" onClick={() => void parseImport()} disabled={parsingImport || (step === "excel" ? !fileName : !conversation.trim())}>{parsingImport ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}{parsingImport ? "AI 正在识别格式…" : "智能识别并预览"}</button> : <button className="primary-button" onClick={() => void create()} disabled={creating || (step === "salesmartly" && !selectedCustomerId) || ((step === "text" || step === "excel") && (!selectedAnalyzableMessages.length || previewUnknownCount > 0))}>{creating ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}{creating ? "读取聊天并分析中…" : previewUnknownCount > 0 ? `请先确认 ${previewUnknownCount} 条角色` : "确认并创建分析"}</button>}</footer>}
    </section></div>
  );
}

function KnowledgeView({ kind }: { kind: "scripts" | "products" }) {
  const scripts = kind === "scripts";
  return <section className="page-view">
    <div className="page-header"><div><span className="eyebrow">KNOWLEDGE BASE</span><h1>{scripts ? "话术知识库" : "产品知识库"}</h1><p>{scripts ? "让每一条销售建议都有可靠、可复用的话术依据。" : "统一维护产品事实、文件和可对外表达的内容。"}</p></div><button className="primary-button"><Plus size={17} />{scripts ? "新建话术" : "新建产品"}</button></div>
    <div className="stats-row">
      {(scripts ? [["已发布话术", "84", "+6 本月"], ["平均采纳率", "72%", "+4.8%"], ["待审核", "9", "需要处理"], ["本周调用", "1,286", "+18%"]] : [["产品总数", "26", "+2 本月"], ["资料完整", "18", "69%"], ["关联话术", "127", "+8"], ["待更新文件", "6", "需要处理"]]).map(([label, value, note], i) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong><small className={i === 2 || i === 3 && !scripts ? "warning" : ""}>{note}</small></div>)}
    </div>
    <div className="table-card">
      <div className="table-toolbar"><label className="search-box"><Search size={16} /><input placeholder={scripts ? "搜索话术、场景或标签" : "搜索产品或分类"} /></label><button className="filter-button">全部分类 <ChevronDown size={14} /></button><button className="filter-button">全部状态 <ChevronDown size={14} /></button><button className="secondary-button"><Upload size={16} />批量导入</button></div>
      {scripts ? <table><thead><tr><th>话术名称</th><th>销售阶段</th><th>关联产品</th><th>语言</th><th>状态</th><th>使用次数</th></tr></thead><tbody>{scriptRows.map((row) => <tr key={row.title}><td><div className="name-cell"><span className="doc-icon"><FileText size={16} /></span><strong>{row.title}</strong></div></td><td><span className="table-tag">{row.stage}</span></td><td>{row.product}</td><td>{row.language}</td><td><span className={`publish-state ${row.status}`}>{row.status}</span></td><td>{row.used}</td></tr>)}</tbody></table> : <table><thead><tr><th>产品名称</th><th>分类</th><th>关联文件</th><th>关联话术</th><th>资料完整度</th><th>最后更新</th></tr></thead><tbody>{productRows.map((row) => <tr key={row.name}><td><div className="name-cell"><span className="product-icon"><FlaskConical size={16} /></span><strong>{row.name}</strong></div></td><td><span className="table-tag">{row.category}</span></td><td>{row.docs} 个</td><td>{row.scripts} 条</td><td><div className="completion"><i><b style={{ width: `${row.completeness}%` }} /></i><span>{row.completeness}%</span></div></td><td>{row.updated}</td></tr>)}</tbody></table>}
    </div>
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
  const [source, setSource] = useState("Could you please confirm the quantity and delivery address? Once confirmed, I can prepare the exact quotation for you.");
  const [target, setTarget] = useState("请您确认一下数量和收货地址。确认后，我可以为您准备准确的报价。");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("zh-CN");
  const [tone, setTone] = useState<TranslationTone>("professional");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [translationMeta, setTranslationMeta] = useState("DeepSeek · 商务翻译");
  const languagePrompt = (value: string) => translationLanguages.find((item) => item.value === value)?.prompt || "Auto detect";
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
      <div className="translation-grid"><div><textarea aria-label="需要翻译的内容" maxLength={5000} value={source} onChange={(e) => setSource(e.target.value)} /><footer><span>{source.length} / 5,000</span><button aria-label="清空原文" onClick={() => setSource("")}><X size={15} /></button></footer></div><div className="translation-result"><textarea aria-label="翻译结果" value={target} onChange={(e) => setTarget(e.target.value)} /><footer><span><Sparkles size={14} />自然商务版</span><button onClick={() => navigator.clipboard.writeText(target)}><Copy size={15} />复制</button></footer></div></div>
      <div className="translate-actions"><div><div className="tone-selector"><span>语气</span>{([['professional', '专业'], ['friendly', '友好'], ['concise', '简洁']] as const).map(([value, label]) => <button key={value} className={tone === value ? "active" : ""} onClick={() => setTone(value)}>{label}</button>)}</div>{error && <p className="translation-error">{error}</p>}</div><button className="primary-button" onClick={translate} disabled={loading || !source.trim()}><Languages size={17} />{loading ? "AI 翻译中，请稍候…" : "开始翻译"}</button></div>
    </div>
    <div className="translator-features"><div><ShieldCheck size={20} /><strong>术语保护</strong><p>产品名、规格、单位不会被错误改写。</p></div><div><Sparkles size={20} /><strong>自然表达</strong><p>根据商务场景优化语气，不是逐字直译。</p></div><div><LockKeyhole size={20} /><strong>隐私模式</strong><p>可关闭翻译历史，不在浏览器长期保存。</p></div></div>
  </section>;
}

function SettingsView() {
  return <SettingsManager />;
}
