import React from 'react'
import ReactDOM from 'react-dom/client'
import { initGeoWorkTheme } from './design/theme-init'
import './styles/app.css'
import './styles/global.scss'
import { App } from './app/App'

initGeoWorkTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
