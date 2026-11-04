// 将 ipo-legal-digest/summaries/*.md 转换为站点日报栏目页面
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = '/Users/licheng/Documents/zhipu/.zcode/workspace/default/ipo-legal-digest/summaries';
const DEST = join(process.cwd(), 'site', 'digest', 'ipo-inquiry');

mkdirSync(DEST, { recursive: true });

const files = readdirSync(SRC).filter(f => f.endsWith('.md')).sort();
const entries = [];
for (const f of files) {
  // 日报-2026-08-21-V1试运行.md → { date: 2026-08-21, suffix: V1试运行 }
  const m = f.match(/^日报-(\d{4}-\d{2}-\d{2})(?:-(.+))?\.md$/);
  if (!m) { console.log('SKIP', f); continue; }
  const [, date, suffix = ''] = m;
  let md = readFileSync(join(SRC, f), 'utf8').replace(/\r\n/g, '\n');

  // 提取首行 h1 作为标题
  const h1Match = md.match(/^# (.+)$/m);
  const title = (h1Match ? h1Match[1] : `IPO问询法律日报（${date}）`).trim();

  // 提取引用块首段作为摘要
  const quoteMatch = md.match(/^> (.+)$/m);
  let summary = quoteMatch ? quoteMatch[1].replace(/\*\*/g, '').trim() : '';
  if (!summary) {
    const p = md.split('\n').find(l => l.startsWith('今日') || l.startsWith('本期'));
    summary = p ? p.replace(/\*\*/g, '').slice(0, 90) : 'IPO/挂牌审核问询回复法律部分每日摘要';
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
    ? title : `IPO问询法律日报（${date}）`;

  const out = [
    '---',
    `title: "${pageTitle.replace(/"/g, '&quot;')}"`,
    `date: ${date}`,
    `description: "${summary.replace(/"/g, '&quot;')}"`,
    '---',
    '',
    '<BackButton fallback="/digest/ipo-inquiry/" />',
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
const monthNames = { '2026-08': '2026 年 8 月', '2026-09': '2026 年 9 月', '2026-10': '2026 年 10 月', '2026-11': '2026 年 11 月' };
for (const [month, list] of [...byMonth.entries()].sort((a, b) => String(b).localeCompare(String(a)))) {
  cards += `\n## ${monthNames[month] || month}（${list.length} 篇）\n\n<div class="index-card-list">\n`;
  for (const e of list) {
    cards += `  <a class="index-card" href="/digest/ipo-inquiry/${encodeURIComponent(e.slug)}">\n`;
    cards += `    <span class="index-card-title">${e.title}</span>\n`;
    cards += `    <span class="index-card-desc">${e.summary.replace(/"/g, '&quot;')}</span>\n  </a>\n`;
  }
  cards += '</div>\n';
}

const monthIndex = [
  '<BackButton fallback="/digest/" />',
  '',
  '# IPO 法律问询摘要 · 每日日报',
  '',
  '<p class="section-lead">每日自动追踪上交所科创板、深交所创业板、北交所、新三板四个板块新披露的审核问询回复，提炼其中法律相关问题（股权代持、出资瑕疵、实控人认定、对赌清理、诉讼合规等）的问询要点、回复与核查要点、中介机构核查程序，按日成篇。覆盖 2026 年 8 月 21 日至今。</p>',
  '',
  `<p class="source-link">共 ${entries.length} 篇 ｜ 数据来源：上交所、深交所、北交所、全国股转系统公开披露文件</p>`,
  cards,
].join('\n');
writeFileSync(join(process.cwd(), 'site', 'digest', 'ipo-inquiry', 'index.md'), monthIndex, 'utf8');

// 一级栏目首页
const digestHome = [
  '<BackButton fallback="/" />',
  '',
  '# 日报文章',
  '',
  '<p class="section-lead">由 AI 辅助系统每日自动生成的法律实务日报专栏。当前已上线 IPO 法律问询摘要（每日追踪四板块审核问询回复中的法律问题），更多主题陆续添加中。</p>',
  '',
  '<div class="index-card-list">',
  '  <a class="index-card" href="/digest/ipo-inquiry/">',
  '    <span class="index-card-title">IPO 法律问询摘要</span>',
  '    <span class="index-card-desc">每日追踪科创板、创业板、北交所、新三板新披露的审核问询回复，提炼股权代持、出资瑕疵、实控人认定、对赌清理、诉讼合规等法律问题的问询与核查要点。日更。</span>',
  '  </a>',
  '</div>',
].join('\n');
mkdirSync(join(process.cwd(), 'site', 'digest'), { recursive: true });
writeFileSync(join(process.cwd(), 'site', 'digest', 'index.md'), digestHome, 'utf8');

console.log(`DONE ${entries.length} pages`);
