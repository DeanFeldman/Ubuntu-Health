export function resolveApiBase(hostname, injectedApiBase) {
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1'

  if (isLocalHost) {
    return 'http://localhost:8080'
  }

  return injectedApiBase || ''
}

export default function getApiBase() {
  return resolveApiBase(window.location.hostname, window.__API_BASE__)
}
