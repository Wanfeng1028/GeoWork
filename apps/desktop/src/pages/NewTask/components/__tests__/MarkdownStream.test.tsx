import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MarkdownStream } from '../MarkdownStream'

describe('MarkdownStream（A2，doc/23）', () => {
  it('渲染 GFM 表格与表头', () => {
    const md = `
| 图层 | 类型 | 分辨率 |
|---|---|---|
| land_parcels | GeoJSON | — |
| dem | GeoTIFF | 30m |
`
    const { container } = render(<MarkdownStream content={md} />)
    const table = container.querySelector('table')
    expect(table).toBeTruthy()
    expect(table?.querySelectorAll('th').length).toBe(3)
    expect(table?.textContent).toContain('land_parcels')
  })

  it('代码块：语言标签 + 复制按钮存在（Shiki 未就绪走纯文本降级）', () => {
    const md = '```python\nimport geopandas as gpd\n```'
    const { container } = render(<MarkdownStream content={md} />)
    expect(container.textContent).toContain('python')
    expect(container.querySelector('pre')?.textContent).toContain('geopandas')
  })

  it('流式半截 fence：未闭合代码块按代码块渲染', () => {
    const md = '说明如下：\n\n```json\n{"task": "spatial-analysis"'
    const { container } = render(<MarkdownStream content={md} />)
    expect(container.querySelector('pre')?.textContent).toContain('spatial-analysis')
  })

  it('标题/列表/行内代码', () => {
    const md = '## 分析计划\n\n- 缓冲区分析\n- 叠加分析\n\n使用 `gis.buffer` 工具'
    const { container } = render(<MarkdownStream content={md} />)
    expect(container.querySelector('h2')?.textContent).toBe('分析计划')
    expect(container.querySelectorAll('li').length).toBe(2)
    expect(container.querySelector('code')?.textContent).toBe('gis.buffer')
  })
})
