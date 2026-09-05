import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Apply to every public representation, including copy downloads and search data.
// Public filing case names are evidence and must not be anonymised wholesale.
export function sanitizePublicText(text, { publicCase = false } = {}) {
  let clean = text
    .replace(/\bBearer\s+[A-Za-z0-9_.-]{24,}/g, 'Bearer YOUR_MCP_ACCESS_TOKEN')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g, 'YOUR_API_KEY')
    .replace(/\/Users\/[A-Za-z0-9_-]+\//g, '/Users/your-name/')
    .replace(/~\/Documents\/Macbook-pro项目\/19-IPO问询案例知识库/g, '~/ipo-inquiry-kb')
  if (!publicCase) {
    clean = clean
      .replace(/深圳潜行创新科技有限公司/g, '示例科技有限公司')
      .replace(/潜行创新|鑫冠科技|朗驰欣创|睿源云启|铁腕/g, '示例公司')
      .replace(/87649562|86982451/g, '00000000')
  }
  return clean
}

export function sanitizePublicTree(root) {
  let changed = 0
  function visit(dir) {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) continue
      const file = path.join(dir, name)
      if (statSync(file).isDirectory()) { visit(file); continue }
      if (!/\.(md|html|txt|json|js)$/i.test(name)) continue
      const relative = path.relative(root, file).replaceAll(path.sep, '/')
      const original = readFileSync(file, 'utf8')
      if (/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(original)) {
        throw new Error(`Private key material in public output: ${relative}`)
      }
      const clean = sanitizePublicText(original, { publicCase: /^(?:public\/copy\/)?kb(?:202[345])?\//.test(relative) })
      if (clean !== original) { writeFileSync(file, clean); changed++ }
    }
  }
  visit(root)
  return changed
}
