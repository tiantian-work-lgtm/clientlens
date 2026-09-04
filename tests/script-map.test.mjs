import { test } from "node:test";
import assert from "node:assert/strict";
import { buildScriptTree, flattenScriptTree, visibleScriptBranches, scenarioPath, searchScripts } from "../lib/script-map.ts";

const script = (id, title, scenario = "", content = "正文", tags = []) => ({ id, title, scenario, content, tags, products: [], customerRoles: [], triggerText: "", translation: "", priority: 50, status: "published" });

test("scenario paths support hierarchy and preserve uncategorized records", () => {
  assert.deepEqual(scenarioPath(" 建立信任 / 担心被骗 > 首次交易 "), ["建立信任", "担心被骗", "首次交易"]);
  assert.deepEqual(scenarioPath(" / "), ["未分类"]);
});
test("every script appears once, shared branches count correctly, same labels under different parents stay separate", () => {
  const input = [script("1", "一", "信任/首次"), script("2", "二", "信任/首次"), script("3", "三", "付款/首次"), script("4", "四")];
  const root = buildScriptTree(input);
  const nodes = flattenScriptTree(root);
  assert.equal(root.count, 4);
  assert.equal(nodes.filter((node) => node.script).length, 4);
  assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length);
  assert.equal(root.children.find((node) => node.label === "信任").count, 2);
  assert.equal(nodes.filter((node) => node.label === "首次").length, 2);
});
test("collapsed nodes remain searchable and expanding ancestors makes target visible", () => {
  const scripts = [script("1", "首次交易保障", "信任/担心被骗", "提供物流参考")];
  const root = buildScriptTree(scripts);
  assert.equal(visibleScriptBranches(root, new Set(["root"])).length, 2);
  assert.equal(searchScripts(scripts, "物流")[0].script.id, "1");
  const expanded = new Set(flattenScriptTree(root).filter((node) => !node.script).map((node) => node.id));
  assert.ok(visibleScriptBranches(root, expanded).some((node) => node.id === "script:1"));
  assert.equal(visibleScriptBranches(root, new Set()).length, 1);
});
test("title outranks tags, tags outrank body; case and multiple query terms work", () => {
  const items = [script("body", "其他", "", "COA 报告"), script("tag", "其他", "", "报告", ["coa"]), script("title", "COA 报告")];
  assert.deepEqual(searchScripts(items, "coa").map(({ script }) => script.id), ["title", "tag", "body"]);
  assert.equal(searchScripts(items, "coa 不存在").length, 0);
  assert.equal(searchScripts(items, "").length, 0);
  assert.equal(searchScripts(items, "ＣＯＡ").length, 3);
});
test("empty library remains a valid root", () => {
  assert.equal(buildScriptTree([]).children.length, 0);
});
