"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "登录失败");
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
    } finally { setLoading(false); }
  };

  return <main className="login-page">
    <section className="login-panel">
      <div className="login-brand"><span><Sparkles size={22} /></span><div><strong>ClientLens</strong><small>AI Sales Intelligence</small></div></div>
      <div className="login-copy"><span className="eyebrow">SECURE WORKSPACE</span><h1>登录客户分析台</h1><p>客户对话、模型密钥和系统设置仅对管理员开放。</p></div>
      <form onSubmit={login}>
        <label>管理员邮箱<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" required /></label>
        <label>密码<div className="login-password"><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入管理员密码" required /><LockKeyhole size={16} /></div></label>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? "正在验证…" : "安全登录"}</button>
      </form>
      <footer><ShieldCheck size={15} />HTTP-only 安全会话 · 密钥加密存储</footer>
    </section>
  </main>;
}

