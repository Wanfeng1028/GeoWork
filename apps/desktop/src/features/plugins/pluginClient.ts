// GeoWork Desktop - Plugin Marketplace Client
// TypeScript client for plugin marketplace operations via Go Core API

import runtimeClient from '../../services/runtimeClient'

export interface Plugin {
  id: string
  name: string
  description: string
  version: string
  author: string
  permissions: string[]
  installed: boolean
  enabled: boolean
  installCount?: number
  rating?: number
  localPath?: string
  category?: string
  homepage?: string
  license?: string
}

class PluginClient {
  // List all plugins available in the marketplace
  async listMarketplace(): Promise<Plugin[]> {
    return this.geowork.plugin.listMarketplace()
  }

  // Get detailed info for a specific plugin
  async getPlugin(id: string): Promise<Plugin> {
    return this.geowork.plugin.getPlugin(id)
  }

  // Install a plugin from the marketplace
  async installPlugin(id: string): Promise<void> {
    await this.geowork.plugin.installPlugin(id)
  }

  // Uninstall a plugin
  async uninstallPlugin(id: string): Promise<void> {
    await this.geowork.plugin.uninstallPlugin(id)
  }

  // Toggle plugin enabled/disabled state
  async togglePlugin(id: string, enabled: boolean): Promise<void> {
    await this.geowork.plugin.togglePlugin(id, enabled)
  }

  private get geowork(): typeof window.geowork {
    return window.geowork
  }
}

export const pluginClient = new PluginClient()
export default pluginClient
