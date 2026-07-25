import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { inicializarDatos } from './db'

// Se crea la carta, las mesas y los ajustes la primera vez que se abre la app
await inicializarDatos()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
