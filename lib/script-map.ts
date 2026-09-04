import type { KnowledgeScript } from "./types";

export interface ScriptBranch {
  id: string;
  label: string;
  parentId?: string;
  path: string[];
  count: number;
  script?: KnowledgeScript;
  children: ScriptBranch[];
}

export function scenarioPath(scenario: string) {
  const path = scenario.split(/\s*(?:\/|>|＞|→)\s*/).map((part) => part.trim()).filter(Boolean);
  return path.length ? path : ["未分类"];
}

// IDs use the complete path so identically named subcategories remain distinct.
export function buildScriptTree(scripts: KnowledgeScript[]): ScriptBranch {
  const root: ScriptBranch = { id: "root", label: "话术库", path: [], count: scripts.length, children: [] };
  for (const script of scripts) {
    let parent = root;
    const path: string[] = [];
    for (const label of scenarioPath(script.scenario)) {
      path.push(label);
      const id = `group:${JSON.stringify(path)}`;
      let group = parent.children.find((child) => child.id === id);
      if (!group) {
        group = { id, label, path: [...path], parentId: parent.id, count: 0, children: [] };
        parent.children.push(group);
      }
      group.count += 1;
      parent = group;
    }
    parent.children.push({ id: `script:${script.id}`, label: script.title, parentId: parent.id, path: [...path, script.title], count: 1, script, children: [] });
  }
  return root;
}

export function flattenScriptTree(root: ScriptBranch): ScriptBranch[] {
  return [root, ...root.children.flatMap(flattenScriptTree)];
}

export function visibleScriptBranches(root: ScriptBranch, expanded: Set<string>): ScriptBranch[] {
  return [root, ...(expanded.has(root.id) ? root.children.flatMap((child) => visibleScriptBranches(child, expanded)) : [])];
}

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase();

export function searchScripts(scripts: KnowledgeScript[], query: string) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return scripts.map((script) => {
    const fields = [
      { text: script.title, weight: 10 },
      { text: [...script.tags, ...script.products, script.scenario].join(" "), weight: 5 },
      { text: [script.content, script.triggerText, script.translation, ...script.customerRoles].join(" "), weight: 1 },
    ];
    const scores = terms.map((term) => fields.reduce((score, field) => score + (normalize(field.text).includes(term) ? field.weight : 0), 0));
    return { script, score: scores.every(Boolean) ? scores.reduce((a, b) => a + b, 0) : 0 };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || b.script.priority - a.script.priority || a.script.id.localeCompare(b.script.id));
}
