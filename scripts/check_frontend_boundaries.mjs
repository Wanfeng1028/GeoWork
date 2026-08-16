#!/usr/bin/env node
/**
 * 前端架构边界静态检查（doc/21 §P6）
 *
 * 三条守护规则，违反即退出码 1（CI 红）：
 *  1. src/shared/session/ 除 react.ts 外零 React import（对象层 React-free）
 *  2. src/ 下除 shared/api/、shared/session/ 外零 fetch( / new EventSource（网络出口收口）
 *  3. src/ 下除 shared/storage/ 外零 localStorage.（持久化收口）
 *
 * 用法：node scripts/check_frontend_boundaries.mjs [前端根目录，默认 apps/desktop]
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const root = process.argv[2] ?? join('apps', 'desktop')
const SRC = join(root, 'src')

const violations = []

/** 统一路径分隔符为 '/'，便于前缀匹配 */
const rel = (p) => relative(root, p).split(sep).join('/')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

const files = walk(SRC)

for (const file of files) {
  const path = rel(file)
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')

  lines.forEach((line, i) => {
    const loc = `${path}:${i + 1}: ${line.trim().slice(0, 100)}`

    /* 规则 1：session 目录 React-free（react.ts 除外） */
    if (
      path.startsWith('src/shared/session/') &&
      !path.endsWith('react.ts') &&
      /from ['"]react['"]/.test(line)
    ) {
      violations.push(`[react-free] ${loc}`)
    }

    /* 规则 2：网络出口仅 shared/api/ 与 shared/session/ */
    if (
      !path.startsWith('src/shared/api/') &&
      !path.startsWith('src/shared/session/') &&
      (/\bfetch\(/.test(line) || /new\s+EventSource\(/.test(line))
    ) {
      violations.push(`[net-egress] ${loc}`)
    }

    /* 规则 3：localStorage 仅 shared/storage/ */
    if (!path.startsWith('src/shared/storage/') && /localStorage\./.test(line)) {
      violations.push(`[storage] ${loc}`)
    }
  })
}

if (violations.length > 0) {
  console.error(`✖ 前端边界检查失败（${violations.length} 处违规）：\n`)
  for (const v of violations) console.error(`  ${v}`)
  console.error(
    '\n规则见 doc/21-Frontend-Refactor-Plan.md §P6：' +
      'session 对象层 React-free；fetch/EventSource 仅 shared/api|session；localStorage 仅 shared/storage。',
  )
  process.exit(1)
}

console.log(`✔ 前端边界检查通过（${files.length} 个源文件）`)
