import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app'
import { AuthProvider } from '../context/AuthContext'

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
