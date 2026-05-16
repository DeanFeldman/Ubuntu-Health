import { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccess } from '../Utils/Permissions'
import logo from '../assets/logo.png'

//STYLES
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

.uh-toast-wrap {
  position: fixed;
  top: 88px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.uh-toast {
  min-width: 280px;
  max-width: 420px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.16);
  animation: uh-toast-slide 0.22s ease-out;
  pointer-events: auto;
}

.uh-toast-icon {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 15px;
  font-weight: 900;
}

.uh-toast-content strong {
  display: block;
  margin-bottom: 2px;
}

.uh-toast-content span {
  display: block;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
}

.uh-toast-success {
  background: #DCFCE7;
  color: #166534;
  border: 1px solid #86EFAC;
}

.uh-toast-success .uh-toast-icon {
  background: #16A34A;
  color: white;
}

.uh-toast-error {
  background: #FEE2E2;
  color: #991B1B;
  border: 1px solid #FCA5A5;
}

.uh-toast-error .uh-toast-icon {
  background: #DC2626;
  color: white;
}

@keyframes uh-toast-slide {
  from {
    opacity: 0;
    transform: translateX(12px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (max-width: 520px) {
  .uh-toast-wrap {
    top: 110px;
    right: 16px;
    left: 16px;
  }

  .uh-toast {
    min-width: 0;
    max-width: none;
    width: 100%;
  }
}


.uh-navbar-inner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
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
  min-width: 0;
}
  .uh-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  background: #D1D5DB !important;
  color: #6B7280 !important;
}

.uh-brand-logo {
  width: 44px;
  height: 44px;
  object-fit: contain;
  display: block;
  flex-shrink: 0;
  transform: scale(3.4);
  margin-right: 12px;

}

.uh-nav-links {
  display: flex;
  justify-content: center;
  gap: 20px;
  font-size: 14px;
  font-weight: 500;
  list-style: none;
  margin: 0;
  padding: 0;
}

.uh-nav-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
  align-items: center;
  min-width: 0;
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

  @media (max-width: 900px) {
  .uh-navbar {
    padding: 0 16px;
  }

  .uh-navbar-inner {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "brand actions"
      "links links";
    gap: 12px;
    padding: 12px 0;
  }

  .uh-brand {
    grid-area: brand;
    min-width: 0;
    font-size: 1rem;
  }

  .uh-brand-logo {
    width: 36px;
    height: 36px;
    transform: scale(2.5);
    margin-right: 8px;
  }

  .uh-nav-links {
    grid-area: links;
    display: flex;
    justify-content: flex-start;
    gap: 14px;
    overflow-x: auto;
    white-space: nowrap;
    padding-bottom: 6px;
  }

  .uh-nav-actions {
    grid-area: actions;
    min-width: 0;
    justify-content: flex-end;
    flex-wrap: nowrap;
  }

  .uh-btn {
    padding: 9px 14px;
  }

  .uh-page {
    padding: 18px;
  }
}

@media (max-width: 520px) {
  .uh-navbar-inner {
    grid-template-columns: 1fr;
    grid-template-areas:
      "brand"
      "actions"
      "links";
  }

  .uh-nav-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .uh-brand-logo {
    transform: scale(2.2);
  }
}

`


// The Layout component defines the overall structure of the application, including the navigation bar and main content area.
export default function Layout() {
  const { logout, user, role, RoleRequest } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()



  const [staffRequestClicked, setStaffRequestClicked] = useState(false)
  const [adminRequestClicked, setAdminRequestClicked] = useState(false)
  const [toast, setToast] = useState(null)  

  const isLoginPage = location.pathname === '/login'
  const isQueuePage = location.pathname === '/queue'
  const isBookingPage = location.pathname === '/booking'
  const isAppointmentsPage = location.pathname === '/appointments'

  const handleLogout = async () => {
    await logout()
  }

  const showRequestStaff = role === 'Patient'
  const showRequestAdmin = role === 'Staff'

  const isFlowPage = isQueuePage || isBookingPage || isAppointmentsPage


  const showToast = (title, message, type = 'success') => {
  setToast({ title, message, type })

  setTimeout(() => {
    setToast(null)
  }, 3000)
}
const handleRequestStaffRole = async () => {
  setStaffRequestClicked(true)

  try {
    await RoleRequest('Staff')
    showToast(
      'Request submitted',
      'Your staff role request has been sent for admin approval.'
    )
  } catch (err) {
    setStaffRequestClicked(false)
    showToast(
      'Request failed',
      'Could not submit your staff role request. Please try again.',
      'error'
    )
  }
}


const handleRequestAdminRole = async () => {
  setAdminRequestClicked(true)

  try {
    await RoleRequest('Admin')
    showToast(
      'Request submitted',
      'Your admin role request has been sent for admin approval.'
    )
  } catch (err) {
    setAdminRequestClicked(false)
    showToast(
      'Request failed',
      'Could not submit your admin role request. Please try again.',
      'error'
    )
  }
}

  {/* The return statement of the Layout component conditionally renders the navigation bar based on whether the user is on the login page. */}
  return (
  <>
    <style>{styles}</style>

      {toast && (
        <section className="uh-toast-wrap" aria-live="polite">
          <section className={`uh-toast uh-toast-${toast.type}`} role="status">
            <span className="uh-toast-icon">
              {toast.type === 'success' ? '✓' : '!'}
            </span>

            <section className="uh-toast-content">
              <strong>{toast.title}</strong>
              <span>{toast.message}</span>
            </section>
          </section>
        </section>
      )}

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

          {!isBookingPage && (
            <ul
                className="uh-nav-links"
                style={{ visibility: isBookingPage ? 'hidden' : 'visible' }}
              >
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
                  <>
                    <li><NavLink to="/queue">Queue</NavLink></li>
                    <li><NavLink to="/appointments">Appointments</NavLink></li>
                  </>
                )}
              </ul>
          )}

          {user && (
            <menu className="uh-nav-actions">
              {isFlowPage && (
                <li>
                  <button
                    className="uh-btn uh-btn-secondary"
                    onClick={() => navigate('/clinic')}
                  >
                    Back
                  </button>
                </li>
              )}

              {!isFlowPage && showRequestStaff && (
              <li>
                <button
                  className="uh-btn uh-btn-secondary"
                  onClick={handleRequestStaffRole}
                  disabled={staffRequestClicked}
                >
                  {staffRequestClicked ? 'Staff role requested' : 'Request Staff Role'}
                </button>
              </li>
            )}
              {!isFlowPage && showRequestAdmin && (
              <li>
                <button
                  className="uh-btn uh-btn-secondary"
                  onClick={handleRequestAdminRole}
                  disabled={adminRequestClicked}
                >
                  {adminRequestClicked ? 'Admin role requested' : 'Request Admin Role'}
                </button>
              </li>
            )}

              {!isFlowPage && (
                <li>
                  <button
                    className="uh-btn uh-btn-primary"
                    onClick={handleLogout}
                  >
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