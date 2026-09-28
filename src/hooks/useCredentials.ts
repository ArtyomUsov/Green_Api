import { useCallback, useEffect, useState } from 'react'
import type { GreenApiCredentials } from '../api/greenApi'

const STORAGE_KEY = 'green-api-credentials'

export function loadCredentials(): GreenApiCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GreenApiCredentials>
    if (
      !parsed.idInstance ||
      !parsed.apiTokenInstance ||
      typeof parsed.idInstance !== 'string' ||
      typeof parsed.apiTokenInstance !== 'string'
    ) {
      return null
    }
    return {
      apiUrl: typeof parsed.apiUrl === 'string' && parsed.apiUrl ? parsed.apiUrl : 'https://api.green-api.com',
      idInstance: parsed.idInstance,
      apiTokenInstance: parsed.apiTokenInstance,
    }
  } catch {
    return null
  }
}

export function saveCredentials(creds: GreenApiCredentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds))
}

export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Holds GREEN-API credentials: loaded from localStorage on mount,
 * saved on login and cleared on logout.
 */
export function useCredentials() {
  const [credentials, setCredentials] = useState<GreenApiCredentials | null>(null)

  useEffect(() => {
    setCredentials(loadCredentials())
  }, [])

  const login = useCallback((creds: GreenApiCredentials) => {
    saveCredentials(creds)
    setCredentials(creds)
  }, [])

  const logout = useCallback(() => {
    clearCredentials()
    setCredentials(null)
  }, [])

  return { credentials, login, logout }
}
