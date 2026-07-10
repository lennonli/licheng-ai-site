# licheng-ai-site

李成律师法律AI工作站网站源码。

## 内容来源

- <https://github.com/lennonli/licheng-AGENTS.md>
- <https://github.com/lennonli/licheng-skills>
- <https://github.com/lennonli/licheng-AI-tutorials>

网站构建时会记录三个源仓库的精确提交版本，并从完整 Git 历史读取各文件真实更新时间。

## 本地运行

```bash
npm ci
npm run dev
```

## 构建

```bash
npm run build
```

## 部署

```bash
npm run deploy
```

生产环境由 GitHub Actions 部署至 Cloudflare Pages。工作流会固定源仓库版本、执行构建和自动验收、验证自定义域名，并仅保留最近三个 Pages 部署版本。

首次配置时，在 GitHub `production` 环境保存 `CLOUDFLARE_ACCOUNT_ID` 和最小权限的 `CLOUDFLARE_API_TOKEN`。隐藏统计页所需的 `ANALYTICS_ACCESS_KEY`、`CLOUDFLARE_ANALYTICS_API_TOKEN`、`CLOUDFLARE_ZONE_ID` 和 `ANALYTICS_HOST` 仅保存为 Cloudflare Pages 运行时 Secret，不在每次部署中重复写入。

## 自动验收范围

- 站内页面、资源与文章目录锚点；
- 每页唯一 H1、更新日期、canonical、Open Graph、Sitemap 与 RSS；
- 站内搜索对 Markdown 和 HTML 教程包装页的覆盖；
- 平板及移动端横向溢出、表格滚动和键盘可访问性；
- 隐藏统计页鉴权、限速与安全响应头。

## 更新记录

| 日期 | 文件 | 更新内容 |
| --- | --- | --- |
| 2026-07-10 | 网站构建、主题、统计接口和部署工作流 | 修复文章日期排序、目录锚点、搜索覆盖、独立 HTML 教程、响应式与可访问性；补齐 SEO、RSS、安全头、依赖固定、部署凭据隔离、线上验收及历史部署保留策略。 |
