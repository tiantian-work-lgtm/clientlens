"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Background, Controls, Handle, Position, ReactFlow, type Node, type NodeProps, type ReactFlowInstance } from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";
import { ChevronDown, ChevronRight, FileText, Search, X } from "lucide-react";
import { buildScriptTree, flattenScriptTree, searchScripts, visibleScriptBranches, type ScriptBranch } from "@/lib/script-map";
import type { KnowledgeScript } from "@/lib/types";
import "@xyflow/react/dist/style.css";
import "./script-mind-map.css";

type MapNode = Node<{ branch: ScriptBranch; expanded: boolean; open: boolean; onClick: () => void; card?: ReactNode }, "branch">;

function BranchNode({ data }: NodeProps<MapNode>) {
  const { branch, open } = data;
  return <div className={`mind-node ${branch.script ? "leaf" : "group"} ${open ? "selected" : ""} ${branch.id === "root" ? "root" : ""}`}>
    {branch.parentId && <Handle type="target" position={Position.Left} isConnectable={false} />}
    <button className="mind-node-title nodrag" onClick={data.onClick} aria-expanded={branch.script ? open : data.expanded} title={branch.label}>
      {branch.script ? <FileText size={18} /> : data.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      <strong>{branch.label}</strong><span>{branch.script ? branch.script.status === "draft" ? "草稿" : "话术" : `${branch.count} 条`}</span>
    </button>
    {open && <div className="mind-node-card nodrag nowheel nopan">{data.card}</div>}
    {!!branch.children.length && <Handle type="source" position={Position.Right} isConnectable={false} />}
  </div>;
}
const nodeTypes = { branch: BranchNode };

export default function ScriptMindMap({ items, renderCard }: { items: KnowledgeScript[]; renderCard: (script: KnowledgeScript) => ReactNode }) {
  const tree = useMemo(() => buildScriptTree(items), [items]);
  const all = useMemo(() => flattenScriptTree(tree), [tree]);
  const byId = useMemo(() => new Map(all.map((branch) => [branch.id, branch])), [all]);
  const [expanded, setExpanded] = useState(new Set(["root"]));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(true);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [layoutError, setLayoutError] = useState("");
  const [flow, setFlow] = useState<ReactFlowInstance<MapNode> | null>(null);
  const focusRef = useRef<string | null>("root");
  const elk = useMemo(() => new ELK(), []);
  const visible = useMemo(() => visibleScriptBranches(tree, expanded), [tree, expanded]);
  const results = useMemo(() => searchScripts(items, query), [items, query]);
  const active = selectedId ? byId.get(selectedId) : undefined;

  const toggle = (branch: ScriptBranch) => {
    focusRef.current = branch.id;
    if (branch.script) setSelectedId((id) => id === branch.id ? null : branch.id);
    else {
      setSelectedId(null);
      setExpanded((current) => { const next = new Set(current); if (next.has(branch.id)) next.delete(branch.id); else next.add(branch.id); return next; });
    }
  };
  const locate = (script: KnowledgeScript) => {
    const id = `script:${script.id}`;
    const ancestors: string[] = [];
    let branch = byId.get(id);
    while (branch?.parentId) { ancestors.push(branch.parentId); branch = byId.get(branch.parentId); }
    setExpanded((current) => new Set([...current, ...ancestors]));
    setSelectedId(id);
    focusRef.current = id;
    setShowResults(false);
    window.setTimeout(() => document.getElementById(`mobile-${script.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  };

  useEffect(() => {
    let cancelled = false;
    setLayoutError("");
    elk.layout({
      id: "layout",
      layoutOptions: { "elk.algorithm": "layered", "elk.direction": "RIGHT", "elk.spacing.nodeNode": "24", "elk.layered.spacing.nodeNodeBetweenLayers": "70" },
      children: visible.map((branch) => ({ id: branch.id, width: branch.id === selectedId ? 580 : 290, height: branch.id === selectedId ? 510 : 76 })),
      edges: visible.filter((branch) => branch.parentId).map((branch) => ({ id: `edge:${branch.id}`, sources: [branch.parentId!], targets: [branch.id] })),
    }).then((layout) => {
      if (cancelled) return;
      setPositions(Object.fromEntries((layout.children ?? []).map((child) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }])));
    }).catch(() => { if (!cancelled) setLayoutError("导图布局暂不可用，请使用下方树形导航；话术数据不受影响。"); });
    return () => { cancelled = true; };
  }, [elk, visible, selectedId]);

  useEffect(() => {
    if (!flow || !focusRef.current) return;
    const id = focusRef.current;
    const position = positions[id];
    if (!position) return;
    const timer = window.setTimeout(() => {
      if (id === "root") void flow.fitView({ duration: 350, maxZoom: 1, minZoom: .35, padding: .15 });
      else void flow.setCenter(position.x + (id === selectedId ? 290 : 145), position.y + (id === selectedId ? 255 : 38), { zoom: 1, duration: 350 });
      focusRef.current = null;
    }, 80);
    return () => window.clearTimeout(timer);
  }, [positions, flow]);

  const nodes: MapNode[] = visible.map((branch) => ({
    id: branch.id, type: "branch", position: positions[branch.id] ?? { x: 0, y: 0 },
    style: { width: branch.id === selectedId ? 580 : 290, height: branch.id === selectedId ? 510 : 76 },
    data: { branch, expanded: expanded.has(branch.id), open: branch.id === selectedId, onClick: () => toggle(branch), card: branch.id === selectedId && branch.script ? renderCard(branch.script) : undefined },
  }));
  const edges = visible.filter((branch) => branch.parentId).map((branch) => ({ id: `edge:${branch.id}`, source: branch.parentId!, target: branch.id, type: "smoothstep", style: { stroke: "#b6addf", strokeWidth: 2 } }));

  const mobileBranch = (branch: ScriptBranch): ReactNode => <div className="mind-tree-branch" key={branch.id} id={branch.script ? `mobile-${branch.script.id}` : undefined}>
    <button onClick={() => toggle(branch)} aria-expanded={branch.script ? branch.id === selectedId : expanded.has(branch.id)}>{branch.script ? <FileText size={16} /> : expanded.has(branch.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<strong>{branch.label}</strong><span>{branch.script ? "" : branch.count}</span></button>
    {branch.script && branch.id === selectedId && renderCard(branch.script)}
    {expanded.has(branch.id) && branch.children.map(mobileBranch)}
  </div>;

  return <div className="mind-library">
    <div className="mind-toolbar">
      <label className="search-box"><Search size={18} /><input aria-label="搜索全部话术" value={query} onFocus={() => setShowResults(true)} onChange={(event) => { setQuery(event.target.value); setShowResults(true); }} placeholder="搜索标题、正文、产品或标签，直达话术" />{query && <button aria-label="清空搜索" onClick={() => setQuery("")}><X size={16} /></button>}</label>
      <button className="secondary-button" onClick={() => { setExpanded(new Set(["root"])); setSelectedId(null); focusRef.current = "root"; }}>收起分支</button>
      <button className="secondary-button mind-fit" onClick={() => void flow?.fitView({ duration: 350, maxZoom: 1, padding: .15 })}>适应屏幕</button>
    </div>
    {!!query.trim() && showResults && <div className="mind-search-results" aria-live="polite"><header>找到 {results.length} 条话术 · 点击定位</header>{!results.length && <p>没有匹配结果，请尝试更短的关键词。</p>}{results.map(({ script }) => <button key={script.id} onClick={() => locate(script)}><strong>{script.title}</strong><small>{script.scenario || "未分类"}</small><span>{script.content.slice(0, 120)}{script.content.length > 120 ? "…" : ""}</span></button>)}</div>}
    <div className="mind-breadcrumb">{active ? ["话术库", ...active.path].join(" › ") : "点击分支展开 · 点击话术阅读 · 拖动画布或使用左下角缩放"}</div>
    {layoutError && <p role="alert">{layoutError}</p>}
    {/* A click handler keeps non-draggable/non-selectable nodes interactive for their inner buttons. */}
    {!layoutError && <div className="mind-canvas"><ReactFlow<MapNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={setFlow} onNodeClick={() => undefined} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} minZoom={.15} maxZoom={1.5} panOnScroll zoomOnDoubleClick={false}><Background gap={24} size={1} color="#d8d3e8" /><Controls showInteractive={false} /></ReactFlow></div>}
    <div className={`mind-mobile-tree ${layoutError ? "fallback" : ""}`}>{mobileBranch(tree)}</div>
    {!items.length && <div className="knowledge-empty">暂无话术，请新建话术或调整状态筛选。</div>}
  </div>;
}
