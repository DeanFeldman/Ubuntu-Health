import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
 
const styles = `
  :root {
    --uh-primary: #2563EB;
    --uh-primary-dark: #1D4ED8;
    --uh-bg: #F3F4F6;
    --uh-surface: #FFFFFF;
    --uh-text: #111827;
    --uh-muted: #6B7280;
    --uh-border: #E5E7EB;
    --uh-shadow: 0 8px 24px rgba(17, 24, 39, 0.07);
  }
 
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
 
  body {
    font-family: Inter, Arial, sans-serif;
    background: var(--uh-bg);
    color: var(--uh-text);
    line-height: 1.5;
  }
 
  .uh-navbar {
    background: var(--uh-surface);
    border-bottom: 1px solid var(--uh-border);
    padding: 0 24px;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .uh-navbar-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 0;
    gap: 16px;
  }

  .uh-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    font-size: 1.1rem;
    white-space: nowrap;
    text-decoration: none;
    color: var(--uh-text);
  }

  .uh-brand-logo {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: var(--uh-primary);
    display: grid;
    place-items: center;
    color: #fff;
    font-weight: 800;
    font-size: 13px;
    flex-shrink: 0;
    text-decoration: none;
  }

  .uh-nav-links {
    display: flex;
    gap: 20px;
    font-size: 14px;
    font-weight: 500;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .uh-nav-links a {
    text-decoration: none;
    color: var(--uh-muted);
    transition: color 0.15s;
    padding-bottom: 2px;
  }

  .uh-nav-links a:hover { color: var(--uh-primary); }

  .uh-nav-links a.active {
    color: var(--uh-primary);
    border-bottom: 2px solid var(--uh-primary);
  }

  .uh-nav-actions {
    display: flex;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
 
  .uh-btn {
    border: none;
    border-radius: 10px;
    padding: 10px 18px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    font-family: inherit;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .uh-btn-primary {
    background: var(--uh-primary);
    color: #fff;
  }

  .uh-btn-primary:hover {
    background: var(--uh-primary-dark);
  }
 
  .uh-page {
    min-height: calc(100vh - 73px);
    padding: 24px;
  }
 
  @media (max-width: 768px) {
    .uh-nav-links { display: none; }
    .uh-navbar-inner { padding: 12px 0; }
  }
`
 
export default function Layout() {
  const { logout, user } = useAuth()
 
  const handleLogout = async () => {
    await logout()
  }
 
  return (
    <>
      <style>{styles}</style>
 
      <header className="uh-navbar">
        <nav className="uh-navbar-inner" aria-label="Primary navigation">
          <NavLink to="/" className="uh-brand">
            <abbr className="uh-brand-logo" title="Ubuntu Health">UH</abbr>
            Ubuntu Health
          </NavLink>
 
          <ul className="uh-nav-links">
            <li><NavLink to="/">Home</NavLink></li>
            <li><NavLink to="/clinic">Patient</NavLink></li>
            <li><NavLink to="/staff">Staff</NavLink></li>
            <li><NavLink to="/admin">Admin</NavLink></li>
          </ul>
 
          {user && (
            <menu className="uh-nav-actions">
              <li>
                <button className="uh-btn uh-btn-primary" onClick={handleLogout}>
                  Log out
                </button>
              </li>
            </menu>
          )}
        </nav>
      </header>
 
      <main className="uh-page">
        <Outlet />
      </main>
    </>
  )
}