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

## API 配置

密钥只放在服务端 `.env.local`，不要使用 `NEXT_PUBLIC_` 前缀。模型调用实现位于 `lib/ai.ts`。未配置密钥时 `/api/analyze` 与 `/api/translate` 会返回演示结果，方便先验收界面。

SaleSmartly 当前只完成了连接配置和客户选择交互骨架；真实客户搜索与增量消息同步需要根据账号开放的新 API 文档补充具体端点。
