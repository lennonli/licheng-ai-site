// 将 ipo-legal-digest / ma-legal-digest 的 summaries/*.md 转换为站点日报栏目页面
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildIpoCompilation } from './build-ipo-compilation.mjs';

const WORKSPACE = '/Users/licheng/Documents/zhipu/.zcode/workspace/default';
const SOURCES = [
  {
    id: 'ipo-inquiry',
    src: join(WORKSPACE, 'ipo-legal-digest', 'summaries'),
    prefix: 'IPO问询法律日报',
    columnTitle: 'IPO 法律问询摘要 · 每日日报',
    lead: '每日自动追踪上交所科创板、深交所创业板、北交所、新三板四个板块新披露的审核问询回复，提炼其中法律相关问题（股权代持、出资瑕疵、实控人认定、对赌清理、诉讼合规等）的问询要点、回复与核查要点、中介机构核查程序，按日成篇。覆盖 2026 年 8 月 21 日至今。',
    sourceNote: '上交所、深交所、北交所、全国股转系统公开披露文件',
    fallbackSummary: 'IPO/挂牌审核问询回复法律部分每日摘要',
    homeCard: {
      title: 'IPO 法律问询摘要',
      desc: '每日追踪科创板、创业板、北交所、新三板新披露的审核问询回复，提炼股权代持、出资瑕疵、实控人认定、对赌清理、诉讼合规等法律问题的问询与核查要点。日更。'
    }
  },
  {
    id: 'ma-inquiry',
    src: join(WORKSPACE, 'ma-legal-digest', 'summaries'),
    prefix: '并购重组问询法律日报',
    columnTitle: '并购重组法律问询摘要 · 每日日报',
    lead: '每日自动追踪上交所并购重组（沪主板+科创板）、深交所重大资产重组、北交所重大资产重组、全国股转系统挂牌公司重大资产重组四个渠道新披露的问询/反馈回复与律师补充法律意见，提炼法律相关问题（交易方案合规、锁定期、业绩承诺与补偿、关联交易与同业竞争、债权债务处理、标的资产权属、经营者集中等）的问询要点、回复与律师核查要点、中介核查程序，按日成篇。覆盖 2026 年 8 月 21 日至今。',
    sourceNote: '上交所、深交所、北交所、全国股转系统并购重组公开披露文件',
    fallbackSummary: '并购重组审核问询回复法律部分每日摘要',
    homeCard: {
      title: '并购重组法律问询摘要',
      desc: '每日追踪四渠道新披露的并购重组问询/反馈回复与律师补充法律意见，提炼交易方案合规、锁定期、业绩承诺与补偿、同业竞争、债权债务处理、标的资产权属、经营者集中等法律问题的问询与核查要点。日更。'
    }
  }
];

function buildColumn(cfg) {
  const DEST = join(process.cwd(), 'site', 'digest', cfg.id);
  mkdirSync(DEST, { recursive: true });

  const files = readdirSync(cfg.src).filter(f => f.endsWith('.md')).sort();
  const entries = [];
  for (const f of files) {
    // 日报-2026-08-21-V1试运行.md → { date: 2026-08-21, suffix: V1试运行 }
    const m = f.match(/^日报-(\d{4}-\d{2}-\d{2})(?:-(.+))?\.md$/);
    if (!m) { console.log('SKIP', f); continue; }
    const [, date, suffix = ''] = m;
    let md = readFileSync(join(cfg.src, f), 'utf8').replace(/\r\n/g, '\n');

    // 提取首行 h1 作为标题
    const h1Match = md.match(/^# (.+)$/m);
    const title = (h1Match ? h1Match[1] : `${cfg.prefix}（${date}）`).trim();

    // 提取引用块首段作为摘要；无引用块时取"今日/本期"开头的段落（忽略粗体标记）
    const quoteMatch = md.match(/^> (.+)$/m);
    let summary = quoteMatch ? quoteMatch[1].replace(/\*\*/g, '').trim() : '';
    if (!summary) {
      const p = md.split('\n').find(l => l.replace(/\*/g, '').trimStart().startsWith('今日')
        || l.replace(/\*/g, '').trimStart().startsWith('本期'));
      summary = p ? p.replace(/\*\*/g, '').trim().slice(0, 90) : cfg.fallbackSummary;
    }
    summary = summary.slice(0, 120);

    // 去掉首行 h1（改由正文 h1 提供，verify 要求恰好一个 H1）
    md = md.replace(/^# .+\n/, '');

    // 尾部内部参考声明 → 公开站适用说明
    md = md.replace(/\*?本文由自动化系统基于交易所公开披露文件整理生成，仅供律师内部参考。\*?/g,
      '*本文由 AI 辅助系统基于交易所公开披露文件自动整理生成，供执业研究参考。*');
    md = md.replace(/\*?本日报由每日 11:00 自动任务生成，仅供律师内部参考。\*?/g,
      '*本文由 AI 辅助系统基于交易所公开披露文件自动整理生成，供执业研究参考。*');

    const slugSuffix = suffix ? `-${suffix}` : '';
    const slug = `${date}${slugSuffix}`;
    const pageTitle = suffix.includes('试运行') || suffix.includes('加深')
      ? title : `${cfg.prefix}（${date}）`;

    const out = [
      '---',
      `title: "${pageTitle.replace(/"/g, '&quot;')}"`,
      `date: ${date}`,
      `description: "${summary.replace(/"/g, '&quot;')}"`,
      '---',
      '',
      `<BackButton fallback="/digest/${cfg.id}/" />`,
      '',
      `# ${title}`,
      '',
      md.trim(),
      '',
    ].join('\n');

    writeFileSync(join(DEST, `${slug}.md`), out, 'utf8');
    entries.push({ slug, date, title: pageTitle, summary, file: f });
  }

  // 按日期倒序
  entries.sort((a, b) => (b.date + b.file).localeCompare(a.date + a.file));

  // 二级栏目索引页：按月分组
  const byMonth = new Map();
  for (const e of entries) {
    const month = e.date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(e);
  }
  let cards = '';
  for (const [month, list] of [...byMonth.entries()].sort((a, b) => String(b).localeCompare(String(a)))) {
    const [y, mo] = month.split('-');
    cards += `\n## ${y} 年 ${Number(mo)} 月（${list.length} 篇）\n\n<div class="index-card-list">\n`;
    for (const e of list) {
      cards += `  <a class="index-card" href="/digest/${cfg.id}/${encodeURIComponent(e.slug)}">\n`;
      cards += `    <span class="index-card-title">${e.title}</span>\n`;
      cards += `    <span class="index-card-desc">${e.summary.replace(/"/g, '&quot;')}</span>\n  </a>\n`;
    }
    cards += '</div>\n';
  }

  const monthIndex = [
    '<BackButton fallback="/digest/" />',
    '',
    `# ${cfg.columnTitle}`,
    '',
    `<p class="section-lead">${cfg.lead}</p>`,
    '',
    `<p class="source-link">共 ${entries.length} 篇 ｜ 数据来源：${cfg.sourceNote}</p>`,
    cards,
  ].join('\n');
  writeFileSync(join(DEST, 'index.md'), monthIndex, 'utf8');
  console.log(`DONE ${cfg.id}: ${entries.length} pages`);
  return { cfg, entries };
}

mkdirSync(join(process.cwd(), 'site', 'digest'), { recursive: true });
const results = SOURCES.map(buildColumn);

// 一级栏目首页（与 build-listing-digest.mjs 保持一致的三卡结构，两脚本互不覆盖）
const digestHome = [
  '<BackButton fallback="/" />',
  '',
  '# 日报文章',
  '',
  '<p class="section-lead">由 AI 辅助系统自动生成的法律实务专栏。已上线三个栏目：IPO 法律问询摘要（每日）、并购重组法律问询摘要（每日）、上市挂牌审核问询法律问题回溯（年度全景，2023—2026）。</p>',
  '',
  '<div class="index-card-list">',
  '  <a class="index-card" href="/digest/ipo-inquiry/">',
  '    <span class="index-card-title">IPO 法律问询摘要</span>',
  '    <span class="index-card-desc">每日追踪科创板、创业板、北交所、新三板新披露的审核问询回复，提炼股权代持、出资瑕疵、实控人认定、对赌清理、诉讼合规等法律问题的问询与核查要点。日更。</span>',
  '  </a>',
  '  <a class="index-card" href="/digest/ma-inquiry/">',
  '    <span class="index-card-title">并购重组法律问询摘要</span>',
  '    <span class="index-card-desc">每日追踪四渠道新披露的并购重组问询/反馈回复与律师补充法律意见，提炼交易方案合规、锁定期、业绩承诺与补偿、同业竞争、债权债务处理、标的资产权属、经营者集中等法律问题的问询与核查要点。日更。</span>',
  '  </a>',
  '  <a class="index-card" href="/digest/listing-inquiry/">',
  '    <span class="index-card-title">上市挂牌审核问询法律问题回溯</span>',
  '    <span class="index-card-desc">逐年度覆盖 2023—2026 年完成 A 股上市与新三板挂牌的全部公司（逾千家），逐家回溯审核问询中的法律问题：实控人认定、出资瑕疵、股权代持、对赌清理、关联交易、同业竞争、土地房产、诉讼处罚等，含年度共性统计与监管趋势。</span>',
  '  </a>',
  '</div>',
].join('\n');
writeFileSync(join(process.cwd(), 'site', 'digest', 'index.md'), digestHome, 'utf8');

buildIpoCompilation();
console.log(`TOTAL ${results.reduce((n, r) => n + r.entries.length, 0)} pages`);

