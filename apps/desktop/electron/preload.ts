import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('geowork', {
  coreUrl: 'http://127.0.0.1:8765'
})
