export interface Route {
  page: string
  param?: string
  extra?: string
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  return { page: parts[0] ?? 'overview', param: parts[1], extra: parts[2] }
}

export function navigate(path: string): void {
  window.location.hash = `#/${path}`
}
