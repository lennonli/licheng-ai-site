# licheng-ai-site

李成律师法律AI工作站网站源码。

## 内容来源

- <https://github.com/lennonli/licheng-AGENTS.md>（AGENTS 指令）
- <https://github.com/lennonli/licheng-skills>（Agent Skills）
- <https://github.com/lennonli/licheng-AI-tutorials>（AI 教程）
- <https://github.com/lennonli/ipo-inquiry-kb>（IPO 问询案例库 monorepo，/kb/ 与 kb2023-2025、refi2023-2026 同源于其年度子目录）
- <https://github.com/lennonli/ma-restructuring-kb-2026>、[2025](https://github.com/lennonli/ma-restructuring-kb-2025)、[2024](https://github.com/lennonli/ma-restructuring-kb-2024)、[2023](https://github.com/lennonli/ma-restructuring-kb-2023)（并购重组案例库）

网站构建时（`scripts/sync-content.mjs`）会克隆上述仓库（本机存在同名兄弟目录时直接使用本地副本），记录各源仓库的精确提交版本（`site/public/source-manifest.json`），并从完整 Git 历史读取各文件真实更新时间。

## 本地运行

```bash
npm ci
npm run dev:sync
```

同步脚本会优先使用 `../` 下的本地兄弟仓库，其余源仓库从 GitHub 克隆。

## 测试与验收

```bash
npm run sync            # 从源仓库同步内容到 site/
npm run build           # sync + vitepress build
npm run verify          # 构建产物自动验收（scripts/verify-site.mjs）
node --test tests/*.test.mjs   # 单元测试（node:test，无额外依赖）
npm test                # 以上三步连跑，与 CI 一致
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

依赖统一从 npm 官方仓库安装并精确锁定版本；Dependabot 每周检查一次依赖更新，安全漏洞仍由 GitHub 安全更新机制即时处理。

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
| 2026-09-28 | 同步脚本、API 函数与测试 | 修复教程多版本去重时日期不参与排序导致保留旧版的问题；同步前补齐 ma2024/ma2023 目录清理；抽出纯文本函数模块并补单元测试；training 接口 GET 分批并行读取、请求体大小统一按字节校验；清理死代码。 |
