import { query } from "./db";
import type { KnowledgeScript, KnowledgeScriptReference } from "./types";

interface ScriptRow {
  id: string;
  menu_id?: string | null;
  title: string;
  scenario: string;
  products: unknown;
  customer_roles: unknown;
  trigger_text: string;
  content: string;
  translation: string;
  language: string;
  tags: unknown;
  status: KnowledgeScript["status"];
  priority: number;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
}

export function mapScriptRow(row: ScriptRow): KnowledgeScript {
  return {
    id: row.id,
    menuId: row.menu_id ?? null,
    title: row.title,
    scenario: row.scenario,
    products: stringArray(row.products),
    customerRoles: stringArray(row.customer_roles),
    triggerText: row.trigger_text,
    content: row.content,
    translation: row.translation,
    language: row.language,
    tags: stringArray(row.tags),
    status: row.status,
    priority: row.priority,
    usageCount: row.usage_count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function tokens(text: string) {
  const normalized = text.normalize("NFKC").toLocaleLowerCase();
  const result = new Set(normalized.match(/[a-z0-9][a-z0-9_-]{1,}|[\u3400-\u9fff]{2,}/g) ?? []);
  for (const sequence of normalized.match(/[\u3400-\u9fff]{3,}/g) ?? []) {
    for (let index = 0; index < sequence.length - 1; index += 1) result.add(sequence.slice(index, index + 2));
  }
  return [...result].filter((token) => token.length > 1);
}

function containsScore(source: string, searchTokens: string[], weight: number) {
  const normalized = source.normalize("NFKC").toLocaleLowerCase();
  return searchTokens.reduce((score, token) => score + (normalized.includes(token) ? weight : 0), 0);
}

export async function retrieveRelevantScripts(conversation: string, limit = 6): Promise<KnowledgeScript[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const result = await query<ScriptRow>(`SELECT id, title, scenario, products, customer_roles, trigger_text, content,
      translation, language, tags, status, priority, usage_count, created_at, updated_at
      FROM sales_scripts WHERE status = 'published' ORDER BY priority DESC, updated_at DESC LIMIT 500`);
    const searchTokens = tokens(conversation).slice(-180);
    return result.rows.map(mapScriptRow).map((script) => {
      const score = containsScore(script.title, searchTokens, 7)
        + containsScore(script.triggerText, searchTokens, 6)
        + containsScore(script.scenario, searchTokens, 5)
        + containsScore(script.products.join(" "), searchTokens, 5)
        + containsScore(script.tags.join(" "), searchTokens, 4)
        + containsScore(script.customerRoles.join(" "), searchTokens, 2)
        + containsScore(script.content, searchTokens, 1)
        + script.priority / 100;
      return { script, score };
    }).filter((item) => item.score >= 1.5).sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.script);
  } catch (error) {
    console.error("Unable to retrieve sales scripts", error instanceof Error ? error.message : error);
    return [];
  }
}

export function formatScriptKnowledgeContext(scripts: KnowledgeScript[]) {
  if (!scripts.length) return "\n当前没有检索到匹配的已发布话术。请只依据真实聊天生成回复，knowledgeReferenceIds 返回 []。";
  return `\n下面是从话术知识库检索出的参考资料。它们是表达与销售思路参考，不是客户事实；不得把其中的示例、承诺、价格或产品信息当作本次客户已确认事实。只引用确实影响最终建议回复的条目 ID。\n${scripts.map((script) => [
    `[话术 ${script.id}] ${script.title}`,
    `适用场景：${script.scenario || "未分类"}；产品：${script.products.join("、") || "通用"}；标签：${script.tags.join("、") || "无"}`,
    `触发条件：${script.triggerText || "未填写"}`,
    `参考话术：${script.content}`,
    script.translation ? `中文核对：${script.translation}` : "",
  ].filter(Boolean).join("\n")).join("\n\n")}`;
}

export function toScriptReferences(scripts: KnowledgeScript[], ids: string[]): KnowledgeScriptReference[] {
  const selected = new Set(ids);
  return scripts.filter((script) => selected.has(script.id)).map((script) => ({
    id: script.id,
    title: script.title,
    scenario: script.scenario,
    excerpt: script.content.length > 180 ? `${script.content.slice(0, 180)}…` : script.content,
  }));
}

export async function recordScriptUsage(ids: string[]) {
  if (!ids.length || !process.env.DATABASE_URL) return;
  try { await query("UPDATE sales_scripts SET usage_count = usage_count + 1 WHERE id = ANY($1::text[])", [ids]); } catch { /* usage metrics must not block analysis */ }
}
