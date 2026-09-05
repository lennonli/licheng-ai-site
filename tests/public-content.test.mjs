import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizePublicText } from '../scripts/public-content.mjs'

test('public copies redact real credentials but keep environment placeholders usable', () => {
  const secret = 'a'.repeat(64)
  assert.equal(sanitizePublicText(`Authorization: Bearer ${secret}`), 'Authorization: Bearer YOUR_MCP_ACCESS_TOKEN')
  assert.equal(sanitizePublicText('Bearer ${MCP_TOKEN}'), 'Bearer ${MCP_TOKEN}')
  assert.equal(sanitizePublicText('YOUR_MCP_ACCESS_TOKEN'), 'YOUR_MCP_ACCESS_TOKEN')
})

test('project examples are anonymous while names in public filings remain evidence', () => {
  const input = '鑫冠科技 /Users/example-user/Documents/project'
  assert.equal(sanitizePublicText(input), '示例公司 /Users/your-name/Documents/project')
  assert.equal(sanitizePublicText(input, { publicCase: true }), '鑫冠科技 /Users/your-name/Documents/project')
  assert.equal(sanitizePublicText('精诚达', { publicCase: true }), '精诚达')
})

test('sanitisation is idempotent', () => {
  const input = `Bearer ${'b'.repeat(64)} /Users/example-user/a 潜行创新`
  assert.equal(sanitizePublicText(sanitizePublicText(input)), sanitizePublicText(input))
})
