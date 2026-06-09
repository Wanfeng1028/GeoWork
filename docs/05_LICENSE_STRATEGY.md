# GeoWork 授权策略

## 1. 授权目标

- 个人、学生、非商业科研免费使用
- 企业或商业用途必须付费

传统开源协议如 MIT、Apache-2.0、GPL、AGPL 都不能实现"禁止商业使用"。它们都允许商业使用。因此 GeoWork 不应使用这些协议作为唯一许可证。

## 2. 推荐方案

采用双授权：

- **GeoWork Community Edition**：PolyForm Noncommercial 1.0.0
- **GeoWork Commercial Edition**：单独商业授权

### 对外表述

- 源代码可见
- 个人和学生免费
- 非商业科研免费
- 商业使用需授权

## 3. 免费范围

| 场景 | 是否免费 |
|------|----------|
| 个人学习 | ✅ 免费 |
| 学生作业 | ✅ 免费 |
| 高校非商业课程教学 | ✅ 免费 |
| 个人非商业科研 | ✅ 免费 |
| 开源社区测试和贡献 | ✅ 免费 |

## 4. 需要商业授权的范围

| 场景 | 是否需要授权 |
|------|--------------|
| 企业内部使用 | ✅ 需要 |
| 商业项目交付 | ✅ 需要 |
| 商业咨询 | ✅ 需要 |
| 商业培训 | ✅ 需要 |
| 外包项目 | ✅ 需要 |
| 商业科研服务 | ✅ 需要 |
| SaaS/API/平台集成 | ✅ 需要 |
| 商业插件分发 | ✅ 需要 |
| 政府/机构/公司采购项目中的生产使用 | ✅ 需要 |

## 5. 仓库文件

根目录建议放：

- `LICENSE`
- `COMMERCIAL-LICENSE.md`
- `NOTICE`

### LICENSE 内容建议

```
GeoWork Community License

GeoWork is licensed under the PolyForm Noncommercial License 1.0.0
for personal, educational, academic, and other noncommercial use.

Commercial use is not permitted without a separate commercial license.

For commercial licensing, enterprise deployment, consulting use,
training use, SaaS integration, or other business use, please contact:

[你的邮箱]
```

### COMMERCIAL-LICENSE.md 内容建议

```markdown
# GeoWork Commercial License

For commercial use of GeoWork, please contact us for a commercial license.

## Contact

- Email: [你的邮箱]
- Website: [你的网站]

## Commercial License Includes

- Enterprise deployment rights
- Priority support
- Custom development
- Training and consulting
- SaaS integration rights
- Commercial plugin distribution rights
```

### NOTICE 内容建议

```
GeoWork
Copyright (c) [年份] [你的名字/公司]

This software is licensed under the PolyForm Noncommercial License 1.0.0.
See LICENSE for details.

For commercial use, see COMMERCIAL-LICENSE.md.
```

## 6. QGIS/GPL 注意事项

GeoWork 第一版建议：

- 不要打包 QGIS
- 不要修改 QGIS 源码
- 推荐让用户自行安装 QGIS
- GeoWork 通过外部进程或 Python Worker 调用本机 QGIS/PyQGIS
- 商业化前建议做开源合规审查

## 7. 第三方依赖许可

| 依赖 | 许可证 | 是否需要商业授权 |
|------|--------|------------------|
| React | MIT | 否 |
| Electron | MIT | 否 |
| Go | BSD-3 | 否 |
| Python | PSF | 否 |
| FastAPI | MIT | 否 |
| SQLite | Public Domain | 否 |
| MapLibre GL | BSD-3 | 否 |
| Deck.gl | MIT | 否 |
| ECharts | Apache-2.0 | 否 |
| Monaco Editor | MIT | 否 |
| GDAL | MIT | 否 |
| Rasterio | BSD-3 | 否 |
| GeoPandas | BSD-3 | 否 |
| PyMuPDF | AGPL-3.0 | 是（商业使用需购买许可） |
| python-docx | MIT | 否 |
| python-pptx | MIT | 否 |
| openpyxl | MIT | 否 |

**注意**：PyMuPDF 使用 AGPL-3.0 许可证，商业使用需要购买商业许可。建议在商业化前替换为其他 PDF 处理库，或购买 PyMuPDF 商业许可。

## 8. 商业化路线图

### Phase 1：社区版

- PolyForm Noncommercial 1.0.0
- 免费使用
- 开源代码

### Phase 2：商业版

- 单独商业授权
- 企业部署支持
- 优先技术支持
- 定制开发服务

### Phase 3：SaaS 版

- 云端部署
- 按量计费
- 团队协作
- 企业管理

## 9. 合规建议

1. **定期审查**：每季度审查第三方依赖许可证
2. **自动化检查**：使用 license-checker 等工具自动检查
3. **法律咨询**：商业化前咨询专业律师
4. **用户告知**：在安装和使用时明确告知用户许可条款
5. **贡献者协议**：要求贡献者签署 CLA
