// Run against an isolated local test server with AUTH_SECRET='', never production.
// PLAYWRIGHT_MODULE may point at the bundled runtime's playwright package.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = { products: [], customerRoles: [], triggerText: "", translation: "", language: "zh", tags: [], status: "published", priority: 50, usageCount: 0, createdAt: "2026-09-04", updatedAt: "2026-09-04" };
let scripts = [
  { ...base, id: "trust", title: "首次交易保障", scenario: "建立信任 / 担心被骗 / 首次交易", content: "这是用于验证导图的测试话术：可以提供物流参考。", tags: ["保障"] },
  { ...base, id: "price", title: "报价说明", scenario: "价格 / 报价", content: "请确认需要的数量。" },
  { ...base, id: "none", title: "未分类测试", scenario: "", content: "未分类内容" },
];
let saved = false;
await page.route("**/api/**", async (route) => {
  const url = new URL(route.request().url());
  let body = {};
  if (url.pathname === "/api/auth/session") body = { authenticated: true, username: "test", role: "admin" };
  if (url.pathname === "/api/knowledge/scripts") body = { scripts, stats: { total: scripts.length } };
  if (url.pathname === "/api/translate") { await new Promise((resolve) => setTimeout(resolve, 650)); body = { translation: "This is a test translation." }; }
  if (url.pathname === "/api/knowledge/scripts/trust" && route.request().method() === "PATCH") {
    const changes = route.request().postDataJSON();
    scripts = scripts.map((script) => script.id === "trust" ? { ...script, ...changes } : script);
    saved = true; body = { script: scripts[0] };
  }
  await route.fulfill({ json: body });
});
try {
  await page.goto("http://127.0.0.1:3105");
  await page.getByRole("button", { name: "话术库", exact: true }).click();
  await page.locator(".mind-node-title").first().waitFor();
  assert.equal(await page.locator(".script-category-rail").count(), 0);
  await page.getByRole("textbox", { name: "搜索全部话术" }).fill("物流");
  await page.locator(".mind-search-results button").click();
  await page.locator(".mind-node.selected").waitFor();
  await page.waitForTimeout(650);
  assert.match(await page.locator(".mind-breadcrumb").innerText(), /建立信任.*担心被骗.*首次交易.*首次交易保障/);
  const rect = await page.locator(".mind-node.selected").boundingBox();
  assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= 1440, "search should center the selected node");
  await page.locator(".mind-node.selected .original").click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), scripts[0].content);
  await page.locator(".mind-node.selected").getByRole("button", { name: "翻译成英语" }).click();
  await page.locator(".mind-node.selected .translation.loading").waitFor();
  assert.match(await page.locator(".mind-node.selected .translation").innerText(), /\d+\.\ds/);
  await page.locator(".mind-node.selected .translation:not(.loading)").waitFor();
  await page.locator(".mind-node.selected .translation").click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "This is a test translation.");
  await page.screenshot({ path: "/tmp/clientlens-mind-map-desktop.png" });
  await page.locator(".mind-node.selected").getByRole("button", { name: "编辑 首次交易保障" }).click();
  await page.getByLabel("场景路径（用 / 分层，留空放入未分类）").fill("新的分支 / 首单");
  await page.getByRole("button", { name: "保存话术", exact: true }).click();
  await page.locator(".script-editor").waitFor({ state: "hidden" });
  assert.ok(saved);
  await page.getByRole("textbox", { name: "搜索全部话术" }).fill("首次交易保障");
  await page.locator(".mind-search-results button").click();
  await page.waitForTimeout(500);
  assert.match(await page.locator(".mind-breadcrumb").innerText(), /新的分支.*首单/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".mind-mobile-tree").waitFor({ state: "visible" });
  assert.equal(await page.locator(".mind-canvas").isVisible(), false);
  await page.screenshot({ path: "/tmp/clientlens-mind-map-mobile.png", fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "mobile should not overflow horizontally");
  await page.getByRole("button", { name: "收起分支", exact: true }).click();
  assert.equal(await page.locator(".mind-mobile-tree .original").count(), 0);
  await page.getByRole("textbox", { name: "搜索全部话术" }).fill("不存在的搜索");
  assert.match(await page.locator(".mind-search-results").innerText(), /没有匹配结果/);
  assert.deepEqual(errors, []);
  console.log("PASS: search → expand → center, copy, translation timer/result/copy, edit/move, mobile tree, collapse, empty search; no browser exceptions.");
} catch (error) {
  await page.screenshot({ path: "/tmp/clientlens-mind-map-failure.png" });
  throw error;
} finally { await browser.close(); }
