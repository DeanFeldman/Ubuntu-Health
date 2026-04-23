import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app'
import { AuthProvider } from './context/AuthContext'

const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)

window.__API_BASE__ = isLocalHost
  ? ''
  : import.meta.env.VITE_API_BASE_URL || ''

{/*Create root and render the entire React app */}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/*Enables routing across the application */}
    <BrowserRouter>
      {/*Provides authentication state (user, role, etc.) to all components */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
