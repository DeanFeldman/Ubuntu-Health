import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccess } from '../Utils/Permissions'
import logo from '../assets/logo.png'

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
  height: 60px;
  width: 60px;
  object-fit: cover;
  transform: scale(2);  
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
    align-items: center;
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

  .uh-btn-secondary {
    background: #E5E7EB !important;
    color: var(--uh-text) !important;
    border: none !important;
  }

  .uh-btn-secondary:hover {
    background: #D1D5DB;
  }

  .uh-btn {
    border: none;
  }

  .uh-page {
    min-height: calc(100vh - 73px);
    padding: 24px;
  }

  @media (max-width: 768px) {
    .uh-nav-links { display: none; }
    .uh-navbar-inner { padding: 12px 0; }
    .uh-nav-actions { flex-wrap: wrap; justify-content: flex-end; }
  }
`

export default function Layout() {
  const { logout, user, role, RoleRequest } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const isLoginPage = location.pathname === '/login'
  const isQueuePage = location.pathname === '/queue'

  const handleLogout = async () => {
    await logout()
  }

  const showRequestStaff = role === 'Patient'
  const showRequestAdmin = role === 'Staff'

  return (
    <>
      <style>{styles}</style>

      {!isLoginPage && (
        <header className="uh-navbar">
          <nav className="uh-navbar-inner" aria-label="Primary navigation">
            <NavLink to="/" className="uh-brand">
                <img
                src={logo}
                alt="Ubuntu Health logo"
                className="uh-brand-logo"
              />
              Ubuntu Health
            </NavLink>

            <ul className="uh-nav-links">
              {canAccess(role, 'admin') && (
                <li><NavLink to="/admin">Admin</NavLink></li>
              )}
              {canAccess(role, 'staff') && (
                <li><NavLink to="/staff">Staff</NavLink></li>
              )}
              {canAccess(role, 'clinic') && (
                <li><NavLink to="/clinic">Clinic</NavLink></li>
              )}
              {user && (
                <li><NavLink to="/queue">Queue</NavLink></li>
              )}
            </ul>
            
            {user && (
              <menu className="uh-nav-actions">
                {isQueuePage && (
                  <li>
                    <button
                      className="uh-btn uh-btn-secondary"
                      onClick={() => navigate('/clinic')}
                    >
                      Back
                    </button>
                  </li>
                )}

                {!isQueuePage && showRequestStaff && (
                  <li>
                    <button
                      className="uh-btn uh-btn-secondary"
                      onClick={() => RoleRequest('Staff')}
                    >
                      Request Staff Role
                    </button>
                  </li>
                )}

                {!isQueuePage && showRequestAdmin && (
                  <li>
                    <button
                      className="uh-btn uh-btn-secondary"
                      onClick={() => RoleRequest('Admin')}
                    >
                      Request Admin Role
                    </button>
                  </li>
                )}

                {!isQueuePage && (
                  <li>
                    <button className="uh-btn uh-btn-primary" onClick={handleLogout}>
                      Log out
                    </button>
                  </li>
                )}
              </menu>
            )}
          </nav>
        </header>
      )}

      <main className={isLoginPage ? '' : 'uh-page'}>
        <Outlet />
      </main>
    </>
  )
}