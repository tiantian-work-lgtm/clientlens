"use client";

import { useEffect, useState } from "react";
import { Bot, Check, CheckCircle2, CircleDashed, Clock3, KeyRound, LockKeyhole, LogOut, RefreshCw, Save, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { Provider } from "@/lib/types";

interface ProviderConfig {
  provider: Provider;
  configured: boolean;
  maskedKey: string;
  model: string;
  enabled: boolean;
  apiKey: string;
}

interface Assignments {
  analysisProvider: Provider;
  translationProvider: Provider;
  knowledgeProvider: Provider;
}

interface AuditLog { id: string; action: string; target: string; created_at: string; email: string | null }

const defaults: Record<Provider, ProviderConfig> = {
  openai: { provider: "openai", configured: false, maskedKey: "", model: "gpt-5.6-terra", enabled: true, apiKey: "" },
  deepseek: { provider: "deepseek", configured: false, maskedKey: "", model: "deepseek-v4-flash", enabled: true, apiKey: "" },
};

export default function SettingsManager() {
  const [providers, setProviders] = useState<Record<Provider, ProviderConfig>>(defaults);
  const [assignments, setAssignments] = useState<Assignments>({ analysisProvider: "openai", translationProvider: "deepseek", knowledgeProvider: "openai" });
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [testing, setTesting] = useState<Provider | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [settingsResponse, auditResponse] = await Promise.all([fetch("/api/settings"), fetch("/api/settings/audit")]);
      const settings = await settingsResponse.json();
      if (!settingsResponse.ok) throw new Error(settings.error || "读取设置失败");
      const next = { openai: { ...defaults.openai }, deepseek: { ...defaults.deepseek } };
      for (const item of settings.providers as Array<Omit<ProviderConfig, "apiKey">>) {
        if (item.provider === "openai" || item.provider === "deepseek") next[item.provider] = { ...next[item.provider], ...item, apiKey: "" };
      }
      setProviders(next);
      setAssignments(settings.assignments);
      if (auditResponse.ok) setLogs((await auditResponse.json()).logs ?? []);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "读取设置失败" });
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const updateProvider = (provider: Provider, patch: Partial<ProviderConfig>) => setProviders((current) => ({ ...current, [provider]: { ...current[provider], ...patch } }));

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: Object.values(providers).map(({ provider, apiKey, model, enabled }) => ({ provider, apiKey, model, enabled })), assignments }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      setProviders((current) => {
        const next = { ...current };
        for (const item of data.providers as Array<Omit<ProviderConfig, "apiKey">>) if (item.provider === "openai" || item.provider === "deepseek") next[item.provider] = { ...next[item.provider], ...item, apiKey: "" };
        return next;
      });
      setNotice({ tone: "ok", text: "配置已加密保存，后续部署不会丢失。" });
      void load();
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "保存失败" }); }
    finally { setSaving(false); }
  };

  const test = async (provider: Provider) => {
    setTesting(provider);
    setNotice(null);
    try {
      const response = await fetch("/api/settings/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || "测试失败");
      setNotice({ tone: "ok", text: `${provider === "openai" ? "OpenAI" : "DeepSeek"}：${data.message}` });
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "测试失败" }); }
    finally { setTesting(null); }
  };

  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/login"); };

  return <section className="page-view settings-page">
    <div className="page-header"><div><span className="eyebrow">SECURE CONFIGURATION</span><h1>系统设置</h1><p>模型密钥加密存储在数据库中，浏览器只能看到脱敏信息。</p></div><div className="settings-head-actions"><button className="secondary-button" onClick={logout}><LogOut size={15} />退出</button><button className="primary-button" onClick={save} disabled={saving || loading}>{saving ? <RefreshCw className="spin" size={16} /> : <Save size={16} />}{saving ? "保存中…" : "保存设置"}</button></div></div>
    {notice && <div className={`settings-notice ${notice.tone}`}>{notice.tone === "ok" ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}{notice.text}</div>}
    <div className="secure-settings-layout">
      <div className="settings-content">
        <div className="settings-title"><h2>大模型服务</h2><p>留空 API Key 表示保留原密钥；输入新值并保存即可轮换。</p></div>
        <div className="provider-grid">
          <EditableProviderCard config={providers.openai} name="OpenAI GPT" hint="Responses API · Structured Outputs" icon={<Sparkles size={20} />} testing={testing === "openai"} onChange={(patch) => updateProvider("openai", patch)} onTest={() => test("openai")} />
          <EditableProviderCard config={providers.deepseek} name="DeepSeek" hint="Chat Completions · JSON Output" icon={<Zap size={20} />} testing={testing === "deepseek"} onChange={(patch) => updateProvider("deepseek", patch)} onTest={() => test("deepseek")} />
        </div>
        <section className="setting-card"><header><div className="setting-icon"><Bot size={18} /></div><div><h3>功能模型分配</h3><p>为每种任务选择默认服务商，单个任务仍可覆盖。</p></div></header><div className="assignment-table">
          <AssignmentRow label="客户分析" description="总结、阶段、异议和下一步建议" value={assignments.analysisProvider} onChange={(value) => setAssignments({ ...assignments, analysisProvider: value })} />
          <AssignmentRow label="AI 翻译" description="商务翻译和中文核对" value={assignments.translationProvider} onChange={(value) => setAssignments({ ...assignments, translationProvider: value })} />
          <AssignmentRow label="知识库整理" description="提取标签和整理内容" value={assignments.knowledgeProvider} onChange={(value) => setAssignments({ ...assignments, knowledgeProvider: value })} />
        </div></section>
      </div>
      <aside className="security-sidebar">
        <section><header><ShieldCheck size={18} /><div><h3>数据安全</h3><p>AES-256-GCM</p></div></header><ul><li><Check size={12} />密钥仅在服务端解密</li><li><Check size={12} />浏览器不返回完整密钥</li><li><Check size={12} />安全 Cookie 管理登录</li><li><Check size={12} />数据库持久化存储</li></ul></section>
        <section><header><Clock3 size={18} /><div><h3>最近操作</h3><p>最多显示 30 条</p></div></header><div className="audit-list">{logs.length ? logs.slice(0, 8).map((log) => <div key={log.id}><span>{auditLabel(log.action)}</span><small>{new Date(log.created_at).toLocaleString("zh-CN")}</small></div>) : <p>{loading ? "正在读取…" : "暂无操作记录"}</p>}</div></section>
      </aside>
    </div>
  </section>;
}

function EditableProviderCard({ config, name, hint, icon, testing, onChange, onTest }: { config: ProviderConfig; name: string; hint: string; icon: React.ReactNode; testing: boolean; onChange: (patch: Partial<ProviderConfig>) => void; onTest: () => void }) {
  return <section className={`provider-card ${config.provider}-card`}><header><span>{icon}</span><div><h3>{name}</h3><p>{hint}</p></div><span className={config.configured ? "connected" : "not-connected"}>{config.configured ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />}{config.configured ? "已加密保存" : "待配置"}</span></header>
    <label>API Key<div className="secret-input"><input type="password" value={config.apiKey} onChange={(event) => onChange({ apiKey: event.target.value })} placeholder={config.maskedKey || "输入新的 API Key"} autoComplete="new-password" /><KeyRound size={15} /></div></label>
    <label>模型 ID<input value={config.model} onChange={(event) => onChange({ model: event.target.value })} /></label>
    <label className="provider-enabled"><input type="checkbox" checked={config.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} /><span>启用此服务</span></label>
    <footer><span><LockKeyhole size={12} />{config.configured ? `当前密钥 ${config.maskedKey}` : "保存后密钥不可回显"}</span><button onClick={onTest} disabled={testing || !config.configured}>{testing ? "测试中…" : "测试连接"}</button></footer>
  </section>;
}

function AssignmentRow({ label, description, value, onChange }: { label: string; description: string; value: Provider; onChange: (value: Provider) => void }) {
  return <div><span>{label}</span><small>{description}</small><select value={value} onChange={(event) => onChange(event.target.value as Provider)}><option value="openai">OpenAI GPT</option><option value="deepseek">DeepSeek</option></select></div>;
}

function auditLabel(action: string) {
  return ({ "auth.login": "管理员登录", "auth.logout": "管理员退出", "settings.update": "更新模型设置", "provider.test": "测试模型连接" } as Record<string, string>)[action] || action;
}

