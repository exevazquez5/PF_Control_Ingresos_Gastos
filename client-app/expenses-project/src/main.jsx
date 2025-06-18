import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom' // 👈 importar BrowserRouter

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter> {/* 👈 envolver App con BrowserRouter */}
      <App />
    </BrowserRouter>
  </StrictMode>
)
