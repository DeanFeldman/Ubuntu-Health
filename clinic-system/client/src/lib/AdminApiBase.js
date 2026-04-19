export default function getAdminApiBase() {
  return (
    import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
    (window.location.hostname === 'localhost'
      ? 'http://localhost:8080'
      : '')
  )
}