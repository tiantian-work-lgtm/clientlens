"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Copy, Languages, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import type { KnowledgeScript, ScriptMenu } from "@/lib/types";
import { menuScriptIds } from "@/lib/script-library";
import "./script-library.css";

async function api(url: string, method = "GET", body?: unknown, signal?: AbortSignal) {
  const response = await fetch(url, { method, signal, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "操作失败，请重试");
  return data;
}

function ScriptCard({ script, edit }: { script: KnowledgeScript; edit: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const originalRef = useRef<HTMLButtonElement>(null);
  const [translated, setTranslated] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const controller = useRef<AbortController | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { controller.current?.abort(); clearTimeout(copyTimer.current); }, []);
  useEffect(() => {
    const element = originalRef.current;
    if (!element || expanded) return;
    const observer = new ResizeObserver(() => setOverflow(element.scrollHeight > element.clientHeight + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, script.content]);
  useEffect(() => {
    if (!busy) return;
    const start = performance.now();
    const timer = setInterval(() => setElapsed((performance.now() - start) / 1000), 100);
    return () => clearInterval(timer);
  }, [busy]);
  const copy = async (text: string, kind: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(kind); clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(""), 1600); }
    catch { setError("复制失败，请允许浏览器使用剪贴板。"); }
  };
  const translate = async () => {
    if (busy || translated) return;
    setBusy(true); setElapsed(0); setError("");
    controller.current = new AbortController();
    try {
      const data = await api("/api/translate", "POST", { text: script.content, sourceLanguage: "Auto detect", targetLanguage: "English", tone: "professional" }, controller.current.signal);
      if (data.demo || !data.translation?.trim()) throw new Error("翻译服务未返回有效结果，请检查模型配置后重试");
      setTranslated(data.translation);
    } catch (error) { if (!controller.current?.signal.aborted) setError(error instanceof Error ? error.message : "翻译失败"); }
    finally { setBusy(false); }
  };
  return <article className="library-card">
    <button ref={originalRef} className={`library-original ${expanded ? "expanded" : ""}`} onClick={() => void copy(script.content, "original")} title="点击正文复制" aria-label="复制话术原文">{script.content}</button>
    <footer>{(overflow || expanded) && <button onClick={() => setExpanded(!expanded)}>{expanded ? "收起" : "展开全文"}</button>}<span className="library-copy-status" aria-live="polite">{copied === "original" ? "已复制" : ""}</span><button className="library-edit" aria-label="编辑话术" onClick={edit}><Pencil size={14} /></button><button className="library-translate" disabled={busy || Boolean(translated)} onClick={() => void translate()}>{busy ? <RefreshCw size={15} className="spin" /> : <Languages size={15} />}{busy ? `${elapsed.toFixed(1)}s` : translated ? "已翻译" : "翻译"}</button></footer>
    {(busy || translated) && <div className="library-translation" aria-live="polite">{busy ? <p className="library-loading"><RefreshCw size={16} className="spin" />{elapsed.toFixed(1)}s · 正在翻译成英语</p> : <><p>{translated}</p><button onClick={() => void copy(translated, "translation")}><Copy size={14} />{copied === "translation" ? "已复制" : "复制"}</button></>}</div>}
    {error && <p className="library-error" role="alert">{error}</p>}
  </article>;
}

export default function ScriptLibrary({ isAdmin }: { isAdmin: boolean }) {
  const [scripts, setScripts] = useState<KnowledgeScript[]>([]);
  const [menus, setMenus] = useState<ScriptMenu[]>([]);
  const [selected, setSelected] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [managing, setManaging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<string[] | null>(null);
  const searchController = useRef<AbortController | null>(null);
  const [scriptDraft, setScriptDraft] = useState<{ id?: string; content: string; menuId: string } | null>(null);
  const [menuDraft, setMenuDraft] = useState<{ id?: string; name: string; parentId: string; position: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = async () => {
    setLoading(true);
    try { const data = await api("/api/knowledge/library"); setScripts(data.scripts); setMenus(data.menus); }
    catch (error) { setError(error instanceof Error ? error.message : "读取失败"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); return () => searchController.current?.abort(); }, []);
  const clearSearch = () => { searchController.current?.abort(); setQuery(""); setResults(null); setSearching(false); setError(""); };
  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return clearSearch();
    searchController.current?.abort();
    const controller = new AbortController(); searchController.current = controller;
    setSearching(true); setResults(null); setError("");
    try { const data = await api("/api/knowledge/search", "POST", { query }, controller.signal); if (!controller.signal.aborted) setResults(data.ids); }
    catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "AI 搜索失败"); }
    finally { if (!controller.signal.aborted) setSearching(false); }
  };
  const choose = (id: string) => { clearSearch(); setSelected(id); };
  const saveScript = async (event: FormEvent) => {
    event.preventDefault(); if (!scriptDraft) return;
    setSaving(true); setFormError("");
    try { await api("/api/knowledge/library", scriptDraft.id ? "PATCH" : "POST", scriptDraft); setScriptDraft(null); clearSearch(); await load(); }
    catch (error) { setFormError(error instanceof Error ? error.message : "保存失败"); }
    finally { setSaving(false); }
  };
  const saveMenu = async (event: FormEvent) => {
    event.preventDefault(); if (!menuDraft) return;
    setSaving(true); setFormError("");
    try { await api("/api/knowledge/menus", menuDraft.id ? "PATCH" : "POST", menuDraft); setMenuDraft(null); await load(); }
    catch (error) { setFormError(error instanceof Error ? error.message : "保存失败"); }
    finally { setSaving(false); }
  };
  const removeMenu = async (menu: ScriptMenu) => {
    if (!window.confirm(`删除“${menu.name}”及其子菜单？话术保留并转入未分类。`)) return;
    setSaving(true); setError("");
    try { await api(`/api/knowledge/menus?id=${encodeURIComponent(menu.id)}`, "DELETE"); choose("uncategorized"); await load(); }
    catch (error) { setError(error instanceof Error ? error.message : "删除失败"); }
    finally { setSaving(false); }
  };
  const removeScript = async () => {
    if (!scriptDraft?.id || !window.confirm("确定删除这条话术？此操作不可撤销。")) return;
    setSaving(true); setFormError("");
    try { await api(`/api/knowledge/library?id=${encodeURIComponent(scriptDraft.id)}`, "DELETE"); setScriptDraft(null); clearSearch(); await load(); }
    catch (error) { setFormError(error instanceof Error ? error.message : "删除失败"); }
    finally { setSaving(false); }
  };
  const roots = menus.filter((menu) => !menu.parentId);
  const visible = results ? results.flatMap((id) => scripts.find((script) => script.id === id) || []) : menuScriptIds(scripts, menus, selected);
  const menuRow = (menu: ScriptMenu) => <div className={`library-menu-row ${selected === menu.id ? "active" : ""}`} key={menu.id}>
    {!menu.parentId && <button className="library-disclosure" aria-label={`展开或收起 ${menu.name}`} aria-expanded={!collapsed.has(menu.id)} onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(menu.id)) next.delete(menu.id); else next.add(menu.id); return next; })}>{collapsed.has(menu.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>}
    <button className="library-menu-name" onClick={() => choose(menu.id)}>{menu.name}</button>
    {managing && <div className="library-menu-tools">{!menu.parentId && <button aria-label={`在 ${menu.name} 下新建二级菜单`} onClick={() => { setFormError(""); setMenuDraft({ name: "", parentId: menu.id, position: 0 }); }}><Plus size={13} /></button>}<button aria-label={`编辑菜单 ${menu.name}`} onClick={() => { setFormError(""); setMenuDraft({ ...menu, parentId: menu.parentId || "" }); }}><Pencil size={13} /></button><button disabled={saving} aria-label={`删除菜单 ${menu.name}`} onClick={() => void removeMenu(menu)}><Trash2 size={13} /></button></div>}
  </div>;
  return <section className="page-view simple-library">
    <form className="library-search" onSubmit={search}><Search size={20} /><input aria-label="AI 搜索话术" placeholder="描述客户的问题，或粘贴客户原话，AI 帮你找话术" maxLength={1500} value={query} onChange={(event) => { searchController.current?.abort(); setSearching(false); setQuery(event.target.value); setResults(null); setError(""); }} />{query && <button type="button" className="library-clear" aria-label="清空搜索" onClick={clearSearch}><X size={17} /></button>}<button className="primary-button" disabled={searching || !query.trim()}>{searching ? <RefreshCw size={16} className="spin" /> : <Search size={16} />}{searching ? "搜索中…" : "AI 搜索"}</button></form>
    {error && <p className="library-error" role="alert">{error}</p>}
    <div className="library-columns"><aside className="library-menus"><header><strong>话术库</strong>{isAdmin && <button aria-label="管理菜单" onClick={() => setManaging(!managing)}>{managing ? "完成" : <Pencil size={16} />}</button>}</header>
      <button className={`library-fixed-menu ${selected === "" ? "active" : ""}`} onClick={() => choose("")}>全部话术</button>
      {roots.map((menu) => <div key={menu.id}>{menuRow(menu)}{!collapsed.has(menu.id) && <div className="library-submenus">{menus.filter((child) => child.parentId === menu.id).map(menuRow)}</div>}</div>)}
      <button className={`library-fixed-menu ${selected === "uncategorized" ? "active" : ""}`} onClick={() => choose("uncategorized")}>未分类</button>
      {managing && <button className="library-add-menu" onClick={() => { setFormError(""); setMenuDraft({ name: "", parentId: "", position: 0 }); }}><Plus size={15} />新增一级菜单</button>}
    </aside><main className="library-main"><div className="library-actions"><button className="secondary-button" onClick={() => { setFormError(""); setScriptDraft({ content: "", menuId: selected === "uncategorized" ? "" : selected }); }}><Plus size={15} />新建话术</button></div>
      {loading || searching ? <div className="library-empty"><RefreshCw className="spin" size={20} />{searching ? "AI 正在查找已有话术…" : "正在读取…"}</div> : <div className="library-cards">{visible.map((script) => <ScriptCard key={`${script.id}-${script.updatedAt}`} script={script} edit={() => { setFormError(""); setScriptDraft({ id: script.id, content: script.content, menuId: script.menuId || "" }); }} />)}</div>}
      {!loading && !searching && !visible.length && <p className="library-empty">{results ? "没有找到合适的话术，请换一种描述或从菜单查找。" : "此菜单暂无话术。"}</p>}
    </main></div>
    {(scriptDraft || menuDraft) && <div className="library-modal-wrap"><div className="library-backdrop" onClick={() => { if (!saving) { setScriptDraft(null); setMenuDraft(null); } }} /><section role="dialog" aria-modal="true" aria-label={scriptDraft ? "编辑话术" : "编辑菜单"} className="library-modal"><header><strong>{scriptDraft ? scriptDraft.id ? "编辑话术" : "新建话术" : menuDraft?.id ? "编辑菜单" : "新增菜单"}</strong><button disabled={saving} aria-label="关闭编辑" onClick={() => { setScriptDraft(null); setMenuDraft(null); }}><X size={19} /></button></header>
      {scriptDraft ? <form onSubmit={saveScript}><label>所属菜单<select value={scriptDraft.menuId} onChange={(event) => setScriptDraft({ ...scriptDraft, menuId: event.target.value })}><option value="">未分类</option>{roots.flatMap((menu) => [<option key={menu.id} value={menu.id}>{menu.name}</option>, ...menus.filter((child) => child.parentId === menu.id).map((child) => <option key={child.id} value={child.id}>{menu.name} / {child.name}</option>)])}</select></label><label>话术正文<textarea aria-label="话术正文" autoFocus required value={scriptDraft.content} onChange={(event) => setScriptDraft({ ...scriptDraft, content: event.target.value })} /></label>{formError && <p className="library-error">{formError}</p>}<footer>{isAdmin && scriptDraft.id && <button type="button" className="danger-button" disabled={saving} onClick={() => void removeScript()}>删除话术</button>}<button disabled={saving} className="primary-button">{saving ? "保存中…" : "保存话术"}</button></footer></form> : menuDraft && <form onSubmit={saveMenu}><label>菜单名称<input aria-label="菜单名称" autoFocus required maxLength={80} value={menuDraft.name} onChange={(event) => setMenuDraft({ ...menuDraft, name: event.target.value })} /></label>{!menuDraft.id && <label>上级菜单<select value={menuDraft.parentId} onChange={(event) => setMenuDraft({ ...menuDraft, parentId: event.target.value })}><option value="">无（一级菜单）</option>{roots.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select></label>}<label>排序（数字越小越靠前）<input type="number" min={-100000} max={100000} required value={menuDraft.position} onChange={(event) => setMenuDraft({ ...menuDraft, position: Number(event.target.value) })} /></label>{formError && <p className="library-error">{formError}</p>}<footer><button disabled={saving} className="primary-button">{saving ? "保存中…" : "保存菜单"}</button></footer></form>}
    </section></div>}
  </section>;
}
