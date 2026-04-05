import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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

.uh-root {
  font-family: Inter, Arial, sans-serif;
  background: var(--uh-bg);
  color: var(--uh-text);
  min-height: 100vh;
}

/* Navbar */
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
}
.uh-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
}
.uh-brand-logo {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--uh-primary);
  display: grid;
  place-items: center;
  color: #fff;
}

/* Buttons */
.uh-btn {
  border-radius: 10px;
  padding: 10px 18px;
  cursor: pointer;
  font-weight: 600;
}
.uh-btn-primary {
  background: var(--uh-primary);
  color: #fff;
}
.uh-btn-secondary {
  background: var(--uh-surface);
  border: 1px solid var(--uh-primary);
  color: var(--uh-primary);
}

/* Layout */
.uh-search-section { padding: 24px; }
.uh-search-card {
  background: white;
  border-radius: 20px;
  padding: 20px;
  box-shadow: var(--uh-shadow);
}
.uh-search-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
.uh-field input, .uh-field select {
  height: 44px;
  border-radius: 10px;
  border: 1px solid var(--uh-border);
  padding: 0 12px;
}

/* Clinics */
.uh-clinic-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.uh-clinic-card {
  background: white;
  padding: 20px;
  border-radius: 18px;
  border: 1px solid var(--uh-border);
}
.uh-chip {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 999px;
  background: #F3F4F6;
}
`

const CLINICS = [
  { name: "Chris Hani Baragwanath Academic Hospital", city: "Soweto", suburb: "Diepkloof", province: "Gauteng", type: "Hospital", services: ["Emergency", "Maternity"], phone: "011 933 8000" },
  { name: "Alexandra Clinic", city: "Alexandra", suburb: "Alexandra", province: "Gauteng", type: "Clinic", services: ["Primary Care"], phone: "011 882 1271" },
]

export default function PatientDashboard() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return CLINICS.filter(c =>
      [c.name, c.city, c.suburb].join(' ').toLowerCase().includes(search.toLowerCase())
    )
  }, [search])

  return (
    <>
      <style>{styles}</style>

      <div className="uh-root">
        <header className="uh-navbar">
          <div className="uh-navbar-inner">
            <div className="uh-brand">
              <div className="uh-brand-logo">UH</div>
              Ubuntu Health
            </div>
            <button className="uh-btn uh-btn-primary" onClick={logout}>
              Log out
            </button>
          </div>
        </header>

        <section className="uh-search-section">
          <div className="uh-search-card">
            <div className="uh-search-grid">
              <input
                placeholder="Search clinic..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="uh-search-section">
          <div className="uh-clinic-grid">
            {filtered.map((clinic) => (
              <div key={clinic.name} className="uh-clinic-card">
                <h3>{clinic.name}</h3>
                <p>{clinic.suburb}, {clinic.city}</p>
                <p>{clinic.phone}</p>

                <div>
                  {clinic.services.map(s => (
                    <span key={s} className="uh-chip">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}