import { test } from "node:test";
import assert from "node:assert/strict";
import { menuScriptIds, verifiedSearchIds, searchBatches } from "../lib/script-library.ts";
test("root menu includes children; secondary and uncategorized remain isolated", () => {
  const menus = [{ id: "a", parentId: null }, { id: "b", parentId: "a" }, { id: "c", parentId: null }];
  const scripts = [{ id: "1", menuId: "a" }, { id: "2", menuId: "b" }, { id: "3", menuId: "c" }, { id: "4", menuId: null }];
  assert.deepEqual(menuScriptIds(scripts, menus, "a").map((s) => s.id), ["1", "2"]);
  assert.deepEqual(menuScriptIds(scripts, menus, "b").map((s) => s.id), ["2"]);
  assert.deepEqual(menuScriptIds(scripts, menus, "uncategorized").map((s) => s.id), ["4"]);
  assert.equal(menuScriptIds(scripts, menus, "").length, 4);
});
test("AI can only select unique existing IDs; invalid structure fails visibly", () => {
  assert.deepEqual(verifiedSearchIds({ ids: ["b", "invented", "a", "b", null] }, ["a", "b"]), ["b", "a"]);
  assert.deepEqual(verifiedSearchIds({ ids: [] }, ["a"]), []);
  assert.throws(() => verifiedSearchIds({ results: [] }, ["a"]));
});
test("batching preserves all original content including long records", () => {
  const scripts = Array.from({ length: 100 }, (_, id) => ({ id, content: "x".repeat(1500) }));
  const batches = searchBatches(scripts, 5000);
  assert.deepEqual(batches.flat(), scripts);
  assert.ok(batches.every((batch) => batch.length <= 3));
  assert.deepEqual(searchBatches([{ content: "x".repeat(6000) }], 5000)[0][0].content.length, 6000);
});
