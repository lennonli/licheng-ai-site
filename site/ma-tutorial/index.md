# 并购重组审核问询案例知识库制作教程

> 按步骤执行即可从零构建一个年度的并购重组（重组委审核+证监会注册）案例知识库，并同步上线至网站和 MCP。全程约 4-5 个工作日。
> 本教程以 2026 年度（17 家）为范例，其他年度替换年份与数据源路径即可。

---

## 前置条件

- Node.js ≥ 18、Python ≥ 3.12、`/opt/homebrew/bin/pdftotext`（poppler）
- GitHub CLI（`gh`）已登录 `lennonli` 账号
- 网站仓已克隆：`~/Documents/Macbook-pro项目/20-licheng-ai-site/`
- 工作目录：`/Users/your-name/Documents/zhipu/.zcode/workspace/default/ma-restructuring-digest/`

---

## 第一步：接口侦察（0.5 天）

> 目标：确认三交所重组审核披露接口的 URL、参数与字段。

### 1.1 深交所（最简单，先做）

```bash
curl -s "https://www.szse.cn/api/ras/infodisc/query?pageIndex=0&pageSize=5&bizType=3" \
  -H "User-Agent: Mozilla/5.0" -H "Referer: https://www.szse.cn/"
```

- `bizType=3` 即并购重组
- 返回 `data[].subInfoDisclosureList[]` 含每份文件的 `dfnm`（材料名）/`dfphynm`（物理名）/`ddt`（披露日）/`matnm`（材料类别）
- 文件下载：`https://reportdocs.static.szse.cn/UpFiles/rasinfodisc1/{dfphynm前6位}/RAS_{dfphynm}`
- 项目分组按 `prjid`；注册生效判定按文件标题（"中国证监会…注册批复/同意注册"）

### 1.2 上交所

用 playwright 打开 `https://www.sse.com.cn/listing/renewal/ma/index.shtml`，监听 XHR 请求，捕获列表接口。

实测结果（已写入 `tools/ma_api_notes.md`）：

- **项目列表**：`GP_BGCZ_XMLB`（sqlId），需 `issueMarketType=2`（沪主板）或不传（科创板），Referer 必带
- **项目文件**：`GP_COMMON_FILE_SEARCH` + `auditId={stockAuditNum}`
- **文件下载**：`https://static.sse.com.cn/stock{filePath}` ← **必须加 /stock 前缀**，否则 302→404
- 状态码：`currStatus=50 + registeResult=1` = 注册生效；`60` = 终止
- ⚠️ GP_BGCZ_XMLB 返回的 registeResult 只有"有/无注册结果"，需逐家拉文件按批复日期二次筛年份

### 1.3 北交所

用 playwright 打开 `https://www.bse.cn/audit/restructuring_disclosure.html`，捕获 XHR。

实测结果：

- **接口**：`POST zoneInfoResult.do`，参数含 `refinancingTypes=9538` + `refinancingSubTypes[]=9601-xxxx`
- 必须先 GET 页面拿 `C3VK` cookie（与 IPO 同族 WAF）
- 返回 JSONP：`null([{listInfo:{content:[…]}}])` —— 数组包 dict
- 2025 年前北交所重组项目不走此通道（走 9530 通道），需分别查询

### 1.4 产出

将以上接口参数、字段说明、坑逐条写入 `tools/ma_api_notes.md`。

---

## 第二步：清单构建（0.5 天）

> 目标：确认该年度注册生效的公司名单（代码+简称+板块+注册日期）。

### 2.1 SSE 逐家核验

GP_BGCZ_XMLB 返回的 `registeResult` 只有"有/无注册结果"，不含日期。需逐家调 GP_COMMON_FILE_SEARCH 拉"注册的批复"文件日期。

参考脚本：`tools/ma_list_sse.py`（2025 版）。核心逻辑：

1. 拉全量项目列表（分页）
2. 筛 `registeResult` 非空
3. 对每家调 `GP_COMMON_FILE_SEARCH&auditId=…` 拉"注册的批复"文件
4. 取 `fileUpdTime[:8]` 即注册日期，筛目标年份

⚠️ GP_BGCZ_XMLB 分科创板（无 issueMarketType 参数）和沪主板（`issueMarketType=2`）两个子集，**两个都要拉**。

### 2.2 SZSE 核验

SZSE 数据为文件级（非项目级），按 `prjid` 分组后逐家核验注册批复公告。参考方法：用东财公告接口逐股搜索"同意注册"或"注册的批复"（3 页/300 条覆盖法，防止早期公告被截断）。

参考脚本：先用东财 3 页覆盖法核验（`tools/` 内无独立脚本，可在 Python 内联实现），核验结果存 `state/szse_reg_{year}.json`。

### 2.3 BSE 核验

BSE 重组项目走 `refinancingTypes=9538` 通道（非 9530）。若该年度无数据返回，可能原因：该年度 BSE 重组走 9530 通道（与 IPO 同通道），需分别查询。

### 2.4 产出

`state/ma{year}.json`，每条含 `code/full_name/short/board/reg_date/apply_date/audit_id/lawyer/fin_adv/files[]`。

⚠️ **口径校验**：将家数与公开报道（广东省上市公司协会/证监会/交易所审核动态）对照。2025 年为 39 家（SSE 21 + SZSE 14 + BSE 0，差额 4 为吸收合并等），2024 年约 14 家，2023 年约 7 家。

---

## 第三步：文件抓取（1-2 天）

> 目标：每案例抓三类文件——重组报告书、问询回复、补充法律意见书。

### 3.1 SSE

参考脚本：`tools/fetch_ma2026.py`。核心逻辑：

1. 遍历清单，对每家调 `GP_COMMON_FILE_SEARCH&auditId=…` 拉全部文件
2. 按 `WANT` 正则筛选三类文件：`重组报告书|问询函的回复|补充法律意见|法律意见书`
3. 下载 URL：`https://static.sse.com.cn/stock{filePath}` ← **加 /stock 前缀**
4. PDF→txt（`pdftotext -layout`），删 PDF 留 txt，落 `raw/{code}-{简称}/`

### 3.2 SZSE

遍历 `subInfoDisclosureList[]`，筛选 `matnm` 含"报告书/问询/回复/法律意见"的文件，下载 URL 用 `dfpth` 字段。

### 3.3 补漏

- SSE 常见 302→404：检查 URL 是否漏了 `/stock` 前缀
- SZSE 文件标题为泛称"重大资产重组报告书"：需按 PDF 内容区分交易类型
- TCL 科技等扫描版 PDF：`pdftotext` 提取失败，标注【待核验】不 OCR
- 下载超时：`--max-time` 放宽至 300s + `--retry 2`，或分文件逐个重试

### 3.4 质检

每案例检查三类齐备性（报告书✓ 问询回复✓ 法律意见✓），不全的标注原因。产出 `state/idx_ma{year}.json`。

---

## 第四步：案例提炼（2-3 天）

> 目标：每案例生成一份 Markdown 明细，含交易方案、11 个法律维度详述、待核验事项。

### 4.1 模板与词表

- 模板：`tools/TEMPLATE-ma-company.md`（五段式：概况/总览表/详述/未纳入/待核验）
- 词表：`tools/ma-taxonomy.md`（20 类法律问题）
- 均已写好，直接复用

### 4.2 引擎选择

| 引擎 | 优点 | 缺点 | 建议场景 |
|---|---|---|---|
| codex luna max | 质量最优，金额/文号/子问全保留 | OpenAI 额度滚动 24h 消耗大 | 有额度时首选 |
| agy gemini/claude | 免费 | 夜间配额耗尽、双并发触发限制 | 备援 |
| GLM-5.3-Flash 子代理 | 无额度限制、多并发 | 长文提炼偏简略 | 量大时兜底 |

**推荐**：codex luna max 串行逐家（每家约 20-30 分钟），额度不足时切 agy 或 GLM 子代理。runner 带**失败回写队尾**机制（`tools/ma_queue_runner.sh`），额度耗尽时空耗队列行的问题已修复。

### 4.3 批次拆分

```bash
# 每批3-5家，多车道并行
# 参考 tools/ma_sequential.sh（串行版，含自动重试与文件大小质检）
sh tools/ma_sequential.sh 2>&1 | tee state/ma_seq.log
```

### 4.4 质检门槛

| 指标 | 沪深 | 北交所 |
|---|---|---|
| 全文篇幅 | ≥18KB | ≥12KB |
| 详述节数 | ≥3 | ≥2 |
| 每问字数 | 500-900 | 400-700 |

不合格案例自动标记，人工复核后重跑。

### 4.5 提炼口径（6 条硬性要求）

1. 以问询回复与补充法律意见书为主素材，重组报告书（注册稿）核对方案
2. 业绩承诺必须保留逐年数值、补偿方式、减值测试、保障措施
3. 重组上市认定必须保留《重组办法》13 条逐项比对
4. 商誉保留金额、占比、减值测试安排
5. 律师意见与独立财务顾问意见分层标注
6. 每问标注回复文件名+页码区间+txt 行号（三重定位）

---

## 第五步：聚合报告 + Drive 同步（0.5 天）

### 5.1 聚合

复制 `tools/aggregate_ma2025.py`，修改数据源路径与年度标签。该脚本使用**全文关键词匹配** 20 类词表（非表格列提取），避免总览表格式不一致导致的噪声。

### 5.2 报告

复制 `tools/report_ma2025.py`，修改报告标题、年度标签、文件名。注意：

- 报告文件名格式：`2026并购重组案例回溯报告-{年度}-{YYYYMMDD}-V1.md`
- 内链相对路径：`../cases_ma{year}/{code}-{简称}.md` 或站内 `/{base}/{code}-{简称}`
- 全页恰好 1 个 H1（多余 H1 降为 H2）

### 5.3 Drive 同步

```bash
DEST="$HOME/Library/CloudStorage/GoogleDrive-licheng668899@gmail.com/我的云端硬盘/上市审核问询法律回溯/并购重组{year}"
mkdir -p "$DEST/报告" "$DEST/案例明细{year}"
rsync -a reports/ "$DEST/报告/"
rsync -a cases_ma{year}/ "$DEST/案例明细{year}/"
```

---

## 第六步：知识库上线（0.5 天）

> 目标：新建 GitHub 仓库 + 网站新增路由 + MCP 接入。

### 6.1 知识库建仓

```bash
# 目录编号顺延（2026=25, 2025=26, 2024=27, 2023=28）
KB_DIR="$HOME/Documents/Macbook-pro项目/2X-并购重组案例知识库-{年度}"
mkdir -p "$KB_DIR"/{cases,reports,scripts,templates}
# 拷贝案例（从 cases_ma{year}/）、报告（从 reports/）、build-index.py、case-template.md
# 生成 index.json
cd "$KB_DIR" && python3 scripts/build-index.py
# git init + commit + gh repo create + push
```

### 6.2 网站改造

修改 `20-licheng-ai-site/scripts/sync-content.mjs`，共六处：

1. `sources[]` 加新 source（key/base/repo/localRepo）
2. `sourceWebUrls` 加对应项
3. 仿 `buildKbYear` 调用新增该年度（base/title/lead/entries/annualFile/annualTitle/sourceDir）
4. `writeGeneratedSidebar` 加对应节
5. 首页 home-card 加该年度卡片
6. `aiTutorialSection` 示例案例按 key 区分

其他文件：

- `config.mts` nav 下拉追加年度条目
- `verify-site.mjs` articleFiles 正则追加该路由
- `deploy.yml` 加 sha 解析 + Verify public site 加 curl

### 6.3 本地验证

```bash
npm run sync   # 确认 Using local source repo for 该年度
npm test       # build + verify + 单测全绿
```

⚠️ 常见报错：

| 报错 | 原因 | 修复 |
|---|---|---|
| expected one H1, found 2 | 报告正文有多个一级标题 | 降级多余的 H1 为 H2 |
| expected one H1, found 0 | 正文无 H1（迁移脚本剥掉了） | 保留正文 H1 |
| missing internal page | 内链指向不存在的页面 | 检查 annualFile 或示例案例路径 |
| sourceWebUrls undefined | sources[] 或 sourceWebUrls 未同步更新 | 两处都要加 |

### 6.4 上线

```bash
# 知识库仓
cd "$KB_DIR"
git init -b main && git add -A && git commit
gh repo create ma-restructuring-kb-{year} --public --source . --push

# 网站仓
cd ../20-licheng-ai-site
git add -A && git commit
git -c http.version=HTTP/1.1 pull --rebase origin main
git -c http.version=HTTP/1.1 push origin main
# 自动触发部署，gh run watch 至 success
```

### 6.5 线上验证

```bash
for u in "https://ai.licheng.uk/ma{year}/" \
         "https://ai.licheng.uk/ma{year}/{year}年度总结" \
         "https://ai.licheng.uk/kb/" \
         "https://ai.licheng.uk/ma2026/"; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' "$u") $u"
done
# 抽检案例页含"问询要点"
```

---

## 第七步：MCP 接入（0.5 天，可选）

将新库接入 `legal-knowledge-mcp` 服务，使 AI 智能体可通过 MCP 工具直接检索。

### 7.1 数据入 monorepo

将案例与 index.json 拷入 `lennonli/ipo-inquiry-kb` 仓库的对应子目录（如 `ma{year}/cases/` 和 `ma{year}/scripts/index.json`），commit + push。

### 7.2 更新 server.mjs

在 `KBS` 对象中加一条（id/prefix），在 `kbSchema` enum 中追加 id。commit + push。

### 7.3 重启服务

```bash
launchctl stop uk.licheng.legal-knowledge-mcp-v02
launchctl start uk.licheng.legal-knowledge-mcp-v02
```

（若服务器读 GitHub raw 则自动生效，无需重启。）

### 7.4 验证

```bash
# 用 MCP search 工具测试新库
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search","arguments":{"kb":"ma{year}","query":"商誉","limit":2}}}'
```

---

## 附录 A：多引擎接力与断点续跑

| 引擎 | 额度 | 特点 |
|---|---|---|
| codex luna max | OpenAI 滚动 24h | 质量最优，额度耗尽时报"try again at HH:MM" |
| agy gemini-3.1-pro | 每日重置 | 免费但夜间清零，双并发触发限制 |
| agy claude-sonnet-4-6 | 每日重置 | 配额更紧 |
| GLM-5.3-Flash 子代理 | zcode 额度 | 无 OpenAI 限制，但长文提炼偏简略 |

**接力顺序**：codex luna max → agy gemini → agy claude → GLM 子代理。runner 带**失败回写队尾**机制（检查日志含 `out of credits` 或 `terminated due to error` 则回写），额度恢复后自动续跑。

**断点续跑**：已存在的合格 md（≥10KB）自动跳过。脚本重启前先 `pkill -f codex_queue_runner`，再重新消费队列。

## 附录 B：已知坑速查

| 坑 | 解法 |
|---|---|
| SSE 文件下载 302→404 | URL 加 `/stock` 前缀 |
| SZSE 报告书标题泛称 | matnm 不区分支付方式，需按内容判断 |
| BSE WAF 307 | 先 GET 页面拿 C3VK cookie |
| GP_BGCZ_XMLB 只返回35条 | 接口只覆盖审核中心项目，纯现金类不进 |
| 正文剥掉 H1 导致 verify 报 found 0 | 保留正文 H1 |
| 报告多 H1 | 降级多余 H1 为 H2 |
| cninfo 搜索 API 返回空 | 接口不稳定，换东财公告搜索 |
| codex runner 队列行被秒退消耗 | runner 加失败回写队尾机制 |
| npm run sync 报 clone 错误 | 源仓有未提交变更，先 commit |
| git push 网络超时 | 加 `-c http.version=HTTP/1.1` |
| MCP 服务不识别新 KB | server.mjs 的 KBS 对象和 kbSchema 都要更新 |
