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
  Clock3,
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
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserRound,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultConfirmations, defaultProgress, demoReport, initialTasks } from "@/lib/demo-data";
import type { ConfirmationItem, ConfirmationStatus, CustomerTask, ProgressItem, SalesStage, SourceType } from "@/lib/types";
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

function normalizeReport(value: unknown): CustomerTask["report"] {
  const report = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const profile = stringList(report.profile, demoReport.profile);
  const parallelStages = stringList(report.parallelStages)
    .map((stage) => normalizeStage(stage))
    .filter((stage, index, items) => items.indexOf(stage) === index);
  const rawObjections = Array.isArray(report.objections) ? report.objections : demoReport.objections;
  const objections = rawObjections.flatMap((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const severity: "高" | "中" | "低" = item.severity === "高" || item.severity === "中" || item.severity === "低" ? item.severity : "中";
    const status: "待解决" | "处理中" | "已解决" = item.status === "待解决" || item.status === "处理中" || item.status === "已解决" ? item.status : "待解决";
    return [{
      title: stringValue(item.title, `待确认异议 ${index + 1}`),
      severity,
      status,
      evidence: stringValue(item.evidence, "对话中暂无直接证据"),
      advice: stringValue(item.advice, "需要结合原始对话进一步确认。"),
    }];
  });
  const rawConfirmations = Array.isArray(report.confirmations) ? report.confirmations : [];
  const confirmations = defaultConfirmations.map((fallback) => {
    const raw = rawConfirmations.find((value) => value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).id === fallback.id);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...fallback };
    const item = raw as Record<string, unknown>;
    const status = item.status === "confirmed" || item.status === "unknown" || item.status === "risk" || item.status === "na" ? item.status : fallback.status;
    const confidence = Number(item.confidence);
    return {
      ...fallback,
      status,
      evidence: stringValue(item.evidence, fallback.evidence),
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : fallback.confidence,
    };
  });
  const confidence = Number(report.confidence);
  return {
    summary: stringValue(report.summary, demoReport.summary),
    profile,
    stage: normalizeStage(stringValue(report.stage)),
    parallelStages,
    stageReason: stringValue(report.stageReason, demoReport.stageReason),
    objections,
    confirmations,
    improvements: stringList(report.improvements, demoReport.improvements),
    nextActions: stringList(report.nextActions, demoReport.nextActions),
    suggestedReply: stringValue(report.suggestedReply, demoReport.suggestedReply),
    suggestedReplyTranslation: stringValue(report.suggestedReplyTranslation, demoReport.suggestedReplyTranslation),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : demoReport.confidence,
  };
}

function normalizeTask(task: CustomerTask): CustomerTask {
  const hasNewProgress = task.progress?.some((item) => item.id === "inquiry");
  return {
    ...task,
    report: normalizeReport(task.report),
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
  const [analyzing, setAnalyzing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const isAnalyzing = analyzing || activeTask.status === "analyzing";
  const filtered = tasks.filter((task) => task.name.toLowerCase().includes(taskSearch.toLowerCase()));

  const rename = (task: CustomerTask) => {
    const clean = draftName.trim();
    if (clean) onUpdate({ ...task, name: clean });
    setRenaming(null);
  };

  const reanalyze = async () => {
    setAnalyzing(true);
    onUpdate({ ...activeTask, status: "analyzing", analysisStep: "analyzing", analysisError: undefined });
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: activeTask.rawConversation }),
      });
      const data = await response.json();
      const provider = data.provider === "deepseek" ? "deepseek" : "openai";
      if (!response.ok) throw new Error(data.error || "AI 分析失败");
      onUpdate({ ...activeTask, provider, model: provider === "openai" ? "GPT" : "DeepSeek", report: data.report ? normalizeTask({ ...activeTask, report: data.report }).report : activeTask.report, status: "ready", analysisStep: undefined, analysisError: undefined, updatedAt: "刚刚" });
    } catch (error) {
      onUpdate({ ...activeTask, status: "failed", analysisStep: undefined, analysisError: error instanceof Error ? error.message : "AI 分析失败" });
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
    <div className="analysis-grid">
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
                  <MoreHorizontal size={16} className="task-more" />
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
            {activeTask.source === "salesmartly" && <button className="secondary-button" onClick={() => void syncLatestMessages()} disabled={syncing || isAnalyzing}><Cloud size={16} className={syncing ? "spin" : ""} />{syncing ? "同步中…" : "同步最新消息"}</button>}
            <button className="secondary-button" onClick={() => setShowRaw(true)}><FileText size={16} />原始聊天</button>
            <button className="secondary-button"><Upload size={16} />导出</button>
            <button className="primary-button" onClick={reanalyze} disabled={isAnalyzing}><RefreshCw size={16} className={isAnalyzing ? "spin" : ""} />{isAnalyzing ? "分析中…" : "重新分析"}</button>
          </div>
        </div>

        {activeTask.status === "stale" && (
          <div className="stale-banner"><CircleAlert size={17} /><div><strong>发现新的聊天消息</strong><span>当前报告基于旧记录，建议同步并重新分析。</span></div><button onClick={reanalyze}>立即更新</button></div>
        )}
        {syncError && <div className="sync-error-banner"><CircleAlert size={16} /><span>{syncError}</span><button onClick={() => setSyncError("")}><X size={14} /></button></div>}

        {activeTask.status === "analyzing" ? (
          <AnalysisLoading task={activeTask} />
        ) : activeTask.status === "failed" ? (
          <AnalysisFailed task={activeTask} onRetry={reanalyze} />
        ) : <div className="report-content">
          <div className="report-intro">
            <div className="ai-orb"><Sparkles size={22} /></div>
            <div><span>AI ANALYSIS</span><h2>{activeTask.customer.name} 的对话洞察</h2><p>基于 {activeTask.rawConversation.split("\n").length} 条对话 · {activeTask.model} · 置信度 {Math.round(activeTask.report.confidence * 100)}%</p></div>
            <div className="confidence"><div style={{ "--score": `${activeTask.report.confidence * 100}%` } as React.CSSProperties} /><span>高可信</span></div>
          </div>

          <ReportCard icon={FileText} title="对话总结" tone="violet">
            <p className="summary-text">{activeTask.report.summary}</p>
            <button className="text-link">查看分析依据 <ChevronRight size={14} /></button>
          </ReportCard>

          <div className="split-cards">
            <ReportCard icon={UserRound} title="客户画像" tone="blue">
              <div className="tag-cloud">{activeTask.report.profile.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className="mini-metrics">
                <div><small>采购意向</small><strong>较高</strong><i className="meter"><b style={{ width: "78%" }} /></i></div>
                <div><small>信任程度</small><strong>建立中</strong><i className="meter"><b style={{ width: "54%" }} /></i></div>
              </div>
            </ReportCard>
            <ReportCard icon={Target} title="当前销售阶段" tone="cyan">
              <div className="stage-label"><small>主阶段</small><div className="stage-chip">{activeTask.report.stage}</div></div>
              {!!activeTask.report.parallelStages.length && <div className="parallel-stages"><small>并行进行</small>{activeTask.report.parallelStages.map((stage) => <span key={stage}>{stage}</span>)}</div>}
              <p className="muted-copy">{activeTask.report.stageReason}</p>
            </ReportCard>
          </div>

          <ReportCard icon={CircleAlert} title={`主要异议与犹豫点 · ${activeTask.report.objections.length}`} tone="orange">
            <div className="objection-list">
              {activeTask.report.objections.map((item, index) => (
                <details key={item.title} open={index === 0}>
                  <summary><span className={`severity ${item.severity}`}>{item.severity}</span><strong>{item.title}</strong><span className="objection-state">{item.status}</span><ChevronDown size={16} /></summary>
                  <div className="evidence"><blockquote>“{item.evidence.replaceAll("“", "").replaceAll("”", "") }”</blockquote><p><Sparkles size={14} />{item.advice}</p></div>
                </details>
              ))}
            </div>
          </ReportCard>

          <ConfirmationChecklist task={activeTask} onUpdate={onUpdate} />

          <ReportCard icon={Zap} title="本次沟通可改善" tone="amber">
            <div className="number-list">{activeTask.report.improvements.map((item, i) => <div key={item}><span>{i + 1}</span><p>{item}</p></div>)}</div>
          </ReportCard>

          <ReportCard icon={Sparkles} title="AI 下一步建议" tone="violet" featured>
            <div className="action-list">{activeTask.report.nextActions.map((item, i) => <div key={item}><span>{i + 1}</span><p>{item}</p></div>)}</div>
            <div className="reply-box"><div><Bot size={16} /><strong>建议回复</strong><button onClick={() => navigator.clipboard.writeText(activeTask.report.suggestedReply)}><Copy size={14} />复制原文</button></div><p>{activeTask.report.suggestedReply}</p><div className="reply-translation"><span>中文核对</span><p>{activeTask.report.suggestedReplyTranslation}</p></div></div>
          </ReportCard>
        </div>}
      </section>

      <CustomerPanel task={activeTask} onUpdate={onUpdate} onAnalyze={reanalyze} analyzing={isAnalyzing} />

      {showRaw && <RawDrawer task={activeTask} onUpdate={onUpdate} onClose={() => setShowRaw(false)} />}
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
      <p>{importing ? "正在从 SaleSmartly 获取并整理该客户的历史消息…" : "AI 正在识别客户画像、销售阶段、异议和下一步建议…"}</p>
      <div className="analysis-steps">
        <span className={importing ? "active" : "done"}><Check size={13} />读取聊天记录</span>
        <span className={!importing ? "active" : ""}><Sparkles size={13} />AI 结构化分析</span>
        <span><FileText size={13} />生成分析报告</span>
      </div>
    </div>
  );
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
  return <article className={`report-card ${featured ? "featured" : ""}`}><header><span className={`card-icon ${tone}`}><Icon size={17} /></span><h3>{title}</h3><button aria-label="更多"><MoreHorizontal size={18} /></button></header><div className="card-body">{children}</div></article>;
}

const confirmationState: Record<ConfirmationStatus, { label: string; className: string }> = {
  confirmed: { label: "已确认", className: "confirmed" },
  unknown: { label: "未确认", className: "unknown" },
  risk: { label: "存在风险", className: "risk" },
  na: { label: "不适用", className: "na" },
};

function ConfirmationChecklist({ task, onUpdate }: { task: CustomerTask; onUpdate: (task: CustomerTask) => void }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; mode: "hook" | "explain"; text: string; translation: string } | null>(null);
  const categories: ConfirmationItem["category"][] = ["客户角色", "认知与经历", "产品与信任", "交易条件"];
  const completed = task.report.confirmations.filter((item) => item.status === "confirmed" || item.status === "na").length;

  const cycleStatus = (item: ConfirmationItem) => {
    const order: ConfirmationStatus[] = ["unknown", "confirmed", "risk", "na"];
    const status = order[(order.indexOf(item.status) + 1) % order.length];
    onUpdate({
      ...task,
      report: { ...task.report, confirmations: task.report.confirmations.map((current) => current.id === item.id ? { ...current, status } : current) },
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

function CustomerPanel({ task, onUpdate, onAnalyze, analyzing }: { task: CustomerTask; onUpdate: (task: CustomerTask) => void; onAnalyze: () => void; analyzing: boolean }) {
  const done = task.progress.filter((item) => item.state === "done").length;
  const cycleState = (item: ProgressItem): ProgressItem["state"] => {
    const states: ProgressItem["state"][] = ["todo", "doing", "done", "na"];
    return states[(states.indexOf(item.state) + 1) % states.length];
  };
  const updateProgress = (item: ProgressItem) => {
    if (item.locked) return;
    onUpdate({ ...task, progress: task.progress.map((current) => current.id === item.id ? { ...current, state: cycleState(current) } : current) });
  };

  return (
    <aside className="customer-panel">
      <div className="panel-scroll">
        <div className="customer-card">
          <div className="avatar">{initials(task.customer.name)}</div>
          <div><h3>{task.customer.name}</h3><p>{task.customer.company || "未填写公司"}</p></div>
          <button className="icon-button"><Pencil size={15} /></button>
        </div>
        <div className="customer-tags"><span>{task.customer.country}</span><span>{task.customer.product}</span></div>

        <PanelSection title="客户资料">
          <dl className="data-list">
            <div><dt>来源渠道</dt><dd>{task.customer.channel}</dd></div>
            <div><dt>负责人</dt><dd><span className="mini-avatar">{task.customer.owner[0]}</span>{task.customer.owner}</dd></div>
            <div><dt>最后消息</dt><dd>{task.customer.lastMessageAt}</dd></div>
          </dl>
        </PanelSection>

        <PanelSection title="当前判断">
          <div className="panel-stage"><small>主阶段</small><strong>{task.report.stage}</strong></div>
          {!!task.report.parallelStages.length && <div className="panel-parallel"><small>并行</small>{task.report.parallelStages.map((stage) => <span key={stage}>{stage}</span>)}</div>}
          <dl className="data-list compact panel-analysis-stats">
            <div><dt>首要阻碍</dt><dd>{task.report.objections.find((item) => item.status !== "已解决")?.title || "暂无"}</dd></div>
            <div><dt>判断置信度</dt><dd>{Math.round(task.report.confidence * 100)}%</dd></div>
          </dl>
        </PanelSection>

        <PanelSection title="七阶段进度" action={<span className="progress-count">{done}/{task.progress.length}</span>}>
          <div className="progress-bar"><i style={{ width: `${done / task.progress.length * 100}%` }} /></div>
          <div className="progress-list">
            {task.progress.map((item) => (
              <button key={item.id} onClick={() => updateProgress(item)} className={item.state} title={item.locked ? "人工确认项已锁定" : "点击切换状态"}>
                <span>{item.state === "done" ? <Check size={13} /> : item.state === "doing" ? <Clock3 size={13} /> : item.state === "na" ? "—" : ""}</span>
                <em>{item.label}</em>{item.locked && <LockKeyhole size={12} />}
              </button>
            ))}
          </div>
          <p className="panel-hint">AI 建议状态，人工确认后可锁定</p>
        </PanelSection>

        <PanelSection title="本次分析">
          <dl className="data-list compact">
            <div><dt>分析模型</dt><dd><span className={`provider-dot ${task.provider}`} />{task.model}</dd></div>
            <div><dt>数据来源</dt><dd>{sourceMeta[task.source].label}</dd></div>
            <div><dt>更新时间</dt><dd>{task.updatedAt}</dd></div>
            <div><dt>报告版本</dt><dd>v2.0</dd></div>
          </dl>
        </PanelSection>
      </div>
      <div className="panel-actions">
        <button className="primary-button wide" onClick={onAnalyze} disabled={analyzing}><RefreshCw size={16} className={analyzing ? "spin" : ""} />{analyzing ? "正在分析" : "重新分析"}</button>
      </div>
    </aside>
  );
}

function PanelSection({ title, action, children }: React.PropsWithChildren<{ title: string; action?: React.ReactNode }>) {
  return <section className="panel-section"><header><h4>{title}</h4>{action}</header>{children}</section>;
}

function parseConversationLine(line: string) {
  const match = line.match(/^(?:\[([^\]]+)\]\s*)?(Customer|Sales|客户|销售)\s*:\s*(.*)$/i);
  if (!match) return { time: "", role: "unknown" as const, label: "消息", content: line.trim() };
  const customer = /^(customer|客户)$/i.test(match[2]);
  return { time: match[1] || "", role: customer ? "customer" as const : "sales" as const, label: customer ? "客户" : "销售", content: match[3].trim() };
}

function RawDrawer({ task, onClose, onUpdate }: { task: CustomerTask; onClose: () => void; onUpdate: (task: CustomerTask) => void }) {
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const messages = useMemo(() => task.rawConversation.split("\n").map(parseConversationLine).filter((item) => item.content), [task.rawConversation]);
  const savedTranslation = task.rawTranslation?.source === task.rawConversation ? task.rawTranslation.lines : undefined;

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

  return <><div className="overlay" onClick={onClose} /><aside className="drawer raw-drawer">
    <header><div><span className="eyebrow">SOURCE DATA</span><h2>原始聊天记录</h2></div><div className="drawer-actions"><button className="secondary-button" onClick={() => void translate()} disabled={translating}><Languages size={15} />{translating ? "翻译中…" : savedTranslation ? "重新翻译" : "翻译"}</button><button className="icon-button" onClick={onClose}><X size={18} /></button></div></header>
    <div className="drawer-meta"><span>{sourceMeta[task.source].label}</span><span>{task.customer.name}</span><span>{messages.length} 条消息</span></div>
    {translationError && <div className="raw-translation-error"><CircleAlert size={14} />{translationError}</div>}
    <div className="raw-chat-scroll">
      {messages.map((message, index) => <div className={`raw-message ${message.role}`} key={`${index}-${message.content.slice(0, 20)}`}>
        <div className="raw-message-meta"><strong>{message.label}</strong>{message.time && <span>{message.time}</span>}</div>
        <div className="raw-message-bubble"><p>{message.content}</p>{savedTranslation?.[index] && <div className="raw-message-translation"><span>中文</span><p>{savedTranslation[index]}</p></div>}</div>
      </div>)}
    </div>
  </aside></>;
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

function NewTaskModal({ onClose, onCreate, onUpdate }: { onClose: () => void; onCreate: (task: CustomerTask) => void; onUpdate: (task: CustomerTask) => void }) {
  const [step, setStep] = useState<ImportStep>("source");
  const [conversation, setConversation] = useState("");
  const [fileName, setFileName] = useState("");
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
    const name = source === "salesmartly" ? selectedCustomer?.name || "SaleSmartly 客户" : customerName || "新客户";
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
      rawConversation: conversation,
      report: { ...demoReport, confidence: 0 },
      progress: defaultProgress.map((item) => ({ ...item, state: "todo", locked: false })),
      provider: "deepseek",
      model: "AI",
    });
    // 立即创建并选中任务；耗时的同步和分析继续在后台完成。
    onCreate(task);
    let workingTask = task;
    try {
      let importedConversation = conversation;
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
      const analysisResponse = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation: importedConversation }) });
      const analysis = await analysisResponse.json();
      if (!analysisResponse.ok) throw new Error(analysis.error || "AI 分析失败");
      const provider = analysis.provider === "deepseek" ? "deepseek" : "openai";
      onUpdate(normalizeTask({
        ...workingTask,
        name: source === "salesmartly" ? `${name} · ${importedMessageCount} 条消息` : `${name} · 新分析`,
        status: "ready",
        analysisStep: undefined,
        analysisError: undefined,
        rawConversation: importedConversation,
        report: analysis.report || demoReport,
        provider,
        model: provider === "openai" ? "GPT" : "DeepSeek",
      }));
    } catch (error) {
      onUpdate({ ...workingTask, status: "failed", analysisStep: undefined, analysisError: error instanceof Error ? error.message : "创建分析任务失败" });
    } finally { setCreating(false); }
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer());
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    setConversation(rows.slice(0, 200).map((row) => Object.values(row).filter(Boolean).join(" | ")).join("\n"));
  };

  return (
    <div className="modal-wrap"><div className="overlay" onClick={onClose} /><section className="modal">
      <header><div>{step !== "source" && <button className="back-button" onClick={() => setStep("source")}><ChevronRight size={18} /></button>}<span className="eyebrow">NEW ANALYSIS</span><h2>创建分析任务</h2><p>选择一种聊天数据来源，稍后仍可同步或补充。</p></div><button className="icon-button" onClick={onClose}><X size={19} /></button></header>
      {step === "source" && <div className="source-grid">
        {(Object.keys(sourceMeta) as SourceType[]).map((key) => {
          const item = sourceMeta[key];
          const descriptions = { salesmartly: "选择并同步一个客户的聊天记录", text: "粘贴任意格式的对话文本", excel: "上传 Excel 或 CSV 并自动解析" };
          return <button key={key} onClick={() => setStep(key)}><span className={`source-large ${item.color}`}><item.icon size={24} /></span><strong>{item.label}</strong><p>{descriptions[key]}</p><ChevronRight size={18} /></button>;
        })}
      </div>}
      {step === "salesmartly" && <div className="modal-body">
        <label className="form-label">搜索 SaleSmartly 客户</label><div className="salesmartly-search"><label className="search-box large"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchCustomers(); } }} placeholder="姓名、邮箱、手机号或客户 ID" /></label><button className="secondary-button" onClick={() => void searchCustomers()} disabled={searching}>{searching ? <RefreshCw className="spin" size={15} /> : <Search size={15} />}{searching ? "搜索中" : "搜索"}</button></div>
        <div className={sourceError ? "connection-error" : "connection-ok"}><CircleAlert size={15} />{sourceError || (searching ? "正在连接 SaleSmartly…" : customerTotal == null ? "正在读取客户" : `已连接 SaleSmartly · 共 ${customerTotal} 位客户`)}</div>
        <div className="customer-options">{customers.map((customer) => <button className={selectedCustomerId === customer.id ? "selected" : ""} key={customer.id} onClick={() => setSelectedCustomerId(customer.id)}><div className="avatar small">{initials(customer.name)}</div><div><strong>{customer.name}</strong><span>{customer.channel}{customer.email ? ` · ${customer.email}` : customer.phone ? ` · ${customer.phone}` : ""}</span><small>{customer.lastMessageAt}</small></div>{selectedCustomerId === customer.id && <Check size={17} />}</button>)}{loadedCustomers && !searching && !sourceError && !customers.length && <div className="empty-customers">没有找到匹配客户，请更换关键词。</div>}</div>
      </div>}
      {step === "text" && <div className="modal-body"><label className="form-label">客户名称</label><input className="text-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="例如 James Carter" /><label className="form-label">粘贴聊天记录</label><textarea className="import-textarea" value={conversation} onChange={(e) => setConversation(e.target.value)} placeholder="Customer: Hello, I would like to know...&#10;Sales: Hi, happy to help..." /><p className="field-help">系统会自动识别客户、销售、时间和消息内容。</p></div>}
      {step === "excel" && <div className="modal-body"><label className="form-label">客户名称</label><input className="text-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /><input ref={fileRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => readFile(e.target.files?.[0])} /><button className={`dropzone ${fileName ? "has-file" : ""}`} onClick={() => fileRef.current?.click()}><span><FileSpreadsheet size={28} /></span><strong>{fileName || "点击选择 Excel 或 CSV 文件"}</strong><p>{fileName ? `已读取 ${conversation.split("\n").filter(Boolean).length} 行数据` : "支持 .xlsx、.xls、.csv，最大 20MB"}</p></button><div className="mapping-preview"><strong>默认字段映射</strong><span>发送时间 → 自动识别</span><span>发送人 → 自动识别</span><span>消息内容 → 自动识别</span></div></div>}
      {step !== "source" && <footer><button className="secondary-button" onClick={onClose} disabled={creating}>取消</button><button className="primary-button" onClick={() => void create()} disabled={creating || (step === "excel" && !fileName) || (step === "salesmartly" && !selectedCustomerId)}>{creating ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}{creating ? "读取聊天并分析中…" : "创建并分析"}</button></footer>}
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
      {scripts ? <table><thead><tr><th>话术名称</th><th>销售阶段</th><th>关联产品</th><th>语言</th><th>状态</th><th>使用次数</th><th /></tr></thead><tbody>{scriptRows.map((row) => <tr key={row.title}><td><div className="name-cell"><span className="doc-icon"><FileText size={16} /></span><strong>{row.title}</strong></div></td><td><span className="table-tag">{row.stage}</span></td><td>{row.product}</td><td>{row.language}</td><td><span className={`publish-state ${row.status}`}>{row.status}</span></td><td>{row.used}</td><td><MoreHorizontal size={17} /></td></tr>)}</tbody></table> : <table><thead><tr><th>产品名称</th><th>分类</th><th>关联文件</th><th>关联话术</th><th>资料完整度</th><th>最后更新</th><th /></tr></thead><tbody>{productRows.map((row) => <tr key={row.name}><td><div className="name-cell"><span className="product-icon"><FlaskConical size={16} /></span><strong>{row.name}</strong></div></td><td><span className="table-tag">{row.category}</span></td><td>{row.docs} 个</td><td>{row.scripts} 条</td><td><div className="completion"><i><b style={{ width: `${row.completeness}%` }} /></i><span>{row.completeness}%</span></div></td><td>{row.updated}</td><td><MoreHorizontal size={17} /></td></tr>)}</tbody></table>}
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
