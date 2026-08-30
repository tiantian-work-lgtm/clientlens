# ClientLens 客户分析台

基于 Next.js 的客户对话分析原型，包含：

- 三栏客户分析台与可重命名任务
- SaleSmartly、文本、Excel/CSV 三种来源
- 结构化客户分析、异议证据、进度清单与 AI 建议
- 话术知识库、产品知识库和 AI 翻译
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

SaleSmartly 当前只完成了连接配置和客户选择交互骨架；真实客户搜索与增量消息同步需要根据账号开放的新 API 文档补充具体端点。
