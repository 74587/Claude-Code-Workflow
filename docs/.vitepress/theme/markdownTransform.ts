import type { MarkdownTransformContext } from 'vitepress'

const demoBlockRE = /:::\s*demo\s+(.+?)\s*:::/g

export interface DemoBlockMeta {
  name: string
  file?: string
  height?: string
  expandable?: boolean
  showCode?: boolean
  title?: string
}

export function transformDemoBlocks(
  code: string,
  ctx: MarkdownTransformContext
): string {
  return code.replace(demoBlockRE, (match, content) => {
    const meta = parseDemoBlock(content)
    const demoId = `demo-${ctx.path.replace(/[^a-z0-9]/gi, '-')}-${Math.random().toString(36).slice(2, 8)}`

    const props = [
      `id="${demoId}"`,
      `name="${meta.name}"`,
      meta.file ? `file="${meta.file}"` : '',
      meta.height ? `height="${meta.height}"` : '',
      meta.expandable === false ? ':expandable="false"' : ':expandable="true"',
      meta.showCode === false ? ':show-code="false"' : ':show-code="true"',
      meta.title ? `title="${meta.title}"` : ''
    ].filter(Boolean).join(' ')

    return `<DemoContainer ${props} />`
  })
}

function parseDemoBlock(content: string): DemoBlockMeta {
  const lines = content.trim().split('\n')
  const firstLine = lines[0] || ''

  // Parse: name or # file
  const [name, ...rest] = firstLine.split(/\s+/)
  const file = rest.find(l => l.startsWith('#'))?.slice(1)

  return {
    name: name.trim(),
    file,
    height: extractProp(lines, 'height'),
    expandable: extractProp(lines, 'expandable') !== 'false',
    showCode: extractProp(lines, 'showCode') !== 'false',
    title: extractProp(lines, 'title')
  }
}

function extractProp(lines: string[], prop: string): string | undefined {
  const line = lines.find(l => l.trim().startsWith(`${prop}:`))
  return line?.split(':', 2)[1]?.trim()
}

// VitePress markdown configuration hook
export function markdownTransformSetup() {
  return {
    transform: (code: string, ctx: MarkdownTransformContext) => {
      return transformDemoBlocks(code, ctx)
    }
  }
}
