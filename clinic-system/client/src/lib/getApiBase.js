// Returns the API base URL for the app.
// In tests, window.__API_BASE__ can be set to avoid direct use of import.meta.env.
export default function getApiBase() {
  return window.__API_BASE__ || ''
}