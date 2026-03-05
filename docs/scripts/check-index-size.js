#!/usr/bin/env node

/**
 * Search Index Size Checker
 * Alerts when search index exceeds recommended size for FlexSearch
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const INDEX_PATHS = [
  path.join(process.cwd(), '.vitepress/dist/search-index.root.json'),
  path.join(process.cwd(), '.vitepress/dist/search-index.zh.json')
]
const MAX_SIZE = 1024 * 1024 // 1MB
const MAX_DOCS = 2000

function checkIndexSize() {
  const missing = INDEX_PATHS.filter((p) => !fs.existsSync(p))
  if (missing.length > 0) {
    console.log('⚠️  Search index not found. Run build first.')
    for (const p of missing) console.log(`   Missing: ${p}`)
    return 1
  }

  let totalBytes = 0
  let totalDocs = 0

  console.log(`\n📊 Search Index Analysis`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  for (const indexPath of INDEX_PATHS) {
    const stats = fs.statSync(indexPath)
    totalBytes += stats.size

    const sizeKB = (stats.size / 1024).toFixed(2)
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
    console.log(`File: ${path.relative(process.cwd(), indexPath)}`)
    console.log(`Size: ${sizeKB} KB (${sizeMB} MB)`)

    try {
      const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
      if (Array.isArray(parsed.docs)) {
        totalDocs += parsed.docs.length
        console.log(`Docs: ${parsed.docs.length}`)
      } else {
        console.log(`Docs: (unknown format)`)
      }
    } catch {
      console.log(`Docs: (unavailable)`)
    }
    console.log('')
  }

  const totalKB = (totalBytes / 1024).toFixed(2)
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2)
  console.log(`Total: ${totalKB} KB (${totalMB} MB)`)
  console.log(`Total docs: ~${totalDocs}`)

  // Check size threshold
  if (totalBytes > MAX_SIZE) {
    console.log(`\n⚠️  WARNING: Index size exceeds ${MAX_SIZE / 1024 / 1024} MB`)
    console.log(`   Current: ${totalMB} MB`)
    console.log(`   Impact: Slower search performance`)
    console.log(`   Recommendation: Consider Algolia DocSearch\n`)

    console.log(`Migration Options:`)
    console.log(`  1. Apply for Algolia DocSearch (free for open source)`)
    console.log(`  2. Reduce indexed content`)
    console.log(`  3. Split documentation into multiple sites\n`)

    return 1
  }

  if (totalDocs > MAX_DOCS) {
    console.log(`\n⚠️  WARNING: Indexed docs exceeds ${MAX_DOCS}`)
    console.log(`   Current: ${totalDocs} docs`)
    console.log(`   Recommendation: Consider Algolia DocSearch\n`)
    return 1
  }

  console.log(`\n✅ Search index is within recommended limits\n`)
  return 0
}

// Run if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(checkIndexSize())
}

export { checkIndexSize }
