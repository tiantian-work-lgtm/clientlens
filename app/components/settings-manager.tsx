"use client";

import { useEffect, useState } from "react";
import { Bot, Check, CheckCircle2, CircleDashed, Clock3, Cloud, KeyRound, LockKeyhole, LogOut, RefreshCw, Save, ShieldCheck, Sparkles, Trash2, UserPlus, UsersRound, Zap } from "lucide-react";
import type { IntegrationProvider, Provider } from "@/lib/types";

interface ProviderConfig {
  provider: Provider;
  configured: boolean;
  maskedKey: string;
  model: string;
  enabled: boolean;
  apiKey: string;
}

interface SaleSmartlyConfig {
  configured: boolean;
  maskedKey: string;
  apiToken: string;
  projectId: string;
  baseUrl: string;
  enabled: boolean;
}

interface StoredConfig {
  provider: string;
  configured: boolean;
  maskedKey: string;
  model: string;
  baseUrl: string;
  enabled: boolean;
}

interface Assignments {
  analysisProvider: Provider;
  translationProvider: Provider;
  knowledgeProvider: Provider;
}

interface AuditLog { id: string; action: string; target: string; created_at: string; email: string | null }
interface ManagedUser { id: string; email: string | null; username: string | null; role: "admin" | "user"; created_at: string; updated_at: string }

const defaults: Record<Provider, ProviderConfig> = {
  openai: { provider: "openai", configured: false, maskedKey: "", model: "gpt-5.6-terra", enabled: true, apiKey: "" },
  deepseek: { provider: "deepseek", configured: false, maskedKey: "", model: "deepseek-v4-flash", enabled: true, apiKey: "" },
};

const saleSmartlyDefault: SaleSmartlyConfig = {
  configured: false,
  maskedKey: "",
  apiToken: "",
  projectId: "",
  baseUrl: "https://developer.salesmartly.com",
  enabled: true,
};

export default function SettingsManager() {
  const [providers, setProviders] = useState<Record<Provider, ProviderConfig>>(defaults);
  const [salesmartly, setSaleSmartly] = useState<SaleSmartlyConfig>(saleSmartlyDefault);
  const [assignments, setAssignments] = useState<Assignments>({ analysisProvider: "openai", translationProvider: "deepseek", knowledgeProvider: "openai" });
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [testing, setTesting] = useState<IntegrationProvider | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [settingsResponse, auditResponse, usersResponse] = await Promise.all([fetch("/api/settings"), fetch("/api/settings/audit"), fetch("/api/settings/users")]);
      const settings = await settingsResponse.json();
      if (!settingsResponse.ok) throw new Error(settings.error || "读取设置失败");
      const next = { openai: { ...defaults.openai }, deepseek: { ...defaults.deepseek } };
      let nextSaleSmartly = { ...saleSmartlyDefault };
      for (const item of settings.providers as StoredConfig[]) {
        if (item.provider === "openai" || item.provider === "deepseek") next[item.provider] = { ...next[item.provider], configured: item.configured, maskedKey: item.maskedKey, model: item.model, enabled: item.enabled, apiKey: "" };
        if (item.provider === "salesmartly") nextSaleSmartly = { ...nextSaleSmartly, configured: item.configured, maskedKey: item.maskedKey, projectId: item.model, baseUrl: item.baseUrl || saleSmartlyDefault.baseUrl, enabled: item.enabled, apiToken: "" };
      }
      setProviders(next);
      setSaleSmartly(nextSaleSmartly);
      setAssignments(settings.assignments);
      if (auditResponse.ok) setLogs((await auditResponse.json()).logs ?? []);
      if (usersResponse.ok) setUsers((await usersResponse.json()).users ?? []);
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
        body: JSON.stringify({
          providers: [
            ...Object.values(providers).map(({ provider, apiKey, model, enabled }) => ({ provider, apiKey, model, enabled })),
            { provider: "salesmartly", apiKey: salesmartly.apiToken, model: salesmartly.projectId, enabled: salesmartly.enabled },
          ],
          assignments,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      setProviders((current) => {
        const next = { ...current };
        for (const item of data.providers as StoredConfig[]) if (item.provider === "openai" || item.provider === "deepseek") next[item.provider] = { ...next[item.provider], configured: item.configured, maskedKey: item.maskedKey, model: item.model, enabled: item.enabled, apiKey: "" };
        return next;
      });
      const savedSaleSmartly = (data.providers as StoredConfig[]).find((item) => item.provider === "salesmartly");
      if (savedSaleSmartly) setSaleSmartly((current) => ({ ...current, configured: savedSaleSmartly.configured, maskedKey: savedSaleSmartly.maskedKey, projectId: savedSaleSmartly.model, baseUrl: savedSaleSmartly.baseUrl || saleSmartlyDefault.baseUrl, enabled: savedSaleSmartly.enabled, apiToken: "" }));
      setNotice({ tone: "ok", text: "配置已加密保存，后续部署不会丢失。" });
      void load();
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "保存失败" }); }
    finally { setSaving(false); }
  };

  const test = async (provider: IntegrationProvider) => {
    setTesting(provider);
    setNotice(null);
    try {
      const response = await fetch("/api/settings/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || "测试失败");
      const providerName = provider === "openai" ? "OpenAI" : provider === "deepseek" ? "DeepSeek" : "SaleSmartly";
      setNotice({ tone: "ok", text: `${providerName}：${data.message}` });
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
        <div className="settings-title integration-title"><h2>SaleSmartly 接入</h2><p>用于搜索客户并读取指定客户的聊天记录。API Token 会加密保存。</p></div>
        <SaleSmartlyCard config={salesmartly} testing={testing === "salesmartly"} onChange={(patch) => setSaleSmartly((current) => ({ ...current, ...patch }))} onTest={() => test("salesmartly")} />
        <div className="settings-title user-management-title"><h2>用户管理</h2><p>现有管理员账号保持不变；普通用户使用用户名和密码登录，无法访问系统设置。</p></div>
        <UserManagement users={users} onChanged={load} onNotice={setNotice} />
      </div>
      <aside className="security-sidebar">
        <section><header><ShieldCheck size={18} /><div><h3>数据安全</h3><p>AES-256-GCM</p></div></header><ul><li><Check size={12} />密钥仅在服务端解密</li><li><Check size={12} />浏览器不返回完整密钥</li><li><Check size={12} />安全 Cookie 管理登录</li><li><Check size={12} />数据库持久化存储</li></ul></section>
        <section><header><Clock3 size={18} /><div><h3>最近操作</h3><p>最多显示 30 条</p></div></header><div className="audit-list">{logs.length ? logs.slice(0, 8).map((log) => <div key={log.id}><span>{auditLabel(log.action)}</span><small>{new Date(log.created_at).toLocaleString("zh-CN")}</small></div>) : <p>{loading ? "正在读取…" : "暂无操作记录"}</p>}</div></section>
      </aside>
    </div>
  </section>;
}

function SaleSmartlyCard({ config, testing, onChange, onTest }: { config: SaleSmartlyConfig; testing: boolean; onChange: (patch: Partial<SaleSmartlyConfig>) => void; onTest: () => void }) {
  return <section className="provider-card salesmartly-card"><header><span><Cloud size={20} /></span><div><h3>SaleSmartly API</h3><p>客户列表 · 指定客户聊天记录</p></div><span className={config.configured ? "connected" : "not-connected"}>{config.configured ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />}{config.configured ? "已加密保存" : "待配置"}</span></header>
    <label>API Token<div className="secret-input"><input type="password" value={config.apiToken} onChange={(event) => onChange({ apiToken: event.target.value })} placeholder={config.maskedKey || "输入项目 API Token"} autoComplete="new-password" /><KeyRound size={15} /></div></label>
    <label>Project ID<input value={config.projectId} onChange={(event) => onChange({ projectId: event.target.value })} placeholder="SaleSmartly 左下角项目 ID" /></label>
    <label>API 地址<input value={config.baseUrl} readOnly /></label>
    <label className="provider-enabled"><input type="checkbox" checked={config.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} /><span>启用 SaleSmartly 同步</span></label>
    <footer><span><LockKeyhole size={12} />{config.configured ? `当前 Token ${config.maskedKey}` : "Token 保存后不可回显"}</span><button onClick={onTest} disabled={testing || !config.configured || !config.projectId}>{testing ? "测试中…" : "测试连接"}</button></footer>
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

function UserManagement({ users, onChanged, onNotice }: {
  users: ManagedUser[];
  onChanged: () => Promise<void>;
  onNotice: (notice: { tone: "ok" | "error"; text: string } | null) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  const request = async (url: string, init: RequestInit, success: string) => {
    setBusy(url);
    onNotice(null);
    try {
      const response = await fetch(url, init);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "操作失败");
      onNotice({ tone: "ok", text: success });
      await onChanged();
      return true;
    } catch (error) {
      onNotice({ tone: "error", text: error instanceof Error ? error.message : "操作失败" });
      return false;
    } finally { setBusy(""); }
  };

  const createUser = async () => {
    const ok = await request("/api/settings/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }, `用户 ${username.trim()} 已创建。`);
    if (ok) { setUsername(""); setPassword(""); }
  };

  const resetPassword = async (user: ManagedUser) => {
    const nextPassword = resetPasswords[user.id] || "";
    const ok = await request(`/api/settings/users/${encodeURIComponent(user.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: nextPassword }) }, `用户 ${user.username} 的密码已更新。`);
    if (ok) setResetPasswords((current) => ({ ...current, [user.id]: "" }));
  };

  const deleteUser = async (user: ManagedUser) => {
    if (!window.confirm(`确定删除用户 ${user.username} 吗？`)) return;
    await request(`/api/settings/users/${encodeURIComponent(user.id)}`, { method: "DELETE" }, `用户 ${user.username} 已删除。`);
  };

  return <section className="setting-card user-management-card">
    <header><div className="setting-icon blue"><UsersRound size={18} /></div><div><h3>登录用户</h3><p>管理员通过原邮箱登录；这里创建的账号均为普通用户。</p></div><span className="user-count">{users.length} 个账号</span></header>
    <div className="user-create-row">
      <label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="3–32 位英文、数字或 . _ -" autoComplete="off" /></label>
      <label>初始密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" autoComplete="new-password" /></label>
      <button className="primary-button" onClick={createUser} disabled={busy !== "" || !username.trim() || password.length < 8}><UserPlus size={15} />添加用户</button>
    </div>
    <div className="user-list">
      {users.map((user) => <article key={user.id} className={user.role === "admin" ? "admin-user" : "ordinary-user"}>
        <div className="user-identity"><span>{(user.username || user.email || "U").slice(0, 2).toUpperCase()}</span><div><strong>{user.username || user.email}</strong><small>{user.role === "admin" ? "当前管理员 · 原密码保持不变" : `普通用户 · 创建于 ${new Date(user.created_at).toLocaleDateString("zh-CN")}`}</small></div></div>
        <span className={`user-role ${user.role}`}>{user.role === "admin" ? "管理员" : "普通用户"}</span>
        {user.role === "user" && <div className="user-row-actions"><input type="password" value={resetPasswords[user.id] || ""} onChange={(event) => setResetPasswords((current) => ({ ...current, [user.id]: event.target.value }))} placeholder="输入新密码" autoComplete="new-password" /><button onClick={() => resetPassword(user)} disabled={busy !== "" || (resetPasswords[user.id] || "").length < 8}>重置密码</button><button className="danger" aria-label={`删除 ${user.username}`} onClick={() => deleteUser(user)} disabled={busy !== ""}><Trash2 size={14} /></button></div>}
      </article>)}
    </div>
  </section>;
}

function auditLabel(action: string) {
  return ({ "auth.login": "账号登录", "auth.logout": "账号退出", "settings.update": "更新模型设置", "provider.test": "测试模型连接", "user.create": "创建普通用户", "user.password_reset": "重置用户密码", "user.delete": "删除普通用户" } as Record<string, string>)[action] || action;
}
