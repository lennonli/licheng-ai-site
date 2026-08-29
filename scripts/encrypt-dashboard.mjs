// 看板数据加密脚本：AES-256-GCM + PBKDF2(SHA-256, 250000)
// 输出格式与浏览器 WebCrypto 解密参数一致，见 site/public/dashboard/index.html
// 用法：node scripts/encrypt-dashboard.mjs <输入JSON> <输出文件> [密码]（缺省读 DASHBOARD_PASSWORD，再缺省读 ~/.dashboard-passwd）
import { webcrypto as crypto } from 'node:crypto'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

const ITERATIONS = 250_000

function b64(buf) {
  return Buffer.from(buf).toString('base64')
}

function loadPassword(explicit) {
  if (explicit) return explicit
  if (process.env.DASHBOARD_PASSWORD) return process.env.DASHBOARD_PASSWORD
  return readFileSync(resolve(homedir(), '.dashboard-passwd'), 'utf8').trim()
}

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
}

async function main() {
  const [input, output, explicitPassword] = process.argv.slice(2)
  if (!input || !output) {
    console.error('用法: node scripts/encrypt-dashboard.mjs <输入JSON> <输出文件> [密码]')
    process.exit(1)
  }
  const password = loadPassword(explicitPassword)
  if (password.length < 12) {
    console.error('密码长度不足 12 位，拒绝加密')
    process.exit(1)
  }
  const plaintext = new TextEncoder().encode(readFileSync(input, 'utf8'))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const envelope = {
    v: 1,
    k: `PBKDF2-SHA256-${ITERATIONS}`,
    salt: b64(salt),
    iv: b64(iv),
    data: b64(cipher)
  }
  writeFileSync(output, JSON.stringify(envelope))
  const size = statSync(output).size
  console.log(`OK 已加密 -> ${output} (${size} bytes, iterations=${ITERATIONS})`)
}

main().catch((err) => {
  console.error('加密失败:', err.message)
  process.exit(1)
})
