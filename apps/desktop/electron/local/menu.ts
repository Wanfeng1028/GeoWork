// GeoWork Electron - Application Menu Builder
// Builds the native application menu from a template

import { Menu } from 'electron';

export interface MenuItemTemplate {
  label?: string;
  click?: () => void;
  type?: 'separator';
  submenu?: MenuItemTemplate[];
  [key: string]: unknown;
}

export function buildMenu(menuTemplate: MenuItemTemplate[]): void {
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

export function clearMenu(): void {
  Menu.setApplicationMenu(null);
}

export function getDefaultMenu(): MenuItemTemplate[] {
  const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL !== undefined;

  return [
    {
      label: 'GeoWork',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: '打开文档',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/your-org/geowork');
          },
        },
      ],
    },
  ];
}
