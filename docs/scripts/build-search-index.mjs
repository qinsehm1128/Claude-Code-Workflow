import fs from 'node:fs/promises'
import path from 'node:path'
import FlexSearch from 'flexsearch'
import {
  createFlexSearchIndex,
  FLEXSEARCH_INDEX_VERSION
} from '../.vitepress/search/flexsearch.mjs'

const ROOT_DIR = process.cwd()
const PUBLIC_DIR = path.join(ROOT_DIR, 'public')

const EXCLUDED_DIRS = new Set([
  '.github',
  '.vitepress',
  '.workflow',
  'node_modules',
  'public',
  'scripts'
])

function toPosixPath(filePath) {
  return filePath.replaceAll(path.sep, '/')
}

function getLocaleKey(relativePosixPath) {
  return relativePosixPath.startsWith('zh/') ? 'zh' : 'root'
}

function toPageUrl(relativePosixPath) {
  const withoutExt = relativePosixPath.replace(/\.md$/i, '')

  if (withoutExt === 'index') return '/'
  if (withoutExt.endsWith('/index')) return `/${withoutExt.slice(0, -'/index'.length)}/`
  return `/${withoutExt}`
}

function extractTitle(markdown, relativePosixPath) {
  const normalized = markdown.replaceAll('\r\n', '\n')

  const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---\n/)
  if (frontmatterMatch) {
    const fm = frontmatterMatch[1]
    const titleLine = fm
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.toLowerCase().startsWith('title:'))

    if (titleLine) {
      const raw = titleLine.slice('title:'.length).trim()
      return raw.replace(/^['"]|['"]$/g, '') || undefined
    }
  }

  const firstH1 = normalized.match(/^#\s+(.+)\s*$/m)
  if (firstH1?.[1]) return firstH1[1].trim()

  const fallback = path.basename(relativePosixPath, '.md')
  return fallback
    .replaceAll('-', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function stripFrontmatter(markdown) {
  const normalized = markdown.replaceAll('\r\n', '\n')
  return normalized.replace(/^---\n[\s\S]*?\n---\n/, '')
}

function stripMarkdown(markdown) {
  return (
    markdown
      // SFC blocks
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      // Code fences
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/~~~[\s\S]*?~~~/g, ' ')
      // Inline code
      .replace(/`[^`]*`/g, ' ')
      // Images and links
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Headings / blockquotes
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      // Lists
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      // Emphasis
      .replace(/[*_~]+/g, ' ')
      // HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  )
}

async function collectMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue
      files.push(...(await collectMarkdownFiles(path.join(dir, entry.name))))
      continue
    }

    if (!entry.isFile()) continue
    if (!entry.name.toLowerCase().endsWith('.md')) continue
    files.push(path.join(dir, entry.name))
  }

  return files
}

async function buildIndexForLocale(localeKey, relativePosixPaths) {
  const index = createFlexSearchIndex(FlexSearch)
  const docs = []

  let nextId = 1
  for (const rel of relativePosixPaths) {
    const abs = path.join(ROOT_DIR, rel)
    const markdown = await fs.readFile(abs, 'utf-8')

    const title = extractTitle(markdown, rel)
    const content = stripMarkdown(stripFrontmatter(markdown))
    const url = toPageUrl(rel)

    const searchable = `${title}\n${content}`.trim()
    if (!searchable) continue

    const id = nextId++
    index.add(id, searchable)
    docs.push({
      id,
      title,
      url,
      excerpt: content.slice(0, 180)
    })
  }

  const exported = {}
  await index.export((key, data) => {
    exported[key] = data
  })

  return {
    version: FLEXSEARCH_INDEX_VERSION,
    locale: localeKey,
    index: exported,
    docs
  }
}

async function main() {
  await fs.mkdir(PUBLIC_DIR, { recursive: true })

  const allMarkdownAbs = await collectMarkdownFiles(ROOT_DIR)
  const allMarkdownRel = allMarkdownAbs
    .map((abs) => toPosixPath(path.relative(ROOT_DIR, abs)))
    .sort((a, b) => a.localeCompare(b))

  const byLocale = new Map([
    ['root', []],
    ['zh', []]
  ])

  for (const rel of allMarkdownRel) {
    const localeKey = getLocaleKey(rel)
    byLocale.get(localeKey)?.push(rel)
  }

  for (const [localeKey, relFiles] of byLocale.entries()) {
    const payload = await buildIndexForLocale(localeKey, relFiles)
    const outFile = path.join(PUBLIC_DIR, `search-index.${localeKey}.json`)
    await fs.writeFile(outFile, JSON.stringify(payload), 'utf-8')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

