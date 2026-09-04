# ClientLens 客户分析台

基于 Next.js 的客户对话分析原型，包含：

- 三栏客户分析台与可重命名任务
- SaleSmartly、文本、Excel/CSV 三种来源
- 结构化客户分析、异议证据、进度清单与 AI 建议
- 可搜索的思维导图话术库、产品知识库和 AI 翻译
- OpenAI GPT / DeepSeek 双模型服务端适配
- 无密钥时的演示分析回退

## 本地运行

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

打开 `http://localhost:3000`。

## Docker 部署

当前生产部署目录为 `/opt/clientlens`，仓库由 `deploy` 用户维护。在 VPS 的 root 终端执行：

```bash
runuser -u deploy -- sh -c 'cd /opt/clientlens && git pull --ff-only && docker compose build && docker compose up -d && docker compose ps'
```

生产环境包含 PostgreSQL，并使用 `clientlens_postgres_data` 持久化卷。先完整配置 `.env.local`，然后运行：

```bash
docker compose up -d --build
docker compose ps
```

应用仅绑定到服务器的 `127.0.0.1:3000`，应通过 Caddy 或其他反向代理对外提供 HTTPS。

## API 配置

首次启动前需要配置 `DATABASE_URL`、`SETTINGS_ENCRYPTION_KEY`、`AUTH_SECRET`、`ADMIN_EMAIL` 和 `ADMIN_PASSWORD`。首次使用环境变量中的管理员账号登录时，系统会自动创建数据库管理员。

可以在服务器生成两个独立的安全随机值：

```bash
openssl rand -base64 32
openssl rand -hex 32
```

OpenAI 和 DeepSeek 密钥由系统设置页面保存，写入数据库前使用 AES-256-GCM 加密。浏览器只接收脱敏值，密钥更新和连接测试会写入审计日志。`.env.local` 和数据库持久化卷都不会随 Git 拉取或应用容器重建而丢失。

不要使用 `NEXT_PUBLIC_` 前缀，也不要提交 `.env.local`。未配置模型密钥时，分析与翻译接口仍会返回演示结果。

SaleSmartly 设置支持加密保存 API Token、Project ID，并按官方规则生成 `external-sign`。新建分析任务时可以搜索真实客户、读取指定客户最近的聊天记录并交给 AI 分析；增量消息同步和 webhook 将在后续阶段接入。

## 思维导图话术库

- 旧分类侧栏和正文列表已替换为 React Flow + ELK 的横向节点树；已有话术数据不会删除或改写。
- “场景路径”支持用 `/` 分层，例如 `建立信任 / 担心被骗 / 首次交易`。同一路径自动合并，空路径进入“未分类”。编辑该字段即可移动话术；现有单层场景保持原名。
- 搜索覆盖当前状态筛选下的所有话术，包括折叠分支。标题优先于标签/产品/场景，再匹配正文；点击结果展开祖先节点并定位。
- 点击话术节点阅读，在节点内复制原文、翻译为英语并复制译文。导图按需加载，不参与客户分析。
- 手机端使用同一数据的折叠树形导航。

逻辑测试（Node 22.18+）：`node --experimental-strip-types --test tests/script-map.test.mjs`。

浏览器回归测试：先构建，再用 `AUTH_SECRET='' pnpm exec next start -p 3105 -H 127.0.0.1` 启动隔离的本机测试服务，然后执行 `node tests/script-map-browser.mjs`。测试需要 Playwright 和 Chrome，可通过 `PLAYWRIGHT_MODULE` 指定已有 Playwright 包路径。所有 API 在测试浏览器内拦截为模拟数据，不访问真实话术库。不要对生产服务禁用认证。
