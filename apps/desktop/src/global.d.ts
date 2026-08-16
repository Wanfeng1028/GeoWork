export {}

declare global {
  interface Window {
    geowork?: {
      desktop: {
        chooseFolder: () => Promise<any>
        chooseFiles: (options?: any) => Promise<any>
        revealInFileExplorer: (filePath: string) => Promise<any>
        openExternal: (url: string) => Promise<any>
        openLocalApp: (appName: string) => Promise<any>
        minimizeWindow: () => Promise<any>
        toggleMaximizeWindow: () => Promise<any>
        closeWindow: () => Promise<any>
        isWindowMaximized: () => Promise<any>
        setTitleBarTheme: (dark: boolean) => Promise<any>
      }
      runtime: Record<string, any> & {
        getToken?: () => Promise<string | null>
      }
      cloud: { api: (method: string, path: string, body?: any) => Promise<any> }
      secrets?: {
        get: (key: string) => Promise<string | null>
        set: (key: string, value: string) => Promise<unknown>
        delete: (key: string) => Promise<unknown>
      }
      system: Record<string, any>
      clipboard: Record<string, any>
      notifications: Record<string, any>
      security: Record<string, any>
      browser: Record<string, any>
      terminal: Record<string, any>
    }
  }
}
