import { Card, Tag, Typography, theme } from 'antd'
import { Github, FileText } from 'lucide-react'
import styles from './AboutPage.module.css'

const { Title, Text, Link } = Typography

const TECH_STACK = [
  'Electron',
  'React',
  'TypeScript',
  'Ant Design',
  'Go',
  'Python',
  'Google Earth Engine',
]

export function AboutPage() {
  const { token } = theme.useToken()
  const pkg = require('../../../package.json')

  return (
    <div
      className={styles.page}
      style={{ background: token.colorBgLayout }}
    >
      <div className={styles.content}>
        <Title level={3} style={{ marginTop: 0 }}>
          关于 GeoWork
        </Title>

        <Card
          bordered={false}
          style={{
            background: token.colorBgContainer,
            borderRadius: 12,
            border: `1px solid ${token.colorBorderSecondary}`,
            marginBottom: 24,
          }}
        >
          <div className={styles.section}>
            <div className={styles.sectionTitle}>产品信息</div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>名称</span>
              <span className={styles.infoValue}>GeoWork</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>版本</span>
              <span className={styles.infoValue}>
                v{pkg.version}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>描述</span>
              <span className={styles.infoValue} style={{ textAlign: 'right', maxWidth: '60%' }}>
                {pkg.description}
              </span>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>技术栈</div>
            <div className={styles.stackList}>
              {TECH_STACK.map((tech) => (
                <Tag
                  key={tech}
                  className={styles.stackTag}
                  style={{
                    background: token.colorFillSecondary,
                    color: token.colorText,
                    border: 'none',
                  }}
                >
                  {tech}
                </Tag>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>链接</div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>GitHub</span>
              <Link
                href="https://github.com/geowork"
                target="_blank"
                rel="noreferrer"
                className={styles.link}
              >
                <Github /> 仓库地址
              </Link>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>文档</span>
              <Link
                disabled
                className={styles.link}
              >
                <FileText /> 文档中心（即将上线）
              </Link>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>许可证</div>
            <Text className={styles.license}>
              GeoWork 采用 PolyForm Noncommercial 许可证。
              个人和内部使用免费，商业使用请联系团队。
            </Text>
          </div>
        </Card>
      </div>
    </div>
  )
}