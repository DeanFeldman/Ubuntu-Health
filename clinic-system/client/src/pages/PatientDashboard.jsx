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

  /* ── Navbar ── */
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
  }
  .uh-nav-links a:hover { color: var(--uh-primary); }
  .uh-nav-actions { display: flex; gap: 10px; }

  /* ── Buttons ── */
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
  .uh-btn-primary { background: var(--uh-primary); color: #fff; }
  .uh-btn-primary:hover { background: var(--uh-primary-dark); }
  .uh-btn-secondary { background: var(--uh-surface); color: var(--uh-primary); border: 1px solid var(--uh-primary); }
  .uh-btn-secondary:hover { background: #EFF6FF; }

  /* ── Search ── */
  .uh-search-section { padding: 24px 24px 0; }
  .uh-search-card {
    background: var(--uh-surface);
    border-radius: 20px;
    box-shadow: var(--uh-shadow);
    border: 1px solid rgba(229, 231, 235, 0.7);
    padding: 20px;
  }
  .uh-search-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr auto;
    gap: 10px;
    align-items: end;
  }
  .uh-field { display: flex; flex-direction: column; gap: 6px; }
  .uh-field label { font-size: 12px; font-weight: 600; color: var(--uh-muted); }
  .uh-label-hidden { visibility: hidden; }
  .uh-field input,
  .uh-field select {
    height: 44px;
    border: 1px solid var(--uh-border);
    border-radius: 10px;
    padding: 0 12px;
    background: var(--uh-surface);
    color: var(--uh-text);
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .uh-field input:focus,
  .uh-field select:focus {
    border-color: var(--uh-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }
  .uh-search-submit { height: 44px; border-radius: 10px; padding: 0 20px; }

  /* ── Clinic listing ── */
  .uh-clinics-section { padding: 20px 24px 40px; }
  .uh-section-header { margin-bottom: 14px; }
  .uh-section-header h2 { font-size: 1.4rem; font-weight: 800; margin-bottom: 3px; color: var(--uh-text); }
  .uh-section-header p { color: var(--uh-muted); font-size: 13px; }
  .uh-results-count { font-size: 13px; color: var(--uh-muted); margin-bottom: 14px; }
  .uh-results-count strong { color: var(--uh-text); font-weight: 600; }

  .uh-clinic-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .uh-clinic-card {
    background: var(--uh-surface);
    border-radius: 18px;
    box-shadow: 0 4px 16px rgba(17, 24, 39, 0.06);
    border: 1px solid rgba(229, 231, 235, 0.7);
    padding: 20px;
    transition: box-shadow 0.15s;
  }
  .uh-clinic-card:hover { box-shadow: 0 8px 24px rgba(17, 24, 39, 0.1); }
  .uh-clinic-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 14px;
  }
  .uh-clinic-name { font-size: 1rem; font-weight: 700; color: var(--uh-text); margin-bottom: 4px; }
  .uh-clinic-location { color: var(--uh-muted); font-size: 13px; }

  .uh-type-badge {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .badge-hospital  { background: #DBEAFE; color: #1D4ED8; }
  .badge-chc       { background: #FEF3C7; color: #B45309; }
  .badge-clinic    { background: #DCFCE7; color: #166534; }
  .badge-satellite { background: #F3F4F6; color: #6B7280; }

  .uh-clinic-meta { display: grid; gap: 6px; margin-bottom: 14px; font-size: 13px; color: var(--uh-muted); }
  .uh-clinic-meta strong { color: var(--uh-text); }

  .uh-chip-row { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 16px; list-style: none; padding: 0; }
  .uh-chip {
    font-size: 11px;
    padding: 3px 9px;
    border-radius: 999px;
    background: #F3F4F6;
    color: var(--uh-muted);
    border: 1px solid var(--uh-border);
  }

  .uh-clinic-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .uh-small-btn {
    padding: 9px 14px;
    border-radius: 9px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-size: 13px;
    font-family: inherit;
    transition: background 0.15s;
  }
  .uh-small-btn-primary { background: var(--uh-primary); color: #fff; }
  .uh-small-btn-primary:hover { background: var(--uh-primary-dark); }
  .uh-small-btn-outline { background: var(--uh-surface); color: var(--uh-primary); border: 1px solid var(--uh-primary); }
  .uh-small-btn-outline:hover { background: #EFF6FF; }

  .uh-empty {
    padding: 3rem;
    text-align: center;
    color: var(--uh-muted);
    font-size: 14px;
    background: var(--uh-surface);
    border-radius: 18px;
    border: 1px solid var(--uh-border);
  }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .uh-clinic-grid { grid-template-columns: repeat(2, 1fr); }
    .uh-search-grid { grid-template-columns: 1fr 1fr; }
    .uh-nav-links { display: none; }
  }
  @media (max-width: 640px) {
    .uh-clinic-grid { grid-template-columns: 1fr; }
    .uh-search-grid { grid-template-columns: 1fr; }
    .uh-section-header { flex-direction: column; align-items: flex-start; }
  }
`

const CLINICS = [
  { name: "Chris Hani Baragwanath Academic Hospital", city: "Soweto", suburb: "Diepkloof", province: "Gauteng", district: "Johannesburg Metro", type: "Hospital", services: ["Emergency", "Maternity", "ICU", "Trauma"], phone: "011 933 8000" },
  { name: "Tembisa Provincial Tertiary Hospital", city: "Tembisa", suburb: "Tembisa", province: "Gauteng", district: "Ekurhuleni Metro", type: "Hospital", services: ["Emergency", "Surgery", "Paediatrics"], phone: "011 923 2000" },
  { name: "Evaton Community Health Centre", city: "Evaton", suburb: "Evaton West", province: "Gauteng", district: "Sedibeng", type: "CHC", services: ["Primary Care", "Antenatal", "TB", "HIV/AIDS"], phone: "016 420 1600" },
  { name: "Alexandra Clinic", city: "Alexandra", suburb: "Alexandra", province: "Gauteng", district: "Johannesburg Metro", type: "Clinic", services: ["Primary Care", "Immunisation", "Family Planning"], phone: "011 882 1271" },
  { name: "Mamelodi Community Health Centre", city: "Mamelodi", suburb: "Mamelodi East", province: "Gauteng", district: "Tshwane Metro", type: "CHC", services: ["Primary Care", "ARV", "TB", "Mental Health"], phone: "012 805 1444" },
  { name: "Odi District Hospital", city: "Mabopane", suburb: "Mabopane", province: "Gauteng", district: "Tshwane Metro", type: "Hospital", services: ["Emergency", "Maternity", "General"], phone: "012 725 2312" },
  { name: "Groote Schuur Hospital", city: "Cape Town", suburb: "Observatory", province: "Western Cape", district: "Cape Town Metro", type: "Hospital", services: ["Emergency", "Transplant", "Neurology", "ICU"], phone: "021 404 9111" },
  { name: "Mitchell's Plain Community Health Centre", city: "Cape Town", suburb: "Mitchell's Plain", province: "Western Cape", district: "Cape Town Metro", type: "CHC", services: ["Primary Care", "HIV/AIDS", "TB", "Maternity"], phone: "021 377 4444" },
  { name: "Khayelitsha District Hospital", city: "Cape Town", suburb: "Khayelitsha", province: "Western Cape", district: "Cape Town Metro", type: "Hospital", services: ["Emergency", "Surgery", "Paediatrics", "Maternity"], phone: "021 360 5000" },
  { name: "Strand Community Day Centre", city: "Strand", suburb: "Strand", province: "Western Cape", district: "Cape Winelands", type: "Clinic", services: ["Primary Care", "Chronic Disease", "Family Planning"], phone: "021 853 2222" },
  { name: "Addington Hospital", city: "Durban", suburb: "South Beach", province: "KwaZulu-Natal", district: "eThekwini Metro", type: "Hospital", services: ["Emergency", "Trauma", "General Surgery"], phone: "031 327 2000" },
  { name: "Prince Mshiyeni Memorial Hospital", city: "Umlazi", suburb: "Umlazi", province: "KwaZulu-Natal", district: "eThekwini Metro", type: "Hospital", services: ["Emergency", "Paediatrics", "Maternity", "ICU"], phone: "031 907 8111" },
  { name: "Umlazi Clinic T", city: "Umlazi", suburb: "Umlazi T-Section", province: "KwaZulu-Natal", district: "eThekwini Metro", type: "Clinic", services: ["Primary Care", "Immunisation", "ARV"], phone: "031 906 1140" },
  { name: "Ngwelezane Hospital", city: "Empangeni", suburb: "Ngwelezane", province: "KwaZulu-Natal", district: "uThungulu", type: "Hospital", services: ["Emergency", "Surgery", "Paediatrics"], phone: "035 901 7000" },
  { name: "Pelonomi Regional Hospital", city: "Bloemfontein", suburb: "Pelonomi", province: "Free State", district: "Mangaung Metro", type: "Hospital", services: ["Emergency", "Oncology", "Orthopaedics"], phone: "051 405 1911" },
  { name: "Botshabelo Community Health Centre", city: "Botshabelo", suburb: "Botshabelo", province: "Free State", district: "Mangaung Metro", type: "CHC", services: ["Primary Care", "TB", "HIV/AIDS", "Maternity"], phone: "051 534 5200" },
]

const TYPE_BADGE = { Hospital: 'badge-hospital', CHC: 'badge-chc', Clinic: 'badge-clinic', Satellite: 'badge-satellite' }
const TYPE_LABEL = { Hospital: 'Hospital', CHC: 'Community HC', Clinic: 'Clinic', Satellite: 'Satellite' }
const unique = (arr) => [...new Set(arr)].sort()

export default function PatientDashboard() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [facilityType, setFacilityType] = useState('')

  const provinces = useMemo(() => unique(CLINICS.map((c) => c.province)), [])
  const districts = useMemo(() => unique(CLINICS.map((c) => c.district)), [])
  const types = useMemo(() => unique(CLINICS.map((c) => c.type)), [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return CLINICS.filter((c) => {
      if (province && c.province !== province) return false
      if (district && c.district !== district) return false
      if (facilityType && c.type !== facilityType) return false
      if (q && ![c.name, c.city, c.suburb].join(' ').toLowerCase().includes(q)) return false
      return true
    })
  }, [search, province, district, facilityType])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <style>{styles}</style>
      <main className="uh-root">

        <header className="uh-navbar">
          {/* nav wraps the brand + links + actions — it's the primary site navigation */}
          <nav className="uh-navbar-inner" aria-label="Primary navigation">
            <span className="uh-brand">
              <abbr className="uh-brand-logo" title="Ubuntu Health">UH</abbr>
              Ubuntu Health
            </span>
            <ul className="uh-nav-links">
              <li><a href="#">Home</a></li>
              <li><a href="#">Clinics</a></li>
              <li><a href="#">Appointments</a></li>
              <li><a href="#">Queue status</a></li>
            </ul>
            <menu className="uh-nav-actions">
              <li><button className="uh-btn uh-btn-primary" onClick={handleLogout}>Log out</button></li>
            </menu>
          </nav>
        </header>

        <section className="uh-search-section" aria-label="Search and filter clinics">
          <search className="uh-search-card">
            <fieldset className="uh-search-grid" style={{ border: 'none', padding: 0, margin: 0 }}>
              <p className="uh-field">
                <label htmlFor="search-input">Search clinic</label>
                <input
                  id="search-input"
                  type="search"
                  placeholder="Name, city or suburb..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </p>
              <p className="uh-field">
                <label htmlFor="filter-province">Province</label>
                <select id="filter-province" value={province} onChange={(e) => setProvince(e.target.value)}>
                  <option value="">All provinces</option>
                  {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </p>
              <p className="uh-field">
                <label htmlFor="filter-district">District</label>
                <select id="filter-district" value={district} onChange={(e) => setDistrict(e.target.value)}>
                  <option value="">All districts</option>
                  {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </p>
              <p className="uh-field">
                <label htmlFor="filter-type">Facility type</label>
                <select id="filter-type" value={facilityType} onChange={(e) => setFacilityType(e.target.value)}>
                  <option value="">All types</option>
                  {types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
                </select>
              </p>
              <p className="uh-field">
                <label className="uh-label-hidden" aria-hidden="true">&nbsp;</label>
                <button type="submit" className="uh-btn uh-btn-primary uh-search-submit">Search</button>
              </p>
            </fieldset>
          </search>
        </section>

        <section className="uh-clinics-section" aria-label="Clinic results">
          <hgroup className="uh-section-header">
            <h2>Nearby clinics</h2>
            <p>Browse available facilities and book your next appointment.</p>
          </hgroup>

          <p className="uh-results-count">
            Showing <strong>{filtered.length}</strong> of {CLINICS.length} facilities
          </p>

          {filtered.length === 0 ? (
            <p className="uh-empty">No clinics match your search. Try adjusting your filters.</p>
          ) : (
            <ol className="uh-clinic-grid" role="list">
              {filtered.map((clinic) => (
                <li key={clinic.name}>
                  <article className="uh-clinic-card">
                    <header className="uh-clinic-top">
                      <hgroup>
                        <h3 className="uh-clinic-name">{clinic.name}</h3>
                        <p className="uh-clinic-location">{clinic.suburb}, {clinic.city}, {clinic.province}</p>
                      </hgroup>
                      <mark className={`uh-type-badge ${TYPE_BADGE[clinic.type] ?? 'badge-satellite'}`}>
                        {TYPE_LABEL[clinic.type] ?? clinic.type}
                      </mark>
                    </header>

                    <p className="uh-clinic-meta">
                      <strong>Phone:</strong> {clinic.phone}
                    </p>

                    <ul className="uh-chip-row" aria-label="Services offered">
                      {clinic.services.map((s) => (
                        <li key={s} className="uh-chip">{s}</li>
                      ))}
                    </ul>

                    <footer className="uh-clinic-actions">
                      <button className="uh-small-btn uh-small-btn-primary">Book appointment</button>
                      <button className="uh-small-btn uh-small-btn-outline">View details</button>
                    </footer>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </section>

      </main>
    </>
  )
}