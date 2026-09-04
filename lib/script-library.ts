import type { KnowledgeScript, ScriptMenu } from "./types";

export function menuScriptIds(scripts: KnowledgeScript[], menus: ScriptMenu[], selected: string) {
  if (!selected) return scripts;
  if (selected === "uncategorized") return scripts.filter((script) => !script.menuId);
  const ids = new Set([selected, ...menus.filter((menu) => menu.parentId === selected).map((menu) => menu.id)]);
  return scripts.filter((script) => script.menuId && ids.has(script.menuId));
}

export function verifiedSearchIds(value: unknown, allowed: string[]): string[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { ids?: unknown }).ids)) throw new Error("AI 搜索返回格式异常，请重试");
  const valid = new Set(allowed);
  return [...new Set(((value as { ids: unknown[] }).ids).filter((id): id is string => typeof id === "string" && valid.has(id)))];
}

export function searchBatches<T extends { content: string }>(items: T[], maxCharacters = 50000): T[][] {
  const batches: T[][] = [];
  let current: T[] = [], size = 0;
  for (const item of items) {
    if (current.length && (size + item.content.length > maxCharacters || current.length >= 40)) { batches.push(current); current = []; size = 0; }
    current.push(item); size += item.content.length;
  }
  if (current.length) batches.push(current);
  return batches;
}
