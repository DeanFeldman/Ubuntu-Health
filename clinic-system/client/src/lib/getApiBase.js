// Returns the API base URL for the app.
// In tests, window.__API_BASE__ can be set to avoid direct use of import.meta.env.
export default function getApiBase() {
  if (typeof window !== 'undefined' && window.__API_BASE__) {
    return window.__API_BASE__
  }

  return import.meta.env.VITE_API_BASE_URL || ''
}