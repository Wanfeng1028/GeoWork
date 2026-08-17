import { App } from 'antd'

/* File System Access API 类型（Electron Chromium 内核可用） */
type GeoWorkDirectoryHandle = { kind: 'directory'; name: string }
type GeoWorkFileHandle = { kind: 'file'; name: string }
type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<GeoWorkDirectoryHandle>
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    types?: Array<{ description?: string; accept: Record<string, string[]> }>
  }) => Promise<GeoWorkFileHandle[]>
}

/**
 * 文件/文件夹/图片选择（File System Access API）。
 * 自 ChatComposer 抽出（doc/26），自研与 antdx 两个输入分支共用；
 * 选中结果经 onPicked 回传文件名列表，状态由调用方持有。
 */
export function useFilePickers(onPicked: (names: string[]) => void) {
  const { message } = App.useApp()

  const pickFile = async () => {
    const pickerWindow = window as DirectoryPickerWindow
    if (!pickerWindow.showOpenFilePicker) {
      message.warning('当前浏览器不支持文件选择，请使用 Chrome 或 Edge')
      return
    }
    try {
      const handles = await pickerWindow.showOpenFilePicker({ multiple: true })
      const names = handles.map((h) => h.name)
      onPicked(names)
      message.success(`已添加 ${names.length} 个文件：${names.join('、')}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        message.info('已取消文件选择')
      } else {
        console.error(error)
        message.error('选择文件失败')
      }
    }
  }

  const pickAttachFolder = async () => {
    const pickerWindow = window as DirectoryPickerWindow
    if (!pickerWindow.showDirectoryPicker) {
      message.warning('当前浏览器不支持文件夹选择，请使用 Chrome 或 Edge')
      return
    }
    try {
      const handle = await pickerWindow.showDirectoryPicker({ mode: 'read' })
      onPicked([`[文件夹] ${handle.name}`])
      message.success(`已添加文件夹：${handle.name}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        message.info('已取消文件夹选择')
      } else {
        console.error(error)
        message.error('选择文件夹失败')
      }
    }
  }

  const pickImage = async () => {
    const pickerWindow = window as DirectoryPickerWindow
    if (!pickerWindow.showOpenFilePicker) {
      message.warning('当前浏览器不支持图片选择，请使用 Chrome 或 Edge')
      return
    }
    try {
      const handles = await pickerWindow.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: '图片',
            accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'] },
          },
        ],
      })
      const names = handles.map((h) => h.name)
      onPicked(names)
      message.success(`已添加 ${names.length} 张图片：${names.join('、')}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        message.info('已取消图片选择')
      } else {
        console.error(error)
        message.error('选择图片失败')
      }
    }
  }

  return { pickFile, pickAttachFolder, pickImage }
}
