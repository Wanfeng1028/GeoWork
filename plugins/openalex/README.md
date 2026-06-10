# OpenAlex 论文搜索插件

## 概述

OpenAlex 是一个开放的学术论文数据库，包含超过 2.5 亿篇学术论文的元数据。本插件为 GeoWork 提供 OpenAlex 论文搜索和文献管理功能。

## 功能特性

- **论文搜索**：按关键词、作者、年份、期刊等搜索论文
- **PDF 解析**：解析 PDF 论文，提取标题、摘要、作者、参考文献
- **文献索引**：将论文索引到本地知识库，支持全文搜索
- **引用管理**：生成 BibTeX 引用格式

## 安装

```bash
# 通过 GeoWork 插件市场安装
geowork plugin install openalex
```

## 配置

在 GeoWork 设置中配置 OpenAlex 插件：

```json
{
  "api_key": "your_api_key_here",
  "max_results": 20,
  "sort_by": "relevance_score"
}
```

## 使用方法

### 搜索论文

```python
# 搜索论文
result = geowork.papers.search({
    "query": "Sentinel-2 NDVI urban green space",
    "filters": {
        "from_publication_date": "2019-01-01",
        "to_publication_date": "2024-12-31"
    }
})
```

### 解析 PDF

```python
# 解析 PDF 论文
result = geowork.papers.parse_pdf({
    "path": "/path/to/paper.pdf"
})
```

### 索引到知识库

```python
# 索引论文到知识库
result = geowork.papers.index({
    "title": "论文标题",
    "authors": ["作者1", "作者2"],
    "abstract": "摘要内容",
    "doi": "10.1234/example"
})
```

## API 端点

### POST /tools/papers/search

搜索论文。

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索关键词 |
| filters | object | 否 | 过滤条件 |
| page | number | 否 | 页码 |
| per_page | number | 否 | 每页数量 |

**返回结果**：

```json
{
  "ok": true,
  "data": {
    "papers": [
      {
        "id": "W1234567890",
        "title": "论文标题",
        "authors": ["作者1", "作者2"],
        "abstract": "摘要内容",
        "doi": "10.1234/example",
        "publication_date": "2023-01-01",
        "cited_by_count": 100
      }
    ],
    "total": 1000,
    "page": 1,
    "per_page": 20
  }
}
```

### POST /tools/papers/parse-pdf

解析 PDF 论文。

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| path | string | 是 | PDF 文件路径 |

**返回结果**：

```json
{
  "ok": true,
  "data": {
    "title": "论文标题",
    "authors": ["作者1", "作者2"],
    "abstract": "摘要内容",
    "keywords": ["关键词1", "关键词2"],
    "references": ["参考文献1", "参考文献2"]
  }
}
```

### POST /tools/papers/index

索引论文到知识库。

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 论文标题 |
| authors | array | 是 | 作者列表 |
| abstract | string | 否 | 摘要 |
| doi | string | 否 | DOI |
| path | string | 否 | PDF 文件路径 |

## 依赖

- requests
- PyMuPDF
- sqlite3

## 版本历史

- v1.0.0 (2024-01-01)：初始版本
