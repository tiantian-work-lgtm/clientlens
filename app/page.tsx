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
import type { ConfirmationItem, ConfirmationStatus, CustomerTask, ProgressItem, Provider, SalesStage, SourceType } from "@/lib/types";

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

function normalizeTask(task: CustomerTask): CustomerTask {
  const report = task.report as CustomerTask["report"] & { parallelStages?: SalesStage[]; confirmations?: ConfirmationItem[] };
  const hasNewProgress = task.progress?.some((item) => item.id === "inquiry");
  return {
    ...task,
    report: {
      ...demoReport,
      ...report,
      stage: normalizeStage(report.stage),
      parallelStages: report.parallelStages ?? [],
      confirmations: report.confirmations?.length ? report.confirmations : defaultConfirmations,
    },
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
  const filtered = tasks.filter((task) => task.name.toLowerCase().includes(taskSearch.toLowerCase()));

  const rename = (task: CustomerTask) => {
    const clean = draftName.trim();
    if (clean) onUpdate({ ...task, name: clean });
    setRenaming(null);
  };

  const reanalyze = async () => {
    setAnalyzing(true);
    onUpdate({ ...activeTask, status: "analyzing" });
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: activeTask.rawConversation, provider: activeTask.provider }),
      });
      const data = await response.json();
      onUpdate({ ...activeTask, report: data.report ? normalizeTask({ ...activeTask, report: data.report }).report : activeTask.report, status: "ready", updatedAt: "刚刚" });
    } catch {
      onUpdate({ ...activeTask, status: "failed" });
    } finally {
      setAnalyzing(false);
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
            <button className="secondary-button" onClick={() => setShowRaw(true)}><FileText size={16} />原始聊天</button>
            <button className="secondary-button"><Upload size={16} />导出</button>
            <button className="primary-button" onClick={reanalyze} disabled={analyzing}><RefreshCw size={16} className={analyzing ? "spin" : ""} />{analyzing ? "分析中…" : "重新分析"}</button>
          </div>
        </div>

        {activeTask.status === "stale" && (
          <div className="stale-banner"><CircleAlert size={17} /><div><strong>发现新的聊天消息</strong><span>当前报告基于旧记录，建议同步并重新分析。</span></div><button onClick={reanalyze}>立即更新</button></div>
        )}

        <div className="report-content">
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
        </div>
      </section>

      <CustomerPanel task={activeTask} onUpdate={onUpdate} onAnalyze={reanalyze} analyzing={analyzing} />

      {showRaw && <RawDrawer task={activeTask} onClose={() => setShowRaw(false)} />}
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
        {task.source === "salesmartly" && <button className="secondary-button wide"><Cloud size={16} />同步最新消息</button>}
        <button className="primary-button wide" onClick={onAnalyze} disabled={analyzing}><RefreshCw size={16} className={analyzing ? "spin" : ""} />{analyzing ? "正在分析" : "重新分析"}</button>
      </div>
    </aside>
  );
}

function PanelSection({ title, action, children }: React.PropsWithChildren<{ title: string; action?: React.ReactNode }>) {
  return <section className="panel-section"><header><h4>{title}</h4>{action}</header>{children}</section>;
}

function RawDrawer({ task, onClose }: { task: CustomerTask; onClose: () => void }) {
  return <><div className="overlay" onClick={onClose} /><aside className="drawer"><header><div><span className="eyebrow">SOURCE DATA</span><h2>原始聊天记录</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header><div className="drawer-meta"><span>{sourceMeta[task.source].label}</span><span>{task.customer.name}</span><span>{task.customer.lastMessageAt}</span></div><pre>{task.rawConversation}</pre></aside></>;
}

function NewTaskModal({ onClose, onCreate }: { onClose: () => void; onCreate: (task: CustomerTask) => void }) {
  const [step, setStep] = useState<ImportStep>("source");
  const [conversation, setConversation] = useState("");
  const [fileName, setFileName] = useState("");
  const [customerName, setCustomerName] = useState("新客户");
  const [selectedCustomer, setSelectedCustomer] = useState("James Carter");
  const fileRef = useRef<HTMLInputElement>(null);

  const create = () => {
    const source = step === "source" ? "text" : step;
    const name = source === "salesmartly" ? selectedCustomer : customerName || "新客户";
    onCreate({
      id: `task-${Date.now()}`,
      name: `${name} · 新分析`,
      source,
      status: "ready",
      updatedAt: "刚刚",
      customer: { name, country: "待识别", owner: "Tina", product: "待识别", channel: sourceMeta[source].label, lastMessageAt: new Date().toLocaleString("zh-CN") },
      rawConversation: conversation || "Customer: Please send me more information about your product and pricing.",
      report: { ...demoReport, stage: "初次询盘与客户背调", parallelStages: ["信任建立"], confidence: 0.74 },
      progress: defaultProgress.map((item) => ({ ...item, state: "todo", locked: false })),
      provider: "openai",
      model: "GPT",
    });
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
        <label className="form-label">搜索 SaleSmartly 客户</label><label className="search-box large"><Search size={16} /><input placeholder="姓名、邮箱、手机号或客户 ID" /></label>
        <div className="connection-ok"><CircleAlert size={15} />演示客户列表 · 配置 API 后读取真实客户</div>
        <div className="customer-options">{["James Carter", "Maria Silva", "Daniel Wong"].map((name, i) => <button className={selectedCustomer === name ? "selected" : ""} key={name} onClick={() => setSelectedCustomer(name)}><div className="avatar small">{initials(name)}</div><div><strong>{name}</strong><span>{i === 0 ? "WhatsApp · 38 条消息" : i === 1 ? "Messenger · 21 条消息" : "WhatsApp · 16 条消息"}</span></div>{selectedCustomer === name && <Check size={17} />}</button>)}</div>
      </div>}
      {step === "text" && <div className="modal-body"><label className="form-label">客户名称</label><input className="text-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="例如 James Carter" /><label className="form-label">粘贴聊天记录</label><textarea className="import-textarea" value={conversation} onChange={(e) => setConversation(e.target.value)} placeholder="Customer: Hello, I would like to know...&#10;Sales: Hi, happy to help..." /><p className="field-help">系统会自动识别客户、销售、时间和消息内容。</p></div>}
      {step === "excel" && <div className="modal-body"><label className="form-label">客户名称</label><input className="text-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /><input ref={fileRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => readFile(e.target.files?.[0])} /><button className={`dropzone ${fileName ? "has-file" : ""}`} onClick={() => fileRef.current?.click()}><span><FileSpreadsheet size={28} /></span><strong>{fileName || "点击选择 Excel 或 CSV 文件"}</strong><p>{fileName ? `已读取 ${conversation.split("\n").filter(Boolean).length} 行数据` : "支持 .xlsx、.xls、.csv，最大 20MB"}</p></button><div className="mapping-preview"><strong>默认字段映射</strong><span>发送时间 → 自动识别</span><span>发送人 → 自动识别</span><span>消息内容 → 自动识别</span></div></div>}
      {step !== "source" && <footer><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={create} disabled={step === "excel" && !fileName}><Sparkles size={16} />创建并分析</button></footer>}
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

function TranslateView() {
  const [source, setSource] = useState("Could you please confirm the quantity and delivery address? Once confirmed, I can prepare the exact quotation for you.");
  const [target, setTarget] = useState("请您确认一下数量和收货地址。确认后，我可以为您准备准确的报价。");
  const [loading, setLoading] = useState(false);
  const translate = async () => {
    setLoading(true);
    try {
      const result = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: source, targetLanguage: "简体中文" }) }).then((r) => r.json());
      setTarget(result.translation);
    } finally { setLoading(false); }
  };
  return <section className="page-view translate-page">
    <div className="page-header"><div><span className="eyebrow">AI TRANSLATOR</span><h1>AI 翻译</h1><p>保留产品术语、数字和语气的自然商务翻译。</p></div><div className="translation-model"><span className="provider-dot openai" />GPT · 商务翻译</div></div>
    <div className="translator-card">
      <div className="language-row"><button>自动检测 · English <ChevronDown size={15} /></button><button className="swap-button"><ArrowLeftRight size={17} /></button><button>简体中文 <ChevronDown size={15} /></button></div>
      <div className="translation-grid"><div><textarea value={source} onChange={(e) => setSource(e.target.value)} /><footer><span>{source.length} / 5,000</span><button onClick={() => setSource("")}><X size={15} /></button></footer></div><div className="translation-result"><textarea value={target} onChange={(e) => setTarget(e.target.value)} /><footer><span><Sparkles size={14} />自然商务版</span><button onClick={() => navigator.clipboard.writeText(target)}><Copy size={15} />复制</button></footer></div></div>
      <div className="translate-actions"><div className="tone-selector"><span>语气</span><button className="active">专业</button><button>友好</button><button>简洁</button></div><button className="primary-button" onClick={translate} disabled={loading}><Languages size={17} />{loading ? "翻译中…" : "开始翻译"}</button></div>
    </div>
    <div className="translator-features"><div><ShieldCheck size={20} /><strong>术语保护</strong><p>产品名、规格、单位不会被错误改写。</p></div><div><Sparkles size={20} /><strong>自然表达</strong><p>根据商务场景优化语气，不是逐字直译。</p></div><div><LockKeyhole size={20} /><strong>隐私模式</strong><p>可关闭翻译历史，不在浏览器长期保存。</p></div></div>
  </section>;
}

function SettingsView() {
  const [saved, setSaved] = useState(false);
  const [analysisProvider, setAnalysisProvider] = useState<Provider>("openai");
  const [translationProvider, setTranslationProvider] = useState<Provider>("deepseek");
  const [connections, setConnections] = useState({ openai: false, deepseek: false, salesmartly: false });
  useEffect(() => {
    fetch("/api/status").then((response) => response.json()).then(setConnections).catch(() => undefined);
  }, []);
  return <section className="page-view settings-page">
    <div className="page-header"><div><span className="eyebrow">CONFIGURATION</span><h1>系统设置</h1><p>配置模型、功能分配和外部数据连接。</p></div><button className="primary-button" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 1800); }}>{saved ? <Check size={17} /> : <Settings size={17} />}{saved ? "已保存" : "保存设置"}</button></div>
    <div className="settings-layout"><aside><button className="active"><Bot size={16} />大模型设置</button><button><Link2 size={16} />SaleSmartly</button><button><ListChecks size={16} />分析模板</button><button><ShieldCheck size={16} />数据与安全</button></aside><div className="settings-content">
      <div className="settings-title"><h2>大模型服务</h2><p>密钥仅由服务端加密保存，不会发送到浏览器。</p></div>
      <div className="provider-grid">
        <ProviderCard name="OpenAI GPT" icon={<Sparkles size={20} />} className="openai-card" model="gpt-5.6-terra" hint="Responses API · Structured Outputs" configured={connections.openai} />
        <ProviderCard name="DeepSeek" icon={<Zap size={20} />} className="deepseek-card" model="deepseek-v4-flash" hint="Chat Completions · JSON Output" configured={connections.deepseek} />
      </div>
      <section className="setting-card"><header><div className="setting-icon"><Bot size={18} /></div><div><h3>功能模型分配</h3><p>不同任务可以分别选择模型，以平衡质量、速度和成本。</p></div></header><div className="assignment-table"><div><span>客户分析</span><small>总结、阶段、异议和下一步建议</small><ProviderSelect value={analysisProvider} onChange={setAnalysisProvider} /></div><div><span>AI 翻译</span><small>商务翻译和术语保护</small><ProviderSelect value={translationProvider} onChange={setTranslationProvider} /></div><div><span>知识库整理</span><small>提取标签和整理内容</small><ProviderSelect value={analysisProvider} onChange={setAnalysisProvider} /></div></div></section>
      <section className="setting-card integration-card"><header><div className="setting-icon blue"><Cloud size={18} /></div><div><h3>SaleSmartly 连接</h3><p>同步客户资料和聊天记录。</p></div><span className={connections.salesmartly ? "connected" : "not-connected"}>{connections.salesmartly ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />}{connections.salesmartly ? "已配置" : "待配置"}</span></header><div className="form-grid"><label>API Key<input type="password" value={connections.salesmartly ? "••••••••••••••••" : ""} placeholder="在服务端环境变量中配置" readOnly /></label><label>同步频率<select defaultValue="15"><option value="15">每 15 分钟</option><option value="30">每 30 分钟</option><option value="60">每小时</option></select></label></div><div className="integration-footer"><span>{connections.salesmartly ? "服务端凭据已就绪" : "当前使用演示客户列表"}</span><button className="secondary-button"><RefreshCw size={15} />测试连接</button></div></section>
    </div></div>
  </section>;
}

function ProviderCard({ name, icon, className, model, hint, configured }: { name: string; icon: React.ReactNode; className: string; model: string; hint: string; configured: boolean }) {
  return <section className={`provider-card ${className}`}><header><span>{icon}</span><div><h3>{name}</h3><p>{hint}</p></div><span className={configured ? "connected" : "not-connected"}>{configured ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />}{configured ? "已配置" : "待配置"}</span></header><label>API Key<div className="secret-input"><input type="password" value={configured ? "••••••••••••••••••••" : ""} placeholder="在服务端环境变量中配置" readOnly /><LockKeyhole size={15} /></div></label><label>默认模型<select defaultValue={model}><option value={model}>{model}</option><option value="custom">手动填写模型 ID</option></select></label><footer><span>配置来自服务端环境变量</span><button>测试连接</button></footer></section>;
}

function ProviderSelect({ value, onChange }: { value: Provider; onChange: (value: Provider) => void }) {
  return <select value={value} onChange={(e) => onChange(e.target.value as Provider)}><option value="openai">OpenAI GPT</option><option value="deepseek">DeepSeek</option></select>;
}
