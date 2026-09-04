# ClientLens 客户分析台

基于 Next.js 的客户对话分析原型，包含：

- 三栏客户分析台与可重命名任务
- SaleSmartly、文本、Excel/CSV 三种来源
- 结构化客户分析、异议证据、进度清单与 AI 建议
- AI 搜索与二级菜单话术库、产品知识库和 AI 翻译
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

## 二级菜单话术库

- 顶栏 AI 搜索，左侧菜单，右侧无标题小卡片。无状态筛选、标签栏、统计或固定详情栏。
- 菜单独立保存在 PostgreSQL 的 `script_menus` 表，最多两级。管理员可通过左侧编辑入口新增、改名、排序、删除；普通员工可浏览、搜索及维护话术，删除话术仍需管理员。
- 一级菜单汇总其下二级菜单话术；删除菜单及其子菜单时，话术自动转入“未分类”，不删除正文。
- 首次部署自动将已有场景迁移为菜单；超过两级的路径合并到二级名称，原正文、历史标题等旧字段保留。迁移只运行一次，后续不会重新创建已删除的菜单。
- 新建和编辑只需正文和所属菜单，不需要话术标题。原文点击复制，长正文可展开；右下角翻译成英语，显示计时，结果附独立复制按钮。
- AI 搜索使用系统配置的 DeepSeek，覆盖全部菜单，分批读取原文后选择已有话术 ID。服务端核验 ID，结果直接使用数据库原文；模型失败明确报错，不用普通搜索或编写内容冒充。它不参与客户分析。

逻辑测试（Node 22.18+）：`node --experimental-strip-types --test tests/script-library.test.mjs`。

集成测试仅使用专用临时 PostgreSQL：`postgresql://library_test@127.0.0.1:55439/postgres`，绝不能指向生产数据库。

1. 设置测试 `DATABASE_URL` 和 `SETTINGS_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`，运行 `node --experimental-strip-types tests/script-library-db.mjs`。
2. 构建后，以相同环境变量和 `AUTH_SECRET=clientlens-isolated-library-test-secret-2026` 启动 `pnpm exec next start -p 3105 -H 127.0.0.1`。
3. 运行 `node tests/script-library-browser.mjs`，需要 Playwright 和 Chrome，可通过 `PLAYWRIGHT_MODULE` 指定已有 Playwright 包路径。测试在 3106 端口启动模拟模型，验证真实后端接口和浏览器交互，不调用付费模型。
4. 测试后关闭临时服务与临时数据库。以上测试密钥禁止用于生产。
