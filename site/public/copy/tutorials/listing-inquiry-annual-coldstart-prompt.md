# 任务提示词：A股上市+新三板挂牌公司审核问询法律问题回溯（年度批量，冷启动可复现版）

> 用法：将本文件全文作为任务提示词交给具备 Bash+文件读写能力的 AI 代理（如 ZCode/Codex）。
> 本提示词自包含全部接口参数、坑与质量标准，无需任何预先准备的脚本。
> 占位符：{YEAR}=目标年度（如2025）；{WORKDIR}=工作目录（任意可写目录）。

---

你是李成律师的工作代理。任务：完成"{YEAR}年度A股上市+新三板挂牌公司审核问询法律问题回溯"，产出分公司明细与年度报告。工作目录 {WORKDIR}（自建子目录 raw/ companies_{YEAR}/ summaries/ state/ tools/）。

## 步骤1：建清单

**A股{YEAR}年上市**（五板块）：
- 东财列表（限流换备用域）：`https://push2delay.eastmoney.com/api/qt/clist/get?pn={页}&pz=100&po=1&np=1&fltt=2&invt=2&fid=f26&fs=m:1+t:2,m:1+t:23,m:0+t:6,m:0+t:80,m:0+t:81+s:2048&fields=f12,f14,f26`（f26=上市日期YYYYMMDD整数，降序翻页至<{YEAR}0101停；curl带UA，pz=100大页易被断连，失败降pz=20并sleep 1s）
- 全称：`https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_F10_BASIC_ORGINFO&columns=SECUCODE,SECURITY_CODE,SECURITY_NAME_ABBR,ORG_NAME&filter=(SECURITY_CODE="{code}")` 取 ORG_NAME
- 板块判定：688/689科创板、60x沪主板、00x深主板、30x创业板、920北交所；剔除"定转"结尾的定向可转债
- 写 state/companies_{YEAR}.json：[{full_name,ticker,code,market,listed_date}]

**新三板{YEAR}年挂牌**：
- 东财：同上接口 fs=m:0+t:81，筛 f26 在{YEAR}且代码873/874/875开头
- 逐家官网核验：`curl -s "https://www.neeq.com.cn/nqhqController/detailCompany.do?zqdm={code}" -H "Referer: https://www.neeq.com.cn/" -H "X-Requested-With: XMLHttpRequest"`（JSONP剥壳，取 baseinfo.name/shortname/listingDate/broker/area/industry）
- 写 state/neeq_listed_{YEAR}.json

## 步骤2：抓取审核问询文件（全部官网接口，playwright chrome headless 或 curl；PDF→`pdftotext -layout`→删PDF留txt→raw/{ticker或全称}/）

**A股**（对每家公司以简称或全称前6字为关键词检索，筛标题含"回复"）：
- 上交所 `https://query.sse.com.cn/commonSoaQuery.do?jsonCallBack=cb&isPagination=true&sqlId=GP_COMMON_FILE_SEARCH&fileTitle={kw}&pageHelp.pageSize=25&pageHelp.pageNo={n}&fileTypeMap=I0011,I0012,I0013,I3010,M0011,M3010,M3020&marketType={1科创板/2主板}&searchDateBegin=2023-01-01&searchDateEnd={today}`，Header须带 `Referer: https://www.sse.com.cn/`；下载域 `https://static.sse.com.cn/stock`+filePath
- 深交所 `https://www.szse.cn/api/ras/infodisc/query?pageIndex=0&pageSize=50&keywords={kw}&disclosedStartDate=...&disclosedEndDate=...&bizType=1`（主板与创业板均 bizType=1；简称检索不中时试更短词，如"常友"而非"常友科技"）；下载 `https://reportdocs.static.szse.cn/UpFiles/rasinfodisc1/{phys前6位}/RAS_{phys}`
- 北交所 `POST https://www.bse.cn/disclosureInfoController/zoneInfoResult.do`（form: disclosureType=9530, keyword={kw}, startTime/endTime, needFields[i]=companyCd/xxfcbj/companyName/disclosureTitle/disclosureCode/disclosurePostTitle/destFilePath/publishDate/fileExt）；下载 `https://www.bse.cn`+destFilePath
- 北交所另抓标题含"法律意见"的补充法律意见书（同接口不限"回复"过滤）
- 索引 state/idx{YEAR}_{market}.json：[{公司..., files:[{title,date,url,ok,txt_path,fail_reason}]}]

**新三板挂牌审核**（关键：2025-08-02股转切换审核系统，必须双通道检索）：
- 新通道（2025-08-02后受理）：预热 `https://www.neeq.com.cn/disclosure/listing_review_gp.html` 拿cookie后 `POST https://www.neeq.com.cn/disclosureInfoGpController/dxfxItemResult.do`（form: fullName={kw}, shType=1, fxType=1, page=0起）→ 项目 itemNo → `dxfxItemDetailFiles.do`（id=itemNo）取文件清单
- 历史通道（2025-08-02前受理，约六成项目在此）：预热 `https://www.neeq.com.cn/disclosure/listing_review.html` 后 `POST https://www.neeq.com.cn/disclosureInfoController/infoResult.do`，body用urlencode：`flag=1&disclosureType=9&page=0&startTime=2020-01-01&endTime={today}&keyword={kw}&sortfield=xxssdq&sorttype=asc`（**flag=1+keyword 是页面真实参数**，返回 arr[0].listInfo.content[]）
- 两通道文件均筛标题含"回复|法律意见"，下载 `https://www.neeq.com.cn`+destFilePath
- 检索词纪律：新通道用全称或其连续子串；历史通道 keyword 支持简称；两通道均无结果的公司标注"疑绿色通道/简易程序挂牌"待核验，不得编造
- WAF纪律：股转全程串行+每文件sleep 2s+每25个sleep 20s；403冷却10分钟；下载失败用 curl -s -c/-b cookie jar（先GET页面再下载）重试
- 索引 state/idx{YEAR}_neeq_*.json

**下载失败处理**：302/403→两步cookie法；下载成功但pdftotext产出<4KB→`fail_reason="扫描版无法提取文本"`，不OCR，明细中标【待核验】。

## 步骤3：分公司提炼（每家一个 companies_{YEAR}/{ticker}.md）

**必读产出标准**（内嵌于此，无需外部模板）：
```
# {全称}（{code}·{板块}）审核问询法律问题回溯
> 上市/挂牌日期｜问询共N轮｜依据文件（各轮回复文件名+披露日）｜中介机构（保荐人/主办券商、发行人律师、会计师，从txt首页提取）
## 一、公司与审核概况（一段话）
## 二、法律问题总览（表：轮次|问题编号|问题主题|法律类别|律师是否发表意见；纯业务财务问题也列行）
## 三、重点法律问题详述（每个法律问题一节：问询要点/回复与核查要点/核查程序/核查意见/执业提示；A股每问≥400字、新三板≥250字；标PDF页码+txt行号）
## 四、未纳入详述事项
## 五、待核验/待补事项（固定三项：①问询函原文缺失与否 ②签章页/文号完整性 ③txt质量问题）
```

**质量硬性条款（历史教训：缺此条款任何引擎都会过度压缩不合格）**：
- 【覆盖面】凡涉20类法律主题之一的问题必须单独成节详述：历史沿革与股权变动/出资瑕疵/股权代持与三类股东/实控人认定与一致行动/对赌与特殊权利/股权激励与员工持股/关联方与关联交易/同业竞争/土地房产权属/重大合同与业务合规资质/诉讼仲裁与行政处罚/劳动社保与劳务派遣/税务/分红/环保与安全生产/数据合规/境外架构红筹ODI与37号文/五独立性/申报前新增股东突击入股/其他律师核查事项。沪深详述通常≥4节、北交所≥3、新三板≥2；"业务财务类"仅限纯收入/成本/毛利率/应收/存货。
- 【深度】问询要点列全部子问(1)(2)(3)…不省略；回复要点逐子问对应，每条含≥1个具体数据点（文号/批复号/决定书号/金额万元/比例/日期/协议全称/证明机关）；禁止"等""相关事项"概括。每家总篇幅：沪深≥15KB、北交所≥12KB、新三板≥6KB；达不到回txt重读。
- 北交所公司仅覆盖北交所上市审核期间问询（不含挂牌期间）；上市后重组问询不属上市审核问询。
- 只依据txt实际内容；长txt先 `grep -n "问题"` 定位再读区间；不得编造。

**执行引擎经验（按优先级）**：
1. codex CLI `gpt-5.6-terra`（质量最优）或 `gpt-5.6-luna`+reasoning max（必须搭配上述质量条款，裸提示词不合格）：`codex exec --skip-git-repo-check -C {WORKDIR} -m {model} -c 'model_reasoning_effort="max"' --approve-for-me - < prompt.txt`；注意 --sandbox 与 --approve-for-me 互斥；额度耗尽报 "workspace is out of credits" 秒退，需记录断点等重置
2. 主环境内置子代理（批次≤10家、并发≤3）
3. agy CLI（antigravity）：`agy --dangerously-skip-permissions --model gemini-3.1-pro-high --print-timeout 90m --print "{prompt}"`——即便加固提示词覆盖面仍不足，仅作兜底；claude系模型配额易耗尽
4. opencode CLI：本机因系统代理MITM证书错误不可用（"unknown certificate verification error"）
- 队列化：把公司按≤10家切批写 state/queue_*.txt，用循环脚本保持N条并发车道（A股2条+新三板2-3条），每完成一家校验文件存在与大小，断点记录 state/progress_{YEAR}.json

## 步骤4：汇总交付

1. 聚合 state/report_data_{YEAR}.json：逐文件提取概况段/详述节标题/轮次/类别列，类别归一化（"重大合同"→"重大合同与业务合规"、"独立性"→"上市主体独立性"、"关联交易"→"关联方与关联交易"、"对赌"→"对赌与特殊权利条款"等）
2. 报告 summaries/{YEAR}上市挂牌审核问询法律问题回溯报告-{YYYYMMDD}-V1.md：总体概览（各板块家数/详述问题总数/户均）/共性统计TOP15表/监管趋势（律师执业视角，基于明细归纳，须写实不得套模板）/使用说明与边界/分公司索引（六板块章，每家一行：链接+详述数+重点问题前三）
3. 同步：`rsync -a summaries/ "$HOME/Library/CloudStorage/GoogleDrive-{GOOGLE_ACCOUNT}/我的云端硬盘/上市审核问询法律回溯/报告/"`，明细同理 rsync 到「分公司明细{YEAR}/」（macOS自带rsync不支持--info）
4. 完成后更新断点文件并列待核验汇总；向李成律师汇报：各板块家数/详述问题总数/共性TOP5/失败与待核验清单

## 纪律
- 不得编造：法律依据、案号、文号、主体信息一律以抓取原文为准；无法确认标【待核验】
- 见微MCP等付费检索无额度不调用；全部走官网公开接口
- 客户信息保密，不跨项目复用
- 遇系统性故障（额度耗尽/接口封禁）如实汇报已完成部分并写断点文件，不假装完成
