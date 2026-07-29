import { useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Dropdown,
  Flex,
  Input,
  Modal,
  Progress,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import { DownOutlined } from '@ant-design/icons'
import { useAppearanceStore } from '../../shared/stores/appearanceStore'
import type { Appearance } from '../../shared/stores/appearanceStore'
import styles from './ThemePreviewPage.module.css'

const { Title, Text, Paragraph } = Typography

const dropdownItems = [
  { key: '1', label: 'Action 1' },
  { key: '2', label: 'Action 2' },
  { key: '3', label: 'Action 3', danger: true },
]

export function ThemePreviewPage() {
  const { appearance, resolvedAppearance, setAppearance } = useAppearanceStore()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className={styles.root}>
      <Title level={2}>Theme Preview</Title>
      <Paragraph type="secondary">
        用于验证 Bootstrap / Dark / System / 插画 / 玻璃 主题效果
      </Paragraph>

      {/* ── Theme Switcher ── */}
      <Card style={{ marginBottom: 24 }}>
        <Flex align="center" gap={16} wrap="wrap">
          <Segmented
            value={appearance}
            onChange={(v) => setAppearance(v as Appearance)}
            options={[
              { label: '默认亮色', value: 'light' },
              { label: '暗色', value: 'dark' },
              { label: '跟随系统', value: 'system' },
              { label: '插画风格', value: 'illustration' },
              { label: '玻璃风格', value: 'glass' },
            ]}
          />
          <Text>
            appearance: <Text strong>{appearance}</Text>
          </Text>
          <Text>
            resolvedAppearance: <Text strong>{resolvedAppearance}</Text>
          </Text>
        </Flex>
      </Card>

      {/* ── Buttons ── */}
      <Card title="Button" style={{ marginBottom: 24 }}>
        <Space wrap>
          <Button type="primary">Primary</Button>
          <Button>Default</Button>
          <Button danger>Danger</Button>
          <Button type="dashed">Dashed</Button>
          <Button type="primary" shape="round">
            Round
          </Button>
          <Button disabled>Disabled</Button>
        </Space>
      </Card>

      {/* ── Alerts ── */}
      <Card title="Alert" style={{ marginBottom: 24 }}>
        <Flex vertical gap={12}>
          <Alert title="Info message" type="info" showIcon />
          <Alert title="Success message" type="success" showIcon />
          <Alert title="Warning message" type="warning" showIcon />
          <Alert title="Error message" type="error" showIcon />
        </Flex>
      </Card>

      {/* ── Form Controls ── */}
      <Card title="Form Controls" style={{ marginBottom: 24 }}>
        <Row gutter={[24, 16]}>
          <Col span={8}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Input
            </Text>
            <Input placeholder="请输入内容" />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Select
            </Text>
            <Select
              style={{ width: '100%' }}
              placeholder="请选择"
              options={[
                { value: 'a', label: 'Option A' },
                { value: 'b', label: 'Option B' },
                { value: 'c', label: 'Option C' },
              ]}
            />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              DatePicker
            </Text>
            <DatePicker style={{ width: '100%' }} />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Checkbox
            </Text>
            <Checkbox>Option A</Checkbox>
            <Checkbox defaultChecked>Option B</Checkbox>
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Radio
            </Text>
            <Radio.Group defaultValue="a">
              <Radio value="a">A</Radio>
              <Radio value="b">B</Radio>
              <Radio value="c">C</Radio>
            </Radio.Group>
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Switch
            </Text>
            <Space>
              <Switch defaultChecked />
              <Switch />
            </Space>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Segmented
            </Text>
            <Segmented options={['Daily', 'Weekly', 'Monthly']} />
          </Col>
        </Row>
      </Card>

      {/* ── Data Feedback ── */}
      <Card title="Data Feedback" style={{ marginBottom: 24 }}>
        <Flex vertical gap={16}>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Progress
            </Text>
            <Progress percent={30} />
            <Progress percent={70} status="active" />
            <Progress percent={100} status="success" />
          </div>

          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Tag
            </Text>
            <Space>
              <Tag>Default</Tag>
              <Tag color="success">Success</Tag>
              <Tag color="warning">Warning</Tag>
              <Tag color="error">Error</Tag>
              <Tag color="processing">Processing</Tag>
            </Space>
          </div>

          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Badge
            </Text>
            <Space size={24}>
              <Badge count={5}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 6,
                    background: '#eee',
                  }}
                />
              </Badge>
              <Badge count={0} showZero>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 6,
                    background: '#eee',
                  }}
                />
              </Badge>
              <Badge status="success" text="Success" />
              <Badge status="error" text="Error" />
            </Space>
          </div>

          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Dropdown
            </Text>
            <Dropdown menu={{ items: dropdownItems }}>
              <Button>
                Hover me <DownOutlined />
              </Button>
            </Dropdown>
          </div>
        </Flex>
      </Card>

      {/* ── Modal ── */}
      <Card title="Modal" style={{ marginBottom: 24 }}>
        <Button type="primary" onClick={() => setModalOpen(true)}>
          打开 Modal
        </Button>
        <Modal
          title="主题验证 Modal"
          open={modalOpen}
          onOk={() => setModalOpen(false)}
          onCancel={() => setModalOpen(false)}
        >
          <p>这是用于验证 Bootstrap / Dark 主题的 Modal。</p>
        </Modal>
      </Card>

      <Divider />
      <Text type="secondary">Theme Preview — GeoFrontend 2.0</Text>
    </div>
  )
}
