export default function getApiBase() {
  return (
    window.__API_BASE__ ||
    (window.location.hostname === 'localhost'
      ? 'http://localhost:8080'
      : '')
  )
}