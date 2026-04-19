import { useState, useEffect, useMemo } from 'react'
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
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    align-items: end;
  }
  .uh-field { display: flex; flex-direction: column; gap: 6px; }
  .uh-field label { font-size: 12px; font-weight: 600; color: var(--uh-muted); }
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
    list-style: none;
    padding: 0;
    margin: 0;
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

  /* ── Join Queue button ── */
  .uh-join-btn {
    width: 100%;
    margin-top: auto;
    padding: 10px;
    background: var(--uh-primary);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
  }
  .uh-join-btn:hover { background: var(--uh-primary-dark); }

  /* ── Feedback states ── */
  .uh-empty {
    padding: 3rem;
    text-align: center;
    color: var(--uh-muted);
    font-size: 14px;
    background: var(--uh-surface);
    border-radius: 18px;
    border: 1px solid var(--uh-border);
  }
  .uh-loading {
    padding: 3rem;
    text-align: center;
    color: var(--uh-muted);
    font-size: 14px;
  }
  .uh-error {
    padding: 1rem 1.5rem;
    background: #FEF2F2;
    color: #B91C1C;
    border: 1px solid #FECACA;
    border-radius: 12px;
    font-size: 14px;
    margin-bottom: 16px;
  }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .uh-clinic-grid { grid-template-columns: repeat(3, 1fr); }
    .uh-search-grid { grid-template-columns: 1fr 1fr 1fr; }
    .uh-nav-links { display: none; }
  }
  @media (max-width: 640px) {
    .uh-clinic-grid { grid-template-columns: 1fr; }
    .uh-search-grid { grid-template-columns: 1fr; }
    .uh-section-header { flex-direction: column; align-items: flex-start; }
  }
`

// Maps facility_type values to badge CSS classes and display labels
const TYPE_BADGE = {
  CHC: 'badge-chc',
  Clinic: 'badge-clinic',
  Satellite: 'badge-satellite',
}
const TYPE_LABEL = {
  CHC: 'Community HC',
  Clinic: 'Clinic',
  Satellite: 'Satellite',
}

// Returns a sorted array of unique values from an array
const unique = (arr) => [...new Set(arr)].sort()

export default function PatientDashboard() {

const navigate = useNavigate()

const handleJoinQueue = (clinic) => {
  navigate('/queue', { state: { clinic } })
}

  // Clinic data state
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter state
  const [search, setSearch] = useState('')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [facilityType, setFacilityType] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')

  // Fetch clinics on mount
  useEffect(() => {
    const fetchClinics = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/clinics')

        if (!response.ok) {
          throw new Error(`Failed to load clinics (HTTP ${response.status})`)
        }

        const data = await response.json()
        setClinics(data.clinics || [])
      } catch (err) {
        setError(err.message || 'Something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchClinics()
  }, [])

  // Derive unique filter options from fetched data
  const provinces = useMemo(() =>
  unique(clinics.map((c) => c.province)),
  [clinics])

  const districts = useMemo(() =>
  unique(clinics
    .filter((c) => !province || c.province === province)
    .map((c) => c.district)),
  [clinics, province])

  const municipalities = useMemo(() =>
  unique(clinics
    .filter((c) => !province || c.province === province)
    .filter((c) => !district || c.district === district)
    .map((c) => c.municipality)),
  [clinics, province, district])

  const types = useMemo(() =>
  unique(clinics
    .filter((c) => !province     || c.province     === province)
    .filter((c) => !district     || c.district     === district)
    .filter((c) => !municipality || c.municipality === municipality)
    .map((c) => c.facility_type)),
  [clinics, province, district, municipality])

  const services = useMemo(() =>
  unique(clinics
    .filter((c) => !province     || c.province     === province)
    .filter((c) => !district     || c.district     === district)
    .filter((c) => !municipality || c.municipality === municipality)
    .filter((c) => !facilityType || c.facility_type === facilityType)
    .flatMap((c) => c.services ?? [])),
  [clinics, province, district, municipality, facilityType])

  // Filter clinics based on all active filters 
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()

    return clinics.filter((c) => {
      if (province     && c.province     !== province)     return false
      if (district     && c.district     !== district)     return false
      if (municipality && c.municipality !== municipality) return false
      if (facilityType && c.facility_type !== facilityType) return false
      if (serviceFilter && !c.services?.includes(serviceFilter)) return false

      // Text search across name, municipality, and address
      if (q && ![c.name, c.municipality, c.address].join(' ').toLowerCase().includes(q)) {
        return false
      }

      return true
    })
  }, [search, province, district, municipality, facilityType, serviceFilter, clinics])


  // Render 
  return (
    <>
      <style>{styles}</style>


        {/* Search & filters */}
        <section className="uh-search-section" aria-label="Search and filter clinics">
          <search className="uh-search-card">
            <fieldset className="uh-search-grid" style={{ border: 'none', padding: 0, margin: 0 }}>

              <p className="uh-field">
                <label htmlFor="search-input">Search clinic</label>
                <input
                  id="search-input"
                  type="search"
                  placeholder="Name, municipality or address..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </p>

              <p className="uh-field">
                <label htmlFor="filter-province">Province</label>
                <select id="filter-province" value={province} onChange={(e) => { setProvince(e.target.value); setDistrict(''); setMunicipality(''); setFacilityType(''); setServiceFilter('') }}>
                  <option value="">All provinces</option>
                  {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </p>

              <p className="uh-field">
                <label htmlFor="filter-district">District</label>
                <select id="filter-district" value={district} onChange={(e) => { setDistrict(e.target.value); setMunicipality(''); setFacilityType(''); setServiceFilter('') }}>
                  <option value="">All districts</option>
                  {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </p>

              <p className="uh-field">
                <label htmlFor="filter-municipality">Municipality</label>
                <select id="filter-municipality" value={municipality} onChange={(e) => { setMunicipality(e.target.value); setFacilityType(''); setServiceFilter('') }}>
                  <option value="">All municipalities</option>
                  {municipalities.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </p>

              <p className="uh-field">
                <label htmlFor="filter-type">Facility type</label>
                <select id="filter-type" value={facilityType} onChange={(e) => { setFacilityType(e.target.value); setServiceFilter('') }}>
                  <option value="">All types</option>
                  {types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
                </select>
              </p>

              <p className="uh-field">
                <label htmlFor="filter-service">Service</label>
                <select id="filter-service" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
                  <option value="">All services</option>
                  {services.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </p>

            </fieldset>
          </search>
        </section>

        {/* Clinic results */}
        <section className="uh-clinics-section" aria-label="Clinic results">
          <hgroup className="uh-section-header">
            <h2>Nearby clinics</h2>
            <p>Browse available facilities and book your next appointment.</p>
          </hgroup>

          {/* Error banner */}
          {error && (
            <p className="uh-error" role="alert">⚠ {error}</p>
          )}

          {/* Loading state */}
          {loading && (
            <p className="uh-loading" aria-live="polite">Loading clinics…</p>
          )}

          {/* Results */}
          {!loading && !error && (
            <>
              <p className="uh-results-count">
                Showing <strong>{filtered.length}</strong> of {clinics.length} facilities
              </p>

              {filtered.length === 0 ? (
                <p className="uh-empty">No clinics match your search. Try adjusting your filters.</p>
              ) : (
                <ul className="uh-clinic-grid" role="list">
                  {filtered.map((clinic) => (
                    <li key={clinic.id}>
                      <article className="uh-clinic-card">

                        <header className="uh-clinic-top">
                          <hgroup>
                            <h3 className="uh-clinic-name">{clinic.name}</h3>
                            <p className="uh-clinic-location">
                              {clinic.municipality}, {clinic.district}, {clinic.province}
                            </p>
                          </hgroup>
                          <mark className={`uh-type-badge ${TYPE_BADGE[clinic.facility_type] ?? 'badge-satellite'}`}>
                            {TYPE_LABEL[clinic.facility_type] ?? clinic.facility_type}
                          </mark>
                        </header>

                        <dl className="uh-clinic-meta">
                          {clinic.address && (
                            <>
                              <dt><strong>Address</strong></dt>
                              <dd>{clinic.address}</dd>
                            </>
                          )}
                        </dl>

                        {clinic.services?.length > 0 && (
                          <ul className="uh-chip-row" aria-label="Services offered">
                            {clinic.services.map((s) => (
                              <li key={s} className="uh-chip">{s}</li>
                            ))}
                          </ul>
                        )}

                        <button
                          className="uh-join-btn"
                          onClick={() => handleJoinQueue(clinic)}
                          aria-label={`Join queue at ${clinic.name}`}
                        >
                          Join Queue
                        </button>

                      </article>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

    </>
  )
}