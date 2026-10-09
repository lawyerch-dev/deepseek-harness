#!/usr/bin/env node
/**
 * Ensure the two package-scaffold registrations for custom-my-workflow exist
 * in their owning files. Re-runs safely: already-present rows are left
 * untouched; missing rows are inserted in place so an upstream rebase that
 * prunes our rows is healed by calling this again.
 *
 * Owned files:
 * - <repo>/tsconfig.client.json  (JSONC: comments preserved via line editing)
 *   add row  { "path": "./packages/client/custom-my-workflow" }
 * - <repo>/packages/bundle/web-app/package.json  (plain JSON)
 *   add key  "@deepseek-ai/dsh-client-custom-my-workflow"
 * - <repo>/packages/bundle/web-app/cordis.patch.yml  (YAML)
 *   add rows  id: custom-my-workflow + name (browser roster tail)
 * - <repo>/tsconfig.base.json  (JSONC)
 *   add 2 path mappings for @deepseek-ai/dsh-client-custom-my-workflow
 *
 * tsconfig is edited line-wise so its leading comments survive; the new row
 * is placed to keep the existing path sort order, so the diff stays minimal.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
// packages/client/custom-my-workflow/scripts -> repo root
const repo = resolve(scriptDir, '../../../../')

const TS = 'tsconfig.client.json'
const TS_ROW = './packages/client/custom-my-workflow'
const TS_LINE = '    { "path": "./packages/client/custom-my-workflow" },'

const DEP = 'packages/bundle/web-app/package.json'
const DEP_KEY = '@deepseek-ai/dsh-client-custom-my-workflow'
const DEP_LINE = '    "@deepseek-ai/dsh-client-custom-my-workflow": "workspace:*",'

let changed = false

// --- tsconfig.client.json: line-wise insert into the references array ---
{
  const filePath = resolve(repo, TS)
  if (!existsSync(filePath)) {
    console.error(`skip (missing): ${filePath}`)
  } else {
    const lines = readFileSync(filePath, 'utf8').split('\n')
    if (lines.some(l => l.includes(`"${TS_ROW}"`))) {
      console.log(`ok (already present): ${TS}`)
    } else {
      const refRows = lines
        .map((l, i) => ({ i, path: l.match(/"\.\/packages\/client\/[^"]+"/)?.[0] }))
        .filter(r => r.path)
      const insertAt = refRows.findIndex(r => r.path.slice(1, -1) > TS_ROW)
      const at = insertAt === -1 ? (refRows.at(-1)?.i ?? -1) + 1 : refRows[insertAt].i
      lines.splice(at, 0, TS_LINE)
      writeFileSync(filePath, lines.join('\n'))
      console.log(`+ ${TS}`)
      changed = true
    }
  }
}

// --- web-app/package.json: insertion skips plain-JSON, add key when missing ---
{
  const filePath = resolve(repo, DEP)
  if (!existsSync(filePath)) {
    console.error(`skip (missing): ${filePath}`)
  } else {
    const text = readFileSync(filePath, 'utf8')
    if (text.includes(`"${DEP_KEY}"`)) {
      console.log(`ok (already present): ${DEP}`)
    } else {
      const lines = text.split('\n')
      const depRows = lines
        .map((l, i) => ({ i, key: l.match(/^\s*"@deepseek-ai\/[^"]+"/)?.[0] }))
        .filter(r => r.key)
      const insertAt = depRows.findIndex(r => r.key.slice(1, -1) > DEP_KEY)
      const at = insertAt === -1 ? (depRows.at(-1)?.i ?? -1) + 1 : depRows[insertAt].i
      lines.splice(at, 0, DEP_LINE)
      writeFileSync(filePath, lines.join('\n'))
      console.log(`+ ${DEP}`)
      changed = true
    }
  }
}

// --- cordis.patch.yml: insert the browser roster entry when missing ---
{
  const PATCH = 'packages/bundle/web-app/cordis.patch.yml'
  const PATCH_ID = 'custom-my-workflow'
  const PATCH_BLOCK = [
    '    # Custom browser plugin: sidebar entry + welcome page (click counter).',
    `    - id: ${PATCH_ID}`,
    "      name: '@deepseek-ai/dsh-client-custom-my-workflow'",
    '',
  ].join('\n')
  const filePath = resolve(repo, PATCH)
  if (!existsSync(filePath)) {
    console.error(`skip (missing): ${filePath}`)
  } else {
    const text = readFileSync(filePath, 'utf8')
    if (text.includes(`id: ${PATCH_ID}\n`)) {
      console.log(`ok (already present): ${PATCH}`)
    } else {
      // Insert right before the agent-plane marker comment line.
      const marker = '# ── the agent plane moves behind agent presets'
      const at = text.indexOf(marker)
      if (at === -1) {
        console.error(`skip (marker not found): ${PATCH}`)
      } else {
        const before = text.slice(0, at)
        const after = text.slice(at)
        // Ensure exactly one blank line separation on each side.
        const newContent = before.replace(/\n+$/, '\n\n') + PATCH_BLOCK + '\n' + after
        writeFileSync(filePath, newContent)
        console.log(`+ ${PATCH}`)
        changed = true
      }
    }
  }
}

// --- tsconfig.base.json: insert two path mappings when missing ---
{
  const BASE = 'tsconfig.base.json'
  const BASE_KEY = '@deepseek-ai/dsh-client-custom-my-workflow'
  const BASE_LINES = [
    `      "${BASE_KEY}": ["./packages/client/custom-my-workflow/src"],`,
    `      "${BASE_KEY}/client": ["./packages/client/custom-my-workflow/src/client/index.ts"],`,
  ]
  const filePath = resolve(repo, BASE)
  if (!existsSync(filePath)) {
    console.error(`skip (missing): ${filePath}`)
  } else {
    const text = readFileSync(filePath, 'utf8')
    if (text.includes(`"${BASE_KEY}"`)) {
      console.log(`ok (already present): ${BASE}`)
    } else {
      const lines = text.split('\n')
      // Find existing @deepseek-ai/dsh-client-* rows to keep sort order.
      const clientRows = lines
        .map((l, i) => ({ i, key: l.match(/^\s*"(@deepseek-ai\/dsh-client-[^"]+)"/)?.[1] }))
        .filter(r => r.key)
      const insertAt = clientRows.findIndex(r => r.key > BASE_KEY)
      const at = insertAt === -1
        ? (clientRows.at(-1)?.i ?? -1) + 1
        : clientRows[insertAt].i
      lines.splice(at, 0, ...BASE_LINES)
      writeFileSync(filePath, lines.join('\n'))
      console.log(`+ ${BASE}`)
      changed = true
    }
  }
}

console.log(changed ? 'registration ensured' : 'registrations already up to date')