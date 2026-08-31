import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { mapScriptRow } from "@/lib/script-knowledge";
import type { KnowledgeScript } from "@/lib/types";

interface ScriptRow {
  id: string; title: string; scenario: string; products: unknown; customer_roles: unknown;
  trigger_text: string; content: string; translation: string; language: string; tags: unknown;
  status: KnowledgeScript["status"]; priority: number; usage_count: number; created_at: Date; updated_at: Date;
}

// The legacy database column remains required for existing installations, but it
// is no longer part of the product model or exposed by the API.
const LEGACY_STAGE_VALUE = "初次询盘与客户背调";

function cleanList(value: unknown) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,，;；\n]/) : [];
  return items.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).slice(0, 30);
}

export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const status = url.searchParams.get("status") === "draft" || url.searchParams.get("status") === "published" ? url.searchParams.get("status") : "";
    const values: unknown[] = [];
    const where: string[] = [];
    if (search) {
      values.push(`%${search}%`);
      where.push(`(title ILIKE $${values.length} OR scenario ILIKE $${values.length} OR trigger_text ILIKE $${values.length} OR content ILIKE $${values.length} OR products::text ILIKE $${values.length} OR tags::text ILIKE $${values.length})`);
    }
    if (status) { values.push(status); where.push(`status = $${values.length}`); }
    const result = await query<ScriptRow>(`SELECT id, title, scenario, products, customer_roles, trigger_text, content,
      translation, language, tags, status, priority, usage_count, created_at, updated_at FROM sales_scripts
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY CASE WHEN status = 'published' THEN 0 ELSE 1 END, priority DESC, updated_at DESC`, values);
    const scripts = result.rows.map(mapScriptRow);
    const totals = await query<{ total: string; published: string; draft: string; usage: string }>(`SELECT COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status = 'published')::text AS published,
      COUNT(*) FILTER (WHERE status = 'draft')::text AS draft,
      COALESCE(SUM(usage_count), 0)::text AS usage FROM sales_scripts`);
    const total = totals.rows[0];
    return NextResponse.json({
      scripts,
      stats: {
        total: Number(total?.total || 0),
        published: Number(total?.published || 0),
        draft: Number(total?.draft || 0),
        usage: Number(total?.usage || 0),
      },
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return NextResponse.json({ error: unauthorized ? "请先登录" : error instanceof Error ? error.message : "读取话术失败" }, { status: unauthorized ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json() as Partial<KnowledgeScript>;
    const title = body.title?.trim() || "";
    const content = body.content?.trim() || "";
    if (!title || !content) return NextResponse.json({ error: "话术标题和正文不能为空" }, { status: 400 });
    const status = body.status === "published" ? "published" : "draft";
    const priority = Math.min(100, Math.max(0, Number(body.priority) || 50));
    const id = randomUUID();
    const result = await query<ScriptRow>(`INSERT INTO sales_scripts
      (id, title, scenario, stage, products, customer_roles, trigger_text, content, translation, language, tags, status, priority, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$14)
      RETURNING id, title, scenario, products, customer_roles, trigger_text, content, translation, language, tags, status, priority, usage_count, created_at, updated_at`,
    [id, title, body.scenario?.trim() || "", LEGACY_STAGE_VALUE, JSON.stringify(cleanList(body.products)), JSON.stringify(cleanList(body.customerRoles)), body.triggerText?.trim() || "", content, body.translation?.trim() || "", body.language?.trim() || "EN", JSON.stringify(cleanList(body.tags)), status, priority, session.userId]);
    await query("INSERT INTO audit_logs (actor_id, action, target, details) VALUES ($1, 'script.create', $2, $3::jsonb)", [session.userId, id, JSON.stringify({ title, status })]);
    return NextResponse.json({ script: mapScriptRow(result.rows[0]) }, { status: 201 });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return NextResponse.json({ error: unauthorized ? "请先登录" : error instanceof Error ? error.message : "创建话术失败" }, { status: unauthorized ? 401 : 500 });
  }
}
