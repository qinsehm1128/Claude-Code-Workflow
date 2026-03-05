import type { MarkdownTransformContext } from 'vitepress'

// Multi-line demo block: :::demo Name #file ...code... :::
const demoBlockRE = /:::\s*demo\s+([^\n]+)\n([\s\S]*?)\n:::/g

// Single-line demo block: :::demo Name #file :::
const demoBlockSingleRE = /:::\s*demo\s+(\S+)\s*(#\S+)?\s*:::/g

export interface DemoBlockMeta {
  name: string
  file?: string
  code?: string
  height?: string
  expandable?: boolean
  showCode?: boolean
  title?: string
}

export function transformDemoBlocks(
  code: string,
  ctx: MarkdownTransformContext
): string {
  // First handle multi-line demo blocks with inline code
  let result = code.replace(demoBlockRE, (match, headerLine, codeContent) => {
    const meta = parseDemoHeader(headerLine)

    const demoId = `demo-${ctx.path.replace(/[^a-z0-9]/gi, '-')}-${meta.name}-${Date.now().toString(36)}`

    const props = [
      `id="${demoId}"`,
      `name="${meta.name}"`,
      meta.file ? `file="${meta.file}"` : '',
      meta.height ? `height="${meta.height}"` : '',
      meta.expandable === false ? ':expandable="false"' : '',
      meta.showCode === false ? ':show-code="false"' : '',
      meta.title ? `title="${meta.title}"` : ''
    ].filter(Boolean).join(' ')

    // Return a simple comment placeholder - the inline code will be ignored
    // This avoids Vue parsing issues with JSX in markdown
    return `<DemoContainer ${props} />`
  })

  // Then handle single-line demo blocks (file references only)
  result = result.replace(demoBlockSingleRE, (match, name, fileRef) => {
    const demoId = `demo-${ctx.path.replace(/[^a-z0-9]/gi, '-')}-${name}-${Date.now().toString(36)}`

    const file = fileRef ? fileRef.slice(1) : undefined

    const props = [
      `id="${demoId}"`,
      `name="${name}"`,
      file ? `file="${file}"` : '',
      ':expandable="true"',
      ':show-code="true"'
    ].filter(Boolean).join(' ')

    return `<DemoContainer ${props} />`
  })

  return result
}

function parseDemoHeader(headerLine: string): DemoBlockMeta {
  const parts = headerLine.trim().split(/\s+/)
  const name = parts[0] || ''
  const file = parts.find(p => p.startsWith('#'))?.slice(1)

  // Extract props from remaining parts
  const props: Record<string, string> = {}
  for (const part of parts.slice(1)) {
    if (part.includes(':')) {
      const [key, value] = part.split(':', 2)
      props[key] = value
    }
  }

  return {
    name,
    file,
    height: props.height,
    expandable: props.expandable !== 'false',
    showCode: props.showCode !== 'false',
    title: props.title
  }
}

// VitePress markdown configuration hook
export function markdownTransformSetup() {
  return {
    transform: (code: string, ctx: MarkdownTransformContext) => {
      return transformDemoBlocks(code, ctx)
    }
  }
}
