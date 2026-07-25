import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { inicializarDatos } from './db'
import { bloquearZoom } from './lib/sinZoom'

// Se crea la carta, las mesas y los ajustes la primera vez que se abre la app
await inicializarDatos()

bloquearZoom()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
