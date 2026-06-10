// GeoWork Frontend - Desktop Bridge
// Wrapper for Electron preload desktop APIs

class DesktopBridge {
  private geowork: typeof window.geowork;

  constructor() {
    this.geowork = window.geowork;
  }

  // === File Dialogs ===

  async chooseFolder(): Promise<string[]> {
    return this.geowork.desktop.chooseFolder();
  }

  async chooseFiles(options?: { filters?: Array<{ name: string; extensions: string[] }>; properties?: string[] }): Promise<string[]> {
    return this.geowork.desktop.chooseFiles(options);
  }

  async revealInFileExplorer(filePath: string): Promise<{ success: boolean; error?: string }> {
    return this.geowork.desktop.revealInFileExplorer(filePath);
  }

  async openExternal(url: string): Promise<{ success: boolean; error?: string }> {
    return this.geowork.desktop.openExternal(url);
  }

  // === System ===

  async showNotification(options: { title: string; body: string; icon?: string }): Promise<{ success: boolean }> {
    return this.geowork.system.showNotification(options);
  }

  async getPlatformInfo(): Promise<any> {
    return this.geowork.system.getPlatformInfo();
  }

  async getAppDataPath(): Promise<string> {
    return this.geowork.system.getAppDataPath();
  }

  // === Clipboard ===

  async readClipboardText(): Promise<string> {
    return this.geowork.clipboard.readText();
  }

  async writeClipboardText(text: string): Promise<void> {
    await this.geowork.clipboard.writeText(text);
  }

  // === Notifications ===

  async showNotificationToast(options: { title: string; body: string; urgency?: 'normal' | 'critical' }): Promise<void> {
    await this.geowork.notifications.show({
      title: options.title,
      body: options.body,
      urgency: options.urgency || 'normal',
    });
  }
}

export const desktopBridge = new DesktopBridge();
export default desktopBridge;
