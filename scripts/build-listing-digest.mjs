// 将 listing-inquiry-digest 的年度报告与分公司审核问询法律问题明细转换为站点栏目页面
// 产物：site/digest/listing-inquiry/{reports,companies/{year}}/...
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = '/Users/licheng/Documents/zhipu/.zcode/workspace/default/listing-inquiry-digest';
const DEST = join(process.cwd(), 'site', 'digest', 'listing-inquiry');

// 清洗 slug：去除文件系统/URL 非法字符（*ST 康乐 → ST康乐）
const cleanSlug = (s) => s.replace(/[*?:"<>|/\\\s]+/g, '');

const YEARS = [
  { year: '2026', dir: 'companies', label: '2026 年度' },
  { year: '2025', dir: 'companies_2025', label: '2025 年度' },
  { year: '2024', dir: 'companies_2024', label: '2024 年度' },
  { year: '2023', dir: 'companies_2023', label: '2023 年度' },
];

// 年度板块中文名
const BOARD_NAMES = { '科创板': '科创板', '沪市主板': '沪市主板', '深市主板': '深市主板', '深市创业板': '创业板', '北交所': '北京证券交易所', '新三板挂牌': '新三板挂牌' };

// ---------- 1. 年度报告 ----------
mkdirSync(join(DEST, 'reports'), { recursive: true });
const reportRe = /^(\d{4})上市挂牌审核问询法律问题回溯报告-(\d{8})-(V\d+)\.md$/;
const reports = [];
for (const f of readdirSync(join(BASE, 'summaries')).filter(x => x.endsWith('.md'))) {
  const m = f.match(reportRe);
  if (!m) { console.log('SKIP report', f); continue; }
  const [, year, ymd, ver] = m;
  let md = readFileSync(join(BASE, 'summaries', f), 'utf8').replace(/\r\n/g, '\n');
  const h1Match = md.match(/^# (.+)$/m);
  const title = (h1Match ? h1Match[1] : `上市挂牌审核问询法律问题回溯报告（${year} ${ver}）`).trim();
  const quoteMatch = md.match(/^> 数据截至：([^\s｜|]+)/);
  const cutoff = quoteMatch ? quoteMatch[1] : `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  let summary = `数据截至 ${cutoff}`;
  const totalM = md.match(/共\s*(\d+)\s*家/);
  if (totalM) summary += `，覆盖 ${totalM[1]} 家公司`;
  const qM = md.match(/([\d,]+)个需律师发表意见/);
  if (qM) summary += `、${qM[1]} 个法律问题`;

  // 去首行 h1
  md = md.replace(/^# .+\n/, '');
  // 分公司索引整段截断（明细已单独成页），替换为站内指引
  const idxPos = md.indexOf('# 分公司索引');
  if (idxPos > -1) {
    md = md.slice(0, idxPos) +
      `## 分公司明细\n\n本报告所涉全部公司的审核问询法律问题回溯明细已单独成页，按年度查阅：\n\n` +
      YEARS.map(y => `- [${y.label}分公司明细（${y.year} 年上市/挂牌）](/digest/listing-inquiry/companies/${y.year}/)`).join('\n') +
      '\n';
  }
  // 公开站适用说明
  md = md.replace(/本报告及明细仅供内部研究与执业参考，不构成法律意见。/,
    '本报告及明细由 AI 辅助系统基于交易所与全国股转系统公开披露文件整理生成，供执业研究参考，不构成法律意见。');

  const slug = `${year}-回溯报告-${ymd}-${ver}`;
  const out = ['---',
    `title: "${title.replace(/"/g, '&quot;')}"`,
    `date: ${cutoff}`,
    `description: "${summary.replace(/"/g, '&quot;')}"`,
    '---', '',
    '<BackButton fallback="/digest/listing-inquiry/" />', '',
    `# ${title}`, '', md.trim(), ''].join('\n');
  writeFileSync(join(DEST, 'reports', `${slug}.md`), out, 'utf8');
  reports.push({ slug, year, ver, ymd, title, summary, cutoff });
}
reports.sort((a, b) => (b.ymd + b.ver).localeCompare(a.ymd + a.ver));

// ---------- 2. 分公司明细 ----------
const yearStats = [];
for (const { year, dir, label } of YEARS) {
  const srcDir = join(BASE, dir);
  let files;
  try { files = readdirSync(srcDir).filter(x => x.endsWith('.md')); } catch { console.log('MISSING dir', dir); continue; }
  const destDir = join(DEST, 'companies', year);
  mkdirSync(destDir, { recursive: true });
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });
  const entries = [];
  for (const f of files) {
    let md = readFileSync(join(srcDir, f), 'utf8').replace(/\r\n/g, '\n');
    const h1Match = md.match(/^# (.+)$/m);
    const title = (h1Match ? h1Match[1] : `${f.replace(/\.md$/, '')}审核问询法律问题回溯`).trim();
    // 提取代码与板块
    const codeM = title.match(/（([A-Za-z0-9.{})]+)·([^（）]+)）/);
    const code = codeM ? codeM[1] : '';
    const board = codeM ? (BOARD_NAMES[codeM[2].trim()] || codeM[2].trim()) : '';
    const dateM = md.match(/(?:上市\/挂牌日期|上市日期|挂牌日期)[：:]\s*([\d-]{8,10})/);
    const ldate = dateM ? dateM[1] : '';
    // 详述问题数（### 行数）
    const nq = (md.match(/^### /gm) || []).length;
    const summary = `${board || '审核问询'}${ldate ? ` · ${ldate} 上市/挂牌` : ''} · 详述法律问题 ${nq} 项`;
    md = md.replace(/^# .+\n/, '');
    md = md.replace(/本文由自动化系统基于[^*]*公开披露文件整理生成，仅供律师内部参考。/g,
      '*本文由 AI 辅助系统基于交易所与全国股转系统公开披露文件整理生成，供执业研究参考。*');
    const slug = cleanSlug(f.replace(/\.md$/, ''));
    const out = ['---',
      `title: "${title.replace(/"/g, '&quot;')}"`,
      `date: ${ldate || ymdFallback(year)}`,
      `description: "${summary.replace(/"/g, '&quot;')}"`,
      '---', '',
      `<BackButton fallback="/digest/listing-inquiry/companies/${year}/" />`, '',
      `# ${title}`, '', md.trim(), ''].join('\n');
    writeFileSync(join(destDir, `${slug}.md`), out, 'utf8');
    entries.push({ slug, title, code, board, ldate, summary, nq });
  }
  // 年度索引页：按板块分组
  const byBoard = new Map();
  const boardOrder = ['科创板', '沪市主板', '深市主板', '创业板', '北京证券交易所', '新三板挂牌'];
  for (const e of entries) {
    const b = e.board || '其他';
    if (!byBoard.has(b)) byBoard.set(b, []);
    byBoard.get(b).push(e);
  }
  let cards = '';
  const boards = [...byBoard.keys()].sort((a, b) => {
    const ia = boardOrder.indexOf(a), ib = boardOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  for (const b of boards) {
    const list = byBoard.get(b).sort((x, y) => (x.ldate || '9999').localeCompare(y.ldate || '9999'));
    cards += `\n## ${b}（${list.length} 家）\n\n<div class="index-card-list">\n`;
    for (const e of list) {
      cards += `  <a class="index-card" href="/digest/listing-inquiry/companies/${year}/${encodeURIComponent(e.slug)}">\n`;
      cards += `    <span class="index-card-title">${e.title}</span>\n`;
      cards += `    <span class="index-card-desc">${e.summary.replace(/"/g, '&quot;')}</span>\n  </a>\n`;
    }
    cards += '</div>\n';
  }
  const index = ['<BackButton fallback="/digest/listing-inquiry/" />', '',
    `# ${label}分公司审核问询法律问题回溯明细`, '',
    `<p class="section-lead">${year} 年内完成 A 股上市及新三板挂牌的公司，逐家回溯其审核期间全部问询与回复，提炼需律师发表意见的法律问题：问询要点、回复与核查要点、中介核查程序与执业提示。覆盖上市/挂牌日 ${year}-01-01 起。</p>`, '',
    `<p class="source-link">共 ${entries.length} 家 ｜ 数据来源：上交所、深交所、北交所、全国股转系统公开披露的问询回复与法律意见书</p>`,
    cards].join('\n');
  writeFileSync(join(destDir, 'index.md'), index, 'utf8');
  yearStats.push({ year, label, count: entries.length, boards: boards.map(b => `${b} ${byBoard.get(b).length}`).join(' / ') });
}
function ymdFallback(year) { return `${year}-01-01`; }

// ---------- 3. 栏目首页 ----------
const reportCards = reports.map(r =>
  `  <a class="index-card" href="/digest/listing-inquiry/reports/${encodeURIComponent(r.slug)}">\n` +
  `    <span class="index-card-title">${r.title}</span>\n` +
  `    <span class="index-card-desc">${r.summary.replace(/"/g, '&quot;')}</span>\n  </a>`).join('\n');
const yearCards = yearStats.map(y =>
  `  <a class="index-card" href="/digest/listing-inquiry/companies/${y.year}/">\n` +
  `    <span class="index-card-title">${y.label}分公司明细（${y.count} 家）</span>\n` +
  `    <span class="index-card-desc">${y.boards}</span>\n  </a>`).join('\n');
const home = ['<BackButton fallback="/digest/" />', '',
  '# 上市挂牌审核问询法律问题回溯', '',
  '<p class="section-lead">逐年度覆盖当年完成 A 股上市（沪深主板、科创板、创业板、北交所）与新三板挂牌的全部公司，回溯其审核期间全部问询与回复，提炼需律师发表意见的法律问题：实控人认定与一致行动、历史沿革与出资瑕疵、股权代持还原、对赌与特殊投资条款、关联交易与同业竞争、土地房产权属、诉讼处罚合规等，逐问呈现问询要点、回复论证、中介核查程序与结论性意见，并附执业提示。</p>', '',
  '<p class="source-link">数据来源：上交所、深交所、北交所、全国股转系统公开披露文件 ｜ 2023—2026 四个年度 ｜ 由 AI 辅助系统整理，供执业研究参考，不构成法律意见</p>', '',
  '## 年度总报告', '',
  '<div class="index-card-list">', reportCards, '</div>', '',
  '## 分公司明细（按年度）', '',
  '<div class="index-card-list">', yearCards, '</div>'].join('\n');
mkdirSync(DEST, { recursive: true });
writeFileSync(join(DEST, 'index.md'), home, 'utf8');

// ---------- 4. digest 一级首页更新 ----------
const digestHome = ['<BackButton fallback="/" />', '',
  '# 日报文章', '',
  '<p class="section-lead">由 AI 辅助系统自动生成的法律实务专栏。已上线三个栏目：IPO 法律问询摘要（每日）、并购重组法律问询摘要（每日）、上市挂牌审核问询法律问题回溯（年度全景，2023—2026）。</p>', '',
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
  '</div>'].join('\n');
writeFileSync(join(process.cwd(), 'site', 'digest', 'index.md'), digestHome, 'utf8');

console.log(`DONE reports=${reports.length} ` + yearStats.map(y => `${y.year}=${y.count}`).join(' '));
