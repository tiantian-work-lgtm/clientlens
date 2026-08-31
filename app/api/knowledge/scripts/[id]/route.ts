import { NextResponse } from "next/server";
import { requireAdmin, requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { mapScriptRow } from "@/lib/script-knowledge";
import type { KnowledgeScript, SalesStage } from "@/lib/types";

interface ScriptRow {
  id: string; title: string; scenario: string; stage: SalesStage; products: unknown; customer_roles: unknown;
  trigger_text: string; content: string; translation: string; language: string; tags: unknown;
  status: KnowledgeScript["status"]; priority: number; usage_count: number; created_at: Date; updated_at: Date;
}

const stages: SalesStage[] = ["初次询盘与客户背调", "信任建立", "产品与订单匹配", "决策推进", "等待付款", "已成交", "售后与复购"];
function cleanList(value: unknown) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,，;；\n]/) : [];
  return items.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).slice(0, 30);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = await request.json() as Partial<KnowledgeScript>;
    const title = body.title?.trim() || "";
    const content = body.content?.trim() || "";
    if (!title || !content) return NextResponse.json({ error: "话术标题和正文不能为空" }, { status: 400 });
    const stage = stages.includes(body.stage as SalesStage) ? body.stage as SalesStage : stages[0];
    const status = body.status === "published" ? "published" : "draft";
    const priority = Math.min(100, Math.max(0, Number(body.priority) || 50));
    const result = await query<ScriptRow>(`UPDATE sales_scripts SET title=$2, scenario=$3, stage=$4, products=$5::jsonb,
      customer_roles=$6::jsonb, trigger_text=$7, content=$8, translation=$9, language=$10, tags=$11::jsonb,
      status=$12, priority=$13, updated_by=$14, updated_at=NOW() WHERE id=$1
      RETURNING id, title, scenario, stage, products, customer_roles, trigger_text, content, translation, language, tags, status, priority, usage_count, created_at, updated_at`,
    [id, title, body.scenario?.trim() || "", stage, JSON.stringify(cleanList(body.products)), JSON.stringify(cleanList(body.customerRoles)), body.triggerText?.trim() || "", content, body.translation?.trim() || "", body.language?.trim() || "EN", JSON.stringify(cleanList(body.tags)), status, priority, session.userId]);
    if (!result.rows[0]) return NextResponse.json({ error: "话术不存在" }, { status: 404 });
    await query("INSERT INTO audit_logs (actor_id, action, target, details) VALUES ($1, 'script.update', $2, $3::jsonb)", [session.userId, id, JSON.stringify({ title, status })]);
    return NextResponse.json({ script: mapScriptRow(result.rows[0]) });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return NextResponse.json({ error: unauthorized ? "请先登录" : error instanceof Error ? error.message : "保存话术失败" }, { status: unauthorized ? 401 : 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const result = await query<{ title: string }>("DELETE FROM sales_scripts WHERE id=$1 RETURNING title", [id]);
    if (!result.rows[0]) return NextResponse.json({ error: "话术不存在" }, { status: 404 });
    await query("INSERT INTO audit_logs (actor_id, action, target, details) VALUES ($1, 'script.delete', $2, $3::jsonb)", [session.userId, id, JSON.stringify({ title: result.rows[0].title })]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return NextResponse.json({ error: unauthorized ? "仅管理员可以删除话术" : error instanceof Error ? error.message : "删除话术失败" }, { status: unauthorized ? 403 : 500 });
  }
}
