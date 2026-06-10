# NDVI 时序分析 Skill

## 概述

本 Skill 用于基于 Google Earth Engine (GEE) 或本地遥感影像计算归一化植被指数 (NDVI)，并生成时序图表和实验报告。

## 适用场景

- 本科生遥感课程实验
- 研究生植被变化分析
- 科研人员 NDVI 时序研究
- GIS 工程师植被监测

## 使用方法

### 基本用法

```python
# 运行 NDVI 时序分析 Skill
from geowork.skills import run_skill

result = run_skill("ndvi-timeseries", {
    "region": "成都市",
    "start_date": "2019-01-01",
    "end_date": "2024-12-31"
})
```

### 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| region | string | 必填 | 研究区域（城市名或坐标范围） |
| start_date | string | 2019-01-01 | 分析起始日期 |
| end_date | string | 2024-12-31 | 分析结束日期 |
| dataset | string | COPERNICUS/S2_SR_HARMONIZED | GEE 数据集 ID |
| cloud_cover | number | 20 | 最大云覆盖率 (%) |

### 输出文件

1. **ndvi_script.py** - GEE NDVI 分析脚本
2. **ndvi_chart.png** - NDVI 时序图表
3. **report.docx** - 实验报告 Word 文档

## 执行流程

1. **解析任务目标**
   - 识别研究区域
   - 确定时间范围
   - 确认输出要求

2. **推荐 GEE 数据集**
   - 推荐 Sentinel-2 或 Landsat 数据
   - 检查数据可用性

3. **生成 NDVI 脚本**
   - 生成 GEE Python 脚本
   - 包含云掩膜、NDVI 计算、时序分析

4. **生成实验报告**
   - 生成 Word 实验报告
   - 包含实验目的、数据、方法、结果、结论

## 示例任务

### 本科生实验

> 帮我完成成都市 2019-2024 年 NDVI 时序分析，并生成实验报告。

### 研究生研究

> 分析长江流域 2015-2023 年植被变化趋势，并生成图表和论文材料。

### 科研项目

> 对比分析京津冀地区 Sentinel-2 和 Landsat 8 NDVI 数据的一致性。

## 注意事项

1. **GEE 认证**：需要先完成 Google Earth Engine 认证
2. **网络访问**：需要网络访问 GEE 服务器
3. **计算时间**：大区域长时间序列分析可能需要较长时间
4. **数据质量**：云覆盖率会影响 NDVI 计算结果
5. **学术诚信**：请核实 AI 生成的数据和结论

## 技术细节

### NDVI 计算公式

```
NDVI = (NIR - Red) / (NIR + Red)
```

- NIR：近红外波段 (Sentinel-2: B8, Landsat: B5)
- Red：红光波段 (Sentinel-2: B4, Landsat: B4)

### 云掩膜

使用 Sentinel-2 QA60 波段或 Landsat QA_PIXEL 波段进行云掩膜。

### 时序分析

- 月度合成
- 季度合成
- 年度合成
- 趋势分析

## 依赖

- earthengine-api
- geemap
- matplotlib
- python-docx

## 版本历史

- v0.1.0 (2024-01-01)：初始版本
